<template>
  <div class="sf">
    <label class="sf-label" :for="uid">
      {{ label }}<i v-if="optional"> opciono</i>
    </label>
    <div
      class="sf-in"
      :class="{ 'is-bad': message?.tone === 'bad', 'is-ok': okRing && message?.tone === 'ok' }"
    >
      <input
        :id="uid"
        ref="input"
        class="sf-input"
        :data-field="name"
        :value="modelValue"
        :type="type"
        :inputmode="inputmode"
        :autocomplete="autocomplete"
        :autocapitalize="autocapitalize"
        :enterkeyhint="enterkeyhint"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :readonly="readonly"
        :aria-invalid="message?.tone === 'bad' ? 'true' : 'false'"
        :aria-describedby="`${uid}-msg`"
        spellcheck="false"
        @input="onInput"
        @blur="emit('blur')"
      />
      <slot name="tail" />
    </div>
    <div :id="`${uid}-msg`" class="sf-msg" :class="message ? `is-${message.tone}` : ''" aria-live="polite">
      <template v-if="message">
        <v-icon v-if="messageIcon" :icon="messageIcon" size="16" />
        <span>{{ message.text }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";
import { caretAfter, countSignificant, type FieldMsg } from "~/utils/profileForm";

// Polje u donjem listu: labela IZNAD polja (ne kao placeholder), visina 52 px, plavi okvir fokusa,
// crveni uz grešku. Poruka ispod je aria-live, a polje ima aria-invalid i aria-describedby.
// Maska (`format`): datum i IBAN se uređuju dok se kuca, a kursor ostaje iza istog broja
// "značajnih" znakova (`significant`), pa kucanje usred broja ne baca kursor na kraj.
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    // data-field: po njemu list nalazi polje za fokus.
    name: string;
    optional?: boolean;
    type?: string;
    inputmode?: "text" | "tel" | "numeric" | "decimal" | "email";
    autocomplete?: string;
    autocapitalize?: string;
    enterkeyhint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
    placeholder?: string;
    maxlength?: number;
    readonly?: boolean;
    message?: FieldMsg | null;
    // Zeleni okvir kad je poruka potvrda (datum, IBAN).
    okRing?: boolean;
    format?: (raw: string) => string;
    significant?: (ch: string) => boolean;
  }>(),
  {
    optional: false,
    type: "text",
    inputmode: undefined,
    autocomplete: "off",
    autocapitalize: undefined,
    enterkeyhint: undefined,
    placeholder: undefined,
    maxlength: undefined,
    readonly: false,
    message: null,
    okRing: false,
    format: undefined,
    significant: undefined,
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string]; blur: [] }>();

const uid = `sf-${useId()}`;

const ICONS: Record<FieldMsg["tone"], string | undefined> = {
  bad: "mdi-alert-circle-outline",
  warn: "mdi-alert-outline",
  ok: "mdi-check-circle-outline",
  hint: undefined,
};

const messageIcon = computed(() => (props.message ? ICONS[props.message.tone] : undefined));

const onInput = (event: Event) => {
  const el = event.target as HTMLInputElement;
  let value = el.value;
  if (props.format) {
    const significant = props.significant ?? (() => true);
    const caret = el.selectionStart ?? value.length;
    const count = countSignificant(value.slice(0, caret), significant);
    const formatted = props.format(value);
    if (formatted !== value) {
      el.value = formatted;
      const at = caretAfter(formatted, count, significant);
      try {
        el.setSelectionRange(at, at);
      } catch {
        // tipovi polja bez izbora (npr. email) - kursor ostaje gdje je
      }
    }
    value = formatted;
  }
  emit("update:modelValue", value);
};
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
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 0 6px 0 14px;
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

.sf-in.is-ok {
  box-shadow: inset 0 0 0 2px #00b37e;
}

.sf-input {
  flex: 1;
  min-width: 0;
  height: 50px;
  padding: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 600;
  color: #0b1220;
}

.sf-input::placeholder {
  color: #657083;
  opacity: 1;
  font-weight: 500;
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

.sf-msg :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
}

.sf-msg.is-bad {
  color: #b42318;
}

.sf-msg.is-ok {
  color: #00734f;
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
