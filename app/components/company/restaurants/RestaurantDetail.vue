<template>
  <article class="dt" aria-label="Detalji restorana" data-company="restaurant-detail">
    <header class="dt-head">
      <span class="dt-av" :style="{ '--tint': meta.tint, '--ink': meta.ink }" aria-hidden="true">
        <v-icon icon="mdi-storefront-outline" size="28" />
        <span class="dot" :style="{ background: meta.dot }" />
      </span>
      <div class="dt-t">
        <h2 id="restaurant-detail-title" ref="title" tabindex="-1">{{ name }}</h2>
        <div class="dt-meta">
          <button
            type="button"
            class="dt-id"
            :class="{ done: copied === 'id' }"
            data-detail="copy-id"
            :aria-label="`Kopiraj broj restorana ${restaurant.restaurant_id}`"
            @click="copy('id', String(restaurant.restaurant_id))"
          >
            <template v-if="copied === 'id'"><v-icon icon="mdi-check" size="16" />Kopirano</template>
            <template v-else>Restoran #{{ restaurant.restaurant_id }}<v-icon icon="mdi-content-copy" size="16" /></template>
          </button>
          <span class="dt-st" :style="{ '--tint': meta.tint, '--ink': meta.ink, '--dot': meta.dot }">
            <i />{{ meta.label }}
          </span>
        </div>
      </div>
      <button v-if="closable" type="button" class="dt-x" data-detail="close" aria-label="Zatvori detalje" @click="emit('close')">
        <v-icon icon="mdi-close" size="20" />
      </button>
    </header>

    <div class="dt-qa" :style="{ '--n': action ? 4 : 3 }">
      <a v-if="phone" class="qb" data-detail="call" :href="`tel:${phone}`" :aria-label="`Pozovi ${name}`">
        <v-icon icon="mdi-phone-outline" size="22" />Pozovi
      </a>
      <button v-else type="button" class="qb" disabled title="Telefon nije upisan">
        <v-icon icon="mdi-phone-outline" size="22" />Pozovi
      </button>
      <a v-if="email" class="qb" data-detail="mail" :href="`mailto:${email}`" :aria-label="`Pošalji e-poštu ${name}`">
        <v-icon icon="mdi-email-outline" size="22" />E-pošta
      </a>
      <button v-else type="button" class="qb" disabled title="E-pošta nije upisana">
        <v-icon icon="mdi-email-outline" size="22" />E-pošta
      </button>
      <a
        v-if="mapLink"
        class="qb"
        data-detail="map"
        :href="mapLink"
        target="_blank"
        rel="noopener"
        :aria-label="`Prikaži ${name} na mapi (otvara novi prozor)`"
      >
        <v-icon icon="mdi-map-marker-outline" size="22" />Mapa
      </a>
      <button v-else type="button" class="qb" disabled title="Adresa nije upisana">
        <v-icon icon="mdi-map-marker-outline" size="22" />Mapa
      </button>
      <button
        v-if="action"
        type="button"
        class="qb"
        :data-detail="action === 'activate' ? 'activate' : 'suspend'"
        :aria-label="`${action === 'activate' ? 'Uključi saradnju sa' : 'Suspenduj saradnju sa'} ${name}`"
        @click="action === 'activate' ? emit('activate') : emit('suspend')"
      >
        <v-icon :icon="action === 'activate' ? 'mdi-check-circle-outline' : 'mdi-cancel'" size="22" />
        {{ action === "activate" ? "Uključi" : "Suspenduj" }}
      </button>
    </div>

    <div v-if="state !== 'active'" class="dt-alert">
      <TintAlert
        v-if="state === 'ours'"
        tone="bad"
        icon="mdi-cancel"
        title="Suspendovali ste saradnju"
        data-detail="alert"
      >
        {{ reason }} Narudžbe ovog restorana ne stižu kuririma.
        <template #action>
          <button type="button" data-detail="alert-activate" @click="emit('activate')">Uključi saradnju</button>
        </template>
      </TintAlert>
      <TintAlert
        v-else-if="state === 'theirs'"
        tone="warn"
        icon="mdi-close-circle-outline"
        title="Restoran je isključio saradnju"
        data-detail="alert"
      >
        Njihova odluka, ne vaša. Narudžbe ne stižu dok ga restoran ponovo ne uključi. Možete ga i vi suspendovati.
      </TintAlert>
      <TintAlert v-else tone="info" title="Restoran koristi sopstvenu dostavu" data-detail="alert">
        Nema saradnje koja se može uključiti ili isključiti.
      </TintAlert>
    </div>

    <h3 class="gt">Saradnja</h3>
    <div class="grp">
      <DetailRow icon="mdi-handshake-outline" label="Stanje" :value="meta.label" />
      <DetailRow
        icon="mdi-calendar-outline"
        label="Saradnja od"
        :value="since || 'Nije upisano'"
        :empty="!since"
      />
      <DetailRow
        v-if="state === 'ours'"
        icon="mdi-cancel"
        label="Razlog suspenzije"
        :value="restaurant.suspension_reason ? toLatin(restaurant.suspension_reason) : 'Nije upisan'"
        :empty="!restaurant.suspension_reason"
      />
      <DetailRow
        icon="mdi-currency-usd"
        label="Valuta restorana"
        :value="currencyText"
        :empty="!restaurant.restaurant_currency?.trim()"
        :tone="mismatch ? 'warn' : null"
      />
    </div>
    <div v-if="mismatch" class="dt-alert">
      <TintAlert tone="warn" title="Valuta se razlikuje" data-detail="currency-alert">
        Restoran koristi {{ mismatch }}, firma {{ resolveCurrency(companyCurrency) }}. Cijene se ne preračunavaju.
      </TintAlert>
    </div>

    <h3 class="gt">Kontakt</h3>
    <div class="grp">
      <DetailRow
        icon="mdi-account-outline"
        label="Kontakt osoba"
        :value="person || 'Nije upisano'"
        :empty="!person"
      />
      <DetailRow icon="mdi-phone-outline" label="Telefon" :value="phone || 'Nije upisano'" :empty="!phone">
        <template v-if="phone" #end>
          <button
            type="button"
            class="ib"
            data-detail="copy-phone"
            :aria-label="`Kopiraj telefon ${phone}`"
            @click="copy('phone', phone)"
          >
            <v-icon :icon="copied === 'phone' ? 'mdi-check' : 'mdi-content-copy'" size="20" />
          </button>
        </template>
      </DetailRow>
      <DetailRow icon="mdi-email-outline" label="E-pošta" :value="email || 'Nije upisano'" :empty="!email">
        <template v-if="email" #end>
          <button
            type="button"
            class="ib"
            data-detail="copy-email"
            :aria-label="`Kopiraj e-poštu ${email}`"
            @click="copy('email', email)"
          >
            <v-icon :icon="copied === 'email' ? 'mdi-check' : 'mdi-content-copy'" size="20" />
          </button>
        </template>
      </DetailRow>
      <DetailRow
        icon="mdi-map-marker-outline"
        label="Adresa"
        :value="address || 'Nije upisano'"
        :empty="!address"
      />
    </div>

    <h3 class="gt">Podaci</h3>
    <div class="grp">
      <DetailRow
        icon="mdi-card-account-details-outline"
        label="JIB"
        :value="restaurant.restaurant_jib || 'Nije upisano'"
        :empty="!restaurant.restaurant_jib"
      />
      <DetailRow
        icon="mdi-card-account-details-outline"
        label="PIB"
        :value="restaurant.restaurant_pib || 'Nije upisano'"
        :empty="!restaurant.restaurant_pib"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import DetailRow from "~/components/dispatcher/roster/DetailRow.vue";
import { useAlertStore } from "~/stores/alert";
import { copyText } from "~/utils/clipboard";
import { resolveCurrency } from "~/utils/currency";
import {
  COOP_META,
  coopState,
  currencyMismatch,
  startDateText,
} from "~/utils/restaurantCooperation";
import { toLatin } from "~/utils/toLatin";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// Detalj izabranog restorana: zaglavlje sa stanjem, brze radnje (poziv, e-pošta, mapa, suspenzija ili
// uključivanje) i tri grupe (saradnja, kontakt, podaci). Prazno polje je "Nije upisano" (sivo), ne "-".
// Radnja je dugme u detalju, ne prekidač u redu: suspenzija traži razlog i kaže šta se dešava sa
// narudžbama. Isti sadržaj je uz listu na računaru i zasebna stranica na telefonu.
const props = defineProps<{
  restaurant: RestaurantCooperation;
  companyCurrency: string;
  // Računar: X zatvara detalj. Telefon: strelica nazad u zaglavlju stranice.
  closable: boolean;
}>();

const emit = defineEmits<{ close: []; suspend: []; activate: [] }>();

const alerts = useAlertStore();
const title = ref<HTMLElement | null>(null);

const state = computed(() => coopState(props.restaurant));
const meta = computed(() => COOP_META[state.value]);
const name = computed(
  () => toLatin(props.restaurant.restaurant_name) || `Restoran #${props.restaurant.restaurant_id}`
);
const since = computed(() => startDateText(props.restaurant.cooperation_started_at));
const person = computed(() => toLatin(props.restaurant.restaurant_contact_person));
const phone = computed(() => props.restaurant.restaurant_phone?.trim() ?? "");
const email = computed(() => props.restaurant.restaurant_email?.trim() ?? "");
const address = computed(() => toLatin(props.restaurant.restaurant_address).trim());

// Razlog kao rečenica (bez tačke na kraju se doda), da se spoji sa onim što slijedi.
const reason = computed(() => {
  const text = toLatin(props.restaurant.suspension_reason).trim();
  if (!text) return "Razlog nije upisan.";
  return /[.!?]$/.test(text) ? text : `${text}.`;
});

// Sopstvena dostava nema saradnju koja se uključuje; ostalo ima jednu radnju.
const action = computed<"suspend" | "activate" | null>(() =>
  state.value === "internal" ? null : state.value === "ours" ? "activate" : "suspend"
);

const mismatch = computed(() =>
  state.value === "internal" ? null : currencyMismatch(props.restaurant, props.companyCurrency)
);
const currencyText = computed(() => {
  const own = props.restaurant.restaurant_currency?.trim();
  if (!own) return "Nije upisano";
  return mismatch.value ? `${resolveCurrency(own)} · firma koristi ${resolveCurrency(props.companyCurrency)}` : resolveCurrency(own);
});

// Lokacija iz koordinata, a kad njih nema, iz adrese.
const mapLink = computed(() => {
  const lat = props.restaurant.restaurant_latitude;
  const lng = props.restaurant.restaurant_longitude;
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return address.value
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.value)}`
    : null;
});

const copied = ref<"id" | "phone" | "email" | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const copy = async (kind: "id" | "phone" | "email", text: string) => {
  const ok = await copyText(text);
  if (!ok) {
    alerts.info("Kopiranje nije uspjelo. Označi tekst i kopiraj ručno.");
    return;
  }
  copied.value = kind;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = null;
  }, 1600);
};

// Drugi restoran: oznaka "kopirano" ne prelazi na njega.
watch(
  () => props.restaurant.id,
  () => {
    copied.value = null;
  }
);

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});

defineExpose({ focusTitle: () => title.value?.focus({ preventScroll: true }) });
</script>

<style scoped>
.dt {
  min-width: 0;
  padding-bottom: 14px;
}

.dt-head {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 18px 16px 12px;
}

.dt-head:not(:has(.dt-x)) {
  grid-template-columns: 64px minmax(0, 1fr);
}

.dt-av {
  position: relative;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--tint);
  color: var(--ink);
}

.dt-av .dot {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 3px solid #fff;
}

.dt-t {
  display: grid;
  gap: 6px;
  justify-items: start;
  min-width: 0;
}

.dt-t h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.dt-t h2:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 3px;
  border-radius: 6px;
}

.dt-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.dt-id {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px 0 12px;
  border: 0;
  border-radius: 999px;
  background: #f1f3f6;
  color: #0b1220;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

/* Meta od 44 px, a izgled ostaje 32 px. */
.dt-id::after {
  content: "";
  position: absolute;
  inset: -6px -4px;
}

.dt-id .v-icon {
  color: #5b6676;
}

.dt-id.done {
  background: #e3f8ef;
  color: #00734f;
}

.dt-id.done .v-icon {
  color: #00734f;
}

.dt-id:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.dt-st {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--ink);
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.dt-st i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dot);
}

.dt-x {
  display: grid;
  align-self: start;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px -6px 0 0;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.dt-x:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.dt-qa {
  display: grid;
  grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr));
  gap: 8px;
  padding: 4px 16px 14px;
}

.qb {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 4px;
  min-height: 60px;
  padding: 8px 4px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.qb:active {
  background: #f1f4f9;
}

.qb:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.qb:disabled {
  color: #5b6676;
  background: #f5f6f8;
  cursor: not-allowed;
}

.dt-alert {
  padding: 0 16px 10px;
}

.gt {
  margin: 0;
  padding: 14px 16px 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.grp {
  margin: 0 8px;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
  background: #fff;
}

.dt-alert + .gt {
  padding-top: 4px;
}

.ib {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px -8px -6px 0;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.ib:active {
  background: #f1f3f6;
}

.ib:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
