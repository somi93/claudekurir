<template>
  <div
    class="global-tab-bar"
    :class="`global-tab-bar--${variant}`"
    role="tablist"
    :aria-label="label"
    @keydown="onKey"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="tab-pill"
      :class="{ 'tab-pill--active': modelValue === tab.value }"
      role="tab"
      :id="idBase ? `${idBase}-tab-${tab.value}` : undefined"
      :aria-selected="modelValue === tab.value"
      :aria-controls="panelId"
      :tabindex="modelValue === tab.value ? 0 : -1"
      :data-tab="tab.value"
      @click="emit('update:modelValue', tab.value)"
    >
      <v-icon v-if="tab.icon" :icon="tab.icon" size="20" />
      <span class="tab-pill-label">{{ tab.label }}</span>
      <span
        v-if="tab.badge !== undefined && tab.badge !== null"
        class="tab-pill-badge"
        :style="tab.badgeColor ? { background: tab.badgeColor } : undefined"
      >
        {{ tab.badge }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { nextTick } from "vue";

export interface GlobalTabBarItem<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  badge?: string | number;
  badgeColor?: string;
}

// Tabovi (role=tablist): samo aktivan tab je u redoslijedu tastera Tab, strelice, Home i End
// prebacuju tab i fokus. `variant="pills"` je niži (44 px) red pilula sa brojem uz naziv (Firma);
// zadano je široka traka sa ikonom iznad naziva. `idBase` + `panelId` povezuju tab sa panelom
// (aria-controls); panel dobija aria-labelledby = `${idBase}-tab-${vrijednost}`.
const props = withDefaults(
  defineProps<{
    modelValue: T;
    tabs: GlobalTabBarItem<T>[];
    variant?: "bar" | "pills";
    label?: string;
    idBase?: string;
    panelId?: string;
  }>(),
  { variant: "bar", label: undefined, idBase: undefined, panelId: undefined }
);

const emit = defineEmits<{
  "update:modelValue": [value: T];
}>();

const onKey = (event: KeyboardEvent) => {
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key) || props.tabs.length === 0) return;
  event.preventDefault();
  const total = props.tabs.length;
  const index = Math.max(
    0,
    props.tabs.findIndex((t) => t.value === props.modelValue)
  );
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? total - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + total) % total;
  const tab = props.tabs[next];
  if (!tab) return;
  emit("update:modelValue", tab.value);
  const root = event.currentTarget as HTMLElement | null;
  void nextTick(() => root?.querySelector<HTMLElement>(`[data-tab="${tab.value}"]`)?.focus());
};
</script>

<style scoped>
.global-tab-bar {
  display: flex;
  gap: 4px;
  padding: 6px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.tab-pill {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 56px;
  padding: 10px 6px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: #6b7685;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.tab-pill:hover {
  background: #f5f6f8;
}

.tab-pill--active {
  background: #eef4ff;
  color: #2f6fed;
}

.tab-pill-label {
  display: block;
  text-align: center;
  overflow-wrap: anywhere;
}

.tab-pill-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #0b1220;
  color: #fff;
  font-size: 0.64rem;
  font-weight: 700;
}

.tab-pill:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

/* Pilule (Firma): niži red, naziv i broj uz njega; isti jezik kao filter pilule u Kuriri. */
.global-tab-bar--pills {
  gap: 8px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow-x: auto;
  scrollbar-width: none;
}

.global-tab-bar--pills::-webkit-scrollbar {
  display: none;
}

.global-tab-bar--pills .tab-pill {
  flex: none;
  flex-direction: row;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1.5px solid #e2e5ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font-size: 0.88rem;
  white-space: nowrap;
}

.global-tab-bar--pills .tab-pill:hover {
  border-color: #c7ccd4;
  background: #fff;
}

.global-tab-bar--pills .tab-pill--active {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.global-tab-bar--pills .tab-pill-badge {
  position: static;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.global-tab-bar--pills .tab-pill--active .tab-pill-badge {
  background: #2f6fed;
}

@media (max-width: 560px) {
  .global-tab-bar {
    border-radius: 16px;
  }

  .global-tab-bar--pills {
    border-radius: 0;
  }

  .global-tab-bar--pills .tab-pill {
    min-height: 44px;
    padding: 0 14px;
    font-size: 0.86rem;
  }

  .tab-pill {
    font-size: 0.7rem;
    padding: 8px 3px;
    min-height: 52px;
  }

  .tab-pill :deep(.v-icon) {
    font-size: 18px !important;
  }
}

@media (max-width: 380px) {
  .tab-pill {
    font-size: 0.66rem;
    padding: 8px 2px;
  }
}
</style>
