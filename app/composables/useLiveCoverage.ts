import { ref, type ComputedRef } from "vue";
import { fetchZoneLiveCoverage } from "~/services/dispatcherZonesService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { ZoneLiveCoverage } from "~/types/dispatcherZone";

export const useLiveCoverage = (deliveryCompanyId: ComputedRef<number | null>) => {
  const alertStore = useAlertStore();

  const coverage = ref<ZoneLiveCoverage[]>([]);
  const loading = ref(false);

  const load = async () => {
    if (!deliveryCompanyId.value) {
      coverage.value = [];
      return;
    }
    loading.value = true;
    try {
      coverage.value = await fetchZoneLiveCoverage(deliveryCompanyId.value);
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam pregled uživo."));
    } finally {
      loading.value = false;
    }
  };

  return { coverage, loading, load };
};
