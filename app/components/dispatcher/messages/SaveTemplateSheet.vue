<template>
  <AppSheet
    :open="open"
    title="Sačuvaj šablon"
    subtitle="Ostaje u ovom pregledaču."
    focus="tplname"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetField
      v-model="label"
      name="tplname"
      label="Naziv šablona"
      :maxlength="max"
      enterkeyhint="done"
      :message="shown && !label.trim() ? { tone: 'bad', text: 'Upiši naziv šablona.' } : null"
      @update:model-value="shown = false"
    />
    <template #footer>
      <AppButton submit>Sačuvaj šablon</AppButton>
      <AppButton variant="ghost" @click="emit('update:open', false)">Odustani</AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetField from "~/components/common/SheetField.vue";

// Naziv za lični šablon (predloženo: početak naslova poruke).
const props = defineProps<{ open: boolean; suggestion: string; max: number }>();
const emit = defineEmits<{ "update:open": [boolean]; save: [label: string] }>();

const label = ref("");
const shown = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open) {
      label.value = props.suggestion.slice(0, props.max);
      shown.value = false;
    }
  },
  { immediate: true }
);

const submit = () => {
  if (!label.value.trim()) {
    shown.value = true;
    return;
  }
  emit("save", label.value.trim());
};
</script>
