<template>
  <section ref="root" class="dl-root" aria-label="Dostave">
    <DeliveryMap
      ref="mapRef"
      :courier-location="courierLocation"
      :courier-heading="courierHeading"
      :courier-speed="courierSpeed"
      :signal-lost="signalLost"
      :pins="pins"
      :route-line="routeLine"
      :route-approximate="routeApproximate"
      :next-leg="nextLeg"
      :insets="insets"
      :fit-key="fitKey"
      :follow-zoom="followZoom"
      :compact="compact"
      @camera="camera = $event"
    />

    <div class="dl-top">
      <StatusPill :tone="status.tone" :label="status.label" :detail="status.detail" @select="emit('status-select')" />
      <div class="dl-fabs">
        <button
          v-if="showFit"
          type="button"
          class="dl-fab"
          :class="{ 'is-on': camera.mode === 'fit' && !camera.free }"
          aria-label="Cijela ruta"
          @click="mapRef?.fitRoute('user')"
        >
          <v-icon icon="mdi-map-marker-path" size="22" />
        </button>
        <button
          v-if="showRecenter"
          type="button"
          class="dl-fab"
          :class="{
            'is-on': camera.mode === 'follow' && !camera.free,
            'is-pulse': camera.free,
          }"
          aria-label="Centriraj na mene"
          @click="mapRef?.followMe('user')"
        >
          <v-icon icon="mdi-crosshairs-gps" size="22" />
        </button>
      </div>
    </div>

    <DeliverySheet
      :expandable="expandable"
      :open="sheetOpen"
      @update:open="emit('update:sheetOpen', $event)"
      @height="onSheetHeight"
    >
      <slot />
    </DeliverySheet>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import "~/assets/css/courier-delivery.css";
import DeliveryMap from "~/components/courier/DeliveryMapNew.vue";
import DeliverySheet from "~/components/courier/delivery/DeliverySheet.vue";
import StatusPill from "~/components/courier/delivery/StatusPill.vue";
import type { CameraState, MapInsets, MapPin } from "~/types/deliveryMap";
import type { LatLngTuple } from "~/utils/geo";

// Ekran Dostave: mapa preko cijelog prostora, pilula statusa, dvije plutajuće
// komande kamere i radni panel (slot). Stage zna samo kako da složi mapu i panel;
// šta piše u panelu odlučuje stranica.
const props = defineProps<{
  courierLocation: { latitude: number; longitude: number } | null;
  courierHeading: number | null;
  courierSpeed: number | null;
  signalLost: boolean;
  pins: MapPin[];
  routeLine: LatLngTuple[] | null;
  routeApproximate: boolean;
  nextLeg: LatLngTuple[] | null;
  fitKey: number;
  followZoom: number;
  status: { tone: "ok" | "warn" | "bad"; label: string; detail?: string | null };
  expandable: boolean;
  sheetOpen: boolean;
  // GPS postoji (ili se čeka prvi fix): "Centriraj" ima smisla.
  canRecenter: boolean;
}>();

const emit = defineEmits<{
  "update:sheetOpen": [value: boolean];
  "status-select": [];
}>();

const mapRef = ref<InstanceType<typeof DeliveryMap> | null>(null);
const camera = ref<CameraState>({ mode: props.pins.some((pin) => !pin.dim) ? "fit" : "follow", free: false });
// Visina panela KAD JE ZATVOREN. Kamera računa kadar po njoj: proširen panel zaklanja
// skoro cijelu mapu, pa bi uklapanje rute u ostatak (par desetina piksela) pokvarilo
// prikaz. Kad kurir širi panel, mapa ostaje gdje jeste; zatvaranjem je opet cijela.
const sheetHeight = ref(0);
const onSheetHeight = (height: number) => {
  if (!props.sheetOpen || sheetHeight.value === 0) sheetHeight.value = height;
};

// Odredište = pin koji je na redu; prigušen "sljedeći cilj" sam ne daje šta da se uklopi.
const hasTargets = computed(() => props.pins.some((pin) => !pin.dim));

// "Cijela ruta" ima smisla kad mapa ima šta da uklopi osim samog kurira.
const showFit = computed(() => hasTargets.value);
const showRecenter = computed(() => props.canRecenter);

// Pilula (gore lijevo) i dugmad (gore desno) zaklanjaju mapu, a oblačići iznad
// pinova trebaju prostora - zato su margine veće kad ima odredišta.
const insets = computed<MapInsets>(() => ({
  top: hasTargets.value ? 100 : 64,
  left: hasTargets.value ? 64 : 26,
  right: hasTargets.value ? 84 : 26,
  bottom: sheetHeight.value + 16,
}));

const root = ref<HTMLElement | null>(null);
const stageHeight = ref(0);
// Slobodnog prostora iznad panela je malo: nazivi iznad pinova se kriju.
const compact = computed(() => stageHeight.value > 0 && stageHeight.value - sheetHeight.value < 250);

let observer: ResizeObserver | null = null;
onMounted(() => {
  if (!root.value || typeof ResizeObserver === "undefined") return;
  stageHeight.value = Math.round(root.value.clientHeight);
  observer = new ResizeObserver(() => {
    if (root.value) stageHeight.value = Math.round(root.value.clientHeight);
  });
  observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
