<template>
  <DeliveryPage :max-width="960" roomy>
    <v-card class="hero-card" flat>
      <div class="hero-icon">
        <v-icon icon="mdi-account-switch-outline" size="30" color="#2f6fed" />
      </div>
      <p class="eyebrow">Admin{{ userName ? ` · ${userName}` : "" }}</p>
      <h1>Izaberi prikaz</h1>
      <p class="lede">Koji deo aplikacije hoćeš da gledaš?</p>
    </v-card>

    <v-row class="mt-4 mt-sm-6" density="comfortable">
      <v-col v-for="option in options" :key="option.role" cols="12" sm="6">
        <v-card class="tile-card" flat @click="choose(option.role)">
          <div class="tile-icon">
            <v-icon :icon="option.icon" color="#2f6fed" size="24" />
          </div>
          <h3>{{ option.title }}</h3>
          <p>{{ option.subtitle }}</p>
        </v-card>
      </v-col>
    </v-row>
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Izaberi prikaz" });

import { computed } from "vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import { useSessionStore } from "~/stores/session";
import type { AppRole } from "~/types/user";

const sessionStore = useSessionStore();
const userName = computed(() => toLatin(sessionStore.user?.name));

const options: { role: AppRole; title: string; subtitle: string; icon: string }[] = [
  {
    role: "dostava",
    title: "Kurir",
    subtitle: "Dostave, novčanik, istorija",
    icon: "mdi-moped-outline",
  },
  {
    role: "dispatcher",
    title: "Dispečer",
    subtitle: "Kuriri uživo, cenovnik",
    icon: "mdi-view-dashboard-outline",
  },
];

const choose = (role: AppRole) => sessionStore.setAdminActiveRole(role);
</script>

<style scoped>
.hero-card,
.tile-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.hero-card {
  padding: 28px;
  text-align: center;
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: #e8f0fe;
  margin-bottom: 14px;
}

.eyebrow {
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  font-weight: 700;
  color: #9aa4b2;
}

h1 {
  margin: 0;
  font-size: 1.6rem;
  letter-spacing: -0.02em;
}

.lede {
  margin: 8px 0 0;
  color: #6b7685;
}

.tile-card {
  height: 100%;
  padding: 24px 18px;
  text-align: center;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.tile-card:hover {
  transform: translateY(-2px);
}

.tile-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #e8f0fe;
  margin: 0 auto 12px;
}

.tile-card h3 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: -0.01em;
}

.tile-card p {
  margin: 4px 0 0;
  color: #6b7685;
  font-size: 0.82rem;
  line-height: 1.4;
}
</style>
