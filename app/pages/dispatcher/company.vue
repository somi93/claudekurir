<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader
        :title="headerTitle"
        back-to="/"
        :back-label="inPhoneDetail ? 'Nazad na listu restorana' : 'Nazad na početnu'"
        :intercept-back="inPhoneDetail"
        @back="view.close()"
      >
        <template v-if="headerSub" #subtitle>{{ headerSub }}</template>
      </PageHeader>
    </template>

    <PageAlert v-if="companiesError" closable class="mb-4" @close="companiesError = ''">
      {{ companiesError }}
    </PageAlert>

    <div class="co" data-company="page">
      <GlobalTabBar
        v-if="!inPhoneDetail"
        variant="pills"
        label="Sekcije firme"
        id-base="co"
        panel-id="co-panel"
        :model-value="view.tab.value"
        :tabs="tabs"
        @update:model-value="onTab"
      />

      <div id="co-panel" role="tabpanel" :aria-labelledby="`co-tab-${view.tab.value}`">
        <CompanySettings
          v-if="view.tab.value === 'settings'"
          :key="companyId ?? 0"
          ref="settingsPane"
          :settings="settings"
          :loading="loadingSettings"
          :failed="loadFailed"
          :error-text="financeError"
          :currency="companyCurrency"
          :balances="cash.balances.value"
          :balances-loading="cash.loading.value"
          :balances-failed="cash.failed.value"
          :restaurants-other="restaurantsOther"
          :restaurants-total="restaurantsTotal"
          :wide="wide"
          :save="saveSection"
          @retry="reloadSettings"
        />
        <CompanyRestaurants
          v-else
          :restaurants="restaurants"
          :loading="loadingRestaurants"
          :failed="restaurantsFailed"
          :error-text="restaurantsError"
          :currency="companyCurrency"
          :view="view"
          :wide="wide"
          :set-cooperation="setCooperation"
          @retry="reloadRestaurants"
        />
      </div>
    </div>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Firma" });

import { computed, onBeforeUnmount, ref } from "vue";
import { storeToRefs } from "pinia";
import { onBeforeRouteLeave } from "vue-router";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useCashBalances } from "~/composables/useCashBalances";
import { useCompanyView, useWideLayout, type CompanyTab } from "~/composables/useCompanyView";
import { useFinanceSettings } from "~/composables/useFinanceSettings";
import { useRestaurantCooperation } from "~/composables/useRestaurantCooperation";
import { interceptLeaving, registerCompanyChangeGuard } from "~/composables/useSheetGuard";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import CompanySettings from "~/components/company/settings/CompanySettings.vue";
import CompanyRestaurants from "~/components/company/restaurants/CompanyRestaurants.vue";
import { resolveCurrency } from "~/utils/currency";
import { inOtherCurrency } from "~/utils/restaurantCooperation";
import { toLatin } from "~/utils/toLatin";

// Firma: postavke (gotovina, dodjela, cijena, valuta) i saradnja sa restoranima. Oba dijela se uče
// odmah (broj restorana je uz tab, a upozorenje o valuti i posljedica limita trebaju podatke
// drugog dijela). Greške učitavanja stoje u mjestu liste sa "Pokušaj ponovo", ne kao zajednička
// poruka na vrhu.
const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId, selectedCompany, errorMessage: companiesError } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();

const companyId = computed(() => selectedCompanyId.value);

const wide = useWideLayout();
const settingsPane = ref<InstanceType<typeof CompanySettings> | null>(null);

// Druga firma u ladici dok editor ima nesačuvan unos: ladica pita ovu stranicu, a ona pita dispečera
// ("Imaš nesačuvane izmjene"). Tek poslije "Odbaci izmjene" firma se zaista mijenja.
const stopCompanyGuard = registerCompanyChangeGuard((next) => {
  if (!settingsPane.value?.isDirty()) return false;
  settingsPane.value.askBefore(() => {
    selectedCompanyId.value = next;
  });
  return true;
});
onBeforeUnmount(stopCompanyGuard);

const {
  settings,
  loadingSettings,
  loadFailed,
  loadReason: financeError,
  saveSection,
  reload: reloadSettings,
} = useFinanceSettings(companyId);

const {
  restaurants,
  loadingRestaurants,
  loadFailed: restaurantsFailed,
  errorMessage: restaurantsError,
  reload: reloadRestaurants,
  setCooperation,
} = useRestaurantCooperation(companyId);

const cash = useCashBalances(companyId);

// Valuta firme: prvenstveno sa finance-settings (odgovor 01.09, 1.1); dok se ne učita, sa
// /dispatcher/my-companies (odgovor 15.09, §II); fallback "KM". Uvijek je SAČUVANA valuta, ne ona
// koja je izabrana u editoru: brojači restorana i upozorenja prate ono što važi.
const companyCurrency = computed(() =>
  resolveCurrency(settings.value?.currency ?? selectedCompany.value?.currency)
);

const view = useCompanyView(restaurants, companyCurrency);

const restaurantsTotal = computed(() =>
  restaurants.value.length > 0 ? restaurants.value.filter((r) => !r.internal).length : null
);
const restaurantsOther = computed(() =>
  restaurants.value.length > 0
    ? restaurants.value.filter((r) => inOtherCurrency(r, companyCurrency.value)).length
    : null
);

const inPhoneDetail = computed(
  () => !wide.value && view.tab.value === "restaurants" && Boolean(view.selected.value)
);

const headerTitle = computed(() => {
  if (inPhoneDetail.value && view.selected.value) {
    return toLatin(view.selected.value.restaurant_name) || `Restoran #${view.selected.value.restaurant_id}`;
  }
  return toLatin(selectedCompany.value?.name) || "Firma";
});

const headerSub = computed(() => {
  if (inPhoneDetail.value && view.selected.value) return `Restoran #${view.selected.value.restaurant_id}`;
  if (!selectedCompany.value) return "";
  return [toLatin(selectedCompany.value.cityName), `valuta ${companyCurrency.value}`]
    .filter(Boolean)
    .join(" · ");
});

const tabs = computed<GlobalTabBarItem<CompanyTab>[]>(() => [
  { value: "settings", label: "Postavke" },
  {
    value: "restaurants",
    label: "Restorani",
    badge: restaurants.value.length > 0 ? restaurants.value.length : undefined,
  },
]);

// Promjena taba dok editor ima nesačuvan unos prvo pita.
const onTab = (next: CompanyTab) => {
  if (next === view.tab.value) return;
  const go = () => view.setTab(next);
  if (settingsPane.value) settingsPane.value.guard(go);
  else go();
};

// Dugme Nazad (i odlazak sa stranice) dok editor ima nesačuvan unos: pita, ne gubi ga.
onBeforeRouteLeave(() => {
  if (interceptLeaving()) return false;
});
</script>

<style scoped>
.co {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.co > * {
  min-width: 0;
}
</style>
