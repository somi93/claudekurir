<template>
  <!-- intercept: stranica sama odlučuje šta je "nazad" (npr. detalj kurira na telefonu) -->
  <button v-if="intercept" type="button" class="back-btn" :aria-label="label" @click="emit('back')">
    <v-icon icon="mdi-arrow-left" size="20" />
  </button>
  <NuxtLink v-else :to="to" class="back-btn" :aria-label="label">
    <v-icon icon="mdi-arrow-left" size="20" />
  </NuxtLink>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    to: string;
    label?: string;
    intercept?: boolean;
  }>(),
  { label: "Nazad", intercept: false }
);

const emit = defineEmits<{ back: [] }>();
</script>

<style scoped>
.back-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  border: 0;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.06);
}

/* Meta od 44 px, a izgled ostaje 36 px (isto kao dugme "Osvježi" u Novčaniku). */
.back-btn::after {
  content: "";
  position: absolute;
  inset: -4px;
}
</style>
