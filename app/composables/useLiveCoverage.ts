import { ref, type ComputedRef } from "vue";
import { fetchZoneLiveCoverage } from "~/services/dispatcherZonesService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { ZoneLiveCoverage } from "~/types/dispatcherZone";

// Stanje uživo po zonama. Ekran "Sada" ne smije da pokaže prazan prikaz kao "nikoga nema":
//  - `loaded`: podaci ove firme su bar jednom stigli;
//  - `failed`: zadnji poziv nije uspio (ako je `loaded`, stari podaci ostaju uz upozorenje od kada su);
//  - `updatedAt`: kad je zadnji uspješan odgovor stigao.
export const useLiveCoverage = (deliveryCompanyId: ComputedRef<number | null>) => {
  const alertStore = useAlertStore();

  const coverage = ref<ZoneLiveCoverage[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const failed = ref(false);
  const updatedAt = ref<number | null>(null);

  let seq = 0;

  // options.silent - greška se ne pokazuje kao zajednička obavijest (ekran piše svoje upozorenje).
  const load = async (options: { silent?: boolean } = {}) => {
    const mine = ++seq;
    if (!deliveryCompanyId.value) {
      coverage.value = [];
      loaded.value = false;
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const data = await fetchZoneLiveCoverage(deliveryCompanyId.value);
      if (mine !== seq) return;
      coverage.value = data;
      loaded.value = true;
      failed.value = false;
      updatedAt.value = Date.now();
    } catch (error) {
      if (mine !== seq) return;
      failed.value = true;
      if (!options.silent) alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam pregled uživo."));
    } finally {
      if (mine === seq) loading.value = false;
    }
  };

  // Promjena firme: brojevi prethodne ne smiju da ostanu dok nova ne stigne.
  const reset = () => {
    seq++;
    coverage.value = [];
    loaded.value = false;
    failed.value = false;
    updatedAt.value = null;
    loading.value = false;
  };

  return { coverage, loading, loaded, failed, updatedAt, load, reset };
};
