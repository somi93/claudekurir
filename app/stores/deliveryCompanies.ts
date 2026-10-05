import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { fetchMyCompanies, setCompanyCity as setCompanyCityRequest } from "~/services/deliveryCompaniesService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { Company } from "~/types/pricing";

// Deljeno između svih dispečerskih stranica (Firma/Raspored/Cenovnik/Dodela) -
// ranije je svaka stranica zvala useDeliveryCompanies() nezavisno, pa izbor
// firme na jednoj stranici nije pratio na drugu. Sidebar (DispatcherSidebar.vue)
// drži trajni selektor firme, pa stanje mora živeti ovde, ne po stranici.
export const useDeliveryCompaniesStore = defineStore("deliveryCompanies", () => {
  const companies = ref<Company[]>([]);
  const selectedCompanyId = ref<number | null>(null);
  const selectedCompany = computed(
    () => companies.value.find((c) => c.id === selectedCompanyId.value) ?? null
  );
  const loadingCompanies = ref(false);
  const savingCity = ref(false);
  const errorMessage = ref("");

  let fetchRequest: Promise<void> | null = null;

  // Fetch tačno jednom po sesiji, deljen sa svim pozivaocima (isti obrazac
  // kao useSessionStore.ensureUser) - poziva ga i sidebar i svaka stranica,
  // ali stvarni mrežni poziv se desi samo jednom.
  const ensureLoaded = (force = false) => {
    if (force) fetchRequest = null;
    if (!fetchRequest) {
      fetchRequest = (async () => {
        loadingCompanies.value = true;
        // Očisti prethodnu (možda stale) grešku pri svakom pokušaju - inače
        // jedan neuspjeh (npr. hladan dev server) ostane na ekranu i kad
        // kasniji pokušaj uspije.
        errorMessage.value = "";
        try {
          companies.value = await fetchMyCompanies();
          const stillValid = companies.value.some((c) => c.id === selectedCompanyId.value);
          if (!stillValid) selectedCompanyId.value = companies.value[0]?.id ?? null;
        } catch (error) {
          errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam dostavne firme.");
          // Pusti da se sljedeći poziv (druga stranica / sidebar re-mount)
          // ponovo pokuša umjesto da memo zauvijek drži neuspjeh.
          fetchRequest = null;
        } finally {
          loadingCompanies.value = false;
        }
      })();
    }
    return fetchRequest;
  };

  const setCompanyCity = async (cityId: number): Promise<boolean> => {
    if (!selectedCompanyId.value) return false;
    savingCity.value = true;
    try {
      const updated = await setCompanyCityRequest(selectedCompanyId.value, cityId);
      companies.value = companies.value.map((c) => (c.id === updated.id ? updated : c));
      useAlertStore().success("Grad firme je sačuvan.");
      return true;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam grad za firmu.");
      return false;
    } finally {
      savingCity.value = false;
    }
  };

  return {
    companies,
    selectedCompanyId,
    selectedCompany,
    loadingCompanies,
    savingCity,
    errorMessage,
    ensureLoaded,
    setCompanyCity,
  };
});
