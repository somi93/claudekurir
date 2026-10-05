<template>
  <span class="ssc" :class="`ssc--${state}`" role="status" :data-state="state">
    <i class="ssc-dot" aria-hidden="true"></i>
    {{ TEXTS[state] }}
  </span>
</template>

<script setup lang="ts">
export type SaveState = "saved" | "unsaved" | "saving";

// Oznaka stanja u zaglavlju stranice sa izmjenama (Cjenovnik). Stanje nije samo u boji: uz tačku
// uvijek ide tekst. Tamni tekst na blagom tonu (≥ 4.5:1). role="status" javlja promjenu čitaču
// bez prekidanja ("Nesačuvano", pa "Sve je sačuvano").
defineProps<{ state: SaveState }>();

const TEXTS: Record<SaveState, string> = {
  saved: "Sve je sačuvano",
  unsaved: "Nesačuvano",
  saving: "Čuvam…",
};
</script>

<style scoped>
.ssc {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 2px 12px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.ssc-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Nesačuvano: #9a4a07 na #fff2df je 5.7:1. */
.ssc--unsaved {
  background: #fff2df;
  color: #9a4a07;
}

.ssc--unsaved .ssc-dot {
  background: #e08a14;
}

/* Sve je sačuvano: #00734f na #e3f8ef je 5.3:1. */
.ssc--saved {
  background: #e3f8ef;
  color: #00734f;
}

.ssc--saved .ssc-dot {
  background: #00b37e;
}

/* Čuvam: #2459c7 na #eef4ff je 5.7:1. */
.ssc--saving {
  background: #eef4ff;
  color: #2459c7;
}

.ssc--saving .ssc-dot {
  background: #2f6fed;
  animation: ssc-pulse 1s ease-in-out infinite;
}

@keyframes ssc-pulse {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ssc--saving .ssc-dot {
    animation: none;
  }
}
</style>
