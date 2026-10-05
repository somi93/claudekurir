<template>
  <div ref="frame" class="dl-map" :class="{ 'dl-map--tight': compact }">
    <ClientOnly>
      <LMap
        class="dl-leaflet"
        :zoom="initialZoom"
        :center="initialCenter"
        :use-global-leaflet="false"
        :options="mapOptions"
        @ready="onMapReady"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          layer-type="base"
          name="OpenStreetMap"
          attribution="&copy; OpenStreetMap contributors"
        />

        <!-- Sljedeća etapa (restoran -> kupac dok je restoran cilj): tačkasta linija. -->
        <LPolyline
          v-if="nextLeg"
          :lat-lngs="nextLeg"
          color="#0b1220"
          :weight="3"
          :opacity="0.45"
          dash-array="2 7"
          line-cap="round"
          line-join="round"
          :interactive="false"
        />

        <!-- Ruta do trenutnog cilja: plava linija sa bijelim obodom. Tačkasta je dok
             nemamo pravu rutu (servis nedostupan), pa kurir zna da je približno. -->
        <template v-if="routeLine">
          <LPolyline
            :lat-lngs="routeLine"
            color="#ffffff"
            :weight="9"
            :opacity="1"
            line-cap="round"
            line-join="round"
            :interactive="false"
          />
          <LPolyline
            :lat-lngs="routeLine"
            color="#2f6fed"
            :weight="5"
            :opacity="1"
            :dash-array="routeApproximate ? '1 10' : undefined"
            line-cap="round"
            line-join="round"
            :interactive="false"
          />
        </template>

        <LMarker
          v-for="pin in pinMarkers"
          :key="pin.key"
          :lat-lng="pin.latLng"
          :icon="pin.icon"
          :z-index-offset="pin.dim ? 0 : 500"
          :interactive="false"
        />

        <LMarker
          v-if="courierLatLng && meIcon"
          :lat-lng="courierLatLng"
          :icon="meIcon"
          :z-index-offset="1000"
          :interactive="false"
          @ready="onMeReady"
        />
      </LMap>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import type * as Leaflet from "leaflet";
import { isFiniteLatLng, type LatLngTuple } from "~/utils/geo";
import type { CameraMode, CameraState, MapInsets, MapPin } from "~/types/deliveryMap";

type LeafletLike = Pick<typeof Leaflet, "divIcon" | "point" | "latLngBounds">;

const props = withDefaults(
  defineProps<{
    courierLocation: { latitude: number; longitude: number } | null;
    courierHeading: number | null;
    courierSpeed: number | null;
    // Poslednji fix je star (tunel, lift): marker kurira posivi.
    signalLost?: boolean;
    pins: MapPin[];
    routeLine: LatLngTuple[] | null;
    routeApproximate?: boolean;
    nextLeg?: LatLngTuple[] | null;
    insets: MapInsets;
    // Povećava se pri svakom novom koraku (ponuda, prihvatanje, preuzimanje): kamera
    // tad ponovo uklapa cijelu rutu.
    fitKey: number;
    followZoom: number;
    // Mali slobodan dio mape: oblačići sa nazivima se kriju.
    compact?: boolean;
  }>(),
  { signalLost: false, routeApproximate: false, nextLeg: null, compact: false }
);

const emit = defineEmits<{
  camera: [state: CameraState];
}>();

// Podrazumijevani centar je samo zadnja rezerva dok nema ni GPS-a ni odredišta.
// Pregled Bosne i Hercegovine: dok nema ni GPS-a ni odredišta mapa ne smije da izgleda kao da
// kurir stoji u nekom drugom gradu (ranije je ovo bio centar Beograda).
const DEFAULT_CENTER: LatLngTuple = [44.17, 17.67];
const DEFAULT_ZOOM = 7;
const FIT_MAX_ZOOM = 17;
const FIT_SECONDS = 0.8;
const FOLLOW_SECONDS = 0.25;
const FOLLOW_MIN_INTERVAL_MS = 900;
// Poslije toliko mirovanja kamera se vraća u raniji režim.
const FREE_RESUME_MS = 20_000;
// Brzina (m/s) iznad koje kurir "vozi" pa kamera sama počinje da ga prati.
const DRIVING_SPEED = 1.5;

const mapOptions = {
  zoomControl: false,
  attributionControl: false,
  zoomSnap: 0.5,
};

const initialCenter = ref<LatLngTuple>(
  props.courierLocation
    ? [props.courierLocation.latitude, props.courierLocation.longitude]
    : DEFAULT_CENTER
);
const initialZoom = ref<number>(props.courierLocation ? 16 : DEFAULT_ZOOM);

const leafletMap = shallowRef<Leaflet.Map | null>(null);
const leafletModule = shallowRef<LeafletLike | null>(null);

const courierLatLng = computed<LatLngTuple | null>(() => {
  const location = props.courierLocation;
  if (!location) return null;
  const point: LatLngTuple = [location.latitude, location.longitude];
  return isFiniteLatLng(point) ? point : null;
});

// ------------------------------------------------------------------ markeri

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });

// LMarker-ov `icon` je u @vue-leaflet tipiziran kao L.Icon, iako DivIcon (podklasa sa
// drugačijim opcijama) radi bez problema - uski cast, ne `any`.
const asIcon = (icon: Leaflet.DivIcon) => icon as unknown as Leaflet.Icon;

const PIN_PATH =
  "M19 1.5C9.3 1.5 1.5 9.1 1.5 18.6c0 12.8 17.5 27.9 17.5 27.9S36.5 31.4 36.5 18.6C36.5 9.1 28.7 1.5 19 1.5z";

// Ikonica u pinu je MDI webfont (isti kao ostatak aplikacije), oblik je SVG.
const pinHtml = (pin: MapPin) => {
  const customer = pin.kind === "customer";
  const label = pin.label?.trim();
  return (
    `<div class="dl-pin${customer ? " dl-pin--drop" : ""}${pin.dim ? " dl-pin--dim" : ""}">` +
    `<svg viewBox="0 0 38 48" width="38" height="48" aria-hidden="true">` +
    `<path d="${PIN_PATH}" fill="${customer ? "#0b1220" : "#ffc247"}" ` +
    `stroke="${customer ? "#ffffff" : "#0b1220"}" stroke-width="2.4"/></svg>` +
    `<span class="dl-pin-glyph mdi ${customer ? "mdi-home-outline" : "mdi-storefront-outline"}"></span>` +
    (label && !pin.dim ? `<span class="dl-bubble">${escapeHtml(label)}</span>` : "") +
    `</div>`
  );
};

const pinMarkers = computed(() => {
  const L = leafletModule.value;
  if (!L) return [];
  return props.pins
    .filter((pin) => isFiniteLatLng(pin.latLng))
    .map((pin) => ({
      key: pin.key,
      latLng: pin.latLng,
      dim: Boolean(pin.dim),
      icon: asIcon(
        L.divIcon({
          className: "dl-marker",
          html: pinHtml(pin),
          iconSize: [38, 48],
          iconAnchor: [19, 48],
        })
      ),
    }));
});

// Marker kurira je STABILAN (ikonica se ne pravi ponovo): strelica se okreće
// direktno u DOM-u, inače bi svaki GPS fix restartovao animaciju oko markera.
const meIcon = computed(() => {
  const L = leafletModule.value;
  if (!L) return undefined;
  return asIcon(
    L.divIcon({
      className: "dl-marker",
      html:
        `<div class="dl-me dl-me--still">` +
        `<span class="dl-me-halo"></span>` +
        `<span class="dl-me-dot"><span class="dl-me-arrow mdi mdi-navigation"></span></span>` +
        `</div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
    })
  );
});

const meMarker = shallowRef<Leaflet.Marker | null>(null);
const onMeReady = (marker: Leaflet.Marker) => {
  meMarker.value = marker;
  updateMeStyle();
};

const updateMeStyle = () => {
  const root = meMarker.value?.getElement?.()?.querySelector<HTMLElement>(".dl-me");
  if (!root) return;
  const heading = props.courierHeading;
  const speed = props.courierSpeed;
  // Smjer iz GPS-a je pouzdan tek kad se kurir kreće.
  const moving =
    heading !== null && Number.isFinite(heading) && (speed === null || speed >= 0.8);
  root.classList.toggle("dl-me--still", !moving);
  root.classList.toggle("dl-me--lost", props.signalLost);
  const arrow = root.querySelector<HTMLElement>(".dl-me-arrow");
  if (arrow && moving) arrow.style.transform = `rotate(${heading}deg)`;
};

watch(
  () => [props.courierHeading, props.courierSpeed, props.signalLost, courierLatLng.value === null],
  updateMeStyle,
  { flush: "post" }
);

// ------------------------------------------------------------------ kamera

// Odredište = pin koji je na redu (nije prigušen). Prigušen "sljedeći cilj" (kupac dok je restoran
// cilj) ne mijenja kameru: restoran bez koordinata ostavlja kurira bez odredišta, pa kamera prati njega.
const hasTarget = computed(() => props.pins.some((pin) => !pin.dim));

// Bez odredišta (čekanje) kamera prati kurira; sa odredištem uklapa cijelu rutu.
const mode = ref<CameraMode>(hasTarget.value ? "fit" : "follow");
const free = ref(false);
let modeBeforeFree: CameraMode = mode.value;
// Kurir je sam dodirnuo "Cijela ruta": ne preskačemo na praćenje čim krene.
let userPinnedFit = false;
let placed = false;
let lastFollowAt = 0;
let drivingTicks = 0;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let insetsTimer: ReturnType<typeof setTimeout> | null = null;

const emitCamera = () => emit("camera", { mode: mode.value, free: free.value });

const mapIsLaidOut = (map: Leaflet.Map) => {
  const size = map.getSize();
  return size.x > 40 && size.y > 40;
};

// Pomak (u pikselima) od sredine mape do sredine VIDLJIVOG dijela mape.
const visibleOffset = (map: Leaflet.Map, L: LeafletLike) => {
  const size = map.getSize();
  const { top, right, bottom, left } = props.insets;
  const visibleW = Math.max(80, size.x - left - right);
  const visibleH = Math.max(80, size.y - top - bottom);
  return L.point(left + visibleW / 2 - size.x / 2, top + visibleH / 2 - size.y / 2);
};

const centerOn = (latLng: LatLngTuple, zoom: number, animate: boolean) => {
  const map = leafletMap.value;
  const L = leafletModule.value;
  if (!map || !L || !mapIsLaidOut(map)) return;
  try {
    const target = map.project(latLng, zoom).subtract(visibleOffset(map, L));
    map.setView(map.unproject(target, zoom), zoom, { animate, duration: FOLLOW_SECONDS });
  } catch (error) {
    console.warn("Preskačem pomjeranje mape:", error);
  }
};

const fitPoints = (): LatLngTuple[] => {
  const points: LatLngTuple[] = [];
  if (courierLatLng.value) points.push(courierLatLng.value);
  for (const pin of props.pins) {
    if (!pin.dim && isFiniteLatLng(pin.latLng)) points.push(pin.latLng);
  }
  return points;
};

const applyFit = (animate: boolean) => {
  const map = leafletMap.value;
  const L = leafletModule.value;
  if (!map || !L || !mapIsLaidOut(map)) return;
  const points = fitPoints();
  if (points.length === 0) return;
  try {
    if (points.length === 1) {
      centerOn(points[0]!, 16, animate);
      return;
    }
    const { top, right, bottom, left } = props.insets;
    map.flyToBounds(L.latLngBounds(points), {
      paddingTopLeft: [left, top],
      paddingBottomRight: [right, bottom],
      maxZoom: FIT_MAX_ZOOM,
      duration: FIT_SECONDS,
      animate,
    });
  } catch (error) {
    // Leaflet baca iznutra ako kontejner nema dimenzije (prije prvog rasporeda).
    console.warn("Preskačem uklapanje mape:", error);
  }
};

const applyFollow = (animate: boolean) => {
  if (!courierLatLng.value) return;
  lastFollowAt = Date.now();
  centerOn(courierLatLng.value, props.followZoom, animate);
};

// Primjenjuje trenutni režim. `animate` = false za prvi smještaj kamere (skok sa
// podrazumijevanog centra na kurira ne smije da bude animacija preko pola kontinenta).
const applyCamera = (animate = true) => {
  const map = leafletMap.value;
  if (!map || !leafletModule.value || free.value || !mapIsLaidOut(map)) return;
  const shouldAnimate = animate && placed;
  if (mode.value === "follow" && courierLatLng.value) applyFollow(shouldAnimate);
  else applyFit(shouldAnimate);
  if (fitPoints().length > 0) placed = true;
};

const clearResume = () => {
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = null;
};

const fitRoute = (source: "user" | "auto" = "user") => {
  mode.value = "fit";
  free.value = false;
  userPinnedFit = source === "user";
  drivingTicks = 0;
  clearResume();
  emitCamera();
  applyCamera(true);
};

const followMe = (source: "user" | "auto" = "user") => {
  mode.value = "follow";
  free.value = false;
  userPinnedFit = false;
  clearResume();
  emitCamera();
  // "user" = Centriraj: odmah, bez čekanja na minimalni razmak.
  lastFollowAt = 0;
  applyCamera(source === "user" || placed);
};

// Kurir povuče ili zumira mapu: kamera miruje, "Centriraj" pulsira, a poslije
// FREE_RESUME_MS bez dodira vraća se u raniji režim.
const armResume = () => {
  clearResume();
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    if (!free.value) return;
    free.value = false;
    mode.value = modeBeforeFree;
    emitCamera();
    applyCamera(true);
  }, FREE_RESUME_MS);
};

const enterFree = () => {
  if (!free.value) {
    modeBeforeFree = mode.value;
    free.value = true;
    emitCamera();
  }
  armResume();
};

let detachContainerEvents: (() => void) | null = null;

const onMapReady = (map: Leaflet.Map) => {
  leafletMap.value = map;
  map.on("dragstart", enterFree);
  map.on("dragend", armResume);

  const container = map.getContainer();
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length > 1) enterFree();
  };
  container.addEventListener("wheel", enterFree, { passive: true });
  container.addEventListener("dblclick", enterFree);
  container.addEventListener("touchstart", onTouchStart, { passive: true });
  detachContainerEvents = () => {
    map.off("dragstart", enterFree);
    map.off("dragend", armResume);
    container.removeEventListener("wheel", enterFree);
    container.removeEventListener("dblclick", enterFree);
    container.removeEventListener("touchstart", onTouchStart);
  };

  emitCamera();
  applyCamera(false);
};

// Kamera se ponovo smješta kad se Leaflet učita, kad stigne prvi GPS fix i kad
// se promijene odredišta. Prije je u ovom spisku nedostajao `leafletModule`, pa je
// poziv koji stigne dok modul još nije spreman bio izgubljen (mapa je ostajala na
// podrazumijevanom centru).
watch([leafletMap, leafletModule], () => applyCamera(false), { flush: "post" });

watch(
  () => courierLatLng.value === null,
  (nowEmpty, wasEmpty) => {
    // Prvi GPS fix: smjesti kameru odmah (bez animacije preko cijele mape).
    if (wasEmpty && !nowEmpty) applyCamera(false);
  },
  { flush: "post" }
);

const pinSignature = computed(() =>
  props.pins
    .map((pin) => `${pin.key}:${pin.latLng[0].toFixed(5)},${pin.latLng[1].toFixed(5)}:${pin.dim ? 1 : 0}`)
    .join("|")
);

watch(
  [pinSignature, hasTarget],
  ([, target], [, hadTarget]) => {
    // Nema više odredišta (čekanje): prati kurira. Inače uklopi nove tačke.
    if (!target) {
      if (hadTarget) followMe("auto");
      return;
    }
    if (!hadTarget) fitRoute("auto");
    else if (mode.value === "fit") applyCamera(true);
  },
  { flush: "post" }
);

// Novi korak (ponuda, prihvatanje, preuzimanje): cijela ruta, a bez odredišta (restoran bez
// koordinata, čekanje) kamera samo prati kurira.
watch(
  () => props.fitKey,
  () => (hasTarget.value ? fitRoute("auto") : followMe("auto")),
  { flush: "post" }
);

// Na svako GPS fiksiranje (courierLatLng je novi niz pri svakom fiksu, i kad je brzina ista):
// - kurir vozi (brzina >= DRIVING_SPEED tri fiksa zaredom): kamera iz "cijele rute" sama
//   prelazi na praćenje, osim ako je kurir sam izabrao cijelu rutu;
// - praćenje: najviše jednom u sekundi, samo dok kamera nije slobodna.
watch(courierLatLng, () => {
  const speed = props.courierSpeed;
  if (
    mode.value === "fit" &&
    !free.value &&
    !userPinnedFit &&
    hasTarget.value &&
    speed !== null &&
    speed >= DRIVING_SPEED
  ) {
    drivingTicks += 1;
    if (drivingTicks >= 3) {
      followMe("auto");
      return;
    }
  } else if (mode.value === "fit") {
    drivingTicks = 0;
  }

  if (mode.value !== "follow" || free.value) return;
  if (Date.now() - lastFollowAt < FOLLOW_MIN_INTERVAL_MS) return;
  applyFollow(true);
});

// Panel se širi/skuplja: ponovo uklopi kadar u preostali prostor (kratak debounce
// jer panel animira visinu).
watch(
  [
    () => props.insets.top,
    () => props.insets.right,
    () => props.insets.bottom,
    () => props.insets.left,
  ],
  () => {
    if (insetsTimer) clearTimeout(insetsTimer);
    insetsTimer = setTimeout(() => {
      insetsTimer = null;
      applyCamera(true);
    }, 150);
  }
);

let resizeObserver: ResizeObserver | null = null;
const frame = ref<HTMLElement | null>(null);

onMounted(async () => {
  // ISTA kopija Leaflet-a kao u vue-leaflet (leaflet-src.esm). "leaflet" bi učitao
  // UMD build, pa bi `flyToBounds` uvijek bacao grešku.
  const mod = await import("leaflet/dist/leaflet-src.esm");
  leafletModule.value = ((mod as { default?: unknown }).default ?? mod) as unknown as LeafletLike;

  if (typeof ResizeObserver !== "undefined" && frame.value) {
    resizeObserver = new ResizeObserver(() => {
      leafletMap.value?.invalidateSize();
      applyCamera(false);
    });
    resizeObserver.observe(frame.value);
  }
});

onBeforeUnmount(() => {
  clearResume();
  if (insetsTimer) clearTimeout(insetsTimer);
  resizeObserver?.disconnect();
  detachContainerEvents?.();
});

defineExpose({ fitRoute, followMe });
</script>
