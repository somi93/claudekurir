<template>
  <GlobalCard padding="20px" class="h-100">
    <template #title>Osnovna cena po dostavnoj firmi</template>
    <template #subtitle>
      Startna cena + cena po kilometru — svaka firma za dostavu ima sopstvenu tarifu.
    </template>

    <div v-if="loading" class="pricing-skeleton mt-2">
      <v-skeleton-loader type="text@2" />
      <v-skeleton-loader type="button" />
    </div>

    <template v-else-if="pricing">
      <v-row density="comfortable" class="mt-2">
        <v-col cols="6">
          <GlobalTextField
            v-model.number="pricing.base_price"
            label="Startna cena"
            type="number"
            step="0.1"
            :suffix="pricing.currency"
          />
        </v-col>
        <v-col cols="6">
          <GlobalTextField
            v-model.number="pricing.price_per_km"
            label="Cena po kilometru"
            type="number"
            step="0.05"
            :suffix="`${pricing.currency}/km`"
          />
        </v-col>
      </v-row>

      <div class="d-flex align-center ga-3">
        <GlobalButtonPrimary :loading="savingPricing" @click="emit('save')">
          Sačuvaj cenu
        </GlobalButtonPrimary>
        <span v-if="pricingSaved" class="save-confirm">Sačuvano.</span>
      </div>
    </template>
  </GlobalCard>
</template>

<script setup lang="ts">
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import type { Pricing } from "~/types/pricing";

defineProps<{
  savingPricing: boolean;
  pricingSaved: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  save: [];
}>();

const pricing = defineModel<Pricing | null>("pricing", { required: true });
</script>

<style scoped>
.save-confirm {
  color: #00b37e;
  font-size: 0.85rem;
  font-weight: 600;
}

.pricing-skeleton {
  display: grid;
  gap: 8px;
}
</style>
