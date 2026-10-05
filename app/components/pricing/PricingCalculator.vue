<template>
  <GlobalCard padding="20px" class="calc-panel">
    <template #title>Primer obračuna</template>
    <template #subtitle>
      Kako izgleda cena dostave koju vidi kupac pre potvrde narudžbe.
    </template>

    <v-slider
      v-model="previewDistance"
      :min="0.5"
      :max="12"
      :step="0.1"
      label="Udaljenost"
      thumb-label
      color="primary"
      class="mt-6"
    >
      <template #append>
        <span class="slider-value">{{ previewDistance.toFixed(1) }} km</span>
      </template>
    </v-slider>

    <div class="calc-lines">
      <div class="calc-line">
        <span>Startna cena</span>
        <strong>{{ previewBreakdown.base.toFixed(2) }} {{ pricing?.currency }}</strong>
      </div>
      <div class="calc-line">
        <span>
          {{ previewDistance.toFixed(1) }} km × {{ pricing?.price_per_km ?? 0 }}
          {{ pricing?.currency }}/km
        </span>
        <strong
          >{{ previewBreakdown.perKmTotal.toFixed(2) }} {{ pricing?.currency }}</strong
        >
      </div>
      <div
        v-for="line in previewBreakdown.surchargeLines"
        :key="line.name"
        class="calc-line surcharge-line"
      >
        <span>+ {{ line.name }}</span>
        <strong>{{ line.amount.toFixed(2) }} {{ pricing?.currency }}</strong>
      </div>
    </div>

    <v-divider class="my-4" />

    <div class="calc-total">
      <span>Ukupna cena dostave</span>
      <strong>{{ previewBreakdown.total.toFixed(2) }} {{ pricing?.currency }}</strong>
    </div>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import type { Pricing, Surcharge } from "~/types/pricing";

const props = defineProps<{
  pricing: Pricing | null;
  activeSurcharges: Surcharge[];
}>();

const previewDistance = ref(4.5);

const previewBreakdown = computed(() => {
  const base = props.pricing?.base_price ?? 0;
  const perKmTotal = (props.pricing?.price_per_km ?? 0) * previewDistance.value;

  const surchargeLines = props.activeSurcharges
    .filter((s) => s.type !== "note")
    .map((s) => ({
      name: s.name,
      amount: s.type === "per_km" ? s.value * previewDistance.value : s.value,
    }));

  const surchargeTotal = surchargeLines.reduce((sum, line) => sum + line.amount, 0);

  return {
    base,
    perKmTotal,
    surchargeLines,
    surchargeTotal,
    total: base + perKmTotal + surchargeTotal,
  };
});
</script>

<style scoped>
.calc-panel {
  height: 100%;
  background: #0b1220;
  color: #fff;
}

.calc-panel :deep(.panel-title),
.calc-panel :deep(.panel-subtitle) {
  color: #fff;
}

.calc-panel :deep(.panel-subtitle) {
  color: rgba(255, 255, 255, 0.65);
}

.calc-panel :deep(.v-slider) {
  color: #fff;
}

.slider-value {
  font-weight: 700;
  font-size: 0.85rem;
  white-space: nowrap;
}

.calc-lines {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.calc-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.75);
}

.surcharge-line strong {
  color: #ffc247;
}

.calc-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.15rem;
}

.calc-total strong {
  font-size: 1.4rem;
  color: #00d290;
}
</style>
