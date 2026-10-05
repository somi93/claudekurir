<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader title="Dodela narudžbi" back-to="/" back-label="Nazad na početnu" />
    </template>

    <PageAlert v-if="companiesError" closable class="mb-4">
      {{ companiesError }}
    </PageAlert>

    <DispatchBoardPanel
      class="mb-4"
      :waiting-orders="waitingOrders"
      :booked-deliveries="bookedDeliveries"
      :picked-up-deliveries="pickedUpDeliveries"
      :refused-orders="refusedOrders"
      :pending-restaurant-orders="pendingRestaurantOrders"
      :loading="boardLoading"
      :error-message="boardError"
      :last-updated-at="lastUpdatedAt"
      :paused="paused"
      :direct-assigning-order-id="directAssigningOrderId"
      :resolving-order-id="resolvingOrderId"
      :board-action-message="boardActionMessage"
      @select="onSelectWaitingOrder"
      @refresh="refreshBoard"
      @toggle-pause="togglePause"
      @direct-assign="directAssign"
      @resolve-restaurant="onResolveRestaurant"
      @dismiss-board-action-message="boardActionMessage = ''"
    />

    <CandidateCouriersPanel
      ref="candidatePanelRef"
      :order-contexts="candidateOrderContexts"
      :company-id="companyId"
      @accepted="refreshBoard"
    />
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Dodela narudžbi" });

import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import CandidateCouriersPanel from "~/components/dispatcher/assignment/CandidateCouriersPanel.vue";
import DispatchBoardPanel from "~/components/dispatcher/assignment/DispatchBoardPanel.vue";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useDispatchBoard } from "~/composables/useDispatchBoard";
import { buildCandidateOrderContexts } from "~/utils/candidateOrderContext";

const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId, errorMessage: companiesError } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();

const companyId = computed(() => selectedCompanyId.value);

const {
  waitingOrders,
  bookedDeliveries,
  pickedUpDeliveries,
  refusedOrders,
  pendingRestaurantOrders,
  loading: boardLoading,
  errorMessage: boardError,
  lastUpdatedAt,
  paused,
  refresh: refreshBoard,
  togglePause,
  directAssigningOrderId,
  boardActionMessage,
  directAssign,
  resolvingOrderId,
  resolveRestaurant,
} = useDispatchBoard(companyId);

const candidatePanelRef = ref<InstanceType<typeof CandidateCouriersPanel> | null>(null);

// Kontekst svake narudžbe za "Predloženi kuriri" - panel iz njega zna da li
// ponuda uopšte ima smisla (vidi utils/candidateOrderContext.ts).
const candidateOrderContexts = computed(() =>
  buildCandidateOrderContexts({
    waiting: waitingOrders.value,
    pendingRestaurant: pendingRestaurantOrders.value,
    booked: bookedDeliveries.value,
    pickedUp: pickedUpDeliveries.value,
    refused: refusedOrders.value,
  })
);

const onSelectWaitingOrder = (orderId: number) => {
  candidatePanelRef.value?.selectOrder(orderId);
};

const onResolveRestaurant = (payload: {
  orderId: number;
  action: "accept" | "reject";
  note?: string;
}) => resolveRestaurant(payload.orderId, payload.action, payload.note);
</script>
