<template>
  <div
    ref="track"
    class="dl-slide"
    :class="[`dl-slide--${kind}`, { 'is-busy': busy, 'is-off': disabled }]"
    role="group"
    :aria-label="label"
  >
    <span class="dl-slide-fill" :style="{ width: `${offset + 56}px` }" />
    <span class="dl-slide-label" :style="{ opacity: labelOpacity }">
      <span>
        {{ busy ? "Šaljem…" : label }}
        <span class="dl-slide-chev"><v-icon icon="mdi-chevron-double-right" size="20" /></span>
      </span>
    </span>
    <button
      ref="knob"
      type="button"
      class="dl-slide-knob"
      :class="{ 'is-drag': dragging }"
      :style="{ transform: `translateX(${offset}px)` }"
      :aria-label="`${label}. Dodirni za potvrdu.`"
      :disabled="disabled || busy"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @click="onClick"
    >
      <v-icon :icon="busy ? 'mdi-refresh' : kind === 'deliver' ? 'mdi-check' : 'mdi-arrow-right'" size="24" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

// Nepovratni koraci (preuzeo / dostavio) se potvrđuju povlačenjem, ne dodirom:
// kurir vozi, džep i znoj prave slučajne dodire. Prag je 85% staze, ispod toga
// dugme se vraća. Tastatura / čitač ekrana: dodir na dugme (bez povlačenja)
// traži kratku potvrdu u panelu ("request-confirm") umjesto da potvrdi odmah.
const THRESHOLD = 0.85;

const props = defineProps<{
  kind: "pickup" | "deliver";
  label: string;
  disabled?: boolean;
  // Zahtjev je poslat: dugme stoji na kraju i vrti se.
  busy?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  "request-confirm": [];
}>();

const track = ref<HTMLElement | null>(null);
const knob = ref<HTMLElement | null>(null);
const offset = ref(0);
const dragging = ref(false);

const maxOffset = () => {
  if (!track.value || !knob.value) return 0;
  return Math.max(0, track.value.clientWidth - knob.value.offsetWidth - 8);
};

const labelOpacity = computed(() => {
  const max = maxOffset();
  if (props.busy) return 1;
  return max > 0 ? Math.min(1, Math.max(0, 1 - offset.value / (max * 0.55))) : 1;
});

let pointerId: number | null = null;
let startX = 0;
let usedPointer = false;

const onPointerDown = (event: PointerEvent) => {
  if (props.disabled || props.busy) return;
  usedPointer = true;
  pointerId = event.pointerId;
  startX = event.clientX - offset.value;
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const onPointerMove = (event: PointerEvent) => {
  if (pointerId === null) return;
  offset.value = Math.min(maxOffset(), Math.max(0, event.clientX - startX));
};

const onPointerUp = async () => {
  if (pointerId === null) return;
  pointerId = null;
  dragging.value = false;
  const max = maxOffset();
  if (max > 0 && offset.value >= max * THRESHOLD) {
    offset.value = max;
    emit("confirm");
    // Ako roditelj nije pokrenuo slanje (npr. pita "Daleko si, potvrditi?"),
    // dugme se vraća na početak da potvrda ne izgleda kao poslata.
    await nextTick();
    if (!props.busy) offset.value = 0;
  } else {
    offset.value = 0;
  }
};

// Pregledač je otkazao dodir (npr. preuzeo skrol): nikad ne potvrđuje, samo vraća dugme.
const onPointerCancel = () => {
  pointerId = null;
  dragging.value = false;
  offset.value = 0;
};

// click bez pointera (detail === 0) = tastatura ili čitač ekrana. Običan dodir
// mišem/prstom bez povlačenja ne radi ništa - upravo zato je klizač.
const onClick = (event: MouseEvent) => {
  const synthetic = event.detail === 0 && !usedPointer;
  usedPointer = false;
  if (synthetic && !props.disabled && !props.busy) emit("request-confirm");
};

// Zahtjev je pao: dugme se vraća na početak da kurir može ponovo.
watch(
  () => props.busy,
  (busy, wasBusy) => {
    if (wasBusy && !busy) offset.value = 0;
  }
);
</script>
