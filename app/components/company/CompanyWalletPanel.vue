<template>
  <div class="wallet-panel">
    <GlobalCard v-if="showSection('handovers')" padding="20px">
      <template #title>Zahtevi za predaju gotovine</template>
      <template #subtitle>
        Kuriri koji su prijavili predaju - potvrdi kad primiš gotovinu. Najstariji prvo.
      </template>

      <div v-if="pendingHandovers.length > 0" class="handover-list mt-2">
        <div v-for="handover in pendingHandovers" :key="handover.id" class="handover-row">
          <div class="handover-info">
            <span class="handover-courier">{{ courierName(handover.courier_id) }}</span>
            <span class="handover-meta">
              {{ money(Number(handover.reported_amount)) }} · prijavljeno
              {{ formatRelativeTime(handover.reported_at) }}
            </span>
          </div>
          <GlobalButtonPrimary
            :loading="confirmingHandoverId === handover.id"
            @click="openConfirm(handover)"
          >
            Potvrdi
          </GlobalButtonPrimary>
        </div>
      </div>
      <GlobalEmptyState v-else-if="loadingHandovers" icon="mdi-timer-sand">
        Učitavanje...
      </GlobalEmptyState>
      <GlobalEmptyState v-else icon="mdi-check-circle-outline">
        Nema zahteva koji čekaju potvrdu.
      </GlobalEmptyState>
    </GlobalCard>

    <GlobalCard v-if="showSection('balances')" padding="20px" :class="{ 'mt-4': !activeTab }">
      <template #title>Balansi kurira</template>
      <template #subtitle>Ko kome šta duguje, za sve kurire ove firme.</template>

      <div v-if="balances.length > 0" class="balance-toolbar mt-2">
        <GlobalTextField
          v-model="searchQuery"
          density="compact"
          variant="solo"
          flat
          hide-details
          clearable
          placeholder="Pretraži po imenu ili ID-u kurira..."
          prepend-inner-icon="mdi-magnify"
          class="balance-search"
        />
        <v-switch
          v-model="showZeroBalances"
          color="accent"
          density="compact"
          hide-details
          label="Prikaži i nulte"
          class="balance-zero-toggle"
        />
      </div>

      <GlobalTable
        class="mt-2"
        item-key="courier_id"
        :headers="balanceHeaders"
        :items="filteredBalances"
        :loading="loadingBalances"
        @row-click="openDetails"
      >
        <template #item.courier_id="{ value }">
          <span class="balance-id">#{{ value }}</span>
          <span>{{ courierName(value as number) }}</span>
        </template>
        <template #item.cash_owed_to_company="{ value }">
          <span :class="{ 'cash-credit': (value as number) < 0 }">
            {{ money(value as number) }}
          </span>
        </template>
        <template #item.wage_owed_to_courier="{ value }">
          {{ money(value as number) }}
        </template>
        <template #item.actions="{ item }">
          <div class="row-actions" @click.stop>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              @click="openCashAction('receipt', item as CourierBalance)"
            >
              Uplata od kurira
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              @click="openCashAction('payout', item as CourierBalance)"
            >
              Isplata kurira
            </v-btn>
          </div>
        </template>
        <template #empty>
          <GlobalEmptyState icon="mdi-wallet-outline">
            {{ balancesEmptyText }}
          </GlobalEmptyState>
        </template>
      </GlobalTable>
    </GlobalCard>

    <WalletHistoryCard
      v-if="showSection('history')"
      :class="{ 'mt-4': !activeTab }"
      :couriers="couriers"
      :history="history"
      :loading="loadingHistory"
      :company-id="companyId"
      :refresh-key="historyRefreshKey"
      :currency="currency"
      @load="loadHistory"
    />

    <CompanyPayoutsCard
      v-if="showSection('payouts')"
      :class="{ 'mt-4': !activeTab }"
      :couriers="couriers"
      :payouts="companyPayouts"
      :loading="loadingPayouts"
      :company-id="companyId"
      :refresh-key="payoutsRefreshKey"
      :currency="currency"
      @load="loadPayouts"
    />

    <ConfirmHandoverDialog
      v-model:open="showConfirm"
      :handover="pendingConfirm"
      :courier-name="pendingConfirm ? courierName(pendingConfirm.courier_id) : ''"
      :saving="confirmingHandoverId === pendingConfirm?.id"
      :confirm="confirmHandover"
      :currency="currency"
    />

    <CourierWalletDetailsDialog
      v-model:open="showDetails"
      :courier="detailsCourier"
      :balance="detailsBalance"
      :currency="currency"
    />

    <CourierCashActionDialog
      v-model:open="showCashAction"
      :mode="cashAction?.mode ?? 'receipt'"
      :courier-id="cashAction?.balance.courier_id ?? null"
      :courier-name="cashAction ? courierName(cashAction.balance.courier_id) : ''"
      :cash-owed="cashAction?.balance.cash_owed_to_company ?? 0"
      :wage-owed="cashAction?.balance.wage_owed_to_courier ?? 0"
      :submitting="submittingAction"
      :submit-cash-receipt="submitCashReceipt"
      :submit-payout="submitPayout"
      :currency="currency"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import GlobalTable, { type GlobalTableHeader } from "~/components/common/GlobalTable.vue";
import WalletHistoryCard from "~/components/company/wallet/WalletHistoryCard.vue";
import CompanyPayoutsCard from "~/components/company/wallet/CompanyPayoutsCard.vue";
import ConfirmHandoverDialog from "~/components/company/wallet/ConfirmHandoverDialog.vue";
import CourierWalletDetailsDialog from "~/components/company/wallet/CourierWalletDetailsDialog.vue";
import CourierCashActionDialog from "~/components/company/wallet/CourierCashActionDialog.vue";
import { formatAmount } from "~/utils/currency";
import { formatRelativeTime } from "~/utils/datetime";
import type { CompanyCourier } from "~/types/company-courier";
import type { CourierBalance } from "~/types/courier-balance";
import type {
  CashHandoverHistoryFilters,
  CashHandoverHistoryItem,
  PendingCashHandover,
} from "~/types/cash-handover";
import type { CompanyPayout, CompanyPayoutFilters } from "~/types/payout";

type WalletSection = "handovers" | "balances" | "history" | "payouts";

const props = defineProps<{
  couriers: CompanyCourier[];
  balances: CourierBalance[];
  loadingBalances: boolean;
  pendingHandovers: PendingCashHandover[];
  loadingHandovers: boolean;
  confirmingHandoverId: number | null;
  history: CashHandoverHistoryItem[];
  loadingHistory: boolean;
  // Bump okida re-fetch istorije predaja u WalletHistoryCard-u (poslije confirm /
  // direktne evidencije).
  historyRefreshKey: number;
  // Istorija isplata firme (odgovor §3.6) - isti obrazac kao istorija predaja.
  companyPayouts: CompanyPayout[];
  loadingPayouts: boolean;
  payoutsRefreshKey: number;
  companyId: number | null;
  // Server akcije kao funkcije (ne emit) - dijalozi await-uju i zatvore se tek
  // na uspeh. loadHistory / loadPayouts panel prosleđuje karticama.
  confirmHandover: (
    handoverId: number,
    confirmedAmount: number,
    note?: string
  ) => Promise<boolean>;
  loadHistory: (filters: CashHandoverHistoryFilters) => void;
  loadPayouts: (filters: CompanyPayoutFilters) => void;
  // Akcije iz modala "Detalji kurira" (issue #223636, 4c + 5).
  submittingAction: boolean;
  submitCashReceipt: (courierId: number, amount: number, note?: string) => Promise<boolean>;
  submitPayout: (
    courierId: number,
    amount: number,
    method: string,
    idempotencyKey: string,
    note?: string
  ) => Promise<boolean>;
  // Valuta firme (finance-settings, odgovor 01.09 1.1) - fallback "KM".
  currency: string;
  // Kad je zadan, panel prikazuje samo tu sekciju (stranica "Finansije" je
  // razbija u tabove). Bez propa prikazuje sve 4 kartice jednu ispod druge.
  activeTab?: WalletSection;
}>();

const showSection = (section: WalletSection) =>
  !props.activeTab || props.activeTab === section;

const money = (value: number) => formatAmount(value, props.currency);

// "Saldo gotovine" (ne "Duguje firmi") jer cash_owed_to_company može biti
// negativan = firma duguje kuriru gotovinu (predaja/cash-receipt premašila
// naplatu). Negativne vrijednosti se boje kao kredit.
const balanceHeaders: GlobalTableHeader[] = [
  { key: "courier_id", label: "Kurir", sortable: true },
  { key: "cash_owed_to_company", label: "Saldo gotovine", align: "end", sortable: true },
  { key: "wage_owed_to_courier", label: "Firma duguje kuriru (zarada)", align: "end", sortable: true },
  { key: "actions", label: "", align: "end" },
];

// Ime kurira: prvo iz liste kurira firme (useCompanyCouriers), pa iz samog
// couriers-balance reda (od 01.09 nosi `name` - jedini izvor za "orphan" kurire
// kojih nema u couriers-status), pa fallback "Kurir #id".
const courierName = (courierId: number) => {
  const fromList = toLatin(props.couriers.find((c) => c.courier_id === courierId)?.name);
  if (fromList) return fromList;
  const fromBalance = toLatin(
    props.balances.find((b) => b.courier_id === courierId)?.name ?? ""
  );
  return fromBalance || `Kurir #${courierId}`;
};

// couriers-balance vraća SVE kurire firme, uključujući one sa 0/0 saldom.
// Po defaultu ih sakrivamo (šum) - toggle "Prikaži i nulte" ih vraća. Pretraga
// zaobilazi filter: ako dispečer eksplicitno traži kurira, prikaži ga bez
// obzira na saldo.
const searchQuery = ref("");
const showZeroBalances = ref(false);

const hasBalance = (b: CourierBalance) =>
  b.cash_owed_to_company !== 0 || b.wage_owed_to_courier !== 0;

const filteredBalances = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    return props.balances.filter(
      (balance) =>
        String(balance.courier_id).includes(query) ||
        courierName(balance.courier_id).toLowerCase().includes(query) ||
        (balance.phone ?? "").toLowerCase().includes(query)
    );
  }
  return showZeroBalances.value ? props.balances : props.balances.filter(hasBalance);
});

const balancesEmptyText = computed(() => {
  if (props.balances.length === 0) return "Nema kurira sa evidentiranim balansom.";
  if (searchQuery.value.trim()) return "Nema kurira za zadatu pretragu.";
  return "Svi kuriri su na nuli. Uključi „Prikaži i nulte“ da ih vidiš.";
});

// --- Potvrda predaje ---
const showConfirm = ref(false);
const pendingConfirm = ref<PendingCashHandover | null>(null);
const openConfirm = (handover: PendingCashHandover) => {
  pendingConfirm.value = handover;
  showConfirm.value = true;
};

// --- Detalji kurira (samo prikaz: kontakt, žiro račun, saldo) ---
const showDetails = ref(false);
const detailsBalance = ref<CourierBalance | null>(null);
const detailsCourier = computed(() =>
  detailsBalance.value
    ? props.couriers.find((c) => c.courier_id === detailsBalance.value!.courier_id) ?? null
    : null
);
const openDetails = (balance: CourierBalance) => {
  detailsBalance.value = balance;
  showDetails.value = true;
};

// --- Akcije na redu tabele: "Primio sam gotovinu" (§4c) / "Isplati zaradu" (§5).
// Rade nad balansom (courier_id), pa funkcionišu i za kurira koga nema u listi
// "Kuriri" (npr. uklonjen kurir s otvorenim dugom).
const cashAction = ref<{ mode: "receipt" | "payout"; balance: CourierBalance } | null>(null);
const showCashAction = ref(false);
const openCashAction = (mode: "receipt" | "payout", balance: CourierBalance) => {
  cashAction.value = { mode, balance };
  showCashAction.value = true;
};
</script>

<style scoped>
.handover-list {
  display: flex;
  flex-direction: column;
}

.handover-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid #e7e9ee;
}

.handover-row:last-child {
  border-bottom: none;
}

.handover-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.handover-courier {
  font-weight: 600;
}

.handover-meta {
  font-size: 0.82rem;
  color: #6b7685;
}

.balance-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.balance-search {
  flex: 1 1 220px;
}

.balance-search :deep(.v-field) {
  border-radius: 12px;
  background: #f2f3f7;
  box-shadow: none;
}

.balance-zero-toggle {
  flex: 0 0 auto;
}

.balance-zero-toggle :deep(.v-label) {
  font-size: 0.82rem;
  opacity: 1;
}

.balance-id {
  font-size: 0.78rem;
  font-weight: 600;
  color: #9aa4b2;
  margin-right: 6px;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

/* Negativan saldo gotovine = firma duguje kuriru. */
.cash-credit {
  color: #00b37e;
  font-weight: 600;
}
</style>
