<template>
  <div class="selected-card">
    <p class="eyebrow">Selektovan kurir</p>

    <div class="selected-head">
      <strong class="selected-id">
        {{ entry.courier.name ? toLatin(entry.courier.name) : `Dostavljač #${entry.courier.courier_id}` }}
      </strong>
      <v-chip
        size="small"
        :style="{
          color: STATE_META[entry.state].color,
          background: STATE_META[entry.state].color + '1a',
        }"
        variant="flat"
      >
        {{ STATE_META[entry.state].label }}
      </v-chip>
    </div>

    <div class="selected-identity">
      <span>ID #{{ entry.courier.courier_id }}</span>
      <a v-if="entry.courier.phone" :href="`tel:${entry.courier.phone}`" class="selected-phone">
        <v-icon icon="mdi-phone-outline" size="14" /> {{ entry.courier.phone }}
      </a>
      <span v-if="entry.courier.vehicle">
        <v-icon :icon="courierVehicleMeta(entry.courier.vehicle.type).icon" size="14" />
        {{ courierVehicleMeta(entry.courier.vehicle.type).label }}
      </span>
      <span v-if="entry.courier.suspended" class="selected-suspended">Suspendovan</span>
    </div>

    <div class="selected-stats">
      <span>
        <v-icon icon="mdi-speedometer" size="16" />
        {{ speedLabel(entry.courier.location) }}
      </span>
      <span>
        <v-icon icon="mdi-clock-outline" size="16" />
        {{ lastSeenLabel(entry.courier.location, now) }}
      </span>
    </div>

    <v-btn
      v-if="entry.courier.location"
      variant="tonal"
      size="small"
      block
      prepend-icon="mdi-crosshairs-gps"
      class="mt-3"
      @click="emit('center')"
    >
      Centriraj na mapi
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import {
  STATE_META,
  lastSeenLabel,
  speedLabel,
  type EnrichedCourierLocation,
} from "~/utils/courierStatus";
import { courierVehicleMeta } from "~/utils/vehicle";

defineProps<{
  entry: EnrichedCourierLocation;
  now: number;
}>();

const emit = defineEmits<{
  center: [];
}>();
</script>

<style scoped>
.eyebrow {
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  font-weight: 700;
  color: #9aa4b2;
}

.selected-card {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e7e9ee;
}

.selected-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 8px;
}

.selected-identity {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #6b7685;
}

.selected-phone {
  color: #2f6fed;
  text-decoration: none;
}

.selected-suspended {
  color: #d4380d;
}

.selected-id {
  font-size: 1.1rem;
}

.selected-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.selected-stats span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #6b7685;
  background: #f2f3f7;
  padding: 6px 10px;
  border-radius: 999px;
}
</style>
