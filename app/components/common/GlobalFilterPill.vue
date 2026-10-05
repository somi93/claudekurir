<template>
  <button
    type="button"
    class="filter-pill"
    :class="{ 'filter-pill--active': active, 'filter-pill--icon': iconOnly }"
    :aria-label="ariaLabel"
  >
    <v-icon v-if="iconOnly" :icon="icon" size="18" />
    <template v-else>
      <v-icon v-if="prependIcon" :icon="prependIcon" size="16" />
      {{ label }}
      <span v-if="count" class="filter-pill-count">{{ count }}</span>
      <v-icon v-if="chevron" icon="mdi-chevron-down" size="16" />
    </template>
    <span v-if="dot" class="filter-pill-dot" />
  </button>
</template>

<script setup lang="ts">
// Jedan filter-pill (dropdown okidač ili "svi filteri" ikonica) - koristi se
// unutar GlobalFilterBar. Dva oblika:
// - labeled (podrazumevano): tekst + chevron, obično aktivator za <v-menu>
//   ("v-bind="menuProps"" na ovoj komponenti prosleđuje se kroz $attrs na
//   root <button>, isti obrazac kao dosadašnji sirovi <button>)
// - iconOnly: samo ikonica (npr. "svi filteri" dugme), opciono sa `dot`
//   indikatorom da su napredni filteri aktivni
//
// `chevron="false"` + `count` daje čip za biranje kategorije (bez padajućeg
// menija), sa brojačem nepročitanog - vidi pages/courier/inbox.vue.
withDefaults(
  defineProps<{
    label?: string;
    icon?: string;
    prependIcon?: string;
    iconOnly?: boolean;
    active?: boolean;
    dot?: boolean;
    ariaLabel?: string;
    // Mali plavi brojač iza naziva; 0/izostavljen = ne prikazuje se.
    count?: number;
    // Strelica ka dole (okidač menija). Isključiti za čip koji samo bira vrijednost.
    chevron?: boolean;
  }>(),
  { chevron: true }
);
</script>

<style scoped>
.filter-pill {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid #e2e5ea;
  background: #fff;
  color: #0b1220;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.filter-pill:hover {
  border-color: #c7ccd4;
}

.filter-pill:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}

.filter-pill--icon {
  padding: 0;
  width: 38px;
  justify-content: center;
}

.filter-pill--active {
  border-color: #2f6fed;
  /* Tamnija plava od okvira: #2f6fed na #eef4ff je 4.1:1, ovo je 5.7:1. */
  color: #2459c7;
  background: #eef4ff;
}

.filter-pill-count {
  margin-left: 4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #2f6fed;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}

.filter-pill-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2f6fed;
  border: 1.5px solid #fff;
}
</style>
