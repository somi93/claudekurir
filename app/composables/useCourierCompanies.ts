import { ref, type ComputedRef } from "vue";
import { fetchCourierCompanies } from "~/services/courierCompaniesService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { CourierCompany } from "~/types/courier";

// Firme za koje je kurir aktivno vezan - prvi poziv na ekranu "Radno vrijeme".
// 0 firmi znači kurir ne treba dalje da vidi kalendar; 1 firma se bira
// automatski bez prikaza dropdown-a (vidi Uputstvo_kurirski_raspored korak 1).
export const useCourierCompanies = (courierId: ComputedRef<number>) => {
  const alertStore = useAlertStore();

  const companies = ref<CourierCompany[]>([]);
  const selectedCompanyId = ref<number | null>(null);
  const loading = ref(true);

  const load = async () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;

    loading.value = true;
    try {
      companies.value = await fetchCourierCompanies(courierId.value);
      const stillValid = companies.value.some((company) => company.id === selectedCompanyId.value);
      selectedCompanyId.value = stillValid ? selectedCompanyId.value : (companies.value[0]?.id ?? null);
    } catch (error) {
      companies.value = [];
      selectedCompanyId.value = null;
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam dostavne firme."));
    } finally {
      loading.value = false;
    }
  };

  return {
    companies,
    selectedCompanyId,
    loading,
    load,
  };
};
