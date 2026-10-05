<template>
  <FormDialog :open="open" title="Detalji kurira" hide-actions @update:open="close">
    <div v-if="courierId != null" class="detail-list">
      <div class="detail-row">
        <span class="detail-label">ID kurira</span>
        <span>#{{ courierId }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Ime</span>
        <span>{{ displayName }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Telefon</span>
        <span>{{ courier?.phone || balance?.phone || "—" }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span>{{ courier ? (courier.suspended ? "Suspendovan" : "Aktivan") : "—" }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Vozilo</span>
        <span>
          {{
            courier
              ? courier.vehicle
                ? ruleVehicleMeta(courier.vehicle.type).label
                : "Nije dodato"
              : "—"
          }}
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Kontakt osoba (tel.)</span>
        <span>{{ courier?.contact_phone || "—" }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Žiro račun</span>
        <span>{{ courier?.bank_account || "—" }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Napomena</span>
        <span>{{ courier?.note || "—" }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Saldo gotovine</span>
        <span :class="{ 'cash-credit': cashOwed < 0 }">{{ money(cashOwed) }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Firma duguje kuriru (zarada)</span>
        <span>{{ money(balance?.wage_owed_to_courier ?? 0) }}</span>
      </div>

      <p v-if="!courier" class="detail-note">
        Kurir nije u aktivnoj listi ove firme (uklonjen ili prebačen) — prikazani su
        samo podaci iz balansa. Akcije „Primio sam gotovinu" / „Isplati zaradu" i dalje
        rade iz reda tabele.
      </p>
    </div>

    <template #actions>
      <v-btn variant="text" @click="close(false)">Zatvori</v-btn>
    </template>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import { formatAmount } from "~/utils/currency";
import { ruleVehicleMeta } from "~/utils/vehicle";
import type { CompanyCourier } from "~/types/company-courier";
import type { CourierBalance } from "~/types/courier-balance";

const props = defineProps<{
  open: boolean;
  courier: CompanyCourier | null;
  balance: CourierBalance | null;
  // Valuta firme (finance-settings) - fallback "KM".
  currency: string;
}>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const money = (value: number) => formatAmount(value, props.currency);

// Balans može postojati i za kurira koga nema u listi "Kuriri" (uklonjen kurir
// s otvorenim dugom) - tada `courier` je null, ali `balance.courier_id` postoji.
const courierId = computed(
  () => props.courier?.courier_id ?? props.balance?.courier_id ?? null
);

// Ime: iz kurira ako je u listi, inače iz couriers-balance reda (od 01.09 nosi
// `name` za orphan kurire), inače "—".
const displayName = computed(
  () => toLatin(props.courier?.name ?? props.balance?.name ?? "") || "—"
);

// cash_owed_to_company može biti negativan = firma duguje kuriru gotovinu.
const cashOwed = computed(() => props.balance?.cash_owed_to_company ?? 0);

const close = (value: boolean) => emit("update:open", value);
</script>

<style scoped>
.detail-list {
  display: flex;
  flex-direction: column;
}

.detail-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
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

.detail-note {
  margin: 10px 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #9aa4b2;
}

/* Negativan saldo gotovine = firma duguje kuriru. */
.cash-credit {
  color: #00b37e;
  font-weight: 600;
}
</style>
