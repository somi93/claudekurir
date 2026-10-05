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
        {{ message.text }}
      </v-alert>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAlertStore } from "~/stores/alert";

const alertStore = useAlertStore();
const { messages } = storeToRefs(alertStore);
const { dismiss } = alertStore;
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
