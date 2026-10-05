import { ref } from "vue";
import { useAppConfig, useNuxtApp } from "nuxt/app";
import { useAlertStore } from "~/stores/alert";

// Web push (FCM) - uzme token od Firebase-a i posalje ga na kurirski API
// (POST /push-tokens -> deljena `devices` tabela). `registerDevice()` se zove
// posle prijave i pri svakom otvaranju aplikacije dok je korisnik ulogovan
// (vidi plugins/push.client.ts), ali SAMO tiho registruje - ne trazi dozvolu
// od browsera ako je ona jos neodlucena ("default"), da korisnika ne bi
// docekao browser-ov dijalog bez konteksta odmah po prijavi. Samu dozvolu
// trazi tek `requestPermissionAndRegister()`, pozvano iz eksplicitnog klika
// korisnika (vidi components/common/PushPermissionBanner.vue). Deregistruje
// se pri odjavi (stores/session.ts#logout).
//
// Sve je best-effort: nijedna greska ovde ne sme da prekine prijavu ni rad
// aplikacije. Ako browser ne podrzava push, ako je dozvola odbijena ili
// Firebase config nije popunjen - preskace se (u dev modu se razlog ispise
// u konzolu pod "[push]").

const LAST_TOKEN_KEY = "push-token-last-registered";
const PLATFORM_NAME = "web";

// --- Katalog push događaja + mini event-bus ---
//
// Dok backend ne isporuči dokumentovan `data.type` enum (otvoreno pitanje 2.6),
// ovdje je radna lista tipova koje očekujemo. Za svaki: da li je warning ili
// info toast, i emit na interni bus da zainteresovani composable (npr.
// useCourierOffers) može odmah da reaguje umjesto da čeka svoj poll.
type PushListener = (data: Record<string, string>) => void;
const pushListeners = new Map<string, Set<PushListener>>();

// Vrati odjavnu funkciju - pozivalac je zove u onBeforeUnmount.
export const onPushEvent = (type: string, listener: PushListener): (() => void) => {
  const set = pushListeners.get(type) ?? new Set<PushListener>();
  set.add(listener);
  pushListeners.set(type, set);
  return () => set.delete(listener);
};

// Pretplata na SVE foreground push-eve, bez obzira na `data.type` - npr. da se
// osvježi broj nepročitanih poruka, jer backend još nije dokumentovao tip za
// inbox poruku (vidi docs/2026/10/03_10_2026_Frontend_pitanja_za_backend.textile).
const ANY_PUSH_TYPE = "*";
export const onAnyPushEvent = (listener: PushListener): (() => void) =>
  onPushEvent(ANY_PUSH_TYPE, listener);

const emitPushEvent = (type: string, data: Record<string, string>): void => {
  pushListeners.get(type)?.forEach((listener) => {
    try {
      listener(data);
    } catch (error) {
      log("greška u push listeneru (ignorisano):", error);
    }
  });
};

// Tipovi za koje je warning toast prikladniji od info (nešto visi / blokira).
const WARNING_PUSH_TYPES = new Set([
  "cash_limit_reached",
  "order_unassigned_timeout",
  "order_pending_restaurant",
]);

export type PushPermissionState = NotificationPermission | "unsupported";

// Deljeno izmedju svih poziva usePushNotifications() (isti obrazac kao
// messagingPromise/inFlight ispod) - PushPermissionBanner.vue cita ovaj ref
// da zna da li da prikaze soft-ask ili "blokirano" traku.
const permissionState = ref<PushPermissionState>("unsupported");

// Dijagnostika - u dev modu ispisuje zasto je (ili nije) registracija tokena
// otisla dalje. Bez ovoga je sve tiho pa "nista se ne desi" na prijavi izgleda
// kao bug, a najcesce fali `vapidKey` u app/app.config.ts.
const log = (...args: unknown[]): void => {
  if (import.meta.dev) console.info("[push]", ...args);
};
// Firebase projekat - jedini koji kurirski backend ume da posalje (vidi
// App\Enums\DeviceKind: 'ordera-e6eb8' => kind 1).
const FIREBASE_KIND = "ordera-e6eb8";

// Firebase app + messaging se inicijalizuju jednom po ucitavanju stranice.
let messagingPromise: Promise<import("firebase/messaging").Messaging | null> | null = null;
let inFlight: Promise<void> | null = null;
let foregroundBound = false;

const canUsePush = (): boolean => {
  if (!import.meta.client) return false;
  if (!window.isSecureContext) {
    log("preskacem: stranica nije secure context (treba https ili localhost)");
    return false;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    log("preskacem: browser ne podrzava Web push (Notification / serviceWorker / PushManager)");
    return false;
  }
  return true;
};

export const usePushNotifications = () => {
  const { $api } = useNuxtApp();
  // Build-time konstante iz app/app.config.ts (nema .env-a - jedan Firebase
  // projekat, nema staging).
  const config = useAppConfig().firebase;

  const hasConfig = (): boolean => {
    const missing = (["apiKey", "appId", "messagingSenderId", "vapidKey"] as const).filter(
      (key) => !config[key]
    );
    if (missing.length) {
      log(
        `preskacem: Firebase config nepotpun, fali ${missing
          .map((k) => `firebase.${k}`)
          .join(", ")} u app/app.config.ts`
      );
      return false;
    }
    return true;
  };

  const registerServiceWorker = (): Promise<ServiceWorkerRegistration> => {
    // Config ide u query string jer service worker ne moze da cita app.config
    // (vidi public/firebase-messaging-sw.js).
    const params = new URLSearchParams({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
  };

  const getMessaging = (): Promise<import("firebase/messaging").Messaging | null> => {
    if (!messagingPromise) {
      messagingPromise = (async () => {
        const [{ initializeApp, getApps }, messagingMod] = await Promise.all([
          import("firebase/app"),
          import("firebase/messaging"),
        ]);

        if (!(await messagingMod.isSupported())) return null;

        const app =
          getApps()[0] ??
          initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          });

        return messagingMod.getMessaging(app);
      })().catch(() => null);
    }
    return messagingPromise;
  };

  const bindForegroundHandler = async (messaging: import("firebase/messaging").Messaging) => {
    if (foregroundBound) return;
    foregroundBound = true;

    const { onMessage } = await import("firebase/messaging");
    const alerts = useAlertStore();

    onMessage(messaging, (payload) => {
      const type = payload.data?.type;
      // Emit na interni bus PRIJE toasta - composable (useCourierOffers i sl.)
      // tada može da povuče svježe stanje bez čekanja na svoj poll.
      const data = (payload.data ?? {}) as Record<string, string>;
      if (type) emitPushEvent(type, data);
      emitPushEvent(ANY_PUSH_TYPE, data);

      const text = [payload.notification?.title, payload.notification?.body]
        .filter(Boolean)
        .join(" — ");
      if (!text) return;
      // Neki događaji (limit gotovine dostignut, narudžba/restoran visi) su
      // upozorenje, ostalo je info. Vidi WARNING_PUSH_TYPES + pitanje 2.6.
      if (type && WARNING_PUSH_TYPES.has(type)) {
        alerts.warning(text);
      } else {
        alerts.info(text);
      }
    });
  };

  const syncPermissionState = (): void => {
    permissionState.value = canUsePush() && hasConfig() ? Notification.permission : "unsupported";
  };

  // Tiha registracija - NE trazi dozvolu ako je jos neodlucena ("default").
  // Ako je vec "granted" (ili je upravo dobijena preko
  // requestPermissionAndRegister), uzima/osvezava token i salje ga backendu.
  const registerDevice = async (): Promise<void> => {
    syncPermissionState();
    if (!canUsePush() || !hasConfig()) return;
    if (Notification.permission !== "granted") {
      log("preskacem: dozvola za notifikacije nije data (", Notification.permission, ")");
      return;
    }
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const [messaging, registration] = await Promise.all([
          getMessaging(),
          registerServiceWorker(),
        ]);
        if (!messaging) {
          log("preskacem: firebase/messaging nije podrzan u ovom browseru");
          return;
        }

        const { getToken } = await import("firebase/messaging");
        const token = await getToken(messaging, {
          vapidKey: config.vapidKey,
          serviceWorkerRegistration: registration,
        });
        if (!token) {
          log("preskacem: Firebase nije vratio token");
          return;
        }

        await bindForegroundHandler(messaging);

        // Uvek posaljemo na backend (updateOrCreate po tokenu - kreira ako ne
        // postoji, osvezi user_id/name/kind ako postoji). LAST_TOKEN_KEY je
        // samo info za log; backend poziv je jeftin i idempotentan.
        const unchanged = localStorage.getItem(LAST_TOKEN_KEY) === token;
        log(unchanged ? "token nepromenjen, saljem na backend radi provere" : "novi token, saljem na backend", `${token.slice(0, 12)}…`);

        await $api("/push-tokens", {
          method: "POST",
          body: { token, name: PLATFORM_NAME, kind: FIREBASE_KIND },
        });
        localStorage.setItem(LAST_TOKEN_KEY, token);
        log("token registrovan na backendu");
      } catch (error) {
        log("greska pri registraciji tokena (ignorisano):", error);
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  };

  // Eksplicitni zahtev za dozvolu - poziva se SAMO iz korisnikove akcije
  // (klik na dugme u PushPermissionBanner.vue), nikad automatski, jer
  // requestPermission() otvara browser-ov nativni dijalog. Ako je dozvola
  // vec "denied", browser dijalog ne prikazuje ponovo (samo tiho vrati
  // "denied") - korisnik tada mora rucno da je promeni u podesavanjima
  // sajta; permissionState se svakako osvezi da banner ostane tacan.
  const requestPermissionAndRegister = async (): Promise<void> => {
    if (!canUsePush() || !hasConfig()) return;

    try {
      const permission = await Notification.requestPermission();
      log("dozvola za notifikacije:", permission);
      permissionState.value = permission;
      if (permission === "granted") {
        await registerDevice();
      }
    } catch (error) {
      log("greska pri trazenju dozvole (ignorisano):", error);
    }
  };

  // Pozvati PRE nego sto se obrise sesija/token - API DELETE trazi Bearer token.
  const unregisterDevice = async (): Promise<void> => {
    if (!canUsePush() || !hasConfig()) return;

    try {
      const messaging = await getMessaging();
      if (!messaging) return;

      const registration = await navigator.serviceWorker.getRegistration();
      const { getToken, deleteToken } = await import("firebase/messaging");
      const token = await getToken(messaging, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: registration ?? undefined,
      }).catch(() => null);

      if (token) {
        await $api("/push-tokens", { method: "DELETE", body: { token } }).catch(() => undefined);
        await deleteToken(messaging).catch(() => undefined);
      }
      localStorage.removeItem(LAST_TOKEN_KEY);
    } catch {
      // best-effort
    }
  };

  return {
    registerDevice,
    unregisterDevice,
    canUsePush,
    hasConfig,
    permissionState,
    syncPermissionState,
    requestPermissionAndRegister,
  };
};
