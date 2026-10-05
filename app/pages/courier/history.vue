<template>
  <DeliveryPage :max-width="760">
    <template #header>
      <PageHeader title="Istorija dostava" back-to="/" back-label="Nazad na početnu">
        <template #subtitle>{{ subtitle }}</template>

        <template #actions>
          <button
            type="button"
            class="refresh-btn"
            :class="{ 'refresh-btn--spin': refreshing }"
            aria-label="Osvježi"
            @click="refresh"
          >
            <v-icon icon="mdi-refresh" size="20" />
          </button>
        </template>

        <template v-if="showPeriods" #below>
          <GlobalFilterBar role="tablist" aria-label="Period">
            <GlobalFilterPill
              v-for="option in HISTORY_PERIODS"
              :key="option.value"
              :label="option.label"
              :chevron="false"
              :active="period === option.value"
              :disabled="state === 'loading'"
              role="tab"
              :aria-selected="period === option.value"
              @click="setPeriod(option.value)"
            />
          </GlobalFilterBar>
        </template>
      </PageHeader>
    </template>

    <div class="hist-body">
      <HistorySkeleton v-if="state === 'loading'" />

      <InboxEmptyState
        v-else-if="state === 'error'"
        tone="error"
        icon="mdi-alert-circle-outline"
        title="Ne mogu da učitam istoriju"
      >
        Provjeri vezu i pokušaj ponovo. Tvoje dostave nisu izgubljene.
        <template #action>
          <GlobalButtonPrimary @click="retry">
            <v-icon icon="mdi-refresh" size="18" class="mr-1" />
            Pokušaj ponovo
          </GlobalButtonPrimary>
        </template>
      </InboxEmptyState>

      <InboxEmptyState
        v-else-if="state === 'empty'"
        icon="mdi-moped-outline"
        title="Još nema dostava"
      >
        Kad završiš prvu dostavu, pojaviće se ovdje, sa satom i zaradom.
        <template #action>
          <GlobalButtonPrimary to="/courier/deliveries">Idi na dostave</GlobalButtonPrimary>
        </template>
      </InboxEmptyState>

      <template v-else>
        <HistoryAlert
          v-if="historyAlert"
          title="Nazive restorana i adrese trenutno ne mogu da učitam."
          @retry="retry"
        >
          Dostave su ispod, sa zaradom. Detalji se pojave čim istorija stigne.
        </HistoryAlert>
        <HistoryAlert
          v-if="earningsAlert"
          title="Zaradu trenutno ne mogu da učitam."
          @retry="retry"
        >
          Dostave su ispod. Iznosi se pojave čim zarada stigne.
        </HistoryAlert>

        <template v-if="inPeriod.length > 0">
          <HistorySummary
            :summary="summary"
            :mode="mode"
            :pending="summaryPending"
            :range="range"
            :trend="trend"
            :cells="cells"
            :note="note"
            :km="km"
          >
            <HistoryChart
              v-if="chartVisible"
              :buckets="buckets"
              :period="period"
              :metric="metric"
              :selected-key="activeBucket?.key ?? null"
              @select="selectBucket"
            />
          </HistorySummary>

          <HistoryFilters
            v-model="text"
            :sort="sort"
            :sort-options="sortOptions"
            :bucket-label="activeBucket?.long ?? null"
            :result="filterResult"
            @update:sort="setSort"
            @clear-bucket="clearBucket"
          />

          <HistoryList
            v-if="rows.length > 0"
            :groups="list.groups"
            :flat-rows="list.flatRows"
            :rest-groups="list.restGroups"
            :rest-rows="list.restRows"
            :total="rows.length"
            :now="now"
            :show-money="mode === 'wage'"
            :is-pending="pendingMoney"
            @open="openSheet"
            @more="showMore"
          />
          <InboxEmptyState
            v-else
            icon="mdi-magnify"
            :title="searchText ? `Nema rezultata za „${searchText}“` : 'Nema dostava'"
          >
            Traži po nazivu restorana, ulici ili broju narudžbe. Dijakritici nisu bitni.
            <template #action>
              <v-btn variant="tonal" color="secondary" @click="clearFilters">
                {{ searchText ? "Očisti pretragu" : "Prikaži sve dane" }}
              </v-btn>
            </template>
          </InboxEmptyState>

          <p class="hist-foot">
            <template v-if="mode === 'wage'">Iznosi su tvoja zarada po dostavi. </template>
            Naplaćenu gotovinu i dug prema firmi vidiš u
            <NuxtLink to="/courier/wallet">Novčaniku</NuxtLink>.
          </p>
        </template>

        <InboxEmptyState v-else icon="mdi-calendar-blank-outline" :title="emptyPeriodTitle">
          {{
            widerNext
              ? "Ranije dostave su u istoriji. Proširi period da ih vidiš."
              : "Kad završiš dostavu, pojaviće se ovdje."
          }}
          <template v-if="widerNext" #action>
            <v-btn variant="tonal" color="secondary" @click="widen">Prikaži {{ widerNext }}</v-btn>
          </template>
        </InboxEmptyState>
      </template>
    </div>

    <DeliveryDetailSheet
      :open="openDelivery != null"
      :delivery="openDelivery ?? lastDelivery"
      :nav="sheetNav"
      wallet-hint
      retryable
      @update:open="onSheetOpen"
      @newer="goTo(newer)"
      @older="goTo(older)"
      @retry="retry"
    />
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Istorija dostava" });

import { computed, ref, watch } from "vue";
import { useRoute } from "nuxt/app";
import { useSessionStore } from "~/stores/session";
import { useCourierDeliveries } from "~/composables/useCourierDeliveries";
import { useHistoryView } from "~/composables/useHistoryView";
import PageHeader from "~/components/common/PageHeader.vue";
import GlobalFilterBar from "~/components/common/GlobalFilterBar.vue";
import GlobalFilterPill from "~/components/common/GlobalFilterPill.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import InboxEmptyState from "~/components/inbox/InboxEmptyState.vue";
import DeliveryDetailSheet from "~/components/courier/DeliveryDetailSheet.vue";
import HistoryAlert from "~/components/courier/history/HistoryAlert.vue";
import HistoryChart from "~/components/courier/history/HistoryChart.vue";
import HistoryFilters from "~/components/courier/history/HistoryFilters.vue";
import HistoryList from "~/components/courier/history/HistoryList.vue";
import HistorySkeleton from "~/components/courier/history/HistorySkeleton.vue";
import HistorySummary from "~/components/courier/history/HistorySummary.vue";
import type { CourierDelivery } from "~/types/courier-delivery";
import { HISTORY_PERIODS, periodFromQuery } from "~/utils/historyGroups";

// Istorija dostava: sažetak zarade sa trendom i grafikonom, lista po danima, pretraga
// i detalj dostave. Podaci (istorija + zarada spojene po broju narudžbe) žive u
// stores/deliveries.ts i dijele se sa Novčanikom; ovdje je samo prikaz, a stanje
// (period, stubić, pretraga, sortiranje, otvorena dostava) je u adresi.
const route = useRoute();
const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

// Zarada za period "Sve" traži širi opseg od onog koji deli Novčanik.
const earningsScope = computed(() => (periodFromQuery(route.query.p) === "all" ? "all" : "recent"));
const source = useCourierDeliveries(courierId, earningsScope);
const { historyLoading, earningsLoading } = source;

const {
  now,
  state,
  period,
  sort,
  sortOptions,
  text,
  inPeriod,
  summary,
  mode,
  summaryPending,
  pendingMoney,
  buckets,
  metric,
  chartVisible,
  activeBucket,
  widerTarget,
  rows,
  filtering,
  filteredWage,
  list,
  showMore,
  trend,
  cells,
  range,
  km,
  note,
  earningsAlert,
  historyAlert,
  subtitle,
  setPeriod,
  widen,
  setSort,
  selectBucket,
  clearBucket,
  clearFilters,
  openDelivery,
  sequence,
  sequenceIndex,
  newer,
  older,
  openSheet,
  goToDelivery,
  closeSheet,
  refresh,
  retry,
} = useHistoryView(source);

const refreshing = computed(() => historyLoading.value || earningsLoading.value);

// Periodi se biraju i kad je lista prazna (kurir može da proširi period); samo kad
// nema ničega - greška ili prva dostava - nema šta da se bira.
const showPeriods = computed(() => state.value !== "error" && state.value !== "empty");

// --- Filteri -------------------------------------------------------------------

const searchText = computed(() => text.value.trim());

// "3 dostave · +6.00 KM" kad je lista sužena pretragom ili stubićem.
const filterResult = computed(() =>
  filtering.value && rows.value.length > 0
    ? { count: rows.value.length, wage: filteredWage.value }
    : null
);

// --- Prazan period -------------------------------------------------------------

const emptyPeriodTitle = computed(
  () =>
    ({
      today: "Danas još nema dostava",
      week: "Ove sedmice nema dostava",
      month: "U zadnjih 30 dana nema dostava",
      all: "Nema dostava",
    })[period.value]
);

// Ponuda "Prikaži ...": samo kad u nekom širem periodu zaista ima dostava.
const TARGET_LABEL = { today: "", week: "sedmicu", month: "30 dana", all: "sve" } as const;
const widerNext = computed(() => (widerTarget.value ? TARGET_LABEL[widerTarget.value] : ""));

// --- Detalj dostave ------------------------------------------------------------

// Zadnja otvorena dostava ostaje u listu dok se zatvara (animacija), da sadržaj ne
// nestane prije nego što list sklizne.
const lastDelivery = ref<CourierDelivery | null>(null);
watch(
  openDelivery,
  (delivery) => {
    if (delivery) lastDelivery.value = delivery;
  },
  { immediate: true }
);

const sheetNav = computed(() => {
  if (!openDelivery.value || sequenceIndex.value < 0) return null;
  const labels: [string, string] =
    // Po zaradi nema "novije / starije", nego prethodna / sljedeća u listi.
    sort.value === "top" ? ["Prethodna", "Sljedeća"] : ["Novija", "Starija"];
  return {
    position: sequenceIndex.value + 1,
    total: sequence.value.length,
    hasNewer: newer.value != null,
    hasOlder: older.value != null,
    labels,
  };
});

const onSheetOpen = (open: boolean) => {
  if (!open) closeSheet();
};
const goTo = (delivery: CourierDelivery | null) => {
  if (delivery) goToDelivery(delivery.id);
};
</script>

<style scoped>
.hist-body {
  display: grid;
  gap: 12px;
  align-content: start;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.06);
}

.refresh-btn:active {
  background: #eceff3;
}

.refresh-btn:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}

.refresh-btn--spin :deep(.v-icon) {
  animation: hist-spin 0.8s linear infinite;
}

@keyframes hist-spin {
  to {
    transform: rotate(360deg);
  }
}

.hist-foot {
  margin: 2px 4px 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #657083;
}

.hist-foot a {
  color: #2459c7;
  font-weight: 700;
  text-decoration: none;
}

@media (prefers-reduced-motion: reduce) {
  .refresh-btn--spin :deep(.v-icon) {
    animation: none;
  }
}
</style>
