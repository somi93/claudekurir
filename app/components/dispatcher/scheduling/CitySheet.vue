<template>
  <AppSheet
    :open="open"
    title="Grad firme"
    :subtitle="companyName"
    :dirty="!!value"
    @update:open="emit('update:open', $event)"
    @submit="save"
  >
    <p class="cy-p">Unesi ID grada firme da bi zone i smjene mogle da se prave.</p>
    <SheetField v-model="value" label="ID grada" name="city-id" inputmode="numeric" :message="null" @update:model-value="onInput" />

    <template #footer>
      <AppButton submit :loading="saving" :disabled="!value" data-field="city-save">Sačuvaj grad</AppButton>
      <p>{{ value ? "" : "Upiši ID grada." }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetField from "~/components/common/SheetField.vue";

// Grad firme (ID). Odluka od 16.08: dodjelu grada radi administrator Ordere, ali dispečer koji nema grad ga može
// postaviti ovdje (do odgovora na pitanje B10).
const props = defineProps<{ open: boolean; companyName: string; saving: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean]; save: [cityId: number] }>();

const value = ref("");

watch(
  () => props.open,
  (open) => {
    if (open) value.value = "";
  }
);

// Samo cifre.
const onInput = (v: string) => {
  const clean = v.replace(/[^\d]/g, "");
  if (clean !== v) value.value = clean;
};

const save = () => {
  const id = Number(value.value);
  if (!value.value || !Number.isInteger(id) || id < 1 || props.saving) return;
  emit("save", id);
};
</script>

<style scoped>
.cy-p {
  margin: 0;
  font-size: 0.9rem;
  color: #5b6676;
}
</style>
