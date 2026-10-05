<template>
  <div class="location-details" @click.stop>
    <div class="location-row">
      <template v-if="location">
        <v-icon icon="mdi-map-marker-outline" size="18" class="mr-1" />
        <span>{{ formattedAddress }}</span>
      </template>
      <span v-else class="no-location">Adresa isporuke nije dostupna.</span>
    </div>

    <div v-if="zone || distanceKm !== null" class="route-row">
      <span v-if="zone">
        <v-icon icon="mdi-map-marker-radius-outline" size="16" class="mr-1" />Zona: {{ toLatin(zone) }}
      </span>
      <span v-if="distanceKm !== null">
        <v-icon icon="mdi-map-marker-distance" size="16" class="mr-1" />{{
          distanceKm.toFixed(1)
        }}
        km od restorana
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Location } from "~/types/order";

const props = withDefaults(
  defineProps<{
    location: Location | null;
    // Samo "Čeka kurira" tab ih šalje (backend DIO 7.2) - ostali tabovi izostave.
    zone?: string | null;
    distanceKm?: number | null;
  }>(),
  { zone: null, distanceKm: null }
);

const formattedAddress = computed(() => {
  const location = props.location;
  if (!location) return "";
  const parts = [
    toLatin(location.address),
    location.apartment ? `stan ${location.apartment}` : null,
    location.floor ? `sprat ${location.floor}` : null,
    toLatin(location.firm),
    toLatin(location.city?.name),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Adresa nije potpuna.";
});
</script>

<style scoped>
.location-details {
  padding: 8px 16px 12px 52px;
  font-size: 0.85rem;
  color: #6b7685;
}

.location-row {
  display: flex;
  align-items: center;
}

.route-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 4px;
  font-size: 0.8rem;
  color: #9aa4b2;
}

.no-location {
  font-style: italic;
  color: #9aa4b2;
}
</style>
