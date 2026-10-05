<template>
  <div class="dl-panel">
    <div class="dl-sheet-in">
      <div class="dl-done">
        <div class="dl-done-ic"><v-icon icon="mdi-check" size="38" /></div>
        <div class="dl-title" role="status">Dostavljeno</div>
        <div class="dl-sub">Narudžba #{{ orderId }} je završena.</div>
        <div v-if="wage !== null || collected !== null" class="dl-chips">
          <span v-if="wage !== null" class="dl-chip dl-chip--ok">
            <v-icon icon="mdi-cash-multiple" size="16" /> +{{ formatAmount(wage) }} zarada
          </span>
          <span v-if="collected !== null" class="dl-chip">
            <v-icon icon="mdi-cash" size="16" /> Naplaćeno {{ formatAmount(collected) }} · predaj pazar
          </span>
        </div>
      </div>
      <button type="button" class="dl-btn dl-btn--green" @click="emit('continue')">
        {{ hasNext ? "Sljedeća dostava" : "Nastavi" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatAmount } from "~/utils/currency";

// Kratak završetak: zarada i podsjetnik da se preda pazar. Iznosi dolaze iz
// /earnings (zarada po narudžbi) - ako još nisu stigli, panel pokaže samo potvrdu.
defineProps<{
  orderId: number;
  wage: number | null;
  // Koliko je naplaćeno od kupca (hrana + dostava); prikazuje se samo ako je > 0.
  collected: number | null;
  hasNext: boolean;
}>();

const emit = defineEmits<{
  continue: [];
}>();
</script>
