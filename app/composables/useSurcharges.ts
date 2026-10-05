import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from "vue";
import {
  createSurcharge,
  createSurchargeFromBody,
  deleteSurcharge,
  fetchSurcharges as fetchSurchargesRequest,
  setSurchargeActive,
  updateSurcharge,
  updateSurchargeActive,
} from "~/services/surchargesService";
import { fetchConditionTags as fetchConditionTagsRequest } from "~/services/conditionTagsService";
import type { ConditionTag, NewSurchargeForm, Surcharge, SurchargePreset } from "~/types/pricing";
import { SURCHARGE_PRESETS } from "~/data/surchargePresets";
import { plainFailure, saveFailure } from "~/composables/useDeliveryPricing";
import type { ActionResult } from "~/composables/useCourierRoster";
import { toAmount } from "~/utils/currency";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { clockText, round2 } from "~/utils/pricing";
import { toSurchargeBody, type SurchargeBody, type SurchargeDraft } from "~/utils/pricingDrafts";
import { useAlertStore } from "~/stores/alert";

// Backend šalje "HH:mm:ss" za default_time_from/to (vidi
// Dopuna_katalog_tagovi_frontend_cirilica.md), forma/v-time-picker rade sa
// "HH:mm" (isti format kao postojeći time_from/time_to na naknadama).
const trimSeconds = (time: string) => time.slice(0, 5);

// STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
const emptyNewSurcharge = (): NewSurchargeForm => ({
  name: "",
  description: "",
  type: "per_km",
  value: 0,
  unit: "",
  timeFrom: "",
  timeTo: "",
  autoTime: false,
  conditionTagId: null,
  icon: "mdi-tune-variant",
});

const NO_ANSWER = "Server ne odgovara.";

// Stavka kataloga "Brzo dodavanje": tag iz zajedničkog kataloga ili lokalni preset. `original` ide u
// makeSurchargeDraft (utils/pricingDrafts) kad dispečer izabere stavku.
export type SurchargeCatalogItem = {
  // Stabilan ključ za v-for: "tag:4" ili "preset:Centar grada".
  key: string;
  source: "tag" | "preset";
  name: string;
  // Za tag je to Tabler klasa (ti-*) sa backenda, za preset mdi-* (vidi utils/conditionTag.ts).
  icon: string;
  original: ConditionTag | SurchargePreset;
};

const nameKey = (name: string): string => name.trim().toLowerCase();

// "naziv, iznos i vrijeme"
const listText = (items: readonly string[]): string =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}` : (items[0] ?? "");

const timeDiffers = (got: string | null | undefined, sent: string | null): boolean =>
  got !== undefined && clockText(got) !== (sent ?? "");

// PRETPOSTAVKA B2: PUT prima sva polja. Ako ih server nije primio, odgovor nosi stare vrijednosti; polja
// koja odgovor ne nosi (undefined) se ne porede.
const rejectedFields = (sent: SurchargeBody, got: Surcharge): string[] => {
  const fields: string[] = [];
  if (typeof got.name === "string" && got.name.trim() !== sent.name) fields.push("naziv");
  if (got.type !== undefined && got.type !== sent.type) fields.push("tip");
  const value = toAmount(got.value);
  if (value !== null && round2(value) !== sent.value) fields.push("iznos");
  if (timeDiffers(got.time_from, sent.time_from) || timeDiffers(got.time_to, sent.time_to)) fields.push("vrijeme");
  return fields;
};

// Doplata sa onim što je poslano (kad odgovor ne nosi red, a lista se ne može osvježiti).
const patchFromBody = (s: Surcharge, body: SurchargeBody): Surcharge => ({
  ...s,
  name: body.name,
  description: body.description,
  icon: body.icon,
  type: body.type,
  value: body.value,
  unit: body.unit,
  time_from: body.time_from,
  time_to: body.time_to,
});

// options.currency - valuta firme za jedinicu doplate (KM/km, KM) u tijelu zahtjeva.
export const useSurcharges = (
  companyId: ComputedRef<number | null>,
  options: { currency?: MaybeRefOrGetter<string | null | undefined> } = {}
) => {
  const alertStore = useAlertStore();

  const surcharges = ref<Surcharge[]>([]);
  const loadingSurcharges = ref(false);
  const errorMessage = ref("");
  // Pad učitavanja: ekran pokazuje poruku sa "Pokušaj ponovo" umjesto prazne liste.
  const loadFailed = ref(false);
  // Kratak razlog uz naslov ("Server ne odgovara." / nema veze).
  const loadReason = ref("");

  const activeSurcharges = computed(() => surcharges.value.filter((s) => s.active));

  // Odgovor za firmu koja više nije izabrana se odbacuje.
  let seq = 0;

  const fetchSurcharges = async (id: number) => {
    const mine = ++seq;
    loadingSurcharges.value = true;
    loadFailed.value = false;
    loadReason.value = "";
    try {
      const loaded = await fetchSurchargesRequest(id);
      if (mine === seq) surcharges.value = loaded;
    } catch (error) {
      if (mine !== seq) return;
      loadFailed.value = true;
      const reason = toFriendlyErrorMessage(error, NO_ANSWER);
      loadReason.value = reason;
      // STARI EKRAN: errorMessage ukloniti kad pricing.vue pređe na novi.
      errorMessage.value = reason === NO_ANSWER ? "Ne mogu da učitam dodatne parametre." : reason;
    } finally {
      if (mine === seq) loadingSurcharges.value = false;
    }
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga setActive).
  const toggleSurcharge = async (surcharge: Surcharge) => {
    try {
      await updateSurchargeActive(surcharge.id, surcharge.active);
      alertStore.success(surcharge.active ? "Parametar je uključen." : "Parametar je isključen.");
    } catch (error) {
      surcharge.active = !surcharge.active;
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam izmenu naknade.");
    }
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuju ga createFromDraft/updateFromDraft).
  const newSurcharge = ref<NewSurchargeForm>(emptyNewSurcharge());
  const showAddSurcharge = ref(false);
  const savingSurcharge = ref(false);

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  const addSurcharge = async () => {
    if (!newSurcharge.value.name.trim() || !companyId.value) return;
    savingSurcharge.value = true;
    try {
      const created = await createSurcharge(companyId.value, newSurcharge.value);
      surcharges.value.push(created);
      newSurcharge.value = emptyNewSurcharge();
      showAddSurcharge.value = false;
      alertStore.success("Parametar je dodat.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam parametar.");
    } finally {
      savingSurcharge.value = false;
    }
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga removeOnly).
  const removeSurcharge = async (id: number) => {
    try {
      await deleteSurcharge(id);
      surcharges.value = surcharges.value.filter((s) => s.id !== id);
      alertStore.success("Parametar je obrisan.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da obrišem parametar.");
    }
  };

  // Zajednički katalog (condition-tags) - isti za sve firme, učitava se
  // jednom, nezavisno od companyId (vidi
  // Dopuna_katalog_tagovi_frontend_cirilica.md).
  const conditionTags = ref<ConditionTag[]>([]);
  const loadingConditionTags = ref(false);
  // Katalog je učitan barem jednom; dok nije, reload() ga pokušava ponovo.
  let conditionTagsLoaded = false;
  const fetchConditionTags = async () => {
    loadingConditionTags.value = true;
    try {
      conditionTags.value = await fetchConditionTagsRequest();
      conditionTagsLoaded = true;
    } catch (error) {
      // Katalog nije kritičan za rad ekrana - forma i dalje radi bez
      // "brzo dodavanje" chip-ova iz kataloga, ne blokiramo UI. Backend je
      // 16.08 potvrdio da GET /condition-tags radi ispravno, pa ako se
      // chip-ovi ne pojave, log ovde pomaže da se odmah vidi da li poziv
      // uopšte propada (umesto da izgleda kao prazan katalog).
      console.warn("Ne mogu da učitam condition-tags katalog:", error);
    } finally {
      loadingConditionTags.value = false;
    }
  };
  fetchConditionTags();

  // Ponovo učitava doplate firme (i katalog, ako ranije nije stigao). Za "Pokušaj ponovo".
  const reload = async () => {
    const id = companyId.value;
    const tags = conditionTagsLoaded ? Promise.resolve() : fetchConditionTags();
    if (id) await fetchSurcharges(id);
    await tags;
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga catalog).
  // Lokalni predlozi (Centar grada, Brdovit teren) - nisu deo kataloga.
  const localPresets = computed(() =>
    SURCHARGE_PRESETS.filter((preset) => !surcharges.value.some((s) => s.name === preset.name))
  );

  // "Brzo dodavanje": tagovi kataloga koji još nisu dodani (po condition_tag.id) i lokalni presetovi koji
  // nisu dodani (po nazivu, bez obzira na veličinu slova kao i provjera duplikata). Ide u
  // makeSurchargeDraft(item.original); dispečer i dalje mora da sačuva doplatu.
  const catalog = computed<SurchargeCatalogItem[]>(() => {
    const addedTags = new Set<number>();
    const addedNames = new Set<string>();
    for (const s of surcharges.value) {
      if (s.condition_tag) addedTags.add(s.condition_tag.id);
      addedNames.add(nameKey(s.name));
    }
    const items: SurchargeCatalogItem[] = [];
    for (const tag of conditionTags.value) {
      if (addedTags.has(tag.id)) continue;
      items.push({ key: `tag:${tag.id}`, source: "tag", name: tag.name, icon: tag.icon, original: tag });
    }
    for (const preset of SURCHARGE_PRESETS) {
      if (addedNames.has(nameKey(preset.name))) continue;
      items.push({
        key: `preset:${preset.name}`,
        source: "preset",
        name: preset.name,
        icon: preset.icon,
        original: preset,
      });
    }
    return items;
  });

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  // "Brzo dodavanje" iz kataloga - popuni Naziv (zaključan) + predloženo
  // vreme ako postoji, condition_tag_id ide u telo pri čuvanju. Korisnik i
  // dalje mora da klikne "Sačuvaj parametar" (vidi
  // UIUX_napomene_katalog_frontend.md).
  const selectConditionTag = (tag: ConditionTag) => {
    const hasDefaultTime = Boolean(tag.default_time_from && tag.default_time_to);
    newSurcharge.value = {
      ...emptyNewSurcharge(),
      name: tag.name,
      conditionTagId: tag.id,
      icon: tag.icon,
      autoTime: hasDefaultTime,
      timeFrom: hasDefaultTime ? trimSeconds(tag.default_time_from as string) : "",
      timeTo: hasDefaultTime ? trimSeconds(tag.default_time_to as string) : "",
    };
    showAddSurcharge.value = true;
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  // Lokalni presetovi - nisu deo kataloga (bez condition_tag_id), popune
  // ceo formu kao ranije, ali se i dalje mora eksplicitno sačuvati (isti
  // tok kao katalog chip-ovi, odluka 14.08).
  const selectPreset = (preset: SurchargePreset) => {
    newSurcharge.value = {
      ...emptyNewSurcharge(),
      name: preset.name,
      description: preset.description,
      type: preset.type,
      value: preset.value,
      unit: preset.unit,
      icon: preset.icon,
      autoTime: Boolean(preset.time_from),
      timeFrom: preset.time_from ?? "",
      timeTo: preset.time_to ?? "",
    };
    showAddSurcharge.value = true;
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi.
  // "Prilagođeni parametar" - otključava Naziv (samo katalog tagovi ga
  // zaključavaju), condition_tag_id se ne šalje.
  const selectCustomParameter = () => {
    newSurcharge.value.conditionTagId = null;
  };

  // --- Novi ekran: radnje nad nacrtom --------------------------------------------------------------
  // Nijedna radnja ne pokazuje obavijest: poruku (i "Poništi") pravi stranica iz rezultata.

  const replaceRow = (row: Surcharge) => {
    surcharges.value = surcharges.value.map((s) => (s.id === row.id ? row : s));
  };

  // Tiho osvježavanje liste nakon izmjene (bez skeletona i bez stanja pada); true ako je uspjelo.
  const refreshQuietly = async (id: number): Promise<boolean> => {
    try {
      const loaded = await fetchSurchargesRequest(id);
      if (companyId.value === id) surcharges.value = loaded;
      return true;
    } catch {
      return false;
    }
  };

  // Odgovor na POST ne mora nositi condition_tag; bez njega bi tag iz kataloga ostao u "Brzom dodavanju".
  const withTag = (created: Surcharge, tagId: number | null | undefined): Surcharge => {
    if (created.condition_tag || tagId == null) return created;
    const tag = conditionTags.value.find((t) => t.id === tagId);
    return tag ? { ...created, condition_tag: tag } : created;
  };

  const bodyOf = (draft: SurchargeDraft, isNew: boolean): SurchargeBody | null => {
    try {
      return toSurchargeBody(draft, { isNew, currency: toValue(options.currency) });
    } catch {
      // Ekran prvo provjeri surchargeErrors; ovo je samo zaštita od neispravnog iznosa.
      return null;
    }
  };

  const INVALID: ActionResult = { ok: false, message: "Iznos doplate nije ispravan.", fields: { value: "Unesi broj, npr. 0,30." } };

  // Dodaje doplatu iz nacrta (toSurchargeBody isNew: active i condition_tag_id idu samo uz novu). U
  // rezultatu je `id` nove doplate, da ekran može da je istakne.
  const createFromDraft = async (draft: SurchargeDraft): Promise<ActionResult> => {
    const id = companyId.value;
    if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
    if (savingSurcharge.value) return { ok: false, message: "", fields: {} };
    const body = bodyOf(draft, true);
    if (!body) return INVALID;
    savingSurcharge.value = true;
    try {
      const created = await createSurchargeFromBody(id, body);
      if (companyId.value !== id) return created ? { ok: true, id: created.id } : { ok: true };
      if (!created) {
        // Odgovor bez reda: doplata je napravljena, pa se lista učita ponovo.
        await refreshQuietly(id);
        return { ok: true };
      }
      surcharges.value = [...surcharges.value, withTag(created, body.condition_tag_id)];
      return { ok: true, id: created.id };
    } catch (error) {
      return saveFailure(error);
    } finally {
      savingSurcharge.value = false;
    }
  };

  // Mijenja doplatu punim tijelom (PRETPOSTAVKA B2: PUT prima sva polja). Ako odgovor ne nosi doplatu,
  // lista se osvježi sa servera; ako odgovor nosi vrijednosti koje se razlikuju od poslanih, izmjena je
  // sačuvana ali server nije primio sve: rezultat je ok sa `warning`, a lista pokazuje ono što server ima.
  const updateFromDraft = async (id: number, draft: SurchargeDraft): Promise<ActionResult> => {
    const company = companyId.value;
    if (!company) return { ok: false, message: "Firma nije izabrana.", fields: {} };
    const current = surcharges.value.find((s) => s.id === id);
    if (!current) return { ok: false, message: "Doplata više ne postoji. Osvježi listu.", fields: {} };
    if (savingSurcharge.value) return { ok: false, message: "", fields: {} };
    const body = bodyOf(draft, false);
    if (!body) return INVALID;
    savingSurcharge.value = true;
    try {
      const saved = await updateSurcharge(id, body);
      if (companyId.value !== company) return { ok: true };
      if (!saved) {
        if (await refreshQuietly(company)) return { ok: true };
        // Ni lista se ne može osvježiti: pokazuje se ono što je poslano, uz upozorenje.
        replaceRow(patchFromBody(current, body));
        return { ok: true, warning: "Izmjena je sačuvana, ali ne mogu da osvježim listu. Osvježi stranicu." };
      }
      // Odgovor se slaže preko trenutnog reda (ne preko onog sa početka), da ne pregazi što je u međuvremenu stiglo.
      replaceRow({ ...(surcharges.value.find((s) => s.id === id) ?? current), ...saved });
      const rejected = rejectedFields(body, saved);
      return rejected.length > 0
        ? { ok: true, warning: `Server nije primio sve izmjene: ${listText(rejected)}.` }
        : { ok: true };
    } catch (error) {
      return saveFailure(error);
    } finally {
      savingSurcharge.value = false;
    }
  };

  // Doplate čiji se prekidač upravo čuva (ekran ih onemogući da dva poziva ne idu preko jedan drugog).
  const togglingIds = ref(new Set<number>());

  // Uključuje ili isključuje doplatu: odmah u listi, a pri grešci vraća staro stanje. Obavijest sa
  // "Poništi" pravi stranica. Ako server odgovori suprotnim stanjem (npr. ne dozvoli ručno gašenje
  // automatske doplate usred prozora, B3), lista pokazuje stanje servera i rezultat nosi `warning`.
  const setActive = async (id: number, next: boolean): Promise<ActionResult> => {
    const current = surcharges.value.find((s) => s.id === id);
    if (!current) return { ok: false, message: "Doplata više ne postoji. Osvježi listu.", fields: {} };
    if (current.active === next) return { ok: true };
    if (togglingIds.value.has(id)) return { ok: false, message: "", fields: {} };
    const company = companyId.value;
    togglingIds.value.add(id);
    // PRETPOSTAVKA B3: backend sam postavlja activated_at pri prelasku u uključeno, a briše ga pri gašenju.
    const optimistic: Surcharge = { ...current, active: next, activated_at: next ? new Date().toISOString() : null };
    replaceRow(optimistic);
    try {
      const saved = await setSurchargeActive(id, next);
      if (companyId.value !== company) return { ok: true };
      if (!saved) return { ok: true };
      const row = { ...optimistic, ...saved };
      replaceRow(row);
      if (row.active !== next) {
        return { ok: true, warning: next ? "Server nije uključio doplatu." : "Server nije isključio doplatu." };
      }
      return { ok: true };
    } catch (error) {
      if (companyId.value === company) {
        const now = surcharges.value.find((s) => s.id === id);
        if (now && now.active === next) replaceRow(current);
      }
      return plainFailure(error, "Ne mogu da sačuvam izmjenu. Prekidač je vraćen na staro stanje.");
    } finally {
      togglingIds.value.delete(id);
    }
  };

  // Samo briše doplatu. Pravila koja je koriste stranica briše PRIJE ovoga (useVehicleRules.removeOnly po
  // pravilu), jer ponašanje servera nije potvrđeno (B4/D7).
  const removeOnly = async (id: number): Promise<ActionResult> => {
    const company = companyId.value;
    try {
      await deleteSurcharge(id);
      if (companyId.value === company) surcharges.value = surcharges.value.filter((s) => s.id !== id);
      return { ok: true };
    } catch (error) {
      return plainFailure(error, "Ne mogu da obrišem doplatu. Pokušaj ponovo.");
    }
  };

  // immediate: true - companyId polazi od hardkodovane vrednosti (vidi
  // useDeliveryCompaniesStore), ne od null-a, pa bez ovoga watch nikad ne bi
  // okinuo prvi fetch. Druga firma: prethodne doplate se odmah uklanjaju da se ne vide uz pogrešnu firmu.
  watch(
    companyId,
    (id, previous) => {
      if (previous !== undefined && previous !== id) {
        surcharges.value = [];
        loadFailed.value = false;
        loadReason.value = "";
        togglingIds.value.clear();
      }
      if (!id) {
        seq++;
        loadingSurcharges.value = false;
        return;
      }
      fetchSurcharges(id);
    },
    { immediate: true }
  );

  return {
    surcharges,
    loadingSurcharges,
    errorMessage,
    loadFailed,
    loadReason,
    activeSurcharges,
    toggleSurcharge,
    newSurcharge,
    showAddSurcharge,
    savingSurcharge,
    addSurcharge,
    removeSurcharge,
    conditionTags,
    localPresets,
    selectConditionTag,
    selectPreset,
    selectCustomParameter,
    catalog,
    togglingIds,
    reload,
    createFromDraft,
    updateFromDraft,
    setActive,
    removeOnly,
  };
};
