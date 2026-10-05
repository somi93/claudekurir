<template>
  <FormDialog
    :open="open"
    title="Kontakt podaci restorana"
    hide-actions
    @update:open="close"
  >
    <div v-if="restaurant" class="detail-list">
      <div class="detail-row">
        <span class="detail-label">ID</span>
        <span class="detail-value">#{{ restaurant.restaurant_id }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Naziv</span>
        <span class="detail-value">{{ toLatin(restaurant.restaurant_name) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">JIB</span>
        <span
          class="detail-value"
          :class="{ 'detail-value--empty': !restaurant.restaurant_jib }"
        >
          {{ restaurant.restaurant_jib || "-" }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">PIB</span>
        <span
          class="detail-value"
          :class="{ 'detail-value--empty': !restaurant.restaurant_pib }"
        >
          {{ restaurant.restaurant_pib || "-" }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Adresa</span>
        <span class="detail-value">
          {{ toLatin(restaurant.restaurant_address) || "-" }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Lokacija</span>
        <a
          v-if="mapLink"
          class="detail-value detail-link"
          :href="mapLink"
          target="_blank"
          rel="noopener"
        >
          <v-icon icon="mdi-map-marker-outline" size="15" />
          Otvori na mapi
        </a>
        <span v-else class="detail-value detail-value--empty">-</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Kontakt osoba</span>
        <span class="detail-value">
          {{ toLatin(restaurant.restaurant_contact_person) || "-" }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Telefon</span>
        <a
          v-if="restaurant.restaurant_phone"
          class="detail-value detail-link"
          :href="`tel:${restaurant.restaurant_phone}`"
        >
          <v-icon icon="mdi-phone-outline" size="15" />
          {{ restaurant.restaurant_phone }}
        </a>
        <span v-else class="detail-value detail-value--empty">-</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <a
          v-if="restaurant.restaurant_email"
          class="detail-value detail-link"
          :href="`mailto:${restaurant.restaurant_email}`"
        >
          <v-icon icon="mdi-email-outline" size="15" />
          {{ restaurant.restaurant_email }}
        </a>
        <span v-else class="detail-value detail-value--empty">-</span>
      </div>
      <div v-if="restaurant.restaurant_currency" class="detail-row">
        <span class="detail-label">Valuta restorana</span>
        <span class="detail-value" :class="{ 'detail-value--warn': mismatch }">
          {{ resolveCurrency(restaurant.restaurant_currency) }}
          <template v-if="mismatch">
            (firma: {{ resolveCurrency(companyCurrency) }})
          </template>
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Datum početka saradnje</span>
        <span
          class="detail-value"
          :class="{ 'detail-value--empty': !restaurant.cooperation_started_at }"
        >
          {{ formatStartDate(restaurant.cooperation_started_at) }}
        </span>
      </div>
    </div>
    <template #actions>
      <v-btn variant="text" @click="close(false)">Zatvori</v-btn>
    </template>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import { resolveCurrency } from "~/utils/currency";
import { currencyMismatch } from "~/utils/restaurantCooperation";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

const props = defineProps<{
  open: boolean;
  restaurant: RestaurantCooperation | null;
  // Valuta firme za dostavu (finance-settings, odgovor 1.1) - fallback "KM".
  companyCurrency: string;
}>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const mismatch = computed(() =>
  props.restaurant ? currencyMismatch(props.restaurant, props.companyCurrency) : null
);

// Datum početka saradnje - "3. 9. 2026." ili "-" ako backend ne vrati polje.
const formatStartDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("sr-RS");
};

const mapLink = computed(() => {
  const lat = props.restaurant?.restaurant_latitude;
  const lng = props.restaurant?.restaurant_longitude;
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
});

const close = (value: boolean) => emit("update:open", value);
</script>

<style scoped>
.detail-list {
  display: flex;
  flex-direction: column;
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e7e9ee;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.78rem;
  color: #9aa4b2;
  flex-shrink: 0;
}

.detail-value {
  min-width: 0;
  text-align: right;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.detail-value--empty {
  color: #9aa4b2;
}

.detail-value--warn {
  color: #b26a00;
  font-weight: 600;
}

/* Telefon / Email / Lokacija — akcijski linkovi u boji teme, bez browser
   default podvlačenja; poravnati desno kao ostale vrijednosti. */
.detail-link {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  color: #2f6fed;
  font-weight: 600;
  text-decoration: none;
  border-radius: 6px;
}

.detail-link :deep(.v-icon) {
  flex-shrink: 0;
}

.detail-link:hover {
  text-decoration: underline;
}

.detail-link:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}
</style>
