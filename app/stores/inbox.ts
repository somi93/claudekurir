import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  fetchCourierInboxPage,
  markAllInboxRead,
  setInboxMessageRead,
} from "~/services/courierInboxService";
import { onAnyPushEvent } from "~/composables/usePushNotifications";
import { useAlertStore } from "~/stores/alert";
import { toTimestamp } from "~/utils/datetime";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { isOffer, sortNewestFirst } from "~/utils/inboxGroups";
import type { InboxMessage, InboxPage } from "~/types/inbox";

// Sanduče kurira - JEDAN izvor istine za stranicu "Poruke", bedž na početnoj i
// bedž u donjoj navigaciji. Živi u store-u (a ne u composable-u stranice) da bi
// broj nepročitanih bio tačan i kad kurir nije na toj stranici.
//
// Povlači se stranica po stranica (?page=&per_page=, backend #223681). Novije
// poruke uvijek stižu na stranicu 1, pa pozadinsko osvježavanje čita samo nju i
// spaja je sa onim što je već učitano.

const PAGE_SIZE = 50;
const POLL_MS = 60_000;
// Zaštita od "olujnog" osvježavanja (fokus + push + tajmer u istom trenutku).
const MIN_REFRESH_GAP_MS = 5_000;
const FOCUS_REFRESH_GAP_MS = 15_000;
// Ponude su ogromna većina poruka, pa prva stranica može biti SAMO ponude. Pri
// otvaranju stranice zato učitavamo dalje dok ne nađemo ovoliko pravih poruka
// (ili dok ne potrošimo MAX_AUTO_PAGES stranica). Tačan broj nepročitanih po
// kategoriji traži backend - vidi docs/2026/10/03_10_2026_Frontend_pitanja_za_backend.textile.
const MIN_REAL_MESSAGES = 15;
const MAX_AUTO_PAGES = 4;

export const useInboxStore = defineStore("inbox", () => {
  const alerts = useAlertStore();

  const courierId = ref<number | null>(null);
  const messages = ref<InboxMessage[]>([]);
  const loaded = ref(false);
  // Prvo učitavanje (još nema podataka za prikaz) - skeleton.
  const loading = ref(false);
  const loadingMore = ref(false);
  const refreshing = ref(false);
  // Greška PRVOG učitavanja (stoji u prikazu uz "Pokušaj ponovo"). Greške
  // pozadinskog osvježavanja se ne prikazuju - lista i bedž ostaju kakvi jesu.
  const errorMessage = ref("");

  // Sljedeća stranica za "starije" i poslednja stranica koju backend javlja.
  const nextPage = ref(2);
  const lastPage = ref(1);

  let lastRefreshAt = 0;
  // id -> željena vrijednost `read` za upise koji su još u letu: osvježavanje koje
  // stigne usred upisa nosi staro stanje i ne smije da ga vrati unazad.
  const pendingRead = new Map<number, boolean>();
  // Jedno učitavanje u letu po kuriru - drugi poziv čeka isti rezultat (npr.
  // pozadinski start iz app.vue i otvaranje stranice u istom trenutku).
  let loadPromise: Promise<void> | null = null;
  let loadFor: number | null = null;
  // true ako je na rezultat čekao poziv koji želi da vidi grešku (stranica);
  // pozadinski pokušaji greške ne prikazuju.
  let loudLoad = false;

  const unreadCount = computed(
    () => messages.value.filter((m) => !m.read && !isOffer(m)).length
  );
  const realCount = computed(() => messages.value.filter((m) => !isOffer(m)).length);
  const hasMore = computed(() => nextPage.value <= lastPage.value);
  // Koliko je stranica (po PAGE_SIZE poruka) do sada učitano.
  const pagesLoaded = computed(() => nextPage.value - 1);

  const reset = () => {
    messages.value = [];
    loaded.value = false;
    loading.value = false;
    loadingMore.value = false;
    refreshing.value = false;
    errorMessage.value = "";
    nextPage.value = 2;
    lastPage.value = 1;
    lastRefreshAt = 0;
    pendingRead.clear();
    // Učitavanje u letu za prethodnog kurira ostaje u letu, ali mu je rezultat
    // odbačen (courierId se ne poklapa) - novi kurir pokreće svoje.
    loadPromise = null;
    loadFor = null;
    loudLoad = false;
  };

  // Backend ne mora da vrati `meta` - tad procjenjujemo po veličini stranice.
  const lastPageOf = (page: InboxPage, requested: number): number =>
    page.meta?.last_page ?? (page.messages.length >= PAGE_SIZE ? requested + 1 : requested);

  const merge = (incoming: InboxMessage[], base: InboxMessage[] = messages.value) => {
    const byId = new Map<number, InboxMessage>(base.map((m) => [m.id, m]));
    for (const message of incoming) {
      const pending = pendingRead.get(message.id);
      byId.set(message.id, pending === undefined ? message : { ...message, read: pending });
    }
    messages.value = sortNewestFirst([...byId.values()]);
  };

  // --- Učitavanje -----------------------------------------------------------

  const runLoad = async (id: number) => {
    try {
      const page = await fetchCourierInboxPage(id, { page: 1, perPage: PAGE_SIZE });
      if (courierId.value !== id) return; // kurir se u međuvremenu promijenio
      messages.value = sortNewestFirst(page.messages);
      nextPage.value = 2;
      lastPage.value = lastPageOf(page, 1);
      loaded.value = true;
      errorMessage.value = "";
      lastRefreshAt = Date.now();
    } catch (error) {
      if (courierId.value !== id) return;
      if (!loaded.value && loudLoad) {
        // Naslov stanja greške je već "Ne mogu da učitam poruke" - ovdje ide razlog.
        errorMessage.value = toFriendlyErrorMessage(
          error,
          "Server ne odgovara. Pokušaj ponovo za koji trenutak."
        );
      }
    } finally {
      if (courierId.value === id) {
        loading.value = false;
        loudLoad = false;
      }
    }
  };

  // silent = pozadinski pokušaj (tajmer, fokus): bez skeletona i bez poruke o grešci.
  const load = (silent = false): Promise<void> => {
    const id = courierId.value;
    if (!id) return Promise.resolve();

    if (!silent) {
      loudLoad = true;
      if (!loaded.value) loading.value = true;
      errorMessage.value = "";
    }
    if (loadPromise && loadFor === id) return loadPromise;

    loadFor = id;
    const promise = runLoad(id).finally(() => {
      if (loadPromise === promise) {
        loadPromise = null;
        loadFor = null;
      }
    });
    loadPromise = promise;
    return promise;
  };

  const loadMore = async () => {
    const id = courierId.value;
    if (!id || !loaded.value || loadingMore.value || !hasMore.value) return;

    const requested = nextPage.value;
    loadingMore.value = true;
    try {
      const page = await fetchCourierInboxPage(id, { page: requested, perPage: PAGE_SIZE });
      if (courierId.value !== id) return;
      merge(page.messages);
      nextPage.value = requested + 1;
      // `meta` je mjerodavan (i kad se broj stranica smanji zbog obrisanih poruka);
      // bez njega samo procjenjujemo i nikad ne smanjujemo.
      lastPage.value = page.meta
        ? page.meta.last_page
        : Math.max(lastPage.value, lastPageOf(page, requested));
    } catch (error) {
      if (courierId.value === id) {
        alerts.error(toFriendlyErrorMessage(error, "Ne mogu da učitam starije poruke."));
      }
    } finally {
      if (courierId.value === id) loadingMore.value = false;
    }
  };

  // Novije poruke stižu na stranicu 1: pročitaj je i spoji sa već učitanim.
  const refresh = async (force = false) => {
    const id = courierId.value;
    if (!id || !loaded.value || loading.value || loadingMore.value || refreshing.value) return;
    if (!force && Date.now() - lastRefreshAt < MIN_REFRESH_GAP_MS) return;

    refreshing.value = true;
    lastRefreshAt = Date.now();
    try {
      const page = await fetchCourierInboxPage(id, { page: 1, perPage: PAGE_SIZE });
      if (courierId.value !== id) return;

      const pageLast = lastPageOf(page, 1);
      if (pageLast <= 1) {
        // Sve staje na prvu stranicu - ona je mjerodavna (hvata i obrisane poruke).
        messages.value = [];
        merge(page.messages, []);
        nextPage.value = 2;
        lastPage.value = 1;
      } else {
        // Poruke novije od najstarije na stranici 1, a koje backend više ne vraća,
        // su obrisane. Starije (sa dalje učitanih stranica) ostaju.
        const incomingIds = new Set(page.messages.map((m) => m.id));
        const cutoff = Math.min(...page.messages.map((m) => toTimestamp(m.sentAt)));
        const kept = messages.value.filter(
          (m) => incomingIds.has(m.id) || toTimestamp(m.sentAt) < cutoff
        );
        merge(page.messages, kept);
        lastPage.value = Math.max(lastPage.value, pageLast);
      }
    } catch {
      // Tiho - pozadinsko osvježavanje ne smije da pokvari prikaz.
    } finally {
      if (courierId.value === id) refreshing.value = false;
    }
  };

  // Pri otvaranju stranice: učitaj dalje dok ne bude dovoljno PRAVIH poruka.
  const fillMessages = async () => {
    while (
      courierId.value &&
      loaded.value &&
      hasMore.value &&
      realCount.value < MIN_REAL_MESSAGES &&
      nextPage.value <= MAX_AUTO_PAGES
    ) {
      const before = nextPage.value;
      await loadMore();
      if (nextPage.value === before) break; // greška - ne vrtimo se u krug
    }
  };

  const openInbox = async () => {
    if (!loaded.value) await load();
    else void refresh(true);
    await fillMessages();
  };

  // Pozadinski start (app.vue): isto punjenje kao pri otvaranju stranice, da broj
  // na bedžu bude isti kao onaj koji kurir vidi kad otvori Poruke - inače bi
  // početna (samo prva stranica) pokazala manje nepročitanih od same stranice.
  const loadAndFill = async (silent = false) => {
    await load(silent);
    await fillMessages();
  };

  // --- Akcije nad porukama (optimistički, uz vraćanje na grešku) ---------------

  const setRead = async (id: number, read: boolean, failure: string) => {
    const message = messages.value.find((m) => m.id === id);
    if (!message || message.read === read) return;

    message.read = read;
    pendingRead.set(id, read);
    try {
      await setInboxMessageRead(id, read);
    } catch (error) {
      message.read = !read;
      alerts.error(toFriendlyErrorMessage(error, failure));
    } finally {
      pendingRead.delete(id);
    }
  };

  const markRead = (id: number) =>
    setRead(id, true, "Ne mogu da označim poruku kao pročitanu.");

  const markUnread = (id: number) =>
    setRead(id, false, "Ne mogu da označim poruku kao nepročitanu.");

  const markAllRead = async () => {
    const id = courierId.value;
    if (!id) return;

    const unread = messages.value.filter((m) => !m.read);
    if (unread.length === 0) return;

    unread.forEach((m) => {
      m.read = true;
      pendingRead.set(m.id, true);
    });
    try {
      await markAllInboxRead(id);
    } catch (error) {
      unread.forEach((m) => {
        m.read = false;
      });
      alerts.error(toFriendlyErrorMessage(error, "Ne mogu da označim sve kao pročitano."));
    } finally {
      unread.forEach((m) => pendingRead.delete(m.id));
    }
  };

  // --- Pozadinsko osvježavanje -------------------------------------------------

  let timer: ReturnType<typeof setInterval> | null = null;
  let offPush: (() => void) | null = null;
  let onVisibility: (() => void) | null = null;

  const stopWatching = () => {
    if (timer) clearInterval(timer);
    timer = null;
    offPush?.();
    offPush = null;
    if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
    onVisibility = null;
  };

  // Idempotentno: zove ga app.vue (cijelo vrijeme dok je kurir prijavljen) i
  // stranica Poruke. Promjena kurira (npr. admin mijenja prikaz) briše stanje.
  const start = (id: number) => {
    if (!Number.isFinite(id) || id <= 0) {
      stop();
      return;
    }
    if (courierId.value !== id) {
      reset();
      courierId.value = id;
    }

    if (!timer) {
      timer = setInterval(() => {
        if (document.hidden) return;
        if (!loaded.value) void loadAndFill(true);
        else void refresh();
      }, POLL_MS);

      onVisibility = () => {
        if (document.hidden) return;
        if (!loaded.value) void loadAndFill(true);
        else if (Date.now() - lastRefreshAt > FOCUS_REFRESH_GAP_MS) void refresh(true);
      };
      document.addEventListener("visibilitychange", onVisibility);

      // Svaki foreground push (backend još nije javio tip za inbox poruku).
      offPush = onAnyPushEvent(() => void refresh());
    }

    if (!loaded.value) void loadAndFill(true);
  };

  function stop() {
    stopWatching();
    courierId.value = null;
    reset();
  }

  return {
    courierId,
    messages,
    loaded,
    loading,
    loadingMore,
    refreshing,
    errorMessage,
    unreadCount,
    hasMore,
    pagesLoaded,
    start,
    stop,
    load,
    loadMore,
    refresh,
    openInbox,
    markRead,
    markUnread,
    markAllRead,
  };
});
