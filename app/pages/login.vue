<template>
  <div class="login-wrap">
    <v-card class="login-card" flat>
      <div class="login-icon">
        <v-icon icon="mdi-moped" size="30" color="#00b37e" />
      </div>

      <p class="eyebrow">Delivery Control</p>
      <h1>Prijava</h1>
      <p class="lede">Prijavi se da nastaviš na svoju stranicu.</p>

      <v-form class="login-form" @submit.prevent="login">
        <GlobalTextField
          v-model="email"
          label="Email"
          type="email"
          prepend-inner-icon="mdi-email-outline"
        />
        <GlobalTextField
          v-model="password"
          label="Lozinka"
          type="password"
          prepend-inner-icon="mdi-lock-outline"
        />

        <PageAlert v-if="errorMessage" class="mb-3">
          {{ errorMessage }}
        </PageAlert>

        <GlobalButtonPrimary
          block
          type="submit"
          size="large"
          append-icon="mdi-arrow-right"
          :loading="submitting"
        >
          Prijavi se
        </GlobalButtonPrimary>
      </v-form>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: "Prijava" });

import { ref } from "vue";
import { useRouter } from "nuxt/app";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import { ROLE_HOME } from "~/types/user";
import { useSessionStore, SESSION_KEYS } from "~/stores/session";
import * as authService from "~/services/authService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";

const NO_ACCESS_ROUTE = "/no-access";
const CHOOSE_ROLE_ROUTE = "/choose-role";

// Vec ulogovan -> odmah na svoju stranu, vidi app/middleware/auth.global.ts
// (jedini middleware koji sad odlucuje ko sme gde).

const router = useRouter();
const sessionStore = useSessionStore();

const email = ref("");
const password = ref("");
const errorMessage = ref("");
const submitting = ref(false);

const login = async () => {
  errorMessage.value = "";

  if (!email.value.trim() || !password.value.trim()) {
    errorMessage.value = "Unesi email i lozinku.";
    return;
  }

  submitting.value = true;
  try {
    const response = await authService.login({
      username: email.value,
      password: password.value,
    });
    localStorage.setItem(SESSION_KEYS.token, response.access_token);

    await sessionStore.ensureUser(true);

    // Bump TEK poslije navigacije - vidi komentar u stores/session.ts#logout().
    if (sessionStore.accountKind === "unsupported") {
      await router.push(NO_ACCESS_ROUTE);
    } else if (sessionStore.accountKind === "admin" && !sessionStore.role) {
      await router.push(CHOOSE_ROLE_ROUTE);
    } else if (sessionStore.role) {
      await router.push(ROLE_HOME[sessionStore.role]);
    } else {
      throw new Error("Prijava nije uspela.");
    }
    sessionStore.bumpShellRemount();
  } catch (error) {
    errorMessage.value = toFriendlyErrorMessage(error, "Pogrešan email ili lozinka.");
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.login-wrap {
  display: flex;
  justify-content: center;
  height: 100vh;
  padding-top: 80px;
  background: white;
}

.login-card {
  width: 100%;
  max-width: 440px;
  padding: 36px 32px;
  text-align: center;
}

.login-icon {
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

.login-form {
  display: grid;
  gap: 4px;
  text-align: left;
}
</style>
