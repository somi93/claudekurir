<template>
  <v-list v-if="filtered.length > 0" class="orders-list" lines="two">
    <template v-for="order in filtered" :key="order.id">
      <v-list-item
        rounded="lg"
        class="order-item"
        :class="{ 'order-item--late': isLateDelivery(order.minutesUntilDelivery) }"
        @click="toggleExpand(order.id)"
      >
        <template #prepend>
          <span class="status-dot" :class="{ ready: order.status === 'ready' }" />
        </template>

        <v-list-item-title>
          {{ toLatin(order.restaurantName) }} · #{{ order.id }}
          <v-chip
            v-if="isLateDelivery(order.minutesUntilDelivery)"
            size="x-small"
            color="error"
            variant="flat"
            class="ml-2"
          >
            Kasni
          </v-chip>
          <v-chip
            v-if="order.deliveryZone"
            size="x-small"
            variant="tonal"
            class="ml-2"
            prepend-icon="mdi-map-marker-outline"
          >
            {{ toLatin(order.deliveryZone) }}
          </v-chip>
        </v-list-item-title>
        <v-list-item-subtitle>
          <span :class="waitingTiming(order).cssClass">{{ waitingTiming(order).text }}</span>
          · {{ readyLabel(order) }}
          <span v-if="orderedAtLabel(order)" class="ordered-at">
            · {{ orderedAtLabel(order) }}
          </span>
          <span v-if="order.distanceKm !== null" class="ordered-at">
            · {{ order.distanceKm.toFixed(1) }} km do kupca
          </span>
        </v-list-item-subtitle>

        <template #append>
          <v-btn
            v-if="isCriticalWaitingOrder(order)"
            color="error"
            variant="flat"
            size="small"
            :loading="directAssigningId === order.id"
            :disabled="directAssigningId !== null"
            @click.stop="emit('direct-assign', order.id)"
          >
            Dodeli odmah
          </v-btn>
          <GlobalButtonPrimary v-else size="small" @click.stop="emit('select', order.id)">
            Predloži kurira
          </GlobalButtonPrimary>
        </template>
      </v-list-item>
      <v-expand-transition>
        <LocationDetails
          v-if="expandedId === order.id"
          :location="order.location"
          :zone="order.deliveryZone"
          :distance-km="order.distanceKm"
        />
      </v-expand-transition>
    </template>
  </v-list>
  <GlobalEmptyState v-else-if="orders.length > 0" icon="mdi-magnify-close">
    Nema narudžbi za zadatu pretragu/filter.
  </GlobalEmptyState>
  <GlobalEmptyState v-else-if="!hasError" icon="mdi-account-clock-outline">
    Nema narudžbi koje čekaju kurira.
  </GlobalEmptyState>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import LocationDetails from "../LocationDetails.vue";
import { isCriticalWaitingOrder, isLateDelivery } from "~/utils/dispatchBoard";
import {
  orderMatchesSearch,
  orderedAtLabel,
  readyLabel,
  waitingTiming,
} from "~/utils/dispatchBoardFormat";
import type { WaitingOrder } from "~/models/WaitingOrder";

const props = defineProps<{
  orders: WaitingOrder[];
  search: string;
  urgency: "all" | "late";
  status: "all" | "ready" | "accepted";
  directAssigningId: number | null;
  hasError: boolean;
}>();

const emit = defineEmits<{ select: [orderId: number]; "direct-assign": [orderId: number] }>();

const filtered = computed(() =>
  props.orders.filter((order) => {
    if (props.urgency === "late" && !isLateDelivery(order.minutesUntilDelivery)) return false;
    if (props.status === "ready" && order.status !== "ready") return false;
    if (props.status === "accepted" && order.status === "ready") return false;
    return orderMatchesSearch(props.search, order.restaurantName, order.id);
  })
);

const expandedId = ref<number | null>(null);
const toggleExpand = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id;
};
</script>

<style scoped>
.orders-list {
  background: transparent;
  display: grid;
  gap: 6px;
}

.order-item {
  border: 1px solid #e7e9ee;
  cursor: pointer;
}

.order-item :deep(.v-list-item-subtitle) {
  -webkit-line-clamp: unset;
  line-clamp: unset;
  -webkit-box-orient: unset;
  overflow: visible;
  white-space: normal;
  line-height: 1.45;
}

.order-item--late {
  border-color: #f2c4c4;
}

.status-dot {
  width: 10px;
  height: 10px;
  margin-right: 12px;
  border-radius: 50%;
  background: #ff9f1c;
  flex: none;
}

.status-dot.ready {
  background: #00b37e;
}

.ordered-at {
  color: #9aa4b2;
}

.timing-waiting {
  font-weight: 600;
}

.timing-calm {
  color: #6b7685;
}

.timing-late {
  color: #e5484d;
  font-weight: 600;
}
</style>
