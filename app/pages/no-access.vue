<template>
  <div class="no-access-wrap">
    <v-card class="no-access-card" flat>
      <div class="no-access-icon">
        <v-icon icon="mdi-lock-outline" size="30" color="#e5484d" />
      </div>
      <h1>Nalog nema pristup</h1>
      <p class="lede">
        Ovaj nalog trenutno nema pristup aplikaciji. Ako smatraš da je ovo greška,
        javi se administratoru.
      </p>
      <GlobalButtonPrimary size="large" append-icon="mdi-logout" @click="logout">
        Odjava
      </GlobalButtonPrimary>
    </v-card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: "Nalog nema pristup" });

import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { useSessionStore } from "~/stores/session";

const sessionStore = useSessionStore();
const { logout } = sessionStore;
</script>

<style scoped>
.no-access-wrap {
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 80px 16px;
  background: white;
}

.no-access-card {
  width: 100%;
  max-width: 440px;
  padding: 36px 32px;
  text-align: center;
  height: fit-content;
}

.no-access-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #fdecec;
  margin-bottom: 16px;
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
</style>
