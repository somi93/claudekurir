<template>
  <v-card class="coverage-card" flat>
    <div class="coverage-head">
      <p class="coverage-title">Pokrivenost po zonama uživo</p>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="emit('refresh')"
      >
        Osvježi
      </v-btn>
    </div>

    <div v-if="loading && coverage.length === 0" class="coverage-loading">
      <v-progress-circular indeterminate color="primary" size="28" />
    </div>
    <GlobalEmptyState v-else-if="coverage.length === 0" icon="mdi-access-point-off">
      Nema podataka o pokrivenosti.
    </GlobalEmptyState>

    <div v-else class="coverage-grid">
      <div v-for="zone in coverage" :key="zone.zoneId" class="coverage-row">
        <p class="zone-name">{{ toLatin(zone.zoneName) }}</p>
        <div class="coverage-chips">
          <v-chip size="small" variant="flat" color="info">
            {{ zone.delivering }} u dostavi
          </v-chip>
          <v-chip size="small" variant="flat" color="success">
            {{ zone.online }} slobodni
          </v-chip>
          <v-chip size="small" variant="flat" color="warning">
            {{ zone.idle }} neaktivni
          </v-chip>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import type { ZoneLiveCoverage } from "~/types/dispatcherZone";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";

defineProps<{
  coverage: ZoneLiveCoverage[];
  loading: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();
</script>

<style scoped>
.coverage-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  padding: 20px;
}

.coverage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.coverage-title {
  margin: 0;
  font-weight: 800;
}

.coverage-loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.coverage-grid {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.coverage-row {
  padding: 10px 14px;
  border: 1px solid #e7e9ee;
  border-radius: 16px;
}

.zone-name {
  margin: 0 0 6px;
  font-weight: 700;
}

.coverage-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
