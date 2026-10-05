import { ref, watch, type ComputedRef } from "vue";
import {
  fetchAvailabilityEnforcement,
  setAvailabilityEnforcement,
} from "~/services/dispatcherAvailabilityService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";

// options.enabled - lazy gate za tabove (vidi useFinanceSettings).
export const useAvailabilityEnforcement = (
  deliveryCompanyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const alertStore = useAlertStore();

  const enabled = ref(false);
  const loading = ref(false);
  const saving = ref(false);

  const load = async (id: number) => {
    loading.value = true;
    try {
      enabled.value = await fetchAvailabilityEnforcement(id);
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam podešavanje provjere dostupnosti."));
    } finally {
      loading.value = false;
    }
  };

  const setEnabled = async (next: boolean): Promise<boolean> => {
    if (!deliveryCompanyId.value) return false;
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

  watch(
    [deliveryCompanyId, () => options.enabled?.value ?? true],
    ([id, on]) => {
      if (id && on) load(id);
      else if (!id) enabled.value = false;
    },
    { immediate: true }
  );

  return { enabled, loading, saving, setEnabled };
};
