<template>
  <div class="ss">
    <div class="ss-t">
      <label :for="uid"><b>{{ label }}</b></label>
      <small v-if="hint" :id="`${uid}-hint`">{{ hint }}</small>
    </div>
    <span class="ss-sw">
      <input
        :id="uid"
        type="checkbox"
        role="switch"
        class="ss-in"
        :data-field="name"
        :checked="modelValue"
        :disabled="disabled"
        :aria-describedby="hint ? `${uid}-hint` : undefined"
        @change="onChange"
      />
      <i aria-hidden="true" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { nextTick, useId } from "vue";

// Prekidač sa labelom i opisom (Firma: ograniči gotovinu, raspis cijene): pravi checkbox sa
// role="switch", pa čitač ekrana kaže ime i stanje, a Space ga prebacuje. Meta je 56 × 44 px;
// uključen je tamnozelen (≥ 3 : 1 prema podlozi), isključen siv, a stanje se vidi i po položaju
// kuglice, ne samo po boji. Klik na naslov ga takođe prebacuje.
const props = defineProps<{
  modelValue: boolean;
  label: string;
  hint?: string;
  // data-field: po njemu editor nalazi polje za fokus.
  name?: string;
  // Zaključan (npr. dok se stanje ne učita): ne prebacuje se i ne pokazuje stanje.
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();

const uid = `ss-${useId()}`;

// Prekidač prati vrijednost koju roditelj drži: ako roditelj ne prihvati promjenu (npr. traži potvrdu prije
// uključivanja), kuglica se vraća na staro umjesto da pokazuje stanje koje nije stvarno.
const onChange = (event: Event) => {
  const el = event.target as HTMLInputElement;
  emit("update:modelValue", el.checked);
  void nextTick(() => {
    el.checked = props.modelValue;
  });
};
</script>

<style scoped>
.ss {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px 12px 16px;
  border-radius: 16px;
  background: #f5f6f8;
}

.ss-t {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ss-t b {
  font-weight: 800;
}

.ss-t label {
  cursor: pointer;
}

.ss-t small {
  font-size: 0.8rem;
  line-height: 1.4;
  color: #5b6676;
}

.ss-sw {
  position: relative;
  flex: none;
  width: 56px;
  height: 44px;
}

.ss-in {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.ss-sw i {
  position: absolute;
  top: 6px;
  left: 0;
  width: 56px;
  height: 32px;
  border-radius: 999px;
  background: #8a94a3;
  transition: background 0.15s;
}

.ss-sw i::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}

.ss-in:checked + i {
  background: #00734f;
}

.ss-in:checked + i::after {
  transform: translateX(24px);
}

.ss-in:disabled {
  cursor: not-allowed;
}

.ss-in:disabled + i {
  opacity: 0.5;
}

.ss-in:focus-visible + i {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .ss-sw i,
  .ss-sw i::after {
    transition: none;
  }
}
</style>
