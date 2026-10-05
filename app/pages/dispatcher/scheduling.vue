<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader title="Raspored i zone" back-to="/" back-label="Nazad na početnu" />
    </template>

    <PageAlert v-if="companiesError" closable class="mb-4">
      {{ companiesError }}
    </PageAlert>

    <CompanyCitySetupCard
      v-if="selectedCompany && selectedCompany.cityId === null"
      :saving="savingCity"
      @save="onSaveCompanyCity"
    />

    <GlobalTabBar v-model="activeTab" :tabs="schedulingTabs" class="mb-4" />

    <v-window v-model="activeTab">
      <!-- TAB: Zone -->
      <v-window-item value="zones">
        <ZonesTab
          v-if="openedTabs.has('zones')"
          :zones="zones"
          :loading="zonesLoading"
          :saving="zonesSaving"
          :city-options="cityOptions"
          :default-city-id="selectedCompany?.cityId ?? null"
          :create="createZone"
          :update="updateZone"
          :remove="removeZone"
          @filter="loadZones"
        />
      </v-window-item>

      <!-- TAB: Smjene -->
      <v-window-item value="shifts">
        <ShiftsTab
          v-if="openedTabs.has('shifts')"
          :company-id="companyId"
          :zones="zones"
        />
      </v-window-item>

      <!-- TAB: Uživo -->
      <v-window-item value="live">
        <LiveCoverageBoard
          v-if="openedTabs.has('live')"
          :coverage="coverage"
          :loading="coverageLoading"
          @refresh="loadCoverage"
        />
      </v-window-item>

      <!-- TAB: Podešavanja -->
      <v-window-item value="settings">
        <EnforcementPanel
          v-if="openedTabs.has('settings')"
          :enabled="enforcementEnabled"
          :loading="enforcementLoading"
          :saving="enforcementSaving"
          @toggle="onToggleEnforcement"
        />
      </v-window-item>
    </v-window>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Raspored i zone" });

import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import CompanyCitySetupCard from "~/components/dispatcher/scheduling/CompanyCitySetupCard.vue";
import ZonesTab from "~/components/dispatcher/scheduling/ZonesTab.vue";
import ShiftsTab from "~/components/dispatcher/scheduling/ShiftsTab.vue";
import LiveCoverageBoard from "~/components/dispatcher/scheduling/LiveCoverageBoard.vue";
import EnforcementPanel from "~/components/dispatcher/scheduling/EnforcementPanel.vue";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useDispatcherZones } from "~/composables/useDispatcherZones";
import { useLiveCoverage } from "~/composables/useLiveCoverage";
import { useAvailabilityEnforcement } from "~/composables/useAvailabilityEnforcement";

const companiesStore = useDeliveryCompaniesStore();
const { companies, selectedCompanyId, selectedCompany, savingCity, errorMessage: companiesError } =
  storeToRefs(companiesStore);
companiesStore.ensureLoaded();
const companyId = computed(() => selectedCompanyId.value);

const onSaveCompanyCity = async (cityId: number) => {
  await companiesStore.setCompanyCity(cityId);
};

// Nema posebne "lista gradova" rute - izvodimo je iz gradova firmi za koje je
// dispečer vezan (svaka sad nosi city_id/city_name, vidi Changelog_13_avgust).
const cityOptions = computed(() => {
  const seen = new Map<number, string>();
  for (const company of companies.value) {
    if (company.cityId !== null && !seen.has(company.cityId)) {
      seen.set(company.cityId, toLatin(company.cityName) || `Grad #${company.cityId}`);
    }
  }
  return Array.from(seen, ([value, title]) => ({ value, title }));
});

type SchedulingTab = "zones" | "shifts" | "live" | "settings";

const schedulingTabs: GlobalTabBarItem<SchedulingTab>[] = [
  { value: "zones", label: "Zone", icon: "mdi-map-marker-radius-outline" },
  { value: "shifts", label: "Smjene", icon: "mdi-calendar-clock-outline" },
  { value: "live", label: "Uživo", icon: "mdi-radar" },
  { value: "settings", label: "Podešavanja", icon: "mdi-toggle-switch-outline" },
];

const activeTab = ref<SchedulingTab>("zones");

// Lazy tabovi: panel + njegovi pozivi idu tek kad se tab prvi put otvori. Set
// pamti otvarane tabove pa povratak na već viđen tab ne remount-uje/refetch-uje.
const openedTabs = ref(new Set<SchedulingTab>([activeTab.value]));
watch(activeTab, (tab) => openedTabs.value.add(tab));
const settingsOpen = computed(() => openedTabs.value.has("settings"));

const {
  zones,
  loading: zonesLoading,
  saving: zonesSaving,
  load: loadZones,
  create: createZone,
  update: updateZone,
  remove: removeZone,
} = useDispatcherZones();

// --- Uživo ---
const { coverage, loading: coverageLoading, load: loadCoverage } = useLiveCoverage(companyId);

// --- Podešavanja ---
const {
  enabled: enforcementEnabled,
  loading: enforcementLoading,
  saving: enforcementSaving,
  setEnabled,
} = useAvailabilityEnforcement(companyId, { enabled: settingsOpen });

const onToggleEnforcement = (value: boolean) => setEnabled(value);

onMounted(loadZones);

// Prekidač za promenu firme brine useAvailabilityEnforcement sam (učitava
// stvarno stanje sa GET-a) - ovde ostaje samo pokrivenost uživo.
watch(companyId, () => {
  if (activeTab.value === "live") loadCoverage();
});
watch(activeTab, (tab) => {
  if (tab === "live") loadCoverage();
});
</script>
