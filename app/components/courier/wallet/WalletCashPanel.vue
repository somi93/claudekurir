<template>
  <section class="w-panel" aria-label="Gotovina">
    <!-- Oglašava promjene (predaja čeka / potvrđena) čitaču ekrana; mjesto postoji uvijek,
         jer se promjena u regiji koja je tek umetnuta često ne oglasi. -->
    <div class="sr-only" role="status" aria-live="polite">{{ announcement }}</div>

    <ConfirmedHandoverCard v-if="confirmed" :handover="confirmed" @dismiss="emit('dismiss')" />

    <PendingHandoverCard
      v-else-if="pending"
      :handover="pending"
      :checking="checking"
      @check="emit('check')"
    />

    <!-- Dok se ne zna da li predaja čeka, nema dugmeta (ne smije da se pojavi pa nestane). -->
    <div v-else-if="!pendingKnown" class="w-wait" role="status" aria-busy="true" aria-label="Učitavam predaje">
      <span class="sk" style="height: 8px; border-radius: 999px" />
      <span class="sk" style="height: 12px; width: 60%" />
      <span class="sk" style="height: 52px; border-radius: 14px" />
    </div>

    <template v-else-if="cash < 0">
      <TintAlert tone="info" :title="`Evidentirano je ${kmText(cash)} KM više nego što si naplatio`">
        Nemaš šta da predaš. Ako to nije tačno, javi se dispečeru.
      </TintAlert>
      <p class="w-hint">
        Gotovinu predaješ u cijelosti, a zaradu ti firma isplaćuje posebno.
        <button type="button" class="lnk" @click="emit('help')">Kako radi novčanik?</button>
      </p>
    </template>

    <template v-else-if="cashToReport === 0">
      <div class="w-line">
        <span class="ico"><v-icon icon="mdi-check-circle-outline" size="20" /></span>
        <span>
          <b>Nemaš gotovine za predaju</b>
          <span class="s">Sve što si naplatio je predato firmi.</span>
        </span>
      </div>
      <p class="w-hint">
        <button type="button" class="lnk" @click="emit('help')">Kako radi novčanik?</button>
      </p>
    </template>

    <template v-else>
      <CashMeter v-if="meter && limit != null" :meter="meter" :limit="limit" />
      <p v-else class="w-hint">Firma nije postavila limit gotovine.</p>

      <TintAlert
        v-if="meter?.state === 'over' && enforcement === 'BLOCK'"
        tone="bad"
        role="alert"
        title="Ne dobijaš nove keš porudžbine"
      >
        Preko limita si. Dok ne predaš pazar, sistem te ne spaja sa porudžbinama koje se plaćaju
        gotovinom.
      </TintAlert>
      <TintAlert
        v-else-if="meter?.state === 'over'"
        tone="warn"
        role="alert"
        title="Limit gotovine je dostignut"
      >
        Predaj pazar dispečeru čim stigneš. Za sada te sistem i dalje spaja sa keš porudžbinama.
      </TintAlert>

      <WalletButton v-if="canReport" icon="mdi-cash-refund" @click="emit('report')">
        Prijavi predaju gotovine
      </WalletButton>

      <p class="w-hint">
        Prvo predaj gotovinu dispečeru, pa prijavi iznos. Dispečer potvrđuje koliko je primio.
        <button type="button" class="lnk" @click="emit('help')">Šta ulazi u dug?</button>
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import CashMeter from "~/components/courier/wallet/CashMeter.vue";
import ConfirmedHandoverCard from "~/components/courier/wallet/ConfirmedHandoverCard.vue";
import PendingHandoverCard from "~/components/courier/wallet/PendingHandoverCard.vue";
import WalletButton from "~/components/courier/wallet/WalletButton.vue";
import type { CashLimitSummary } from "~/utils/cashLimit";
import { kmText } from "~/utils/walletLedger";
import type { WalletHandover } from "~/types/wallet-ledger";

// Panel računa gotovine: ono što kurir treba da vidi i uradi, jedno uz drugo - mjerač limita,
// upozorenje i dugme (ili kartica sa koracima kad predaja čeka). Dugme se ne nudi kad nema šta
// da se preda (nula, negativan saldo) i dok druga prijava čeka.
const props = defineProps<{
  // cash_owed_to_company: > 0 duguješ firmi, < 0 predao si više.
  cash: number;
  // Šta se može predati (samo pozitivan dug), zaokruženo na dvije decimale.
  cashToReport: number;
  meter: CashLimitSummary | null;
  limit: number | null;
  enforcement: string;
  pending: WalletHandover | null;
  // Predaje su stigle (ili pale), pa se zna da li neka čeka.
  pendingKnown: boolean;
  // Predaja koju je dispečer upravo potvrdio dok je ekran bio otvoren.
  confirmed: WalletHandover | null;
  canReport: boolean;
  checking: boolean;
}>();

const emit = defineEmits<{
  report: [];
  check: [];
  help: [];
  dismiss: [];
}>();

const announcement = computed(() => {
  if (props.confirmed) {
    return `Dispečer je potvrdio predaju od ${kmText(props.confirmed.confirmed)} KM.`;
  }
  if (props.pending) return `Predaja od ${kmText(props.pending.reported)} KM čeka potvrdu dispečera.`;
  return "";
});
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
}

.w-line .ico {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e3f8ef;
  color: #00734f;
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

.w-wait {
  display: grid;
  gap: 12px;
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
