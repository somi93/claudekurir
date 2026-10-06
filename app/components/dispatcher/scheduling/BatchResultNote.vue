<template>
  <TintAlert :tone="failedCount ? 'bad' : 'ok'" role="alert" :title="title">
    <template v-if="failedCount">
      <template v-for="line in lines.slice(0, 4)" :key="line">{{ line }}<br /></template>
      <template v-if="lines.length > 4">… i još {{ lines.length - 4 }}</template>
    </template>
    <template v-else>Sve smjene su napravljene.</template>
    <template v-if="skipped">
      <br />Preskočeno {{ skipped }} jer već postoje.
    </template>
  </TintAlert>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";

// Ishod pravljenja više smjena: koliko je napravljeno, koliko nije (sa razlogom po smjeni) i koliko je
// preskočeno jer već postoje. Ostaje u listu dok se ne zatvori, da se vidi šta tačno nije uspjelo.
const props = defineProps<{ created: number; failedCount: number; lines: string[]; skipped: number }>();

const title = computed(() =>
  props.failedCount ? `Napravljeno ${props.created}, neuspjelo ${props.failedCount}` : `Napravljeno ${props.created}`
);
</script>
