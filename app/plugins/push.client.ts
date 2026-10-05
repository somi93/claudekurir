import { watch } from "vue";
import { defineNuxtPlugin, navigateTo } from "nuxt/app";
import { useSessionStore } from "~/stores/session";
import { usePushNotifications } from "~/composables/usePushNotifications";

// Koliko cesto se token ponovo salje backendu dok je tab otvoren. Firebase
// ume da tiho poništi push subscription (service worker update, browser
// izbaci SW posle sati neaktivnosti taba...) bez da stranica to ikako
// primeti - getToken() je jedini nacin da se to otkrije, a bez periodicnog
// poziva token u `devices` tabeli ostaje "validan" zauvek dok FCM stvarno ne
// odbije slanje (vidi FcmService::STALE_TOKEN_ERROR_CODES na backendu).
// Vidjeno u praksi: token mrtav ~6.5h posle registracije na dugo otvorenom
// tabu - sat vremena je dovoljno cest interval da se to ne oseti.
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

// Registruje FCM token cim je korisnik ulogovan - i posle same prijave
// (pages/login.vue) i posle refresh-a stranice dok sesija traje. Session store
// popunjava `user` iz middleware/auth.global.ts (ensureUser -> /me), pa se ovaj
// watcher okine tek kad znamo ko je korisnik.
//
// Deregistracija pri odjavi ide iz stores/session.ts#logout (dok Bearer token
// jos vazi), ne odavde.
//
// runWithContext: watcher callback vise nije u setup kontekstu, a
// usePushNotifications zove useNuxtApp()/useAppConfig().
export default defineNuxtPlugin((nuxtApp) => {
  const session = useSessionStore();

  // Klik na push notifikaciju dok je aplikacija otvorena: service worker je
  // fokusira i šalje putanju (vidi public/firebase-messaging-sw.js,
  // notificationclick). Samo putanje unutar aplikacije; ako korisnik nije
  // prijavljen, auth middleware ga šalje na /login.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type !== "notification-click" || typeof data.url !== "string") return;
      if (!data.url.startsWith("/") || data.url.startsWith("//")) return;
      void navigateTo(data.url);
    });
  }

  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  const runRegisterDevice = () => {
    nuxtApp.runWithContext(() => {
      void usePushNotifications().registerDevice();
    });
  };

  // Tab vracen u fokus posle duzeg vremena u pozadini - browser ume da usnuli
  // setInterval odlozi ili preskoci dok je tab hidden, pa ovo hvata slucaj
  // kad se kurir vrati na app posle pauze umjesto da ceka sledeci sat.
  const handleVisibilityChange = () => {
    if (!document.hidden && session.user) runRegisterDevice();
  };

  watch(
    () => Boolean(session.user),
    (loggedIn) => {
      if (!loggedIn) {
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = null;
        }
        return;
      }

      if (import.meta.dev) console.info("[push] korisnik ulogovan - pokrecem registerDevice()");
      runRegisterDevice();

      if (!refreshTimer) {
        refreshTimer = setInterval(runRegisterDevice, REFRESH_INTERVAL_MS);
        document.addEventListener("visibilitychange", handleVisibilityChange);
      }
    },
    { immediate: true }
  );
});
