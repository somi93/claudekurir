<template>
  <section class="hs" aria-label="Sažetak">
    <div class="hs-top">
      <span class="hs-eyebrow">{{ mode === "wage" || pending ? "Zarada" : "Dostave" }}</span>
      <span class="hs-range">{{ range }}</span>
    </div>

    <!-- Zarada još stiže: oblik sažetka je isti, samo su brojevi sjenke. -->
    <div v-if="pending" class="hs-loading" role="status" aria-label="Učitavam zaradu">
      <span class="sk" style="height: 34px; width: 170px" />
      <div class="hs-stats">
        <span v-for="n in 3" :key="n" class="sk" style="height: 54px; border-radius: 14px" />
      </div>
    </div>

    <template v-else>
      <div class="hs-hero">
        <div v-if="mode === 'wage'" class="hs-num">{{ money(summary.wage) }}<small>KM</small></div>
        <div v-else-if="mode === 'monthly'" class="hs-num hs-num--plain">
          {{ summary.count }}<small>{{ countWord }}</small>
        </div>
        <div v-else class="hs-num hs-num--none" role="img" aria-label="Zarada nije dostupna">
          —<small>KM</small>
        </div>

        <div v-if="trend" class="hs-trend">
          <span class="hs-delta" :class="{ 'hs-delta--down': trend.delta < 0 }">
            <v-icon :icon="trend.delta < 0 ? 'mdi-arrow-down' : 'mdi-arrow-up'" size="16" />
            {{ trend.delta < 0 ? "−" : "+" }}{{ money(Math.abs(trend.delta)) }} KM
          </span>
          <span>prošle sedmice do ove tačke: {{ money(trend.previous) }} KM</span>
        </div>
      </div>

      <div v-if="note" class="hs-note">
        <v-icon icon="mdi-information-outline" size="20" />
        <span>{{ note }}</span>
      </div>

      <div class="hs-stats">
        <div v-for="cell in cells" :key="cell.label" class="hs-stat">
          <b
            >{{ cell.value }}<small v-if="cell.unit">{{ cell.unit }}</small></b
          >
          <span>{{ cell.label }}</span>
        </div>
      </div>

      <slot />

      <div v-if="km != null" class="hs-km">
        <v-icon icon="mdi-map-marker-distance" size="18" />
        <span>Pređeno oko {{ Math.round(km) }} km</span>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { pluralizeSr } from "~/utils/datetime";
import {
  money,
  type HistorySummary,
  type MoneyMode,
  type SummaryCell,
  type WeekTrend,
} from "~/utils/historyGroups";

// Sažetak izabranog perioda: glavni broj (zarada, ili broj dostava kad se plata
// obračunava mjesečno), trend naspram iste tačke prošle sedmice, tri male ćelije i
// (u slotu) grafikon. Cijeli je tekstualan - grafikon samo dodaje pogled.
const props = defineProps<{
  summary: HistorySummary;
  mode: MoneyMode;
  pending: boolean;
  range: string;
  trend: WeekTrend | null;
  cells: SummaryCell[];
  note: string | null;
  km: number | null;
}>();

const countWord = computed(() =>
  pluralizeSr(props.summary.count, "dostava", "dostave", "dostava")
);
</script>

<style scoped>
.hs {
  display: grid;
  gap: 14px;
  padding: 16px;
  color: #0b1220;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.hs-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.hs-eyebrow {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6676;
}

.hs-range {
  font-size: 0.76rem;
  font-weight: 600;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.hs-hero {
  display: grid;
  gap: 6px;
}

/* Zelena za tekst je #00734f (7:1 na bijeloj); #00b37e iz oznake marke bi bio 2.7:1. */
.hs-num {
  font-size: 2.15rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  color: #00734f;
  font-variant-numeric: tabular-nums;
}

.hs-num small {
  margin-left: 5px;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0;
  color: #5b6676;
}

.hs-num--plain {
  color: #0b1220;
}

.hs-num--none {
  font-weight: 600;
  color: #657083;
}

.hs-trend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #5b6676;
}

.hs-delta {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 9px 0 6px;
  border-radius: 999px;
  background: #e3f8ef;
  color: #00734f;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.hs-delta--down {
  background: #f1f3f6;
  color: #5b6676;
}

.hs-note {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  font-size: 0.82rem;
  line-height: 1.4;
  color: #5b6676;
}

.hs-note :deep(.v-icon) {
  color: #2459c7;
}

.hs-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.hs-stat {
  display: grid;
  align-content: start;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f5f6f8;
}

.hs-stat b {
  font-size: 1rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.hs-stat b small {
  margin-left: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #5b6676;
}

.hs-stat span {
  font-size: 0.72rem;
  color: #5b6676;
}

.hs-km {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #5b6676;
}

.hs-loading {
  display: grid;
  gap: 14px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: hs-shimmer 1.3s linear infinite;
}

@keyframes hs-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
