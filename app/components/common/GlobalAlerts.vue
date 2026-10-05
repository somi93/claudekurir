<template>
  <div class="global-alerts">
    <TransitionGroup name="global-alert" tag="div" class="global-alerts-stack">
      <v-alert
        v-for="message in messages"
        :key="message.id"
        :type="message.type"
        class="global-alert-card"
        border="start"
        closable
        @click:close="dismiss(message.id)"
      >
        <div v-if="message.action" class="global-alert-row">
          <span class="global-alert-text">{{ message.text }}</span>
          <button
            type="button"
            class="global-alert-action"
            data-alert-action
            @click="runAction(message.id)"
          >
            {{ message.action.label }}
          </button>
        </div>
        <template v-else>{{ message.text }}</template>
      </v-alert>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAlertStore } from "~/stores/alert";

const alertStore = useAlertStore();
const { messages } = storeToRefs(alertStore);
const { dismiss, runAction } = alertStore;
</script>

<style scoped>
.global-alerts {
  position: fixed;
  top: max(12px, var(--v-safe-top, 0px));
  left: 0;
  right: 0;
  z-index: 3000;
  display: flex;
  justify-content: center;
  pointer-events: none;
  padding: 0 16px;
}

.global-alerts-stack {
  display: grid;
  gap: 8px;
  width: 100%;
  max-width: 480px;
}

.global-alert-card {
  border-radius: 16px !important;
  pointer-events: auto;
  box-shadow: 0 8px 24px rgba(11, 18, 32, 0.12);
}

.global-alert-card :deep(.v-alert__underlay) {
  opacity: 1 !important;
  background: #fff !important;
}

/* Obavijest sa radnjom ("Poništi"): tekst i dugme u istom redu, a na uskom ekranu dugme pređe ispod.
   Dugme je tamno na bijelom (podloga kartice je bijela), 44 px visine. */
.global-alert-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.global-alert-text {
  flex: 1 1 12rem;
  min-width: 0;
}

.global-alert-action {
  flex: none;
  min-width: 44px;
  min-height: 44px;
  padding: 0 16px;
  border: 1.5px solid #c7ccd4;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
}

.global-alert-action:hover {
  background: #f1f4f9;
}

.global-alert-action:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.global-alert-enter-active,
.global-alert-leave-active {
  transition: all 0.2s ease;
}

.global-alert-enter-from,
.global-alert-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.global-alert-leave-active {
  position: absolute;
  width: 100%;
}
</style>
