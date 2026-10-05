import { computed, reactive, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import type { Pricing } from "~/types/pricing";
import { resolveCurrency } from "~/utils/currency";
import { stepAmount, type PriceConfig } from "~/utils/pricing";
import {
  makePriceDraft,
  placeServerMessages,
  priceConfigOf,
  priceDirty,
  priceDirtyFields,
  priceErrors,
  priceNumbers,
  priceSanity,
  type PriceDraft,
} from "~/utils/pricingDrafts";

// Nacrt cijene dostave (startna i po kilometru): tekst sa zarezom kako se kuca, nad sačuvanom cijenom.
// Greška polja se pokazuje tek kad je polje napušteno (blur) ili je pokušano snimanje; dok se kuca,
// nepotpun unos ("", "0,") nije greška. Sačuvano stanje (`saved`) se mijenja samo kad server prihvati.
export type PriceKey = "base" | "km";

// Korak ± dugmadi: 0,10 za startnu cijenu, 0,05 za cijenu po kilometru (spec "Nacrt cijene").
const STEP: Record<PriceKey, number> = { base: 0.1, km: 0.05 };

const BLANK: PriceDraft = { base: "", km: "" };

export type PriceErrors = { base?: string; km?: string };

export const usePricingDraft = (
  saved: Ref<Pricing | null>,
  // Valuta za poruku o sumnjivom iznosu; bez nje se uzima valuta iz same cijene.
  currency?: MaybeRefOrGetter<string | null | undefined>
) => {
  const draft = reactive<PriceDraft>(saved.value ? makePriceDraft(saved.value) : { ...BLANK });
  const touched = reactive<Record<PriceKey, boolean>>({ base: false, km: false });
  // Pokušano je snimanje: sve greške su vidljive, i ona za polje koje se tek kuca.
  const submitted = ref(false);

  // Poruke servera (422) uz polja, poruka bez polja i opšta poruka; nestaju čim dispečer izmijeni unos.
  const serverErrors = ref<PriceErrors>({});
  const serverLoose = ref<string[]>([]);
  const serverMessage = ref("");

  const currencyText = computed(() => resolveCurrency(toValue(currency) ?? saved.value?.currency));

  // Sve greške unosa, bez obzira na to da li su vidljive (Sačuvaj je onemogućen dok ih ima).
  const rawErrors = computed<PriceErrors>(() => (saved.value ? priceErrors(draft) : {}));

  const show = (key: PriceKey) => touched[key] || submitted.value;

  // Greške koje se pokazuju uz polja: dotaknuto polje ili pokušano snimanje.
  const errors = computed<PriceErrors>(() => {
    const raw = rawErrors.value;
    const out: PriceErrors = {};
    if (raw.base && show("base")) out.base = raw.base;
    if (raw.km && show("km")) out.km = raw.km;
    return out;
  });

  // Greška koja stoji uz polje: vlastita provjera ili poruka servera.
  const shownErrors = computed<PriceErrors>(() => {
    const out: PriceErrors = {};
    const base = errors.value.base ?? serverErrors.value.base;
    const km = errors.value.km ?? serverErrors.value.km;
    if (base) out.base = base;
    if (km) out.km = km;
    return out;
  });

  const dirty = computed(() => (saved.value ? priceDirty(draft, saved.value) : false));
  const dirtyFields = computed(() =>
    saved.value ? priceDirtyFields(draft, saved.value) : { base: false, km: false }
  );
  const savedNumbers = computed<PriceConfig>(() =>
    saved.value ? priceConfigOf(saved.value) : { base: 0, km: 0 }
  );
  // Iznosi za obračun: uneseni ako su važeći, inače sačuvani (obračun nikad ne računa sa praznim poljem).
  const numbers = computed<PriceConfig>(() =>
    saved.value ? priceNumbers(draft, saved.value) : { base: 0, km: 0 }
  );
  const sanity = computed(() =>
    saved.value ? priceSanity(draft, saved.value, currencyText.value) : null
  );

  const clearServer = () => {
    if (Object.keys(serverErrors.value).length) serverErrors.value = {};
    if (serverLoose.value.length) serverLoose.value = [];
    if (serverMessage.value) serverMessage.value = "";
  };

  // Kucanje: nepotpun unos ne smije odmah biti greška, pa se polje "otkucava" dok se ne napusti.
  const edit = (key: PriceKey, value: string) => {
    draft[key] = value;
    if (!submitted.value) touched[key] = false;
    clearServer();
  };

  const blur = (key: PriceKey) => {
    touched[key] = true;
  };

  // ± dugme: pomjera za korak; tekst koji nije broj kreće od sačuvane vrijednosti.
  const step = (key: PriceKey, dir: 1 | -1) => {
    draft[key] = stepAmount(draft[key], dir, STEP[key], savedNumbers.value[key]);
    clearServer();
  };

  // Pokušaj snimanja: greške postaju vidljive; true kad nema nijedne i može se slati.
  const submit = (): boolean => {
    submitted.value = true;
    return Object.keys(rawErrors.value).length === 0;
  };

  // Nacrt nazad na sačuvano (ili na prazno kad cijena nije učitana).
  const reset = (next: Pricing | null = saved.value) => {
    Object.assign(draft, next ? makePriceDraft(next) : BLANK);
    touched.base = false;
    touched.km = false;
    submitted.value = false;
    clearServer();
  };

  // Poslije snimanja: nacrt se vraća na ono što je server sačuvao ("2,5" postaje "2,50").
  const setSaved = (next: Pricing | null = saved.value) => reset(next);

  // Neuspjeh snimanja: poruke servera uz polja, ostalo kao zajednička poruka nad poljima.
  const setServerFailure = (failure: { message: string; fields: Record<string, string> }) => {
    const placed = placeServerMessages("price", failure.fields);
    serverErrors.value = placed.inline;
    serverLoose.value = placed.loose;
    serverMessage.value = failure.message;
  };

  // Nova cijena stigla (poslije snimanja, ponovnog učitavanja ili druga firma): nacrt se vraća na sačuvano
  // osim kad dispečer ima nacrt za ISTU firmu koji se razlikuje i od nove sačuvane cijene. Poređenje sa
  // prethodnom cijenom odlučuje da li je nacrt uopšte postojao; poređenje sa novom da li je snimanje
  // upravo prihvatilo ono što je ukucano (tada se tekst normalizuje).
  watch(saved, (next, prev) => {
    if (!next) {
      reset(null);
      return;
    }
    const sameCompany = prev != null && prev.delivery_company_id === next.delivery_company_id;
    const hadDraft = sameCompany && prev != null && priceDirty(draft, prev);
    if (!hadDraft || !priceDirty(draft, next)) reset(next);
  });

  return {
    draft,
    touched,
    errors,
    rawErrors,
    shownErrors,
    serverErrors,
    serverLoose,
    serverMessage,
    dirty,
    dirtyFields,
    savedNumbers,
    numbers,
    sanity,
    edit,
    blur,
    step,
    submit,
    reset,
    setSaved,
    setServerFailure,
  };
};

export type PricingDraftApi = ReturnType<typeof usePricingDraft>;
