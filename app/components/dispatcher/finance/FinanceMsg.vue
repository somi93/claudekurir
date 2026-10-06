<template>
  <div class="fm" :class="`fm--${tone}`">
    <v-icon v-if="icon" :icon="icon" size="16" />
    <span><slot /></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Poruka ispod polja u listu (posljedica unosa): ton ok / warn / bad sa ikonom. Kao poruka u SheetField,
// ali ih može biti više odjednom ("Razlika od prijave" i "Veće je od duga").
const props = withDefaults(defineProps<{ tone?: "ok" | "warn" | "bad" }>(), { tone: "ok" });

const icon = computed(() =>
  props.tone === "warn" ? "mdi-alert-outline" : props.tone === "bad" ? "mdi-alert-circle-outline" : "mdi-check-circle-outline"
);
</script>

<style scoped>
.fm {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #5b6676;
}

.fm :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
}

.fm--ok {
  color: #00734f;
}

.fm--warn {
  color: #8f4406;
}

.fm--bad {
  color: #b42318;
}
</style>
