<template>
  <div class="global-date-picker">
    <v-menu v-model="menuOpen" :close-on-content-click="false" location="bottom">
      <template #activator="{ props: activatorProps }">
        <GlobalTextField
          v-model="modelValue"
          :label="label"
          readonly
          :clearable="clearable"
          :prepend-inner-icon="icon"
          :rules="rules"
          :hint="hint"
          :persistent-hint="persistentHint"
          :hide-details="hideDetails"
          :variant="variant"
          :density="density"
          :flat="flat"
          v-bind="activatorProps"
        />
      </template>
      <v-date-picker
        :model-value="pickerDate"
        color="primary"
        hide-header
        @update:model-value="onPick"
      >
        <template #actions>
          <v-btn variant="text" color="primary" @click="menuOpen = false">Gotovo</v-btn>
        </template>
      </v-date-picker>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { GlobalFieldStyleProps } from "./globalField";

type DatePickerRule = (value: string) => boolean | string;

withDefaults(
  defineProps<
    GlobalFieldStyleProps & {
      label: string;
      icon?: string;
      clearable?: boolean;
      rules?: readonly DatePickerRule[];
      hint?: string;
      persistentHint?: boolean;
      hideDetails?: boolean | "auto";
    }
  >(),
  {
    icon: "mdi-calendar-outline",
    clearable: false,
    persistentHint: false,
  }
);

// Datum se čuva kao "YYYY-MM-DD" string; clearable mod pri brisanju vrati
// prazno (pozivalac normalizuje u null ako mu treba).
const modelValue = defineModel<string>({ required: true });
const menuOpen = ref(false);

// Cela app čuva datume kao "YYYY-MM-DD" string (isti format kao native
// <input type="date">, poredi se leksikografski npr. u dateNotBefore
// pravilu) - v-date-picker radi samo sa Date objektom, pa konverzija ostaje
// zatvorena unutar ove komponente umesto da procuri napolje.
const parseIso = (value: string) => {
  // Ulaz je uvijek "YYYY-MM-DD" (kontrolisan unutar komponente); default-i su
  // samo da TS suzi tip (noUncheckedIndexedAccess).
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const pickerDate = computed(() => (modelValue.value ? parseIso(modelValue.value) : null));

const onPick = (value: unknown) => {
  if (value instanceof Date) {
    modelValue.value = toIso(value);
    menuOpen.value = false;
  }
};
</script>

<style scoped>
/* Omotač daje stabilan koren za nasljeđivanu klasu / roditeljske :deep stilove
   (v-menu sam ne renderuje element). */
.global-date-picker {
  display: flex;
}

.global-date-picker :deep(.v-input) {
  flex: 1 1 auto;
  width: 100%;
}
</style>
