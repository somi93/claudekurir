<template>
  <DeliveryPage :max-width="1040">
    <template #header>
      <PageHeader title="Sesije" back-to="/" back-label="Nazad na početnu" />
    </template>

    <div v-if="loading" class="panel-skeleton">
        <v-skeleton-loader type="card" class="mb-4" />
        <v-skeleton-loader type="list-item-two-line@3" />
      </div>

      <GlobalEmptyState v-else-if="errorMessage" icon="mdi-alert-circle-outline">
        {{ errorMessage }}
        <template #action>
          <v-btn variant="tonal" size="small" @click="refresh">Pokušaj ponovo</v-btn>
        </template>
      </GlobalEmptyState>

      <template v-else>
        <AvailableSessionsPanel
          v-model:filter-day="filterDay"
          v-model:filter-zone="filterZone"
          :sessions="filteredAvailableSessions"
          :days="dayOptions"
          :zones="SESSION_ZONES"
          :daily-limit-hours="SESSION_DAILY_LIMIT_HOURS"
          class="mb-4"
          @reserve="reserveSession"
        />

        <MySessionsPanel
          :sessions="mySessions"
          @offer-swap="offerSwap"
          @cancel="cancelReservedSession"
        />
      </template>
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Sesije" });

import { computed, ref } from "vue";
import { useSessionStore } from "~/stores/session";
import { formatSessionDate } from "~/utils/session";
import AvailableSessionsPanel from "~/components/sessions/AvailableSessionsPanel.vue";
import MySessionsPanel from "~/components/sessions/MySessionsPanel.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import { SESSION_DAILY_LIMIT_HOURS, SESSION_ZONES } from "~/config/session";
import { useCourierSessions } from "~/composables/useCourierSessions";

const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

const {
  availableSessions,
  mySessions,
  loading,
  errorMessage,
  refresh,
  reserveSession,
  offerSwap,
  cancelReservedSession,
} = useCourierSessions(courierId);

const filterDay = ref<string | null>(null);
const filterZone = ref<string | null>(null);

const dayOptions = computed(() => {
  const seen = new Map<string, string>();
  availableSessions.value.forEach((session) => {
    if (!seen.has(session.date)) {
      seen.set(session.date, formatSessionDate(session.date));
    }
  });
  return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
});

const filteredAvailableSessions = computed(() =>
  availableSessions.value.filter((session) => {
    if (filterDay.value && session.date !== filterDay.value) return false;
    if (filterZone.value && toLatin(session.zone) !== filterZone.value) return false;
    return true;
  })
);
</script>

<style scoped>
.panel-skeleton {
  border-radius: 24px;
}
</style>
