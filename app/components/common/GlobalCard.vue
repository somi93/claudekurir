<template>
  <v-card flat class="global-card" :style="style">
    <div v-if="$slots.title || $slots.subtitle || $slots.actions" class="global-card-head">
      <div v-if="$slots.title || $slots.subtitle">
        <v-card-title v-if="$slots.title" class="panel-title">
          <slot name="title" />
        </v-card-title>
        <v-card-subtitle v-if="$slots.subtitle" class="panel-subtitle">
          <slot name="subtitle" />
        </v-card-subtitle>
      </div>
      <div v-if="$slots.actions" class="global-card-actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Zajednička "školjka" kartice (border-radius 24px + ista senka) - ponavljala
// se identično u 32 fajla pod imenom ".panel", padding je jedino što je
// varijabilno pa je ovde prop umesto još jedne lokalne CSS klase - drži
// vrednost vidljivom na mestu poziva, ne u rasutim scoped style blokovima
// (gde je do sada tiho drifting - vidi 12px/16px/24px varijante pre
// ujednacavanja 16.08).
const props = defineProps<{
  padding?: string;
}>();

const style = computed(() => (props.padding ? { padding: props.padding } : undefined));
</script>

<style scoped>
.global-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

/* panel-title/panel-subtitle su ranije bili duplirani (font-size 1.05/1.1rem,
   sa/bez paddinga) u ~20 fajlova - sada je ovo jedini izvor, po dogovoru
   16.08: naslov 1.1rem bez paddinga, podnaslov normal white-space + #6b7685. */
.global-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.panel-title {
  padding: 0;
  font-size: 1.1rem;
}

.panel-subtitle {
  padding: 0;
  white-space: normal;
  color: #6b7685;
}
</style>
