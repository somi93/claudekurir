<template>
  <div class="ci" aria-live="polite" aria-atomic="true" data-company="impact">
    <TintAlert v-if="state === 'loading'" tone="info" role="status" title="Provjeravam stanje kurira">
      Računam koliko kurira bi odmah bilo preko limita.
    </TintAlert>
    <TintAlert
      v-else-if="state === 'failed'"
      tone="warn"
      icon="mdi-cloud-off-outline"
      title="Ne mogu da izračunam posljedicu"
    >
      Stanje gotovine kurira se trenutno ne učitava. Limit možeš sačuvati i bez ovoga.
    </TintAlert>
    <template v-else-if="impact">
      <TintAlert :tone="impact.tone" :icon="impact.icon" :title="impact.title">
        {{ impact.body }}
      </TintAlert>
      <ul v-if="impact.rows.length" class="ci-list" aria-label="Kuriri koji su preko limita ili blizu njega">
        <li v-for="row in impact.rows" :key="row.id">
          <span class="ci-n">{{ row.name }}</span>
          <span class="ci-m" :class="row.level">{{ formatAmount(row.owed, currency) }}</span>
          <span
            class="ci-bar"
            :class="row.level"
            role="img"
            :aria-label="`${row.percent}% limita${row.level === 'over' ? ', preko limita' : ''}`"
          >
            <i :style="{ width: `${row.percent}%` }" />
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import TintAlert from "~/components/common/TintAlert.vue";
import { formatAmount } from "~/utils/currency";
import type { CashImpact } from "~/utils/companySettings";

// Posljedica limita koji se upravo kuca: tonirana poruka (koliko kurira je preko limita i šta im se
// tada dešava) i do četiri kurira sa trakom. Računa se u utils/companySettings.ts nad stanjem iz
// couriers-balance. Dok se stanje učitava ili ne može da se učita, to se kaže; ništa se ne izmišlja.
defineProps<{
  impact: CashImpact | null;
  state: "loading" | "ready" | "failed";
  currency: string;
}>();
</script>

<style scoped>
.ci {
  display: grid;
  gap: 10px;
}

.ci:empty {
  display: none;
}

.ci-list {
  display: grid;
  margin: 0;
  padding: 2px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  list-style: none;
}

.ci-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 10px;
  align-items: center;
  padding: 9px 0;
  border-top: 1px solid #dfe3ea;
  font-size: 0.86rem;
}

.ci-list li:first-child {
  border-top: 0;
}

.ci-n {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ci-m {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.ci-m.over {
  color: #b42318;
}

.ci-m.near {
  color: #9a4a07;
}

.ci-bar {
  grid-column: 1 / -1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #e3e6ec;
}

.ci-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #2f6fed;
}

.ci-bar.over i {
  background: #e5484d;
}

.ci-bar.near i {
  background: #e08a14;
}
</style>
