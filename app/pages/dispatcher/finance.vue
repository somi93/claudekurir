<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader title="Finansije" back-to="/" back-label="Nazad na početnu" />
    </template>

    <PageAlert v-if="errorMessage" closable class="mb-4" @close="clearError">
      {{ errorMessage }}
    </PageAlert>

    <GlobalTabBar v-model="activeTab" :tabs="financeTabs" class="mb-4" />

    <CompanyWalletPanel
      :active-tab="activeTab"
      :couriers="couriers"
      :balances="balances"
      :loading-balances="loadingBalances"
      :pending-handovers="pendingHandovers"
      :loading-handovers="loadingHandovers"
      :confirming-handover-id="confirmingHandoverId"
      :confirm-handover="confirmHandover"
      :history="handoverHistory"
      :loading-history="loadingHistory"
      :history-refresh-key="historyRefreshKey"
      :company-payouts="companyPayouts"
      :loading-payouts="loadingPayouts"
      :payouts-refresh-key="payoutsRefreshKey"
      :company-id="companyId"
      :load-history="fetchHandoverHistory"
      :load-payouts="fetchCompanyPayouts"
      :submitting-action="submittingWalletAction"
      :submit-cash-receipt="submitCashReceipt"
      :submit-payout="submitPayout"
      :currency="companyCurrency"
    />
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Finansije" });

import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useFinanceSettings } from "~/composables/useFinanceSettings";
import { useCompanyCouriers } from "~/composables/useCompanyCouriers";
import { useCompanyWallet } from "~/composables/useCompanyWallet";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import CompanyWalletPanel from "~/components/company/CompanyWalletPanel.vue";
import { resolveCurrency } from "~/utils/currency";

type FinanceTab = "handovers" | "balances" | "history" | "payouts";

const activeTab = ref<FinanceTab>("handovers");

const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId, errorMessage: companiesError } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();

const companyId = computed(() => selectedCompanyId.value);

// Valuta firme se čita sa finance-settings (kao na "Firma" strani) i prosljeđuje
// panelu za formatiranje iznosa; fallback "KM".
const { settings, errorMessage: financeError } = useFinanceSettings(companyId);
const companyCurrency = computed(() => resolveCurrency(settings.value?.currency));

const { couriers, errorMessage: couriersError } = useCompanyCouriers(companyId);

const {
  balances,
  loadingBalances,
  pendingHandovers,
  loadingHandovers,
  confirmingHandoverId,
  history: handoverHistory,
  loadingHistory,
  historyRefreshKey,
  fetchHistory: fetchHandoverHistory,
  companyPayouts,
  loadingPayouts,
  payoutsRefreshKey,
  fetchPayouts: fetchCompanyPayouts,
  submittingAction: submittingWalletAction,
  submitCashReceipt,
  submitPayout,
  errorMessage: walletError,
  confirmHandover,
} = useCompanyWallet(companyId, {
  enabled: computed(() => activeTab.value === "balances"),
});

const financeTabs = computed<GlobalTabBarItem<FinanceTab>[]>(() => [
  {
    value: "handovers",
    label: "Zahtevi za predaju gotovine",
    icon: "mdi-cash-plus",
    badge: pendingHandovers.value.length || undefined,
  },
  { value: "balances", label: "Balansi kurira", icon: "mdi-scale-balance" },
  { value: "history", label: "Istorija predaja", icon: "mdi-history" },
  { value: "payouts", label: "Isplate kuririma", icon: "mdi-cash-minus" },
]);

const errorMessage = computed(
  () =>
    companiesError.value ||
    financeError.value ||
    couriersError.value ||
    walletError.value
);
const clearError = () => {
  companiesError.value = "";
  financeError.value = "";
  couriersError.value = "";
  walletError.value = "";
};
</script>
