<template>
  <div class="st">
    <div class="st-lb">
      <label :for="uid">{{ label }}</label>
      <i v-if="optional"> opciono</i>
    </div>
    <div class="st-row">
      <button
        type="button"
        class="st-btn"
        :aria-label="`Smanji: ${label}`"
        :data-field="`${name}-minus`"
        @click="emit('step', -1)"
      >
        <v-icon icon="mdi-minus" size="22" />
      </button>
      <div class="st-in" :class="{ 'is-bad': message?.tone === 'bad' }">
        <input
          :id="uid"
          class="st-input"
          :data-field="name"
          :value="modelValue"
          inputmode="numeric"
          autocomplete="off"
          spellcheck="false"
          :placeholder="placeholder"
          :aria-invalid="message?.tone === 'bad' ? 'true' : 'false'"
          :aria-describedby="`${uid}-msg`"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <button
        type="button"
        class="st-btn"
        :aria-label="`Povećaj: ${label}`"
        :data-field="`${name}-plus`"
        @click="emit('step', 1)"
      >
        <v-icon icon="mdi-plus" size="22" />
      </button>
    </div>
    <div :id="`${uid}-msg`" class="st-msg" :class="message ? `is-${message.tone}` : ''" aria-live="polite">
      <template v-if="message">
        <v-icon v-if="message.tone === 'bad'" icon="mdi-alert-circle-outline" size="16" />
        <span>{{ message.text }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from "vue";
import type { FieldMsg } from "~/utils/profileForm";

// Polje sa − i + (kapacitet kurira, početak i kraj smjene): dugmad od 44 px sa strane, broj ili vrijeme u
// sredini koji se može i kucati. Korak računa roditelj (±1 kurir, ±15 min): ovdje se samo javlja `step`.
withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    name: string;
    optional?: boolean;
    placeholder?: string;
    message?: FieldMsg | null;
  }>(),
  { optional: false, placeholder: undefined, message: null }
);

const emit = defineEmits<{ "update:modelValue": [value: string]; step: [delta: number] }>();

const uid = `stf-${useId()}`;
</script>

<style scoped>
.st {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.st-lb {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.st-lb i {
  font-style: normal;
  font-weight: 600;
  color: #657083;
}

.st-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: stretch;
  gap: 4px;
}

.st-btn {
  display: grid;
  place-items: center;
  min-height: 52px;
  padding: 0;
  border: 0;
  border-radius: 14px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.st-btn:active {
  background: #e5e8ed;
}

.st-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.st-in {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 4px;
  border-radius: 14px;
  background: #f5f6f8;
  box-shadow: inset 0 0 0 2px transparent;
}

.st-in:focus-within {
  background: #fff;
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.st-in.is-bad {
  background: #fff;
  box-shadow: inset 0 0 0 2px #e5484d;
}

.st-input {
  flex: 1;
  min-width: 0;
  height: 50px;
  padding: 0;
  border: 0;
  outline: 0;
  background: none;
  color: #0b1220;
  font: inherit;
  font-size: 1.15rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.st-input::placeholder {
  color: #657083;
  font-size: 0.9rem;
  font-weight: 500;
  opacity: 1;
}

.st-msg {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #5b6676;
}

.st-msg:empty {
  display: none;
}

.st-msg.is-bad {
  color: #b42318;
}

.st-msg :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
}
</style>
