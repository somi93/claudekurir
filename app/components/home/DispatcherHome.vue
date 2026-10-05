<template>
  <div class="home-wrap">
    <v-card class="hero-card" flat>
      <div class="hero-icon">
        <v-icon icon="mdi-view-dashboard-outline" size="30" color="#2f6fed" />
      </div>
      <p class="eyebrow">Dispečer{{ userName ? ` · ${userName}` : "" }}</p>
      <h1>Pregled dostavne mreže</h1>
      <p class="lede">
        Prati kurire uživo, podešavaj cjenovnik i dodeljuj porudžbine najpogodnijem kuriru.
      </p>
    </v-card>

    <v-row class="mt-6">
      <v-col v-for="item in dispatcherNavItems" :key="item.to" cols="12" sm="6">
        <v-card class="tile-card" flat :to="item.to">
          <div class="tile-icon">
            <v-icon :icon="item.icon" color="#2f6fed" />
          </div>
          <div class="tile-text">
            <h3>{{ item.title }}</h3>
            <p>{{ item.subtitle }}</p>
          </div>
          <v-icon icon="mdi-arrow-right" class="tile-arrow" />
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { dispatcherNavItems } from "~/utils/navigation";

defineProps<{
  userName?: string;
}>();
</script>

<style scoped>
.home-wrap {
  max-width: 960px;
  margin: 0 auto;
  padding-top: 4vh;
}

.hero-card,
.tile-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.hero-card {
  padding: 40px 36px;
  text-align: center;
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #e8f0fe;
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
  font-size: 1.9rem;
  letter-spacing: -0.02em;
}

.lede {
  line-height: 1.55;
  color: #6b7685;
  max-width: 560px;
  margin: 14px auto 0;
}

.tile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  transition: transform 0.15s ease;
}

.tile-card:hover {
  transform: translateY(-2px);
}

.tile-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #e8f0fe;
}

.tile-text {
  flex: 1;
}

.tile-card h3 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: -0.01em;
}

.tile-card p {
  margin: 2px 0 0;
  color: #6b7685;
  font-size: 0.85rem;
}

.tile-arrow {
  color: #9aa4b2;
}
</style>
