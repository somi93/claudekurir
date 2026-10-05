<template>
  <section ref="sheet" class="dl-sheet" :class="{ 'is-open': expandable && open }" aria-label="Radni panel">
    <button
      v-if="expandable"
      type="button"
      class="dl-grip"
      :aria-expanded="open"
      :aria-label="open ? 'Smanji panel' : 'Proširi panel'"
      @click="onClick"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <i />
    </button>
    <div v-else class="dl-grip" data-fixed aria-hidden="true"><i /></div>

    <slot />
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// Donji radni panel. Ručka (samo kad je panel proširiv) se dodirne ili povuče
// gore/dole; ostatak panela se NE povlači - mapa i dugmad ostaju pouzdani.
const props = defineProps<{
  expandable: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  height: [value: number];
}>();

const sheet = ref<HTMLElement | null>(null);

// Visinu panela javljamo mapi: kamera uklapa kurira i cilj u dio iznad panela.
let observer: ResizeObserver | null = null;
onMounted(() => {
  if (!sheet.value || typeof ResizeObserver === "undefined") return;
  emit("height", Math.round(sheet.value.offsetHeight));
  observer = new ResizeObserver(() => {
    if (sheet.value) emit("height", Math.round(sheet.value.offsetHeight));
  });
  observer.observe(sheet.value);
});
onBeforeUnmount(() => observer?.disconnect());

const DRAG_START_PX = 6;
const DRAG_TOGGLE_PX = 24;

let startY: number | null = null;
let moved = false;
// Povlačenje završava klikom; taj klik ne smije da promijeni stanje drugi put.
let swallowClick = false;

const onPointerDown = (event: PointerEvent) => {
  startY = event.clientY;
  moved = false;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const onPointerMove = (event: PointerEvent) => {
  if (startY === null) return;
  if (Math.abs(event.clientY - startY) > DRAG_START_PX) moved = true;
};

const onPointerUp = (event: PointerEvent) => {
  if (startY === null) return;
  const dy = event.clientY - startY;
  startY = null;
  if (moved && Math.abs(dy) > DRAG_TOGGLE_PX) {
    swallowClick = true;
    // Ako pregledač ne pošalje klik poslije povlačenja, ne smije da pojede sljedeći dodir.
    setTimeout(() => (swallowClick = false), 80);
    const wantOpen = dy < 0;
    if (wantOpen !== props.open) emit("update:open", wantOpen);
  }
};

const onPointerCancel = () => {
  startY = null;
};

const onClick = () => {
  if (swallowClick) {
    swallowClick = false;
    return;
  }
  emit("update:open", !props.open);
};
</script>
