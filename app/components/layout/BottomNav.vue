<template>
  <nav class="bottom-nav" aria-label="Glavna navigacija">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="nav-item"
      :class="{ 'nav-item--active': isActive(item) }"
      :aria-label="itemLabel(item)"
    >
      <span class="nav-icon">
        <v-icon :icon="item.icon" size="22" />
        <span v-if="item.badge" class="nav-badge" aria-hidden="true">{{ badgeText(item.badge) }}</span>
        <span v-else-if="item.dot" class="nav-dot" :class="`nav-dot--${item.dot}`" aria-hidden="true" />
      </span>
      <span class="nav-label">{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from "nuxt/app";
import type { BottomNavItem } from "~/utils/navigation";

defineProps<{
  items: BottomNavItem[];
}>();

const route = useRoute();

const isActive = (item: BottomNavItem) => route.path === item.to;

// Veliki brojevi se skraćuju da bedž ne preraste ikonu.
const badgeText = (count: number) => (count > 9 ? "9+" : String(count));

// Čitač ekrana: bedž i tačka su vizuelni (aria-hidden), pa ono što znače ide u naziv stavke.
const itemLabel = (item: BottomNavItem) => {
  if (item.badge) return `${item.label}, ${item.badge} nepročitanih`;
  if (item.dot === "over") return `${item.label}, preko limita gotovine`;
  if (item.dot === "near") return `${item.label}, blizu limita gotovine`;
  return item.label;
};
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  background: #fff;
  border-top: 1px solid #e7e9ee;
  padding-bottom: var(--v-safe-bottom, 0px);
  height: calc(56px + var(--v-safe-bottom, 0px));
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #6b7685;
  text-decoration: none;
  background: none;
  border: none;
  font: inherit;
  cursor: pointer;
}

.nav-item--active {
  color: #2f6fed;
}

.nav-icon {
  position: relative;
  display: inline-flex;
}

.nav-badge {
  position: absolute;
  top: -5px;
  left: 13px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #2f6fed;
  color: #fff;
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 0 0 2px #fff;
  font-variant-numeric: tabular-nums;
}

/* Tačka umjesto broja: gotovina je blizu (jantarna) ili preko (crvena) limita. */
.nav-dot {
  position: absolute;
  top: -2px;
  right: -5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px #fff;
}

.nav-dot--over {
  background: #e5484d;
}

.nav-dot--near {
  background: #ff9f1c;
}

.nav-label {
  font-size: 0.68rem;
  font-weight: 700;
}
</style>
