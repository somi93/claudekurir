<template>
  <GlobalCard padding="20px">
    <div class="board-head d-flex justify-space-between align-center flex-wrap ga-3">
      <div class="d-flex align-center ga-2 flex-wrap">
        <span class="updated-label" :class="{ 'updated-label--stale': pausedTooLong }">
          {{ updatedLabel }}
        </span>
        <v-btn variant="tonal" size="small" @click="emit('toggle-pause')">
          <v-icon start :icon="paused ? 'mdi-play' : 'mdi-pause'" />
          {{ paused ? "Nastavi" : "Pauziraj" }}
        </v-btn>
        <v-btn variant="text" size="small" :loading="loading" @click="emit('refresh')">
          <v-icon start icon="mdi-refresh" />
          Osveži
        </v-btn>
      </div>
    </div>

    <PageAlert v-if="errorMessage" class="mt-4">{{ errorMessage }}</PageAlert>
    <PageAlert
      v-if="boardActionMessage"
      type="info"
      class="mt-4"
      closable
      @close="emit('dismiss-board-action-message')"
    >
      {{ boardActionMessage }}
    </PageAlert>

    <GlobalTabBarSlide v-model="activeTab" :tabs="boardTabs" class="mt-3" />

    <div v-if="!loading && hasAnyOrders" class="list-toolbar mt-3">
      <GlobalTextField
        v-model="searchQuery"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        placeholder="Pretraži po restoranu ili #ID-u..."
        prepend-inner-icon="mdi-magnify"
        class="board-search"
      />
      <GlobalSelect
        v-if="activeTab !== 'restaurant'"
        v-model="urgencyFilter"
        :items="urgencyFilterOptions"
        item-title="label"
        item-value="value"
        density="compact"
        variant="solo"
        flat
        hide-details
        class="status-select"
      />
      <GlobalSelect
        v-if="activeTab === 'waiting'"
        v-model="statusFilter"
        :items="statusFilterOptions"
        item-title="label"
        item-value="value"
        density="compact"
        variant="solo"
        flat
        hide-details
        class="status-select"
      />
    </div>

    <div v-if="loading" class="orders-list mt-3">
      <v-skeleton-loader
        v-for="n in 5"
        :key="n"
        type="list-item-two-line"
        class="order-skeleton"
      />
    </div>

    <v-window v-else v-model="activeTab" class="mt-3">
      <v-window-item value="restaurant">
        <BoardRestaurantTab
          :orders="pendingRestaurantOrders"
          :search="searchQuery"
          :resolving-id="resolvingOrderId"
          :has-error="!!errorMessage"
          @resolve="emit('resolve-restaurant', $event)"
        />
      </v-window-item>

      <v-window-item value="waiting">
        <BoardWaitingTab
          :orders="waitingOrders"
          :search="searchQuery"
          :urgency="urgencyFilter"
          :status="statusFilter"
          :direct-assigning-id="directAssigningOrderId"
          :has-error="!!errorMessage"
          @select="emit('select', $event)"
          @direct-assign="emit('direct-assign', $event)"
        />
      </v-window-item>

      <v-window-item value="booked">
        <BoardDeliveryTab
          :deliveries="bookedDeliveries"
          :search="searchQuery"
          :urgency="urgencyFilter"
          :has-error="!!errorMessage"
          empty-icon="mdi-timer-sand"
          empty-text="Nema narudžbi koje čekaju preuzimanje."
        />
      </v-window-item>

      <v-window-item value="picked_up">
        <BoardDeliveryTab
          :deliveries="pickedUpDeliveries"
          :search="searchQuery"
          :urgency="urgencyFilter"
          :has-error="!!errorMessage"
          empty-icon="mdi-moped-outline"
          empty-text="Nema narudžbi u dostavi."
        />
      </v-window-item>

      <v-window-item value="refused">
        <BoardRefusedTab
          :orders="refusedOrders"
          :search="searchQuery"
          :has-error="!!errorMessage"
        />
      </v-window-item>
    </v-window>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalTabBarSlide from "~/components/common/GlobalTabBarSlide.vue";
import type { GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import BoardRestaurantTab from "./board/BoardRestaurantTab.vue";
import BoardWaitingTab from "./board/BoardWaitingTab.vue";
import BoardDeliveryTab from "./board/BoardDeliveryTab.vue";
import BoardRefusedTab from "./board/BoardRefusedTab.vue";
import { formatRelativeTime } from "~/utils/datetime";
import { isActionableRestaurantWait } from "~/utils/dispatchBoard";
import type { WaitingOrder } from "~/models/WaitingOrder";
import type { ActiveDelivery } from "~/models/ActiveDelivery";
import type { RefusedOrder } from "~/models/RefusedOrder";
import type { PendingRestaurantOrder } from "~/models/PendingRestaurantOrder";

const props = defineProps<{
  waitingOrders: WaitingOrder[];
  bookedDeliveries: ActiveDelivery[];
  pickedUpDeliveries: ActiveDelivery[];
  refusedOrders: RefusedOrder[];
  pendingRestaurantOrders: PendingRestaurantOrder[];
  loading: boolean;
  errorMessage: string;
  lastUpdatedAt: string | null;
  paused: boolean;
  directAssigningOrderId: number | null;
  resolvingOrderId: number | null;
  boardActionMessage: string;
}>();

const emit = defineEmits<{
  select: [orderId: number];
  refresh: [];
  "toggle-pause": [];
  "direct-assign": [orderId: number];
  "resolve-restaurant": [
    payload: { orderId: number; action: "accept" | "reject"; note?: string },
  ];
  "dismiss-board-action-message": [];
}>();

type BoardTab = "restaurant" | "waiting" | "booked" | "picked_up" | "refused";

const restaurantBadgeColor = computed(() => {
  if (props.pendingRestaurantOrders.length === 0) return undefined;
  const hasActionable = props.pendingRestaurantOrders.some((o) =>
    isActionableRestaurantWait(o.waitingMinutes)
  );
  return hasActionable ? "#e5484d" : "#e0a100";
});

const boardTabs = computed<GlobalTabBarItem<BoardTab>[]>(() => [
  {
    value: "restaurant",
    label: "Čeka restoran",
    icon: "mdi-storefront-outline",
    badge: props.pendingRestaurantOrders.length,
    // Crven badge kad ima ijedna svježa narudžba za akciju; žut kad su sve
    // zaostale (restoran ne reaguje danima) - inače višednevni redovi drže
    // badge trajno crven i dispečer prestane da reaguje na njega.
    badgeColor: restaurantBadgeColor.value,
  },
  {
    value: "waiting",
    label: "Čeka kurira",
    icon: "mdi-account-clock-outline",
    badge: props.waitingOrders.length,
  },
  {
    value: "booked",
    label: "Čeka preuzimanje",
    icon: "mdi-timer-sand",
    badge: props.bookedDeliveries.length,
  },
  {
    value: "picked_up",
    label: "U dostavi",
    icon: "mdi-moped-outline",
    badge: props.pickedUpDeliveries.length,
  },
  {
    value: "refused",
    label: "Kupac odbio",
    icon: "mdi-close-circle-outline",
    badge: props.refusedOrders.length,
  },
]);

const activeTab = ref<BoardTab>("waiting");

// Pretraga (restoran / #ID) + filter hitnosti + status - drže se ovdje, tab
// komponente ih dobiju kao propove i same filtriraju svoju listu.
const searchQuery = ref("");
const urgencyFilter = ref<"all" | "late">("all");
const urgencyFilterOptions = [
  { label: "Sve", value: "all" as const },
  { label: "Samo što kasni", value: "late" as const },
];
const statusFilter = ref<"all" | "ready" | "accepted">("all");
const statusFilterOptions = [
  { label: "Svi statusi", value: "all" as const },
  { label: "Hrana gotova", value: "ready" as const },
  { label: "Restoran prihvatio", value: "accepted" as const },
];

const hasAnyOrders = computed(
  () =>
    props.waitingOrders.length > 0 ||
    props.bookedDeliveries.length > 0 ||
    props.pickedUpDeliveries.length > 0 ||
    props.refusedOrders.length > 0 ||
    props.pendingRestaurantOrders.length > 0
);

// Živi tiker samo da "Ažurirano pre X min" i podsetnik o pauzi ostanu tačni
// bez čekanja na sledeći fetch (isti obrazac kao dispatcher/index.vue "now").
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 30000);
});
onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker);
});

const PAUSE_REMINDER_MS = 10 * 60 * 1000;

const updatedLabel = computed(() => {
  void now.value;
  if (!props.lastUpdatedAt) return "Još nije osveženo";
  return `Ažurirano ${formatRelativeTime(props.lastUpdatedAt)}`;
});

const pausedTooLong = computed(() => {
  void now.value;
  if (!props.paused || !props.lastUpdatedAt) return false;
  return Date.now() - new Date(props.lastUpdatedAt).getTime() > PAUSE_REMINDER_MS;
});
</script>

<style scoped>
.updated-label {
  font-size: 0.78rem;
  color: #9aa4b2;
}

.updated-label--stale {
  color: #e0a100;
  font-weight: 600;
}

.list-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.board-search {
  flex: 1 1 200px;
  min-width: 160px;
}

.status-select {
  flex: 1 1 160px;
  max-width: 200px;
}

.board-search :deep(.v-field),
.status-select :deep(.v-field) {
  border-radius: 12px;
  background: #f2f3f7;
  box-shadow: none;
}

.orders-list {
  background: transparent;
  display: grid;
  gap: 6px;
}

.order-skeleton {
  border: 1px solid #e7e9ee;
  border-radius: 8px;
}
</style>
