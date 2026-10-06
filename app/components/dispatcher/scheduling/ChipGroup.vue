<template>
  <div
    class="cgp"
    :class="`cgp--${layout}`"
    :role="multi ? 'group' : 'radiogroup'"
    :aria-label="label"
    @keydown="onKey"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="cgp-chip"
      :class="{ 'cgp-chip--day': layout === 'days' }"
      :role="multi ? undefined : 'radio'"
      :aria-pressed="multi ? isOn(option.value) : undefined"
      :aria-checked="multi ? undefined : isOn(option.value)"
      :tabindex="multi || isFocusable(option.value) ? 0 : -1"
      :data-choice="String(option.value)"
      :aria-label="option.aria"
      @click="pick(option.value)"
    >
      <template v-if="layout === 'days'">
        <small>{{ option.small }}</small>
        <b>{{ option.label }}</b>
      </template>
      <template v-else>
        <span>{{ option.label }}</span>
        <small v-if="option.small">{{ option.small }}</small>
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from "vue";

export type ChipOption = {
  value: string | number;
  label: string;
  // Uz naziv (broj ponavljanja) ili iznad broja dana (dan u sedmici).
  small?: string;
  aria?: string;
};

// Izbor sa čipovima. `mode="multi"`: više izabranih (aria-pressed; dani, zone), vrijednost je niz.
// `mode="single"`: jedan izabran (role=radio; uobičajena vremena, šta se kopira), strelice mijenjaju izbor
// kao kod pravog radiogroup-a. `layout="days"`: sedam dana u redu (dan u sedmici iznad broja).
const props = withDefaults(
  defineProps<{
    modelValue: (string | number)[] | string | number | null;
    options: ChipOption[];
    label: string;
    mode?: "multi" | "single";
    layout?: "flow" | "days";
  }>(),
  { mode: "multi", layout: "flow" }
);

const emit = defineEmits<{ "update:modelValue": [value: (string | number)[] | string | number] }>();

const multi = computed(() => props.mode === "multi");
const selected = computed<(string | number)[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : props.modelValue == null ? [] : [props.modelValue]
);
const isOn = (v: string | number) => selected.value.includes(v);
// U single modu u redoslijed tastera Tab ulazi samo izabrana opcija (ili prva ako nema izbora).
const isFocusable = (v: string | number) =>
  props.modelValue == null ? props.options[0]?.value === v : props.modelValue === v;

const pick = (v: string | number) => {
  if (!multi.value) {
    emit("update:modelValue", v);
    return;
  }
  const next = isOn(v) ? selected.value.filter((x) => x !== v) : [...selected.value, v];
  emit("update:modelValue", next);
};

const onKey = async (event: KeyboardEvent) => {
  if (multi.value) return;
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
.cgp {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cgp--days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.cgp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.cgp-chip:active {
  background: #f1f4f9;
}

.cgp-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.cgp-chip[aria-pressed="true"],
.cgp-chip[aria-checked="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.cgp-chip small {
  font-size: 0.74rem;
  font-weight: 600;
  color: #5b6676;
}

.cgp-chip[aria-pressed="true"] small,
.cgp-chip[aria-checked="true"] small {
  color: #2459c7;
}

.cgp-chip--day {
  flex-direction: column;
  justify-content: center;
  gap: 0;
  min-width: 0;
  min-height: 52px;
  padding: 0;
  border-radius: 14px;
}

.cgp-chip--day b {
  font-size: 1rem;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.cgp-chip--day small {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>
