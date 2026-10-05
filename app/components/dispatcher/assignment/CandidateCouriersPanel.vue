<template>
  <GlobalCard ref="rootRef" padding="20px">
    <template #title>Predloženi kuriri</template>
    <template #subtitle>
      Unesi ID narudžbe da vidiš rangiranu listu kurira za nju - najbolji predlog prvi,
      niko nije isključen sa liste.
    </template>

    <div class="d-flex ga-3 align-center flex-wrap mt-3">
      <GlobalTextField
        v-model.number="orderId"
        type="number"
        label="ID narudžbe"
        style="max-width: 200px"
        hide-details
        density="compact"
        @keydown.enter="load"
      />
      <GlobalButtonPrimary :loading="loading" :disabled="!orderId" @click="load">
        Prikaži kandidate
      </GlobalButtonPrimary>
      <v-btn
        v-if="searched"
        variant="text"
        :loading="loading"
        :disabled="!orderId"
        @click="load"
      >
        <v-icon start icon="mdi-refresh" />
        Osveži
      </v-btn>
    </div>

    <PageAlert v-if="errorMessage" class="mt-4">
      {{ errorMessage }}
    </PageAlert>

    <PageAlert
      v-if="assignMessage"
      :type="assignSuccess ? 'success' : 'error'"
      class="mt-4"
      closable
      @close="assignMessage = ''"
    >
      {{ assignMessage }}
    </PageAlert>

    <PageAlert
      v-if="offerMessage"
      :type="offerMessageType"
      class="mt-4"
      closable
      @close="offerMessage = ''"
    >
      {{ offerMessage }}
    </PageAlert>

    <PageAlert
      v-if="skippedNotes.length > 0"
      type="warning"
      class="mt-4"
      closable
      @close="dismissSkipped"
    >
      <div class="font-weight-medium">Ovi kuriri nisu dobili ponudu:</div>
      <ul class="skipped-list">
        <li v-for="note in skippedNotes" :key="note">{{ note }}</li>
      </ul>
    </PageAlert>

    <PageAlert v-if="orderStateNote" :type="orderStateNote.type" class="mt-4">
      {{ orderStateNote.text }}
    </PageAlert>

    <div v-if="loading && candidates.length === 0" class="candidates-skeleton">
      <v-skeleton-loader v-for="n in 4" :key="n" type="list-item-avatar-two-line" />
    </div>

    <template v-else-if="candidates.length > 0">
      <CandidateFiltersBar
        v-model:search-query="searchQuery"
        v-model:sort-mode="sortMode"
        v-model:status-filters="statusFilters"
        v-model:vehicle-filters="vehicleFilters"
        :vehicle-filter-options="vehicleFilterOptions"
      />

      <OfferRoundBar
        v-model:offer-mode="offerMode"
        :disabled="offerRoundLocked"
        :send-disabled="selectedCourierIds.length === 0 || offersDisabled || offerRoundLocked"
        :sending="offerSending"
        :selected-count="selectedCourierIds.length"
        :round-active="offerRoundActiveHere"
        :round-live="offerRoundCancelable"
        :can-cancel="offerRoundCancelable"
        :round-chip="roundChip"
        :round-candidate-ids="roundCandidateIds"
        @send="sendOffer"
        @close-round="closeRound"
      />

      <AcceptedCourierCard
        v-if="offerRoundAccepted"
        :candidate="acceptedCandidate"
        :courier-id="acceptedOffer?.courierId ?? null"
      />

      <div class="d-flex justify-end mt-2">
        <v-btn-toggle v-model="viewMode" mandatory density="compact" variant="outlined" divided>
          <v-btn value="list" size="small">
            <v-icon start icon="mdi-view-list-outline" size="16" />
            Lista
          </v-btn>
          <v-btn value="track" size="small">
            <v-icon start icon="mdi-timeline-outline" size="16" />
            Tok
          </v-btn>
        </v-btn-toggle>
      </div>

      <OfferRoundTrack
        v-if="viewMode === 'track' && visibleCandidates.length > 0"
        :candidates="visibleCandidates"
        :groups="candidateGroups"
        :offer-status-for="offerStatusFor"
        :offer-chip-for="offerChipFor"
        :round-chip="roundChip"
        :round-active="offerRoundActiveHere"
        :mode="offerMode"
        :selected-set="selectedSet"
        :locked="offerRoundLocked"
        :policy="offerPolicy"
        @toggle-select="toggleSelected"
        @toggle-group="toggleGroupSelected"
      />

      <div v-else-if="visibleCandidates.length > 0" class="candidate-groups">
        <!-- Lista je podijeljena u iste sekcije kao "Tok" (utils/candidateGroups). -->
        <section
          v-for="(group, groupIndex) in candidateGroups"
          :key="group.key"
          class="candidate-group"
        >
          <CandidateGroupHeader
            :number="groupIndex + 1"
            :title="group.title"
            :count="group.candidates.length"
            :total="visibleCandidates.length"
            :hint="group.hint"
            :selection="groupSelection(group)"
            aligned
            @toggle-all="toggleGroupSelected(group)"
          />
          <v-list class="candidates-list" lines="two">
            <CandidateListItem
              v-for="candidate in group.candidates"
              :key="candidate.courierId"
              :candidate="candidate"
              :block-reasons="offerBlockReasons(candidate, offerPolicy)"
              :send-locked="isOfferSendLocked(candidate, offerPolicy)"
              :selected="selectedSet.has(candidate.courierId)"
              :locked="offerRoundLocked"
              :offer-chip="offerChipFor(candidate.courierId)"
              :offer-status="offerStatusFor(candidate.courierId)"
              :assigning="assigningCourierId === candidate.courierId"
              :offering="offerSendingCourierId === candidate.courierId"
              :actions-disabled="
                assigningCourierId !== null || offerSending || offersDisabled || offerRoundAccepted
              "
              @toggle-select="toggleSelected(candidate.courierId)"
              @offer-one="onOfferOne(candidate)"
            />
          </v-list>
        </section>
      </div>
      <GlobalEmptyState v-else icon="mdi-filter-remove-outline">
        Nijedan kandidat ne odgovara izabranoj pretrazi/filteru.
      </GlobalEmptyState>
    </template>
    <GlobalEmptyState
      v-else-if="searched && !loading && !errorMessage"
      icon="mdi-account-search-outline"
    >
      Nema kandidata za ovu narudžbu.
    </GlobalEmptyState>
    <GlobalEmptyState
      v-else-if="!searched && !loading && !errorMessage"
      icon="mdi-account-search-outline"
      title="Još nema pretrage"
    >
      Unesi ID narudžbe i klikni „Prikaži kandidate“ da vidiš rangiranu listu kurira za
      nju.
    </GlobalEmptyState>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import CandidateFiltersBar from "./candidates/CandidateFiltersBar.vue";
import OfferRoundBar from "./candidates/OfferRoundBar.vue";
import OfferRoundTrack from "./candidates/OfferRoundTrack.vue";
import CandidateGroupHeader from "./candidates/CandidateGroupHeader.vue";
import CandidateListItem from "./candidates/CandidateListItem.vue";
import AcceptedCourierCard from "./candidates/AcceptedCourierCard.vue";
import { useCandidateCouriers } from "~/composables/useCandidateCouriers";
import { useCandidateFilters } from "~/composables/useCandidateFilters";
import { useCandidateOfferRound } from "~/composables/useCandidateOfferRound";
import { useFinanceSettings } from "~/composables/useFinanceSettings";
import { buildCandidateGroups, groupSelectionState } from "~/utils/candidateGroups";
import type { CandidateGroup } from "~/utils/candidateGroups";
import {
  isOfferSendLocked,
  offerBlockReasons,
  offerPolicyFromSettings,
} from "~/utils/candidateOfferPolicy";
import type { CandidateCourier } from "~/types/candidateCourier";
import { buildOrderStateNote, offersDisabledForContext } from "~/utils/candidateOrderContext";
import type { CandidateOrderContext } from "~/utils/candidateOrderContext";

const props = defineProps<{
  // Kontekst po ID-u narudžbe iz board lista (assignment.vue). Opciono - ako
  // nije prosleđen, panel se ponaša kao ranije (bez upozorenja o stanju).
  orderContexts?: Map<number, CandidateOrderContext>;
  // Firma ulogovanog dispečera - backend candidate-couriers vraća SAMO kurire
  // te firme. Bez nje pretraga se ne pokreće.
  companyId: number | null;
}>();

// Signal roditelju (assignment.vue) da neko baš OVDE prihvatio ponudu - board
// gore ("Čeka kurira" lista) inače poll-uje na 5 min, pa bi ta narudžba ostala
// prikazana kao da još čeka kurira sve dotad bez ovoga.
const emit = defineEmits<{ accepted: [] }>();

const {
  candidates,
  loading,
  errorMessage,
  load: loadCandidates,
  startAutoRefresh,
  assigningCourierId,
  assignMessage,
  assignSuccess,
  assign,
} = useCandidateCouriers();

const rootRef = ref<{ $el?: HTMLElement } | null>(null);
const orderId = ref<number | null>(null);
const searched = ref(false);
// "Tok" je čisto alternativni prikaz istih kandidata/statusa - ne mijenja
// "Lista" ponašanje, samo bira šta se renderuje ispod OfferRoundBar-a.
const viewMode = ref<"list" | "track">("list");

// Finansijske postavke firme (cash limit BLOCK, pool AVAILABLE_NOW) određuju
// kome se ponuda uopšte može poslati - kandidati bez te mogućnosti idu na dno,
// bez dugmeta i čekiranja.
const { settings: financeSettings } = useFinanceSettings(computed(() => props.companyId));
const offerPolicy = computed(() => offerPolicyFromSettings(financeSettings.value));
const isBlocked = (c: CandidateCourier) => offerBlockReasons(c, offerPolicy.value).length > 0;
const isSendLocked = (c: CandidateCourier) => isOfferSendLocked(c, offerPolicy.value);

const {
  sortMode,
  displayCandidates,
  statusFilters,
  vehicleFilters,
  vehicleFilterOptions,
  searchQuery,
  visibleCandidates,
} = useCandidateFilters(candidates, isBlocked);

const orderContext = computed<CandidateOrderContext | null>(() => {
  if (!searched.value || orderId.value == null || !props.orderContexts) return null;
  return props.orderContexts.get(orderId.value) ?? { state: "unknown" };
});
const offersDisabled = computed(() => offersDisabledForContext(orderContext.value));
const orderStateNote = computed(() => buildOrderStateNote(orderContext.value));

const {
  offerMode,
  selectedSet,
  selectedCourierIds,
  toggleSelected,
  setSelected,
  offerSending,
  offerSendingCourierId,
  offerRoundActiveHere,
  offerRoundLocked,
  offerRoundCancelable,
  offerRoundAccepted,
  acceptedOffer,
  acceptedCandidate,
  offerMessage,
  offerMessageType,
  skippedNotes,
  roundCandidateIds,
  dismissSkipped,
  roundChip,
  offerChipFor,
  offerStatusFor,
  resetForNewSearch,
  watchExistingRound,
  sendOffer,
  onOfferOne,
  closeRound,
} = useCandidateOfferRound(
  orderId,
  () => props.companyId,
  displayCandidates,
  assign,
  isSendLocked
);

// Sekcije kandidata - isti izvor za "Listu" i "Tok", da oba prikaza pokazuju
// istu podjelu (nije odgovorilo / nudi se / na redu / ne mogu dobiti ponudu...).
const candidateGroups = computed(() =>
  buildCandidateGroups({
    candidates: visibleCandidates.value,
    statusOf: (c) => offerStatusFor(c.courierId).status,
    isBlocked,
    roundCandidateIds: roundCandidateIds.value,
    roundLive: offerRoundCancelable.value,
    mode: offerMode.value,
  })
);

// "Izaberi sve" u zaglavlju grupe: ako su svi izabrani odčekira ih, inače čekira
// sve kojima se ponuda smije poslati.
const groupSelection = (group: CandidateGroup) =>
  groupSelectionState(group, selectedSet.value, isSendLocked, offerRoundLocked.value);

const toggleGroupSelected = (group: CandidateGroup) => {
  const state = groupSelection(group);
  setSelected(state.ids, !state.all);
};

watch(offerRoundAccepted, (accepted) => {
  if (accepted) emit("accepted");
});

const load = async () => {
  const companyId = props.companyId;
  if (!orderId.value || companyId == null) return;
  searched.value = true;
  resetForNewSearch();
  await loadCandidates(orderId.value, companyId);
  startAutoRefresh(orderId.value, companyId);
  // Ako narudžba već ima otvorenu rundu, prati je (bez otvaranja nove).
  void watchExistingRound(orderId.value, companyId);
};

// Poziva DispatchBoardPanel (assignment.vue) kad dispečer klikne narudžbu iz
// "Čeka kurira" liste - popuni ID i odmah pokreni pretragu.
const selectOrder = (id: number) => {
  orderId.value = id;
  load();
  nextTick(() => {
    rootRef.value?.$el?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};

defineExpose({ selectOrder });
</script>

<style scoped>
.skipped-list {
  margin: 4px 0 0;
  padding-left: 20px;
}

.candidate-groups {
  margin-top: 4px;
}

.candidate-group + .candidate-group {
  margin-top: 12px;
}

.candidates-list {
  margin-top: 4px;
  background: transparent;
  display: grid;
  gap: 6px;
}

.candidates-skeleton {
  margin-top: 16px;
  display: grid;
  gap: 6px;
}
</style>
