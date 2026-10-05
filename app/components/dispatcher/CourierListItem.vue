<template>
  <v-list-item
    class="courier-item"
    :class="{ selected, stale: isLongOffline(entry.courier, now) }"
    rounded="lg"
    @click="emit('select', entry.courier.courier_id)"
  >
    <template #prepend>
      <v-avatar :style="{ background: STATE_META[entry.state].color }" class="courier-avatar">
        {{ entry.courier.courier_id }}
      </v-avatar>
    </template>

    <v-list-item-title class="d-flex align-center justify-space-between ga-2">
      <span class="courier-name">
        {{ entry.courier.name ? toLatin(entry.courier.name) : `Dostavljač #${entry.courier.courier_id}` }}
      </span>
      <v-chip
        size="x-small"
        :style="{
          color: STATE_META[entry.state].color,
          background: STATE_META[entry.state].color + '1a',
        }"
        variant="flat"
      >
        {{ STATE_META[entry.state].label }}
      </v-chip>
    </v-list-item-title>

    <v-list-item-subtitle>
      <span class="courier-meta">
        <span class="courier-meta">
          <span>#{{ entry.courier.courier_id }}</span>
          <span v-if="entry.courier.phone">· {{ entry.courier.phone }}</span>
          <span v-if="entry.courier.vehicle">
            ·
            <v-icon :icon="courierVehicleMeta(entry.courier.vehicle.type).icon" size="13" />
            {{ courierVehicleMeta(entry.courier.vehicle.type).label }}
          </span>
          <span v-if="entry.courier.suspended" class="courier-suspended">· suspendovan</span>
        </span>
        <span>
          {{ speedLabel(entry.courier.location) }} ·
          {{ lastSeenLabel(entry.courier.location, now) }}
        </span>
      </span>
    </v-list-item-subtitle>
  </v-list-item>
</template>

<script setup lang="ts">
import {
  STATE_META,
  isLongOffline,
  lastSeenLabel,
  speedLabel,
  type EnrichedCourierLocation,
} from "~/utils/courierStatus";
import { courierVehicleMeta } from "~/utils/vehicle";

defineProps<{
  entry: EnrichedCourierLocation;
  selected: boolean;
  now: number;
}>();

const emit = defineEmits<{
  select: [courierId: number];
}>();
</script>

<style scoped>
.courier-item {
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.courier-item:hover {
  background: #f8f9fb;
}

.courier-item.selected {
  border-color: #0b1220;
  background: #f5f6f8;
}

.courier-item.stale:not(.selected) {
  opacity: 0.6;
}

.courier-avatar {
  color: #fff;
  font-weight: 800;
  font-size: 0.85rem;
}

.courier-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.courier-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.courier-suspended {
  color: #d4380d;
  font-weight: 700;
}

.courier-item :deep(.v-list-item-subtitle) {
  -webkit-line-clamp: unset;
}
</style>
