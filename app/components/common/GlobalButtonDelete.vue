<template>
  <v-btn
    icon
    variant="text"
    :size="size"
    color="error"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @click="emit('click', $event)"
  >
    <v-icon :icon="icon" :size="iconSize" />
  </v-btn>
</template>

<script setup lang="ts">
// Jedinstveno dugme za brisanje/uklanjanje - boja ikonice je uvijek Vuetify
// "error" (ranije je pola mjesta u kodu to podešavalo ručno, pola nije).
withDefaults(
  defineProps<{
    ariaLabel: string;
    icon?: string;
    size?: string | number;
    iconSize?: string | number;
    disabled?: boolean;
  }>(),
  {
    icon: "mdi-trash-can-outline",
    size: "small",
    iconSize: undefined,
    disabled: false,
  }
);

const emit = defineEmits<{
  click: [MouseEvent];
}>();
</script>
