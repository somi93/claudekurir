<template>
  <div class="inbox-empty" role="status">
    <span class="empty-tile" :class="{ 'empty-tile--error': tone === 'error' }">
      <v-icon :icon="icon" size="30" />
    </span>
    <h2 class="empty-title">{{ title }}</h2>
    <p class="empty-copy"><slot /></p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Prazno stanje sandučeta: pločica sa ikonom (isti jezik kao hero kartica na
// početnoj), naslov, objašnjenje i opciona akcija. Namjerno odvojeno od
// GlobalEmptyState, koji je skromniji i koristi se na desetak drugih ekrana.
withDefaults(
  defineProps<{
    icon: string;
    title: string;
    tone?: "info" | "error";
  }>(),
  { tone: "info" }
);
</script>

<style scoped>
.inbox-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 44px 24px 36px;
  text-align: center;
}

.empty-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 6px;
  border-radius: 20px;
  background: #eef4ff;
  color: #2f6fed;
}

.empty-tile--error {
  background: #fde8e6;
  color: #c4281c;
}

.empty-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #0b1220;
}

.empty-copy {
  margin: 0;
  max-width: 300px;
  font-size: 0.86rem;
  line-height: 1.45;
  color: #5b6676;
}

.empty-action {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
</style>
