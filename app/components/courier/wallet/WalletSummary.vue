<template>
  <div class="w-sum">
    <!-- Prva pločica: dostave -->
    <div v-if="firstFailed" class="w-sum-t static">
      <b>—</b><span>dostave ne stižu</span>
    </div>
    <div v-else-if="firstLoading" class="w-sum-t static" role="status" aria-busy="true" aria-label="Učitavam dostave">
      <span class="sk" style="height: 18px; width: 70px" />
      <span class="sk" style="height: 12px; width: 90%" />
    </div>
    <button
      v-else
      type="button"
      class="w-sum-t"
      :aria-pressed="filter === 'delivery'"
      @click="emit('toggle', 'delivery')"
    >
      <template v-if="account === 'cash'">
        <template v-if="cash.effect != null">
          <b>+{{ kmText(cash.effect) }}<small>KM</small></b>
          <span>ušlo u dug</span>
          <span class="soft">od {{ kmText(cash.collected) }} naplaćeno</span>
        </template>
        <template v-else>
          <b>{{ kmText(cash.collected) }}<small>KM</small></b>
          <span>naplaćeno · {{ deliveriesLabel(cash.deliveries) }}</span>
        </template>
      </template>
      <template v-else-if="monthlyOnly">
        <b>{{ wage.deliveries }}<small>{{ deliveriesWord }}</small></b>
        <span>plata je mjesečna</span>
      </template>
      <template v-else>
        <b>{{ kmText(wage.earned) }}<small>KM</small></b>
        <span>zarađeno · {{ deliveriesLabel(wage.deliveries) }}</span>
      </template>
    </button>

    <!-- Druga pločica: ono što knjiži račun (predaje / isplate) -->
    <div v-if="secondFailed" class="w-sum-t static">
      <b>—</b><span>{{ account === "cash" ? "predaje" : "isplate" }} ne stižu</span>
    </div>
    <div v-else-if="secondLoading" class="w-sum-t static" role="status" aria-busy="true" aria-label="Učitavam">
      <span class="sk" style="height: 18px; width: 70px" />
      <span class="sk" style="height: 12px; width: 90%" />
    </div>
    <button
      v-else
      type="button"
      class="w-sum-t"
      :aria-pressed="filter === 'settle'"
      @click="emit('toggle', 'settle')"
    >
      <template v-if="account === 'cash'">
        <b>{{ kmText(cash.handed) }}<small>KM</small></b>
        <span>
          predato · {{ handoversLabel(cash.handovers)
          }}<template v-if="cash.waiting > 0"> (+{{ cash.waiting }} čeka)</template>
        </span>
      </template>
      <template v-else>
        <b>{{ kmText(wage.paid) }}<small>KM</small></b>
        <span>isplaćeno · {{ payoutsLabel(wage.payouts) }}</span>
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { pluralizeSr } from "~/utils/datetime";
import { deliveriesLabel } from "~/utils/historyGroups";
import {
  handoversLabel,
  kmText,
  payoutsLabel,
  type CashSummary,
  type WageSummary,
} from "~/utils/walletLedger";
import type { WalletAccount, WalletFilter } from "~/types/wallet-ledger";

// Sažetak izabranog perioda: dvije pločice po računu, a svaka je i filter liste (dodir sužava
// listu, ponovni dodir vraća sve). Izabrana ima plavi okvir; "Prikazano: samo ..." ispod
// liste je izlaz. Pločica čiji izvor ne stiže kaže to, umjesto da pokaže 0.00.
const props = defineProps<{
  account: WalletAccount;
  cash: CashSummary;
  wage: WageSummary;
  filter: WalletFilter | null;
  // Plata se obračunava mjesečno - umjesto zarade broji se dostave.
  monthly: boolean;
  firstLoading: boolean;
  firstFailed: boolean;
  secondLoading: boolean;
  secondFailed: boolean;
}>();

const emit = defineEmits<{ toggle: [filter: WalletFilter] }>();

const monthlyOnly = computed(() => props.monthly && props.wage.earnedRows === 0);
const deliveriesWord = computed(() =>
  pluralizeSr(props.wage.deliveries, "dostava", "dostave", "dostava")
);
</script>

<style scoped>
.w-sum {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.w-sum-t {
  display: grid;
  align-content: start;
  gap: 2px;
  min-width: 0;
  min-height: 62px;
  padding: 11px 12px;
  border: 1.5px solid transparent;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  transition: border-color 0.15s, background 0.15s;
}

.w-sum-t b {
  font-size: 1.02rem;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.w-sum-t b small {
  margin-left: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #5b6676;
}

.w-sum-t span {
  font-size: 0.74rem;
  line-height: 1.3;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.w-sum-t .soft {
  color: #657083;
}

.w-sum-t.static {
  cursor: default;
}

.w-sum-t:not(.static):active {
  background: #f1f4f9;
}

.w-sum-t:not(.static):focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.w-sum-t[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
}

.w-sum-t[aria-pressed="true"] span {
  color: #17408f;
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
  .w-sum-t {
    transition: none;
  }

  .sk {
    animation: none;
  }
}
</style>
