import { ref, type ComputedRef } from "vue";
import { fetchCourierZones } from "~/services/courierZonesService";
import { getErrorStatus, getServerMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { Zone } from "~/types/zone";

// Zone su opcione svugdje - kurir bez terenskog ograničenja bira "Svejedno mi
// je" (zone_id: null). Ako firma još nema definisan grad, backend vraća 422 -
// to nije greška koja blokira formu, samo znači prazna lista zona.
export const useCourierZones = (
  courierId: ComputedRef<number>,
  deliveryCompanyId: ComputedRef<number | null>
) => {
  const alertStore = useAlertStore();

  const zones = ref<Zone[]>([]);
  const loading = ref(false);

  const load = async () => {
    zones.value = [];
    if (!Number.isFinite(courierId.value) || courierId.value <= 0 || !deliveryCompanyId.value) {
      return;
    }

    loading.value = true;
    try {
      zones.value = await fetchCourierZones(courierId.value, deliveryCompanyId.value);
    } catch (error) {
      if (getErrorStatus(error) === 422) {
        alertStore.warning(getServerMessage(error) ?? "Firma još nema definisan grad.");
      } else {
        alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam zone."));
      }
    } finally {
      loading.value = false;
    }
  };

  return {
    zones,
    loading,
    load,
  };
};
