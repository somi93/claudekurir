<template>
  <v-dialog v-model="open" max-width="380" persistent>
    <v-card class="confirm-card" rounded="lg">
      <v-card-title class="confirm-title pa-0">{{ title }}</v-card-title>
      <p class="confirm-message">{{ message }}</p>
      <div class="confirm-actions">
        <v-btn variant="text" @click="cancel">{{ cancelText }}</v-btn>
        <v-btn :color="color" variant="flat" @click="accept">{{ confirmText }}</v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useConfirmStore } from "~/stores/confirm";

const confirmStore = useConfirmStore();
const { open, title, message, color, confirmText, cancelText } = storeToRefs(
  confirmStore
);
const { accept, cancel } = confirmStore;
</script>

<style scoped>
.confirm-card {
  padding: 22px;
}

.confirm-title {
  font-size: 1.05rem;
  font-weight: 800;
}

.confirm-message {
  margin: 10px 0 20px;
  color: #6b7685;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
