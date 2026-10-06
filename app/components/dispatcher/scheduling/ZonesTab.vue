<template>
  <div class="zt">
    <div v-if="state === 'loading'" class="zt-split" aria-busy="true" aria-label="Učitavam zone">
      <div class="zt-skel-list">
        <div v-for="i in 4" :key="i" class="zt-sk" style="height: 64px" />
      </div>
      <div class="zt-sk" style="height: 380px; border-radius: 20px" />
    </div>

    <TintAlert v-else-if="state === 'error'" tone="bad" role="alert" title="Ne mogu da učitam zone">
      {{ errorReason || "Server ne odgovara." }} Spisak nije prikazan, jer bi prazan spisak izgledao kao da zona nema.
      <template #action>
        <button type="button" data-field="zones-retry" @click="emit('retry')">Pokušaj ponovo</button>
      </template>
    </TintAlert>

    <TintAlert v-else-if="state === 'nocity'" tone="warn" title="Firma nema grad">
      Zone pripadaju gradu firme, pa se ne mogu prikazati ni praviti dok se grad ne postavi na tabu Pravila.
    </TintAlert>

    <div v-else class="zt-split" :class="{ 'zt-split--wide': wide }">
      <ZoneList
        v-if="wide"
        v-model:query="query"
        :zones="zones"
        :selected-id="selectedId"
        :city="city"
        :editing="!!edit"
        @new="startEdit(null)"
        @pick="pick"
      />

      <div class="zt-main">
        <ZoneMap
          ref="map"
          :zones="zones"
          :selected-id="edit ? null : selectedId"
          :draft="mapDraft"
          :height="wide ? 400 : 260"
          @pick="pick"
          @map-click="onMapClick"
        />

        <ZoneEditor
          v-if="edit"
          :draft="edit.draft"
          :orig="edit.orig"
          :zones="zones"
          :city="city"
          :saving="saving"
          :ask-discard="askDiscard"
          @save="save"
          @cancel="cancelEdit"
          @keep="askDiscard = false"
          @drop="dropEdit"
          @coords="panToDraft"
        />
        <ZoneDetail
          v-else-if="selected"
          :zone="selected"
          :zones="zones"
          :shifts="shifts"
          :now="now"
          :range="range"
          @edit="startEdit(selected)"
          @delete="deleteOpen = true"
        />
      </div>

      <ZoneList
        v-if="!wide"
        v-model:query="query"
        :zones="zones"
        :selected-id="selectedId"
        :city="city"
        :editing="!!edit"
        @new="startEdit(null)"
        @pick="pick"
      />
    </div>

    <ZoneDeleteSheet
      :open="deleteOpen"
      :zone="selected"
      :city="city"
      :company-id="companyId"
      :now="now"
      :saving="saving"
      @update:open="deleteOpen = $event"
      @confirm="removeSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import ZoneDeleteSheet from "~/components/dispatcher/scheduling/ZoneDeleteSheet.vue";
import ZoneDetail from "~/components/dispatcher/scheduling/ZoneDetail.vue";
import ZoneEditor from "~/components/dispatcher/scheduling/ZoneEditor.vue";
import ZoneList from "~/components/dispatcher/scheduling/ZoneList.vue";
import ZoneMap from "~/components/dispatcher/scheduling/ZoneMap.vue";
import { registerCompanyChangeGuard, registerSheetGuard } from "~/composables/useSheetGuard";
import { useAlertStore } from "~/stores/alert";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { fold, type Clock, type SchedShift } from "~/utils/schedule";
import { centroid, hasGeo, zoneDirty, type GeoZone, type ZoneDraft } from "~/utils/zoneGeo";
import type { DispatcherZonePayload } from "~/types/dispatcherZone";

// Tab "Zone": spisak i karta zajedno (izbor u spisku približava kartu, krug na karti bira zonu), detalj izabrane
// zone sa brojem smjena i preklapanjem, uređivač sa krugom uživo na karti i brisanje koje kaže šta zona drži.
// Zone su samo one grada firme. Dok se zona uređuje, odlazak sa stranice i promjena firme pitaju za nesačuvano.
const props = defineProps<{
  zones: GeoZone[];
  state: "loading" | "error" | "nocity" | "ok";
  errorReason: string;
  city: string;
  cityId: number | null;
  companyId: number | null;
  saving: boolean;
  now: Clock;
  shifts: SchedShift[];
  range: { from: string; to: string } | null;
  wide: boolean;
  // Tab je trenutno vidljiv (karta se tada osvježava, jer je u skrivenom tabu izgubila mjere).
  active: boolean;
  save: (id: number | null, payload: DispatcherZonePayload) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
}>();

const emit = defineEmits<{ retry: [] }>();

const alertStore = useAlertStore();
const companies = useDeliveryCompaniesStore();

const map = ref<InstanceType<typeof ZoneMap> | null>(null);
const sel = ref<number | null>(null);
const query = ref("");
const edit = ref<{ draft: ZoneDraft; orig: ZoneDraft } | null>(null);
const askDiscard = ref(false);
const deleteOpen = ref(false);

// Izabrana zona: ona koju je dispečer izabrao, inače prva koja ima položaj na karti.
const selectedId = computed(() => {
  if (sel.value != null && props.zones.some((z) => z.id === sel.value)) return sel.value;
  return (props.zones.find(hasGeo) ?? props.zones[0])?.id ?? null;
});
const selected = computed(() => props.zones.find((z) => z.id === selectedId.value) ?? null);

const mapDraft = computed(() => {
  const d = edit.value?.draft;
  if (!d || !Number.isFinite(d.lat) || !Number.isFinite(d.lng) || !Number.isFinite(d.r)) return null;
  return { lat: d.lat, lng: d.lng, r: d.r, name: d.name };
});

const pick = (id: number) => {
  if (edit.value) {
    alertStore.info("Prvo sačuvaj izmjenu ili odustani.");
    return;
  }
  sel.value = id;
  map.value?.focusZone(id);
};

// --- uređivanje --------------------------------------------------------------------------------
const dirty = computed(() => !!edit.value && (edit.value.draft.id == null || zoneDirty(edit.value.draft, edit.value.orig)));

let pendingCompany: number | null = null;
let unregSheet: (() => void) | null = null;
let unregCompany: (() => void) | null = null;

const registerGuards = () => {
  unregSheet?.();
  unregCompany?.();
  unregSheet = registerSheetGuard({
    dirty: () => dirty.value,
    ask: () => {
      askDiscard.value = true;
    },
  });
  unregCompany = registerCompanyChangeGuard((next) => {
    if (!dirty.value) return false;
    pendingCompany = next;
    askDiscard.value = true;
    return true;
  });
};
const unregisterGuards = () => {
  unregSheet?.();
  unregCompany?.();
  unregSheet = null;
  unregCompany = null;
};

const startEdit = (zone: GeoZone | null) => {
  if (edit.value) return;
  const center = map.value?.getCenter() ?? centroid(props.zones.filter(hasGeo)) ?? { lat: 44.7725, lng: 17.1925 };
  const geo = zone && hasGeo(zone) ? zone : null;
  const draft: ZoneDraft = {
    id: zone?.id ?? null,
    name: zone?.name ?? "",
    tf: zone?.tf ?? 1,
    r: geo ? geo.r : 1000,
    lat: geo ? geo.lat : center.lat,
    lng: geo ? geo.lng : center.lng,
  };
  askDiscard.value = false;
  edit.value = { draft, orig: { ...draft } };
  registerGuards();
  void nextTick(() => document.querySelector<HTMLElement>('[data-field="zone-name"]')?.focus({ preventScroll: true }));
};

const closeEdit = () => {
  edit.value = null;
  askDiscard.value = false;
  unregisterGuards();
};

const cancelEdit = () => {
  if (dirty.value && !askDiscard.value) {
    askDiscard.value = true;
    void nextTick(() => document.querySelector<HTMLElement>('[data-discard="keep"]')?.focus({ preventScroll: true }));
    return;
  }
  closeEdit();
  void nextTick(() => document.querySelector<HTMLElement>('[data-field="zone-edit"]')?.focus({ preventScroll: true }));
};

const dropEdit = () => {
  const next = pendingCompany;
  pendingCompany = null;
  closeEdit();
  if (next != null) companies.selectedCompanyId = next;
};

const onMapClick = (p: { lat: number; lng: number }) => {
  const d = edit.value?.draft;
  if (!d) return;
  d.lat = p.lat;
  d.lng = p.lng;
};
const panToDraft = () => {
  const d = edit.value?.draft;
  if (d && Number.isFinite(d.lat) && Number.isFinite(d.lng)) map.value?.panTo(d.lat, d.lng);
};

const save = async () => {
  const e = edit.value;
  if (!e || props.saving || props.cityId == null) return;
  const d = e.draft;
  const name = d.name.trim();
  const ok = await props.save(d.id, {
    city_id: props.cityId,
    name,
    center_lat: Number(d.lat.toFixed(6)),
    center_lng: Number(d.lng.toFixed(6)),
    radius_meters: Math.round(d.r),
    terrain_factor: d.tf,
  });
  if (!ok) return;
  closeEdit();
  // Nova zona nema poznat id dok ne stigne u spisak: nalazi se po nazivu.
  const saved = d.id ?? props.zones.find((z) => fold(z.name) === fold(name))?.id ?? null;
  if (saved != null) {
    sel.value = saved;
    await nextTick();
    map.value?.focusZone(saved);
  }
  void nextTick(() => document.querySelector<HTMLElement>('[data-field="zone-edit"]')?.focus({ preventScroll: true }));
};

// --- brisanje ----------------------------------------------------------------------------------
const removeSelected = async () => {
  const z = selected.value;
  if (!z) return;
  if (await props.remove(z.id)) {
    deleteOpen.value = false;
    sel.value = null;
    await nextTick();
    map.value?.fitAll();
  }
};

// Tab se ponovo vidi: karta se mjeri iznova.
watch(
  () => props.active,
  (on) => {
    if (on) void nextTick(() => map.value?.refresh());
  }
);

// Druga firma / grad: uređivanje i izbor ne važe za novi spisak.
watch(
  () => props.companyId,
  () => {
    closeEdit();
    sel.value = null;
    query.value = "";
  }
);

onBeforeUnmount(unregisterGuards);
</script>

<style scoped>
.zt {
  min-width: 0;
}

.zt-split {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.zt-split--wide {
  grid-template-columns: 340px minmax(0, 1fr);
  align-items: start;
}

.zt-main {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.zt-skel-list {
  display: grid;
  gap: 12px;
}

.zt-sk {
  border-radius: 12px;
  background: linear-gradient(90deg, #eceef2 25%, #f6f7f9 37%, #eceef2 63%);
  background-size: 400% 100%;
  animation: zt-sh 1.4s ease infinite;
}

@keyframes zt-sh {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zt-sk {
    animation: none;
  }
}
</style>
