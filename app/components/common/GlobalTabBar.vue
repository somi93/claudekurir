<template>
  <div class="global-tab-bar" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="tab-pill"
      :class="{ 'tab-pill--active': modelValue === tab.value }"
      role="tab"
      :aria-selected="modelValue === tab.value"
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
export interface GlobalTabBarItem<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  badge?: string | number;
  badgeColor?: string;
}

defineProps<{
  modelValue: T;
  tabs: GlobalTabBarItem<T>[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: T];
}>();
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

@media (max-width: 560px) {
  .global-tab-bar {
    border-radius: 16px;
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
