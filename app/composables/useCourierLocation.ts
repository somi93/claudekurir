import { onBeforeUnmount, onMounted, ref, type ComputedRef } from "vue";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import { sendCourierLocation as sendCourierLocationRequest } from "~/services/courierLocationService";
import type { CourierLocationPayload } from "~/types/courier";

// Poslije privremene greške, toliko čekamo na novi fix prije nego što ponovo
// podignemo watchPosition.
const RECOVERY_RESTART_MS = 10_000;

export const useCourierLocation = (
  courierId: ComputedRef<number>,
  hasActiveOrder: ComputedRef<boolean>
) => {
  const alertStore = useAlertStore();

  const courierLocation = ref<{ latitude: number; longitude: number } | null>(null);
  const courierAccuracy = ref<number | null>(null);
  const courierSpeed = ref<number | null>(null);
  const courierHeading = ref<number | null>(null);
  const streamingActive = ref(false);
  // Privremeni gubitak signala (tunel, lift, garaža, istek čekanja): praćenje se
  // NE gasi - pregledač nastavlja da javlja nove fiksove - samo se označi da
  // zadnji nije svjež. Prvi sljedeći fix ga vraća na false.
  const signalLost = ref(false);
  const lastFixAt = ref<number | null>(null);
  // Specifično "lokacija je blokirana/nedostupna" stanje (dozvola odbijena /
  // browser ne podržava), da UI može da prikaže trajnu poruku sa akcijom. Privremene
  // greške (tunel, lift) ovo NE diraju - samo postave `signalLost`.
  const locationBlocked = ref(false);
  const locationBlockedReason = ref<"denied" | "unsupported" | null>(null);

  // GPS se šalje na svaku poziciju (i do jednom u par sekundi) - da server
  // hiccup ne spamuje alert na svaki pokušaj, prijavljujemo samo prvi put dok
  // se greška ne promeni ili dok sledeći uspešan POST ne resetuje praćenje.
  let lastReportedError = "";
  const reportError = (error: unknown, fallback: string) => {
    const message = toFriendlyErrorMessage(error, fallback);
    if (message !== lastReportedError) {
      lastReportedError = message;
      alertStore.error(message);
    }
  };

  let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  const clearRecoveryTimer = () => {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = null;
  };

  const sendCourierLocation = async (position: GeolocationPosition) => {
    const payload: CourierLocationPayload = {
      driver_id: courierId.value,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
      altitude: position.coords.altitude,
      battery: null,
      status: hasActiveOrder.value ? "delivering" : "online",
      timestamp: new Date(position.timestamp).toISOString(),
    };

    courierLocation.value = {
      latitude: payload.latitude,
      longitude: payload.longitude,
    };
    courierAccuracy.value = payload.accuracy ?? null;
    courierSpeed.value = payload.speed ?? null;
    courierHeading.value = payload.heading ?? null;
    locationBlocked.value = false;
    locationBlockedReason.value = null;
    // Svaki uspješan fix vraća praćenje u normalno stanje - ranije je jedna
    // privremena greška trajno gasila režim navigacije (strelica -> tačka).
    streamingActive.value = true;
    signalLost.value = false;
    lastFixAt.value = Date.now();
    clearRecoveryTimer();

    try {
      await sendCourierLocationRequest(payload);
      lastReportedError = "";
    } catch (error) {
      reportError(error, "Ne mogu da pošaljem lokaciju.");
    }
  };

  let geolocationWatchId: number | null = null;

  // Prvi fix od watchPosition(enableHighAccuracy: true) ume da potraje
  // (loš signal, hladan GPS) - dok se čeka, ruta ne može da se izračuna jer
  // courierLocation ostaje null. Ovaj brzi (network/coarse) fix je skoro
  // trenutan i samo seeduje početnu poziciju dok precizni stream ne stigne.
  const seedInitialPosition = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!courierLocation.value) {
          sendCourierLocation(position);
        }
      },
      () => {
        // Tiho ignoriši - watchPosition ispod prijavljuje prave greške korisniku.
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 }
    );
  };

  const startLocationStreaming = () => {
    if (!navigator.geolocation) {
      alertStore.error("Geolokacija nije dostupna u ovom browseru.");
      locationBlocked.value = true;
      locationBlockedReason.value = "unsupported";
      return;
    }

    if (geolocationWatchId !== null) {
      navigator.geolocation.clearWatch(geolocationWatchId);
    }

    if (!courierLocation.value) seedInitialPosition();

    streamingActive.value = true;
    geolocationWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        await sendCourierLocation(position);
      },
      (error) => {
        // PERMISSION_DENIED = 1 - korisnik je odbio dozvolu, praćenje je stvarno
        // stalo i to je trajni baner / pilula. Sve ostalo (POSITION_UNAVAILABLE,
        // TIMEOUT) je privremeno: praćenje ostaje uključeno, a ako novi fix ne
        // stigne za 10 s, watch se podiže ponovo (neki pregledači ga ne oporave).
        if (error.code === error.PERMISSION_DENIED) {
          streamingActive.value = false;
          locationBlocked.value = true;
          locationBlockedReason.value = "denied";
          return;
        }
        signalLost.value = true;
        clearRecoveryTimer();
        recoveryTimer = setTimeout(() => {
          recoveryTimer = null;
          if (signalLost.value && geolocationWatchId !== null) startLocationStreaming();
        }, RECOVERY_RESTART_MS);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );
  };

  const stopLocationStreaming = async () => {
    if (geolocationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geolocationWatchId);
    }

    geolocationWatchId = null;
    streamingActive.value = false;
    clearRecoveryTimer();

    if (courierLocation.value) {
      try {
        await sendCourierLocationRequest({
          driver_id: courierId.value,
          latitude: courierLocation.value.latitude,
          longitude: courierLocation.value.longitude,
          status: "offline",
        });
      } catch {
        // best-effort — kurir je ionako otišao offline lokalno
      }
    }
  };

  const toggleLocationStreaming = () => {
    if (streamingActive.value) {
      stopLocationStreaming();
    } else {
      startLocationStreaming();
    }
  };

  // Kurir je dozvolu uključio u podešavanjima pregledača i vratio se na stranicu:
  // praćenje kreće samo, bez dodira na "Uključi".
  let permissionStatus: PermissionStatus | null = null;
  const watchPermission = async () => {
    try {
      if (!navigator.permissions?.query) return;
      permissionStatus = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      permissionStatus.onchange = () => {
        if (permissionStatus?.state === "granted" && locationBlocked.value) {
          startLocationStreaming();
        }
      };
    } catch {
      // Permissions API nije dostupan - ostaje dugme "Uključi".
    }
  };

  onMounted(() => {
    startLocationStreaming();
    void watchPermission();
  });

  onBeforeUnmount(() => {
    if (permissionStatus) permissionStatus.onchange = null;
    stopLocationStreaming();
  });

  return {
    courierLocation,
    courierAccuracy,
    courierSpeed,
    courierHeading,
    streamingActive,
    signalLost,
    lastFixAt,
    locationBlocked,
    locationBlockedReason,
    toggleLocationStreaming,
    retryLocationStreaming: startLocationStreaming,
  };
};
