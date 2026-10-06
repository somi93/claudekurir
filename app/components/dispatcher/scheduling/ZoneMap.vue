<template>
  <div class="zm" :style="{ height: `${height}px` }">
    <span class="zm-chip">Zona na karti: {{ geoZones.length }}</span>
    <button type="button" class="zm-fit" data-field="zone-fit" @click="fitAll">
      <v-icon icon="mdi-map-outline" size="18" />Prikaži sve
    </button>

    <ClientOnly>
      <LMap
        :zoom="12"
        :center="startCenter"
        :use-global-leaflet="false"
        :options="{ attributionControl: false }"
        class="zm-map"
        @ready="onReady"
        @click="onMapClick"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          layer-type="base"
          name="OpenStreetMap"
          attribution="&copy; OpenStreetMap contributors"
        />
        <LControlAttribution position="bottomright" prefix="Leaflet" />

        <template v-for="z in geoZones" :key="z.id">
          <LCircle
            :lat-lng="[z.lat, z.lng]"
            :radius="z.r"
            :color="z.id === selectedId && !draft ? '#2f6fed' : '#0b1220'"
            :weight="z.id === selectedId && !draft ? 3.5 : 1.8"
            :fill-color="z.id === selectedId && !draft ? '#2f6fed' : '#0b1220'"
            :fill-opacity="z.id === selectedId && !draft ? 0.18 : 0.07"
            @click="emit('pick', z.id)"
          >
            <LTooltip :options="{ permanent: true, direction: 'center', className: `zm-label${z.id === selectedId && !draft ? ' is-sel' : ''}` }">
              {{ z.name }}
            </LTooltip>
          </LCircle>
        </template>

        <LCircle
          v-if="draft"
          :lat-lng="[draft.lat, draft.lng]"
          :radius="draft.r"
          color="#b86e00"
          :weight="3"
          dash-array="9 6"
          fill-color="#e08a14"
          :fill-opacity="0.16"
        >
          <LTooltip :options="{ permanent: true, direction: 'top', className: 'zm-label zm-label--draft' }">
            {{ draft.name || "Nova zona" }}
          </LTooltip>
        </LCircle>
        <LCircleMarker
          v-if="draft"
          :lat-lng="[draft.lat, draft.lng]"
          :radius="7"
          color="#b86e00"
          :weight="3"
          fill-color="#ffffff"
          :fill-opacity="1"
        />
      </LMap>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { boundsOfCircles, centroid, hasGeo, type Circle, type GeoZone } from "~/utils/zoneGeo";

type LeafletMapLike = {
  fitBounds: (bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void;
  panTo: (latLng: [number, number], options?: Record<string, unknown>) => void;
  getCenter: () => { lat: number; lng: number };
  invalidateSize: () => void;
};

// Karta zona: nazivi na krugovima, izabrana zona je plava, krug se klikom bira, a početni pogled obuhvata SVE
// zone firme (ma gdje bile). Dok se zona uređuje, nacrt je isprekidan narandžast krug sa centrom koji se
// pomjera klikom na kartu. Početni pogled se računa kad zone stignu, ne jednom pri otvaranju stranice.
const props = withDefaults(
  defineProps<{
    zones: GeoZone[];
    selectedId: number | null;
    draft: { lat: number; lng: number; r: number; name: string } | null;
    height?: number;
  }>(),
  { height: 400 }
);

const emit = defineEmits<{
  pick: [id: number];
  "map-click": [payload: { lat: number; lng: number }];
}>();

// Primjer centra iz API_dostupnost_kurira.md (Banja Luka): samo dok nijedna zona nema položaj.
const DEFAULT_CENTER: [number, number] = [44.7725, 17.1925];

const geoZones = computed(() => props.zones.filter(hasGeo));
const startCenter = computed<[number, number]>(() => {
  const c = centroid(geoZones.value);
  return c ? [c.lat, c.lng] : DEFAULT_CENTER;
});

const map = ref<LeafletMapLike | null>(null);

const fitCircles = (circles: Circle[], pad = 0.1) => {
  const bounds = boundsOfCircles(circles, pad);
  if (!bounds || !map.value) return;
  try {
    map.value.fitBounds(bounds, { padding: [16, 16], maxZoom: 16, animate: false });
  } catch (error) {
    console.warn("Preskačem prilagođavanje karte - Leaflet nije spreman:", error);
  }
};

const fitAll = () => fitCircles(geoZones.value);
const focusZone = (id: number) => {
  const z = geoZones.value.find((x) => x.id === id);
  if (z) fitCircles([{ lat: z.lat, lng: z.lng, r: z.r * 1.7 }], 0.05);
};

const onReady = (m: LeafletMapLike) => {
  map.value = m;
  void nextTick(() => {
    m.invalidateSize();
    fitAll();
  });
};

// Skup zona se promijenio (stigle su, druga firma, nova ili obrisana): pogled obuhvata sve.
const zonesKey = computed(() => geoZones.value.map((z) => z.id).join(","));
watch(zonesKey, () => void nextTick(fitAll));

const onMapClick = (event: { latlng: { lat: number; lng: number } }) => {
  emit("map-click", { lat: event.latlng.lat, lng: event.latlng.lng });
};

// Središte prikazanog dijela: nova zona počinje tu, ne na tvrdo zadatim koordinatama.
const getCenter = (): { lat: number; lng: number } | null => {
  const c = map.value?.getCenter();
  return c ? { lat: c.lat, lng: c.lng } : null;
};
const panTo = (lat: number, lng: number) => {
  try {
    map.value?.panTo([lat, lng], { animate: true, duration: 0.5 });
  } catch (error) {
    console.warn("Preskačem pomjeranje karte - Leaflet nije spreman:", error);
  }
};

// Karta je bila u skrivenom tabu: mjere se računaju iznova, pogled ostaje.
const refresh = () => {
  try {
    map.value?.invalidateSize();
  } catch (error) {
    console.warn("Preskačem osvježavanje karte - Leaflet nije spreman:", error);
  }
};

defineExpose({ fitAll, focusZone, getCenter, panTo, refresh });
</script>

<style scoped>
.zm {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  background: #e9eee6;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.zm-map {
  width: 100%;
  height: 100%;
}

.zm-chip {
  position: absolute;
  z-index: 500;
  left: 10px;
  bottom: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(11, 18, 32, 0.82);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.zm-fit {
  position: absolute;
  z-index: 500;
  right: 10px;
  top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.zm-fit:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>

<style>
/* Nazivi na krugovima (Leaflet ih crta izvan komponente): tekst sa bijelim obrubom, bez kutije i strelice. */
.leaflet-tooltip.zm-label {
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
  color: #0b1220;
  font-size: 13px;
  font-weight: 800;
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 0 4px #fff;
  white-space: nowrap;
}

.leaflet-tooltip.zm-label::before {
  display: none;
}

.leaflet-tooltip.zm-label.is-sel {
  color: #17408f;
  font-size: 15px;
}

.leaflet-tooltip.zm-label--draft {
  color: #6b3b00;
}
</style>
