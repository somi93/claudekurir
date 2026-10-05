<template>
  <GlobalPage :max-width="480">
    <template #header>
      <PageHeader title="Promena lozinke" back-to="/" back-label="Nazad na početnu" />
    </template>

    <GlobalCard padding="12px 20px 18px">
      <v-form ref="formRef" @submit.prevent="submit">
        <GlobalTextField
          v-model="currentPassword"
          label="Trenutna lozinka"
          type="password"
          prepend-inner-icon="mdi-lock-outline"
          :rules="[rules.required()]"
          hide-details="auto"
          class="mb-3"
        />
        <GlobalTextField
          v-model="newPassword"
          label="Nova lozinka"
          type="password"
          prepend-inner-icon="mdi-lock-plus-outline"
          :rules="[rules.required(), rules.minLength('Nova lozinka', 8)]"
          hide-details="auto"
          class="mb-3"
        />
        <GlobalTextField
          v-model="newPasswordConfirmation"
          label="Potvrdi novu lozinku"
          type="password"
          prepend-inner-icon="mdi-lock-check-outline"
          :rules="[rules.required(), matchesNewPassword]"
          hide-details="auto"
          class="mb-3"
        />

        <PageAlert v-if="errorMessage" class="mb-3">
          {{ errorMessage }}
        </PageAlert>

        <GlobalButtonPrimary block type="submit" :loading="submitting">
          Sačuvaj novu lozinku
        </GlobalButtonPrimary>
      </v-form>
    </GlobalCard>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Promena lozinke" });

import { ref } from "vue";
import { useRouter } from "nuxt/app";
import type { VForm } from "vuetify/components";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import { useSessionStore } from "~/stores/session";
import { useAlertStore } from "~/stores/alert";
import * as authService from "~/services/authService";
import { toFriendlyErrorMessage, getValidationMessage } from "~/utils/errorMessage";
import { ROLE_HOME } from "~/types/user";

// Stranica je vec zasticena automatski - middleware/auth.global.ts brani sve
// rute osim /login po default-u, nema potrebe za definePageMeta ovde.

const rules = useValidationRules();
const router = useRouter();
const sessionStore = useSessionStore();
const alertStore = useAlertStore();

const formRef = ref<InstanceType<typeof VForm> | null>(null);
const currentPassword = ref("");
const newPassword = ref("");
const newPasswordConfirmation = ref("");
const submitting = ref(false);
const errorMessage = ref("");

const matchesNewPassword = (value: string) => value === newPassword.value || "Lozinke se ne poklapaju.";

const submit = async () => {
  errorMessage.value = "";
  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (!valid) return;

  submitting.value = true;
  try {
    await authService.changePassword({
      current_password: currentPassword.value,
      new_password: newPassword.value,
      new_password_confirmation: newPasswordConfirmation.value,
    });
    // Uspešan poziv sam gasi must_change_password na backendu (16.08) - ovde
    // samo lokalno pratimo istu promenu da PasswordReminderBanner odmah
    // nestane, bez čekanja na sledeći /me poziv.
    if (sessionStore.user) sessionStore.user.must_change_password = false;
    alertStore.success("Lozinka je promenjena.");
    router.push(sessionStore.role ? ROLE_HOME[sessionStore.role] : "/");
  } catch (error) {
    errorMessage.value =
      getValidationMessage(error, "current_password") ??
      toFriendlyErrorMessage(error, "Ne mogu da promenim lozinku. Proveri trenutnu lozinku.");
  } finally {
    submitting.value = false;
  }
};
</script>

