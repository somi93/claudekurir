<template>
  <WalletSheet :open="open" title="Kako radi novčanik" @update:open="emit('update:open', $event)">
    <div class="hlp">
      <div v-for="item in items" :key="item.title" class="hlp-i">
        <span class="ico"><v-icon :icon="item.icon" size="20" /></span>
        <div>
          <b>{{ item.title }}</b>
          <p>{{ item.text }}</p>
        </div>
      </div>
    </div>
  </WalletSheet>
</template>

<script setup lang="ts">
import WalletSheet from "~/components/courier/wallet/WalletSheet.vue";

// Objašnjenje dva računa i šta ulazi u dug - jedno mjesto umjesto tri ponovljena objašnjenja.
// "Šta ulazi u dug" važi za dostave koje kurir plaća restoranu iz svog džepa; to pravilo je za
// sada izvedeno iz stanja na nalogu i čeka potvrdu backenda (stavka N1, dokument od 04.10.).
defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const items = [
  {
    icon: "mdi-cash",
    title: "Gotovina: ono što duguješ firmi",
    text: "Kad naplatiš gotovinu od kupca, taj novac nije tvoj nego firme. Predaš ga dispečeru i prijaviš iznos. Kad dispečer potvrdi, dug se smanji.",
  },
  {
    icon: "mdi-calculator-variant-outline",
    title: "Šta ulazi u dug",
    text: "Kad ti platiš restoranu iz svog džepa, hranu ti vraća kupac, pa u dug ulazi samo cijena dostave. Zato dug može biti manji od naplaćenog iznosa.",
  },
  {
    icon: "mdi-cash-multiple",
    title: "Zarada: ono što firma duguje tebi",
    text: "Zaradu ti isplaćuje dispečer, posebno od gotovine. Gotovinu predaješ u cijelosti, nikad se ne umanjuje za zaradu.",
  },
  {
    icon: "mdi-alert-outline",
    title: "Limit gotovine",
    text: "Kad dostigneš limit, firma te može prestati spajati sa porudžbinama koje se plaćaju gotovinom, dok ne predaš pazar.",
  },
];
</script>

<style scoped>
.hlp {
  display: grid;
  gap: 14px;
  padding-bottom: 8px;
}

.hlp-i {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.ico {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #eef4ff;
  color: #2459c7;
}

.hlp-i b {
  display: block;
  font-size: 0.94rem;
}

.hlp-i p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
  color: #5b6676;
}
</style>
