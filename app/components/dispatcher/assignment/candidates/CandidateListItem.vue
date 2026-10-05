<template>
  <v-list-item rounded="lg" class="candidate-item">
    <template #prepend>
      <div class="d-flex align-center ga-2 me-3">
        <v-checkbox
          :model-value="selected"
          hide-details
          density="compact"
          :disabled="locked || sendLocked"
          @update:model-value="emit('toggle-select')"
        />
        <v-avatar :style="{ background: vehicleMeta.color + '1a' }">
          <v-icon :icon="vehicleMeta.icon" :color="vehicleMeta.color" />
        </v-avatar>
      </div>
    </template>

    <v-list-item-title>{{ toLatin(candidate.name) }}</v-list-item-title>
    <v-list-item-subtitle>
      {{
        candidate.distanceKm !== null
          ? `${candidate.distanceKm.toFixed(1)} km od restorana`
          : "udaljenost nepoznata"
      }}
      <span v-if="candidate.zone"> · Zona: {{ toLatin(candidate.zone) }}</span>
      <!-- Tok ponude (obavještenje -> vidio ponudu -> ishod), u istom redu kao
           udaljenost, da kartica ostane iste visine. Vrsta vozila se vidi na avataru. -->
      <span v-if="showJourney" class="journey">
        <OfferDeliveryInfo
          hide-diagnosis
          :outcome="offerChip"
          :status="offerStatus.status"
          :push-sent="offerStatus.pushSent"
          :socket-received-at="offerStatus.socketReceivedAt"
        />
      </span>
    </v-list-item-subtitle>

    <template #append>
      <div class="d-flex align-center ga-2">
        <v-chip
          size="small"
          variant="tonal"
          :color="
            candidate.currentlyAvailable
              ? 'success'
              : blockReasons.includes('unavailable')
                ? 'error'
                : 'default'
          "
        >
          {{ candidate.currentlyAvailable ? "Dostupan" : "Nedostupan" }}
        </v-chip>
        <v-chip v-if="candidate.onDelivery" size="small" color="error" variant="tonal">
          Na isporuci
        </v-chip>
        <v-chip
          v-if="!candidate.vehicleSuitable"
          size="small"
          color="warning"
          variant="tonal"
          class="warn-chip"
        >
          Ne odgovara vozilu
        </v-chip>
        <v-chip
          v-if="candidate.cashLimitExceeded"
          size="small"
          :color="blockReasons.includes('cash_limit') ? 'error' : 'warning'"
          :class="{ 'warn-chip': !blockReasons.includes('cash_limit') }"
          variant="tonal"
          prepend-icon="mdi-cash-remove"
        >
          Premašen limit gotovine
        </v-chip>

        <GlobalButtonPrimary
          v-if="!offerChip && !sendLocked"
          size="small"
          :loading="assigning || offering"
          :disabled="actionsDisabled"
          @click="emit('offer-one')"
        >
          Pošalji ponudu
        </GlobalButtonPrimary>
      </div>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { courierVehicleMeta } from "~/utils/vehicle";
import type { CandidateCourier } from "~/types/candidateCourier";
import type { OfferBlockReason } from "~/utils/candidateOfferPolicy";
import type { CourierOfferStatus } from "~/types/offer";
import OfferDeliveryInfo from "./OfferDeliveryInfo.vue";

const props = defineProps<{
  candidate: CandidateCourier;
  // Razlozi zbog kojih se ovom kuriru ne bi trebalo slati ponuda (samo oznake).
  blockReasons: OfferBlockReason[];
  // Slanje zaključano: nema čekiranja ni dugmeta "Pošalji ponudu".
  sendLocked: boolean;
  selected: boolean;
  locked: boolean;
  offerChip: { color: string; label: string } | null;
  offerStatus: {
    status: CourierOfferStatus;
    pushSent: boolean | null;
    socketReceivedAt: Date | null;
  };
  assigning: boolean;
  offering: boolean;
  actionsDisabled: boolean;
}>();

const emit = defineEmits<{ "toggle-select": []; "offer-one": [] }>();

const vehicleMeta = computed(() => courierVehicleMeta(props.candidate.vehicle));

// Ima šta da se prikaže samo kad je kuriru stvarno poslata ponuda (ili ima ishod).
const showJourney = computed(
  () => props.offerChip !== null || !["none", "superseded"].includes(props.offerStatus.status)
);
</script>

<style scoped>
.candidate-item {
  border: 1px solid #e7e9ee;

  /* Podnaslov ne bledi (opacity), da čipovi toka ponude u njemu ostanu punih boja;
     sivilo teksta zadržavamo bojom. */
  --v-list-item-subtitle-opacity: 1;
}

.candidate-item :deep(.v-list-item-subtitle) {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

/* Tonalni "warning" čip: svijetlonarandžast tekst na svijetloj pozadini je nečitljiv. */
.warn-chip {
  color: #8a4b00 !important;
}

.journey {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 8px;
}
</style>
