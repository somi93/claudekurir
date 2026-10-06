<template>
  <div class="tint" :class="`tint--${tone}`" :role="role">
    <v-icon :icon="resolvedIcon" size="22" />
    <div class="tint-body">
      <b v-if="title" class="tint-title">{{ title }}</b>
      <slot />
      <div v-if="$slots.action" class="tint-action"><slot name="action" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Tonirani blok sa porukom (upozorenje, greška, obavijest, potvrda): tamni tekst na blagom
// tonu umjesto bojenog teksta, pa je kontrast ≥ 4.5:1 (PageAlert u ovoj aplikaciji piše
// narandžasto na bež, 1.9:1). Opcioni naslov, tekst u slotu i radnja ispod teksta.
const props = withDefaults(
  defineProps<{
    tone?: "warn" | "bad" | "info" | "ok";
    title?: string;
    icon?: string;
    // "alert" za ono što kurir mora odmah da primijeti, "status" za tiho obavještenje.
    role?: "alert" | "status" | undefined;
  }>(),
  { tone: "warn", title: undefined, icon: undefined, role: undefined }
);

const ICONS = {
  warn: "mdi-alert-outline",
  bad: "mdi-alert-circle-outline",
  info: "mdi-information-outline",
  ok: "mdi-check-circle-outline",
} as const;

const resolvedIcon = computed(() => props.icon ?? ICONS[props.tone]);
</script>

<style scoped>
.tint {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  padding: 11px 12px;
  border-radius: 14px;
  background: #fff2df;
  color: #5c3305;
  font-size: 0.84rem;
  line-height: 1.4;
}

.tint :deep(.v-icon) {
  color: #9a4a07;
}

.tint--bad {
  background: #fde8e6;
  color: #7a1810;
}

.tint--bad :deep(.v-icon) {
  color: #b42318;
}

.tint--info {
  background: #eef4ff;
  color: #17408f;
}

.tint--info :deep(.v-icon) {
  color: #2459c7;
}

.tint--ok {
  background: #e3f8ef;
  color: #04382a;
}

.tint--ok :deep(.v-icon) {
  color: #00734f;
}

.tint-body {
  min-width: 0;
}

.tint-title {
  display: block;
  font-weight: 800;
}

.tint-action {
  margin-top: 6px;
}

.tint-action :deep(button) {
  /* meta od 44 px: višak visine se uvlači negativnom marginom, pa razmak oko poruke ostaje isti */
  min-height: 44px;
  margin: -6px 0;
  text-align: left;
  padding: 4px 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 800;
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.tint-action :deep(button:focus-visible) {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
