<template>
  <GlobalCard padding="20px">
    <template #title>Dostupne sesije</template>
    <template #subtitle
      >Rezerviši sesiju do dnevnog limita od {{ dailyLimitHours }}h.</template
    >

    <v-row density="comfortable" class="mt-2">
      <v-col cols="12" sm="6">
        <GlobalSelect
          v-model="filterDay"
          :items="days"
          item-title="label"
          item-value="value"
          label="Dan"
          no-data-text="Nema dostupnih dana"
          clearable
        />
      </v-col>
      <v-col cols="12" sm="6">
        <GlobalSelect
          v-model="filterZone"
          :items="zones"
          label="Početna zona"
          no-data-text="Nema dostupnih zona"
          clearable
        />
      </v-col>
    </v-row>

    <v-row v-if="sessions.length > 0">
      <v-col v-for="session in sessions" :key="session.id" cols="12" sm="6" lg="4">
        <v-card class="session-card" flat variant="outlined">
          <div class="session-head">
            <span class="session-date">{{ formatSessionDate(session.date) }}</span>
            <v-chip v-if="session.highDemand" size="small" color="warning" variant="flat">
              <v-icon start icon="mdi-fire" size="14" />
              Visoka potražnja
            </v-chip>
          </div>
          <p class="session-time">{{ session.startTime }}–{{ session.endTime }}</p>
          <p class="session-zone">
            <v-icon icon="mdi-map-marker-outline" size="16" />
            {{ toLatin(session.zone) }}
          </p>
          <GlobalButtonPrimary block size="small" @click="emit('reserve', session)"
            >Rezerviši</GlobalButtonPrimary
          >
        </v-card>
      </v-col>
    </v-row>
    <GlobalEmptyState v-else icon="mdi-calendar-blank-outline">
      Nema dostupnih sesija za izabrani filter.
    </GlobalEmptyState>
  </GlobalCard>
</template>

<script setup lang="ts">
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import type { WorkSession } from "~/types/session";
import { formatSessionDate } from "~/utils/session";

defineProps<{
  sessions: WorkSession[];
  days: Array<{ value: string; label: string }>;
  zones: string[];
  dailyLimitHours: number;
}>();

const emit = defineEmits<{
  reserve: [session: WorkSession];
}>();

const filterDay = defineModel<string | null>("filterDay", { required: true });
const filterZone = defineModel<string | null>("filterZone", { required: true });
</script>

<style scoped>
.session-card {
  padding: 14px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.session-date {
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: capitalize;
}

.session-time {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.session-zone {
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7685;
  font-size: 0.85rem;
}
</style>
