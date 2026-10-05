<template>
  <div v-if="filtered.length > 0" class="orders-list">
    <BoardDeliveryRow
      v-for="delivery in filtered"
      :key="delivery.id"
      :delivery="delivery"
      :expanded="expandedId === delivery.id"
      @toggle="toggleExpand(delivery.id)"
    />
  </div>
  <GlobalEmptyState v-else-if="deliveries.length > 0" icon="mdi-magnify-close">
    Nema narudžbi za zadatu pretragu/filter.
  </GlobalEmptyState>
  <GlobalEmptyState v-else-if="!hasError" :icon="emptyIcon">{{ emptyText }}</GlobalEmptyState>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import BoardDeliveryRow from "./BoardDeliveryRow.vue";
import { isLateDelivery } from "~/utils/dispatchBoard";
import { orderMatchesSearch } from "~/utils/dispatchBoardFormat";
import type { ActiveDelivery } from "~/models/ActiveDelivery";

// Isti prikaz za "Čeka preuzimanje" (booked) i "U dostavi" (picked_up) - jedina
// razlika je koja lista i tekst praznog stanja. Faza se ne prikazuje po redu
// (cijela lista je jedna faza - vidi naziv taba).
const props = defineProps<{
  deliveries: ActiveDelivery[];
  search: string;
  urgency: "all" | "late";
  emptyIcon: string;
  emptyText: string;
  hasError: boolean;
}>();

const filtered = computed(() =>
  props.deliveries.filter((delivery) => {
    if (props.urgency === "late" && !isLateDelivery(delivery.minutesUntilDelivery))
      return false;
    return orderMatchesSearch(props.search, delivery.restaurantName, delivery.id);
  })
);

const expandedId = ref<number | null>(null);
const toggleExpand = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id;
};
</script>

<style scoped>
.orders-list {
  display: grid;
  gap: 6px;
}
</style>
