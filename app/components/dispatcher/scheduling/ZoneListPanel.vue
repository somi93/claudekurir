<template>
  <v-card class="list-card" flat>
    <div class="list-toolbar">
      <GlobalFilterBar class="filter-bar">
        <v-menu>
          <template #activator="{ props: menuProps }">
            <GlobalFilterPill
              v-bind="menuProps"
              prepend-icon="mdi-map-marker-outline"
              :label="cityFilterLabel"
              :active="cityFilter !== null"
            />
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="item in cityFilterItems"
              :key="item.value ?? 'all'"
              :active="cityFilter === item.value"
              @click="selectCityFilter(item.value)"
            >
              <v-list-item-title>{{ toLatin(item.title) }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </GlobalFilterBar>

      <GlobalButtonPrimary
        prepend-icon="mdi-plus"
        :disabled="saving"
        class="new-zone-btn"
        @click="emit('create-new')"
      >
        Nova zona
      </GlobalButtonPrimary>
    </div>

    <div v-if="loading" class="list-loading">
      <v-progress-circular indeterminate color="primary" size="28" />
    </div>
    <GlobalEmptyState v-else-if="zones.length === 0" icon="mdi-map-marker-off-outline">
      Nema zona za prikaz.
    </GlobalEmptyState>

    <div v-else class="zone-list">
      <div
        v-for="zone in zones"
        :key="zone.id"
        class="zone-row"
        :class="{ 'zone-row--selected': zone.id === selectedZoneId }"
        @click="emit('select', zone.id)"
      >
        <div class="zone-icon">
          <v-icon icon="mdi-map-marker-radius-outline" size="20" />
        </div>
        <div class="zone-info">
          <p class="zone-name">{{ toLatin(zone.name) }}</p>
          <p class="zone-meta">
            {{ cityLabel(zone.cityId) }} · Faktor terena {{ zone.terrainFactor }}
          </p>
          <p v-if="zone.centerLat === null" class="zone-meta zone-meta--warning">
            <v-icon icon="mdi-alert-circle-outline" size="14" />
            Nema definisanu geometriju na mapi.
          </p>
        </div>
        <div class="zone-actions">
          <v-btn
            icon
            variant="text"
            size="small"
            aria-label="Izmijeni zonu"
            :disabled="saving"
            @click.stop="emit('edit', zone)"
          >
            <v-icon icon="mdi-pencil-outline" size="20" />
          </v-btn>
          <GlobalButtonDelete
            :iconSize="20"
            ariaLabel="Obriši zonu"
            :disabled="saving"
            @click.stop="requestDelete(zone)"
          />
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalButtonDelete from "~/components/common/GlobalButtonDelete.vue";
import GlobalFilterBar from "~/components/common/GlobalFilterBar.vue";
import GlobalFilterPill from "~/components/common/GlobalFilterPill.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import { useConfirmStore } from "~/stores/confirm";
import type { DispatcherZone } from "~/types/dispatcherZone";

const props = defineProps<{
  zones: DispatcherZone[];
  loading: boolean;
  saving: boolean;
  selectedZoneId: number | null;
  cities: { title: string; value: number }[];
}>();

const emit = defineEmits<{
  select: [zoneId: number];
  "create-new": [];
  edit: [zone: DispatcherZone];
  delete: [zoneId: number];
  filter: [cityId: number | null];
}>();

const cityFilter = ref<number | null>(null);

const cityFilterItems = computed(() => [
  { title: "Svi gradovi", value: null },
  ...props.cities,
]);

const cityFilterLabel = computed(
  () =>
    toLatin(cityFilterItems.value.find((item) => item.value === cityFilter.value)?.title) ||
    "Grad"
);

const selectCityFilter = (value: number | null) => {
  cityFilter.value = value;
  emit("filter", value);
};

const cityLabel = (cityId: number) =>
  toLatin(props.cities.find((city) => city.value === cityId)?.title) || `Grad #${cityId}`;

const confirmStore = useConfirmStore();

const requestDelete = async (zone: DispatcherZone) => {
  try {
    await confirmStore.confirm("Obriši zonu", `Obrisati zonu "${toLatin(zone.name)}"?`, {
      color: "error",
    });
    emit("delete", zone.id);
  } catch {
    // Otkazano
  }
};
</script>

<style scoped>
.list-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  padding: 20px;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.filter-bar {
  flex: 1;
  min-width: 0;
}

.new-zone-btn {
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .list-card {
    padding: 16px;
    border-radius: 20px;
  }

  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .new-zone-btn {
    width: 100%;
  }
}

.list-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
}

.zone-list {
  display: grid;
  gap: 12px;
}

.zone-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1.5px solid transparent;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 6px 16px rgba(11, 18, 32, 0.05);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.zone-row:hover {
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 10px 22px rgba(11, 18, 32, 0.08);
}

.zone-row--selected {
  border-color: #2f6fed;
  background: rgba(47, 111, 237, 0.06);
}

.zone-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(47, 111, 237, 0.1);
  color: #2f6fed;
}

.zone-row--selected .zone-icon {
  background: #2f6fed;
  color: #fff;
}

.zone-info {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

.zone-name {
  margin: 0;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-meta {
  margin: 3px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
  display: flex;
  align-items: center;
  gap: 4px;
}

.zone-meta--warning {
  color: #b98900;
}

.zone-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
