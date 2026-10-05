<template>
  <v-list v-if="filtered.length > 0" class="orders-list" lines="two">
    <template v-for="order in filtered" :key="order.id">
      <v-list-item
        rounded="lg"
        class="order-item"
        @click="toggleExpand(order.id)"
      >
        <v-list-item-title>
          {{ toLatin(order.restaurantName) }} · #{{ order.id }}
        </v-list-item-title>
        <v-list-item-subtitle>
          Isporuka planirana {{ formatDateTime(order.deliveryTime) }} · Kurir:
          {{ toLatin(order.courierName) }}
        </v-list-item-subtitle>

        <template #append>
          <v-chip size="small" variant="tonal">
            {{ order.deliveryPrice.toFixed(2) }} KM
          </v-chip>
        </template>
      </v-list-item>
      <v-expand-transition>
        <LocationDetails v-if="expandedId === order.id" :location="order.location" />
      </v-expand-transition>
    </template>
  </v-list>
  <GlobalEmptyState v-else-if="orders.length > 0" icon="mdi-magnify-close">
    Nema narudžbi za zadatu pretragu/filter.
  </GlobalEmptyState>
  <GlobalEmptyState v-else-if="!hasError" icon="mdi-close-circle-outline">
    Nema odbijenih narudžbi u poslednja 24h.
  </GlobalEmptyState>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import LocationDetails from "../LocationDetails.vue";
import { formatDateTime } from "~/utils/datetime";
import { orderMatchesSearch } from "~/utils/dispatchBoardFormat";
import type { RefusedOrder } from "~/models/RefusedOrder";

const props = defineProps<{
  orders: RefusedOrder[];
  search: string;
  hasError: boolean;
}>();

const filtered = computed(() =>
  props.orders.filter((order) => orderMatchesSearch(props.search, order.restaurantName, order.id))
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
</style>
