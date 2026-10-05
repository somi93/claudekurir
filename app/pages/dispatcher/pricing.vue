<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader title="Cenovnik" back-to="/" back-label="Nazad na početnu" />
    </template>

    <PageAlert v-if="errorMessage" closable class="mb-4" @close="clearError">
      {{ errorMessage }}
    </PageAlert>

    <GlobalTabBar v-model="activeTab" :tabs="pricingTabs" class="mb-4" />

    <v-window v-model="activeTab">
      <!-- TAB 1: Osnovna cena po firmi -->
      <v-window-item value="base">
        <v-row>
          <v-col cols="12" md="7">
            <PricingForm
              v-model:pricing="pricing"
              :saving-pricing="savingPricing"
              :pricing-saved="pricingSaved"
              :loading="loadingPricing"
              @save="savePricing"
            />
          </v-col>
          <v-col cols="12" md="5">
            <PricingCalculator :pricing="pricing" :active-surcharges="activeSurcharges" />
          </v-col>
        </v-row>
      </v-window-item>

      <!-- TAB 2: Dodatni parametri (surcharges) -->
      <v-window-item value="surcharges">
        <SurchargesPanel
          v-if="openedTabs.has('surcharges')"
          v-model:new-surcharge="newSurcharge"
          v-model:show-add-surcharge="showAddSurcharge"
          :surcharges="surcharges"
          :condition-tags="conditionTags"
          :local-presets="localPresets"
          :saving-surcharge="savingSurcharge"
          :loading="loadingSurcharges"
          :currency="companyCurrency"
          @select-tag="selectConditionTag"
          @select-preset="selectPreset"
          @select-custom="selectCustomParameter"
          @add-surcharge="addSurcharge"
          @toggle="toggleSurcharge"
          @remove="onRemoveSurcharge"
        />
      </v-window-item>

      <!-- TAB 3: Vozila i pravila -->
      <v-window-item value="vehicles">
        <v-row v-if="openedTabs.has('vehicles')">
          <v-col cols="12" md="7">
            <VehicleRulesPanel
              v-model:new-rule="newRule"
              v-model:show-add-rule="showAddRule"
              :vehicle-rules="vehicleRules"
              :saving-rule="savingRule"
              :loading="loadingVehicleRules"
              :zones="zones"
              :surcharges="surcharges"
              :matched-rule-id="vehicleRecommendation?.matchedRule?.id ?? null"
              :editing-rule-id="editingRuleId"
              :is-distance-range-valid="isDistanceRangeValid"
              @save-rule="saveVehicleRule"
              @new-rule="startNewRule"
              @edit-rule="startEditRule"
              @cancel="closeRuleForm"
              @remove-rule="onRemoveRule"
              @move-rule="moveRule"
            />
          </v-col>
          <v-col cols="12" md="5">
            <VehicleSimulationPanel
              v-model:zone-id="simulationZoneId"
              v-model:distance-km="simulationDistanceKm"
              :zones="zones"
              :loading="loadingRecommendation"
              :recommendation="vehicleRecommendation"
              :currency="companyCurrency"
            />
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Cenovnik" });

import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useDeliveryPricing } from "~/composables/useDeliveryPricing";
import { useSurcharges } from "~/composables/useSurcharges";
import { useVehicleRules } from "~/composables/useVehicleRules";
import { useVehicleRecommendation } from "~/composables/useVehicleRecommendation";
import { useDispatcherZones } from "~/composables/useDispatcherZones";
import { useConfirmStore } from "~/stores/confirm";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import { resolveCurrency } from "~/utils/currency";
import PricingForm from "~/components/pricing/PricingForm.vue";
import PricingCalculator from "~/components/pricing/PricingCalculator.vue";
import SurchargesPanel from "~/components/pricing/SurchargesPanel.vue";
import VehicleRulesPanel from "~/components/pricing/VehicleRulesPanel.vue";
import VehicleSimulationPanel from "~/components/pricing/VehicleSimulationPanel.vue";

type PricingTab = "base" | "surcharges" | "vehicles";

const activeTab = ref<PricingTab>("base");

// Lazy tabovi: panel + njegovi pozivi (vehicle-rules, recommend-vehicle, zone)
// idu tek kad dispečer prvi put otvori "Vozila i pravila". Set pamti otvarane
// tabove pa povratak ne refetch-uje.
const openedTabs = ref(new Set<PricingTab>([activeTab.value]));
watch(activeTab, (tab) => openedTabs.value.add(tab));
const vehiclesOpen = computed(() => openedTabs.value.has("vehicles"));

const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId, errorMessage: companiesError } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();

const companyId = computed(() => selectedCompanyId.value);

const {
  pricing,
  loadingPricing,
  savingPricing,
  pricingSaved,
  errorMessage: pricingError,
  savePricing,
} = useDeliveryPricing(companyId);

// Valuta firme za prikaz jedinica/fallback-a na ovom ekranu. `pricing.currency`
// (delivery-pricing endpoint) je isti pojam kao finance-settings currency
// (odgovor 1.1) - koristimo već učitani pricing, bez dodatnog poziva.
const companyCurrency = computed(() => resolveCurrency(pricing.value?.currency));

const {
  surcharges,
  loadingSurcharges,
  activeSurcharges,
  errorMessage: surchargesError,
  toggleSurcharge,
  newSurcharge,
  showAddSurcharge,
  savingSurcharge,
  addSurcharge,
  removeSurcharge,
  conditionTags,
  localPresets,
  selectConditionTag,
  selectPreset,
  selectCustomParameter,
} = useSurcharges(companyId);

const pricingTabs = computed<GlobalTabBarItem<PricingTab>[]>(() => [
  { value: "base", label: "Cena dostave", icon: "mdi-cash-multiple" },
  {
    value: "surcharges",
    label: "Dodatni parametri",
    icon: "mdi-tune-variant",
    badge: activeSurcharges.value.length,
  },
  { value: "vehicles", label: "Vozila i pravila", icon: "mdi-moped-outline" },
]);

const {
  vehicleRules,
  loadingVehicleRules,
  errorMessage: vehicleRulesError,
  newRule,
  showAddRule,
  editingRuleId,
  savingRule,
  isDistanceRangeValid,
  saveVehicleRule,
  startNewRule,
  startEditRule,
  closeRuleForm,
  removeVehicleRule,
  moveRule,
} = useVehicleRules(companyId, { enabled: vehiclesOpen });

const {
  zoneId: simulationZoneId,
  distanceKm: simulationDistanceKm,
  recommendation: vehicleRecommendation,
  loading: loadingRecommendation,
  errorMessage: recommendationError,
} = useVehicleRecommendation(companyId, { enabled: vehiclesOpen });

// Zone treba samo tab "Vozila i pravila" (birač zone u pravilu + simulacija) -
// učitaj ih tek kad se taj tab prvi put otvori.
const { zones, load: loadZones } = useDispatcherZones();
watch(
  vehiclesOpen,
  (open) => {
    if (open) loadZones();
  },
  { immediate: true }
);

const confirmStore = useConfirmStore();

const onRemoveSurcharge = async (id: number) => {
  const surcharge = surcharges.value.find((s) => s.id === id);
  try {
    await confirmStore.confirm(
      "Obriši naknadu",
      `Obrisati naknadu "${surcharge?.name ?? ""}"?`,
      { color: "error" }
    );
    removeSurcharge(id);
  } catch {
    // Otkazano
  }
};

const onRemoveRule = async (id: number) => {
  const rule = vehicleRules.value.find((r) => r.id === id);
  try {
    await confirmStore.confirm(
      "Obriši pravilo",
      `Obrisati pravilo "${rule?.condition_text ?? ""}"?`,
      { color: "error" }
    );
    removeVehicleRule(id);
  } catch {
    // Otkazano
  }
};

const errorMessage = computed(
  () =>
    companiesError.value ||
    pricingError.value ||
    surchargesError.value ||
    vehicleRulesError.value ||
    recommendationError.value
);
const clearError = () => {
  companiesError.value = "";
  pricingError.value = "";
  surchargesError.value = "";
  vehicleRulesError.value = "";
  recommendationError.value = "";
};
</script>
