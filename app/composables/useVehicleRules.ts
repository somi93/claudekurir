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
import { useAlertStore } from "~/stores/alert";
import type { VehicleRule, VehicleRuleConditionType, VehicleRuleVehicle } from "~/types/pricing";

// STARI EKRAN: ukloniti kad pricing.vue pređe na novi (forma i ruleToForm su zamijenjeni RuleDraft-om).
export type NewVehicleRule = {
  conditionType: VehicleRuleConditionType;
  conditionText: string;
  zoneId: number | null;
  surchargeId: number | null;
  minDistanceKm: number | null;
  maxDistanceKm: number | null;
  preferredVehicles: string[];
  note: string;
  maxTerrainFactor: number | null;
};

const emptyNewRule = (): NewVehicleRule => ({
  conditionType: "surcharge",
  conditionText: "",
  zoneId: null,
  surchargeId: null,
  minDistanceKm: null,
  maxDistanceKm: null,
  preferredVehicles: [],
  note: "",
  maxTerrainFactor: null,
});

// Postojeće pravilo -> forma (za izmenu klikom na red). condition_type na starim
// pravilima može izostati - izvedemo ga iz popunjenih polja.
const inferConditionType = (rule: VehicleRule): VehicleRuleConditionType => {
  if (rule.condition_type) return rule.condition_type;
  if (rule.zone_id !== null) return "zone";
  if (rule.min_distance_km != null || rule.max_distance_km != null) return "distance";
  if (rule.surcharge_id != null) return "surcharge";
  return "default";
};

const ruleToForm = (rule: VehicleRule): NewVehicleRule => ({
  conditionType: inferConditionType(rule),
  conditionText: rule.condition_text,
  zoneId: rule.zone_id,
  surchargeId: rule.surcharge_id ?? null,
  minDistanceKm: rule.min_distance_km ?? null,
  maxDistanceKm: rule.max_distance_km ?? null,
  preferredVehicles:
    rule.preferred_vehicles && rule.preferred_vehicles.length > 0
      ? [...rule.preferred_vehicles]
      : [rule.vehicle],
  note: rule.note ?? "",
  maxTerrainFactor: rule.max_terrain_factor,
});

// Broj iz v-model.number polja ume da ostane prazan string kad se očisti
// (clearable/backspace) umesto null - normalizuj pre slanja na backend.
const normalizeNumber = (value: unknown): number | null => (Number.isFinite(value) ? (value as number) : null);

const NO_ANSWER = "Server ne odgovara.";

const EMPTY_LOOKUP: RuleTitleLookup = { zones: [], surcharges: [] };

// Pravilo kakvo je server vratio, ili null kad odgovor ne nosi red (oblik odgovora nije potvrđen).
const asRule = (rule: VehicleRule | null | undefined): VehicleRule | null =>
  rule && typeof rule.id === "number" ? rule : null;

// options.enabled - lazy gate za tabove (vidi useFinanceSettings).
// options.lookup - zone i doplate za naslov uslova (condition_text) i za izbor pravila u primjeru; ekran
// ih daje jer zone i doplate nisu u ovom composable-u.
export const useVehicleRules = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean>; lookup?: MaybeRefOrGetter<RuleTitleLookup> } = {}
) => {
  const alertStore = useAlertStore();

  const vehicleRules = ref<VehicleRule[]>([]);
  const loadingVehicleRules = ref(false);
  const errorMessage = ref("");
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
      const reason = toFriendlyErrorMessage(error, NO_ANSWER);
      loadReason.value = reason;
      // STARI EKRAN: errorMessage ukloniti kad pricing.vue pređe na novi.
      errorMessage.value = reason === NO_ANSWER ? "Ne mogu da učitam pravila za vozila." : reason;
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

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (forma je zamijenjena RuleDraft-om).
  const newRule = ref<NewVehicleRule>(emptyNewRule());
  const showAddRule = ref(false);
  const savingRule = ref(false);
  // null = forma je u režimu dodavanja; broj = menjamo postojeće pravilo.
  const editingRuleId = ref<number | null>(null);

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  const closeRuleForm = () => {
    newRule.value = emptyNewRule();
    editingRuleId.value = null;
    showAddRule.value = false;
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  const startNewRule = () => {
    newRule.value = emptyNewRule();
    editingRuleId.value = null;
    showAddRule.value = true;
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  const startEditRule = (rule: VehicleRule) => {
    newRule.value = ruleToForm(rule);
    editingRuleId.value = rule.id;
    showAddRule.value = true;
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  // "distance" uslov zahteva bar jedno od min/max (backend vraća 422 ako su
  // oba prazna, 15.08 dopuna) - front proverava unapred da ne šalje uzalud.
  const isDistanceRangeValid = computed(
    () =>
      newRule.value.conditionType !== "distance" ||
      normalizeNumber(newRule.value.minDistanceKm) !== null ||
      normalizeNumber(newRule.value.maxDistanceKm) !== null
  );

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga utils/pricingDrafts.toRuleBody).
  // Zajednički payload za create i update (redosled polja prati backend primer).
  const buildRulePayload = (priority: number): VehicleRulePayload => ({
    condition_text: newRule.value.conditionText.trim() || "Pravilo",
    // Postojeće (staro) polje - nema posebnog birača u novoj formi, pa šaljemo
    // najpoželjnije vozilo iz rangirane liste da polje ostane popunjeno (backend
    // primer u dokumentaciji šalje oba polja zajedno).
    vehicle: newRule.value.preferredVehicles[0] as VehicleRuleVehicle,
    zone_id: newRule.value.conditionType === "zone" ? newRule.value.zoneId : null,
    max_terrain_factor: normalizeNumber(newRule.value.maxTerrainFactor),
    note: newRule.value.note.trim() || null,
    condition_type: newRule.value.conditionType,
    surcharge_id: newRule.value.conditionType === "surcharge" ? newRule.value.surchargeId : null,
    min_distance_km:
      newRule.value.conditionType === "distance"
        ? normalizeNumber(newRule.value.minDistanceKm)
        : null,
    max_distance_km:
      newRule.value.conditionType === "distance"
        ? normalizeNumber(newRule.value.maxDistanceKm)
        : null,
    preferred_vehicles: newRule.value.preferredVehicles,
    priority,
  });

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuju ga createFromDraft/updateFromDraft).
  // Jedno dugme "Sačuvaj" - kreira novo pravilo ili menja ono na koje je
  // dispečer kliknuo (editingRuleId). Redosled/priority se ne dira pri izmeni.
  const saveVehicleRule = async () => {
    if (
      newRule.value.preferredVehicles.length === 0 ||
      !companyId.value ||
      !isDistanceRangeValid.value
    )
      return;
    savingRule.value = true;
    try {
      if (editingRuleId.value !== null) {
        const existing = vehicleRules.value.find((r) => r.id === editingRuleId.value);
        const updated = await updateVehicleRule(
          editingRuleId.value,
          buildRulePayload(existing?.priority ?? vehicleRules.value.length)
        );
        vehicleRules.value = vehicleRules.value.map((r) =>
          r.id === updated.id ? updated : r
        );
        alertStore.success("Pravilo je izmenjeno.");
      } else {
        const created = await createVehicleRule(
          companyId.value,
          buildRulePayload(vehicleRules.value.length + 1)
        );
        vehicleRules.value.push(created);
        alertStore.success("Pravilo je dodato.");
      }
      closeRuleForm();
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam pravilo.");
    } finally {
      savingRule.value = false;
    }
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga removeOnly).
  const removeVehicleRule = async (id: number) => {
    try {
      await deleteVehicleRule(id);
      vehicleRules.value = vehicleRules.value.filter((r) => r.id !== id);
      alertStore.success("Pravilo je obrisano.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da obrišem pravilo.");
    }
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga move).
  // Susedna zamena mesta (strelice gore/dole), ne proizvoljni drag&drop -
  // dira samo dva reda bez obzira na dužinu liste. Menja priority oba
  // pravila da redosled na backendu prati novu poziciju u listi.
  const moveRule = async (id: number, direction: "up" | "down") => {
    const index = vehicleRules.value.findIndex((r) => r.id === id);
    if (index === -1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= vehicleRules.value.length) return;

    const current = vehicleRules.value[index];
    const neighbor = vehicleRules.value[swapIndex];
    // index / swapIndex su već provjereni gore - guard je samo da TS suzi tip
    // (noUncheckedIndexedAccess), ne može se desiti u runtime-u.
    if (!current || !neighbor) return;
    const currentPriority = current.priority ?? index + 1;
    const neighborPriority = neighbor.priority ?? swapIndex + 1;

    const reordered = [...vehicleRules.value];
    reordered[index] = { ...neighbor, priority: currentPriority };
    reordered[swapIndex] = { ...current, priority: neighborPriority };
    vehicleRules.value = reordered;

    try {
      await Promise.all([
        updateVehicleRule(current.id, { priority: neighborPriority }),
        updateVehicleRule(neighbor.id, { priority: currentPriority }),
      ]);
    } catch (error) {
      vehicleRules.value = vehicleRules.value.map((r) => {
        if (r.id === current.id) return current;
        if (r.id === neighbor.id) return neighbor;
        return r;
      });
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam novi redosled.");
    }
  };

  // --- Novi ekran: pomoćnici bez mreže ---------------------------------------------------------------

  // Pravila poređana kako se primjenjuju: `list` odozgo prema dolje, `fallback` je "Sve ostalo" (uvijek
  // zadnje). PRETPOSTAVKA B1: server bira prvo pravilo koje se poklopi po rastućem priority.
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

  // --- Novi ekran: radnje nad nacrtom ----------------------------------------------------------------
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
  // pa companyId prelazi iz null u pravu vrednost posle mount-a; watch (ne
  // samo prvi poziv) je ono što stvarno okine fetchVehicleRules kad stigne.
  // Druga firma: prethodna pravila se odmah uklanjaju da se ne vide uz pogrešnu firmu.
  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled], previous) => {
      if (previous && previous[0] !== id) {
        seq++;
        vehicleRules.value = [];
        loadingVehicleRules.value = false;
        loadFailed.value = false;
        loadReason.value = "";
      }
      if (!id || !enabled) return;
      fetchVehicleRules(id);
    },
    { immediate: true }
  );

  return {
    vehicleRules,
    loadingVehicleRules,
    errorMessage,
    loadFailed,
    loadReason,
    newRule,
    showAddRule,
    editingRuleId,
    isDistanceRangeValid,
    savingRule,
    saveVehicleRule,
    startNewRule,
    startEditRule,
    closeRuleForm,
    removeVehicleRule,
    moveRule,
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
