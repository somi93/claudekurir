<template>
  <DeliveryPage :max-width="720">
    <template #header>
      <PageHeader title="Scoring" back-to="/" back-label="Nazad na početnu" />
    </template>

    <div v-if="loading" class="score-skeleton">
      <v-skeleton-loader type="card" class="mb-4" />
      <v-skeleton-loader type="list-item@4" />
    </div>

    <GlobalCard v-else-if="notAvailable">
      <GlobalEmptyState icon="mdi-chart-timeline-variant" title="Scoring podaci još nisu dostupni">
        Tvoj score se računa nedeljnim obračunom - pojaviće se ovde nakon prve nedelje
        aktivnosti.
      </GlobalEmptyState>
    </GlobalCard>

    <GlobalCard v-else-if="errorMessage">
      <GlobalEmptyState icon="mdi-alert-circle-outline">
        {{ errorMessage }}
        <template #action>
          <v-btn variant="tonal" size="small" @click="refresh">Pokušaj ponovo</v-btn>
        </template>
      </GlobalEmptyState>
    </GlobalCard>

    <template v-else>
      <GlobalCard padding="20px" class="mb-4 batch-panel">
        <div class="batch-copy">
          <p class="eyebrow">Scoring / Batch sistem</p>
          <h1 class="batch-title">Tvoj batch ove nedelje</h1>
          <p class="batch-lede">
            Na osnovu score-a od prošle nedelje ({{ lastWeekScore }}/100). Batch 1 ima
            prvi pick sesija.
          </p>
        </div>
        <div class="batch-badge">
          <span class="batch-number">{{ currentBatch }}</span>
          <span class="batch-label">Batch</span>
        </div>
      </GlobalCard>

      <GlobalCard padding="20px" class="mb-4">
        <template #title>Otvaranje sesija po batch-evima</template>
        <template #subtitle>
          Sesije se otvaraju postepeno, na 30 minuta po batch-u. Tvoj batch je istaknut.
        </template>

        <div class="batch-list">
          <div
            v-for="slot in batchSchedule"
            :key="slot.batch"
            class="batch-row"
            :class="{ 'is-mine': slot.batch === currentBatch }"
          >
            <span class="batch-row-number">Batch {{ slot.batch }}</span>
            <span class="batch-row-time">{{ slot.opensAt }}</span>
            <v-chip
              v-if="slot.batch === currentBatch"
              size="small"
              color="primary"
              variant="flat"
            >
              Tvoj batch
            </v-chip>
          </div>
        </div>
      </GlobalCard>

      <GlobalCard padding="20px">
        <template #title>Faktori score-a</template>
        <template #subtitle>
          Ovi faktori iz prošle nedelje određuju tvoj batch za narednu nedelju.
        </template>

        <div class="factor-list">
          <div v-for="factor in scoreFactors" :key="factor.key" class="factor-row">
            <div class="factor-icon" :class="{ negative: !factor.positive }">
              <v-icon :icon="factor.icon" size="18" />
            </div>
            <span class="factor-label">{{ factor.label }}</span>
            <span class="factor-value" :class="{ negative: !factor.positive }">
              {{ factor.value }}
            </span>
          </div>
        </div>
      </GlobalCard>
    </template>
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Scoring" });

import { computed } from "vue";
import { useSessionStore } from "~/stores/session";
import { useCourierScoring } from "~/composables/useCourierScoring";
import PageHeader from "~/components/common/PageHeader.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";

const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

const {
  currentBatch,
  lastWeekScore,
  scoreFactors,
  loading,
  notAvailable,
  errorMessage,
  refresh,
  batchSchedule,
} = useCourierScoring(courierId);
</script>

<style scoped>
.batch-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.batch-copy {
  flex: 1 1 220px;
  min-width: 0;
}

.eyebrow {
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  font-weight: 700;
  color: #9aa4b2;
}

.batch-title {
  margin: 0;
  font-size: 1.3rem;
  letter-spacing: -0.02em;
}

.batch-lede {
  margin: 4px 0 0;
  color: #6b7685;
  font-size: 0.9rem;
}

.batch-badge {
  flex-shrink: 0;
  width: 76px;
  height: 76px;
  border-radius: 20px;
  background: #0b1220;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.batch-number {
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1;
}

.batch-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

.global-card :deep(.panel-subtitle) {
  margin-bottom: 8px;
}

.batch-list {
  display: grid;
  gap: 2px;
  margin-top: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.batch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
}

.batch-row.is-mine {
  background: #eef3ff;
}

.batch-row-number {
  font-weight: 700;
  font-size: 0.88rem;
  width: 80px;
}

.batch-row-time {
  flex: 1;
  color: #6b7685;
  font-size: 0.85rem;
}

.factor-list {
  display: grid;
  gap: 2px;
  margin-top: 8px;
}

.factor-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #eceef2;
}

.factor-row:last-child {
  border-bottom: none;
}

.factor-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #e3f8ef;
  color: #00b37e;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.factor-icon.negative {
  background: #fdecec;
  color: #ef4444;
}

.factor-label {
  flex: 1;
  font-size: 0.9rem;
  color: #0b1220;
}

.factor-value {
  font-weight: 800;
  color: #00b37e;
}

.factor-value.negative {
  color: #ef4444;
}
</style>
