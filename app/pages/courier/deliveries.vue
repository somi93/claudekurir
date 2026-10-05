<template>
  <div class="dl-page">
    <NuxtRouteAnnouncer />

    <DeliveryStage
      v-model:sheet-open="sheetOpen"
      :courier-location="courierLocation"
      :courier-heading="courierHeading"
      :courier-speed="courierSpeed"
      :signal-lost="signalLost"
      :pins="pins"
      :route-line="mapRouteLine"
      :route-approximate="routeApproximate"
      :next-leg="nextLeg"
      :fit-key="fitKey"
      :follow-zoom="followZoom"
      :status="status"
      :expandable="panel === 'active'"
      :can-recenter="canRecenter"
      @status-select="showStatusHint"
    >
      <Transition name="dl-sheet-swap" mode="out-in">
        <div v-if="panel === 'loading'" key="loading" class="dl-panel">
          <div class="dl-sheet-in">
            <div class="dl-loading" role="status">
              <v-progress-circular indeterminate size="24" width="3" color="primary" />
              Učitavam dostave…
            </div>
          </div>
        </div>

        <OfferPanel
          v-else-if="panel === 'offer' && currentOffer"
          :key="`offer-${currentOffer.offer_id}`"
          :offer="currentOffer"
          :seconds-left="secondsLeft(currentOffer)"
          :total-seconds="offerTotalSeconds(currentOffer)"
          :responding="respondingOrderId === currentOffer.order_id"
          :queue-count="visibleOffers.length - 1"
          :queue-seconds-left="otherOffer ? secondsLeft(otherOffer) : null"
          :courier-location="courierLocation"
          @respond="respondOffer(currentOffer, $event)"
          @next="cycleOffer"
        />

        <ActivePanel
          v-else-if="panel === 'active' && currentOrder"
          :key="`active-${currentOrder.id}-${step}`"
          :order="currentOrder"
          :step="step"
          :position="currentIndex"
          :total="activeOrders.length"
          :eta-label="routeDurationLabel"
          :distance-label="routeDistanceLabel"
          :straight-meters="straightMeters"
          :progress="stepProgress"
          :route-unavailable="routeUnavailable"
          :offline="!deviceOnline"
          :busy="loadingAction === currentOrder.id"
          :vehicle="courierVehicle"
          :next-order="nextOrder"
          @confirm="confirmStep"
          @select-next="selectNextOrder"
        />

        <CompletedPanel
          v-else-if="panel === 'done' && lastDelivered"
          key="done"
          :order-id="lastDelivered.id"
          :wage="completedWage"
          :collected="completedCollected"
          :has-next="activeOrders.length > 0"
          @continue="showDone = false"
        />

        <IdlePanel
          v-else
          key="idle"
          :gps="gps"
          :accuracy="courierAccuracy"
          :connection="connection"
          :last-synced-at="lastSyncedAt"
          :push="pushState"
          :sound-enabled="soundEnabled"
          :keep-awake="keepAwakeIdle"
          :awake-supported="wakeLockSupported"
          :orders-error="mineError"
          :deliveries="today.deliveries.value"
          :wage="today.wage.value"
          :cash-owed="today.cashOwed.value"
          :cash-limit="today.cashLimit.value"
          @retry-gps="retryLocationStreaming"
          @request-push="requestPush"
          @toggle-sound="toggleSound"
          @toggle-awake="toggleKeepAwake"
          @retry-orders="refreshOrders"
        />
      </Transition>
    </DeliveryStage>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: "Dostave" });

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ActivePanel from "~/components/courier/delivery/ActivePanel.vue";
import CompletedPanel from "~/components/courier/delivery/CompletedPanel.vue";
import DeliveryStage from "~/components/courier/delivery/DeliveryStage.vue";
import IdlePanel from "~/components/courier/delivery/IdlePanel.vue";
import OfferPanel from "~/components/courier/delivery/OfferPanel.vue";
import { useCourierLocation } from "~/composables/useCourierLocation";
import { useCourierOffers } from "~/composables/useCourierOffers";
import { useCourierOrders } from "~/composables/useCourierOrders";
import { useCourierToday } from "~/composables/useCourierToday";
import { useDeliveryRoute } from "~/composables/useDeliveryRoute";
import { useOfferAlert } from "~/composables/useOfferAlert";
import { usePushNotifications } from "~/composables/usePushNotifications";
import { useSoundNotifications } from "~/composables/useSoundNotifications";
import { useWakeLock } from "~/composables/useWakeLock";
import { mapOrderDto, type Order } from "~/models/Order";
import { useAlertStore } from "~/stores/alert";
import { useProfileStore } from "~/stores/profile";
import { useSessionStore } from "~/stores/session";
import type { RoutingVehicle } from "~/types/courier";
import type { MapPin } from "~/types/deliveryMap";
import type { CourierInboxOfferDto, OfferResponseAction } from "~/types/offer";
import type { OrderDto } from "~/types/order";
import { distanceMeters, toLatLng, type LatLngTuple } from "~/utils/geo";
import {
  isOrderActive,
  isOrderPickedUp,
  locationLabel,
  ORDER_STATE,
  restaurantLabel,
} from "~/utils/orderDisplay";
import { toRoutingVehicle } from "~/utils/vehicle";

const sessionStore = useSessionStore();
const alerts = useAlertStore();
const courierId = computed(() => Number(sessionStore.courierId));

// ------------------------------------------------------------------ vozilo

// Vozilo kurira za routing pozive (item 3.3) - "foot" dok se profil ne učita i za kurira bez
// registrovanog vozila (vehicle: null); useDeliveryRoute reaguje na promenu i ponovo zatraži rutu.
// Profil je u zajedničkom store-u (stores/profile.ts): isti podatak koji prikazuje Profil, jedan
// GET /couriers/{id} po prijavi umjesto po ekranu. Ruta i dalje radi na "foot" rezervi ako se
// profil ne može učitati.
const profileStore = useProfileStore();
const courierVehicle = computed<RoutingVehicle>(() => toRoutingVehicle(profileStore.vehicle));

// `immediate: true` pokriva i slučaj da je courierId već validan pri mount-u.
watch(
  courierId,
  (id) => {
    if (!Number.isFinite(id) || id <= 0) return;
    profileStore.start(id);
    void profileStore.touch();
  },
  { immediate: true }
);

// Zumiranje kamere dok prati kurira: bicikl i pješak bliže, motor i auto dalje.
const followZoom = computed(() =>
  courierVehicle.value === "foot" || courierVehicle.value === "bicycle" ? 17 : 16
);

// ------------------------------------------------------------------ nalozi

const {
  myOrders,
  loadingMine,
  mineError,
  loadingAction,
  activeOrders,
  lastDelivered,
  addOrder,
  refreshOrders,
  confirmPickup,
  deliverOrder,
} = useCourierOrders(courierId);

// Ako kurir vozi više naloga, on bira koji je trenutni (podrazumijevano prvi u
// redoslijedu rada - onaj koji već nosi, pa po roku).
const selectedOrderId = ref<number | null>(null);
const currentOrder = computed<Order | null>(
  () =>
    activeOrders.value.find((order) => order.id === selectedOrderId.value) ??
    activeOrders.value[0] ??
    null
);
const nextOrder = computed<Order | null>(
  () => activeOrders.value.find((order) => order.id !== currentOrder.value?.id) ?? null
);
const currentIndex = computed(() =>
  currentOrder.value
    ? activeOrders.value.findIndex((order) => order.id === currentOrder.value!.id) + 1
    : 0
);
const step = computed<"pickup" | "dropoff">(() =>
  currentOrder.value && isOrderPickedUp(currentOrder.value) ? "dropoff" : "pickup"
);

const sheetOpen = ref(false);

const selectNextOrder = () => {
  if (!nextOrder.value) return;
  selectedOrderId.value = nextOrder.value.id;
  sheetOpen.value = false;
};

// ------------------------------------------------------------------ ponude

const {
  offers: courierOffers,
  respondingOrderId,
  connection,
  deviceOnline,
  lastSyncedAt,
  respond: respondToCourierOffer,
} = useCourierOffers(courierId);

// Odbrojavanje je klijentsko (sat telefona) dok backend ne pošalje server_now
// (B9). Sekundni tik radi SAMO dok ima ponuda i SAMO na klijentu (SSR nema smisla
// da broji, i Nuxt baca grešku na "goli" setInterval u setup-u na serveru).
const EXPIRED_GRACE_MS = 2500;
const offerNow = ref(Date.now());
let offerTick: ReturnType<typeof setInterval> | null = null;

// Za svaku ponudu pamtimo da li je viđena živa, kad je istekla i koliko je trajala
// kad je stigla (za prsten). Običan Map: čita se u computed-u koji već ovisi o
// `offerNow`, pa se preračuna svake sekunde.
type OfferLife = { alive: boolean; expiredAt: number | null; totalSeconds: number };
const offerLife = new Map<number, OfferLife>();

const leftSeconds = (offer: CourierInboxOfferDto, now: number): number | null =>
  offer.expires_at ? Math.max(0, Math.ceil((Date.parse(offer.expires_at) - now) / 1000)) : null;

const syncOfferLife = () => {
  const now = Date.now();
  const present = new Set<number>();
  for (const offer of courierOffers.value) {
    present.add(offer.offer_id);
    const left = leftSeconds(offer, now);
    const life = offerLife.get(offer.offer_id) ?? { alive: false, expiredAt: null, totalSeconds: 30 };
    if (left === null || left > 0) {
      if (!life.alive && left !== null) life.totalSeconds = Math.min(120, Math.max(10, left));
      life.alive = true;
    } else if (life.alive && life.expiredAt === null) {
      life.expiredAt = now;
    }
    offerLife.set(offer.offer_id, life);
  }
  for (const id of [...offerLife.keys()]) if (!present.has(id)) offerLife.delete(id);
};

const stopOfferTick = () => {
  if (offerTick) clearInterval(offerTick);
  offerTick = null;
};
const startOfferTick = () => {
  if (offerTick) return;
  offerTick = setInterval(() => {
    syncOfferLife();
    offerNow.value = Date.now();
  }, 1000);
};

watch(
  courierOffers,
  (list) => {
    syncOfferLife();
    offerNow.value = Date.now();
    if (!import.meta.client) return;
    if (list.length > 0) startOfferTick();
    else stopOfferTick();
  },
  { immediate: true }
);
onBeforeUnmount(stopOfferTick);

const secondsLeft = (offer: CourierInboxOfferDto): number | null =>
  leftSeconds(offer, offerNow.value);

const offerTotalSeconds = (offer: CourierInboxOfferDto): number =>
  offerLife.get(offer.offer_id)?.totalSeconds ?? 30;

// GET /courier/offers vraća samo ponude koje čekaju odgovor (nema `offer_status`
// - potvrđeno uživo 12.09). Istekla ponuda ne nestaje tiho: nekoliko sekundi piše
// "Ponuda je istekla", a ponuda koja je već istekla kad je stigla se uopšte ne prikazuje.
const visibleOffers = computed(() => {
  const now = offerNow.value;
  return courierOffers.value
    .filter((offer) => {
      const left = leftSeconds(offer, now);
      if (left === null || left > 0) return true;
      const expiredAt = offerLife.get(offer.offer_id)?.expiredAt ?? null;
      return expiredAt !== null && now - expiredAt < EXPIRED_GRACE_MS;
    })
    .sort((a, b) => {
      const ea = a.expires_at ? Date.parse(a.expires_at) : Infinity;
      const eb = b.expires_at ? Date.parse(b.expires_at) : Infinity;
      return ea - eb;
    });
});

// Koja od više ponuda je na ekranu (dodir na "+N ponuda" prelazi na sljedeću).
const offerCursor = ref(0);
const currentOffer = computed<CourierInboxOfferDto | null>(() => {
  const list = visibleOffers.value;
  if (list.length === 0) return null;
  return list[offerCursor.value % list.length] ?? list[0] ?? null;
});
const otherOffer = computed<CourierInboxOfferDto | null>(() => {
  const list = visibleOffers.value;
  if (list.length < 2) return null;
  return list[(offerCursor.value + 1) % list.length] ?? null;
});
const cycleOffer = () => {
  offerCursor.value += 1;
};

const respondOffer = async (offer: CourierInboxOfferDto, action: OfferResponseAction) => {
  const result = await respondToCourierOffer(offer.order_id, action, (order) => {
    if (action !== "accept") return;
    // Nalog odmah ulazi u listu: iz odgovora, a ako ga nema, iz same ponude (ista
    // struktura kao /orders/driver/{id}). Ovo se izvršava u istom koraku u kojem ponuda
    // nestaje, pa ekran ne trepne na "nema dostave" do sljedećeg GET-a.
    const fromOffer = offer.order ? mapOrderDto(offer.order as unknown as OrderDto) : null;
    const accepted = order ?? fromOffer;
    if (accepted) {
      const active = isOrderActive(accepted)
        ? accepted
        : { ...accepted, state: ORDER_STATE.BOOKED_DELIVERY };
      addOrder(active);
      selectedOrderId.value = active.id;
    }
    showDone.value = false;
    sheetOpen.value = false;
  });
  if (result.ok && action === "accept") void refreshOrders();
};

// ------------------------------------------------------------------ lokacija

const hasActiveOrder = computed(() => activeOrders.value.length > 0);
const {
  courierLocation,
  courierAccuracy,
  courierSpeed,
  courierHeading,
  streamingActive,
  signalLost,
  locationBlocked,
  locationBlockedReason,
  retryLocationStreaming,
} = useCourierLocation(courierId, hasActiveOrder);

const gps = computed<"ok" | "searching" | "weak" | "blocked" | "unsupported">(() => {
  if (locationBlocked.value) {
    return locationBlockedReason.value === "unsupported" ? "unsupported" : "blocked";
  }
  if (!courierLocation.value) return "searching";
  if (signalLost.value || !streamingActive.value) return "weak";
  return "ok";
});
const canRecenter = computed(() => gps.value !== "blocked" && gps.value !== "unsupported");

// ------------------------------------------------------------------ tačke i ruta

// VAŽNO: restoran i naručilac su dvije različite lokacije - nikad ne padati
// nazad na lokaciju naručioca kad restoran nema koordinate (backend ih
// trenutno ne geokodira za sve restorane), jer bi to kurira vodilo na pogrešnu
// adresu za preuzimanje paketa. Bolje prazna ruta (n/a) nego pogrešna.
const restaurantPoint = (order: Order | null): LatLngTuple | null =>
  toLatLng(order?.restaurant?.location?.coordination);
const customerPoint = (order: Order | null): LatLngTuple | null =>
  toLatLng(order?.location?.coordination);

const offerOrder = computed<Order | null>(() =>
  currentOffer.value?.order ? mapOrderDto(currentOffer.value.order as unknown as OrderDto) : null
);

// Cilj rute za AKTIVNU dostavu - null kad nema aktivne porudžbine.
const targetPoint = computed<LatLngTuple | null>(() => {
  if (!currentOrder.value) return null;
  return step.value === "dropoff"
    ? customerPoint(currentOrder.value)
    : restaurantPoint(currentOrder.value);
});

// Kad postoji aktivna dostava ali nemamo koordinate cilja (npr. restoran nije
// geokodiran na backend-u), ne možemo da nacrtamo rutu - panel to kaže i nudi
// navigaciju po adresi umjesto tihog "n/a".
const routeUnavailable = computed(() => Boolean(currentOrder.value) && !targetPoint.value);

const {
  routeLine,
  routeApproximate,
  routeDistanceMeters,
  routeDistanceLabel,
  routeDurationLabel,
} = useDeliveryRoute(courierLocation, targetPoint, courierVehicle);

const straightMeters = computed<number | null>(() => {
  if (!courierLocation.value || !targetPoint.value) return null;
  return distanceMeters(
    [courierLocation.value.latitude, courierLocation.value.longitude],
    targetPoint.value
  );
});

// ------------------------------------------------------------------ ekran

type Panel = "loading" | "offer" | "done" | "active" | "idle";

// Prioritet: ponuda (kratak rok) > "Dostavljeno" > dostava u toku > čekanje.
const showDone = ref(false);
const panel = computed<Panel>(() => {
  if (visibleOffers.value.length > 0) return "offer";
  if (showDone.value && lastDelivered.value) return "done";
  if (currentOrder.value) return "active";
  if (loadingMine.value && myOrders.value.length === 0) return "loading";
  return "idle";
});

const pins = computed<MapPin[]>(() => {
  const result: MapPin[] = [];
  if (panel.value === "offer" && offerOrder.value) {
    const restaurant = restaurantPoint(offerOrder.value);
    const customer = customerPoint(offerOrder.value);
    if (restaurant) {
      result.push({
        key: "restaurant",
        kind: "restaurant",
        latLng: restaurant,
        label: restaurantLabel(offerOrder.value),
      });
    }
    if (customer) {
      result.push({
        key: "customer",
        kind: "customer",
        latLng: customer,
        label: locationLabel(offerOrder.value),
      });
    }
  } else if (panel.value === "active" && currentOrder.value) {
    const restaurant = restaurantPoint(currentOrder.value);
    const customer = customerPoint(currentOrder.value);
    if (step.value === "pickup") {
      if (restaurant) {
        result.push({
          key: "restaurant",
          kind: "restaurant",
          latLng: restaurant,
          label: restaurantLabel(currentOrder.value),
        });
      }
      if (customer) result.push({ key: "customer", kind: "customer", latLng: customer, dim: true });
    } else if (customer) {
      result.push({
        key: "customer",
        kind: "customer",
        latLng: customer,
        label: locationLabel(currentOrder.value),
      });
    }
  }
  return result;
});

// Ruta i sljedeća etapa se crtaju samo uz dostavu u toku.
const mapRouteLine = computed(() => (panel.value === "active" ? routeLine.value : null));
const nextLeg = computed<LatLngTuple[] | null>(() => {
  if (panel.value !== "active" || step.value !== "pickup") return null;
  const restaurant = restaurantPoint(currentOrder.value);
  const customer = customerPoint(currentOrder.value);
  return restaurant && customer ? [restaurant, customer] : null;
});

// Svaka nova ponuda / nalog / korak ponovo uklapa cijelu rutu u kadar.
const fitKey = ref(0);
// Niz getter-a (ne jedan getter koji vraća niz): poređenje je po vrijednosti, pa
// zamjena objekta naloga na svakih 15 s (isti nalog) ne pomjera kameru niti zatvara panel.
watch(
  [
    () => panel.value,
    () => currentOffer.value?.offer_id ?? 0,
    () => currentOrder.value?.id ?? 0,
    () => step.value,
  ],
  () => {
    fitKey.value += 1;
    sheetOpen.value = false;
  }
);

// Napredak trake "Preuzimanje -> Dostava": pola traka po koraku. Početak koraka je
// najveća udaljenost viđena u tom koraku, pa osvježavanje rute usred vožnje ne
// vraća traku unazad.
const legKey = computed(() => (currentOrder.value ? `${currentOrder.value.id}:${step.value}` : ""));
const legBaseline = ref<number | null>(null);
watch(legKey, () => (legBaseline.value = null));
watch(routeDistanceMeters, (meters) => {
  if (meters !== null && (legBaseline.value === null || meters > legBaseline.value)) {
    legBaseline.value = meters;
  }
});
const stepProgress = computed(() => {
  const baseline = legBaseline.value;
  const meters = routeDistanceMeters.value;
  const leg = baseline && meters !== null ? Math.min(1, Math.max(0, 1 - meters / baseline)) : 0;
  return step.value === "pickup" ? leg * 0.5 : 0.5 + leg * 0.5;
});

// ------------------------------------------------------------------ potvrde koraka

const confirmStep = async () => {
  const order = currentOrder.value;
  if (!order) return;

  if (step.value === "pickup") {
    await confirmPickup(order);
    return;
  }

  const delivered = await deliverOrder(order);
  if (delivered) {
    showDone.value = true;
    selectedOrderId.value = null;
    void today.refresh();
  }
};

// ------------------------------------------------------------------ danas, završetak

const today = useCourierToday(courierId);

const completedEarning = computed(
  () => today.orders.value.find((entry) => entry.orderId === lastDelivered.value?.id) ?? null
);
const completedWage = computed(() => completedEarning.value?.wage ?? null);
const completedCollected = computed(() => {
  const collected = completedEarning.value?.collectedFromCustomer ?? null;
  return collected !== null && collected > 0 ? collected : null;
});

// "Dostavljeno" se ne drži zauvijek: ako kurir ne dodirne "Nastavi", panel se
// poslije minut i po sam vraća na čekanje.
let doneTimer: ReturnType<typeof setTimeout> | null = null;
watch(showDone, (visible) => {
  if (doneTimer) clearTimeout(doneTimer);
  doneTimer = null;
  if (visible) doneTimer = setTimeout(() => (showDone.value = false), 90_000);
});
onBeforeUnmount(() => {
  if (doneTimer) clearTimeout(doneTimer);
});

// ------------------------------------------------------------------ spremnost

const { permissionState: pushState, syncPermissionState, requestPermissionAndRegister } =
  usePushNotifications();
onMounted(syncPermissionState);

const requestPush = async () => {
  await requestPermissionAndRegister();
  if (pushState.value === "granted") alerts.success("Obavještenja su uključena.");
  else if (pushState.value === "denied") {
    alerts.warning("Obavještenja su i dalje blokirana u podešavanjima pregledača.");
  }
};

const {
  enabled: soundEnabled,
  setEnabled: setSoundEnabled,
  playTestSound,
  playNewOrderSound,
} = useSoundNotifications(computed(() => courierId.value));

const toggleSound = () => {
  const next = !soundEnabled.value;
  setSoundEnabled(next);
  // Čuje se odmah: dodir je i radnja kojom se zvuk otključava u pregledaču.
  if (next) playTestSound();
};

// Zvuk i vibracija za svaku novu ponudu, ponavlja se dok čeka odgovor.
const aliveOfferIds = computed(() =>
  visibleOffers.value
    .filter((offer) => (secondsLeft(offer) ?? 1) > 0)
    .map((offer) => offer.offer_id)
);
useOfferAlert(aliveOfferIds, playNewOrderSound);

// Ekran ostaje upaljen dok traje ponuda ili dostava (inače pregledač prestane da
// šalje lokaciju); u čekanju samo ako je kurir to izabrao.
const KEEP_AWAKE_KEY = "courier-keep-awake-idle";
const keepAwakeIdle = ref(false);
onMounted(() => {
  try {
    keepAwakeIdle.value = localStorage.getItem(KEEP_AWAKE_KEY) === "1";
  } catch {
    // privatni prozor: podešavanje važi dok je stranica otvorena
  }
});
const toggleKeepAwake = () => {
  keepAwakeIdle.value = !keepAwakeIdle.value;
  try {
    localStorage.setItem(KEEP_AWAKE_KEY, keepAwakeIdle.value ? "1" : "0");
  } catch {
    // ignore
  }
};
const wakeLockWanted = computed(
  () => (panel.value !== "idle" && panel.value !== "loading") || keepAwakeIdle.value
);
const { supported: wakeLockSupported } = useWakeLock(wakeLockWanted);

// ------------------------------------------------------------------ pilula statusa

const status = computed<{ tone: "ok" | "warn" | "bad"; label: string; detail?: string | null }>(() => {
  if (gps.value === "blocked" || gps.value === "unsupported") {
    return { tone: "bad", label: "Lokacija isključena" };
  }
  if (connection.value === "offline") {
    return { tone: "warn", label: "Nema veze", detail: "pokušavam ponovo" };
  }
  if (gps.value === "weak") return { tone: "warn", label: "GPS traži signal" };
  if (gps.value === "searching") return { tone: "warn", label: "Tražim lokaciju" };
  return {
    tone: "ok",
    label: "Uživo",
    detail: courierAccuracy.value !== null ? `±${Math.round(courierAccuracy.value)} m` : null,
  };
});

const showStatusHint = () => {
  if (status.value.tone === "ok") {
    if (pushState.value === "denied" || pushState.value === "default") {
      alerts.warning("Lokacija i veza su u redu, ali obavještenja nisu uključena.");
    } else {
      alerts.info("Lokacija, veza i obavještenja su u redu.");
    }
    return;
  }
  const text =
    status.value.tone === "bad"
      ? "Lokacija je isključena. Bez nje dispečer ne vidi gdje si i ponude ti ne stižu."
      : status.value.label === "Nema veze"
        ? "Nema veze sa serverom. Ponude će stići čim se veza vrati."
        : "GPS signal je slab. Pokušavam ponovo.";
  alerts.warning(text);
};
</script>
