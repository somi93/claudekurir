<template>
  <div class="dr" :class="{ 'dr--act': actionable }">
    <span class="dr-ic" :class="tone ? `is-${tone}` : ''" :style="iconStyle" aria-hidden="true">
      <v-icon :icon="icon" size="20" />
    </span>
    <button
      v-if="actionable"
      type="button"
      class="dr-tx dr-tx--b"
      :data-row="row"
      :aria-label="ariaLabel ?? `${label}: ${empty ? 'nije dodato' : value}. Izmijeni`"
      @click="emit('act')"
    >
      <small>{{ label }}</small>
      <b :class="{ empty }">{{ value }}</b>
      <em v-if="hint">{{ hint }}</em>
      <slot name="extra" />
    </button>
    <span v-else class="dr-tx">
      <small>{{ label }}</small>
      <b :class="{ empty }">{{ value }}</b>
      <em v-if="hint">{{ hint }}</em>
      <slot name="extra" />
    </span>
    <span class="dr-end">
      <slot name="end" />
      <span v-if="endText || (actionable && empty)" class="dr-add" aria-hidden="true">{{ endText ?? "Dodaj" }}</span>
      <v-icon v-if="actionable" icon="mdi-chevron-right" size="20" aria-hidden="true" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Red u detalju kurira: ikona od 40 px, oznaka, vrijednost i desna strana. Ako red ima radnju,
// glavni dio je dugme razvučeno preko cijelog reda (pseudo-element), a dugmad u desnom dijelu
// (kopiraj) stoje iznad njega kao posebni elementi: dugme u dugmetu bi pokvarilo DOM.
// Prazna vrijednost je siv tekst + plavo "Dodaj", stanje nije samo u boji.
const props = withDefaults(
  defineProps<{
    icon: string;
    label: string;
    value: string;
    empty?: boolean;
    hint?: string;
    tone?: "ok" | "warn" | "bad" | "blue" | null;
    iconInk?: string;
    iconTint?: string;
    actionable?: boolean;
    // data-row: po njemu se fokus vraća na red poslije zatvaranja lista.
    row?: string;
    ariaLabel?: string;
    // Tekst desno umjesto "Dodaj" (npr. "Nova" uz zadnju poruku).
    endText?: string;
  }>(),
  {
    empty: false,
    hint: undefined,
    tone: null,
    iconInk: undefined,
    iconTint: undefined,
    actionable: false,
    row: undefined,
    ariaLabel: undefined,
    endText: undefined,
  }
);

const emit = defineEmits<{ act: [] }>();

const iconStyle = computed(() =>
  props.iconInk || props.iconTint ? { background: props.iconTint, color: props.iconInk } : undefined
);
</script>

<style scoped>
.dr {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: center;
  min-height: 64px;
  padding: 12px 14px;
  background: #fff;
}

.dr + .dr::before {
  content: "";
  position: absolute;
  top: 0;
  left: 66px;
  right: 0;
  height: 1px;
  background: #eceef2;
  pointer-events: none;
}

.dr--act:active {
  background: #f1f4f9;
}

.dr-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
}

.dr-ic.is-ok {
  background: #e3f8ef;
  color: #00734f;
}

.dr-ic.is-warn {
  background: #fff2df;
  color: #9a4a07;
}

.dr-ic.is-bad {
  background: #fde8e6;
  color: #b42318;
}

.dr-ic.is-blue {
  background: #eef4ff;
  color: #2459c7;
}

.dr-tx {
  display: grid;
  gap: 1px;
  min-width: 0;
  text-align: left;
}

.dr-tx--b {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.dr-tx--b::after {
  content: "";
  position: absolute;
  inset: 0;
}

/* Okvir fokusa unutra: grupa ima overflow:hidden pa bi vanjski bio odsječen. */
.dr-tx--b:focus-visible {
  outline: none;
}

.dr-tx--b:focus-visible::after {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.dr-tx small {
  font-size: 0.76rem;
  font-weight: 700;
  color: #5b6676;
}

.dr-tx b {
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.dr-tx b.empty {
  font-weight: 600;
  color: #657083;
}

.dr-tx em {
  font-size: 0.8rem;
  font-style: normal;
  line-height: 1.3;
  color: #5b6676;
}

.dr-end {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #657083;
  /* Dodir na strelicu ili "Dodaj" pada na razvučeno dugme reda; samo dugmad u slotu hvataju dodir. */
  pointer-events: none;
}

.dr-add {
  font-size: 0.84rem;
  font-weight: 800;
  color: #2459c7;
}

/* Dugmad u desnom dijelu (kopiraj) su iznad razvučenog dugmeta reda. */
.dr-end :slotted(button) {
  position: relative;
  z-index: 1;
  pointer-events: auto;
}
</style>
