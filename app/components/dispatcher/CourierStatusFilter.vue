<template>
  <div class="status-filter">
    <button
      v-for="pill in pills"
      :key="pill.key"
      type="button"
      class="status-chip"
      :class="{ active: modelValue === pill.key }"
      :style="{ '--chip-color': pill.color, '--chip-tint': `${pill.color}14` }"
      @click="emit('update:modelValue', pill.key)"
    >
      <span class="chip-dot" :style="{ background: pill.color }" />
      <span class="chip-value">{{ pill.value }}</span>
      <span class="chip-label">{{ pill.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { CourierState } from "~/utils/courierStatus";

type FilterKey = "all" | CourierState;

defineProps<{
  modelValue: FilterKey;
  pills: { key: FilterKey; label: string; value: number; color: string }[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: FilterKey];
}>();
</script>

<style scoped>
.status-filter {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 600px) {
  .status-filter {
    display: flex;
    flex-wrap: wrap;
  }
}

.status-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 14px;
  border: 1.5px solid var(--line, #eceef2);
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

@media (min-width: 600px) {
  .status-chip {
    flex: 0 1 auto;
    min-width: 148px;
  }
}

.status-chip:hover {
  border-color: #d7dce6;
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip-value {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--ink, #0b1220);
}

.chip-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--ink-faint, #9aa4b2);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-chip.active {
  border-color: var(--chip-color);
  background: var(--chip-tint);
  box-shadow: 0 4px 14px var(--chip-tint);
}

.status-chip.active .chip-value,
.status-chip.active .chip-label {
  color: var(--chip-color);
}
</style>
