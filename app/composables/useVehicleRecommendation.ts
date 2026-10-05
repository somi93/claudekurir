import { onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from "vue";
import { fetchVehicleRecommendation } from "~/services/vehicleRecommendationService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { VehicleRecommendation } from "~/types/vehicleRecommendation";

const DEBOUNCE_MS = 300;

const NO_ANSWER = "Server ne odgovara.";

// options.enabled - lazy gate za tabove (vidi useFinanceSettings). Dok je false
// se ne šalje ni prvi (prazan) recommend-vehicle poziv.
// options.zoneId / options.distanceKm - spoljašnji refovi (npr. Primjer narudžbe, koji dijele sva tri
// taba); ako nisu dati, composable ima svoje i ponaša se kao ranije.
export const useVehicleRecommendation = (
  companyId: ComputedRef<number | null>,
  options: {
    enabled?: ComputedRef<boolean>;
    zoneId?: Ref<number | null>;
    distanceKm?: Ref<number | null>;
  } = {}
) => {
  const zoneId = options.zoneId ?? ref<number | null>(null);
  const distanceKm = options.distanceKm ?? ref<number | null>(null);
  const recommendation = ref<VehicleRecommendation | null>(null);
  const loading = ref(false);
  const errorMessage = ref("");
  // Zadnji poziv je pao. `recommendation` ostaje zadnji uspješan odgovor (ne gasi se), pa ekran može da
  // pokaže da primjer nije osvježen umjesto da ga izgubi.
  const loadFailed = ref(false);
  // Kratak razlog uz naslov ("Server ne odgovara." / nema veze).
  const loadReason = ref("");

  let abortController: AbortController | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const fetchNow = async () => {
    if (!companyId.value) return;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
      const result = await fetchVehicleRecommendation(
        companyId.value,
        { zoneId: zoneId.value, distanceKm: distanceKm.value },
        controller.signal
      );
      // Ignoriši odgovor ako je u međuvremenu stigao noviji zahtev.
      if (controller.signal.aborted) return;
      recommendation.value = result;
      loadFailed.value = false;
      loadReason.value = "";
      errorMessage.value = "";
    } catch (error) {
      if (controller.signal.aborted) return;
      loadFailed.value = true;
      const reason = toFriendlyErrorMessage(error, NO_ANSWER);
      loadReason.value = reason;
      // STARI EKRAN: errorMessage ukloniti kad pricing.vue pređe na novi.
      errorMessage.value = reason === NO_ANSWER ? "Ne mogu da učitam simulaciju narudžbe." : reason;
    } finally {
      if (!controller.signal.aborted) loading.value = false;
    }
  };

  const scheduleFetch = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!companyId.value || !(options.enabled?.value ?? true)) {
      abortController?.abort();
      recommendation.value = null;
      // Prekinut poziv ne javlja kraj, pa bi "učitavam" ostalo zauvijek.
      loading.value = false;
      return;
    }
    debounceTimer = setTimeout(fetchNow, DEBOUNCE_MS);
  };

  // Ponovo traži odmah, bez čekanja (za "Pokušaj ponovo").
  const reload = async () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!companyId.value || !(options.enabled?.value ?? true)) return;
    await fetchNow();
  };

  // Druga firma: odgovor za prethodnu se odmah uklanja (cijena i pravilo su njene). Ide prije glavnog
  // watch-a, pa novi poziv kreće tek poslije čišćenja.
  watch(companyId, () => {
    abortController?.abort();
    recommendation.value = null;
    loadFailed.value = false;
    loadReason.value = "";
    errorMessage.value = "";
  });

  watch(
    [companyId, zoneId, distanceKm, () => options.enabled?.value ?? true],
    scheduleFetch,
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    abortController?.abort();
  });

  return {
    zoneId,
    distanceKm,
    recommendation,
    loading,
    errorMessage,
    loadFailed,
    loadReason,
    reload,
  };
};
