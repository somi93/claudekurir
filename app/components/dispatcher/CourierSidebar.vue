<template>
  <v-card class="sidebar-card" flat>
    <div class="sidebar-head">
      <v-card-title class="pa-0">Kuriri</v-card-title>
      <span class="sidebar-count">{{ entries.length }}</span>
    </div>

    <div v-if="loading && entries.length === 0" class="sidebar-skeleton">
      <v-skeleton-loader v-for="n in 5" :key="n" type="list-item-two-line" />
    </div>

    <GlobalEmptyState
      v-else-if="!loading && entries.length === 0"
      icon="mdi-account-off-outline"
    >
      Nema kurira u ovoj kategoriji.
    </GlobalEmptyState>

    <template v-else-if="entries.length > 0">
      <GlobalTextField
        v-model="searchQuery"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        placeholder="Pretraži po imenu, telefonu ili ID-u..."
        prepend-inner-icon="mdi-magnify"
        class="courier-search"
      />

      <GlobalEmptyState v-if="matchedEntries.length === 0" icon="mdi-magnify-close">
        Nema kurira za "{{ searchQuery }}".
      </GlobalEmptyState>

      <template v-else>
        <v-list class="courier-list" lines="three">
          <CourierListItem
            v-for="entry in visibleEntries"
            :key="entry.courier.courier_id"
            :entry="entry"
            :selected="selectedCourierId === entry.courier.courier_id"
            :now="now"
            @select="emit('select', $event)"
          />
        </v-list>
        <p v-if="matchedEntries.length > visibleEntries.length" class="list-more">
          Prikazano prvih {{ visibleEntries.length }} od {{ matchedEntries.length }} -
          suzi pretragu.
        </p>
      </template>
    </template>

    <SelectedCourierCard
      v-if="selectedCourier"
      :entry="selectedCourier"
      :now="now"
      @center="emit('center')"
    />
    <p v-else-if="entries.length > 0" class="hint-copy">
      Izaberi kurira sa liste ili mape za detalje.
    </p>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { EnrichedCourierLocation } from "~/utils/courierStatus";
import CourierListItem from "./CourierListItem.vue";
import SelectedCourierCard from "./SelectedCourierCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";

const props = defineProps<{
  loading: boolean;
  entries: EnrichedCourierLocation[];
  selectedCourierId: number | null;
  selectedCourier: EnrichedCourierLocation | null;
  now: number;
}>();

const emit = defineEmits<{
  select: [driverId: number];
  center: [];
}>();

const searchQuery = ref("");

// Firme tipa Glovo znaju imati 500+ kurira - render cijele v-liste bi bio
// pretežak, pa prikazujemo prvih MAX_VISIBLE i tražimo od dispečera da suzi
// pretragu za ostatak.
const MAX_VISIBLE = 100;

// Server-side `search` na courier-locations hvata samo ime/telefon (ne ID -
// provjereno 09.09), a lista se ionako povlači cijela za firmu, pa pretragu
// radimo klijentski: ime + telefon + #ID.
const matchedEntries = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.entries;
  return props.entries.filter((entry) => {
    const c = entry.courier;
    return (
      String(c.courier_id).includes(query) ||
      toLatin(c.name ?? "").toLowerCase().includes(query) ||
      (c.phone ?? "").toLowerCase().includes(query)
    );
  });
});

const visibleEntries = computed(() => matchedEntries.value.slice(0, MAX_VISIBLE));
</script>

<style scoped>
.sidebar-card {
  padding: 20px;
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  display: flex;
  flex-direction: column;
}

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sidebar-skeleton {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.sidebar-count {
  font-size: 0.78rem;
  font-weight: 800;
  color: #6b7685;
  background: rgba(11, 18, 32, 0.08);
  padding: 3px 10px;
  border-radius: 999px;
}

.courier-search {
  margin-top: 12px;
}

.courier-search :deep(.v-field) {
  border-radius: 12px;
  background: #f2f3f7;
  box-shadow: none;
}

.courier-list {
  display: grid;
  gap: 6px;
  max-height: 48vh;
  overflow-y: auto;
  background: transparent;
  margin-top: 8px;
}

.list-more {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
  text-align: center;
}

.hint-copy {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e7e9ee;
  color: #9aa4b2;
  font-size: 0.85rem;
  text-align: center;
}
</style>
