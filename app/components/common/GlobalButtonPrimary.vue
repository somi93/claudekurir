<template>
  <v-btn color="primary" rounded="md" flat :loading="loading" :disabled="disabled" @click="emit('click', $event)">
    <slot />
  </v-btn>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    loading: false,
    disabled: false,
  }
);

const emit = defineEmits<{
  // $event se prosleđuje da bi `.stop` / `.prevent` modifikatori radili na
  // pozivalac strani (npr. BoardWaitingTab "Predloži kurira" unutar klikabilnog
  // v-list-item-a). Bez event objekta Vue-ov withModifiers puca na undefined.
  click: [MouseEvent];
}>();
</script>
