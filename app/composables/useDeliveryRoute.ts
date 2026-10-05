import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from "vue";
import { fetchRoute as fetchRouteRequest } from "~/services/deliveryRouteService";
import type { RoutingVehicle } from "~/types/courier";
import {
  distanceMeters,
  polylineLengthMeters,
  remainingRoute,
  type LatLngTuple,
} from "~/utils/geo";

// Novi cilj / vozilo se grupišu (kratak debounce), ali prvi zahtjev ide odmah.
const DEBOUNCE_MS = 300;
// Najviše 2 poziva u minuti: ponovno traženje rute nikad češće od 30 s.
const MIN_REFETCH_MS = 30_000;
// Ruta se osvježava tek kad se kurir pomjerio više od ovoga od mjesta na kojem je
// zatražena, ili kad je skrenuo sa nje (OFF_ROUTE_M).
const MOVED_REFETCH_M = 100;
const OFF_ROUTE_M = 60;
// Ispod ovog odstupanja linija počinje tačno ispod markera kurira; iznad se
// kurir spaja sa rutom pravom linijom (vidi routeLine).
const ON_ROUTE_M = 25;

export const formatRouteDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
};

export const formatRouteDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

export const useDeliveryRoute = (
  courierLocation: Ref<{ latitude: number; longitude: number } | null>,
  destination: ComputedRef<[number, number] | null>,
  vehicle: Ref<RoutingVehicle> | ComputedRef<RoutingVehicle>
) => {
  // Cijela geometrija iz posljednjeg odgovora ([lat, lng]) i ukupni zbirovi.
  const routedGeometry = ref<LatLngTuple[]>([]);
  const routeInfo = ref<{ distance: number; duration: number } | null>(null);
  const routeLoading = ref(false);
  // true = posljednji zahtjev je pao (nema tačne rute, prikaz je približan).
  const routeFailed = ref(false);

  const locationPoint = computed<LatLngTuple | null>(() =>
    courierLocation.value
      ? [courierLocation.value.latitude, courierLocation.value.longitude]
      : null
  );

  // Dio rute ISPRED kurira. Pređeni dio se ne crta, a udaljenost i vrijeme se
  // smanjuju sa svakim GPS fiksiranjem - ne čekaju novi odgovor servisa.
  const ahead = computed(() => {
    if (!locationPoint.value || routedGeometry.value.length < 2) return null;
    return remainingRoute(locationPoint.value, routedGeometry.value);
  });

  const routeLine = computed<LatLngTuple[] | null>(() => {
    if (ahead.value && locationPoint.value) {
      return ahead.value.offRoute > ON_ROUTE_M
        ? [locationPoint.value, ...ahead.value.line]
        : ahead.value.line;
    }
    if (!locationPoint.value || !destination.value) return null;
    return [locationPoint.value, destination.value];
  });

  const routeApproximate = computed(() => !ahead.value);

  const routeDistanceMeters = computed<number | null>(() => {
    if (ahead.value) {
      return ahead.value.meters + (ahead.value.offRoute > ON_ROUTE_M ? ahead.value.offRoute : 0);
    }
    if (locationPoint.value && destination.value) {
      return distanceMeters(locationPoint.value, destination.value);
    }
    return null;
  });

  const routeDurationSeconds = computed<number | null>(() => {
    if (!ahead.value || !routeInfo.value) return null;
    const total = polylineLengthMeters(routedGeometry.value);
    if (total <= 0) return routeInfo.value.duration;
    const ratio = Math.min(1, routeDistanceMeters.value! / total);
    return routeInfo.value.duration * ratio;
  });

  const routeDistanceLabel = computed(() =>
    routeDistanceMeters.value === null ? null : formatRouteDistance(routeDistanceMeters.value)
  );

  const routeDurationLabel = computed(() =>
    routeDurationSeconds.value === null ? null : formatRouteDuration(routeDurationSeconds.value)
  );

  let abortController: AbortController | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFetchAt = 0;
  let lastFetchOrigin: LatLngTuple | null = null;

  const clearRoute = () => {
    abortController?.abort();
    abortController = null;
    routedGeometry.value = [];
    routeInfo.value = null;
    routeFailed.value = false;
    routeLoading.value = false;
    lastFetchAt = 0;
    lastFetchOrigin = null;
  };

  const fetchRouteNow = async () => {
    const origin = locationPoint.value;
    const target = destination.value;
    if (!origin || !target) {
      clearRoute();
      return;
    }

    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    lastFetchAt = Date.now();
    lastFetchOrigin = origin;
    routeLoading.value = true;

    try {
      const response = await fetchRouteRequest(
        {
          start_lat: origin[0],
          start_lng: origin[1],
          end_lat: target[0],
          end_lng: target[1],
          vehicle: vehicle.value,
        },
        controller.signal
      );
      // Ignoriši odgovor ako je u međuvremenu stigao noviji zahtjev.
      if (controller.signal.aborted) return;
      routedGeometry.value = (response.geometry ?? []).map(
        ([lng, lat]: [number, number]) => [lat, lng] as LatLngTuple
      );
      routeInfo.value = { distance: response.distance, duration: response.duration };
      routeFailed.value = false;
    } catch {
      if (controller.signal.aborted) return;
      // Pad servisa ne briše staru rutu koja još važi (kurir se samo pomjerio) -
      // brišemo je tek ako je ovo bio prvi zahtjev za ovaj cilj.
      if (routedGeometry.value.length === 0) routeInfo.value = null;
      routeFailed.value = true;
    } finally {
      if (abortController === controller) routeLoading.value = false;
    }
  };

  // Prvi zahtjev (još nema rute za ovaj cilj) ide odmah; promjene cilja i
  // vozila se debounce-uju da se ne šalju dva zahtjeva za jednu promjenu.
  let hasFetchedOnce = false;

  const fetchRoute = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!locationPoint.value || !destination.value) {
      clearRoute();
      hasFetchedOnce = false;
      return;
    }
    if (!hasFetchedOnce) {
      hasFetchedOnce = true;
      void fetchRouteNow();
      return;
    }
    debounceTimer = setTimeout(() => void fetchRouteNow(), DEBOUNCE_MS);
  };

  // Poziva se na svako GPS fiksiranje (i do jednom u sekundi): odlučuje da li je
  // vrijeme za novi zahtjev. Skrenuo si sa rute -> traži novu; inače tek kad si
  // se pomjerio dovoljno od mjesta posljednjeg zahtjeva. Nikad češće od 30 s.
  const maybeRefetch = (point: LatLngTuple) => {
    if (!destination.value || routeLoading.value) return;
    if (Date.now() - lastFetchAt < MIN_REFETCH_MS) return;

    if (routedGeometry.value.length < 2) {
      // Nema rute (zahtjev je pao) - pokušaj ponovo čim prođe interval.
      void fetchRouteNow();
      return;
    }
    const off = ahead.value?.offRoute ?? 0;
    const moved = lastFetchOrigin ? distanceMeters(lastFetchOrigin, point) : Infinity;
    if (off > OFF_ROUTE_M || moved > MOVED_REFETCH_M) void fetchRouteNow();
  };

  watch(destination, (current, previous) => {
    // `destination` se računa iz naloga, a nalog se na svakih 15 s zamijeni
    // novim objektom - isti cilj stiže kao novi niz. Samo prava promjena
    // koordinata (novi nalog, restoran -> kupac) smije da obori rutu.
    if (
      current &&
      previous &&
      current[0] === previous[0] &&
      current[1] === previous[1]
    ) {
      return;
    }
    // Stara geometrija pripada drugom cilju - ne smije da ostane na mapi.
    routedGeometry.value = [];
    routeInfo.value = null;
    routeFailed.value = false;
    lastFetchAt = 0;
    fetchRoute();
  });
  watch(courierLocation, (current, previous) => {
    if (!current) return;
    if (!previous) {
      fetchRoute();
      return;
    }
    maybeRefetch([current.latitude, current.longitude]);
  });
  // Profil kurira (i time vozilo) se učitava asinhrono poslije mount-a - kad
  // stigne, ponovo zatraži rutu da ne ostane zaglavljena na "foot" fallback-u.
  watch(vehicle, () => {
    lastFetchAt = 0;
    fetchRoute();
  });

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    abortController?.abort();
  });

  return {
    routedGeometry,
    routeLine,
    routeApproximate,
    routeLoading,
    routeFailed,
    routeDistanceMeters,
    routeDurationSeconds,
    routeDistanceLabel,
    routeDurationLabel,
    refreshRoute: () => {
      lastFetchAt = 0;
      hasFetchedOnce = true;
      return fetchRouteNow();
    },
  };
};
