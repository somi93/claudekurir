import { ref, watch, type ComputedRef } from "vue";
import { fetchFinanceSettings, updateFinanceSettings } from "~/services/financeSettingsService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import { DEFAULT_CURRENCY } from "~/utils/currency";
import type { FinanceSettings } from "~/types/finance-settings";

// options.enabled - lazy gate za tabove: dok je false, composable ne povlači
// podatke (komponenta iza taba još nije otvorena). Bez opcije se ponaša kao i
// prije (uvek učitava).
export const useFinanceSettings = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const alertStore = useAlertStore();

  const settings = ref<FinanceSettings | null>(null);
  const loadingSettings = ref(false);
  const savingSettings = ref(false);
  const errorMessage = ref("");

  const fetchSettings = async (id: number) => {
    loadingSettings.value = true;
    try {
      settings.value = await fetchFinanceSettings(id);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(
        error,
        "Ne mogu da učitam finansijske postavke."
      );
    } finally {
      loadingSettings.value = false;
    }
  };

  const saveSettings = async () => {
    if (!companyId.value || !settings.value) return;
    savingSettings.value = true;
    try {
      // assignment_courier_count se šalje SAMO za TOP_N, inače null (validaciono
      // pravilo iz Uputstva 02.09). timeout_action/courier_pool imaju backend
      // default pa uvijek idu s vrijednošću; offer_timeout_seconds se provlači
      // kakav jeste (5-120 ili null).
      const mode = settings.value.assignment_mode ?? "ALL";
      settings.value = await updateFinanceSettings(companyId.value, {
        cash_limit_amount: settings.value.cash_limit_amount,
        cash_limit_enforcement: settings.value.cash_limit_enforcement,
        payout_period_days: settings.value.payout_period_days,
        currency: settings.value.currency?.trim() || DEFAULT_CURRENCY,
        daily_handover_time: settings.value.daily_handover_time || null,
        assignment_mode: mode,
        assignment_courier_count:
          mode === "TOP_N" ? settings.value.assignment_courier_count ?? null : null,
        assignment_timeout_action:
          settings.value.assignment_timeout_action ?? "NEXT_NEAREST",
        assignment_courier_pool: settings.value.assignment_courier_pool ?? "ALL_ACTIVE",
        offer_timeout_seconds: settings.value.offer_timeout_seconds ?? null,
        show_price_breakdown: settings.value.show_price_breakdown ?? true,
      });
      alertStore.success("Finansijske postavke su sačuvane.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(
        error,
        "Ne mogu da sačuvam finansijske postavke."
      );
    } finally {
      savingSettings.value = false;
    }
  };

  // immediate: true - companyId polazi od hardkodovane vrednosti (vidi
  // useDeliveryCompaniesStore), ne od null-a, pa bez ovoga watch nikad ne bi
  // okinuo prvi fetch. enabled u depovima: kad se tab prvi put otvori, watch
  // okine i tek tada ide fetch.
  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled]) => {
      if (!id || !enabled) return;
      fetchSettings(id);
    },
    { immediate: true }
  );

  return {
    settings,
    loadingSettings,
    savingSettings,
    errorMessage,
    saveSettings,
  };
};
