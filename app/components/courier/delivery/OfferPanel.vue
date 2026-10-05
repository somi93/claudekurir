<template>
  <div class="dl-panel">
    <div class="dl-sheet-in">
      <div class="sr-only-dl" role="alert">
        Nova ponuda: {{ restaurantName }}, {{ priceText }} KM {{ priceCaption }}.
        <template v-if="secondsLeft !== null">Ističe za {{ secondsLeft }} sekundi.</template>
      </div>

      <div class="dl-offer-top">
        <div class="dl-offer-head">
          <div class="dl-eyebrow dl-eyebrow--blue">
            Nova ponuda
            <button
              v-if="queueCount > 0"
              type="button"
              class="dl-queue"
              :aria-label="`Prikaži sljedeću ponudu, ${queueCount} čeka`"
              @click="emit('next')"
            >
              <v-icon icon="mdi-chevron-right" size="16" />
              +{{ queueCount }} {{ pluralizeSr(queueCount, "ponuda", "ponude", "ponuda") }}
              <template v-if="queueSecondsLeft !== null"> · {{ formatClock(queueSecondsLeft) }}</template>
            </button>
          </div>
          <div class="dl-price-row">
            <div class="dl-price">{{ priceText }}<small>KM</small></div>
            <div class="dl-sub">{{ priceCaption }}</div>
          </div>
        </div>

        <div
          v-if="secondsLeft !== null"
          class="dl-ring"
          :class="ringClass"
          role="timer"
          :aria-label="`Ponuda ističe za ${secondsLeft} s`"
        >
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <circle class="dl-r-bg" cx="30" cy="30" :r="RING_RADIUS" />
            <circle
              class="dl-r-fg"
              cx="30"
              cy="30"
              :r="RING_RADIUS"
              :stroke-dasharray="RING_LENGTH.toFixed(1)"
              :stroke-dashoffset="ringOffset.toFixed(1)"
            />
          </svg>
          <b>{{ formatClock(secondsLeft) }}</b>
        </div>
      </div>

      <div v-if="distanceChips.length" class="dl-chips">
        <span v-for="chip in distanceChips" :key="chip.text" class="dl-chip">
          <v-icon :icon="chip.icon" size="16" /> {{ chip.text }}
        </span>
      </div>

      <OrderStops
        compact
        :restaurant="{ name: restaurantName, address: restaurantAddressText }"
        :customer="{ title: customerStreet, sub: customerSub }"
      />

      <div v-if="offer.exceeded" class="dl-alert" role="status">
        <v-icon icon="mdi-alert-outline" size="22" />
        <div>
          <b>Premašio si limit gotovine</b>
          Predaj pazar dispečeru.
        </div>
      </div>

      <div v-if="expired" class="dl-expired" role="status">Ponuda je istekla</div>
      <div v-else class="dl-offer-actions">
        <button
          type="button"
          class="dl-btn dl-btn--big"
          :disabled="responding"
          @click="emit('respond', 'decline')"
        >
          Odbij
        </button>
        <button
          type="button"
          class="dl-btn dl-btn--green"
          :disabled="responding"
          @click="emit('respond', 'accept')"
        >
          <v-progress-circular v-if="responding" indeterminate size="20" width="3" />
          <v-icon v-else icon="mdi-check" size="22" />
          Prihvati
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import OrderStops from "~/components/courier/delivery/OrderStops.vue";
import { mapOrderDto } from "~/models/Order";
import type { OrderDto } from "~/types/order";
import type { CourierInboxOfferDto, OfferResponseAction } from "~/types/offer";
import { pluralizeSr } from "~/utils/datetime";
import { distanceMeters, toLatLng, type LatLngTuple } from "~/utils/geo";
import { customerCityLine, locationLabel, restaurantAddress, restaurantLabel } from "~/utils/orderDisplay";
import { formatRouteDistance } from "~/composables/useDeliveryRoute";
import { toLatin } from "~/utils/toLatin";

const props = defineProps<{
  offer: CourierInboxOfferDto;
  // Preostalo vrijeme u sekundama (null = ponuda nema rok).
  secondsLeft: number | null;
  // Koliko je rok trajao kad je ponuda stigla - za prsten.
  totalSeconds: number;
  responding: boolean;
  // Koliko drugih ponuda čeka iza ove, i za koliko ističe sljedeća.
  queueCount: number;
  queueSecondsLeft: number | null;
  courierLocation: { latitude: number; longitude: number } | null;
}>();

const emit = defineEmits<{
  respond: [action: OfferResponseAction];
  next: [];
}>();

const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// `order` u ponudi je isti oblik kao red iz /orders/driver/{id} (potvrđeno uživo 25.09).
const order = computed(() =>
  props.offer.order ? mapOrderDto(props.offer.order as unknown as OrderDto) : null
);

const restaurantName = computed(
  () =>
    (order.value ? restaurantLabel(order.value) : toLatin(props.offer.restaurant_name)) ||
    `Porudžbina #${props.offer.order_id}`
);
const restaurantAddressText = computed(() => (order.value ? restaurantAddress(order.value) : null));
const customerStreet = computed(() => (order.value ? locationLabel(order.value) : "Adresa kupca"));
const customerSub = computed(() => (order.value ? customerCityLine(order.value) : null));

// Iznos: zarada kurira kad je backend pošalje (B4), do tada cijena dostave.
// `currency` na ponudi stiže prazan - kurirski ekrani uvijek pišu KM.
const earning = computed(() => {
  const raw = props.offer.courier_earning ?? order.value?.courierEarning ?? null;
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
});
const price = computed(() => {
  if (earning.value !== null) return earning.value;
  const raw = props.offer.delivery_price ?? order.value?.deliveryPrice ?? null;
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
});
const priceText = computed(() => (price.value === null ? "—" : price.value.toFixed(2)));
const priceCaption = computed(() => (earning.value !== null ? "tvoja zarada" : "cijena dostave"));

// Udaljenosti: backend (B3) ili, dok ne šalje, vazdušna linija iz koordinata. Vazdušna
// linija je približna, zato "≈" - tačna dolazi sa rutom poslije prihvatanja.
const restaurantPoint = computed<LatLngTuple | null>(() =>
  toLatLng(order.value?.restaurant?.location?.coordination)
);
const customerPoint = computed<LatLngTuple | null>(() => toLatLng(order.value?.location?.coordination));

// Restoran -> kupac u metrima: `trip_distance_m` ili `distance_km` (isto polje koje backend već
// vraća na orders/waiting), na ponudi ili u nalogu. 0 / prazno = backend nije mogao da izračuna.
const backendTripMeters = computed<number | null>(() => {
  if (typeof props.offer.trip_distance_m === "number" && props.offer.trip_distance_m > 0) {
    return props.offer.trip_distance_m;
  }
  const raw = props.offer.distance_km ?? props.offer.order?.distance_km;
  if (raw === null || raw === undefined || raw === "") return null;
  const km = Number(raw);
  return Number.isFinite(km) && km > 0 ? km * 1000 : null;
});

const distanceChips = computed(() => {
  const chips: { icon: string; text: string }[] = [];
  const pickup =
    typeof props.offer.pickup_distance_m === "number"
      ? { meters: props.offer.pickup_distance_m, exact: true }
      : props.courierLocation && restaurantPoint.value
        ? {
            meters: distanceMeters(
              [props.courierLocation.latitude, props.courierLocation.longitude],
              restaurantPoint.value
            ),
            exact: false,
          }
        : null;
  const trip =
    backendTripMeters.value !== null
      ? { meters: backendTripMeters.value, exact: true }
      : restaurantPoint.value && customerPoint.value
        ? { meters: distanceMeters(restaurantPoint.value, customerPoint.value), exact: false }
        : null;
  if (pickup) {
    chips.push({
      icon: "mdi-map-marker-distance",
      text: `${pickup.exact ? "" : "≈ "}${formatRouteDistance(pickup.meters)} do restorana`,
    });
  }
  if (trip) {
    chips.push({
      icon: "mdi-map-marker-distance",
      // Bez udaljenosti do restorana bi se "do kupca" čitalo kao udaljenost od kurira.
      text: `${trip.exact ? "" : "≈ "}${formatRouteDistance(trip.meters)} ${pickup ? "do kupca" : "od restorana do kupca"}`,
    });
  }
  // Restoran nema koordinate (samo naziv i adresa), a kupac ima: bar zračna linija od kurira do kupca.
  if (!pickup && !trip && props.courierLocation && customerPoint.value) {
    const meters = distanceMeters(
      [props.courierLocation.latitude, props.courierLocation.longitude],
      customerPoint.value
    );
    chips.push({
      icon: "mdi-map-marker-distance",
      text: `≈ ${formatRouteDistance(meters)} od tebe do kupca (zračno)`,
    });
  }
  return chips;
});

const expired = computed(() => props.secondsLeft !== null && props.secondsLeft <= 0);

const ringOffset = computed(() => {
  const total = Math.max(1, props.totalSeconds);
  const ratio = Math.min(1, Math.max(0, (props.secondsLeft ?? 0) / total));
  return RING_LENGTH * (1 - ratio);
});
const ringClass = computed(() => {
  const left = props.secondsLeft ?? Infinity;
  return left <= 5 ? "is-bad" : left <= 10 ? "is-warn" : "";
});

// m:ss - broj je uvijek u istom obliku, ne "596s".
const formatClock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};
</script>
