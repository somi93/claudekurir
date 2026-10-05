<template>
  <div class="mf">
    <label class="mf-l" :for="uid">{{ label }}</label>
    <div class="mf-in" :class="{ 'is-bad': !!error, 'is-off': disabled }">
      <input
        :id="uid"
        class="mf-input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :data-field="name"
        :value="modelValue"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : 'false'"
        :aria-describedby="msgId"
        @input="onInput"
        @blur="emit('blur')"
      />
      <span v-if="unit" class="mf-u">{{ unit }}</span>
      <template v-if="steppers">
        <button
          type="button"
          class="mf-b"
          data-step="-1"
          :aria-label="`Smanji: ${label}`"
          :disabled="disabled"
          @click="emit('step', -1)"
        >
          <v-icon icon="mdi-minus" size="18" />
        </button>
        <button
          type="button"
          class="mf-b"
          data-step="1"
          :aria-label="`Povećaj: ${label}`"
          :disabled="disabled"
          @click="emit('step', 1)"
        >
          <v-icon icon="mdi-plus" size="18" />
        </button>
      </template>
    </div>
    <!-- Okvir poruke je uvijek u DOM-u (aria-live ne čita ono što se pojavi zajedno sa okvirom)
         i uvijek drži 18 px, pa pojava greške ne pomjera ostatak stranice. -->
    <div :id="msgId" class="mf-m" :class="{ 'is-bad': !!error }" aria-live="polite">
      <template v-if="error">
        <v-icon icon="mdi-alert-circle-outline" size="16" />
        <span>{{ error }}</span>
      </template>
      <span v-else-if="hint">{{ hint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";

// Polje za iznos (cijena, doplata): tekst sa zarezom (inputmode="decimal", NE type=number, jer
// number polje ne prima "2,50" i vraća prazno za nepotpun unos), jedinica unutar polja i ± dugmad
// 44 px. Komponenta je samo prikazna: ne parsira i ne korača. Roditelj drži tekst nacrta,
// provjerava ga i na `step` korača preko stepAmount (zaokruživanje na 2 decimale je njegov posao).
// Radi i u uskom roditelju (list na telefonu): input je width:0 + flex:1, a min-width:0 na svakom
// nivou, inače ga dugmad i jedinica gurnu preko ivice.
withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    // Jedinica uz iznos: "KM", "KM/km", "%".
    unit: string;
    // Greška po polju (ton bad sa ikonom). Ima prednost nad hint-om.
    error?: string;
    hint?: string;
    // data-field: po njemu list/e2e nalazi polje.
    name?: string;
    steppers?: boolean;
    disabled?: boolean;
  }>(),
  { error: undefined, hint: undefined, name: undefined, steppers: true, disabled: false }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  // Dodir polja (izlaz iz njega): roditelj tek tada pokazuje grešku, ne dok korisnik kuca.
  blur: [];
  step: [direction: -1 | 1];
}>();

const uid = `mf-${useId()}`;
const msgId = computed(() => `${uid}-msg`);

const onInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
};
</script>

<style scoped>
.mf {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.mf-l {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0b1220;
}

.mf-in {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 56px;
  padding-right: 4px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
}

.mf-in:focus-within {
  border-color: #2f6fed;
  box-shadow: 0 0 0 1px #2f6fed;
}

.mf-in.is-bad {
  border-color: #e5484d;
}

.mf-in.is-bad:focus-within {
  box-shadow: 0 0 0 1px #e5484d;
}

.mf-in.is-off {
  background: #f5f6f8;
}

.mf-input {
  flex: 1;
  width: 0;
  min-width: 0;
  height: 53px;
  padding: 0 6px 0 14px;
  border: 0;
  outline: 0;
  background: none;
  color: #0b1220;
  font: inherit;
  font-size: 1.3rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.mf-input:disabled {
  color: #46505f;
}

.mf-u {
  flex: none;
  padding: 0 6px 0 2px;
  font-size: 0.86rem;
  font-weight: 700;
  color: #5b6676;
}

.mf-b {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-left: 4px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.mf-b:hover {
  background: #e7eaef;
}

.mf-b:active {
  background: #dde1e8;
}

.mf-b:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.mf-b:disabled {
  cursor: default;
  background: #f1f3f6;
  color: #657083;
}

.mf-m {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-height: 18px;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #5b6676;
}

.mf-m :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
}

.mf-m.is-bad {
  color: #b42318;
  font-weight: 600;
}
</style>
