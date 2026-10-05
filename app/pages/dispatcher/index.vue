<template>
  <div>
    <NuxtRouteAnnouncer />

    <GlobalPage :max-width="1480">
      <template #header>
        <PageHeader title="Kuriri uživo" back-to="/" back-label="Nazad na početnu">
          <template #actions>
            <v-btn
              variant="tonal"
              prepend-icon="mdi-account-group-outline"
              to="/dispatcher/couriers"
            >
              Lista kurira
            </v-btn>
            <GlobalButtonPrimary
              prepend-icon="mdi-refresh"
              :loading="loading"
              @click="fetchLocations"
            >
              Osveži
            </GlobalButtonPrimary>
          </template>
        </PageHeader>
      </template>

      <div class="dispatcher-content">
        <CourierStatusFilter v-model="statusFilter" :pills="statPills" />

        <div class="dispatcher-grid">
          <CourierMap
            :loading="loading"
            :error-message="errorMessage"
            :last-updated="lastUpdated"
            :locations="filteredLocations"
            :selected-courier-id="selectedCourierId"
            :map-center="mapCenter"
            :focus-token="mapFocusToken"
            :now="now"
            @select="selectedCourierId = $event"
          />

          <CourierSidebar
            :loading="loading"
            :entries="filteredLocations"
            :selected-courier-id="selectedCourierId"
            :selected-courier="selectedCourier"
            :now="now"
            @select="selectedCourierId = $event"
            @center="mapFocusToken++"
          />
        </div>
      </div>
    </GlobalPage>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: "Kuriri uživo" });

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "nuxt/app";
import { storeToRefs } from "pinia";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import CourierStatusFilter from "~/components/dispatcher/CourierStatusFilter.vue";
import CourierMap from "~/components/dispatcher/CourierMap.vue";
import CourierSidebar from "~/components/dispatcher/CourierSidebar.vue";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { fetchDispatcherCourierLocations } from "~/services/courierLocationService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import {
  courierState,
  STATE_PRIORITY,
  type CourierState,
  type EnrichedCourierLocation,
} from "~/utils/courierStatus";
import type { DispatcherCourierLocation } from "~/types/courier";

// "Kuriri uživo" povlači jedan poziv - GET .../courier-locations (odgovor 1.3):
// server-side lista kurira izabrane firme s ugniježđenim `location` blokom
// (pozicija + status + updated_at). Ranije su išla dva poziva (/courier/locations
// + couriers-status direktorij) pa spajanje po ID-u; sad sve dolazi u redu.
const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();
const companyId = computed(() => selectedCompanyId.value);

const locations = ref<DispatcherCourierLocation[]>([]);
const loading = ref(true);
const errorMessage = ref("");
const lastUpdated = ref<string | null>(null);
const selectedCourierId = ref<number | null>(null);
const statusFilter = ref<"all" | CourierState>("all");
const now = ref(Date.now());
// Uvećava se svaki put kad dispečer klikne "Centriraj na mapi" - CourierMap
// gleda promenu ove vrednosti (ne samo selectedCourierId) da bi ponovo
// odletela na već selektovanog kurira i kad se izbor nije promenio.
const mapFocusToken = ref(0);

const defaultCenter: [number, number] = [44.8125, 20.4612];

const enrichedLocations = computed<EnrichedCourierLocation[]>(() =>
  locations.value.map((courier) => ({
    courier,
    state: courierState(courier, now.value),
  }))
);

// Aktivni kuriri (u dostavi/slobodni) idu pre offline, a unutar svake grupe
// najsvežija lokacija prva - tako davno offline kuriri prirodno padaju na
// dno liste umesto da se mešaju sa onima koji su tek izgubili signal.
const filteredLocations = computed(() => {
  const base =
    statusFilter.value === "all"
      ? enrichedLocations.value
      : enrichedLocations.value.filter((entry) => entry.state === statusFilter.value);

  return [...base].sort((a, b) => {
    const stateDiff = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state];
    if (stateDiff !== 0) return stateDiff;
    const aT = a.courier.location ? new Date(a.courier.location.updated_at).getTime() : 0;
    const bT = b.courier.location ? new Date(b.courier.location.updated_at).getTime() : 0;
    return bT - aT;
  });
});

const counts = computed(() => {
  const base = {
    all: enrichedLocations.value.length,
    delivering: 0,
    online: 0,
    offline: 0,
  };
  for (const entry of enrichedLocations.value) {
    base[entry.state] += 1;
  }
  return base;
});

const statPills = computed(() => [
  { key: "all" as const, label: "Ukupno", value: counts.value.all, color: "#0b1220" },
  {
    key: "delivering" as const,
    label: "U dostavi",
    value: counts.value.delivering,
    color: "#2f6fed",
  },
  { key: "online" as const, label: "Slobodni", value: counts.value.online, color: "#00b37e" },
  { key: "offline" as const, label: "Offline", value: counts.value.offline, color: "#9aa4b2" },
]);

const mapCenter = computed<[number, number]>(() => {
  const positioned = locations.value.filter((c) => c.location !== null);
  if (positioned.length === 0) {
    return defaultCenter;
  }

  const totals = positioned.reduce(
    (accumulator, courier) => {
      accumulator.lat += courier.location!.latitude;
      accumulator.lng += courier.location!.longitude;
      return accumulator;
    },
    { lat: 0, lng: 0 }
  );

  return [totals.lat / positioned.length, totals.lng / positioned.length];
});

// Bez fallback-a na prvog kurira - dok dispečer ne klikne nekog konkretnog
// (na listi ili na mapi), ništa nije "selektovano". Ranije se prvi kurir
// automatski isticao na load-u, što je delovalo kao namerna odluka aplikacije
// umesto stvarnog izbora dispečera.
const selectedCourier = computed(
  () =>
    enrichedLocations.value.find(
      (entry) => entry.courier.courier_id === selectedCourierId.value
    ) ?? null
);

const fetchLocations = async () => {
  if (!companyId.value) {
    // Firma se još razrješava (my-companies) - ne ostavljaj sidebar na skeletonu.
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await fetchDispatcherCourierLocations(companyId.value);
    locations.value = response.data ?? [];
    lastUpdated.value = new Date().toLocaleTimeString("sr-RS");
  } catch (error) {
    errorMessage.value = toFriendlyErrorMessage(
      error,
      "Ne mogu da učitam lokacije dostavljača."
    );
  } finally {
    loading.value = false;
  }
};

// Veza ?c=ID (dugme "Na mapi" na listi kurira): kurir se bira i mapa odleti do njega. Primjenjuje se
// jednom, poslije prvog učitavanja; kurir bez poznate pozicije nije na mapi pa se veza preskače.
const route = useRoute();
const focusFromLink = () => {
  const id = Number(Array.isArray(route.query.c) ? route.query.c[0] : route.query.c);
  if (!Number.isInteger(id) || id <= 0) return;
  if (!locations.value.some((entry) => entry.courier_id === id && entry.location)) return;
  selectedCourierId.value = id;
  mapFocusToken.value += 1;
};

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

// Ruta je firm-scoped (za razliku od starog /courier/locations) - kad dispečer
// promijeni firmu, povuci lokacije te firme i očisti izbor. Prvo razrješavanje
// (null -> id) pokriva onMounted, pa ga preskačemo da nema duplog poziva.
watch(companyId, (id, oldId) => {
  if (oldId == null || id === oldId) return;
  selectedCourierId.value = null;
  locations.value = [];
  fetchLocations();
});

onMounted(async () => {
  // Sačekaj da se firma razriješi (my-companies) prije prvog poziva - na
  // hard-refresh selectedCompanyId polazi od null, pa bi fetchLocations inače
  // pukao na guard i ostavio sidebar prazan dok se watch ne okine.
  await companiesStore.ensureLoaded();
  await fetchLocations();
  focusFromLink();
  refreshTimer = setInterval(fetchLocations, 15000);
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 5000);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<style scoped>
.dispatcher-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dispatcher-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 20px;
  align-items: start;
}

@media (max-width: 1100px) {
  .dispatcher-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .dispatcher-content {
    gap: 16px;
  }
}
</style>

<style>
.leaflet-control-attribution {
  display: none !important;
}
</style>
