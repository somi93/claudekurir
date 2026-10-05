<template>
  <div class="empty-state">
    <v-icon v-if="icon" :icon="icon" size="32" class="empty-icon" />
    <p v-if="title" class="empty-title">{{ title }}</p>
    <p class="empty-copy"><slot /></p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string;
  title?: string;
}>();
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 28px 16px;
}

.empty-icon {
  color: #c7ccd6;
}

.empty-title {
  margin: 2px 0 0;
  font-weight: 700;
  color: #0b1220;
}

.empty-copy {
  margin: 0;
  color: #9aa4b2;
  font-size: 0.85rem;
  max-width: 320px;
}

.empty-action {
  margin-top: 6px;
}
</style>
