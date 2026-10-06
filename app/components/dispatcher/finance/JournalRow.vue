<template>
  <li>
    <button
      type="button"
      class="jr"
      :data-journal="`row:${row.key}`"
      :tabindex="tabbable ? 0 : -1"
      :aria-label="aria"
      @click="emit('open')"
    >
      <span class="ji" :class="icon.cls" aria-hidden="true"><v-icon :icon="icon.name" size="20" /></span>
      <span class="c1">
        <b>{{ row.name }}</b>
        <small>{{ kindText }} · {{ hm(row.at) }}</small>
      </span>
      <span class="c2">
        <b>{{ formatAmount(row.amount, currency) }}</b>
        <small v-if="isDiff" class="d">prijavljeno {{ (row.reported ?? 0).toFixed(2) }} · razlika {{ signed(row.diff, currency) }}</small>
        <small v-else-if="wait">prijavljeno</small>
        <small v-else-if="row.kind === 'payout' && row.method">{{ METHOD_LABELS[row.method] }}</small>
      </span>
      <span class="c3">
        <template v-if="row.kind === 'payout'">
          <span class="pill pill--blue">Isplaćeno</span>
          <span v-if="row.method" class="pill pill--idle">{{ METHOD_LABELS[row.method] }}</span>
        </template>
        <template v-else-if="wait">
          <span class="pill pill--warn">Na čekanju</span>
          <span>{{ ageText(row.reportedAt ?? row.at, now) }}</span>
        </template>
        <template v-else>
          <span class="pill pill--ok">Potvrđeno</span>
          <span v-if="row.by">Potvrdio {{ row.by }}</span>
        </template>
      </span>
      <span class="ch" aria-hidden="true"><v-icon icon="mdi-chevron-right" size="20" /></span>
    </button>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { METHOD_LABELS, ageText, dateTimeShort, hm, isDiffRow, signed, type JournalRow } from "~/utils/cashDesk";
import { formatAmount } from "~/utils/currency";

// Red prometa: ikona vrste, ime i vrijeme, iznos (uz razliku: "prijavljeno 97.79 · razlika −5.00 KM"),
// status i ko je potvrdio ili način isplate. Jedan je stop za Tab (strelice po spisku), Enter otvara stavku.
const props = defineProps<{ row: JournalRow; currency: string; now: number; tabbable: boolean }>();
const emit = defineEmits<{ open: [] }>();

const wait = computed(() => props.row.kind === "handover" && props.row.status !== "confirmed");
const isDiff = computed(() => isDiffRow(props.row));

const icon = computed(() =>
  props.row.kind === "payout"
    ? { cls: "out", name: "mdi-cash-minus" }
    : wait.value
      ? { cls: "wait", name: "mdi-timer-sand" }
      : { cls: "in", name: "mdi-cash-plus" }
);

const kindText = computed(() => (props.row.kind === "payout" ? "Isplata zarade" : wait.value ? "Predaja čeka potvrdu" : "Predaja gotovine"));

const aria = computed(() => {
  const r = props.row;
  return `${kindText.value}: ${r.name}, ${formatAmount(r.amount, props.currency)}, ${dateTimeShort(r.at)}${r.diff ? `, razlika ${signed(r.diff, props.currency)}` : ""}. Otvori stavku`;
});
</script>

<style scoped>
.jr {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr) 20px;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 64px;
  padding: 10px 14px;
  border: 0;
  border-top: 1px solid #eceef2;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

li:first-child > .jr {
  border-top: 0;
}

.jr:hover {
  background: #fafbfc;
}

.jr:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.ji {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.ji.in {
  background: #e3f8ef;
  color: #00734f;
}

.ji.out {
  background: #eef4ff;
  color: #2459c7;
}

.ji.wait {
  background: #fff2df;
  color: #8f4406;
}

.c1,
.c2 {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.c1 b {
  overflow: hidden;
  font-size: 0.92rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c1 small,
.c2 small {
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
}

.c2 {
  font-variant-numeric: tabular-nums;
}

.c2 b {
  font-size: 0.98rem;
  font-weight: 800;
}

.c2 small.d {
  font-weight: 800;
  color: #8f4406;
}

.c3 {
  display: grid;
  gap: 3px;
  justify-items: start;
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
}

.pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.pill--warn {
  background: #fff2df;
  color: #8f4406;
}

.pill--ok {
  background: #e3f8ef;
  color: #04694a;
}

.pill--blue {
  background: #eef4ff;
  color: #2459c7;
}

.pill--idle {
  background: #eceff3;
  color: #46505f;
}

.ch {
  color: #657083;
}

@media (max-width: 700px) {
  .jr {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    row-gap: 2px;
  }

  .c3 {
    grid-column: 2 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
  }

  .ch {
    display: none;
  }

  .c2 {
    justify-items: end;
    text-align: right;
  }
}
</style>
