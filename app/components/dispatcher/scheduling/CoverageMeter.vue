<template>
  <div class="cm" :class="`cm--${size}`" :style="{ '--c': color }" aria-hidden="true">
    <i :style="{ width: `${pct}%` }" />
    <b v-for="t in ticks" :key="t" :style="{ left: `${(t / scale) * 100}%` }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Mjerač popunjenosti smjene: ispunjeni dio je broj potvrđenih kurira, a dva bijela zareza su minimum i cilj.
// Mjerilo je najveći od cilja, potvrđenih i maksimuma, pa se vidi i preko cilja. Samo ukras: tekst uz njega nosi
// isti podatak (čitač ekrana ga preskače).
const props = withDefaults(
  defineProps<{
    booked: number;
    min: number;
    target: number;
    max: number | null;
    color: string;
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "sm" }
);

const scale = computed(() => Math.max(props.target, props.booked, props.max ?? 0, 1));
const pct = computed(() => Math.min(100, Math.round((props.booked / scale.value) * 100)));
const ticks = computed(() => [props.min, props.target].filter((v) => v > 0 && v < scale.value));
</script>

<style scoped>
.cm {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e8ebf0;
}

.cm--md {
  height: 10px;
}

.cm--lg {
  height: 12px;
}

.cm i {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: 999px;
  background: var(--c);
}

.cm b {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #fff;
}
</style>
