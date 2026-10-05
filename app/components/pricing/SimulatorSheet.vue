<template>
  <AppSheet
    :open="ws.view.simOpen"
    title="Primjer narudžbe"
    :subtitle="ws.price.dirty ? 'Nacrt, nesačuvane izmjene' : undefined"
    @update:open="ws.view.simOpen = $event"
  >
    <!-- Hook za list je unutra, jer VBottomSheet teleportuje svoj korijen izvan stranice. -->
    <div class="ss" data-pricing="sim-sheet">
      <PricingSimulator :ws="ws" bare />
    </div>
  </AppSheet>
</template>

<script setup lang="ts">
import AppSheet from "~/components/common/AppSheet.vue";
import PricingSimulator from "~/components/pricing/PricingSimulator.vue";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";

// Donji list sa Primjerom narudžbe (telefon): isti sadržaj kao desna kolona na računaru, bez kartice.
// Otvara ga traka (SimulatorBar) preko ws.view.simOpen; radni prostor ga gasi kad prozor postane širok.
// Nema vlastitog stanja ni unosa koji se gubi, pa zatvaranje nikad ne pita za nesačuvano.
defineProps<{ ws: PricingWorkspace }>();
</script>

<style scoped>
.ss {
  min-width: 0;
}
</style>
