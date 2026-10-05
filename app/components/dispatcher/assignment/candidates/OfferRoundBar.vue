<template>
  <!-- Runda ponude: dispečer čekira kandidate, bira redom/paralelno i
       šalje jednu ponudu. Backend push-uje kuririma i sam prelazi na
       sljedećeg na decline/timeout (odgovor 10.09, 2.3/2.4). -->
  <div class="offer-bar mt-3">
    <div class="d-flex align-center ga-2 flex-wrap">
      <span class="sort-label">Ponuda:</span>
      <v-btn-toggle
        v-model="offerMode"
        mandatory
        density="compact"
        variant="outlined"
        divided
        :disabled="disabled"
      >
        <v-btn value="sequential" size="small">Redom</v-btn>
        <v-btn value="parallel" size="small">Paralelno</v-btn>
      </v-btn-toggle>

      <GlobalButtonPrimary
        size="small"
        :loading="sending"
        :disabled="sendDisabled"
        @click="emit('send')"
      >
        Pošalji ponudu ({{ selectedCount }})
      </GlobalButtonPrimary>

      <v-chip v-if="roundActive" size="small" :color="roundChip.color" variant="tonal">
        {{ roundChip.label }}
      </v-chip>
      <v-btn
        v-if="canCancel"
        variant="text"
        size="small"
        :loading="sending"
        :disabled="sending"
        @click="emit('close-round')"
      >
        Zatvori rundu
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import type { OfferMode } from "~/types/offer";

defineProps<{
  disabled: boolean;
  sendDisabled: boolean;
  sending: boolean;
  selectedCount: number;
  roundActive: boolean;
  // Runda je STVARNO otkaziva (status "active"/null) - odvojeno od `roundActive`
  // koji ostaje true i dok panel samo prikazuje već riješenu (accepted/
  // exhausted) rundu. Backend cancel ruta vraća 409 za riješenu rundu.
  canCancel: boolean;
  roundChip: { color: string; label: string };
}>();

const emit = defineEmits<{ send: []; "close-round": [] }>();

const offerMode = defineModel<OfferMode>("offerMode", { required: true });
</script>

<style scoped>
.sort-label {
  font-size: 0.82rem;
  color: #6b7685;
}

.offer-bar {
  padding: 10px 12px;
  border: 1px solid #e7e9ee;
  border-radius: 12px;
  background: #fafbfc;
}
</style>
