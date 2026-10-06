<template>
  <li>
    <button
      type="button"
      class="br"
      :class="{ 'is-sel': selected, 'is-flash': flash }"
      :data-row="`row:${row.id}`"
      :tabindex="tabbable ? 0 : -1"
      :aria-current="selected ? 'true' : undefined"
      :aria-label="`${aria}. Otvori detalje`"
      @click="emit('open')"
    >
      <span class="br-av" :class="row.level === 'over' ? 'br-av--bad' : row.level === 'near' ? 'br-av--warn' : ''" aria-hidden="true">
        {{ row.initials }}
      </span>
      <span class="br-tx">
        <span class="br-nm">{{ row.name }}</span>
        <span class="br-meta">
          <template v-if="row.cash > 0 && cashLimit != null && row.pct != null">
            <span class="br-m" :class="`br-m--${row.level}`" role="img" :aria-label="`${row.pctRaw}% limita gotovine`">
              <i :style="{ width: `${row.pct}%` }" />
            </span>
            <span class="br-t">{{ row.pctRaw }}%</span>
          </template>
          <span v-if="row.level === 'over'" class="br-pill br-pill--bad">Preko limita</span>
          <span v-else-if="row.level === 'near'" class="br-pill br-pill--warn">Blizu limita</span>
          <span v-if="row.pending.length" class="br-pill br-pill--blue">Čeka {{ formatAmount(row.pendingSum, currency) }}</span>
          <span v-if="row.suspended" class="br-pill br-pill--idle">Suspendovan</span>
          <span v-if="!row.inFirm" class="br-pill br-pill--idle">Nije u firmi</span>
          <span v-if="row.cash < 0" class="br-pill br-pill--ok">Firma duguje gotovinu</span>
        </span>
      </span>
      <span class="br-am" aria-hidden="true">
        <span>
          <small>Gotovina</small>
          <b :class="cashClass">{{ formatAmount(row.cash, currency) }}</b>
        </span>
        <span>
          <small>Zarada</small>
          <b :class="{ zero: !(row.wage > 0) }">{{ formatAmount(row.wage, currency) }}</b>
        </span>
      </span>
    </button>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CashRow } from "~/utils/cashDesk";
import { formatAmount } from "~/utils/currency";

// Red spiska: avatar, ime, mjerač limita sa oznakama i dva računa (gotovina i zarada, nikad zbrojeni).
// Cio red je jedno dugme i jedino je zaustavljanje tastera Tab (roving tabindex: strelice po spisku).
// Čitač ekrana dobije cijelu rečenicu ("Amir Hodžić. Gotovina 180.70 KM, zarada 6.00 KM. Blizu limita...").
const props = defineProps<{
  row: CashRow;
  currency: string;
  cashLimit: number | null;
  selected: boolean;
  flash: boolean;
  tabbable: boolean;
}>();

const emit = defineEmits<{ open: [] }>();

const cashClass = computed(() => {
  const r = props.row;
  return r.level === "over" ? "over" : r.level === "near" ? "near" : r.cash < 0 ? "cr" : r.cash === 0 ? "zero" : "";
});

const aria = computed(() => {
  const r = props.row;
  const bits = [`${r.name}. Gotovina ${formatAmount(r.cash, props.currency)}, zarada ${formatAmount(r.wage, props.currency)}.`];
  if (r.level === "over") bits.push("Preko limita.");
  else if (r.level === "near") bits.push("Blizu limita.");
  if (r.pending.length) bits.push(`Čeka potvrdu ${formatAmount(r.pendingSum, props.currency)}.`);
  if (r.suspended) bits.push("Suspendovan.");
  if (!r.inFirm) bits.push("Nije u firmi.");
  return bits.join(" ");
});
</script>

<style scoped>
.br {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 72px;
  padding: 10px 14px;
  border: 0;
  border-top: 1px solid #eceef2;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

li:first-child > .br {
  border-top: 0;
}

.br:hover {
  background: #fafbfc;
}

.br.is-sel {
  background: #f5f6f8;
  box-shadow: inset 3px 0 0 #0b1220;
}

.br:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.br.is-flash {
  animation: br-fl 1.6s ease;
}

@keyframes br-fl {
  0% {
    box-shadow: inset 0 0 0 3px rgba(47, 111, 237, 0.9);
  }
  60% {
    box-shadow: inset 0 0 0 3px rgba(47, 111, 237, 0.5);
  }
  100% {
    box-shadow: inset 0 0 0 3px rgba(47, 111, 237, 0);
  }
}

.br-av {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #eceff3;
  color: #2a3342;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.br-av--bad {
  background: #fde8e6;
  color: #7a1810;
}

.br-av--warn {
  background: #fff2df;
  color: #8f4406;
}

.br-tx {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.br-nm {
  overflow: hidden;
  font-size: 0.95rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.br-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
}

.br-t {
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.br-m {
  position: relative;
  display: inline-block;
  flex: none;
  width: 84px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e8ed;
}

.br-m i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: #1f9d6b;
}

.br-m--near i {
  background: #e08a14;
}

.br-m--over i {
  background: #e5484d;
}

.br-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.br-pill--bad {
  background: #fde8e6;
  color: #9a1b11;
}

.br-pill--warn {
  background: #fff2df;
  color: #8f4406;
}

.br-pill--ok {
  background: #e3f8ef;
  color: #04694a;
}

.br-pill--blue {
  background: #eef4ff;
  color: #2459c7;
}

.br-pill--idle {
  background: #eceff3;
  color: #46505f;
}

.br-am {
  display: grid;
  gap: 1px;
  min-width: 96px;
  justify-items: end;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.br-am > span {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.br-am small {
  font-size: 0.72rem;
  font-weight: 600;
  color: #5b6676;
}

.br-am b {
  font-size: 0.95rem;
  font-weight: 800;
}

.br-am .over {
  color: #b42318;
}

.br-am .near {
  color: #8f4406;
}

.br-am .cr {
  color: #00734f;
}

.br-am .zero {
  font-weight: 700;
  color: #5b6676;
}

@media (prefers-reduced-motion: reduce) {
  .br.is-flash {
    animation: none;
  }
}
</style>
