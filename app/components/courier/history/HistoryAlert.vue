<template>
  <div class="ha" role="alert">
    <v-icon icon="mdi-alert-outline" size="22" />
    <div>
      <b>{{ title }}</b>
      <slot />
      <button type="button" @click="emit('retry')">Pokušaj ponovo</button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Upozorenje na vrhu Istorije kad jedan od dva izvora (istorija ili zarada) nije stigao:
// ekran radi sa onim što ima, a ovdje piše šta fali i nudi ponovni pokušaj. Tamni tekst
// na jantarnoj podlozi (PageAlert "warning" daje narandžast tekst slabog kontrasta).
defineProps<{ title: string }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<style scoped>
.ha {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  padding: 11px 12px;
  border-radius: 14px;
  background: #fff2df;
  color: #5c3305;
  font-size: 0.84rem;
  line-height: 1.4;
}

.ha :deep(.v-icon) {
  color: #9a4a07;
}

.ha b {
  display: block;
}

.ha button {
  display: block;
  margin-top: 6px;
  padding: 2px 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 800;
  color: #9a4a07;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.ha button:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
