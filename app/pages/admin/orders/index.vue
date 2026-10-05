<template>
  <GlobalPage :max-width="640">
    <template #header>
      <PageHeader title="Istorija narudžbi" back-to="/" back-label="Nazad na početnu" />
    </template>

    <PageAlert type="info" class="mb-4">
      Unesi broj narudžbe da vidiš hronološki tok - promene statusa, offer runde i push
      notifikacije - tačno onim redom kojim su se desile.
    </PageAlert>

    <v-form @submit.prevent="goToOrder">
      <div class="d-flex ga-2">
        <v-text-field
          v-model="orderIdInput"
          label="Broj narudžbe"
          placeholder="npr. 3949"
          variant="outlined"
          density="comfortable"
          type="number"
          hide-details
          autofocus
        />
        <v-btn color="primary" size="large" type="submit" :disabled="!isValid">Prikaži</v-btn>
      </div>
    </v-form>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Admin · Istorija narudžbi" });

import { computed, ref } from "vue";
import { navigateTo } from "nuxt/app";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";

const orderIdInput = ref("");

const isValid = computed(() => /^\d+$/.test(orderIdInput.value.trim()));

const goToOrder = () => {
  if (!isValid.value) return;
  navigateTo(`/admin/orders/${orderIdInput.value.trim()}`);
};
</script>
