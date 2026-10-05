<template>
  <GlobalPage :max-width="900">
    <template #header>
      <PageHeader :title="`Narudžba #${orderId}`" back-to="/admin/orders" back-label="Nova pretraga">
        <template #actions>
          <v-btn size="small" variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="load(orderId)">
            Osveži
          </v-btn>
        </template>
      </PageHeader>
    </template>

    <PageAlert v-if="notFound" type="warning" class="mb-4">
      Narudžba #{{ orderId }} nije pronađena.
    </PageAlert>
    <PageAlert v-else-if="errorMessage" class="mb-4">{{ errorMessage }}</PageAlert>

    <template v-else>
      <v-card v-if="order" variant="tonal" class="mb-5 order-summary" rounded="lg">
        <v-card-text class="d-flex flex-wrap ga-6">
          <div>
            <div class="summary-label">Status</div>
            <div class="summary-value">{{ order.state }}</div>
          </div>
          <div>
            <div class="summary-label">Firma</div>
            <div class="summary-value">{{ order.delivery_company_id ?? "—" }}</div>
          </div>
          <div>
            <div class="summary-label">Kurir</div>
            <div class="summary-value">{{ order.delivery_user_id ?? "—" }}</div>
          </div>
          <div>
            <div class="summary-label">Kreirana</div>
            <div class="summary-value">{{ formatDateTime(order.created_at) }}</div>
          </div>
        </v-card-text>
      </v-card>

      <div v-if="loading" class="d-flex justify-center py-10">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <v-empty-state
        v-else-if="events.length === 0"
        icon="mdi-timeline-text-outline"
        title="Nema zabeleženih događaja"
        text="Za ovu narudžbu još ništa nije upisano u istoriju."
      />

      <v-timeline v-else side="end" align="start" density="comfortable" truncate-line="both">
        <v-timeline-item
          v-for="event in events"
          :key="event.id"
          :dot-color="failedRecipientIds(event).length > 0 ? 'error' : getOrderEventMeta(event.event_type).color"
          :icon="getOrderEventMeta(event.event_type).icon"
          size="small"
          fill-dot
        >
          <div class="event-card">
            <div class="event-head">
              <span class="event-title">{{ getOrderEventMeta(event.event_type).label }}</span>
              <span class="event-time">{{ formatDateTime(event.created_at) }}</span>
            </div>

            <div v-if="event.actor_name || event.actor_type" class="event-actor">
              <v-icon icon="mdi-account-outline" size="14" />
              {{ event.actor_name || actorTypeLabel(event.actor_type) }}
            </div>

            <v-chip
              v-if="failedRecipientIds(event).length > 0"
              size="x-small"
              color="error"
              variant="flat"
              prepend-icon="mdi-bell-off-outline"
              class="mt-1"
            >
              Nije stiglo: {{ failedRecipientIds(event).join(", ") }}
            </v-chip>

            <v-btn
              v-if="event.payload && Object.keys(event.payload).length > 0"
              size="x-small"
              variant="text"
              class="event-toggle"
              @click="toggleExpanded(event.id)"
            >
              {{ expandedIds.has(event.id) ? "Sakrij detalje" : "Detalji" }}
            </v-btn>

            <pre v-if="expandedIds.has(event.id)" class="event-payload">{{ formatPayload(event.payload) }}</pre>
          </div>
        </v-timeline-item>
      </v-timeline>
    </template>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Admin · Istorija narudžbe" });

import { computed, onMounted, reactive, watch } from "vue";
import { useRoute } from "nuxt/app";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import { useOrderEvents } from "~/composables/useOrderEvents";
import { getOrderEventMeta } from "~/utils/orderEventMeta";
import type { OrderEvent } from "~/types/order-events";

const route = useRoute();
const orderId = computed(() => Number(route.params.id));

const { order, events, loading, notFound, errorMessage, load } = useOrderEvents();

const expandedIds = reactive(new Set<number>());
const toggleExpanded = (id: number) => {
  if (expandedIds.has(id)) expandedIds.delete(id);
  else expandedIds.add(id);
};

const actorTypeLabel = (actorType: string | null) => {
  if (actorType === "courier") return "Kurir";
  if (actorType === "dispatcher") return "Dispečer";
  return actorType ?? "";
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const formatPayload = (payload: Record<string, unknown> | null) => JSON.stringify(payload, null, 2);

// notification.push_summary/offer.batch_dispatched nose ovo polje kad neko
// nije dobio nijedan push (nema registrovan uredjaj ili ga je FCM odbio) -
// vidi App\Support\FcmService::sendToUser na backendu.
const failedRecipientIds = (event: OrderEvent): number[] => {
  const payload = event.payload;
  if (!payload) return [];
  const ids = payload.failed_recipient_ids ?? payload.failed_courier_ids;
  return Array.isArray(ids) ? (ids as number[]) : [];
};

watch(orderId, (id) => {
  if (Number.isFinite(id)) load(id);
});

onMounted(() => {
  if (Number.isFinite(orderId.value)) load(orderId.value);
});
</script>

<style scoped>
.order-summary .summary-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7685;
  margin-bottom: 2px;
}

.order-summary .summary-value {
  font-weight: 700;
  font-size: 0.95rem;
}

.event-card {
  padding-bottom: 4px;
}

.event-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.event-title {
  font-weight: 700;
  font-size: 0.92rem;
}

.event-time {
  font-size: 0.76rem;
  color: #9aa4b2;
}

.event-actor {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: #6b7685;
  margin-top: 2px;
}

.event-toggle {
  margin-top: 2px;
  margin-left: -8px;
}

.event-payload {
  margin-top: 6px;
  padding: 10px 12px;
  background: #f2f3f7;
  border-radius: 10px;
  font-size: 0.76rem;
  overflow-x: auto;
  white-space: pre;
}
</style>
