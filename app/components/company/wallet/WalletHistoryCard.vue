<template>
  <GlobalCard padding="20px">
    <template #title>Istorija predaja</template>
    <template #subtitle>
      Sve predaje gotovine - prijavljene i potvrđene, za rešavanje sporova.
    </template>

    <div class="history-filters mt-2">
      <GlobalSelect
        v-model="courierId"
        :items="courierFilterOptions"
        item-title="label"
        item-value="value"
        label="Kurir"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        class="history-field"
      />
      <GlobalSelect
        v-model="status"
        :items="statusOptions"
        item-title="label"
        item-value="value"
        label="Status"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        class="history-field"
      />
      <GlobalDatePicker
        v-model="from"
        label="Od"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        class="history-field"
      />
      <GlobalDatePicker
        v-model="to"
        label="Do"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        class="history-field"
      />
    </div>

    <GlobalTable
      class="mt-2"
      item-key="id"
      :headers="historyHeaders"
      :items="history"
      :loading="loading"
    >
      <template #item.courier_id="{ value }">
        <span class="balance-id">#{{ value }}</span>
        <span>{{ courierName(value as number) }}</span>
      </template>
      <template #item.reported_amount="{ value }">
        {{ money(Number(value)) }}
      </template>
      <template #item.confirmed_amount="{ item }">
        {{ item.confirmed_amount != null ? money(Number(item.confirmed_amount)) : "—" }}
      </template>
      <template #item.reported_at="{ value }">
        {{ formatDateTime(value as string) }}
      </template>
      <template #item.status="{ value }">
        <v-chip
          size="x-small"
          variant="tonal"
          :color="value === 'confirmed' ? 'success' : 'warning'"
        >
          {{ value === "confirmed" ? "Potvrđeno" : "Na čekanju" }}
        </v-chip>
      </template>
      <template #item.confirmed_by="{ item }">
        {{ confirmedByLabel(item) }}
      </template>
      <template #empty>
        <GlobalEmptyState icon="mdi-history">Nema predaja za zadati filter.</GlobalEmptyState>
      </template>
    </GlobalTable>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import GlobalTable, { type GlobalTableHeader } from "~/components/common/GlobalTable.vue";
import GlobalDatePicker from "~/components/common/GlobalDatePicker.vue";
import { formatAmount } from "~/utils/currency";
import { formatDateTime } from "~/utils/datetime";
import type { CompanyCourier } from "~/types/company-courier";
import type {
  CashHandoverHistoryFilters,
  CashHandoverHistoryItem,
  CashHandoverStatus,
} from "~/types/cash-handover";

const props = defineProps<{
  couriers: CompanyCourier[];
  history: CashHandoverHistoryItem[];
  loading: boolean;
  companyId: number | null;
  // Bump izvana (poslije confirm / direktne evidencije) → re-fetch sa trenutnim
  // filterima.
  refreshKey: number;
  // Valuta firme (finance-settings) - fallback "KM".
  currency: string;
}>();

const money = (value: number) => formatAmount(value, props.currency);

const emit = defineEmits<{ load: [filters: CashHandoverHistoryFilters] }>();

const historyHeaders: GlobalTableHeader[] = [
  { key: "courier_id", label: "Kurir", sortable: true },
  { key: "reported_amount", label: "Prijavljeno", align: "end", sortable: true },
  { key: "confirmed_amount", label: "Potvrđeno", align: "end", sortable: true },
  { key: "reported_at", label: "Datum", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "confirmed_by", label: "Potvrdio", sortable: true },
];

const courierName = (courierId: number) =>
  toLatin(props.couriers.find((c) => c.courier_id === courierId)?.name) ||
  `Kurir #${courierId}`;

// "Ko je potvrdio" - ime iz odgovora, fallback na #id, "—" dok je na čekanju
// (odgovor §3.5, "Istorija predaja" služi za rješavanje sporova).
const confirmedByLabel = (item: CashHandoverHistoryItem) => {
  if (item.confirmed_by_name) return toLatin(item.confirmed_by_name);
  if (item.confirmed_by != null) return `#${item.confirmed_by}`;
  return "—";
};

const courierId = ref<number | null>(null);
const status = ref<CashHandoverStatus | null>(null);
// GlobalDatePicker radi sa "YYYY-MM-DD" stringom; prazno = filter nije postavljen.
const from = ref("");
const to = ref("");

const courierFilterOptions = computed(() =>
  props.couriers.map((c) => ({ label: `#${c.courier_id} ${toLatin(c.name)}`, value: c.courier_id }))
);
const statusOptions = [
  { label: "Na čekanju", value: "pending" as const },
  { label: "Potvrđeno", value: "confirmed" as const },
];

watch(
  [courierId, status, from, to, () => props.companyId, () => props.refreshKey],
  () => {
    if (!props.companyId) return;
    emit("load", {
      courierId: courierId.value,
      status: status.value,
      from: from.value || null,
      to: to.value || null,
    });
  },
  { immediate: true }
);
</script>

<style scoped>
.history-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-field {
  flex: 1 1 160px;
  min-width: 140px;
}

.history-field :deep(.v-field) {
  border-radius: 12px;
  background: #f2f3f7;
  box-shadow: none;
}

.balance-id {
  font-size: 0.78rem;
  font-weight: 600;
  color: #9aa4b2;
  margin-right: 6px;
}
</style>
