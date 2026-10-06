<template>
  <div class="jt">
    <div class="jt-bar">
      <div class="jt-line">
        <div class="jt-fbar" role="group" aria-label="Period">
          <button
            v-for="(label, key) in PERIODS"
            :key="key"
            type="button"
            class="jt-fp"
            :aria-pressed="period === key"
            :data-period="key"
            @click="emit('period', key)"
          >
            {{ label }}
          </button>
        </div>
        <div class="jt-fbar" role="group" aria-label="Vrsta">
          <button
            v-for="[key, label] in TYPES"
            :key="key"
            type="button"
            class="jt-fp"
            :aria-pressed="type === key"
            :data-type="key"
            @click="emit('type', key)"
          >
            {{ label }}
          </button>
          <button type="button" class="jt-fp" :aria-pressed="diffOnly" data-diff @click="emit('diff')">
            Samo razlike <span class="n">{{ diffCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="period === 'custom'" class="jt-dates">
        <label>
          Od
          <input type="date" :value="range.from" :max="today" data-date="from" @change="onDate('from', $event)" />
        </label>
        <label>
          Do
          <input type="date" :value="range.to" :max="today" data-date="to" @change="onDate('to', $event)" />
        </label>
      </div>

      <div class="jt-r">
        <button type="button" class="jt-fp" aria-haspopup="dialog" data-journal="courier" @click="emit('courier')">
          <v-icon icon="mdi-account-outline" size="18" />{{ courierName || "Svi kuriri" }}<v-icon icon="mdi-chevron-down" size="16" />
        </button>
        <button v-if="courierName" type="button" class="jt-x" data-journal="courier-clear" aria-label="Ukloni filter kurira" @click="emit('courierClear')">
          <v-icon icon="mdi-close" size="18" />
        </button>
        <span class="jt-sp" />
        <button type="button" class="jt-btn" data-journal="csv" :disabled="!rows.length" @click="emit('csv')">
          <v-icon icon="mdi-download-outline" size="18" />Izvezi CSV
        </button>
      </div>
    </div>

    <section v-if="state === 'loading' || state === 'idle'" class="jt-card" aria-busy="true" aria-label="Učitavam promet">
      <div v-for="n in 5" :key="n" class="jt-sk" aria-hidden="true"><i class="b a" /><i class="b m" /><i class="b c" /></div>
    </section>

    <TintAlert v-else-if="state === 'error'" tone="bad" role="alert" icon="mdi-cloud-off-outline" title="Ne mogu da učitam promet">
      {{ error || "Server ne odgovara." }} Zbirovi i spisak nisu pouzdani dok se ne učitaju.
      <template #action>
        <button type="button" data-journal="retry" @click="emit('retry')">Pokušaj ponovo</button>
      </template>
    </TintAlert>

    <template v-else>
      <TintAlert v-if="failed" tone="warn" role="status" icon="mdi-alert-outline" title="Osvježavanje nije uspjelo">
        Prikazan je zadnji učitan promet.
        <template #action>
          <button type="button" data-journal="retry" @click="emit('retry')">Pokušaj ponovo</button>
        </template>
      </TintAlert>

      <div class="jt-tot" role="group" aria-label="Zbirovi za izabrani period">
        <div>
          <span class="l">Potvrđene predaje</span>
          <span class="v">{{ amount(totals.inSum) }} <i>{{ currency }}</i></span>
          <span class="s">{{ handoversText(totals.inN) }}{{ totals.pendingN ? ` · ${totals.pendingN} na čekanju` : "" }}</span>
        </div>
        <div>
          <span class="l">Isplate zarade</span>
          <span class="v">{{ amount(totals.outSum) }} <i>{{ currency }}</i></span>
          <span class="s">{{ totals.outN }} {{ pluralizeSr(totals.outN, "isplata", "isplate", "isplata") }}</span>
        </div>
        <div>
          <span class="l">Razlika prijava i potvrda</span>
          <template v-if="totals.diffN">
            <span class="v">{{ signed(totals.diffSum, "").trim() }} <i>{{ currency }}</i></span>
            <span class="s">{{ handoversText(totals.diffN) }} sa razlikom</span>
          </template>
          <template v-else>
            <span class="v">Nema razlika</span>
            <span class="s">Prijavljeno i potvrđeno se poklapa</span>
          </template>
        </div>
      </div>
      <p class="jt-note">
        Zbir je za predaje i isplate koje server vraća za {{ dayKeyShort(range.from) }} – {{ dayKeyShort(range.to) }}. Direktno
        evidentirane uplate su u njemu samo ako ih server vraća kao predaje.
      </p>

      <section v-if="!rows.length" class="jt-card">
        <div class="jt-empty">
          <v-icon icon="mdi-history" size="32" />
          <b>Nema prometa</b>
          <span>Nema predaja ni isplata za izabrani period i filtere.</span>
          <button type="button" class="jt-btn" data-journal="reset" @click="emit('reset')">Poništi filtere</button>
        </div>
      </section>

      <template v-else>
        <div v-for="g in groups" :key="g.key">
          <div class="jt-day">
            <span class="d">{{ g.label }}</span>
            <span>
              {{ g.inSum ? `predaje ${money(g.inSum, currency)}` : "" }}{{ g.inSum && g.outSum ? " · " : ""
              }}{{ g.outSum ? `isplate ${money(g.outSum, currency)}` : "" }}{{ !g.inSum && !g.outSum ? `${g.rows.length} ${pluralizeSr(g.rows.length, "stavka", "stavke", "stavki")}` : "" }}
            </span>
          </div>
          <section class="jt-card" @keydown="onListKey">
            <ul :aria-label="g.label">
              <JournalRow
                v-for="x in g.rows"
                :key="x.key"
                :row="x"
                :currency="currency"
                :now="now"
                :tabbable="x.key === tabKey"
                @open="emit('open', x.key)"
              />
            </ul>
          </section>
        </div>
        <div v-if="rows.length > shown" class="jt-more">
          <button type="button" class="jt-btn" data-journal="more" @click="emit('more')">Prikaži još ({{ rows.length - shown }})</button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import JournalRow from "~/components/dispatcher/finance/JournalRow.vue";
import {
  PERIODS,
  dayKey,
  dayKeyShort,
  groupDays,
  handoversText,
  journalTotals,
  money,
  signed,
  type JournalPeriod,
  type JournalRow as Row,
  type JournalType,
} from "~/utils/cashDesk";
import { pluralizeSr } from "~/utils/datetime";
import type { JournalState } from "~/composables/useCashJournal";

// Tab Promet: predaje i isplate u jednom toku, najnovije prvo, po danima. Period, vrsta, "Samo razlike" i
// kurir su u pilulama; iznad toka su zbirovi za ono što je prikazano. Prikazuje se `shown` stavki ("Prikaži
// još" dodaje). Pad se piše u mjestu zbirova i toka, nikad kao "Nema prometa".
const props = defineProps<{
  state: JournalState;
  failed: boolean;
  error: string;
  // Stavke poslije filtera vrste, razlika i kurira (ono što bi išlo u CSV).
  rows: Row[];
  diffCount: number;
  period: JournalPeriod;
  range: { from: string; to: string };
  type: JournalType;
  diffOnly: boolean;
  courierName: string | null;
  shown: number;
  now: number;
  currency: string;
}>();

const emit = defineEmits<{
  period: [JournalPeriod];
  type: [JournalType];
  diff: [];
  courier: [];
  courierClear: [];
  customDay: [which: "from" | "to", value: string];
  csv: [];
  retry: [];
  reset: [];
  more: [];
  open: [key: string];
}>();

const TYPES: [JournalType, string][] = [
  ["all", "Sve"],
  ["handover", "Predaje"],
  ["payout", "Isplate"],
];

const today = computed(() => dayKey(props.now));
const amount = (v: number) => v.toFixed(2);
const totals = computed(() => journalTotals(props.rows));
const groups = computed(() => groupDays(props.rows.slice(0, props.shown), props.now));
const focused = ref<string | null>(null);
// Jedini red u redoslijedu tastera Tab: red na kome je fokus, inače prvi.
const tabKey = computed(() => {
  const keys = props.rows.slice(0, props.shown).map((r) => r.key);
  return focused.value && keys.includes(focused.value) ? focused.value : (keys[0] ?? null);
});

const onDate = (which: "from" | "to", event: Event) => emit("customDay", which, (event.target as HTMLInputElement).value);

const rowButtons = () => [...document.querySelectorAll<HTMLElement>("[data-journal^='row:']")];
const onListKey = async (event: KeyboardEvent) => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-journal^='row:']");
  if (!target || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = rowButtons();
  const at = buttons.indexOf(target);
  const next =
    event.key === "ArrowDown" ? Math.min(buttons.length - 1, at + 1) : event.key === "ArrowUp" ? Math.max(0, at - 1) : event.key === "Home" ? 0 : buttons.length - 1;
  const el = buttons[next];
  if (!el) return;
  focused.value = el.dataset.journal?.slice(4) ?? null;
  await nextTick();
  el.focus();
};
</script>

<style scoped>
.jt {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.jt-bar {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.jt-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  align-items: center;
}

.jt-fbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.jt-fp {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #e2e5ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.jt-fp:hover {
  border-color: #c7ccd4;
}

.jt-fp[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.jt-fp .n {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.jt-fp:focus-visible,
.jt-btn:focus-visible,
.jt-x:focus-visible,
.jt-dates input:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.jt-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.jt-dates label {
  display: grid;
  gap: 2px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #5b6676;
}

.jt-dates input {
  height: 44px;
  padding: 0 10px;
  border: 1.5px solid #e2e5ea;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-weight: 600;
}

.jt-r {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.jt-sp {
  flex: 1;
}

.jt-x {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.jt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}

.jt-btn:active {
  background: #f1f4f9;
}

.jt-btn:disabled {
  border-color: #e2e5ea;
  background: #f5f6f8;
  color: #5b6676;
  cursor: not-allowed;
}

.jt-card {
  min-width: 0;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.jt-card ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.jt-tot {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.jt-tot > div {
  display: grid;
  gap: 1px;
  min-width: 0;
  padding: 12px 14px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 20px rgba(11, 18, 32, 0.05);
}

.jt-tot .l {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.jt-tot .v {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.jt-tot .v i {
  font-size: 0.85rem;
  font-style: normal;
  font-weight: 700;
  color: #5b6676;
}

.jt-tot .s {
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
}

.jt-note {
  margin: -6px 0 0;
  font-size: 0.78rem;
  color: #5b6676;
}

.jt-day {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 4px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.jt-day .d {
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.jt-more {
  display: flex;
  justify-content: center;
}

.jt-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 30px 18px;
  text-align: center;
  font-size: 0.9rem;
  color: #5b6676;
}

.jt-empty b {
  font-size: 1rem;
  color: #0b1220;
}

.jt-empty :deep(.v-icon) {
  color: #c7ccd6;
}

.jt-sk {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 90px;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-top: 1px solid #eceef2;
}

.b {
  display: block;
  border-radius: 12px;
  background: linear-gradient(90deg, #eceef2 25%, #f6f7f9 37%, #eceef2 63%);
  background-size: 400% 100%;
  animation: jt-sh 1.4s ease infinite;
}

.b.a {
  height: 40px;
  border-radius: 50%;
}

.b.m {
  height: 14px;
}

.b.c {
  height: 30px;
}

@keyframes jt-sh {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (max-width: 700px) {
  .jt-line {
    display: grid;
    gap: 10px;
  }

  .jt-fbar {
    flex-wrap: nowrap;
    margin: 0 -16px;
    padding: 2px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .jt-fbar::-webkit-scrollbar {
    display: none;
  }

  .jt-tot {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .jt-tot > div {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 10px;
  }

  .jt-tot .s {
    grid-column: 1 / -1;
  }

  .jt-tot .v {
    font-size: 1.15rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b {
    animation: none;
  }
}
</style>
