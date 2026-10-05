<template>
  <div v-if="visible || outcome" class="delivery-info" :class="{ compact }">
    <!-- Hronološki: obavještenje -> ponuda prikazana -> ishod. -->
    <div class="steps">
      <v-chip
        v-if="visible && pushSent !== null"
        size="x-small"
        variant="tonal"
        :color="pushSent ? 'success' : 'warning'"
        :class="{ 'warn-chip': !pushSent }"
        :prepend-icon="pushSent ? 'mdi-bell-check-outline' : 'mdi-bell-off-outline'"
        :title="PUSH_HINT"
      >
        {{ pushSent ? "Dobio obavještenje" : "Bez obavještenja" }}
      </v-chip>
      <v-chip
        v-if="visible"
        size="x-small"
        variant="tonal"
        :color="seenLive ? 'success' : 'warning'"
        :class="{ 'warn-chip': !seenLive }"
        :prepend-icon="seenLive ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
        :title="LIVE_HINT"
      >
        {{ seenLive ? "Vidio ponudu" : "Nije vidio ponudu" }}
      </v-chip>
      <v-chip v-if="outcome" size="x-small" :color="outcome.color" variant="flat">
        {{ outcome.label }}
      </v-chip>
    </div>
    <div v-if="diagnosis && !hideDiagnosis" class="diagnosis">{{ diagnosis }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CourierOfferStatus } from "~/types/offer";
import { offerDiagnosis } from "~/utils/offerDelivery";

// Šta se desilo sa ponudom na putu do kurira, jezikom dispečera. Dva nezavisna
// signala sa backenda:
//  - push_sent: kurirov telefon je dobio push obavještenje;
//  - socket_received_at: kurir je bio u aplikaciji (na porudžbinama) i ponuda mu
//    se stvarno prikazala.
// Pojedinačno ne kažu mnogo, zato ispod čipova ide jedna rečenica šta to znači.
const props = defineProps<{
  status: CourierOfferStatus;
  pushSent: boolean | null;
  socketReceivedAt: Date | null;
  // Ishod ponude (Nije odgovorio / Odbio / Prihvatio...) - ide zadnji.
  outcome?: { color: string; label: string } | null;
  compact?: boolean;
  // Bez rečenice ispod čipova (lista je prikazuje u podnaslovu reda).
  hideDiagnosis?: boolean;
}>();

const PUSH_HINT =
  "Obavještenje: telefon kurira je dobio push notifikaciju o novoj ponudi (stiglo i kad aplikacija nije otvorena).";
const LIVE_HINT =
  "Vidio ponudu: kurir je bio u aplikaciji (na porudžbinama) pa mu se ponuda prikazala na ekranu.";

const seenLive = computed(() => props.socketReceivedAt !== null);

// Kuriru koji nije ni dobio ponudu (none/superseded) nema šta da se prikaže.
const visible = computed(() => props.status !== "none" && props.status !== "superseded");

const diagnosis = computed(() =>
  offerDiagnosis(props.status, props.pushSent, seenLive.value)
);
</script>

<style scoped>
.delivery-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Tonalni "warning" čip ima svijetlonarandžast tekst na svijetlonarandžastoj
   pozadini - jedva se čita, pa tekst i ikonu tamnimo. */
.warn-chip {
  color: #8a4b00 !important;
}

.diagnosis {
  font-size: 0.75rem;
  line-height: 1.3;
  color: #6b7685;
}

.compact .steps {
  flex-direction: column;
}

.compact .diagnosis {
  font-size: 0.68rem;
}
</style>
