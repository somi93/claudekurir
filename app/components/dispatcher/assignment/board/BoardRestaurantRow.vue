<template>
  <div class="order-row" :class="{ 'order-row--late': critical, 'order-row--stale': stale }">
    <div class="order-row__head">
      <button type="button" class="info" @click="emit('toggle')">
        <span class="info__primary">
          {{ toLatin(order.restaurantName) }} · #{{ order.id }}
        </span>
        <span class="info__secondary">
          <v-icon :icon="typeMeta.icon" :title="typeMeta.label" size="14" class="type-icon" />
          <span v-if="order.deliveryType !== 0" class="type-label">
            {{ typeMeta.label }} ·
          </span>
          <span class="ordered">{{ orderedLabel }}</span>
        </span>
      </button>

      <span class="status" :class="timing.cssClass">{{ timing.text }}</span>

      <div class="actions" @click.stop>
        <v-btn
          v-if="order.restaurantPhone"
          :href="`tel:${order.restaurantPhone}`"
          color="primary"
          variant="tonal"
          size="small"
          prepend-icon="mdi-phone"
          class="act-btn"
        >
          Pozovi restoran
        </v-btn>
        <v-chip v-else size="small" variant="tonal" color="warning">Nema broja</v-chip>

        <v-btn
          size="small"
          variant="tonal"
          color="success"
          prepend-icon="mdi-check"
          :loading="resolving"
          :disabled="resolveDisabled"
          class="act-btn"
          @click="emit('resolve', 'accept')"
        >
          Prihvati
        </v-btn>
        <v-btn
          size="small"
          variant="outlined"
          color="error"
          prepend-icon="mdi-close"
          :loading="resolving"
          :disabled="resolveDisabled"
          class="act-btn"
          @click="emit('resolve', 'reject')"
        >
          Odbij
        </v-btn>
      </div>

      <button
        type="button"
        class="chev"
        :aria-label="expanded ? 'Sakrij detalje' : 'Prikaži detalje'"
        @click="emit('toggle')"
      >
        <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="20" />
      </button>
    </div>

    <v-expand-transition>
      <LocationDetails
        v-if="expanded"
        :location="order.location"
        class="order-row__details"
      />
    </v-expand-transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LocationDetails from "../LocationDetails.vue";
import {
  deliveryTypeMeta,
  isRestaurantCritical,
  orderedAtLabel,
  restaurantTiming,
} from "~/utils/dispatchBoardFormat";
import { restaurantWaitTier } from "~/utils/dispatchBoard";
import type { PendingRestaurantOrder } from "~/models/PendingRestaurantOrder";

const props = defineProps<{
  order: PendingRestaurantOrder;
  expanded: boolean;
  resolving: boolean;
  resolveDisabled: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  resolve: [action: "accept" | "reject"];
}>();

const typeMeta = computed(() => deliveryTypeMeta(props.order.deliveryType));
const timing = computed(() => restaurantTiming(props.order));
const orderedLabel = computed(() => orderedAtLabel(props.order));
const critical = computed(() => isRestaurantCritical(props.order));
const stale = computed(() => restaurantWaitTier(props.order.waitingMinutes) === "stale");
</script>

<style scoped>
.order-row {
  border: 1px solid #e7e9ee;
  border-radius: 12px;
  background: #fff;
  transition: border-color 0.15s ease;
}

.order-row:hover {
  border-color: #d3d7df;
}

.order-row--late {
  border-color: #f2c4c4;
  background: #fff8f8;
}

.order-row--late:hover {
  border-color: #e8a9a9;
}

.order-row--stale {
  background: #fafafb;
}

.order-row__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0;
  border: none;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.info__primary {
  font-size: 0.92rem;
  font-weight: 600;
  color: #1f2733;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info__secondary {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 0.82rem;
  color: #9aa4b2;
}

.type-icon {
  flex: none;
  color: #9aa4b2;
}

.type-label {
  flex: none;
  color: #6b7685;
  font-weight: 600;
}

.ordered {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
}

.status {
  flex: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.timing-waiting {
  color: #6b7685;
}

.timing-warning {
  color: #e0a100;
  font-weight: 700;
}

.timing-late {
  color: #e5484d;
  font-weight: 700;
}

.timing-muted {
  color: #9aa4b2;
}

.actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.act-btn {
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.75rem;
}

.act-btn :deep(.v-icon) {
  font-size: 14px;
}

.chev {
  flex: none;
  display: inline-flex;
  padding: 4px;
  border: none;
  background: transparent;
  color: #b4bcc8;
  cursor: pointer;
}

.chev:hover {
  color: #6b7685;
}

.order-row__details {
  border-top: 1px solid #f0f1f4;
}
</style>
