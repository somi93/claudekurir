import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from "vue";
import {
  createVehicleRule,
  deleteVehicleRule,
  updateVehicleRule,
  fetchVehicleRules as fetchVehicleRulesRequest,
  type VehicleRulePayload,
} from "~/services/vehicleRulesService";
import { plainFailure, saveFailure } from "~/composables/useDeliveryPricing";
import type { ActionResult } from "~/composables/useCourierRoster";
import { toAmount } from "~/utils/currency";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import {
  findDuplicateRule,
  planMove,
  planNewRule,
  recommendRule,
  rulesUsingSurcharge,
  ruleTitle,
  splitRules,
  type PriorityChange,
  type RuleContext,
  type RuleRecommendation,
  type RuleTitleLookup,
} from "~/utils/pricing";
import { makeRuleDraft, toRuleBody, type RuleDraft } from "~/utils/pricingDrafts";
import type { VehicleRule } from "~/types/pricing";

const NO_ANSWER = "Server ne odgovara.";

const EMPTY_LOOKUP: RuleTitleLookup = { zones: [], surcharges: [] };

// Pravilo kakvo je server vratio, ili null kad odgovor ne nosi red (oblik odgovora nije potvrđen).
const asRule = (rule: VehicleRule | null | undefined): VehicleRule | null =>
  rule && typeof rule.id === "number" ? rule : null;

// options.lookup - zone i doplate za naslov uslova (condition_text) i za izbor pravila u primjeru; ekran
// ih daje jer zone i doplate nisu u ovom composable-u.
export const useVehicleRules = (
  companyId: ComputedRef<number | null>,
  options: { lookup?: MaybeRefOrGetter<RuleTitleLookup> } = {}
) => {
  const vehicleRules = ref<VehicleRule[]>([]);
  const loadingVehicleRules = ref(false);
  // Pad učitavanja: ekran pokazuje poruku sa "Pokušaj ponovo" umjesto prazne liste.
  const loadFailed = ref(false);
  // Kratak razlog uz naslov ("Server ne odgovara." / nema veze).
  const loadReason = ref("");

  // Odgovor za firmu koja više nije izabrana se odbacuje.
  let seq = 0;

  const fetchVehicleRules = async (id: number) => {
    const mine = ++seq;
    loadingVehicleRules.value = true;
    loadFailed.value = false;
    loadReason.value = "";
    try {
      const loaded = await fetchVehicleRulesRequest(id);
      if (mine === seq) vehicleRules.value = loaded;
    } catch (error) {
      if (mine !== seq) return;
      loadFailed.value = true;
      loadReason.value = toFriendlyErrorMessage(error, NO_ANSWER);
    } finally {
      if (mine === seq) loadingVehicleRules.value = false;
    }
  };

  // Ponovo učitava pravila firme. Za "Pokušaj ponovo".
  const reload = async () => {
    const id = companyId.value;
    if (id) await fetchVehicleRules(id);
  };

  // Tiho osvježavanje poslije izmjene (bez skeletona i bez stanja pada); true ako je uspjelo.
  const refreshQuietly = async (id: number): Promise<boolean> => {
    try {
      const loaded = await fetchVehicleRulesRequest(id);
      if (companyId.value === id) vehicleRules.value = loaded;
      return true;
    } catch {
      return false;
    }
  };

  // --- Pomoćnici bez mreže ---------------------------------------------------------------------------

  // Pravila poređana kako se primjenjuju: `list` odozgo prema dolje, `fallback` je "Sve ostalo" (uvijek
  // zadnje). PRETPOSTAVKA B1: server bira prvo pravilo koje se poklopi po rastućem priority.
  // Snimanje (novo ili izmijenjeno pravilo) je u toku.
  const savingRule = ref(false);

  const ordered = computed(() => splitRules(vehicleRules.value));
  const hasFallback = computed(() => ordered.value.fallback !== null);

  const lookupNow = (): RuleTitleLookup => toValue(options.lookup) ?? EMPTY_LOOKUP;

  // Nacrt za editor: iz pravila (izmjena) ili prazan (null); novo pravilo počinje kao zadano dok ga nema.
  const makeDraft = (rule: VehicleRule | null): RuleDraft => makeRuleDraft(rule, { hasFallback: hasFallback.value });
  // Naslov uslova pravila ("Zona: Centar", "Sve ostalo").
  const titleOf = (rule: VehicleRule): string => ruleTitle(rule, lookupNow());
  // Mjesto (od 1) ranijeg pravila sa istim uslovom, 0 ako ga nema (upozorenje u editoru).
  const duplicateOf = (draft: RuleDraft, selfId: number | null): number =>
    findDuplicateRule(draft, vehicleRules.value, selfId);
  // Pravila koja koriste doplatu, redom primjene (dijalog pri brisanju doplate).
  const usingSurcharge = (surchargeId: number): VehicleRule[] => rulesUsingSurcharge(vehicleRules.value, surchargeId);
  // Pravilo koje bira vozila za primjer (zone iz lookup-a); index -1 je zadano pravilo.
  const recommend = (ctx: Omit<RuleContext, "zones">): RuleRecommendation | null =>
    recommendRule(vehicleRules.value, { ...ctx, zones: lookupNow().zones });
  // Da li se pravilo može pomjeriti za jedno mjesto (strelica je onemogućena na rubu i za zadano).
  const canMove = (id: number, dir: -1 | 1): boolean => planMove(vehicleRules.value, id, dir) !== null;
  const ruleById = (id: number): VehicleRule | null => vehicleRules.value.find((r) => r.id === id) ?? null;

  // --- Radnje nad nacrtom ----------------------------------------------------------------------------
  // Nijedna radnja ne pokazuje obavijest: poruku (i "Poništi") pravi stranica iz rezultata.

  const replaceRow = (row: VehicleRule) => {
    vehicleRules.value = vehicleRules.value.map((r) => (r.id === row.id ? row : r));
  };

  const noVehicle: ActionResult = { ok: false, message: "Izaberi bar jedno vozilo.", fields: { preferred_vehicles: "Izaberi bar jedno vozilo." } };

  const bodyOf = (draft: RuleDraft, priority: number): VehicleRulePayload | null => {
    try {
      return toRuleBody(draft, priority, lookupNow());
    } catch {
      // Ekran prvo provjeri ruleErrors; ovo je samo zaštita od pravila bez vozila.
      return null;
    }
  };

  // Dodaje pravilo iz nacrta. Novo pravilo ide iza svih pravila, a PRIJE "Sve ostalo" (priority =
  // planNewRule); zadano pravilo (type "default") ide na kraj. U rezultatu je `id` novog pravila.
  const createFromDraft = async (draft: RuleDraft): Promise<ActionResult> => {
    const company = companyId.value;
    if (!company) return { ok: false, message: "Firma nije izabrana.", fields: {} };
    if (savingRule.value) return { ok: false, message: "", fields: {} };

    const isDefault = draft.type === "default";
    const plan = planNewRule(vehicleRules.value);
    const last = Math.max(vehicleRules.value.length, ...vehicleRules.value.map((r) => toAmount(r.priority) ?? 0)) + 1;
    const priority = isDefault ? last : plan.priority;
    const shift = isDefault ? null : plan.shiftFallback;
    const body = bodyOf(draft, priority);
    if (!body) return noVehicle;

    savingRule.value = true;
    try {
      if (shift) {
        // Prvo se zadano pravilo pomjera iza novog, tek onda se pravi novo. Obrnuto bi pad drugog poziva
        // ostavio novo pravilo IZA "Sve ostalo" (ili sa istim priority), pa se nikad ne bi primijenilo, a
        // dispečer bi mislio da radi. Ovako pad prvog poziva ne mijenja ništa, a pad drugog ostavlja samo
        // prazno mjesto u numeraciji. PRETPOSTAVKA B1: server bira po rastućem priority.
        const moved = asRule(await updateVehicleRule(shift.id, { priority: shift.priority }));
        if (companyId.value === company) {
          const row = ruleById(shift.id);
          if (row) replaceRow({ ...row, ...(moved ?? {}), priority: shift.priority });
        }
      }
      const created = asRule(await createVehicleRule(company, body));
      if (companyId.value !== company) return created ? { ok: true, id: created.id } : { ok: true };
      if (!created) {
        // Odgovor bez reda: pravilo je napravljeno, pa se lista učita ponovo.
        await refreshQuietly(company);
        return { ok: true };
      }
      vehicleRules.value = [...vehicleRules.value, created];
      return { ok: true, id: created.id };
    } catch (error) {
      return saveFailure(error);
    } finally {
      savingRule.value = false;
    }
  };

  // Mijenja pravilo iz nacrta. Mjesto u redoslijedu (priority) se ne dira.
  const updateFromDraft = async (id: number, draft: RuleDraft): Promise<ActionResult> => {
    const company = companyId.value;
    if (!company) return { ok: false, message: "Firma nije izabrana.", fields: {} };
    const current = ruleById(id);
    if (!current) return { ok: false, message: "Pravilo više ne postoji. Osvježi listu.", fields: {} };
    if (savingRule.value) return { ok: false, message: "", fields: {} };
    const body = bodyOf(draft, toAmount(current.priority) ?? 0);
    if (!body) return noVehicle;
    delete body.priority;

    savingRule.value = true;
    try {
      const saved = asRule(await updateVehicleRule(id, body));
      if (companyId.value !== company) return { ok: true };
      if (saved) {
        // Odgovor se slaže preko trenutnog reda, da ne pregazi što je u međuvremenu stiglo.
        replaceRow({ ...(ruleById(id) ?? current), ...saved });
        return { ok: true };
      }
      if (await refreshQuietly(company)) return { ok: true };
      // Ni lista se ne može osvježiti: pokazuje se ono što je poslano, uz upozorenje.
      replaceRow({ ...current, ...body });
      return { ok: true, warning: "Izmjena je sačuvana, ali ne mogu da osvježim listu. Osvježi stranicu." };
    } catch (error) {
      return saveFailure(error);
    } finally {
      savingRule.value = false;
    }
  };

  // Samo briše pravilo (stranica ga zove po jednom za svako pravilo doplate prije brisanja doplate, D7).
  const removeOnly = async (id: number): Promise<ActionResult> => {
    const company = companyId.value;
    try {
      await deleteVehicleRule(id);
      if (companyId.value === company) vehicleRules.value = vehicleRules.value.filter((r) => r.id !== id);
      return { ok: true };
    } catch (error) {
      return plainFailure(error, "Ne mogu da obrišem pravilo. Pokušaj ponovo.");
    }
  };

  // Pomjeranje je u toku (dva ili više PUT-ova); ekran onemogući strelice.
  const reordering = ref(false);

  // Primjenjuje nove priority: odmah u listi, pa PUT po pravilu. B6: više poziva nisu atomični. Ako neki
  // padne, lokalno se vraća staro stanje, a ono što je server već primio se vraća nazad (PUT starog
  // priority); ako ni to ne uspije, lista se učita sa servera da ekran ne laže o redoslijedu.
  const applyPriorities = async (changes: readonly PriorityChange[]): Promise<ActionResult> => {
    const company = companyId.value;
    const before = new Map<number, VehicleRule>();
    for (const change of changes) {
      const row = ruleById(change.id);
      if (row) before.set(change.id, row);
    }
    const next = new Map(changes.map((c) => [c.id, c.priority]));
    vehicleRules.value = vehicleRules.value.map((r) => {
      const priority = next.get(r.id);
      return priority === undefined ? r : { ...r, priority };
    });

    const settled = await Promise.allSettled(
      changes.map((c) => updateVehicleRule(c.id, { priority: c.priority }))
    );
    const rejected = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
    if (!rejected) return { ok: true };

    if (companyId.value === company) {
      vehicleRules.value = vehicleRules.value.map((r) => before.get(r.id) ?? r);
    }
    const applied = changes.filter((_, i) => settled[i]?.status === "fulfilled");
    if (applied.length > 0 && company) {
      const reverted = await Promise.allSettled(
        applied.map((c) => {
          const was = toAmount(before.get(c.id)?.priority);
          return was === null ? Promise.reject(new Error("Nema starog priority.")) : updateVehicleRule(c.id, { priority: was });
        })
      );
      if (reverted.some((s) => s.status === "rejected")) await refreshQuietly(company);
    }
    return plainFailure(rejected.reason, "Ne mogu da sačuvam novi redoslijed. Pokušaj ponovo; redoslijed je vraćen na staro.");
  };

  const orderKey = (): string => {
    const { list, fallback } = splitRules(vehicleRules.value);
    return [...list, ...(fallback ? [fallback] : [])].map((r) => r.id).join(",");
  };

  type MoveResult = ActionResult & { undo?: () => Promise<ActionResult> };

  // Pomjera pravilo za jedno mjesto (-1 gore, 1 dolje); planMove vodi računa o dupliranim priority i o
  // zadanom pravilu (ono se ne pomjera). Uspjeh nosi `undo` za obavijest "Poništi": vraća pomjeranje
  // samo ako se redoslijed od tada nije mijenjao.
  const move = async (id: number, dir: -1 | 1): Promise<MoveResult> => {
    if (reordering.value) return { ok: false, message: "", fields: {} };
    const plan = planMove(vehicleRules.value, id, dir);
    if (!plan) return { ok: false, message: "Ovo pravilo se ne može pomjeriti.", fields: {} };
    reordering.value = true;
    try {
      const result = await applyPriorities([plan.a, plan.b, ...plan.others]);
      if (!result.ok) return result;
      const after = orderKey();
      const back: -1 | 1 = dir === 1 ? -1 : 1;
      const undo = async (): Promise<ActionResult> => {
        if (orderKey() !== after) {
          return { ok: false, message: "Redoslijed se u međuvremenu promijenio, pa se pomjeranje ne može poništiti.", fields: {} };
        }
        const reverted = await move(id, back);
        return reverted.ok ? { ok: true } : reverted;
      };
      return { ok: true, undo };
    } finally {
      reordering.value = false;
    }
  };

  // immediate: true - prvi fetch firmi je asinhron (useDeliveryCompaniesStore),
  // pa companyId prelazi iz null u pravu vrijednost poslije mount-a; watch (ne
  // samo prvi poziv) je ono što stvarno okine fetchVehicleRules kad stigne.
  // Druga firma: prethodna pravila se odmah uklanjaju da se ne vide uz pogrešnu firmu.
  watch(
    companyId,
    (id, previous) => {
      if (previous !== undefined && previous !== id) {
        seq++;
        vehicleRules.value = [];
        loadingVehicleRules.value = false;
        loadFailed.value = false;
        loadReason.value = "";
      }
      if (!id) return;
      fetchVehicleRules(id);
    },
    { immediate: true }
  );

  return {
    vehicleRules,
    loadingVehicleRules,
    loadFailed,
    loadReason,
    savingRule,
    reload,
    ordered,
    hasFallback,
    reordering,
    makeDraft,
    titleOf,
    duplicateOf,
    usingSurcharge,
    recommend,
    canMove,
    ruleById,
    createFromDraft,
    updateFromDraft,
    removeOnly,
    move,
  };
};
