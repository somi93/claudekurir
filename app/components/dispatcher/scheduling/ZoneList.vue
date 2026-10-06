<template>
  <div class="zl">
    <AppButton icon="mdi-plus" :disabled="editing" data-field="zone-new" @click="emit('new')">Nova zona</AppButton>

    <label v-if="showSearch" class="zl-search">
      <v-icon icon="mdi-magnify" size="20" />
      <input
        :value="query"
        type="search"
        placeholder="Traži zonu"
        aria-label="Traži zonu"
        autocomplete="off"
        data-field="zone-search"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div v-if="!zones.length" class="zl-empty">
      <b>{{ city || "Grad" }} nema nijednu zonu</b>
      <span>Zona je krug na karti (centar i radijus). Napravi prvu, pa onda planiraj smjene.</span>
    </div>
    <div v-else-if="!shown.length" class="zl-empty">
      <b>Nema zone „{{ query }}“</b>
      <AppButton variant="ghost" data-field="zone-q-clear" @click="emit('update:query', '')">Obriši pretragu</AppButton>
    </div>
    <div v-else class="zl-list" role="list" aria-label="Zone" @keydown="onKey">
      <SettingRow
        v-for="(z, i) in shown"
        :key="z.id"
        role="listitem"
        interactive
        icon="mdi-map-marker-radius-outline"
        :tone="hasGeo(z) ? 'blue' : 'warn'"
        :label="`Faktor terena ${fmtNum(z.tf)}${hasGeo(z) ? ' · r ' + fmtKm(z.r) : ''}`"
        :value="z.name"
        :chip="hasGeo(z) ? null : { tone: 'warn', text: 'Nema položaj na karti', icon: 'mdi-alert-outline' }"
        :selected="selectedId === z.id"
        :tabindex="selectedId === z.id || (selectedId == null && i === 0) ? 0 : -1"
        :data-zid="z.id"
        @click="emit('pick', z.id)"
      />
    </div>

    <p class="zl-count">{{ zones.length }} {{ plural(zones.length, "zona", "zone", "zona") }} u gradu {{ city }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import SettingRow from "~/components/common/SettingRow.vue";
import { plural } from "~/utils/schedule";
import { fmtKm, fmtNum, hasGeo, searchZones, type GeoZone } from "~/utils/zoneGeo";

// Spisak zona grada firme: "Nova zona", pretraga (kad zona ima više od šest), redovi sa faktorom terena i
// radijusom. Izabran red je istaknut, a strelice gore/dolje biraju red (jedan taster Tab). Zona bez položaja
// na karti ima oznaku, jer se na karti ne vidi.
const props = defineProps<{
  zones: GeoZone[];
  selectedId: number | null;
  query: string;
  city: string;
  editing: boolean;
}>();

const emit = defineEmits<{ new: []; pick: [id: number]; "update:query": [value: string] }>();

const shown = computed(() => searchZones(props.zones, props.query));
const showSearch = computed(() => props.zones.length > 6 || !!props.query);

const onKey = async (event: KeyboardEvent) => {
  if (props.editing || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
  const row = (event.target as HTMLElement).closest<HTMLElement>("[data-zid]");
  if (!row) return;
  event.preventDefault();
  const rows = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[data-zid]")];
  const i = rows.indexOf(row);
  const next = rows[event.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)];
  if (!next) return;
  const id = Number(next.dataset.zid);
  emit("pick", id);
  await nextTick();
  (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-zid="${id}"]`)?.focus();
};
</script>

<style scoped>
.zl {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.zl-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 6px 0 14px;
  border-radius: 14px;
  background: #fff;
  box-shadow: inset 0 0 0 1.5px #e2e5ea;
}

.zl-search:focus-within {
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.zl-search input {
  flex: 1;
  min-width: 0;
  height: 46px;
  border: 0;
  outline: 0;
  background: none;
  color: #0b1220;
  font: inherit;
  font-weight: 600;
}

.zl-list {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.zl-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 34px 18px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  color: #5b6676;
  font-size: 0.9rem;
  text-align: center;
}

.zl-empty b {
  color: #0b1220;
  font-size: 1rem;
}

.zl-count {
  margin: 0;
  padding: 0 4px;
  font-size: 0.78rem;
  color: #5b6676;
}
</style>
