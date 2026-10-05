<template>
  <DeliveryPage :max-width="640">
    <template #header>
      <PageHeader title="Novčanik" back-to="/" back-label="Nazad na početnu">
        <template #subtitle>{{ subtitle }}</template>

        <template #actions>
          <button
            type="button"
            class="refresh-btn"
            :class="{ 'refresh-btn--spin': refreshing, 'refresh-btn--warn': stale && !refreshing }"
            aria-label="Osvježi"
            @click="refresh"
          >
            <v-icon icon="mdi-refresh" size="20" />
          </button>
        </template>
      </PageHeader>
    </template>

    <div class="wallet-body">
      <WalletSkeleton v-if="state === 'loading'" />

      <InboxEmptyState
        v-else-if="state === 'error'"
        tone="error"
        icon="mdi-alert-circle-outline"
        title="Ne mogu da učitam novčanik"
      >
        Provjeri vezu i pokušaj ponovo. Tvoje stanje nije promijenjeno.
        <template #action>
          <GlobalButtonPrimary @click="retry">
            <v-icon icon="mdi-refresh" size="18" class="mr-1" />
            Pokušaj ponovo
          </GlobalButtonPrimary>
        </template>
      </InboxEmptyState>

      <template v-else>
        <WalletDeck
          :account="account"
          :cash="cash"
          :limit-state="limitState"
          :wage="wageBalance"
          :monthly="monthly"
          @select="setAccount"
        />

        <div
          id="wallet-panel"
          class="wallet-tabpanel"
          role="tabpanel"
          :aria-labelledby="`wallet-tab-${account}`"
        >
          <WalletCashPanel
            v-if="account === 'cash'"
            :cash="cash"
            :cash-to-report="cashToReport"
            :meter="meter"
            :limit="limit"
            :enforcement="enforcement"
            :pending="pending"
            :pending-known="pendingKnown"
            :confirmed="justConfirmed"
            :can-report="canReport"
            :checking="checking"
            @report="openReport"
            @check="checkNow"
            @help="openSheet({ kind: 'help' })"
            @dismiss="dismissConfirmed"
          />
          <WalletWagePanel
            v-else
            :monthly="monthly"
            :last-payout="lastPayout"
            :payouts-known="settleSettled"
            :payouts-failed="settleFailed"
            :now="now"
            @open-payout="(id) => openSheet({ kind: 'payout', id })"
            @help="openSheet({ kind: 'help' })"
          />

          <section class="wallet-list" :aria-label="listTitle">
            <div class="w-sec-title">
              <h2>{{ listTitle }}</h2>
            </div>

            <GlobalFilterBar role="tablist" aria-label="Period" @keydown="onPeriodKeydown">
              <GlobalFilterPill
                v-for="option in periods"
                :id="`wallet-period-${option.value}`"
                :key="option.value"
                :label="option.label"
                :chevron="false"
                :active="period === option.value"
                role="tab"
                :aria-selected="period === option.value"
                :tabindex="period === option.value ? 0 : -1"
                @click="setPeriod(option.value)"
              />
            </GlobalFilterBar>

            <template v-if="listState !== 'new'">
              <WalletSummary
                :account="account"
                :cash="cashSummary"
                :wage="wageSummary"
                :filter="filter"
                :monthly="monthly"
                :first-loading="!earningsSettled"
                :first-failed="deliveriesFailed"
                :second-loading="!settleSettled"
                :second-failed="settleFailed"
                @toggle="toggleFilter"
              />

              <span v-if="filter" class="w-tag">
                Prikazano: samo {{ filterWord }}
                <button type="button" aria-label="Prikaži sve" @click="clearFilter">
                  <v-icon icon="mdi-close" size="16" />
                </button>
              </span>
            </template>

            <TintAlert v-if="failedTitle" tone="warn" role="alert" :title="failedTitle">
              Stanje je gore. Ostalo se pojavi čim stigne.
              <template #action>
                <button type="button" @click="retry">Pokušaj ponovo</button>
              </template>
            </TintAlert>

            <WalletSkeleton v-if="listState === 'loading'" rows-only />

            <InboxEmptyState
              v-else-if="listState === 'new'"
              icon="mdi-wallet-outline"
              title="Još nema ničega u novčaniku"
            >
              Kad završiš prvu dostavu, ovdje ćeš vidjeti šta si naplatio i koliko si zaradio.
              <template #action>
                <GlobalButtonPrimary to="/courier/deliveries">Idi na dostave</GlobalButtonPrimary>
              </template>
            </InboxEmptyState>

            <InboxEmptyState
              v-else-if="listState === 'empty'"
              :icon="account === 'cash' ? 'mdi-cash-check' : 'mdi-cash-multiple'"
              :title="emptyTitle"
            >
              {{ account === "cash" ? "Naplate i predaje gotovine" : "Zarada i isplate" }} pojaviće se
              ovdje.
              <template v-if="filter || widerTarget" #action>
                <v-btn v-if="filter" variant="tonal" color="secondary" @click="clearFilter">
                  Prikaži sve
                </v-btn>
                <v-btn v-else variant="tonal" color="secondary" @click="widen">
                  Prikaži {{ widerTarget === "week" ? "sedmicu" : "30 dana" }}
                </v-btn>
              </template>
            </InboxEmptyState>

            <WalletList
              v-else
              :groups="groups"
              :account="account"
              :rest="restItems"
              :is-pending="moneyPending"
              @open="openItem"
              @more="showMore"
            />

            <p v-if="account === 'cash' && (listState === 'rows' || listState === 'empty')" class="w-note">
              <v-icon icon="mdi-information-outline" size="18" />
              <span>
                Dug prema firmi nije isto što i naplaćeno: hrana koju sam platiš restoranu se ne
                duguje.
                <button type="button" class="lnk" @click="openSheet({ kind: 'help' })">Zašto?</button>
              </span>
            </p>
          </section>
        </div>
      </template>
    </div>

    <ReportHandoverSheet
      :open="reportOpen"
      :cash="cash"
      :submit-report="report"
      @update:open="onSheetOpen"
    />
    <HandoverDetailSheet
      :open="handoverSheet != null"
      :handover="handoverSheet ?? lastHandover"
      :now="now"
      @update:open="onSheetOpen"
    />
    <PayoutDetailSheet
      :open="payoutSheet != null"
      :payout="payoutSheet ?? lastPayoutShown"
      :now="now"
      @update:open="onSheetOpen"
    />
    <WalletHelpSheet :open="sheet?.kind === 'help'" @update:open="onSheetOpen" />
    <DeliveryDetailSheet
      :open="deliverySheet != null"
      :delivery="deliverySheet ?? lastDelivery"
      retryable
      @update:open="onSheetOpen"
      @retry="retry"
    />
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Novčanik" });

import { computed, ref, watch } from "vue";
import { useSessionStore } from "~/stores/session";
import { useCourierDeliveries } from "~/composables/useCourierDeliveries";
import { useWalletSource } from "~/composables/useWalletSource";
import { useWalletView } from "~/composables/useWalletView";
import PageHeader from "~/components/common/PageHeader.vue";
import GlobalFilterBar from "~/components/common/GlobalFilterBar.vue";
import GlobalFilterPill from "~/components/common/GlobalFilterPill.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import InboxEmptyState from "~/components/inbox/InboxEmptyState.vue";
import DeliveryDetailSheet from "~/components/courier/DeliveryDetailSheet.vue";
import WalletDeck from "~/components/courier/wallet/WalletDeck.vue";
import WalletCashPanel from "~/components/courier/wallet/WalletCashPanel.vue";
import WalletWagePanel from "~/components/courier/wallet/WalletWagePanel.vue";
import WalletSummary from "~/components/courier/wallet/WalletSummary.vue";
import WalletList from "~/components/courier/wallet/WalletList.vue";
import WalletSkeleton from "~/components/courier/wallet/WalletSkeleton.vue";
import ReportHandoverSheet from "~/components/courier/wallet/ReportHandoverSheet.vue";
import HandoverDetailSheet from "~/components/courier/wallet/HandoverDetailSheet.vue";
import PayoutDetailSheet from "~/components/courier/wallet/PayoutDetailSheet.vue";
import WalletHelpSheet from "~/components/courier/wallet/WalletHelpSheet.vue";
import { WALLET_PERIODS } from "~/utils/walletLedger";
import type { CourierDelivery } from "~/types/courier-delivery";
import type {
  WalletHandover,
  WalletItem,
  WalletPayout,
  WalletPeriod,
} from "~/types/wallet-ledger";

// Novčanik kurira: dva odvojena računa (gotovina = dug prema firmi, zarada = dug firme) kao
// tabovi, panel izabranog računa (mjerač limita, upozorenje i dugme za prijavu, ili kartica
// predaje koja čeka potvrdu), sažetak koji je i filter, i lista po danima. Saldo, predaje i
// isplate žive u stores/wallet.ts (svaki se učitava i pada za sebe), dostave u zajedničkom sloju
// sa Istorijom (stores/deliveries.ts); stanje ekrana (račun, period, filter, otvoren list) je u
// adresi: ?tab ?p ?f ?o. Stara ruta /courier/earnings vodi ovdje na ?tab=zarada.
const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

const wallet = useWalletSource(courierId);
const source = useCourierDeliveries(courierId);
const view = useWalletView(wallet, source);

const {
  now,
  account,
  period,
  filter,
  sheet,
  state,
  subtitle,
  stale,
  refreshing,
  cash,
  wageBalance,
  limit,
  enforcement,
  meter,
  limitState,
  pending,
  pendingKnown,
  cashToReport,
  canReport,
  monthly,
  periods,
  groups,
  restItems,
  cashSummary,
  wageSummary,
  listState,
  earningsSettled,
  settleSettled,
  deliveriesFailed,
  settleFailed,
  widerTarget,
  moneyPending,
  showMore,
  setAccount,
  setPeriod,
  toggleFilter,
  clearFilter,
  widen,
  deliverySheet,
  handoverSheet,
  payoutSheet,
  reportOpen,
  openSheet,
  openReport,
  closeSheet,
  refresh,
  retry,
  checking,
  checkNow,
} = view;

const { justConfirmed, dismissConfirmed, report } = wallet;

// --- Naslovi i tekstovi ------------------------------------------------------------

const listTitle = computed(() => (account.value === "cash" ? "Naplate i predaje" : "Zarada i isplate"));
const filterWord = computed(() =>
  filter.value === "delivery" ? "dostave" : account.value === "cash" ? "predaje" : "isplate"
);

const EMPTY_TITLES: Record<WalletPeriod, string> = {
  today: "Danas još nema promjena",
  week: "Ove sedmice nema promjena",
  month: "U zadnjih 30 dana nema promjena",
};
const emptyTitle = computed(() =>
  filter.value ? "Nema stavki za ovaj filter" : EMPTY_TITLES[period.value]
);

// Izvor koji nije stigao ne ruši ekran: stanje ostaje, a u listi piše šta fali.
const failedTitle = computed(() => {
  const parts: string[] = [];
  if (deliveriesFailed.value) parts.push("dostave");
  if (settleFailed.value) parts.push(account.value === "cash" ? "predaje" : "isplate");
  if (parts.length === 0) return "";
  const text = parts.join(" i ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} trenutno ne mogu da učitam`;
});

// Isplate nisu sortirane po vremenu garantovano, pa se zadnja traži.
const lastPayout = computed<WalletPayout | null>(() =>
  wallet.payouts.value.reduce<WalletPayout | null>(
    (latest, p) => (!latest || p.ts > latest.ts ? p : latest),
    null
  )
);

// --- Redovi i listovi -----------------------------------------------------------------

const openItem = (item: WalletItem) => {
  if (item.kind === "delivery") openSheet({ kind: "delivery", id: item.delivery.id });
  else if (item.kind === "handover") openSheet({ kind: "handover", id: item.handover.id });
  else openSheet({ kind: "payout", id: item.payout.id });
};

const onSheetOpen = (open: boolean) => {
  if (!open) closeSheet();
};

// Zadnji otvoreni sadržaj ostaje u listu dok se zatvara (animacija), da ne nestane prije nego
// što list sklizne.
const lastDelivery = ref<CourierDelivery | null>(null);
const lastHandover = ref<WalletHandover | null>(null);
const lastPayoutShown = ref<WalletPayout | null>(null);
watch(
  deliverySheet,
  (value) => {
    if (value) lastDelivery.value = value;
  },
  { immediate: true }
);
watch(
  handoverSheet,
  (value) => {
    if (value) lastHandover.value = value;
  },
  { immediate: true }
);
watch(
  payoutSheet,
  (value) => {
    if (value) lastPayoutShown.value = value;
  },
  { immediate: true }
);

// --- Tastatura -------------------------------------------------------------------------

// Pilule perioda: strelice mijenjaju period (kao tabovi), fokus ide za izborom.
const onPeriodKeydown = (event: KeyboardEvent) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const order = WALLET_PERIODS.map((p) => p.value);
  const index = order.indexOf(period.value);
  const next = order[Math.max(0, Math.min(order.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))];
  if (!next || next === period.value) return;
  setPeriod(next);
  (document.getElementById(`wallet-period-${next}`) as HTMLElement | null)?.focus();
};
</script>

<style scoped>
.wallet-body {
  display: grid;
  gap: 12px;
  align-content: start;
}

.wallet-tabpanel {
  display: grid;
  gap: 12px;
  margin-top: 6px;
}

.wallet-list {
  display: grid;
  gap: 10px;
}

.w-sec-title {
  padding: 6px 4px 0;
}

.w-sec-title h2 {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #0b1220;
}

.w-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  justify-self: start;
  height: 32px;
  padding: 0 4px 0 12px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2459c7;
  font-size: 0.8rem;
  font-weight: 700;
}

.w-tag button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: inherit;
  cursor: pointer;
}

.w-tag button:focus-visible {
  outline: 2px solid #2f6fed;
}

.w-note {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  margin: 0;
  padding: 0 4px;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5b6676;
}

.w-note :deep(.v-icon) {
  margin-top: 1px;
  color: #2459c7;
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

.refresh-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.06);
}

/* Meta od 44 px, a izgled ostaje 36 px kao dugme Nazad. */
.refresh-btn::after {
  content: "";
  position: absolute;
  inset: -4px;
}

.refresh-btn:active {
  background: #eceff3;
}

.refresh-btn:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}

.refresh-btn--spin :deep(.v-icon) {
  animation: wallet-spin 0.8s linear infinite;
}

/* Osvježavanje nije uspjelo: jantarna tačka uz dugme, a u podnaslovu piše "Nema veze". */
.refresh-btn--warn::before {
  content: "";
  position: absolute;
  top: 5px;
  right: 5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff9f1c;
  box-shadow: 0 0 0 2px #fff;
}

@keyframes wallet-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .refresh-btn--spin :deep(.v-icon) {
    animation: none;
  }
}
</style>
