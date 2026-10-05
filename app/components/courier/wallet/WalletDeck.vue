<template>
  <div ref="root" class="w-deck" role="tablist" aria-label="Račun" @keydown="onKeydown">
    <button
      id="wallet-tab-cash"
      type="button"
      class="w-tile"
      role="tab"
      aria-controls="wallet-panel"
      :aria-selected="account === 'cash'"
      :tabindex="account === 'cash' ? 0 : -1"
      @click="emit('select', 'cash')"
    >
      <span class="w-eyebrow">Gotovina</span>
      <span class="w-num" :class="cashTone">{{ kmText(cash) }}<small>KM</small></span>
      <span class="w-cap">{{ cashCaption }}</span>
      <span v-if="flag" class="w-flag" :class="flag" role="img" :aria-label="flagLabel">
        <v-icon :icon="flag === 'over' ? 'mdi-alert-circle-outline' : 'mdi-alert-outline'" size="16" />
      </span>
    </button>

    <button
      id="wallet-tab-wage"
      type="button"
      class="w-tile"
      role="tab"
      aria-controls="wallet-panel"
      :aria-selected="account === 'wage'"
      :tabindex="account === 'wage' ? 0 : -1"
      @click="emit('select', 'wage')"
    >
      <span class="w-eyebrow">Zarada</span>
      <template v-if="monthly">
        <span class="w-num is-plain">Mjesečno</span>
        <span class="w-cap">plata se obračunava mjesečno</span>
      </template>
      <template v-else>
        <span class="w-num is-credit">{{ kmText(wage) }}<small>KM</small></span>
        <span class="w-cap">{{ wage > 0 ? "firma ti duguje" : "nema dugovanja" }}</span>
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { kmText } from "~/utils/walletLedger";
import type { WalletAccount } from "~/types/wallet-ledger";

// Dva računa kao PRAVI tabovi (role="tablist"): jedan red od 98 px umjesto dvije kartice jedna
// ispod druge. Izabrana je tamna, a panel ispod pokazuje samo ono što pripada tom računu.
// Strelice i Home / End mijenjaju račun; samo izabrani tab je u redu za Tab.
//
// Pločica Gotovina nosi znak i boju stanja limita, pa se preko limita vidi i kad je otvorena
// Zarada. Boja nije jedini nosilac: uz znak stoji oznaka za čitač ekrana, a stanje je u panelu
// napisano riječima.
const props = defineProps<{
  account: WalletAccount;
  // cash_owed_to_company: > 0 duguješ firmi, < 0 predao si više.
  cash: number;
  limitState: "ok" | "near" | "over";
  wage: number;
  // Plata se obračunava mjesečno - umjesto iznosa piše "Mjesečno".
  monthly: boolean;
}>();

const emit = defineEmits<{ select: [account: WalletAccount] }>();

const root = ref<HTMLElement | null>(null);

const cashTone = computed(() => {
  if (props.cash < 0) return "is-credit";
  if (props.cash > 0 && props.limitState === "over") return "is-over";
  if (props.cash > 0 && props.limitState === "near") return "is-near";
  return "";
});

const cashCaption = computed(() =>
  props.cash > 0 ? "duguješ firmi" : props.cash < 0 ? "predao si više" : "bez duga"
);

const flag = computed(() =>
  props.cash > 0 && props.limitState !== "ok" ? props.limitState : null
);
const flagLabel = computed(() => (flag.value === "over" ? "Preko limita" : "Blizu limita"));

const onKeydown = (event: KeyboardEvent) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next: WalletAccount =
    event.key === "Home"
      ? "cash"
      : event.key === "End"
        ? "wage"
        : props.account === "cash"
          ? "wage"
          : "cash";
  emit("select", next);
  root.value?.querySelector<HTMLElement>(`#wallet-tab-${next}`)?.focus();
};
</script>

<style scoped>
.w-deck {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.w-tile {
  position: relative;
  display: grid;
  align-content: start;
  gap: 3px;
  min-width: 0;
  min-height: 98px;
  padding: 14px 14px 12px;
  border: 0;
  border-radius: 20px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  transition: background 0.15s, color 0.15s;
}

.w-tile:hover {
  background: #fbfcfd;
}

.w-tile:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.w-tile[aria-selected="true"] {
  background: #0b1220;
  color: #fff;
}

.w-eyebrow {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #5b6676;
}

.w-tile[aria-selected="true"] .w-eyebrow,
.w-tile[aria-selected="true"] .w-cap,
.w-tile[aria-selected="true"] .w-num small {
  color: rgba(255, 255, 255, 0.76);
}

/* Broj se smanjuje na uskim ekranima: 1234.56 staje i na 320 px. */
.w-num {
  margin-top: 2px;
  font-size: clamp(1.15rem, 6.6vw, 1.5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.12;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.w-num small {
  margin-left: 4px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  color: #5b6676;
}

.w-num.is-credit {
  color: #00734f;
}

.w-num.is-near {
  color: #9a4a07;
}

.w-num.is-over {
  color: #b42318;
}

.w-num.is-plain {
  font-size: 1.2rem;
  letter-spacing: -0.01em;
}

.w-tile[aria-selected="true"] .w-num.is-credit {
  color: #34d399;
}

.w-tile[aria-selected="true"] .w-num.is-near {
  color: #fbbf24;
}

.w-tile[aria-selected="true"] .w-num.is-over {
  color: #fca5a5;
}

.w-cap {
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1.3;
  color: #5b6676;
}

.w-flag {
  position: absolute;
  top: 11px;
  right: 11px;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.w-flag.near {
  background: #fff2df;
  color: #9a4a07;
}

.w-flag.over {
  background: #fde8e6;
  color: #b42318;
}

.w-tile[aria-selected="true"] .w-flag.near {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.w-tile[aria-selected="true"] .w-flag.over {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
}

@media (prefers-reduced-motion: reduce) {
  .w-tile {
    transition: none;
  }
}
</style>
