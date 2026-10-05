import { onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import { fetchVehicleRecommendation } from "~/services/vehicleRecommendationService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { VehicleRecommendation } from "~/types/vehicleRecommendation";

const DEBOUNCE_MS = 300;

// options.enabled - lazy gate za tabove (vidi useFinanceSettings). Dok je false
// se ne šalje ni prvi (prazan) recommend-vehicle poziv.
export const useVehicleRecommendation = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const zoneId = ref<number | null>(null);
  const distanceKm = ref<number | null>(null);
  const recommendation = ref<VehicleRecommendation | null>(null);
  const loading = ref(false);
  const errorMessage = ref("");

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
    } catch (error) {
      if (controller.signal.aborted) return;
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam simulaciju narudžbe.");
    } finally {
      if (!controller.signal.aborted) loading.value = false;
    }
  };

  const scheduleFetch = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!companyId.value || !(options.enabled?.value ?? true)) {
      abortController?.abort();
      recommendation.value = null;
      return;
    }
    debounceTimer = setTimeout(fetchNow, DEBOUNCE_MS);
  };

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
  };
};
