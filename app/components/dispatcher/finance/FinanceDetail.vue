<template>
  <article class="fd" aria-label="Detalji kurira">
    <header class="fd-head">
      <span class="fd-av" aria-hidden="true">{{ row.initials }}</span>
      <div class="fd-t">
        <h2 id="finance-detail-title" ref="title" tabindex="-1">{{ row.name }}</h2>
        <div class="fd-meta">
          <button
            type="button"
            class="fd-id"
            :class="{ done: copied === 'id' }"
            data-detail="copy-id"
            :aria-label="`Kopiraj ID kurira ${row.id}`"
            @click="copy('id', String(row.id))"
          >
            <template v-if="copied === 'id'"
              ><v-icon icon="mdi-check" size="16" />Kopirano</template
            >
            <template v-else
              >Kurir #{{ row.id }}<v-icon icon="mdi-content-copy" size="16"
            /></template>
          </button>
          <span v-if="row.suspended" class="fd-pill">Suspendovan</span>
          <span v-if="!row.inFirm" class="fd-pill">Nije u firmi</span>
        </div>
      </div>
      <button
        v-if="wide"
        type="button"
        class="fd-x"
        data-detail="close"
        aria-label="Zatvori detalje"
        @click="emit('close')"
      >
        <v-icon icon="mdi-close" size="20" />
      </button>
      <span v-else />
    </header>

    <div class="fd-qa">
      <a
        v-if="row.phone"
        class="qb"
        data-detail="call"
        :href="telHref(row.phone)"
        :aria-label="`Pozovi ${row.name}`"
      >
        <v-icon icon="mdi-phone-outline" size="22" />Pozovi
      </a>
      <span v-else class="qb" aria-disabled="true" title="Kurir nema upisan telefon">
        <v-icon icon="mdi-phone-outline" size="22" />Pozovi
      </span>
      <NuxtLink
        v-if="row.inFirm"
        class="qb"
        data-detail="profile"
        :to="`/dispatcher/couriers?c=${row.id}`"
      >
        <v-icon icon="mdi-account-outline" size="22" />Profil
      </NuxtLink>
      <span v-else class="qb" aria-disabled="true" title="Kurir nije više u firmi">
        <v-icon icon="mdi-account-outline" size="22" />Profil
      </span>
      <button type="button" class="qb" data-detail="journal" @click="emit('journal')">
        <v-icon icon="mdi-history" size="22" />Promet
      </button>
    </div>

    <div class="fd-accs">
      <section class="acc" aria-label="Gotovina">
        <header>
          <span
            class="ico"
            :class="over ? 'bad' : near ? 'warn' : row.cash < 0 ? 'ok' : ''"
            ><v-icon icon="mdi-cash" size="20"
          /></span>
          <h3>Gotovina</h3>
        </header>
        <div class="num" :class="cashClass">
          {{ amount(Math.abs(row.cash)) }} <i>{{ currency }}</i>
        </div>
        <div class="lab">
          {{
            row.cash > 0
              ? "Duguje firmi"
              : row.cash < 0
              ? "Firma duguje kuriru (gotovina)"
              : "Nema duga"
          }}
        </div>
        <template v-if="row.cash > 0 && cashLimit != null && row.pct != null">
          <span
            class="meter"
            :class="`meter--${row.level}`"
            role="img"
            :aria-label="`${row.pctRaw}% limita gotovine`"
            ><i :style="{ width: `${row.pct}%` }"
          /></span>
          <span class="mtxt">
            {{ row.pctRaw }}% limita od {{ formatAmount(cashLimit, currency)
            }}{{ over ? " · preko limita" : near ? " · blizu limita" : "" }}
          </span>
        </template>
        <div
          v-for="p in row.pending"
          :key="p.id"
          class="hand"
          :class="{ late: isLate(p.at) }"
        >
          <span>
            <b>Prijavio {{ formatAmount(p.amount, currency) }}</b>
            <span>{{ ageText(p.at, now) }}{{ isLate(p.at) ? " · kasni" : "" }}</span>
          </span>
          <button
            type="button"
            class="btn btn--sm"
            :data-detail="`confirm:${p.id}`"
            :aria-label="`Potvrdi predaju od ${formatAmount(p.amount, currency)}`"
            @click="emit('confirm', p.id)"
          >
            Potvrdi
          </button>
        </div>
        <button
          type="button"
          class="btn btn--block"
          :class="{ 'btn--pri': row.cash > 0 }"
          data-detail="receipt"
          @click="emit('receipt')"
        >
          <v-icon icon="mdi-cash-plus" size="20" />Evidentiraj uplatu
        </button>
      </section>

      <section class="acc" aria-label="Zarada">
        <header>
          <span class="ico blue"><v-icon icon="mdi-wallet-outline" size="20" /></span>
          <h3>Zarada</h3>
        </header>
        <div class="num">
          {{ amount(row.wage) }} <i>{{ currency }}</i>
        </div>
        <div class="lab">Firma duguje kuriru</div>
        <div class="note">
          {{
            row.pay || (row.inFirm ? "Ugovor nije podešen." : "Kurir nije više u firmi.")
          }}
        </div>
        <div v-for="b in banks" :key="b.key" class="bank">
          <span>
            <small>{{ b.label }}</small>
            <b>{{ b.value }}</b>
          </span>
          <button
            type="button"
            class="ib"
            :data-detail="`copy-${b.key}`"
            :aria-label="`Kopiraj ${b.label.toLowerCase()}`"
            @click="copy(b.key, b.value)"
          >
            <v-icon
              :icon="copied === b.key ? 'mdi-check' : 'mdi-content-copy'"
              size="20"
            />
          </button>
        </div>
        <button
          type="button"
          class="btn btn--block"
          :class="{ 'btn--pri': row.wage > 0 }"
          data-detail="payout"
          :disabled="!(row.wage > 0)"
          @click="emit('payout')"
        >
          <v-icon icon="mdi-cash-minus" size="20" />Isplati zaradu
        </button>
      </section>
    </div>

    <h3 class="gt">Zadnjih 30 dana</h3>
    <div
      v-if="!ledger || (ledger.state === 'loading' && !ledger.rows.length)"
      class="tl"
      aria-busy="true"
    >
      <div v-for="n in 2" :key="n" class="sk" aria-hidden="true">
        <i class="b a" /><i class="b m" /><i class="b c" />
      </div>
    </div>
    <div v-else-if="ledger.state === 'error'" class="pad">
      <TintAlert
        tone="bad"
        role="alert"
        icon="mdi-cloud-off-outline"
        title="Ne mogu da učitam promet kurira"
      >
        Ostatak detalja radi.
        <template #action>
          <button type="button" data-detail="retry-ledger" @click="emit('retryLedger')">
            Pokušaj ponovo
          </button>
        </template>
      </TintAlert>
    </div>
    <div v-else class="tl" data-detail="ledger">
      <div v-if="!ledger.rows.length" class="ti">
        <span class="ic wait"><v-icon icon="mdi-history" size="18" /></span>
        <div>
          <b>Nema prometa u zadnjih 30 dana</b
          ><small>Predaje i isplate se pojavljuju ovdje.</small>
        </div>
        <span />
      </div>
      <template v-else>
        <div v-for="x in ledger.rows.slice(0, 6)" :key="x.key" class="ti">
          <template v-if="x.kind === 'payout'">
            <span class="ic out"><v-icon icon="mdi-cash-minus" size="18" /></span>
            <div>
              <b>Isplata zarade</b>
              <small
                >{{ dateTimeShort(x.at) }} ·
                {{ x.method ? x.method : "način nije upisan" }}</small
              >
            </div>
            <div class="a">{{ formatAmount(x.amount, currency) }}</div>
          </template>
          <template v-else-if="x.status !== 'confirmed'">
            <span class="ic wait"><v-icon icon="mdi-timer-sand" size="18" /></span>
            <div>
              <b>Predaja čeka potvrdu</b>
              <small>{{ ageText(x.reportedAt ?? x.at, now) }}</small>
            </div>
            <div class="a">{{ formatAmount(x.amount, currency) }}</div>
          </template>
          <template v-else>
            <span class="ic in"><v-icon icon="mdi-cash-plus" size="18" /></span>
            <div>
              <b>Predaja potvrđena</b>
              <small>{{ dateTimeShort(x.at) }}{{ x.by ? ` · ${x.by}` : "" }}</small>
            </div>
            <div class="a">
              {{ formatAmount(x.amount, currency) }}
              <small v-if="x.diff !== 0" class="d"
                >prijavljeno {{ (x.reported ?? 0).toFixed(2) }}</small
              >
            </div>
          </template>
        </div>
        <div class="tlmore">
          <button
            type="button"
            class="btn btn--text btn--sm"
            data-detail="all-journal"
            @click="emit('journal')"
          >
            Sve u Prometu
          </button>
        </div>
      </template>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { ageText, dateTimeShort, overdue, type CashRow, type JournalRow } from "~/utils/cashDesk";
import { copyText } from "~/utils/clipboard";
import { telHref } from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";

// Detalj jednog kurira: oba računa (gotovina i zarada, nikad zbrojeni), predaja na čekanju sa "Potvrdi",
// mjerač limita, žiro račun i IBAN sa kopiranjem, "Pozovi", "Profil" i zadnjih 30 dana prometa (predaje
// i isplate zajedno, razlika uz iznos). Na računaru stoji uz spisak, na telefonu je zasebna stranica.
const props = defineProps<{
  row: CashRow;
  now: number;
  currency: string;
  cashLimit: number | null;
  wide: boolean;
  ledger: { state: "loading" | "ok" | "error"; rows: JournalRow[] } | null;
}>();

const emit = defineEmits<{
  close: [];
  receipt: [];
  payout: [];
  confirm: [pendingId: number];
  journal: [];
  retryLedger: [];
}>();

const title = ref<HTMLElement | null>(null);

const over = computed(() => props.row.level === "over");
const near = computed(() => props.row.level === "near");
const cashClass = computed(() => (over.value ? "over" : near.value ? "near" : props.row.cash < 0 ? "cr" : ""));
const amount = (v: number) => v.toFixed(2);
const isLate = (at: string) => overdue(at, props.now);

const banks = computed(() =>
  [
    props.row.bank ? { key: "bank", label: "Žiro račun", value: props.row.bank } : null,
    props.row.iban ? { key: "iban", label: "IBAN", value: props.row.iban } : null,
  ].filter((b): b is { key: string; label: string; value: string } => b !== null)
);

const copied = ref<string | null>(null);
const copy = async (key: string, value: string) => {
  if (!(await copyText(value))) return;
  copied.value = key;
  setTimeout(() => {
    if (copied.value === key) copied.value = null;
  }, 1600);
};

defineExpose({ focusTitle: () => title.value?.focus({ preventScroll: true }) });
</script>

<style scoped>
.fd {
  min-width: 0;
  padding-bottom: 6px;
}

.fd-head {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px 16px 10px;
}

.fd-av {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #0b1220;
  color: #fff;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.fd-t h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.fd-t h2:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 3px;
  border-radius: 6px;
}

.fd-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-top: 6px;
}

.fd-id {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  border: 0;
  border-radius: 999px;
  background: #f1f3f6;
  color: #0b1220;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.fd-id::after {
  content: "";
  position: absolute;
  inset: -6px -4px;
}

.fd-id.done {
  background: #e3f8ef;
  color: #00734f;
}

.fd-id:focus-visible,
.fd-x:focus-visible,
.qb:focus-visible,
.btn:focus-visible,
.ib:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.fd-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #eceff3;
  color: #46505f;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.fd-x {
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

.fd-qa {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 4px 16px 12px;
}

.qb {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 4px;
  min-height: 60px;
  padding: 8px 4px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.qb:active {
  background: #f1f4f9;
}

.qb[aria-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
}

.fd-accs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 6px 16px 4px;
}

.acc {
  display: grid;
  gap: 8px;
  align-content: start;
  min-width: 0;
  padding: 14px;
  border: 1px solid #eceef2;
  border-radius: 16px;
  background: #fff;
}

.acc > header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.acc h3 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #5b6676;
}

.ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: #f1f3f6;
}

.ico.ok {
  background: #e3f8ef;
  color: #00734f;
}

.ico.blue {
  background: #eef4ff;
  color: #2459c7;
}

.ico.bad {
  background: #fde8e6;
  color: #b42318;
}

.ico.warn {
  background: #fff2df;
  color: #8f4406;
}

.num {
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.num i {
  font-size: 1rem;
  font-style: normal;
  font-weight: 700;
  color: #5b6676;
}

.num.over {
  color: #b42318;
}

.num.near {
  color: #8f4406;
}

.num.cr {
  color: #00734f;
}

.lab {
  font-size: 0.84rem;
  font-weight: 700;
  color: #5b6676;
}

.note {
  font-size: 0.8rem;
  line-height: 1.4;
  color: #5b6676;
}

.mtxt {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.meter {
  position: relative;
  display: block;
  width: 100%;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e8ed;
}

.meter i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: #1f9d6b;
}

.meter--near i {
  background: #e08a14;
}

.meter--over i {
  background: #e5484d;
}

.hand {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 12px;
  background: #eef4ff;
  color: #17408f;
  font-size: 0.8rem;
}

.hand.late {
  background: #fde8e6;
  color: #7a1810;
}

.hand > span {
  display: grid;
  min-width: 0;
}

.hand b {
  font-weight: 800;
}

.hand > span > span {
  font-weight: 600;
}

.bank {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 12px;
  background: #f5f6f8;
  font-size: 0.8rem;
}

.bank span {
  display: grid;
  min-width: 0;
}

.bank small {
  font-size: 0.72rem;
  font-weight: 700;
  color: #5b6676;
}

.bank b {
  font-weight: 800;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.ib {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -8px -8px -8px 0;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.ib:active {
  background: #f1f4f9;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
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

.btn:active {
  background: #f1f4f9;
}

.btn--sm {
  padding: 0 14px;
}

.btn--block {
  width: 100%;
  min-height: 52px;
  font-size: 1rem;
}

.btn--pri {
  border-color: #0b1220;
  background: #0b1220;
  color: #fff;
  box-shadow: 0 6px 16px -6px rgba(11, 18, 32, 0.5);
}

.btn--pri:active {
  background: #1b2638;
}

.btn--text {
  border-color: transparent;
  background: none;
  color: #2459c7;
}

.btn:disabled {
  border-color: #e2e5ea;
  background: #f5f6f8;
  color: #5b6676;
  box-shadow: none;
  cursor: not-allowed;
}

.gt {
  margin: 0;
  padding: 14px 16px 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.pad {
  padding: 0 8px 6px;
}

.tl {
  margin: 0 8px;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.ti {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 56px;
  padding: 10px 12px;
}

.ti + .ti {
  border-top: 1px solid #eceef2;
}

.ic {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.ic.in {
  background: #e3f8ef;
  color: #00734f;
}

.ic.out {
  background: #eef4ff;
  color: #2459c7;
}

.ic.wait {
  background: #fff2df;
  color: #8f4406;
}

.ti b {
  display: block;
  font-size: 0.88rem;
  font-weight: 800;
}

.ti small {
  display: block;
  font-size: 0.76rem;
  line-height: 1.3;
  color: #5b6676;
}

.ti .a {
  font-size: 0.9rem;
  font-weight: 800;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.ti .a small.d {
  font-weight: 800;
  color: #8f4406;
}

.tlmore {
  display: flex;
  justify-content: center;
  padding: 2px 8px;
  border-top: 1px solid #eceef2;
}

.sk {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 90px;
  gap: 12px;
  align-items: center;
  padding: 12px;
}

.sk + .sk {
  border-top: 1px solid #eceef2;
}

.b {
  display: block;
  border-radius: 12px;
  background: linear-gradient(90deg, #eceef2 25%, #f6f7f9 37%, #eceef2 63%);
  background-size: 400% 100%;
  animation: fd-sh 1.4s ease infinite;
}

.b.a {
  height: 32px;
  border-radius: 50%;
}

.b.m {
  height: 14px;
}

.b.c {
  height: 24px;
}

@keyframes fd-sh {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (max-width: 700px) {
  .fd-accs {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b {
    animation: none;
  }
}
</style>
