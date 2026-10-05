<template>
  <div class="global-page" :style="pageStyle">
    <slot name="header" />
    <div class="global-page-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Zajednicka "skoljka" za dispecerske/restoranske stranice (header + telo sa
// paddingom odgore/sa strane) - ranije je svaka stranica sama ponavljala
// istu X-page/X-body klasu (scheduling-page/scheduling-body, pricing-page/
// pricing-body, ...), uvek istih vrednosti. Padding-bottom za bottom-nav se
// NE dodaje ovde - to je vec resen jednom u app.vue (.page-content--with-nav),
// ne treba duplirati po stranici. Courier ekrani imaju svoj ekvivalent
// (components/layout/DeliveryPage.vue) - odvojen jer nosi vlastite,
// courier-specificne pretpostavke (npr. sopstveni bottom padding).
const props = withDefaults(
  defineProps<{
    maxWidth?: number;
  }>(),
  {
    maxWidth: 1200,
  }
);

const pageStyle = computed(() => ({ "--global-page-max-width": `${props.maxWidth}px` }));
</script>

<style scoped>
.global-page {
  max-width: var(--global-page-max-width);
  margin: 0 auto;
}

.global-page-body {
  padding: 24px 32px;
}

@media (max-width: 960px) {
  .global-page-body {
    padding: 20px;
  }
}

@media (max-width: 600px) {
  .global-page-body {
    padding: 16px 12px;
  }
}
</style>
