import { computed, onUnmounted, ref } from "vue";
import { useNuxtApp } from "nuxt/app";
import {
  cancelOfferRound,
  extractSkipped,
  fetchOfferRound,
  normalizeOfferRound,
  openOfferRound,
} from "~/services/orderOffersService";
import { getErrorStatus, toFriendlyErrorMessage } from "~/utils/errorMessage";
import type {
  CourierOffer,
  OfferMode,
  OfferRound,
  OfferRoundEventPayload,
  SkippedCourier,
} from "~/types/offer";

// Dispečerska strana runde ponude (backend odgovor 10.09.2026, 2.3 + 2.4).
//
// Tok: `open()` otvori rundu (POST, 201 već nosi puno stanje) -> pretplata na
// `orders.{orderId}` / `.offer.round.changed` za dalje promjene. `watchOrder()`
// (postojeća runda, narudžba se samo otvara) i dalje zove `load()` (GET) prvo.
// Socket payload je po backendu identičan REST odgovoru. Reconnect (WS padne
// pa se vrati) povuče GET ponovo da se uhvati propušteno. Uz to ide i spori
// fallback poll (10s) dok je runda aktivna - za slučaj da socket ne prođe
// (auth, firewall); kad socket radi, poll samo potvrđuje isto stanje.

const FALLBACK_POLL_MS = 10000;
const OFFER_CHANNEL = (orderId: number) => `orders.${orderId}`;
const OFFER_EVENT = ".offer.round.changed";

const emptyRound = (): OfferRound => ({
  orderId: null,
  mode: null,
  roundStatus: null,
  offers: [],
  candidateIds: null,
  skipped: [],
});

export const useOrderOfferRound = () => {
  // Uhvaćen u setup-u - metode ispod (subscribe/unsubscribe/stop) se zovu i iz
  // onUnmounted pa ne smiju same da zovu useNuxtApp().
  const echoManager = (useNuxtApp() as unknown as {
    $echo?: { ensure: () => any; get: () => any };
  }).$echo;

  const round = ref<OfferRound>(emptyRound());
  const activeOrderId = ref<number | null>(null);
  // Čuvamo firmu uz aktivnu rundu - reconnect/poll zovu load() bez parametara
  // pa im treba odakle da je uzmu (delivery_company_id je obavezan, vidi
  // orderOffersService.ts).
  let activeCompanyId: number | null = null;
  const loading = ref(false);
  const sending = ref(false);
  const errorMessage = ref("");
  // true = ovaj backend još nema offer rute (404/501) - pozivalac tad pada na
  // stari jednokratni POST /orders/{id}/accept.
  const offerApiMissing = ref(false);
  // Kuriri koje je backend izostavio iz POSLJEDNJE otvorene runde (npr. "vozi
  // drugu dostavu"). Postoji samo u odgovoru na POST /offer - GET /offers i
  // socket ga ne nose - zato se čuva ovdje, a briše na novu rundu / stop().
  const skipped = ref<SkippedCourier[]>([]);

  // Sekundni tik za odbrojavanje "ističe za Ys" - radi samo dok je runda
  // aktivna, da ne troši CPU kad nema šta da se broji.
  const now = ref(Date.now());
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const roundActive = computed(
    () => round.value.roundStatus === "active" || round.value.roundStatus === null
  );

  const startTick = () => {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  };
  const stopTick = () => {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  };

  const secondsLeft = (offer: CourierOffer): number | null => {
    if (!offer.expiresAt) return null;
    return Math.max(0, Math.round((offer.expiresAt.getTime() - now.value) / 1000));
  };

  const applyRound = (next: OfferRound) => {
    round.value = next;
    if (roundActive.value && next.offers.some((o) => o.status === "pending")) {
      startTick();
    } else {
      stopTick();
    }
  };

  // `silent` = ne diži errorMessage na neuspjeh (koristi ga `watchOrder` -
  // dispečer nije ni tražio rundu, samo je otvorio narudžbu; prolazni 5xx sa
  // nove /offers rute ne treba da mu iskoči kao greška).
  const load = async (orderId: number, deliveryCompanyId: number, silent = false) => {
    loading.value = true;
    if (!silent) errorMessage.value = "";
    try {
      applyRound(await fetchOfferRound(orderId, deliveryCompanyId));
      offerApiMissing.value = false;
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 404 || status === 501) {
        offerApiMissing.value = true;
      } else if (!silent) {
        errorMessage.value = toFriendlyErrorMessage(
          error,
          "Ne mogu da učitam stanje ponude."
        );
      }
    } finally {
      loading.value = false;
    }
  };

  // --- Socket ---

  let boundChannel: number | null = null;
  let reconnectBound = false;

  const subscribe = (orderId: number) => {
    if (!echoManager) {
      if (import.meta.dev) console.warn("[offer-round] $echo plugin nije dostupan");
      return;
    }

    try {
      const echo = echoManager.ensure();
      const channel = echo.private(OFFER_CHANNEL(orderId));
      if (import.meta.dev) {
        console.info("[offer-round] subscribe", OFFER_CHANNEL(orderId));
        channel.subscribed(() =>
          console.info("[offer-round] subscription_succeeded", OFFER_CHANNEL(orderId))
        );
        channel.error((err: unknown) =>
          console.error("[offer-round] subscription_error", OFFER_CHANNEL(orderId), err)
        );
      }
      channel.listen(OFFER_EVENT, (payload: OfferRoundEventPayload) => {
        if (import.meta.dev) console.info("[offer-round] event", OFFER_EVENT, payload);
        applyRound(normalizeOfferRound(orderId, payload));
      });
      boundChannel = orderId;

      // Reconnect catch-up: pusher-js konekcija emituje "connected" i na prvi
      // spoj i poslije svakog pada - preskačemo prvi (tada `load()` ionako ide
      // iz `open()`), a na naredne povučemo GET da uhvatimo propušteno.
      const connection = echo.connector?.pusher?.connection;
      if (connection && !reconnectBound) {
        reconnectBound = true;
        let firstConnect = true;
        connection.bind("connected", () => {
          if (firstConnect) {
            firstConnect = false;
            return;
          }
          if (activeOrderId.value && activeCompanyId !== null) {
            void load(activeOrderId.value, activeCompanyId);
          }
        });
      }
    } catch (error) {
      // Socket nedostupan - ostaje fallback poll (ispod).
      if (import.meta.dev) console.error("[offer-round] subscribe() bacio grešku", error);
    }
  };

  const unsubscribe = () => {
    if (boundChannel === null) return;
    try {
      echoManager?.get()?.leave(OFFER_CHANNEL(boundChannel));
    } catch {
      // ignore
    }
    boundChannel = null;
  };

  // --- Fallback poll ---

  const startPolling = (orderId: number) => {
    stopPolling();
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      if (activeOrderId.value !== orderId || !roundActive.value || activeCompanyId === null) {
        stopPolling();
        return;
      }
      void load(orderId, activeCompanyId);
    }, FALLBACK_POLL_MS);
  };
  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  // --- Public ---

  const stop = () => {
    unsubscribe();
    stopPolling();
    stopTick();
    activeOrderId.value = null;
    activeCompanyId = null;
    round.value = emptyRound();
    skipped.value = [];
  };

  // "Zatvori rundu" - prekida aktivnu rundu na serveru (backend odgovor 14.09).
  // Na uspjeh se ponašamo isto kao ranije (lokalni stop, bar nestaje) jer je
  // runda stvarno zatvorena; na grešku NE gasimo pretplatu - runda je i dalje
  // aktivna na serveru, dispečer treba da vidi grešku i pokuša ponovo.
  const cancel = async (): Promise<void> => {
    const orderId = activeOrderId.value;
    const companyId = activeCompanyId;
    if (orderId === null || companyId === null) {
      stop();
      return;
    }
    sending.value = true;
    errorMessage.value = "";
    try {
      await cancelOfferRound(orderId, companyId);
      stop();
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(
        error,
        "Ne mogu da zatvorim rundu."
      );
    } finally {
      sending.value = false;
    }
  };

  // Otvara rundu ponude. `courierIds` je redoslijed iz rangirane liste (za
  // sequential). Vraća true ako je runda otvorena, false ako offer rute nema
  // (pozivalac tad pada na legacy accept).
  const open = async (
    orderId: number,
    deliveryCompanyId: number,
    courierIds: number[],
    mode: OfferMode,
    offerTimeoutSeconds?: number
  ): Promise<boolean> => {
    if (activeOrderId.value && activeOrderId.value !== orderId) stop();
    sending.value = true;
    errorMessage.value = "";
    skipped.value = [];
    try {
      const opened = await openOfferRound(
        orderId,
        deliveryCompanyId,
        courierIds,
        mode,
        offerTimeoutSeconds
      );
      activeOrderId.value = orderId;
      activeCompanyId = deliveryCompanyId;
      offerApiMissing.value = false;
      skipped.value = opened.skipped;
      // POST 201 nosi puno stanje runde (potvrđeno uživo 12.09, identično
      // GET /offers) - follow-up GET nije potreban.
      applyRound(opened.round);
      // Otvaranje nove runde za ISTU narudžbu koju smo već pratili (npr.
      // per-red "Pošalji ponudu" na kandidatu poslije prethodne riješene runde
      // - moguće od 14.09 otkad se čekiranje otključava čim runda nije više
      // aktivna) ne prolazi kroz `stop()` iznad (samo mijenja rundu, ne
      // narudžbu) - `unsubscribe()` prvo spriječava duplo `.listen()` na istom
      // Echo kanalu (laravel-echo vraća isti kanal za isto ime, drugi `.listen()`
      // bi značio da svaki event dvaput pozove `applyRound`).
      unsubscribe();
      subscribe(orderId);
      startPolling(orderId);
      return true;
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 404 || status === 501) {
        offerApiMissing.value = true;
        return false;
      }
      // Ako je backend odbio zahtjev, ali je naveo koga je preskočio i zašto
      // (npr. svi izabrani voze drugu dostavu), dispečer treba da vidi razlog.
      skipped.value = extractSkipped((error as { data?: unknown } | null)?.data);
      errorMessage.value = toFriendlyErrorMessage(
        error,
        "Ne mogu da pošaljem ponudu."
      );
      return false;
    } finally {
      sending.value = false;
    }
  };

  // Prati postojeću rundu bez otvaranja nove (npr. dispečer otvori narudžbu
  // koja je već u rundi). GET se povuče jednom da se popuni `round` (istorija
  // ostaje vidljiva i za rešenu rundu - chip, per-red status); UŽIVO praćenje
  // (socket + poll) se drži SAMO ako je runda STVARNO aktivna.
  const watchOrder = async (orderId: number, deliveryCompanyId: number) => {
    if (activeOrderId.value === orderId) return;
    if (activeOrderId.value) stop();
    activeOrderId.value = orderId;
    activeCompanyId = deliveryCompanyId;
    await load(orderId, deliveryCompanyId, true);
    if (activeOrderId.value !== orderId) return; // stop() u međuvremenu

    // Nema nikakve runde (ni istorije) za ovu narudžbu - ništa da se prikaže,
    // vrati na prazno stanje.
    const hasAnyRound = round.value.offers.length > 0 || round.value.roundStatus !== null;
    if (!hasAnyRound) {
      stop();
      return;
    }

    // Backend odbija pretplatu na `orders.{orderId}` kanal (403 na
    // /broadcasting/auth) kad runda nije aktivna - potvrđeno uživo 28.09,
    // DOSLJEDNO (10/10 pokušaja "Prikaži kandidate" na rešenoj rundi), odmah
    // poslije otvaranja NOVE runde isti kanal radi. Logično - nema šta da se
    // broadcast-uje za zatvorenu rundu. Ranije je kod ovdje pokušavao da se
    // pretplati i za rešenu rundu (`offers.length > 0` je bilo dovoljno), što
    // je garantovano pravilo lažan 403 u konzoli/Network tabu na svaki klik -
    // istorija se već prikazuje iz `load()` iznad, uživo praćenje joj ne treba.
    if (round.value.roundStatus === "active") {
      subscribe(orderId);
      startPolling(orderId);
    }
  };

  const offerFor = (courierId: number): CourierOffer | null =>
    round.value.offers.find((o) => o.courierId === courierId) ?? null;

  onUnmounted(stop);

  return {
    round,
    activeOrderId,
    loading,
    sending,
    errorMessage,
    offerApiMissing,
    skipped,
    roundActive,
    secondsLeft,
    offerFor,
    open,
    watchOrder,
    load,
    stop,
    cancel,
  };
};
