import { ref, watch, type ComputedRef } from "vue";
import { fetchDeliveryPricing, updateDeliveryPricing } from "~/services/deliveryPricingService";
import { getErrorStatus, getFieldErrors, toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { ActionResult } from "~/composables/useCourierRoster";
import type { Pricing } from "~/types/pricing";

// Neuspjeh radnje kao rezultat (ne kao zajednička poruka stranice), da ga ekran pokaže uz ono što se mijenja.
export type ActionFailure = Extract<ActionResult, { ok: false }>;

const SAVE_REJECTED = "Server nije prihvatio izmjenu. Provjeri označeno polje.";
const SAVE_RETRY = "Server nije prihvatio izmjenu. Pokušaj ponovo; tvoj unos je ostao u formi.";

// Neuspjeh čuvanja iz forme: 422 sa porukama uz polja ("Provjeri označeno polje"), inače poruka da je unos
// ostao u formi. Poruke servera idu u `fields` pod imenima iz API-ja (utils/pricingDrafts.placeServerMessages).
// Dijele ga useDeliveryPricing, useSurcharges i useVehicleRules.
export const saveFailure = (error: unknown): ActionFailure => {
  const fields = getFieldErrors(error);
  const rejected = getErrorStatus(error) === 422 && Object.keys(fields).length > 0;
  return { ok: false, message: toFriendlyErrorMessage(error, rejected ? SAVE_REJECTED : SAVE_RETRY), fields };
};

// Neuspjeh radnje koja nema formu (prekidač, pomjeranje, brisanje): samo poruka, bez polja.
export const plainFailure = (error: unknown, fallback: string): ActionFailure => ({
  ok: false,
  message: toFriendlyErrorMessage(error, fallback),
  fields: {},
});

const NO_ANSWER = "Server ne odgovara.";

export const useDeliveryPricing = (companyId: ComputedRef<number | null>) => {
  const pricing = ref<Pricing | null>(null);
  const loadingPricing = ref(false);
  const savingPricing = ref(false);
  const pricingSaved = ref(false);
  const errorMessage = ref("");
  // Pad učitavanja: ekran pokazuje poruku sa "Pokušaj ponovo" umjesto prazne kartice.
  const loadFailed = ref(false);
  // Kratak razlog uz naslov ("Server ne odgovara." / nema veze).
  const loadReason = ref("");

  // Odgovor za firmu koja više nije izabrana se odbacuje.
  let seq = 0;

  const fetchPricing = async (id: number) => {
    const mine = ++seq;
    loadingPricing.value = true;
    loadFailed.value = false;
    loadReason.value = "";
    try {
      const loaded = await fetchDeliveryPricing(id);
      if (mine === seq) pricing.value = loaded;
    } catch (error) {
      if (mine !== seq) return;
      loadFailed.value = true;
      const reason = toFriendlyErrorMessage(error, NO_ANSWER);
      loadReason.value = reason;
      // STARI EKRAN: errorMessage ukloniti kad pricing.vue pređe na novi.
      errorMessage.value = reason === NO_ANSWER ? "Ne mogu da učitam cenu dostave." : reason;
    } finally {
      if (mine === seq) loadingPricing.value = false;
    }
  };

  const reload = async () => {
    const id = companyId.value;
    if (id) await fetchPricing(id);
  };

  // STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga savePrice).
  const savePricing = async () => {
    if (!companyId.value || !pricing.value) return;
    savingPricing.value = true;
    pricingSaved.value = false;
    try {
      pricing.value = await updateDeliveryPricing(companyId.value, {
        base_price: pricing.value.base_price,
        price_per_km: pricing.value.price_per_km,
        currency: pricing.value.currency,
      });
      pricingSaved.value = true;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam cenu dostave.");
    } finally {
      savingPricing.value = false;
    }
  };

  // Čuva cijenu iz nacrta (utils/pricingDrafts.toPricingBody): BROJEVI, ne tekst. Sačuvano stanje (`pricing`)
  // se mijenja tek kad server prihvati. Greška stiže kao rezultat sa porukama uz polja (base_price,
  // price_per_km), bez zajedničke poruke stranice.
  const savePrice = async (
    body: Pick<Pricing, "base_price" | "price_per_km" | "currency">
  ): Promise<ActionResult> => {
    const id = companyId.value;
    if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
    if (savingPricing.value) return { ok: false, message: "", fields: {} };
    savingPricing.value = true;
    try {
      const saved = await updateDeliveryPricing(id, body);
      if (companyId.value === id) {
        // Pun odgovor je sačuvana cijena; ako server vrati prazno tijelo, sačuvano je ono što je poslano.
        const current = pricing.value;
        pricing.value =
          saved && saved.base_price !== undefined ? saved : current ? { ...current, ...body } : current;
      }
      return { ok: true };
    } catch (error) {
      return saveFailure(error);
    } finally {
      savingPricing.value = false;
    }
  };

  // immediate: true - companyId polazi od hardkodovane vrednosti (vidi
  // useDeliveryCompaniesStore), ne od null-a, pa bez ovoga watch nikad ne bi
  // okinuo prvi fetch. Druga firma: prethodna cijena se odmah uklanja da se ne vidi uz pogrešnu firmu.
  watch(
    companyId,
    (id, previous) => {
      pricingSaved.value = false;
      if (previous !== undefined && previous !== id) {
        pricing.value = null;
        loadFailed.value = false;
        loadReason.value = "";
      }
      if (!id) {
        seq++;
        loadingPricing.value = false;
        return;
      }
      void fetchPricing(id);
    },
    { immediate: true }
  );

  return {
    pricing,
    loadingPricing,
    savingPricing,
    pricingSaved,
    errorMessage,
    loadFailed,
    loadReason,
    savePricing,
    savePrice,
    reload,
  };
};
