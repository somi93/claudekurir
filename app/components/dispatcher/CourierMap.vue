<template>
  <v-card class="map-card" flat>
    <v-overlay
      v-if="loading && locations.length === 0"
      model-value
      contained
      persistent
      class="overlay-center"
    >
      <v-progress-circular indeterminate color="primary" class="mb-2" />
      <div class="overlay-text">Učitavam mapu i lokacije...</div>
    </v-overlay>

    <PageAlert v-else-if="errorMessage" variant="flat" class="overlay-alert">
      {{ errorMessage }}
    </PageAlert>

    <v-chip class="overlay-sync" size="small" variant="elevated">
      Poslednje osveženo: {{ lastUpdated ?? "—" }}
    </v-chip>

    <ClientOnly>
      <LMap
        :zoom="initialZoom"
        :center="initialCenter"
        :use-global-leaflet="false"
        :attribution-control="false"
        class="leaflet-map"
        @ready="onMapReady"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          layer-type="base"
          name="OpenStreetMap"
          attribution="&copy; OpenStreetMap contributors"
        />

        <!-- Leaflet-ov default attribution prefix ubacuje ukrajinsku zastavu -
             gasimo ga na LMap-u i vraćamo samo obično "Leaflet" ovde. -->
        <LControlAttribution position="bottomright" prefix="Leaflet" />

        <LCircleMarker
          v-for="marker in markers"
          :key="`${marker.courierId}-${marker.loc.updated_at}`"
          :lat-lng="[marker.loc.latitude, marker.loc.longitude]"
          :radius="selectedCourierId === marker.courierId ? 13 : 10"
          color="#0b1220"
          :fill-color="STATE_META[marker.state].color"
          :weight="selectedCourierId === marker.courierId ? 3 : 2"
          :fill-opacity="marker.longOffline ? 0.45 : 0.95"
          @click="emit('select', marker.courierId)"
        >
          <LPopup>
            <div class="popup-card">
              <strong>
                {{ marker.name ? toLatin(marker.name) : `Dostavljač #${marker.courierId}` }}
              </strong>
              <p>ID #{{ marker.courierId }}</p>
              <p v-if="marker.phone">Telefon: {{ marker.phone }}</p>
              <p v-if="marker.vehicle">
                Vozilo: {{ courierVehicleMeta(marker.vehicle.type).label }}
              </p>
              <p>Status: {{ STATE_META[marker.state].label }}</p>
              <p>
                Brzina:
                {{ marker.loc.speed ? `${marker.loc.speed.toFixed(1)} m/s` : "n/a" }}
              </p>
              <p>Ažurirano: {{ relativeTime(marker.loc.updated_at, now) }}</p>
            </div>
          </LPopup>
        </LCircleMarker>
      </LMap>
    </ClientOnly>

    <div class="map-legend">
      <span v-for="item in legendItems" :key="item.key" class="legend-item">
        <span class="legend-dot" :style="{ background: item.color }" />
        {{ item.label }}
      </span>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PageAlert from "~/components/common/PageAlert.vue";
import {
  STATE_META,
  STATE_PRIORITY,
  isLongOffline,
  relativeTime,
  type EnrichedCourierLocation,
} from "~/utils/courierStatus";
import { courierVehicleMeta } from "~/utils/vehicle";

type LeafletMapLike = {
  flyTo: (
    latLng: [number, number],
    zoom: number,
    options?: Record<string, unknown>
  ) => void;
};

const props = defineProps<{
  loading: boolean;
  errorMessage: string;
  lastUpdated: string | null;
  locations: EnrichedCourierLocation[];
  selectedCourierId: number | null;
  mapCenter: [number, number];
  focusToken: number;
  now: number;
}>();

const emit = defineEmits<{
  select: [courierId: number];
}>();

const legendItems = [
  { key: "delivering", label: STATE_META.delivering.label, color: STATE_META.delivering.color },
  { key: "online", label: STATE_META.online.label, color: STATE_META.online.color },
  { key: "offline", label: STATE_META.offline.label, color: STATE_META.offline.color },
];

// Kuriri bez `location` bloka (nemaju poznatu poziciju) ne mogu na mapu.
// Aktivni se crtaju preko neaktivnih (obrnut prioritet od liste), da se
// offline markeri koji se preklapaju ne bi vizuelno nalazili preko kurira
// koji su trenutno u dostavi/slobodni.
const markers = computed(() =>
  props.locations
    .filter((entry) => entry.courier.location !== null)
    .sort((a, b) => STATE_PRIORITY[b.state] - STATE_PRIORITY[a.state])
    .map((entry) => ({
      courierId: entry.courier.courier_id,
      name: entry.courier.name,
      phone: entry.courier.phone,
      vehicle: entry.courier.vehicle,
      state: entry.state,
      loc: entry.courier.location!,
      longOffline: isLongOffline(entry.courier, props.now),
    }))
);

// Centar/zoom mape se postavljaju samo pri prvom iscrtavanju - svaka kasnija
// promena (izbor kurira, dugme "Centriraj") ide preko flyTo ispod, da mapa
// animira umesto da naglo skoči na svaki refresh podataka.
const initialCenter = ref<[number, number]>(props.mapCenter);
const initialZoom = ref(12);

const leafletMapObject = ref<LeafletMapLike | null>(null);
const onMapReady = (map: LeafletMapLike) => {
  leafletMapObject.value = map;
};

watch(
  () => [props.selectedCourierId, props.focusToken] as const,
  ([courierId]) => {
    const map = leafletMapObject.value;
    if (courierId === null || !map) return;

    const target = props.locations.find(
      (entry) => entry.courier.courier_id === courierId
    );
    if (!target || !target.courier.location) return;

    try {
      map.flyTo(
        [target.courier.location.latitude, target.courier.location.longitude],
        15,
        { duration: 0.8 }
      );
    } catch (error) {
      console.warn("Preskačem centriranje mape - Leaflet nije spreman:", error);
    }
  }
);
</script>

<style scoped>
.map-card {
  position: relative;
  height: 68vh;
  min-height: 68vh;
  overflow: hidden;
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.leaflet-map {
  height: 68vh;
  width: 100%;
}

.overlay-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.overlay-text {
  color: #fff;
  font-weight: 700;
}

.overlay-alert {
  position: absolute;
  z-index: 500;
  left: 16px;
  top: 16px;
}

.overlay-sync {
  position: absolute;
  z-index: 500;
  right: 16px;
  top: 16px;
}

.map-legend {
  position: absolute;
  z-index: 500;
  left: 16px;
  bottom: 16px;
  display: flex;
  gap: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(6px);
  padding: 8px 14px;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(11, 18, 32, 0.12);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #0b1220;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.popup-card p {
  margin: 4px 0 0;
  color: #6b7685;
}

@media (max-width: 960px) {
  .leaflet-map,
  .map-card {
    min-height: 56vh;
    height: 56vh;
  }
}
</style>
