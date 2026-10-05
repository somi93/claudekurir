<template>
  <div class="global-filter-bar" :class="{ 'global-filter-bar--wrap': wrap }">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Red filter-pill dugmadi (GlobalFilterPill.vue) - zajednička "školjka"
// umesto da se ista .filter-bar klasa/CSS ponavlja po svakom ekranu sa
// filterima (transactions/invoices/payouts/balance-ledger/...). Dva režima:
// - podrazumevano: horizontalni skrol, bez preloma (čist red pilula)
// - wrap: prelama u novi red umesto skrola (kad se u istom redu nalazi i
//   polje za pretragu koje mora da raste preko preostale širine, npr.
//   refunds.vue/courier/history.vue)
withDefaults(defineProps<{ wrap?: boolean }>(), { wrap: false });
</script>

<style scoped>
.global-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.global-filter-bar::-webkit-scrollbar {
  display: none;
}

.global-filter-bar--wrap {
  overflow-x: visible;
  flex-wrap: wrap;
}
</style>
