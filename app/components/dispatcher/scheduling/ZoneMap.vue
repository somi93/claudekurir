<template>
  <v-card class="map-card" flat>
    <div class="map-canvas">
      <v-chip class="zone-count-chip" size="small" variant="elevated">
        Zona na mapi: {{ zonesWithGeometry.length }}
      </v-chip>

      <ClientOnly>
        <LMap
          :zoom="initialZoom"
          :center="initialCenter"
          :use-global-leaflet="false"
          :attribution-control="false"
          class="leaflet-map"
          @ready="onMapReady"
          @click="onMapClick"
        >
          <LTileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            layer-type="base"
            name="OpenStreetMap"
            attribution="&copy; OpenStreetMap contributors"
          />
          <LControlAttribution position="bottomright" prefix="Leaflet" />

          <template v-for="zone in zonesWithGeometry" :key="zone.id">
            <LCircle
              :lat-lng="[zone.centerLat!, zone.centerLng!]"
              :radius="zone.radiusMeters!"
              :color="zone.id === selectedZoneId ? '#2f6fed' : '#0b1220'"
              :weight="zone.id === selectedZoneId ? 3 : 1.5"
              :fill-color="zone.id === selectedZoneId ? '#2f6fed' : '#0b1220'"
              :fill-opacity="zone.id === selectedZoneId ? 0.18 : 0.08"
            >
              <LPopup>
                <div class="popup-card">
                  <strong>{{ toLatin(zone.name) }}</strong>
                  <p>Faktor terena: {{ zone.terrainFactor }}</p>
                </div>
              </LPopup>
            </LCircle>
          </template>

          <LCircle
            v-if="draft"
            :lat-lng="[draft.centerLat, draft.centerLng]"
            :radius="draft.radiusMeters"
            color="#e2a300"
            :weight="2"
            dash-array="6 6"
            fill-color="#e2a300"
            :fill-opacity="0.15"
          />
        </LMap>
      </ClientOnly>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DispatcherZone } from "~/types/dispatcherZone";

type LeafletMapLike = {
  flyTo: (
    latLng: [number, number],
    zoom: number,
    options?: Record<string, unknown>
  ) => void;
  getZoom: () => number;
};

type LeafletClickEvent = {
  latlng: { lat: number; lng: number };
};

const props = defineProps<{
  zones: DispatcherZone[];
  draft: { centerLat: number; centerLng: number; radiusMeters: number } | null;
  selectedZoneId: number | null;
}>();

const emit = defineEmits<{
  "map-click": [payload: { lat: number; lng: number }];
}>();

// Primjer centra iz API_dostupnost_kurira.md (Banja Luka) - razuman default
// dok nijedna zona/draft nema koordinate.
const DEFAULT_CENTER: [number, number] = [44.7725, 17.1925];

const zonesWithGeometry = computed(() =>
  props.zones.filter(
    (zone) =>
      zone.centerLat !== null && zone.centerLng !== null && zone.radiusMeters !== null
  )
);

const initialCenter = ref<[number, number]>(
  props.draft
    ? [props.draft.centerLat, props.draft.centerLng]
    : zonesWithGeometry.value[0]
    ? [zonesWithGeometry.value[0]!.centerLat!, zonesWithGeometry.value[0]!.centerLng!]
    : DEFAULT_CENTER
);
const initialZoom = ref(12);

const leafletMapObject = ref<LeafletMapLike | null>(null);
const onMapReady = (map: LeafletMapLike) => {
  leafletMapObject.value = map;
};

const onMapClick = (event: LeafletClickEvent) => {
  emit("map-click", { lat: event.latlng.lat, lng: event.latlng.lng });
};

// Kad kreće nova izmjena/kreiranje (draft ide iz null u vrijednost), centriraj
// mapu na tu zonu - naredni klikovi (pomjeranje centra) ne triggeruju flyTo,
// samo se krug pomjera preko :lat-lng bind-a (klik je već tu gde korisnik gleda).
watch(
  () => props.draft,
  (draft, previous) => {
    const map = leafletMapObject.value;
    if (!draft || previous || !map) return;
    try {
      map.flyTo([draft.centerLat, draft.centerLng], 13, { duration: 0.6 });
    } catch (error) {
      console.warn("Preskačem centriranje mape - Leaflet nije spreman:", error);
    }
  }
);

// Poziva ZoneDraftForm kad korisnik ručno ukuca koordinate (blur na
// polju Geografska širina/dužina) - za razliku od klika na mapu, ovde
// nova tačka može biti van trenutnog vidokruga, pa mapu treba pomjeriti.
// Zadržava trenutni zoom (ne forsira 13 kao prvo centriranje).
const flyToDraft = () => {
  const map = leafletMapObject.value;
  if (!props.draft || !map) return;
  try {
    map.flyTo([props.draft.centerLat, props.draft.centerLng], map.getZoom(), {
      duration: 0.6,
    });
  } catch (error) {
    console.warn("Preskačem centriranje mape - Leaflet nije spreman:", error);
  }
};

defineExpose({ flyToDraft });
</script>

<style scoped>
.map-card {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.map-canvas {
  position: relative;
}

.zone-count-chip {
  position: absolute;
  z-index: 500;
  right: 12px;
  top: 12px;
}

.leaflet-map {
  height: 42vh;
  min-height: 340px;
  width: 100%;
}

@media (max-width: 600px) {
  .leaflet-map {
    height: 34vh;
    min-height: 240px;
  }
}

.popup-card p {
  margin: 4px 0 0;
  color: #6b7685;
}
</style>
