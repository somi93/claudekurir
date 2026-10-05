<template>
  <GlobalCard padding="20px">
    <template #title>Moje sesije</template>
    <template #subtitle>Pregled rezervisanih i odrađenih sesija po nedeljama.</template>

    <div v-if="groupedSessions.length > 0">
      <div v-for="group in groupedSessions" :key="group.weekLabel" class="week-group">
        <p class="week-label">{{ group.weekLabel }}</p>
        <v-list class="sessions-list" lines="two">
          <v-list-item
            v-for="session in group.sessions"
            :key="session.id"
            rounded="lg"
            class="session-item"
          >
            <template #prepend>
              <v-avatar
                :color="SESSION_STATUS_META[session.status].color"
                variant="tonal"
              >
                <v-icon :icon="SESSION_STATUS_META[session.status].icon" />
              </v-avatar>
            </template>

            <v-list-item-title>
              {{ formatSessionDate(session.date) }} · {{ session.startTime }}–{{
                session.endTime
              }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ toLatin(session.zone) }}</v-list-item-subtitle>

            <template #append>
              <v-chip
                size="small"
                :color="SESSION_STATUS_META[session.status].color"
                variant="tonal"
                class="mr-2"
              >
                {{ SESSION_STATUS_META[session.status].label }}
              </v-chip>
              <template v-if="session.status === 'reserved'">
                <v-btn
                  v-if="!session.offeredForSwap"
                  size="small"
                  variant="text"
                  @click="emit('offer-swap', session)"
                >
                  Ponudi zamenu
                </v-btn>
                <v-chip v-else size="small" variant="outlined" class="mr-2">
                  Ponuđeno
                </v-chip>
                <v-btn
                  size="small"
                  variant="text"
                  color="error"
                  @click="emit('cancel', session)"
                >
                  Otkaži
                </v-btn>
              </template>
            </template>
          </v-list-item>
        </v-list>
      </div>

      <p class="swap-note">
        Ponuda zamene se automatski otkazuje ako je poslata &gt;12h pre starta sesije -
        inače moraš odraditi sesiju (no-show utiče na tvoj score).
      </p>
    </div>
    <GlobalEmptyState v-else icon="mdi-clock-outline">
      Još nema rezervisanih ili odrađenih sesija.
    </GlobalEmptyState>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import type { WorkSession } from "~/types/session";
import { formatSessionDate, SESSION_STATUS_META } from "~/utils/session";

const props = defineProps<{
  sessions: WorkSession[];
}>();

const emit = defineEmits<{
  "offer-swap": [session: WorkSession];
  cancel: [session: WorkSession];
}>();

const getWeekStart = (isoDate: string) => {
  const date = new Date(isoDate);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday.toISOString().slice(0, 10);
};

const groupedSessions = computed(() => {
  const groups = new Map<string, WorkSession[]>();
  for (const session of props.sessions) {
    const key = getWeekStart(session.date);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(session);
    } else {
      groups.set(key, [session]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, sessions]) => ({
      weekLabel: `Nedelja od ${formatSessionDate(weekStart)}`,
      sessions: [...sessions].sort((a, b) => a.date.localeCompare(b.date)),
    }));
});
</script>

<style scoped>
.global-card :deep(.panel-subtitle) {
  margin-bottom: 8px;
}

.week-group {
  margin-top: 14px;
}

.week-label {
  margin: 0 0 6px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9aa4b2;
}

.sessions-list {
  background: transparent;
  display: grid;
  gap: 6px;
}

.session-item {
  border: 1px solid #e7e9ee;
}

.swap-note {
  margin: 16px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
  line-height: 1.5;
}
</style>
