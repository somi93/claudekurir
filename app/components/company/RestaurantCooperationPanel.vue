<template>
  <GlobalCard padding="20px">
    <template #title>Saradnja sa restoranima</template>
    <template #subtitle>
      Uključi ili isključi saradnju sa restoranom za izabranu firmu.
    </template>

    <div v-if="restaurants.length > 0" class="list-toolbar mt-2">
      <GlobalTextField
        v-model="searchQuery"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        placeholder="Pretraži po nazivu restorana..."
        prepend-inner-icon="mdi-magnify"
        class="restaurant-search"
      />
      <GlobalSelect
        v-model="statusFilter"
        :items="statusFilterOptions"
        item-title="label"
        item-value="value"
        density="compact"
        variant="solo"
        flat
        hide-details
        class="status-select"
      />
    </div>

    <div v-if="filteredRestaurants.length > 0" class="restaurant-list mt-2">
      <div
        v-for="restaurant in filteredRestaurants"
        :key="restaurant.id"
        class="restaurant-row"
        :class="statusFor(restaurant).rowClass"
      >
        <button
          type="button"
          class="restaurant-info"
          aria-label="Prikaži kontakt podatke restorana"
          @click="openDetail(restaurant)"
        >
          <span class="restaurant-name">
            {{ toLatin(restaurant.restaurant_name) }}
            <v-chip
              v-if="restaurant.internal"
              size="x-small"
              variant="tonal"
              class="ml-2"
            >
              Sopstvena dostava
            </v-chip>
            <v-chip
              v-if="currencyMismatch(restaurant, companyCurrency)"
              size="x-small"
              variant="tonal"
              color="warning"
              class="ml-2"
              prepend-icon="mdi-alert-outline"
            >
              Valuta: {{ currencyMismatch(restaurant, companyCurrency) }} ≠
              {{ resolveCurrency(companyCurrency) }}
            </v-chip>
          </span>
          <span class="restaurant-status" :class="statusFor(restaurant).cssClass">
            {{ statusFor(restaurant).text }}
          </span>
        </button>
        <div class="restaurant-actions">
          <v-btn
            icon="mdi-information-outline"
            variant="text"
            size="small"
            aria-label="Kontakt podaci restorana"
            @click="openDetail(restaurant)"
          />
          <v-switch
            :model-value="restaurant.active_restoran"
            :disabled="restaurant.internal"
            color="accent"
            hide-details
            density="compact"
            @update:model-value="onToggle(restaurant, $event)"
          />
        </div>
      </div>
    </div>
    <GlobalEmptyState v-else-if="loading" icon="mdi-timer-sand">
      Učitavanje...
    </GlobalEmptyState>
    <GlobalEmptyState v-else-if="restaurants.length === 0" icon="mdi-storefront-outline">
      Nema restorana povezanih sa ovom firmom.
    </GlobalEmptyState>
    <GlobalEmptyState v-else icon="mdi-magnify-close">
      Nema restorana za zadatu pretragu/filter.
    </GlobalEmptyState>
  </GlobalCard>

  <SuspendCooperationDialog
    v-model:open="showSuspendDialog"
    :restaurant="pendingSuspend"
    @confirm="submitSuspend"
  />

  <RestaurantDetailDialog
    v-model:open="showDetail"
    :restaurant="detailRestaurant"
    :company-currency="companyCurrency"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import SuspendCooperationDialog from "~/components/company/restaurants/SuspendCooperationDialog.vue";
import RestaurantDetailDialog from "~/components/company/restaurants/RestaurantDetailDialog.vue";
import { useConfirmStore } from "~/stores/confirm";
import { resolveCurrency } from "~/utils/currency";
import { currencyMismatch } from "~/utils/restaurantCooperation";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

const props = defineProps<{
  restaurants: RestaurantCooperation[];
  loading: boolean;
  // Valuta firme za dostavu (finance-settings, odgovor 1.1) - fallback "KM".
  companyCurrency: string;
}>();

const emit = defineEmits<{
  toggle: [
    payload: { restaurant: RestaurantCooperation; active: boolean; reason?: string }
  ];
}>();

const confirmStore = useConfirmStore();

// Isti obrazac kao CompanyCouriersPanel - pretraga (naziv) + status filter,
// cisto na frontu jer vec povlacimo celu listu. Semantika filtera prati backend
// ?filter= (25.8.2026): active <-> active_restoran = true, suspended <->
// active_restoran = false.
const searchQuery = ref("");
const statusFilter = ref<"all" | "active" | "suspended">("all");
const statusFilterOptions = [
  { label: "Svi", value: "all" as const },
  { label: "Aktivni", value: "active" as const },
  { label: "Suspendovani", value: "suspended" as const },
];

const filteredRestaurants = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return props.restaurants.filter((restaurant) => {
    if (statusFilter.value === "active" && !restaurant.active_restoran) return false;
    if (statusFilter.value === "suspended" && restaurant.active_restoran) return false;
    if (!query) return true;
    return toLatin(restaurant.restaurant_name).toLowerCase().includes(query);
  });
});

// Prikaz statusa + boja reda, po backend uputstvu (27.8.2026):
// - cooperation_active = true -> zelen red ("Aktivna saradnja")
// - active_company = false    -> "Restoran vas je isključio"
// - active_restoran = false   -> "Vi ste suspendovali" (+ suspension_reason)
// active_restoran je nas prekidač (ovaj ekran), active_company menja restoran
// nezavisno od ovog API-ja - vidi types/restaurant-cooperation.ts. Redosled
// namerno stavlja active_restoran = false ispred active_company = false: kad su
// oba false, prekidač je OFF pa poruka o NAŠOJ suspenziji ne sme da protivreči.
const statusFor = (restaurant: RestaurantCooperation) => {
  if (restaurant.internal) {
    return {
      text: "Restoran koristi sopstvenu dostavu",
      cssClass: "status-off",
      rowClass: "",
    };
  }
  if (!restaurant.active_restoran) {
    const reason = restaurant.suspension_reason
      ? ` - ${restaurant.suspension_reason}`
      : "";
    return { text: `Vi ste suspendovali${reason}`, cssClass: "status-off", rowClass: "" };
  }
  if (!restaurant.active_company) {
    return {
      text: "Restoran vas je isključio",
      cssClass: "status-warning",
      rowClass: "",
    };
  }
  return { text: "Aktivna saradnja", cssClass: "status-active", rowClass: "row-active" };
};

// Prekidac je :model-value (jednosmerno), pa se sam vrati na stanje iz propsa
// ako se dijalog/potvrda otkaze - stvarni flip radi useRestaurantCooperation.
// Suspenzija trazi opcioni razlog (mini-dijalog), aktivacija ide preko confirm-a
// - isti obrazac kao CompanyCouriersPanel.onToggleSuspend.
const showSuspendDialog = ref(false);
const pendingSuspend = ref<RestaurantCooperation | null>(null);

const onToggle = async (restaurant: RestaurantCooperation, next: boolean | null) => {
  if (restaurant.internal) return;
  if (next) {
    const mismatch = currencyMismatch(restaurant, props.companyCurrency);
    const mismatchNote = mismatch
      ? ` Napomena: restoran koristi valutu ${mismatch}, a firma ${resolveCurrency(
          props.companyCurrency
        )} — cijene se neće automatski preračunavati.`
      : "";
    try {
      await confirmStore.confirm(
        "Aktiviraj saradnju",
        `Ponovo uključiti saradnju sa restoranom ${toLatin(
          restaurant.restaurant_name
        )}?${mismatchNote}`
      );
      emit("toggle", { restaurant, active: true });
    } catch {
      // Otkazano
    }
    return;
  }
  pendingSuspend.value = restaurant;
  showSuspendDialog.value = true;
};

const submitSuspend = (reason: string | undefined) => {
  if (!pendingSuspend.value) return;
  emit("toggle", { restaurant: pendingSuspend.value, active: false, reason });
  showSuspendDialog.value = false;
  pendingSuspend.value = null;
};

// Kontakt podaci restorana - modal na klik (backend 28.08 "Допуна"). Polja mogu
// biti prazna za stare zapise, prikaz to podnosi ("-").
const showDetail = ref(false);
const detailRestaurant = ref<RestaurantCooperation | null>(null);

const openDetail = (restaurant: RestaurantCooperation) => {
  detailRestaurant.value = restaurant;
  showDetail.value = true;
};
</script>

<style scoped>
.list-toolbar {
  display: flex;
  gap: 8px;
}

.restaurant-search {
  flex: 1 1 auto;
}

.status-select {
  flex: 0 0 160px;
}

.restaurant-search :deep(.v-field),
.status-select :deep(.v-field) {
  border-radius: 12px;
  background: #f2f3f7;
  box-shadow: none;
}

.restaurant-list {
  display: flex;
  flex-direction: column;
}

.restaurant-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 4px 12px 14px;
  border-bottom: 1px solid #e7e9ee;
}

.restaurant-row.row-active {
  background: rgba(0, 179, 126, 0.06);
  box-shadow: inset 3px 0 0 #00b37e;
}

.restaurant-row:last-child {
  border-bottom: none;
}

.restaurant-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 8px;
  margin: -4px -8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.restaurant-info:hover {
  background: #f2f3f7;
}

.restaurant-info:focus-visible {
  outline: 2px solid #00b37e;
  outline-offset: 1px;
}

.restaurant-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.restaurant-name {
  font-weight: 600;
}

.restaurant-status {
  font-size: 0.8rem;
  font-weight: 600;
}

.status-active {
  color: #00b37e;
}

.status-off {
  color: #9aa4b2;
}

.status-warning {
  color: #e0a100;
}
</style>
