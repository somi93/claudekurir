<template>
  <div>
    <div ref="zoneMapSectionRef" class="zone-map-section">
      <div class="zone-map-layout" :class="{ 'zone-map-layout--with-draft': !!draftZone }">
        <ZoneMap
          ref="zoneMapRef"
          :zones="zones"
          :draft="
            draftZone
              ? {
                  centerLat: draftZone.centerLat,
                  centerLng: draftZone.centerLng,
                  radiusMeters: draftZone.radiusMeters,
                }
              : null
          "
          :selected-zone-id="selectedZoneId"
          @map-click="onZoneMapClick"
        />
        <ZoneDraftForm
          v-if="draftZone"
          v-model:draft="draftZone"
          :saving="saving"
          :cities="cityOptions"
          @save="saveZoneDraft"
          @cancel="draftZone = null"
          @coords-input="zoneMapRef?.flyToDraft()"
        />
      </div>
    </div>

    <ZoneListPanel
      :zones="zones"
      :loading="loading"
      :saving="saving"
      :selected-zone-id="selectedZoneId"
      :cities="cityOptions"
      @select="onSelectZone"
      @create-new="startCreateZone"
      @edit="startEditZone"
      @delete="onDeleteZone"
      @filter="emit('filter', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import ZoneMap from "~/components/dispatcher/scheduling/ZoneMap.vue";
import ZoneDraftForm, { type ZoneDraftState } from "~/components/dispatcher/scheduling/ZoneDraftForm.vue";
import ZoneListPanel from "~/components/dispatcher/scheduling/ZoneListPanel.vue";
import { useAlertStore } from "~/stores/alert";
import type { DispatcherZone, DispatcherZonePayload } from "~/types/dispatcherZone";

const DEFAULT_LAT = 44.7725;
const DEFAULT_LNG = 17.1925;

const props = defineProps<{
  zones: DispatcherZone[];
  loading: boolean;
  saving: boolean;
  cityOptions: { title: string; value: number }[];
  defaultCityId: number | null;
  create: (payload: DispatcherZonePayload) => Promise<boolean>;
  update: (zoneId: number, payload: DispatcherZonePayload) => Promise<boolean>;
  remove: (zoneId: number) => Promise<boolean>;
}>();

const emit = defineEmits<{
  filter: [cityId: number | null];
}>();

const alertStore = useAlertStore();

const draftZone = ref<ZoneDraftState | null>(null);
const selectedZoneId = ref<number | null>(null);
const zoneMapSectionRef = ref<HTMLElement | null>(null);
const zoneMapRef = ref<InstanceType<typeof ZoneMap> | null>(null);

watch(draftZone, (draft, previousDraft) => {
  if (!draft || previousDraft) return;
  nextTick(() => {
    zoneMapSectionRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const startCreateZone = () => {
  draftZone.value = {
    id: null,
    cityId: props.defaultCityId,
    name: "",
    terrainFactor: 1,
    centerLat: DEFAULT_LAT,
    centerLng: DEFAULT_LNG,
    radiusMeters: 1000,
  };
  selectedZoneId.value = null;
};

const startEditZone = (zone: DispatcherZone) => {
  draftZone.value = {
    id: zone.id,
    cityId: zone.cityId,
    name: zone.name,
    terrainFactor: zone.terrainFactor,
    centerLat: zone.centerLat ?? DEFAULT_LAT,
    centerLng: zone.centerLng ?? DEFAULT_LNG,
    radiusMeters: zone.radiusMeters ?? 1000,
  };
  selectedZoneId.value = zone.id;
};

const onSelectZone = (zoneId: number) => {
  // Dok je forma za izmjenu otvorena, klik na karticu otvara tu zonu za izmjenu.
  if (draftZone.value) {
    const zone = props.zones.find((z) => z.id === zoneId);
    if (zone) startEditZone(zone);
    return;
  }
  selectedZoneId.value = zoneId;
};

const onZoneMapClick = ({ lat, lng }: { lat: number; lng: number }) => {
  if (!draftZone.value) return;
  draftZone.value.centerLat = lat;
  draftZone.value.centerLng = lng;
};

const saveZoneDraft = async () => {
  const draft = draftZone.value;
  if (!draft || !draft.cityId) {
    alertStore.error("Unesi ID grada za zonu.");
    return;
  }
  const payload: DispatcherZonePayload = {
    city_id: draft.cityId,
    name: draft.name,
    center_lat: draft.centerLat,
    center_lng: draft.centerLng,
    radius_meters: draft.radiusMeters,
    terrain_factor: draft.terrainFactor,
  };
  const ok = draft.id ? await props.update(draft.id, payload) : await props.create(payload);
  if (ok) draftZone.value = null;
};

const onDeleteZone = async (zoneId: number) => {
  const ok = await props.remove(zoneId);
  if (ok) {
    if (selectedZoneId.value === zoneId) selectedZoneId.value = null;
    if (draftZone.value?.id === zoneId) draftZone.value = null;
  }
};
</script>

<style scoped>
.zone-map-section {
  scroll-margin-top: 88px;
}

.zone-map-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

@media (min-width: 960px) {
  .zone-map-layout--with-draft {
    display: grid;
    grid-template-columns: 1fr 360px;
    align-items: start;
    gap: 20px;
  }
}
</style>
