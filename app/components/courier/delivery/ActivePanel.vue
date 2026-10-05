<template>
  <div class="dl-panel">
    <div class="dl-sheet-in">
      <div v-if="total > 1" class="dl-eyebrow">Dostava {{ position }} od {{ total }}</div>

      <div class="dl-head-row">
        <div class="dl-steps" role="group" :aria-label="step === 'pickup' ? 'Korak 1 od 2: preuzimanje' : 'Korak 2 od 2: dostava'">
          <span class="dl-st" :class="{ 'is-on': step === 'pickup' }">Preuzimanje</span>
          <i class="dl-bar"><b :style="{ width: `${Math.round(progress * 100)}%` }" /></i>
          <span class="dl-st" :class="{ 'is-on': step === 'dropoff' }">Dostava</span>
        </div>
        <span class="dl-chip dl-chip--id" :aria-label="`Narudžba broj ${order.id}`">
          <v-icon icon="mdi-pound" size="16" /> {{ order.id }}
        </span>
      </div>

      <div class="dl-dest">
        <template v-if="step === 'pickup'">
          <div class="dl-title">{{ restaurantName }}</div>
          <div v-if="restaurantAddressText" class="dl-sub">{{ restaurantAddressText }}</div>
        </template>
        <template v-else>
          <div class="dl-title">{{ customerStreet }}</div>
          <div v-if="unitChips.length" class="dl-chips">
            <span v-for="chip in unitChips" :key="chip" class="dl-chip dl-chip--unit">{{ chip }}</span>
          </div>
          <div v-if="cityLine" class="dl-sub">{{ cityLine }}</div>
        </template>
      </div>

      <div class="dl-chips">
        <span v-if="etaText" class="dl-chip" :class="{ 'dl-chip--ok': arrived }" data-eta>
          <v-icon icon="mdi-clock-fast" size="16" /> <span>{{ etaText }}</span>
        </span>
        <span v-if="distanceLabel && !arrived" class="dl-chip" data-dist>
          <v-icon icon="mdi-map-marker-distance" size="16" /> <span>{{ distanceLabel }}</span>
        </span>
        <span v-if="deadline" class="dl-chip" :class="`dl-chip--${deadline.tone}`">
          <v-icon icon="mdi-clock-outline" size="16" /> {{ deadline.text }}
        </span>
      </div>

      <div v-if="routeUnavailable" class="dl-alert dl-alert--info" role="status">
        <v-icon icon="mdi-information-outline" size="22" />
        <div>
          <b>{{ step === "pickup" ? "Restoran nema koordinate" : "Adresa nema koordinate" }}</b>
          Ruta se ne može nacrtati, ali Navigiraj radi po adresi.
        </div>
      </div>
      <div v-if="offline" class="dl-alert" role="status">
        <v-icon icon="mdi-wifi-off" size="22" />
        <div>
          <b>Nema veze sa serverom</b>
          Potvrda će raditi čim se veza vrati.
        </div>
      </div>

      <div v-if="collect" class="dl-collect">
        <span class="dl-collect-ic"><v-icon icon="mdi-cash" size="20" /></span>
        <div>
          <b>{{ collect.title }}</b>
          <span>{{ collect.caption }}</span>
        </div>
      </div>

      <div class="dl-btn-row" :class="{ 'is-stack': !hasCoords }">
        <a
          v-if="navHref"
          class="dl-btn dl-btn--blue"
          :href="navHref"
          target="_blank"
          rel="noopener"
        >
          <v-icon icon="mdi-navigation" size="20" />
          {{ hasCoords ? "Navigiraj" : "Navigiraj po adresi" }}
        </a>
        <a
          v-if="phone"
          class="dl-btn"
          :href="`tel:${phone}`"
          :aria-label="`Pozovi ${step === 'pickup' ? 'restoran' : 'kupca'}`"
        >
          <v-icon icon="mdi-phone-outline" size="20" /> Pozovi
        </a>
      </div>

      <div v-if="pending" class="dl-alert dl-alert--info" role="alert">
        <v-icon icon="mdi-information-outline" size="22" />
        <div>
          <b>{{ pendingTitle }}</b>
          {{ pendingText }}
          <div class="dl-alert-act">
            <button type="button" class="dl-btn" @click="pending = null">Ne još</button>
            <button type="button" class="dl-btn dl-btn--green" @click="confirmNow">Da, potvrdi</button>
          </div>
        </div>
      </div>
      <SlideToConfirm
        v-else
        :key="`${order.id}-${step}`"
        :kind="step === 'pickup' ? 'pickup' : 'deliver'"
        :label="step === 'pickup' ? 'Povuci za potvrdu preuzimanja' : 'Povuci da označiš dostavljeno'"
        :disabled="offline"
        :busy="busy"
        @confirm="onSlid"
        @request-confirm="pending = 'keyboard'"
      />

      <div class="dl-more">
        <div class="dl-more-in">
          <div v-if="step === 'pickup'" class="dl-bigid">
            <span>Reci osoblju: narudžba</span>
            <b>#{{ order.id }}</b>
          </div>

          <div class="dl-det">
            <h4>Ruta</h4>
            <OrderStops
              :restaurant="{ name: restaurantName, address: restaurantAddressText }"
              :customer="{ title: customerRouteTitle, sub: customerRouteSub }"
              :pickup-done="step === 'dropoff'"
            >
              <template #[stopSlot]>
                <a v-if="navHref" class="dl-chipbtn" :href="navHref" target="_blank" rel="noopener">
                  <v-icon icon="mdi-navigation" size="16" /> Navigiraj
                </a>
                <a v-if="wazeHref" class="dl-chipbtn" :href="wazeHref" target="_blank" rel="noopener">Waze</a>
                <a v-if="appleHref" class="dl-chipbtn" :href="appleHref" target="_blank" rel="noopener">Apple Maps</a>
                <button type="button" class="dl-chipbtn" @click="copyAddress">
                  <v-icon icon="mdi-content-copy" size="16" /> Kopiraj adresu
                </button>
              </template>
            </OrderStops>
          </div>

          <div v-if="order.amountToCollect !== null" class="dl-det">
            <h4>Naplata</h4>
            <div class="dl-ln">
              <span>Način plaćanja</span><span>{{ paymentLabel ?? "—" }}</span>
            </div>
            <div class="dl-ln dl-ln--total">
              <span>Za naplatu</span><span>{{ formatAmount(order.amountToCollect) }}</span>
            </div>
          </div>

          <div v-if="order.customerNote" class="dl-det">
            <h4>Napomena kupca</h4>
            <p class="dl-note">{{ order.customerNote }}</p>
          </div>

          <div class="dl-det">
            <h4>Detalji</h4>
            <div v-if="order.customerName" class="dl-ln"><span>Kupac</span><span>{{ order.customerName }}</span></div>
            <div v-if="deliveryTimeText" class="dl-ln"><span>Dostaviti do</span><span>{{ deliveryTimeText }}</span></div>
            <div v-if="moneyLine" class="dl-ln">
              <span>{{ moneyLine.label }}</span><span>{{ moneyLine.value }}</span>
            </div>
          </div>

          <div v-if="nextOrder" class="dl-det">
            <h4>Sljedeće</h4>
            <button type="button" class="dl-next" @click="emit('select-next')">
              <div>
                <b>{{ restaurantLabel(nextOrder) }} → {{ locationLabel(nextOrder) }}</b>
                <span>#{{ nextOrder.id }} · {{ activeOrderStateLabel(nextOrder) }}</span>
              </div>
              <v-icon icon="mdi-chevron-right" size="20" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import OrderStops from "~/components/courier/delivery/OrderStops.vue";
import SlideToConfirm from "~/components/courier/delivery/SlideToConfirm.vue";
import { formatRouteDistance } from "~/composables/useDeliveryRoute";
import { useOrderDeliveryPrice } from "~/composables/useOrderDeliveryPrice";
import type { Order } from "~/models/Order";
import type { RoutingVehicle } from "~/types/courier";
import { copyText } from "~/utils/clipboard";
import { formatAmount } from "~/utils/currency";
import { toLatLng } from "~/utils/geo";
import { isAppleDevice, navigationUrl, type NavigationTarget } from "~/utils/navigationLinks";
import {
  activeOrderStateLabel,
  customerCityLine,
  customerFullAddress,
  deliveryUnitChips,
  deliveryUnitParts,
  locationLabel,
  paymentMethodLabel,
  restaurantAddress,
  restaurantFullAddress,
  restaurantLabel,
} from "~/utils/orderDisplay";
import { useAlertStore } from "~/stores/alert";

// Ako je kurir dalje od cilja od ovoga, klizač traži dodatnu potvrdu.
const FAR_METERS = 250;
// Ispod ovoga se smatra da je stigao.
const ARRIVED_METERS = 40;

const props = defineProps<{
  order: Order;
  step: "pickup" | "dropoff";
  // "Dostava 1 od N" kad kurir vozi više naloga.
  position: number;
  total: number;
  etaLabel: string | null;
  distanceLabel: string | null;
  // Udaljenost kurira od cilja zračnom linijom (null = nepoznata).
  straightMeters: number | null;
  // 0..1 preko oba koraka.
  progress: number;
  routeUnavailable: boolean;
  offline: boolean;
  busy: boolean;
  vehicle: RoutingVehicle;
  nextOrder: Order | null;
}>();

const emit = defineEmits<{
  confirm: [];
  "select-next": [];
}>();

const alerts = useAlertStore();

const restaurantName = computed(() => restaurantLabel(props.order));
const restaurantAddressText = computed(() => restaurantAddress(props.order));
const customerStreet = computed(() => locationLabel(props.order));
const cityLine = computed(() => customerCityLine(props.order));
const unitChips = computed(() => deliveryUnitChips(props.order));
const unitParts = computed(() => deliveryUnitParts(props.order));

// U listi stanica stan i sprat idu uz ulicu ("Ive Andrića 7 · stan 12, sprat 3"),
// grad, poštanski broj i firma u drugi red.
const customerRouteTitle = computed(() => {
  const { apartment, floor } = unitParts.value;
  const unit = [apartment, floor].filter(Boolean).join(", ").toLowerCase();
  return unit ? `${customerStreet.value} · ${unit}` : customerStreet.value;
});
const customerRouteSub = computed(() =>
  [cityLine.value, unitParts.value.firm].filter(Boolean).join(" · ")
);

const stopSlot = computed(() => (props.step === "pickup" ? "restaurant" : "customer"));

const arrived = computed(
  () => props.straightMeters !== null && props.straightMeters <= ARRIVED_METERS
);
const etaText = computed(() => (arrived.value ? "Stigao si" : props.etaLabel));

// ------------------------------------------------------------------ rok isporuke

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 30_000);
});
onBeforeUnmount(() => {
  if (clock) clearInterval(clock);
});

const dueAt = computed(() => {
  const value = props.order.deliveryTime ? Date.parse(props.order.deliveryTime) : NaN;
  return Number.isFinite(value) ? value : null;
});
const clockTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });
const deliveryTimeText = computed(() => (dueAt.value === null ? null : clockTime(dueAt.value)));

const deadline = computed(() => {
  if (dueAt.value === null) return null;
  const minutes = Math.round((dueAt.value - now.value) / 60_000);
  if (minutes >= 0) {
    return {
      tone: minutes <= 5 ? "warn" : "ok",
      text: `Dostaviti do ${clockTime(dueAt.value)} · ${minutes} min`,
    };
  }
  return { tone: "warn", text: `Kasniš ${-minutes} min` };
});

// ------------------------------------------------------------------ navigacija i poziv

const target = computed<NavigationTarget>(() => {
  const coordination =
    props.step === "pickup"
      ? props.order.restaurant?.location?.coordination
      : props.order.location?.coordination;
  return {
    coords: toLatLng(coordination),
    address:
      props.step === "pickup"
        ? restaurantFullAddress(props.order)
        : customerFullAddress(props.order),
  };
});
const hasCoords = computed(() => Boolean(target.value.coords));
const navHref = computed(() => navigationUrl("google", target.value, props.vehicle));
const wazeHref = computed(() => navigationUrl("waze", target.value, props.vehicle));
const appleHref = computed(() =>
  import.meta.client && isAppleDevice() ? navigationUrl("apple", target.value, props.vehicle) : null
);

const phone = computed(() => {
  const raw = props.step === "pickup" ? props.order.restaurantPhone : props.order.customerPhone;
  const cleaned = (raw ?? "").replace(/[^\d+]/g, "");
  return cleaned || null;
});

const copyAddress = async () => {
  const text = target.value.address?.trim();
  if (!text) return;
  alerts.info((await copyText(text)) ? "Adresa je kopirana." : "Ne mogu da kopiram adresu.");
};

// ------------------------------------------------------------------ naplata i novac
// Sve ovo čeka backend (B1, B4): polja se čitaju čim stignu, do tada se ne prikazuju.

const paymentLabel = computed(() => paymentMethodLabel(props.order.paymentMethod));

const collect = computed(() => {
  if (props.step !== "dropoff" || props.order.amountToCollect === null) return null;
  if (props.order.amountToCollect <= 0) {
    return {
      title: "Ne naplaćuj ništa",
      caption: paymentLabel.value ?? "Plaćeno unaprijed",
    };
  }
  return {
    title: `Naplati ${formatAmount(props.order.amountToCollect)}`,
    caption: paymentLabel.value ?? "Gotovinom",
  };
});

// Cijena dostave (dok backend ne pošalje zaradu): /pricing/calculate iz koordinata.
const { calculation } = useOrderDeliveryPrice(computed(() => props.order));
const moneyLine = computed(() => {
  if (props.order.courierEarning !== null) {
    return { label: "Tvoja zarada", value: formatAmount(props.order.courierEarning) };
  }
  if (calculation.value) {
    return { label: "Cijena dostave", value: formatAmount(calculation.value.total) };
  }
  if (props.order.deliveryPrice) {
    return { label: "Cijena dostave", value: formatAmount(Number(props.order.deliveryPrice)) };
  }
  return null;
});

// ------------------------------------------------------------------ potvrda koraka

// null = nema upita; "far" = klizač povučen daleko od cilja; "keyboard" = dodir
// na dugme bez povlačenja (tastatura / čitač ekrana).
const pending = ref<"far" | "keyboard" | null>(null);

// Nalog se na svakih 15 s zamijeni novim objektom - upit smije da nestane samo kad
// se zaista promijeni nalog ili korak.
watch([() => props.order.id, () => props.step], () => (pending.value = null));

const isFar = computed(() => props.straightMeters !== null && props.straightMeters > FAR_METERS);
const placeNoun = computed(() => (props.step === "pickup" ? "restorana" : "adrese kupca"));

const pendingTitle = computed(() =>
  pending.value === "far"
    ? `Daleko si od ${placeNoun.value} (${formatRouteDistance(props.straightMeters ?? 0)}).`
    : props.step === "pickup"
      ? "Potvrditi preuzimanje iz restorana?"
      : "Potvrditi da je dostavljeno?"
);
const pendingText = computed(() =>
  pending.value === "far" ? "Sigurno želiš da potvrdiš?" : "Ovaj korak se ne može poništiti."
);

const onSlid = () => {
  if (isFar.value) pending.value = "far";
  else emit("confirm");
};

const confirmNow = () => {
  pending.value = null;
  emit("confirm");
};
</script>
