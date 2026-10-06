<template>
  <div class="fk" role="group" aria-label="Pregled">
    <div class="fk-t" :class="{ 'is-on': filter === 'pending' }">
      <button type="button" class="fk-b" data-kpi="pending" :aria-pressed="filter === 'pending'" @click="emit('kpi', 'pending')">
        <span class="l">Čeka potvrdu</span>
        <template v-if="pendingKnown">
          <template v-if="counts.pendingN">
            <span class="v">{{ amount(counts.pendingSum) }} <i>{{ currency }}</i></span>
            <span class="s">
              {{ handoversText(counts.pendingN) }}<span class="x"> · najstarija
                <span :class="{ bad: counts.oldestOverdue }">{{ oldest }}</span></span>
            </span>
          </template>
          <template v-else>
            <span class="v">Nema</span>
            <span class="s">Sve predaje su potvrđene</span>
          </template>
        </template>
        <template v-else>
          <span class="v">—</span>
          <span class="s warn">Nije učitano</span>
        </template>
      </button>
    </div>

    <div class="fk-t" :class="{ 'is-on': filter === 'debt' }">
      <button type="button" class="fk-b" data-kpi="debt" :aria-pressed="filter === 'debt'" @click="emit('kpi', 'debt')">
        <span class="l">Duguju firmi</span>
        <template v-if="balancesKnown">
          <span class="v">{{ amount(counts.sumCash) }} <i>{{ currency }}</i></span>
          <span class="s">
            {{ couriersText(counts.debt) }}<template v-if="cashLimit != null && counts.over"> · <span class="bad">{{ counts.over }} preko limita</span></template><span v-if="cashLimit != null && counts.near" class="x"> · <span class="warn">{{ counts.near }} blizu</span></span>
          </span>
        </template>
        <template v-else>
          <span class="v">—</span>
          <span class="s warn">Nije učitano</span>
        </template>
      </button>
    </div>

    <div class="fk-t" :class="{ 'is-on': filter === 'wage' }">
      <button type="button" class="fk-b" data-kpi="wage" :aria-pressed="filter === 'wage'" @click="emit('kpi', 'wage')">
        <span class="l">Za isplatu</span>
        <template v-if="balancesKnown">
          <span class="v">{{ amount(counts.sumWage) }} <i>{{ currency }}</i></span>
          <span class="s">{{ couriersText(counts.wage) }}</span>
        </template>
        <template v-else>
          <span class="v">—</span>
          <span class="s warn">Nije učitano</span>
        </template>
      </button>
      <button v-if="balancesKnown && counts.wage > 0" type="button" class="fk-go" data-kpi="batch" @click="emit('batch')">
        Isplati sve<span class="x"> ({{ counts.wage }})</span>
        <v-icon icon="mdi-chevron-right" size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ageText, couriersText, handoversText, type CashCounts, type CashFilter } from "~/utils/cashDesk";

// Tri pločice: šta čeka (predaje), ko duguje firmi (uz broj onih preko limita) i šta se duguje kuriru
// (zarada). Svaka je i filter spiska; druga pritisnuta je gasi. Brojevi su iz cijele knjige. Pločica koja
// ne zna (izvor nije stigao) piše "Nije učitano", a ne nulu. Zarada i gotovina se nikad ne sabiraju.
const props = defineProps<{
  counts: CashCounts;
  currency: string;
  cashLimit: number | null;
  filter: CashFilter;
  pendingKnown: boolean;
  balancesKnown: boolean;
  now: number;
}>();

const emit = defineEmits<{ kpi: ["pending" | "debt" | "wage"]; batch: [] }>();

const amount = (v: number) => v.toFixed(2);
const oldest = computed(() => (props.counts.oldestAt ? ageText(props.counts.oldestAt, props.now) : ""));
</script>

<style scoped>
.fk {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.fk-t {
  display: grid;
  gap: 2px;
  align-content: start;
  min-width: 0;
  padding: 12px 14px 10px;
  border: 1.5px solid transparent;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 20px rgba(11, 18, 32, 0.05);
}

.fk-t.is-on {
  border-color: #2f6fed;
  background: #eef4ff;
}

.fk-b {
  display: grid;
  gap: 2px;
  align-content: start;
  width: 100%;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.fk-b:focus-visible,
.fk-go:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 4px;
  border-radius: 8px;
}

.l {
  font-size: 0.8rem;
  font-weight: 700;
  color: #5b6676;
}

.v {
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.v i {
  font-size: 0.9rem;
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0;
  color: #5b6676;
}

.s {
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
  color: #5b6676;
}

.s .bad {
  font-weight: 800;
  color: #b42318;
}

.s .warn,
.s.warn {
  font-weight: 800;
  color: #8f4406;
}

.fk-go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  min-height: 44px;
  margin: 0 -6px -6px;
  padding: 0 6px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

@media (max-width: 700px) {
  .fk {
    gap: 8px;
  }

  .fk-t {
    padding: 10px 10px 8px;
    border-radius: 16px;
  }

  .l,
  .s {
    font-size: 0.74rem;
  }

  .v {
    font-size: 1.15rem;
  }

  .v i {
    font-size: 0.74rem;
  }

  .x {
    display: none;
  }
}
</style>
