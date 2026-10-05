<template>
  <header class="page-header">
    <div class="page-header-row">
      <BackButton :to="backTo" :label="backLabel" :intercept="interceptBack" @back="emit('back')" />
      <span class="page-heading">
        <span class="page-title" role="heading" aria-level="1">{{ title }}</span>
        <span v-if="$slots.subtitle" class="page-subtitle" aria-live="polite">
          <slot name="subtitle" />
        </span>
      </span>
      <span class="header-spacer" />
      <slot name="actions" />
    </div>
    <!-- Drugi red zaglavlja (npr. filter čipovi) - lijepi se uz naslov kad se skroluje. -->
    <div v-if="$slots.below" class="page-header-below">
      <slot name="below" />
    </div>
  </header>
</template>

<script setup lang="ts">
import BackButton from "./BackButton.vue";

withDefaults(
  defineProps<{
    title: string;
    backTo: string;
    backLabel?: string;
    // Strelica ne vodi na backTo nego javi `back`; stranica sama odlučuje šta je "nazad".
    interceptBack?: boolean;
  }>(),
  { backLabel: "Nazad", interceptBack: false }
);

const emit = defineEmits<{ back: [] }>();
</script>

<style scoped>
.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(245, 246, 248, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e7e9ee;
}

.page-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.page-heading {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}

.page-title {
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
  color: #0b1220;
}

.page-subtitle {
  margin-top: 2px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #657083;
}

.header-spacer {
  flex: 1;
}

.page-header-below {
  padding: 0 16px 12px;
}
</style>
