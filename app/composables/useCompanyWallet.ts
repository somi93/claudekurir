import { ref, watch, type ComputedRef } from "vue";
import {
  confirmCashHandover,
  fetchCashHandoverHistory,
  fetchCompanyPayouts,
  fetchCouriersBalance,
  fetchPendingCashHandovers,
  payoutCourierWage,
  recordCashReceipt,
} from "~/services/dispatcherWalletService";
import { getErrorStatus, getServerMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { CourierBalance } from "~/types/courier-balance";
import type {
  CashHandoverHistoryFilters,
  CashHandoverHistoryItem,
  PendingCashHandover,
} from "~/types/cash-handover";
import type { CompanyPayout, CompanyPayoutFilters } from "~/types/payout";

// options.enabled - lazy gate za tab "Kase kurira". Pending handover-i se ipak
// UVEK povlače (pune badge na tabu i kad tab nije otvoren); velika lista balansa
// i istorija predaja čekaju da se tab otvori (istoriju okida panel svojim
// filter watcher-om, vidi CompanyWalletPanel).
export const useCompanyWallet = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const alertStore = useAlertStore();

  const balances = ref<CourierBalance[]>([]);
  const loadingBalances = ref(false);
  const pendingHandovers = ref<PendingCashHandover[]>([]);
  const loadingHandovers = ref(false);
  const confirmingHandoverId = ref<number | null>(null);
  const history = ref<CashHandoverHistoryItem[]>([]);
  const loadingHistory = ref(false);
  // Bumpuje se poslije akcija koje mijenjaju istoriju predaja (confirm, direktna
  // evidencija). WalletHistoryCard ga ima u watch-u pa re-fetchuje sa trenutnim
  // filterima - inače se potvrđeni red vidi tek na promjenu filtera.
  const historyRefreshKey = ref(0);
  // Isti obrazac za istoriju isplata firme (odgovor §3.6) - CompanyPayoutsCard
  // okida fetch svojim filter watcher-om, refreshKey ga natjera poslije isplate.
  const companyPayouts = ref<CompanyPayout[]>([]);
  const loadingPayouts = ref(false);
  const payoutsRefreshKey = ref(0);
  // Jedna zastavica - u modalu "Detalji kurira" je istovremeno otvoren najviše
  // jedan od dijaloga (primio gotovinu / isplati zaradu).
  const submittingAction = ref(false);
  const errorMessage = ref("");

  // cash-receipt / payout vraćaju 404 s čitljivom porukom kad kurir NIKAD nije
  // bio povezan s firmom (izmišljena kombinacija courierId + companyId, odgovor
  // 1.2). Za orphan kurire koji JESU imali vezu (otpušteni) akcije normalno rade.
  const cashActionErrorMessage = (error: unknown, fallback: string): string => {
    if (getErrorStatus(error) === 404) return getServerMessage(error) ?? fallback;
    return toFriendlyErrorMessage(error, fallback);
  };

  const fetchBalances = async (id: number) => {
    loadingBalances.value = true;
    try {
      balances.value = await fetchCouriersBalance(id);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam balanse kurira.");
    } finally {
      loadingBalances.value = false;
    }
  };

  const fetchHandovers = async (id: number) => {
    loadingHandovers.value = true;
    try {
      pendingHandovers.value = await fetchPendingCashHandovers(id);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(
        error,
        "Ne mogu da učitam zahteve za predaju gotovine."
      );
    } finally {
      loadingHandovers.value = false;
    }
  };

  const fetchHistory = async (filters: CashHandoverHistoryFilters) => {
    if (!companyId.value) return;
    loadingHistory.value = true;
    try {
      history.value = await fetchCashHandoverHistory(companyId.value, filters);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam istoriju predaja.");
    } finally {
      loadingHistory.value = false;
    }
  };

  const fetchPayouts = async (filters: CompanyPayoutFilters) => {
    if (!companyId.value) return;
    loadingPayouts.value = true;
    try {
      companyPayouts.value = await fetchCompanyPayouts(companyId.value, filters);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam istoriju isplata.");
    } finally {
      loadingPayouts.value = false;
    }
  };

  // Potvrda gasi red iz pending liste i osvezava balanse (cash_owed_to_company
  // se menja tek na backendu, najjednostavnije je ponovo ucitati listu).
  // Vraca boolean da dijalog moze da se zatvori tek na uspeh (isti obrazac kao
  // CompanyCouriersPanel create/update).
  const confirmHandover = async (
    handoverId: number,
    confirmedAmount: number,
    note?: string
  ): Promise<boolean> => {
    confirmingHandoverId.value = handoverId;
    try {
      await confirmCashHandover(handoverId, confirmedAmount, note);
      pendingHandovers.value = pendingHandovers.value.filter((h) => h.id !== handoverId);
      if (companyId.value) await fetchBalances(companyId.value);
      historyRefreshKey.value++;
      alertStore.success("Predaja gotovine je potvrđena.");
      return true;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da potvrdim predaju gotovine.");
      return false;
    } finally {
      confirmingHandoverId.value = null;
    }
  };

  // Dispečer direktno evidentira primljenu gotovinu (4c) - bez reda u pending
  // listi. Poslije osvježavamo balanse (cash_owed_to_company pada na backendu).
  const submitCashReceipt = async (
    courierId: number,
    amount: number,
    note?: string
  ): Promise<boolean> => {
    if (!companyId.value) return false;
    submittingAction.value = true;
    try {
      const res = await recordCashReceipt(courierId, {
        delivery_company_id: companyId.value,
        amount,
        ...(note ? { note } : {}),
      });
      await fetchBalances(companyId.value);
      // cash-receipt je (vjerovatno) confirmed cash-handover red - osvježi istoriju.
      historyRefreshKey.value++;
      alertStore.success("Predaja gotovine je evidentirana.");
      // Iznos veći od trenutnog duga - backend ne blokira, samo upozori (§2.3).
      if (res.warning) alertStore.warning(res.warning);
      return true;
    } catch (error) {
      errorMessage.value = cashActionErrorMessage(
        error,
        "Ne mogu da evidentiram predaju gotovine."
      );
      return false;
    } finally {
      submittingAction.value = false;
    }
  };

  // Isplata zarade kuriru (5) - method je "gotovina" / "bankovni transfer".
  // idempotencyKey dolazi iz dijaloga (generisan pri otvaranju forme, odgovor
  // 16.09.2026 §2) - isti kroz sve pokušaje istog otvaranja.
  const submitPayout = async (
    courierId: number,
    amount: number,
    method: string,
    idempotencyKey: string,
    note?: string
  ): Promise<boolean> => {
    if (!companyId.value) return false;
    submittingAction.value = true;
    try {
      const res = await payoutCourierWage(courierId, {
        delivery_company_id: companyId.value,
        amount,
        method,
        idempotency_key: idempotencyKey,
        ...(note ? { note } : {}),
      });
      await fetchBalances(companyId.value);
      // Nova isplata treba da se pojavi u istoriji isplata firme.
      payoutsRefreshKey.value++;
      alertStore.success("Zarada je isplaćena.");
      // Iznos veći od trenutnog duga - backend ne blokira, samo upozori (§2.3).
      if (res.warning) alertStore.warning(res.warning);
      return true;
    } catch (error) {
      errorMessage.value = cashActionErrorMessage(error, "Ne mogu da isplatim zaradu.");
      return false;
    } finally {
      submittingAction.value = false;
    }
  };

  watch(
    companyId,
    (id) => {
      if (id) fetchHandovers(id);
    },
    { immediate: true }
  );

  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled]) => {
      if (!id || !enabled) return;
      fetchBalances(id);
    },
    { immediate: true }
  );

  return {
    balances,
    loadingBalances,
    pendingHandovers,
    loadingHandovers,
    confirmingHandoverId,
    history,
    loadingHistory,
    fetchHistory,
    historyRefreshKey,
    companyPayouts,
    loadingPayouts,
    fetchPayouts,
    payoutsRefreshKey,
    submittingAction,
    submitCashReceipt,
    submitPayout,
    errorMessage,
    confirmHandover,
  };
};
