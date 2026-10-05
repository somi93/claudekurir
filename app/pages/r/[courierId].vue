<template>
  <div class="invite-wrap">
    <v-card class="invite-card" flat>
      <div class="invite-icon">
        <v-icon icon="mdi-moped" size="30" color="#00b37e" />
      </div>

      <p class="eyebrow">Ordera kurir</p>
      <h1>Pozvan si da postaneš kurir</h1>
      <p class="lede">
        Kad odradiš {{ REWARD_DELIVERIES }} dostava, i ti i osoba koja te je pozvala dobijate po
        {{ REWARD_AMOUNT }} KM bonusa. Ostavi podatke ispod - javićemo ti se da završimo prijavu.
      </p>

      <PageAlert v-if="!courierId" type="warning">
        Ovaj link nije ispravan. Zamoli prijatelja da ti pošalje link ponovo.
      </PageAlert>

      <PageAlert v-else-if="submitted" type="success">
        Hvala, {{ toLatin(submittedName) }}! Uskoro ćemo te kontaktirati da završimo prijavu.
      </PageAlert>

      <v-form v-else ref="formRef" class="invite-form" @submit.prevent="submit">
        <GlobalTextField
          v-model="name"
          label="Ime i prezime"
          prepend-inner-icon="mdi-account-outline"
          :rules="[rules.required()]"
          hide-details="auto"
        />

        <PageAlert v-if="errorMessage">
          {{ errorMessage }}
        </PageAlert>

        <GlobalButtonPrimary block type="submit" size="large" :loading="submitting">
          Pošalji prijavu
        </GlobalButtonPrimary>
      </v-form>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: "Pozivnica za kurira" });

import { computed, ref } from "vue";
import { useRoute } from "nuxt/app";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import { createPublicReferralLead } from "~/services/courierReferralsService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useValidationRules } from "~/composables/useValidationRules";
import { REFERRAL_REWARD_AMOUNT, REFERRAL_REWARD_DELIVERIES } from "~/config/referral";
import type { VForm } from "vuetify/components";

const REWARD_DELIVERIES = REFERRAL_REWARD_DELIVERIES;
const REWARD_AMOUNT = REFERRAL_REWARD_AMOUNT;

const route = useRoute();
const courierId = computed(() => {
  const raw = Number(route.params.courierId);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
});

const rules = useValidationRules();
const formRef = ref<InstanceType<typeof VForm> | null>(null);

const name = ref("");
const submitting = ref(false);
const submitted = ref(false);
const submittedName = ref("");
const errorMessage = ref("");

const submit = async () => {
  if (!courierId.value) return;

  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  errorMessage.value = "";
  submitting.value = true;
  try {
    await createPublicReferralLead(courierId.value, {
      name: name.value.trim(),
    });
    submittedName.value = name.value.trim();
    submitted.value = true;
  } catch (error) {
    errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da pošaljem prijavu. Pokušaj ponovo.");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.invite-wrap {
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 80px 16px;
  background: white;
}

.invite-card {
  width: 100%;
  max-width: 440px;
  padding: 36px 32px;
  text-align: center;
  align-self: flex-start;
}

.invite-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #e3f8ef;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: #9aa4b2;
}

h1 {
  margin: 0;
  font-size: 1.7rem;
  letter-spacing: -0.02em;
}

.lede {
  line-height: 1.55;
  color: #6b7685;
  margin: 12px 0 22px;
}

.invite-form {
  display: grid;
  gap: 14px;
  text-align: left;
}
</style>
