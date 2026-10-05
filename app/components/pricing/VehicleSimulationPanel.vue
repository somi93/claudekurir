<template>
  <GlobalCard padding="20px" class="h-100">
    <template #title>Simulacija narudžbe</template>
    <template #subtitle>
      Proveri koje vozilo bi bilo preporučeno za konkretnu zonu/udaljenost.
    </template>

    <GlobalSelect
      v-model="zoneId"
      :items="zoneItems"
      item-title="title"
      item-value="value"
      label="Zona"
      class="mt-4"
      hide-details="auto"
    />

    <v-switch
      v-model="specifyDistance"
      label="Odredi udaljenost"
      color="primary"
      hide-details
      density="compact"
      class="mt-2"
    />
    <v-slider
      v-if="specifyDistance"
      v-model="localDistance"
      :min="0.5"
      :max="20"
      :step="0.5"
      thumb-label
      color="primary"
      class="mt-2"
    >
      <template #append>
        <span class="slider-value">{{ localDistance.toFixed(1) }} km</span>
      </template>
    </v-slider>

    <v-divider class="my-4" />

    <div v-if="loading" class="d-flex justify-center py-4">
      <v-progress-circular indeterminate color="primary" size="28" />
    </div>

    <template v-else-if="recommendation">
      <div v-if="recommendation.recommendedVehicles.length > 0" class="ranked-vehicles">
        <div
          v-for="(vehicle, index) in recommendation.recommendedVehicles"
          :key="vehicle + index"
          class="ranked-vehicle"
        >
          <span class="ranked-index">{{ index + 1 }}.</span>
          <v-icon
            :icon="ruleVehicleMeta(vehicle).icon"
            :color="ruleVehicleMeta(vehicle).color"
            size="18"
          />
          {{ ruleVehicleMeta(vehicle).label }}
        </div>
      </div>
      <GlobalEmptyState v-else icon="mdi-car-off">Nijedno pravilo se ne poklapa.</GlobalEmptyState>

      <v-card
        v-if="recommendation.matchedRule"
        class="matched-rule-card mt-3"
        variant="tonal"
        color="info"
      >
        <div class="matched-rule-title">
          <v-chip size="small" color="info" variant="flat">Poklapa se</v-chip>
          {{ recommendation.matchedRule.conditionText }}
        </div>
        <p v-if="recommendation.matchedRule.note" class="matched-rule-note">
          {{ recommendation.matchedRule.note }}
        </p>
      </v-card>

      <!-- Breakdown cijene - isti format kao "Primer obračuna" na prvom tabu.
           Backend šalje price samo kad je distance_km poslat (tiket #223639). -->
      <div v-if="recommendation.price" class="price-breakdown mt-4">
        <p class="breakdown-title">Cena dostave</p>
        <div class="calc-line">
          <span>Startna cena</span>
          <strong>{{ money(recommendation.price.base_price) }}</strong>
        </div>
        <div class="calc-line">
          <span>
            {{ recommendation.price.distance_km.toFixed(1) }} km ×
            {{ recommendation.price.price_per_km }} {{ recommendation.price.currency }}/km
          </span>
          <strong>{{ money(recommendation.price.per_km_total) }}</strong>
        </div>
        <div
          v-for="surcharge in recommendation.price.surcharges"
          :key="surcharge.id"
          class="calc-line surcharge-line"
        >
          <span>+ {{ surcharge.name }}</span>
          <strong>{{ money(surcharge.amount) }}</strong>
        </div>
        <v-divider class="my-3" />
        <div class="calc-total">
          <span>Ukupna cena dostave</span>
          <strong>{{ money(recommendation.price.total) }}</strong>
        </div>
      </div>
      <p v-else-if="distanceKm === null" class="price-hint mt-3">
        Uključi „Odredi udaljenost" da vidiš i cenu dostave za ovu simulaciju.
      </p>
    </template>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import type { DispatcherZone } from "~/types/dispatcherZone";
import type { VehicleRecommendation } from "~/types/vehicleRecommendation";
import { ruleVehicleMeta } from "~/utils/vehicle";

const props = defineProps<{
  zones: DispatcherZone[];
  loading: boolean;
  recommendation: VehicleRecommendation | null;
  // Valuta firme - fallback kad recommend-vehicle ne vrati price.currency.
  currency: string;
}>();

const zoneId = defineModel<number | null>("zoneId", { required: true });
const distanceKm = defineModel<number | null>("distanceKm", { required: true });

const zoneItems = computed(() => [
  { title: "Svejedno", value: null },
  ...props.zones.map((zone) => ({ title: toLatin(zone.name), value: zone.id })),
]);

// "4.92 KM" - valuta iz samog price objekta (kao i na "Primer obračuna"), uz
// fallback na valutu firme kad je price null / bez currency.
const money = (value: number) =>
  `${value.toFixed(2)} ${props.recommendation?.price?.currency ?? props.currency}`;

const specifyDistance = ref(distanceKm.value !== null);
const localDistance = ref(distanceKm.value ?? 5);

watch([specifyDistance, localDistance], () => {
  distanceKm.value = specifyDistance.value ? localDistance.value : null;
});
</script>

<style scoped>
.slider-value {
  font-weight: 700;
  font-size: 0.85rem;
  white-space: nowrap;
}

.ranked-vehicles {
  display: grid;
  gap: 8px;
}

.ranked-vehicle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}

.ranked-index {
  font-weight: 700;
  color: #6b7685;
}

.matched-rule-card {
  border-radius: 16px;
  padding: 12px 14px;
}

.matched-rule-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}

.matched-rule-note {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: #6b7685;
}

.breakdown-title {
  margin: 0 0 8px;
  font-weight: 700;
  font-size: 0.9rem;
}

.calc-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.9rem;
  color: #495260;
  padding: 3px 0;
}

.surcharge-line strong {
  color: #e0a100;
}

.calc-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1rem;
  font-weight: 700;
}

.calc-total strong {
  font-size: 1.15rem;
  color: #00b37e;
}

.price-hint {
  font-size: 0.82rem;
  color: #9aa4b2;
}
</style>
