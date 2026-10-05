<template>
  <div class="global-time-picker">
    <v-menu v-model="menuOpen" :close-on-content-click="false" location="bottom">
      <template #activator="{ props: activatorProps }">
        <GlobalTextField
          v-model="modelValue"
          :label="label"
          readonly
          :clearable="clearable"
          prepend-inner-icon="mdi-clock-outline"
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
      <v-time-picker
        v-model="modelValue"
        :min="min"
        :max="max"
        :allowed-hours="allowedHours"
        format="24hr"
        color="primary"
        hide-header
      >
        <template #actions>
          <v-btn variant="text" color="primary" @click="menuOpen = false">Gotovo</v-btn>
        </template>
      </v-time-picker>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { GlobalFieldStyleProps } from "./globalField";

type TimePickerRule = (value: string) => boolean | string;

withDefaults(
  defineProps<
    GlobalFieldStyleProps & {
      label: string;
      clearable?: boolean;
      rules?: readonly TimePickerRule[];
      hint?: string;
      persistentHint?: boolean;
      hideDetails?: boolean | "auto";
      min?: string;
      max?: string;
      allowedHours?: (hour: number) => boolean;
    }
  >(),
  {
    clearable: false,
    persistentHint: false,
  }
);

const modelValue = defineModel<string>({ required: true });
const menuOpen = ref(false);
</script>

<style scoped>
/* Omotač daje stabilan koren za nasljeđivanu klasu / roditeljske :deep stilove
   (v-menu sam ne renderuje element). */
.global-time-picker {
  display: flex;
}

.global-time-picker :deep(.v-input) {
  flex: 1 1 auto;
  width: 100%;
}
</style>
