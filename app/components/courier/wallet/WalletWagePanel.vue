<template>
  <section class="w-panel" aria-label="Zarada">
    <TintAlert v-if="monthly" tone="info" title="Plata se obračunava mjesečno">
      Zarada po dostavi se ne vodi. Isplate koje dispečer evidentira vidiš ispod.
    </TintAlert>

    <template v-else>
      <button v-if="lastPayout" type="button" class="w-line" @click="emit('open-payout', lastPayout.id)">
        <span class="ico"><v-icon icon="mdi-cash-multiple" size="20" /></span>
        <span>
          <b>Zadnja isplata · {{ kmText(lastPayout.amount) }} KM</b>
          <span class="s">{{ shortDateOf(lastPayout.ts, now) }} · {{ clockOf(lastPayout.ts) }}</span>
        </span>
        <v-icon icon="mdi-chevron-right" size="20" class="go" />
      </button>
      <div v-else-if="!payoutsKnown" class="w-line" role="status" aria-busy="true" aria-label="Učitavam isplate">
        <span class="sk" style="width: 40px; height: 40px; border-radius: 50%" />
        <span class="lines">
          <span class="sk" style="height: 14px; width: 60%" />
          <span class="sk" style="height: 12px; width: 40%" />
        </span>
      </div>
      <div v-else-if="payoutsFailed" class="w-line">
        <span class="ico ico--mute"><v-icon icon="mdi-cash-multiple" size="20" /></span>
        <span>
          <b>Zadnja isplata nije dostupna</b>
          <span class="s">Pojavi se čim isplate stignu.</span>
        </span>
      </div>
      <div v-else class="w-line">
        <span class="ico ico--mute"><v-icon icon="mdi-cash-multiple" size="20" /></span>
        <span>
          <b>Još nema isplata</b>
          <span class="s">Kad dispečer evidentira isplatu, vidjećeš je ovdje.</span>
        </span>
      </div>
    </template>

    <p class="w-hint">
      Zaradu ti isplaćuje dispečer, a isplate se vide ispod. Gotovinu predaješ posebno, u cijelosti.
      <button type="button" class="lnk" @click="emit('help')">Kako radi novčanik?</button>
    </p>
  </section>
</template>

<script setup lang="ts">
import TintAlert from "~/components/common/TintAlert.vue";
import { clockOf, shortDateOf } from "~/utils/historyGroups";
import { kmText } from "~/utils/walletLedger";
import type { WalletPayout } from "~/types/wallet-ledger";

// Panel računa zarade: zadnja isplata (otvara detalj) i objašnjenje. Kad se plata obračunava
// mjesečno, kaže se to umjesto iznosa po dostavi (nema "+0.00 KM").
defineProps<{
  monthly: boolean;
  lastPayout: WalletPayout | null;
  // Isplate su stigle (ili pale).
  payoutsKnown: boolean;
  payoutsFailed: boolean;
  now: number;
}>();

const emit = defineEmits<{
  "open-payout": [id: number];
  help: [];
}>();
</script>

<style scoped>
.w-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  animation: w-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes w-in {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.w-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5b6676;
}

.lnk {
  padding: 4px 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  color: #2459c7;
  cursor: pointer;
}

.lnk:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 4px;
}

.w-line {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 2px 0;
  border: 0;
  background: none;
  font: inherit;
  color: #0b1220;
  text-align: left;
}

button.w-line {
  cursor: pointer;
}

button.w-line:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 8px;
}

.ico {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e3f8ef;
  color: #00734f;
}

.ico--mute {
  background: #f1f3f6;
  color: #5b6676;
}

.w-line b {
  display: block;
  font-size: 0.92rem;
}

.w-line .s {
  display: block;
  font-size: 0.8rem;
  color: #5b6676;
}

.w-line .go {
  margin-left: auto;
  color: #657083;
}

.lines {
  display: grid;
  gap: 8px;
  flex: 1;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: w-shimmer 1.3s linear infinite;
}

@keyframes w-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-panel,
  .sk {
    animation: none;
  }
}
</style>
