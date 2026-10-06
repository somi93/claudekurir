<template>
  <TintAlert v-if="impact.level === 'none'" tone="info" title="Procjena iz smjena">
    Sada nijedna smjena ne traje, pa se posljedica ne može procijeniti.
  </TintAlert>
  <TintAlert v-else-if="impact.level === 'zero'" tone="bad" role="alert" title="Nijedan kurir nije potvrđen">
    U smjenama koje sada traju nema nijednog potvrđenog kurira. Ako uključiš provjeru, firma neće moći da dodijeli nijednu
    narudžbu.
    <template v-if="lines"><br /><span class="ei-lines">{{ lines }}</span></template>
  </TintAlert>
  <TintAlert v-else-if="impact.level === 'partial'" tone="warn" :title="`Procjena iz smjena: ${confirmed}`">
    {{ impact.zeroShifts }} od {{ impact.inProgress }} {{ plural(impact.inProgress, "smjene", "smjene", "smjena") }} koje sada traju nema
    nijednog potvrđenog kurira.
    <template v-if="lines"><br /><span class="ei-lines">{{ lines }}</span></template>
  </TintAlert>
  <TintAlert v-else tone="ok" :title="`Procjena iz smjena: ${confirmed}`">
    Svaka smjena koja sada traje ima potvrđenih kurira.
    <template v-if="lines"><br /><span class="ei-lines">{{ lines }}</span></template>
  </TintAlert>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { plural, type EnforceImpact } from "~/utils/schedule";

// Šta bi uključivanje provjere dostupnosti značilo sada: procjena iz smjena koje traju (zbir potvrđenih). Server
// odlučuje po potvrđenim terminima kurira, pa se na ekranu uvijek piše "procjena".
const props = defineProps<{ impact: EnforceImpact }>();

const confirmed = computed(
  () => `${props.impact.booked} ${plural(props.impact.booked, "potvrđen kurir", "potvrđena kurira", "potvrđenih kurira")}`
);
const lines = computed(() => props.impact.lines.map((l) => `${l.zone} ${l.win}: ${l.booked} od ${l.target}`).join(" · "));
</script>

<style scoped>
.ei-lines {
  font-size: 0.82rem;
}
</style>
