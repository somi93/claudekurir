<template>
  <div class="accepted-card">
    <v-avatar color="success" size="36">
      <v-icon icon="mdi-check-bold" color="white" size="20" />
    </v-avatar>
    <div class="accepted-body">
      <div class="accepted-title">
        {{ candidate ? toLatin(candidate.name) : `Kurir #${courierId}` }} je prihvatio narudžbu
      </div>
      <div class="accepted-meta">
        <template v-if="candidate">
          <v-icon :icon="vehicleMeta!.icon" :color="vehicleMeta!.color" size="15" />
          {{ vehicleMeta!.label }}
          <span v-if="candidate.distanceKm !== null">
            · {{ candidate.distanceKm.toFixed(1) }} km od restorana
          </span>
          <span v-if="candidate.zone"> · Zona: {{ toLatin(candidate.zone) }}</span>
        </template>
        <span v-else>ID kurira: {{ courierId }}</span>
      </div>
    </div>
    <div class="accepted-hint">Daljnje ponude za ovu narudžbu su zaustavljene.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { toLatin } from "~/utils/toLatin";
import { courierVehicleMeta } from "~/utils/vehicle";
import type { CandidateCourier } from "~/types/candidateCourier";

const props = defineProps<{
  candidate: CandidateCourier | null;
  courierId: number | null;
}>();

const vehicleMeta = computed(() =>
  props.candidate ? courierVehicleMeta(props.candidate.vehicle) : null
);
</script>

<style scoped>
.accepted-card {
  margin-top: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #a9dfc2;
  background: #f1fbf6;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.accepted-body {
  flex: 1 1 220px;
  min-width: 0;
}

.accepted-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #0b1220;
}

.accepted-meta {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.82rem;
  color: #4f7d67;
  margin-top: 2px;
}

.accepted-hint {
  font-size: 0.78rem;
  color: #6b7685;
  flex: 0 0 auto;
}
</style>
