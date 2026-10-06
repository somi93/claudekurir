<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader title="Raspored i zone" back-to="/" back-label="Nazad na početnu">
        <template v-if="selectedCompany" #subtitle>
          {{ selectedCompany.name }}<template v-if="cityName"> · {{ cityName }}</template>
        </template>
      </PageHeader>
    </template>

    <PageAlert v-if="companiesError" closable class="mb-4">
      {{ companiesError }}
    </PageAlert>

    <div class="sp">
      <TintAlert v-if="selectedCompany && selectedCompany.cityId === null" tone="warn" role="status" title="Firma nema grad">
        Zone i smjene čekaju dok se grad ne postavi.
        <template #action>
          <button type="button" data-field="city-top" @click="cityOpen = true">Postavi grad</button>
        </template>
      </TintAlert>

      <GlobalTabBar
        :model-value="view.tab.value"
        :tabs="tabs"
        variant="pills"
        label="Sekcije rasporeda"
        id-base="sched"
        panel-id="sched-panel"
        @update:model-value="view.setTab"
      />

      <div id="sched-panel" class="sp-panel" role="tabpanel" :aria-labelledby="`sched-tab-${view.tab.value}`">
        <div v-show="view.tab.value === 'schedule'">
          <ScheduleTab
            ref="schedule"
            :data="data"
            :view="view"
            :zones="geoZones"
            :zones-state="zonesState"
            :zones-reason="zonesApi.loadReason.value"
            :now="clock"
            :wide="wide"
            :company-id="companyId"
            @go-zones="view.setTab('zones')"
            @retry-zones="retryZones"
          />
        </div>

        <div v-if="opened.has('now')" v-show="view.tab.value === 'now'">
          <NowTab
            :zones="geoZones"
            :shifts="data.todayShifts.value"
            :shifts-state="todayState"
            :now="clock"
            :live="live"
            @ask="schedule?.openAsk($event)"
            @open="openFromNow"
            @retry-shifts="retryToday"
          />
        </div>

        <div v-if="opened.has('zones')" v-show="view.tab.value === 'zones'">
          <ZonesTab
            :zones="geoZones"
            :state="zonesState"
            :error-reason="zonesApi.loadReason.value"
            :city="cityName"
            :city-id="selectedCompany?.cityId ?? null"
            :company-id="companyId"
            :saving="zonesApi.saving.value"
            :now="clock"
            :shifts="data.shifts.value"
            :range="data.range.value"
            :wide="wide"
            :active="view.tab.value === 'zones'"
            :save="saveZone"
            :remove="zonesApi.remove"
            @retry="retryZones"
          />
        </div>

        <div v-if="opened.has('rules')" v-show="view.tab.value === 'rules'">
          <RulesTab
            :enforcement="enforcement"
            :zones="geoZones"
            :shifts="data.todayShifts.value"
            :shifts-state="todayState"
            :now="clock"
            :has-city="!!selectedCompany && selectedCompany.cityId !== null"
            :city="cityName"
            @open-city="cityOpen = true"
          />
        </div>
      </div>
    </div>

    <CitySheet
      :open="cityOpen"
      :company-name="selectedCompany?.name ?? ''"
      :saving="savingCity"
      @update:open="cityOpen = $event"
      @save="saveCity"
    />
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Raspored i zone" });

import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import CitySheet from "~/components/dispatcher/scheduling/CitySheet.vue";
import NowTab from "~/components/dispatcher/scheduling/NowTab.vue";
import RulesTab from "~/components/dispatcher/scheduling/RulesTab.vue";
import ScheduleTab from "~/components/dispatcher/scheduling/ScheduleTab.vue";
import ZonesTab from "~/components/dispatcher/scheduling/ZonesTab.vue";
import { useAvailabilityEnforcement } from "~/composables/useAvailabilityEnforcement";
import { useClock } from "~/composables/useClock";
import { useDispatcherZones } from "~/composables/useDispatcherZones";
import { useLiveNow } from "~/composables/useLiveNow";
import { useScheduleData } from "~/composables/useScheduleData";
import { useScheduleView, type ScheduleTabKey } from "~/composables/useScheduleView";
import { useWide } from "~/composables/useWide";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { problemList, weekModel } from "~/utils/schedule";
import { toGeoZone } from "~/utils/zoneGeo";
import { toLatin } from "~/utils/toLatin";
import type { DispatcherZonePayload } from "~/types/dispatcherZone";

// Raspored i zone: četiri taba nad jednim zajedničkim stanjem - Raspored (smjene po sedmici), Sada (plan i teren),
// Zone (spisak uz kartu) i Pravila (provjera dostupnosti, grad firme). Tab, sedmica, filteri i dan žive u adresi.
// Zone su samo one grada firme; smjene se učitavaju u prozoru od 5 sedmica jednim pozivom.
const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId, selectedCompany, savingCity, errorMessage: companiesError } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();
const companyId = computed(() => selectedCompanyId.value);
const cityName = computed(() => toLatin(selectedCompany.value?.cityName) || "");

const { clock } = useClock();
const wide = useWide();
const view = useScheduleView(() => clock.value.date);

// --- zone grada firme ---
const zonesApi = useDispatcherZones();
const mounted = ref(false);
const cityId = computed(() => selectedCompany.value?.cityId ?? null);

const loadZones = () => {
  if (!mounted.value || !selectedCompany.value) return;
  if (cityId.value == null) zonesApi.clear();
  else void zonesApi.load(cityId.value, { silent: true });
};
onMounted(() => {
  mounted.value = true;
  loadZones();
});
watch([companyId, cityId], loadZones);

const zonesState = computed<"loading" | "error" | "nocity" | "ok">(() => {
  if (!selectedCompany.value) return "loading";
  if (cityId.value == null) return "nocity";
  if (zonesApi.loadFailed.value) return "error";
  return zonesApi.loading.value ? "loading" : "ok";
});
const geoZones = computed(() => zonesApi.zones.value.map(toGeoZone));
const retryZones = () => void zonesApi.reload();

// --- smjene, uživo, provjera dostupnosti ---
const data = useScheduleData(companyId, view.weekMon, clock);

const todayState = computed<"loading" | "error" | "ok">(() =>
  zonesState.value === "loading" || data.todayState.value === "loading"
    ? "loading"
    : zonesState.value === "error" || data.todayState.value === "error"
      ? "error"
      : "ok"
);
const retryToday = () => {
  if (zonesState.value === "error") retryZones();
  data.retry();
};

const opened = ref(new Set<ScheduleTabKey>([view.tab.value]));
watch(view.tab, (t) => {
  opened.value = new Set([...opened.value, t]);
});

const live = useLiveNow(
  companyId,
  computed(() => view.tab.value === "now"),
  { extra: data.refreshQuiet }
);
const enforcement = useAvailabilityEnforcement(companyId, {
  enabled: computed(() => opened.value.has("rules")),
});

// --- tabovi ---
const problemCount = computed(() => {
  if (data.state.value !== "ok") return 0;
  return problemList(
    weekModel({ shifts: data.shifts.value, zones: geoZones.value, dates: view.dates.value, now: clock.value })
  ).length;
});

const tabs = computed<GlobalTabBarItem<ScheduleTabKey>[]>(() => [
  {
    value: "schedule",
    label: "Raspored",
    badge: problemCount.value > 0 ? problemCount.value : undefined,
    badgeColor: "#b42318",
    badgeSr: problemCount.value > 0 ? `${problemCount.value} smjena ispod minimuma` : undefined,
  },
  { value: "now", label: "Sada" },
  { value: "zones", label: "Zone", badge: zonesState.value === "ok" ? geoZones.value.length : undefined },
  { value: "rules", label: "Pravila" },
]);

const schedule = ref<InstanceType<typeof ScheduleTab> | null>(null);

// "Otvori smjenu" iz kartice zone: list se otvara preko taba "Sada" ako je smjena u učitanom prozoru, inače se
// prikaz rasporeda pomjera na taj dan (smjena iz drugog prozora se ne može mijenjati odavde).
const openFromNow = (id: number) => {
  if (data.shifts.value.some((s) => s.id === id)) {
    schedule.value?.openShift(id);
    return;
  }
  const s = data.todayShifts.value.find((x) => x.id === id);
  if (s) view.goTo(s.date, !wide.value);
  view.setTab("schedule");
};

const saveZone = (id: number | null, payload: DispatcherZonePayload) =>
  id == null ? zonesApi.create(payload) : zonesApi.update(id, payload);

// --- grad firme ---
const cityOpen = ref(false);
const saveCity = async (id: number) => {
  if (await companiesStore.setCompanyCity(id)) cityOpen.value = false;
};
</script>

<style scoped>
.sp {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.sp-panel {
  min-width: 0;
}
</style>
