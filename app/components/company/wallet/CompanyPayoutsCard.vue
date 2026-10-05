<template>
  <GlobalCard padding="20px">
    <template #title>Isplate kuririma</template>
    <template #subtitle>
      Sve isplate zarade na nivou firme - za pregled i rešavanje sporova.
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
      :headers="payoutHeaders"
      :items="payouts"
      :loading="loading"
    >
      <template #item.courier_id="{ value }">
        <span class="balance-id">#{{ value }}</span>
        <span>{{ courierName(value as number) }}</span>
      </template>
      <template #item.amount="{ value }">
        {{ money(Number(value)) }}
      </template>
      <template #item.note="{ value }">
        {{ value || "—" }}
      </template>
      <template #item.created_at="{ value }">
        {{ formatDateTime(value as string) }}
      </template>
      <template #empty>
        <GlobalEmptyState icon="mdi-cash-multiple">
          Nema isplata za zadati filter.
        </GlobalEmptyState>
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
import type { CompanyPayout, CompanyPayoutFilters } from "~/types/payout";

const props = defineProps<{
  couriers: CompanyCourier[];
  payouts: CompanyPayout[];
  loading: boolean;
  companyId: number | null;
  // Bump izvana (poslije nove isplate) → re-fetch sa trenutnim filterima.
  refreshKey: number;
  // Valuta firme (finance-settings) - fallback "KM".
  currency: string;
}>();

const money = (value: number) => formatAmount(value, props.currency);

const emit = defineEmits<{ load: [filters: CompanyPayoutFilters] }>();

const payoutHeaders: GlobalTableHeader[] = [
  { key: "courier_id", label: "Kurir", sortable: true },
  { key: "amount", label: "Iznos", align: "end", sortable: true },
  { key: "note", label: "Napomena", sortable: false },
  { key: "created_at", label: "Datum", sortable: true },
];

const courierName = (courierId: number) =>
  toLatin(props.couriers.find((c) => c.courier_id === courierId)?.name) ||
  `Kurir #${courierId}`;

const courierId = ref<number | null>(null);
// GlobalDatePicker radi sa "YYYY-MM-DD" stringom; prazno = filter nije postavljen.
const from = ref("");
const to = ref("");

const courierFilterOptions = computed(() =>
  props.couriers.map((c) => ({ label: `#${c.courier_id} ${toLatin(c.name)}`, value: c.courier_id }))
);

watch(
  [courierId, from, to, () => props.companyId, () => props.refreshKey],
  () => {
    if (!props.companyId) return;
    emit("load", {
      courierId: courierId.value,
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
