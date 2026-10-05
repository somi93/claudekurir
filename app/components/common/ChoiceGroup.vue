<template>
  <div
    class="cg"
    :class="[`cg--${variant}`, columns === 3 ? 'cg--3' : '']"
    role="radiogroup"
    :aria-label="label"
    @keydown="onKey"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      class="cg-opt"
      :class="{ 'cg-opt--wide': option.wide }"
      :aria-checked="isChecked(option.value)"
      :tabindex="isFocusable(option.value) ? 0 : -1"
      :data-choice="String(option.value)"
      :style="option.ink || option.tint ? { '--ink': option.ink, '--tint': option.tint } : undefined"
      @click="pick(option.value)"
    >
      <template v-if="variant === 'cards'">
        <span v-if="option.icon" class="cg-ic"><v-icon :icon="option.icon" size="22" /></span>
        <span class="cg-tx">
          <b>{{ option.label }}</b>
          <small v-if="option.hint">{{ option.hint }}</small>
        </span>
        <span class="cg-ck"><v-icon icon="mdi-check" size="15" /></span>
      </template>
      <template v-else>
        <v-icon v-if="option.icon" :icon="option.icon" size="18" />
        <span>{{ option.label }}</span>
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from "vue";

// Izbor jednog od nekoliko (role=radiogroup): kartice sa ikonom (vozilo, način isplate) ili
// pilule (kategorija poruke, način isplate zarade). Strelice, Home i End mijenjaju izbor i
// fokus, kao kod pravog radiogroup-a; samo izabrana opcija je u redoslijedu tastera Tab.
export type ChoiceOption = {
  value: string | number;
  label: string;
  hint?: string;
  icon?: string;
  ink?: string;
  tint?: string;
  // Cijeli red (npr. "Pješice").
  wide?: boolean;
};

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null;
    options: ChoiceOption[];
    label: string;
    variant?: "cards" | "pills";
    columns?: 2 | 3;
  }>(),
  { variant: "cards", columns: 2 }
);

const emit = defineEmits<{ "update:modelValue": [value: string | number] }>();

const isChecked = (value: string | number) => props.modelValue === value;
// Bez izbora u tab redoslijed ulazi prva opcija.
const isFocusable = (value: string | number) =>
  props.modelValue == null ? props.options[0]?.value === value : props.modelValue === value;

const pick = (value: string | number) => emit("update:modelValue", value);

const onKey = async (event: KeyboardEvent) => {
  const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const total = props.options.length;
  const index = Math.max(
    0,
    props.options.findIndex((o) => o.value === props.modelValue)
  );
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? total - 1
        : (index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + total) % total;
  const option = props.options[next];
  if (!option) return;
  pick(option.value);
  await nextTick();
  (event.currentTarget as HTMLElement | null)
    ?.querySelector<HTMLElement>(`[data-choice="${String(option.value)}"]`)
    ?.focus();
};
</script>

<style scoped>
.cg--cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.cg--cards.cg--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.cg--cards .cg-opt {
  position: relative;
  display: grid;
  justify-items: start;
  align-content: space-between;
  gap: 8px;
  min-height: 84px;
  padding: 12px;
  border: 1.5px solid #dfe3ea;
  border-radius: 16px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

.cg--cards .cg-opt:active {
  background: #f1f4f9;
}

.cg-opt:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.cg-ic {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--tint, #eef4ff);
  color: var(--ink, #2459c7);
}

.cg-tx {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.cg-tx b {
  font-size: 0.94rem;
  font-weight: 800;
}

.cg-tx small {
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.3;
  color: #5b6676;
}

.cg-ck {
  position: absolute;
  top: 10px;
  right: 10px;
  display: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #2f6fed;
  color: #fff;
}

.cg--cards .cg-opt[aria-checked="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  box-shadow: inset 0 0 0 1px #2f6fed;
}

.cg-opt[aria-checked="true"] .cg-ck {
  display: grid;
}

.cg--cards .cg-opt--wide {
  grid-column: 1 / -1;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  min-height: 64px;
}

.cg--pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cg--pills.cg--3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.cg--pills .cg-opt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.cg--pills .cg-opt[aria-checked="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

@media (max-width: 420px) {
  .cg--pills.cg--3 .cg-opt .v-icon {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cg--cards .cg-opt {
    transition: none;
  }
}
</style>
