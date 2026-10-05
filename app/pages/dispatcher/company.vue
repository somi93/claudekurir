<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader :title="pageTitle" back-to="/" back-label="Nazad na početnu" />
    </template>

    <PageAlert v-if="errorMessage" closable class="mb-4" @close="clearError">
      {{ errorMessage }}
    </PageAlert>

    <GlobalTabBar v-model="activeTab" :tabs="companyTabs" class="mb-4" />

    <v-window v-model="activeTab">
      <v-window-item value="finance">
        <FinanceSettingsPanel
          v-if="openedTabs.has('finance')"
          v-model:settings="settings"
          :loading="loadingSettings"
          :saving="savingSettings"
          @save="saveSettings"
        />
      </v-window-item>

      <v-window-item value="restaurants">
        <RestaurantCooperationPanel
          v-if="openedTabs.has('restaurants')"
          :restaurants="restaurants"
          :loading="loadingRestaurants"
          :company-currency="companyCurrency"
          @toggle="onToggleRestaurant"
        />
      </v-window-item>
    </v-window>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Firma" });

import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useFinanceSettings } from "~/composables/useFinanceSettings";
import { useRestaurantCooperation } from "~/composables/useRestaurantCooperation";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import { resolveCurrency } from "~/utils/currency";
import FinanceSettingsPanel from "~/components/company/FinanceSettingsPanel.vue";
import RestaurantCooperationPanel from "~/components/company/RestaurantCooperationPanel.vue";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

type CompanyTab = "finance" | "restaurants";

const activeTab = ref<CompanyTab>("finance");

// Lazy tabovi: panel se montira i njegov composable povlači podatke tek kad
// dispečer prvi put otvori taj tab. Set pamti otvarane tabove pa povratak na
// već viđen tab ne refetch-uje / ne remount-uje.
const openedTabs = ref(new Set<CompanyTab>([activeTab.value]));
watch(activeTab, (tab) => openedTabs.value.add(tab));
const financeOpen = computed(() => openedTabs.value.has("finance"));
const restaurantsOpen = computed(() => openedTabs.value.has("restaurants"));

const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId, errorMessage: companiesError } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();

const companyId = computed(() => selectedCompanyId.value);

const pageTitle = computed(() =>
  companyId.value ? `Firma #${companyId.value}` : "Firma"
);

const {
  settings,
  loadingSettings,
  savingSettings,
  errorMessage: financeError,
  saveSettings,
} = useFinanceSettings(companyId, { enabled: financeOpen });

// Valuta firme za dost: prvenstveno sa finance-settings (odgovor 01.09, 1.1) -
// "Finansijske postavke" je podrazumijevani tab pa se settings učita odmah. Dok
// se ne učita (ili ako panel ikad izađe van tog toka), pada na currency sa
// /dispatcher/my-companies (odgovor backend 15.09, §II) - companiesStore ga
// učitava nezavisno od ovog taba. Fallback "KM" pokriva prazno stanje / stare
// odgovore bez ijednog izvora.
const companyCurrency = computed(() =>
  resolveCurrency(settings.value?.currency ?? companiesStore.selectedCompany?.currency)
);

const {
  restaurants,
  loadingRestaurants,
  errorMessage: restaurantsError,
  toggleRestaurant,
} = useRestaurantCooperation(companyId, { enabled: restaurantsOpen });

const onToggleRestaurant = (payload: {
  restaurant: RestaurantCooperation;
  active: boolean;
  reason?: string;
}) => toggleRestaurant(payload.restaurant, payload.active, payload.reason);

const companyTabs = computed<GlobalTabBarItem<CompanyTab>[]>(() => [
  { value: "finance", label: "Finansijske postavke", icon: "mdi-cash-multiple" },
  { value: "restaurants", label: "Saradnja sa restoranima", icon: "mdi-storefront-outline" },
]);

const errorMessage = computed(
  () => companiesError.value || financeError.value || restaurantsError.value
);
const clearError = () => {
  companiesError.value = "";
  financeError.value = "";
  restaurantsError.value = "";
};
</script>
