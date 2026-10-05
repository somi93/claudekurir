import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Ref } from "vue";
import { useNuxtApp } from "nuxt/app";
import {
  ackOffer,
  fetchCourierOffers,
  parseCourierOffers,
  respondToOffer,
} from "~/services/orderOffersService";
import { getErrorStatus, getServerMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { Order } from "~/models/Order";
import { onPushEvent } from "~/composables/usePushNotifications";
import { useAlertStore } from "~/stores/alert";
import type { CourierInboxOfferDto, OfferResponseAction } from "~/types/offer";

// Kurirska strana: ponude koje čekaju odgovor (backend 10.09.2026, 2.3).
//
// Primarni izvor je Reverb: privatni kanal `App.Models.User.{courierId}`,
// event `.courier.offers.changed` (backend 25.09.2026). Event nosi CIJELU
// trenutnu listu ponuda u istom obliku kao GET /courier/offers, pa je samo
// postavljamo (prazna lista = nema ponuda). Push `order_offer` ostaje (radi i
// kad je app u pozadini) i povlači GET. Poll je sigurnosna mreža: 15s dok
// socket nije potvrđen, a tek 60s kad jeste (uz to hvata istek ponude, koji ne
// mora da proizvede event).
const POLL_MS = 15000;
const SOCKET_POLL_MS = 60000;
const INITIAL_LOAD_FALLBACK_MS = 3000;
const COURIER_CHANNEL = (courierId: number) => `App.Models.User.${courierId}`;
const COURIER_EVENT = ".courier.offers.changed";

// Odgovor na ponudu: `order` je nalog iz odgovora kod prihvatanja (ako ga backend
// vrati) - ekran ga odmah prikaže kao dostavu.
export type OfferRespondResult = { ok: boolean; order: Order | null };

export const useCourierOffers = (courierId: Ref<number>) => {
  // Uhvaćen u setup-u - subscribe/unsubscribe se zovu iz hook-ova i watch-a pa
  // ne smiju same da zovu useNuxtApp().
  const echoManager = (useNuxtApp() as unknown as {
    $echo?: { ensure: () => any; get: () => any };
  }).$echo;

  const alerts = useAlertStore();

  const offers = ref<CourierInboxOfferDto[]>([]);
  const loading = ref(false);
  const respondingOrderId = ref<number | null>(null);
  const errorMessage = ref("");

  // Stanje veze za "Spremnost": uživo (socket potvrđen), provjera na 15 s (socket
  // nije potvrđen, ali GET radi) ili bez veze (GET pada / uređaj je offline).
  const socketReady = ref(false);
  const lastLoadFailed = ref(false);
  const deviceOnline = ref(true);
  const lastSyncedAt = ref<Date | null>(null);
  const connection = computed<"live" | "polling" | "offline">(() => {
    if (!deviceOnline.value || lastLoadFailed.value) return "offline";
    return socketReady.value ? "live" : "polling";
  });
  const syncOnline = () => {
    deviceOnline.value = typeof navigator === "undefined" ? true : navigator.onLine;
  };
  const onBackOnline = () => {
    syncOnline();
    void load();
  };

  let lastLoadAt = 0;
  // Uvećava se pri svakom socket upisu - GET koji je krenuo PRIJE njega, a
  // vratio se poslije, nosi starije stanje i ne smije da ga pregazi.
  let socketVersion = 0;
  // offer_id-jevi za koje je već poslat ACK u ovoj sesiji - da ne šaljemo
  // ponovo na svaki reconnect/re-fire istog eventa (vidi ackOffer niže).
  const ackedOfferIds = new Set<number>();

  const load = async () => {
    lastLoadAt = Date.now();
    const versionAtStart = socketVersion;
    if (offers.value.length === 0) loading.value = true;
    try {
      const fetched = await fetchCourierOffers();
      if (versionAtStart === socketVersion) offers.value = fetched;
      errorMessage.value = "";
      lastLoadFailed.value = false;
      lastSyncedAt.value = new Date();
    } catch (error) {
      // 404 = ruta još nije deployovana; ćutimo (feature nije živ).
      const notDeployed = getErrorStatus(error) === 404;
      lastLoadFailed.value = !notDeployed;
      if (!notDeployed && offers.value.length === 0) {
        errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam ponude.");
      }
    } finally {
      loading.value = false;
    }
  };

  // `onSuccess` se zove u istom sinhronom bloku u kojem ponuda nestaje iz liste: pozivalac
  // tu može da ubaci prihvaćeni nalog, pa ekran nikad ne vidi međustanje "nema ni ponude ni
  // dostave" (treptaj, nepotrebno puštanje Wake Lock-a i dvostruko uklapanje kamere).
  const respond = async (
    orderId: number,
    action: OfferResponseAction,
    onSuccess?: (order: Order | null) => void
  ): Promise<OfferRespondResult> => {
    respondingOrderId.value = orderId;
    try {
      const order = await respondToOffer(orderId, action);
      try {
        onSuccess?.(order);
      } catch (error) {
        // Server je prihvatio odgovor; greška u prikazu ne smije da izgleda kao pad API-ja.
        if (import.meta.dev) console.error("[courier-offers] onSuccess bacio grešku", error);
      }
      offers.value = offers.value.filter((o) => o.order_id !== orderId);
      alerts.success(
        action === "accept" ? "Ponuda je prihvaćena." : "Ponuda je odbijena."
      );
      return { ok: true, order };
    } catch (error) {
      // Ponuda je u međuvremenu istekla / preuzeta - skini je iz liste.
      if (getErrorStatus(error) === 409) {
        offers.value = offers.value.filter((o) => o.order_id !== orderId);
        alerts.warning(
          getServerMessage(error) ?? "Ova ponuda više nije aktivna."
        );
      } else {
        alerts.error(toFriendlyErrorMessage(error, "Ne mogu da pošaljem odgovor na ponudu."));
      }
      return { ok: false, order: null };
    } finally {
      respondingOrderId.value = null;
    }
  };

  // --- Socket ---

  let boundChannel: string | null = null;
  // socketReady (ref gore) = server je potvrdio pretplatu (subscription_succeeded)
  // - tek tad poll može da uspori.

  const unsubscribe = () => {
    socketReady.value = false;
    ackedOfferIds.clear();
    if (boundChannel === null) return;
    try {
      echoManager?.get()?.leave(boundChannel);
    } catch {
      // ignore
    }
    boundChannel = null;
  };

  const subscribe = (id: number) => {
    // Prvo skini prethodnu pretplatu - laravel-echo vraća isti kanal za isto
    // ime, pa bi drugi `.listen()` dvaput okinuo handler.
    unsubscribe();
    if (!echoManager) {
      if (import.meta.dev) console.warn("[courier-offers] $echo plugin nije dostupan");
      return;
    }

    try {
      const name = COURIER_CHANNEL(id);
      const channel = echoManager.ensure().private(name);
      if (import.meta.dev) console.info("[courier-offers] subscribe", name);

      // `subscribed` se okida i na prvi spoj i poslije svakog reconnect-a
      // (pusher-js se sam ponovo pretplati) - u oba slučaja povučemo GET da
      // uhvatimo ponude poslate dok nismo bili pretplaćeni.
      channel.subscribed(() => {
        if (import.meta.dev) console.info("[courier-offers] subscription_succeeded", name);
        socketReady.value = true;
        void load();
      });
      channel.error((err: unknown) => {
        // Npr. intermitentni 403 sa /broadcasting/auth - poll ostaje na 15s.
        socketReady.value = false;
        if (import.meta.dev) console.error("[courier-offers] subscription_error", name, err);
      });
      channel.listen(COURIER_EVENT, (payload: unknown) => {
        if (import.meta.dev) console.info("[courier-offers] event", COURIER_EVENT, payload);
        const next = parseCourierOffers(payload);
        if (next) {
          socketVersion++;
          offers.value = next;
          errorMessage.value = "";

          // Potvrda dispečeru da je ponuda stvarno stigla uživo preko
          // socketa (ne samo da je backend emitovao broadcast) - best-effort,
          // greška ne sme da prekine ništa u UI toku.
          for (const o of next) {
            if (ackedOfferIds.has(o.offer_id)) continue;
            ackedOfferIds.add(o.offer_id);
            void ackOffer(o.offer_id).catch(() => {
              // ignore - telemetrija, kurir ionako vidi ponudu bez obzira na ACK
            });
          }
        } else {
          // Neprepoznat oblik - ne diramo stanje, povučemo GET.
          void load();
        }
      });
      boundChannel = name;
    } catch (error) {
      // Socket nedostupan - ostaje poll na 15s.
      if (import.meta.dev) console.error("[courier-offers] subscribe() bacio grešku", error);
    }
  };

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let offPush: (() => void) | null = null;
  let initialLoadTimer: ReturnType<typeof setTimeout> | null = null;

  onMounted(() => {
    syncOnline();
    window.addEventListener("online", onBackOnline);
    window.addEventListener("offline", syncOnline);
    // Prvo učitavanje ide preko `subscribed` callback-a (subscribe() ispod) -
    // ono ionako povlači GET, pa bi odvojen GET ovdje značio dva identična
    // poziva pri svakom otvaranju stranice (i imao bi rupu između GET-a i
    // pretplate u kojoj bi propao event). Ako socket nije dostupan ili se ne
    // pretplati u roku, uzimamo GET kao rezervu.
    if (echoManager) {
      initialLoadTimer = setTimeout(() => {
        if (lastLoadAt === 0) void load();
      }, INITIAL_LOAD_FALLBACK_MS);
    } else {
      void load();
    }
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      if (socketReady.value && Date.now() - lastLoadAt < SOCKET_POLL_MS) return;
      void load();
    }, POLL_MS);
    // Push `order_offer` -> odmah povuci listu umjesto da se čeka sljedeći poll.
    offPush = onPushEvent("order_offer", () => void load());

    // courierId može stići tek poslije mount-a (asinhrona sesija).
    watch(
      courierId,
      (id) => {
        if (Number.isFinite(id) && id > 0) subscribe(id);
        else unsubscribe();
      },
      { immediate: true }
    );
  });

  onBeforeUnmount(() => {
    window.removeEventListener("online", onBackOnline);
    window.removeEventListener("offline", syncOnline);
    if (pollTimer) clearInterval(pollTimer);
    if (initialLoadTimer) clearTimeout(initialLoadTimer);
    offPush?.();
    unsubscribe();
  });

  return {
    offers,
    loading,
    errorMessage,
    respondingOrderId,
    connection,
    deviceOnline,
    lastSyncedAt,
    load,
    respond,
  };
};
