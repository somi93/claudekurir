<template>
  <div class="w-meter">
    <div class="w-track" aria-hidden="true">
      <div class="w-fill" :class="meter.state" :style="{ width: `${meter.percent}%` }" />
    </div>
    <div class="w-mrow">
      <span>Limit {{ kmText(limit) }} KM</span>
      <b :class="meter.state">{{ meter.text }}</b>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CashLimitSummary } from "~/utils/cashLimit";
import { kmText } from "~/utils/walletLedger";

// Gotovina naspram limita firme u tri stanja (u redu do 80%, blizu od 80%, preko od 100%;
// limit 0 je strog) - pravilo je u utils/cashLimit.ts, isto kao na "Danas" na Dostavama.
// Traka je grafika (traži 3:1), a stanje je uvijek napisano i riječima.
defineProps<{
  meter: CashLimitSummary;
  limit: number;
}>();
</script>

<style scoped>
.w-meter {
  display: grid;
  gap: 7px;
}

.w-track {
  height: 8px;
  border-radius: 999px;
  background: #eceef2;
  overflow: hidden;
}

.w-fill {
  height: 100%;
  border-radius: inherit;
  background: #00a073;
  transition: width 0.3s ease;
}

.w-fill.near {
  background: #d97706;
}

.w-fill.over {
  background: #e5484d;
}

.w-mrow {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.w-mrow b {
  color: #0b1220;
  text-align: right;
}

.w-mrow b.near {
  color: #9a4a07;
}

.w-mrow b.over {
  color: #b42318;
}

@media (prefers-reduced-motion: reduce) {
  .w-fill {
    transition: none;
  }
}
</style>
