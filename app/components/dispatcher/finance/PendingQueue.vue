<template>
  <section class="pq" :class="{ 'pq--flat': flat }" aria-label="Predaje koje čekaju potvrdu" :aria-busy="state === 'loading' ? 'true' : undefined">
    <h2>
      Čeka potvrdu
      <span v-if="state === 'ok' && items.length" class="pq-badge">{{ items.length }}</span>
    </h2>

    <template v-if="state === 'loading' || state === 'idle'">
      <div v-for="n in 2" :key="n" class="pq-sk" aria-hidden="true">
        <i class="b a" /><i class="b m" /><i class="b c" />
      </div>
    </template>

    <div v-else-if="state === 'error'" class="pq-pad">
      <TintAlert tone="bad" role="alert" icon="mdi-cloud-off-outline" title="Ne mogu da učitam predaje koje čekaju potvrdu">
        Ne znam da li ih ima. Pokušaj ponovo prije nego zaključiš da nema.
        <template #action>
          <button type="button" data-queue="retry" @click="emit('retry')">Pokušaj ponovo</button>
        </template>
      </TintAlert>
    </div>

    <div v-else-if="items.length === 0" class="pq-ok">
      <v-icon icon="mdi-check-circle-outline" size="22" />
      <span>Nema predaja koje čekaju potvrdu.</span>
    </div>

    <template v-else>
      <p class="pq-sub">Najstarija prva. Potvrdi tek kad primiš novac.</p>
      <div v-if="failed" class="pq-pad">
        <TintAlert tone="warn" role="status" icon="mdi-alert-outline" title="Osvježavanje nije uspjelo">
          Prikazano je zadnje poznato stanje.
          <template #action>
            <button type="button" data-queue="retry" @click="emit('retry')">Pokušaj ponovo</button>
          </template>
        </TintAlert>
      </div>
      <ul class="pq-ul">
        <li
          v-for="{ p, r } in shownItems"
          :key="p.id"
          class="pq-r"
          :class="{ 'is-flash': flash.has(p.id) }"
        >
          <span class="pq-av" :class="{ 'pq-av--bad': isLate(p.at) }" aria-hidden="true">{{ r.initials }}</span>
          <button
            type="button"
            class="pq-tx"
            :data-queue="`open:${p.id}`"
            :aria-label="`Otvori kurira ${r.name}`"
            @click="emit('open', r.id)"
          >
            <b>{{ r.name }}</b>
            <span>
              Prijavio <strong>{{ formatAmount(p.amount, currency) }}</strong> ·
              <span class="when" :class="{ late: isLate(p.at) }">{{ ageText(p.at, now) }}</span>
            </span>
            <span v-if="r.cash > 0">Dug kurira {{ formatAmount(r.cash, currency) }}</span>
          </button>
          <button
            type="button"
            class="pq-go"
            :data-queue="`confirm:${p.id}`"
            :aria-label="`Potvrdi predaju: ${r.name}, ${formatAmount(p.amount, currency)}`"
            @click="emit('confirm', p.id)"
          >
            Potvrdi
          </button>
        </li>
      </ul>
      <div v-if="items.length > limit" class="pq-more">
        <button type="button" class="pq-text" data-queue="more" @click="limit += 20">
          Prikaži još ({{ items.length - limit }})
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { ageText, ms, overdue, type CashRow, type PendingItem } from "~/utils/cashDesk";
import { formatAmount } from "~/utils/currency";

// Red predaja koje čekaju potvrdu: najstarija prva, starija od 24 h crvena, uz dug kurira. "Potvrdi" otvara
// list sa iznosom unaprijed upisanim; nema skupne potvrde (novac se prima fizički po kuriru, a potvrda se ne
// može poništiti). Pad izvora se piše u mjestu reda, a "Nema predaja" tek poslije uspješnog učitavanja.
const props = defineProps<{
  state: "idle" | "loading" | "ok" | "error";
  rows: CashRow[];
  now: number;
  currency: string;
  // Osvježavanje nije uspjelo, a stari podaci se prikazuju.
  failed: boolean;
  flash: Set<number>;
  // Bez kartice (računar: red je u desnom oknu).
  flat?: boolean;
}>();

const emit = defineEmits<{ open: [courierId: number]; confirm: [pendingId: number]; retry: [] }>();

const limit = ref(5);

const items = computed(() => {
  const out: { p: PendingItem; r: CashRow }[] = [];
  for (const r of props.rows) for (const p of r.pending) out.push({ p, r });
  return out.sort((a, b) => ms(a.p.at) - ms(b.p.at));
});
const shownItems = computed(() => items.value.slice(0, limit.value));
const isLate = (at: string) => overdue(at, props.now);
</script>

<style scoped>
.pq {
  min-width: 0;
  padding: 6px 0 4px;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.pq--flat {
  padding-top: 4px;
  border-radius: 0;
  background: none;
  box-shadow: none;
}

.pq h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 12px 16px 4px;
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.pq--flat h2 {
  padding-top: 14px;
}

.pq-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #b42318;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pq-sub {
  margin: 0;
  padding: 0 16px 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
}

.pq-pad {
  padding: 4px 14px 10px;
}

.pq-ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pq-r {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 64px;
  padding: 10px 14px;
  border-top: 1px solid #eceef2;
}

.pq-r.is-flash {
  animation: pq-fl 1.6s ease;
}

@keyframes pq-fl {
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

.pq-av {
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

.pq-av--bad {
  background: #fde8e6;
  color: #7a1810;
}

.pq-tx {
  display: grid;
  align-content: center;
  gap: 1px;
  min-width: 0;
  min-height: 48px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pq-tx:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 4px;
  border-radius: 8px;
}

.pq-tx b {
  overflow: hidden;
  font-size: 0.95rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pq-tx > span {
  font-size: 0.8rem;
  line-height: 1.3;
  color: #5b6676;
}

.pq-tx .when {
  white-space: nowrap;
}

.pq-tx .late {
  font-weight: 800;
  color: #b42318;
}

.pq-go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #0b1220;
  border-radius: 14px;
  background: #0b1220;
  color: #fff;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  box-shadow: 0 6px 16px -6px rgba(11, 18, 32, 0.5);
  cursor: pointer;
}

.pq-go:active {
  background: #1b2638;
}

.pq-go:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.pq-ok {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px 14px;
  font-size: 0.88rem;
  font-weight: 600;
  color: #5b6676;
}

.pq-ok :deep(.v-icon) {
  color: #00734f;
}

.pq-more {
  display: flex;
  justify-content: center;
  padding: 2px 10px 6px;
  border-top: 1px solid #eceef2;
}

.pq-text {
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.pq-text:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 10px;
}

.pq-sk {
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
  animation: pq-sh 1.4s ease infinite;
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

@keyframes pq-sh {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b,
  .pq-r.is-flash {
    animation: none;
  }
}
</style>
