<template>
  <div class="global-tab-bar-slide" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="slide-pill"
      :class="{ 'slide-pill--active': modelValue === tab.value }"
      role="tab"
      :aria-selected="modelValue === tab.value"
      @click="emit('update:modelValue', tab.value)"
    >
      <v-icon v-if="tab.icon" :icon="tab.icon" size="20" />
      <span class="slide-pill-label">{{ tab.label }}</span>
      <span
        v-if="tab.badge !== undefined && tab.badge !== null"
        class="slide-pill-badge"
        :style="tab.badgeColor ? { background: tab.badgeColor } : undefined"
      >
        {{ tab.badge }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import type { GlobalTabBarItem } from "./GlobalTabBar.vue";

defineProps<{
  modelValue: T;
  tabs: GlobalTabBarItem<T>[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: T];
}>();
</script>

<style scoped>
.global-tab-bar-slide {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.global-tab-bar-slide::-webkit-scrollbar {
  display: none;
}

.slide-pill {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 56px;
  padding: 10px 16px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: #6b7685;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.slide-pill:hover {
  background: #f5f6f8;
}

.slide-pill--active {
  background: #eef4ff;
  color: #2f6fed;
}

.slide-pill-label {
  display: block;
  text-align: center;
}

.slide-pill-badge {
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
</style>
