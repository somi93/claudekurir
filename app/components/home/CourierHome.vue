<template>
  <DeliveryPage :max-width="640" :wide-max-width="960" roomy>
    <v-card class="hero-card" flat>
      <div class="hero-icon">
        <v-icon icon="mdi-moped-outline" size="30" color="#00b37e" />
      </div>
      <p class="eyebrow">Kurir #{{ courierId }}</p>
      <h1>Spreman za smenu?</h1>
      <p class="lede">
        Prihvatanje porudžbina, praćenje dostave uživo i sve oko tvoje smene - na jednom mestu.
      </p>
      <GlobalButtonPrimary size="large" append-icon="mdi-arrow-right" to="/courier/deliveries">
        Idi na dostave
      </GlobalButtonPrimary>
    </v-card>

    <v-row class="mt-4 mt-sm-6" density="comfortable">
      <v-col v-for="item in courierNavItems" :key="item.to" cols="6" sm="4" md="3">
        <v-card
          class="tile-card"
          flat
          :to="item.to"
          :aria-label="badgeFor(item) ? `${item.title}, ${badgeFor(item)} nepročitanih` : undefined"
        >
          <div class="tile-icon">
            <v-icon :icon="item.icon" color="#00b37e" size="20" />
          </div>
          <span v-if="badgeFor(item)" class="tile-badge" aria-hidden="true">
            {{ badgeFor(item) }}
          </span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.subtitle }}</p>
        </v-card>
      </v-col>
    </v-row>
  </DeliveryPage>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { useInboxStore } from "~/stores/inbox";
import { COURIER_INBOX_PATH, courierNavItems, type NavItem } from "~/utils/navigation";

defineProps<{
  courierId: number;
}>();

// Broj nepročitanih poruka na pločici "Poruke" (pravi se u app.vue / stores/inbox.ts).
const { unreadCount } = storeToRefs(useInboxStore());
const badgeFor = (item: NavItem) => (item.to === COURIER_INBOX_PATH ? unreadCount.value : 0);
</script>

<style scoped>
.hero-card,
.tile-card {
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.hero-card {
  padding: 28px 20px;
  text-align: center;
}

@media (min-width: 600px) {
  .hero-card {
    padding: 40px 36px;
    border-radius: 24px;
  }
}

.hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: #e3f8ef;
  margin-bottom: 14px;
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
  font-size: 1.5rem;
  letter-spacing: -0.02em;
}

@media (min-width: 600px) {
  h1 {
    font-size: 1.9rem;
  }
}

.lede {
  line-height: 1.5;
  color: #6b7685;
  max-width: 560px;
  margin: 12px auto 20px;
  font-size: 0.92rem;
}

.tile-card {
  position: relative;
  height: 100%;
  padding: 14px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.tile-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: 999px;
  background: #2f6fed;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.tile-card:hover {
  transform: translateY(-2px);
}

.tile-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #e3f8ef;
  margin-bottom: 10px;
}

.tile-card h3 {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.tile-card p {
  margin: 4px 0 0;
  color: #6b7685;
  font-size: 0.8rem;
  line-height: 1.4;
}
</style>
