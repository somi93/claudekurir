<template>
  <div class="d-flex align-center ga-3 flex-wrap mt-3">
    <GlobalTextField
      v-model="searchQuery"
      density="compact"
      variant="solo"
      flat
      hide-details
      clearable
      placeholder="Pretraži po imenu ili ID-u..."
      prepend-inner-icon="mdi-magnify"
      class="candidate-search"
    />
    <v-btn-toggle v-model="sortMode" mandatory density="compact" variant="outlined" divided>
      <v-btn value="recommended" size="small">Preporučeno</v-btn>
      <v-btn value="distance" size="small">Po udaljenosti</v-btn>
    </v-btn-toggle>

    <!-- Status/Vozilo su sakriveni iza ovog dugmeta umjesto stalno vidljivih
         chip-grupa (koje su znale da guraju listu kandidata dole kad ima puno
         opcija) - panel se otvara PREKO liste, ne pomera je. -->
    <GlobalFilterBar>
      <v-menu :close-on-content-click="false" location="bottom start">
        <template #activator="{ props: menuProps }">
          <GlobalFilterPill
            v-bind="menuProps"
            prepend-icon="mdi-filter-variant"
            :label="filterPillLabel"
            :active="activeFilterCount > 0"
          />
        </template>

        <v-card class="filters-menu">
          <v-card-text class="d-flex flex-column ga-4">
            <div>
              <p class="filter-group-label">Status</p>
              <v-chip-group v-model="statusFilters" multiple column>
                <v-chip
                  v-for="opt in statusFilterOptions"
                  :key="opt.value"
                  :value="opt.value"
                  size="small"
                  filter
                  variant="outlined"
                >
                  {{ opt.label }}
                </v-chip>
              </v-chip-group>
            </div>

            <div v-if="vehicleFilterOptions.length > 1">
              <p class="filter-group-label">Vozilo</p>
              <v-chip-group v-model="vehicleFilters" multiple column>
                <v-chip
                  v-for="opt in vehicleFilterOptions"
                  :key="opt.value"
                  :value="opt.value"
                  size="small"
                  filter
                  variant="outlined"
                  :prepend-icon="opt.icon"
                >
                  {{ opt.label }}
                </v-chip>
              </v-chip-group>
            </div>

            <v-btn
              v-if="activeFilterCount > 0"
              variant="text"
              size="small"
              class="align-self-start"
              @click="clearFilters"
            >
              Obriši filtere
            </v-btn>
          </v-card-text>
        </v-card>
      </v-menu>
    </GlobalFilterBar>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GlobalTextField from "~/components/common/GlobalTextField.vue";
import GlobalFilterBar from "~/components/common/GlobalFilterBar.vue";
import GlobalFilterPill from "~/components/common/GlobalFilterPill.vue";
import { STATUS_FILTER_OPTIONS, type CandidateStatusFilterKey } from "~/composables/useCandidateFilters";

defineProps<{
  vehicleFilterOptions: { value: string; label: string; icon: string }[];
}>();

const searchQuery = defineModel<string>("searchQuery", { required: true });
const sortMode = defineModel<"recommended" | "distance">("sortMode", { required: true });
const statusFilters = defineModel<CandidateStatusFilterKey[]>("statusFilters", { required: true });
const vehicleFilters = defineModel<string[]>("vehicleFilters", { required: true });

const statusFilterOptions = STATUS_FILTER_OPTIONS;

const activeFilterCount = computed(() => statusFilters.value.length + vehicleFilters.value.length);
const filterPillLabel = computed(() =>
  activeFilterCount.value > 0 ? `Filteri (${activeFilterCount.value})` : "Filteri"
);

const clearFilters = () => {
  statusFilters.value = [];
  vehicleFilters.value = [];
};
</script>

<style scoped>
.candidate-search {
  max-width: 240px;
  min-width: 180px;
  flex: 1 1 180px;
}

.candidate-search :deep(.v-field) {
  border-radius: 12px;
  background: #f2f3f7;
  box-shadow: none;
}

.filters-menu {
  min-width: 280px;
  max-width: 340px;
  box-shadow: 0 8px 24px rgba(11, 18, 32, 0.16);
}

.filter-group-label {
  font-size: 0.82rem;
  color: #6b7685;
  margin-bottom: 4px;
}
</style>
