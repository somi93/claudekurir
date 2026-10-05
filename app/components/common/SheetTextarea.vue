<template>
  <div class="sf">
    <label class="sf-label" :for="uid">
      {{ label }}<i v-if="optional"> opciono</i>
    </label>
    <div class="sf-in" :class="{ 'is-bad': message?.tone === 'bad' }">
      <textarea
        :id="uid"
        class="sf-input"
        :data-field="name"
        :value="modelValue"
        :rows="rows"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :aria-invalid="message?.tone === 'bad' ? 'true' : 'false'"
        :aria-describedby="`${uid}-msg`"
        @input="onInput"
        @blur="emit('blur')"
      />
    </div>
    <div :id="`${uid}-msg`" class="sf-msg" :class="message ? `is-${message.tone}` : ''" aria-live="polite">
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

// Višeredno polje u donjem listu (napomena, tekst poruke, razlog suspenzije): ista labela iznad,
// isti okvir i ista poruka ispod kao SheetField, samo viša površina.
withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    name: string;
    optional?: boolean;
    placeholder?: string;
    rows?: number;
    maxlength?: number;
    message?: FieldMsg | null;
  }>(),
  { optional: false, placeholder: undefined, rows: 3, maxlength: undefined, message: null }
);

const emit = defineEmits<{ "update:modelValue": [value: string]; blur: [] }>();

const uid = `st-${useId()}`;

const onInput = (event: Event) => emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
</script>

<style scoped>
.sf {
  display: grid;
  gap: 6px;
}

.sf-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.sf-label i {
  font-style: normal;
  font-weight: 600;
  color: #657083;
}

.sf-in {
  display: flex;
  padding: 0 14px;
  border-radius: 14px;
  background: #f5f6f8;
  box-shadow: inset 0 0 0 2px transparent;
  transition: box-shadow 0.15s, background 0.15s;
}

.sf-in:focus-within {
  background: #fff;
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.sf-in.is-bad {
  background: #fff;
  box-shadow: inset 0 0 0 2px #e5484d;
}

.sf-input {
  flex: 1;
  min-width: 0;
  min-height: 96px;
  padding: 12px 0;
  border: 0;
  outline: 0;
  resize: none;
  background: none;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 500;
  line-height: 1.4;
  color: #0b1220;
}

.sf-input::placeholder {
  color: #657083;
  opacity: 1;
}

.sf-msg {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #5b6676;
}

.sf-msg:empty {
  display: none;
}

.sf-msg.is-bad {
  color: #b42318;
}

.sf-msg.is-warn {
  color: #9a4a07;
}

@media (prefers-reduced-motion: reduce) {
  .sf-in {
    transition: none;
  }
}
</style>
