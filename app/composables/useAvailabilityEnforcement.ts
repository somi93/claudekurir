import { ref, watch, type ComputedRef } from "vue";
import {
  fetchAvailabilityEnforcement,
  setAvailabilityEnforcement,
} from "~/services/dispatcherAvailabilityService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";

// options.enabled - lazy gate za tabove (vidi useFinanceSettings).
//
// `known` je istina samo kad je stanje UČITANO sa servera za izabranu firmu: pri promjeni firme i
// poslije pada učitavanja je false, pa ekran ne pokazuje stanje druge firme (prekidač je tada zaključan
// uz "Pokušaj ponovo"). `enabled` vrijedi samo dok je `known`.
export const useAvailabilityEnforcement = (
  deliveryCompanyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const alertStore = useAlertStore();

  const enabled = ref(false);
  const known = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const loadFailed = ref(false);

  let seq = 0;

  const load = async (id: number) => {
    const mine = ++seq;
    loading.value = true;
    loadFailed.value = false;
    try {
      const value = await fetchAvailabilityEnforcement(id);
      if (mine !== seq) return;
      enabled.value = value;
      known.value = true;
    } catch {
      if (mine !== seq) return;
      known.value = false;
      loadFailed.value = true;
    } finally {
      if (mine === seq) loading.value = false;
    }
  };

  const retry = () => {
    if (deliveryCompanyId.value) void load(deliveryCompanyId.value);
  };

  const setEnabled = async (next: boolean): Promise<boolean> => {
    if (!deliveryCompanyId.value || !known.value) return false;
    saving.value = true;
    try {
      await setAvailabilityEnforcement(deliveryCompanyId.value, next);
      enabled.value = next;
      alertStore.success(
        next ? "Provjera dostupnosti je uključena za ovu firmu." : "Provjera dostupnosti je isključena."
      );
      return true;
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da sačuvam podešavanje."));
      return false;
    } finally {
      saving.value = false;
    }
  };

  // Druga firma: stanje prethodne se briše odmah, prije nego što odgovor nove stigne.
  watch(deliveryCompanyId, () => {
    seq++;
    enabled.value = false;
    known.value = false;
    loadFailed.value = false;
  });

  watch(
    [deliveryCompanyId, () => options.enabled?.value ?? true],
    ([id, on]) => {
      if (id && on) void load(id);
    },
    { immediate: true }
  );

  return { enabled, known, loading, saving, loadFailed, retry, setEnabled };
};
