import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { fetchCourierHistory } from "~/services/courierHistoryService";
import { fetchCourierEarnings } from "~/services/courierEarningsService";
import { useAlertStore } from "~/stores/alert";
import { toLocalDayKey } from "~/utils/datetime";
import { buildDeliveries } from "~/utils/deliveryRecords";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { HistoryEntry } from "~/models/Order";
import type { OrderEarnings } from "~/types/earnings";

// Završene dostave kurira - JEDAN izvor za Istoriju i Novčanik. Prije su obje
// stranice zvale svoje (Istorija -> Novčanik -> Istorija = tri puta /history,
// koji nema ni straničenje); sad se podaci drže ovdje, a stranice dobijaju spoj
// istorije (ruta, restoran) i zarade (obračun) po broju narudžbe.
//
//  - /history i /earnings se učitavaju nezavisno: ako jedan padne, ekran radi sa
//    drugim (bez restorana, ili bez iznosa).
//  - Podaci mlađi od FRESH_MS se ne učitavaju ponovo pri otvaranju stranice, stariji
//    se osvježavaju u pozadini (bez skeletona); završena dostava ih odmah čini
//    starim (invalidate).
//  - /earnings se traži u dva opsega: "recent" (~31 dan, koliko pokriva Novčanik)
//    i "all" (period "Sve" u Istoriji, samo kad ga kurir izabere).

const FRESH_MS = 60_000;
// Prozor od ~31 dan pokriva najduži period u Novčaniku (30 dana).
const RECENT_DAYS = 31;

export type EarningsScope = "recent" | "all";

const covers = (have: EarningsScope | null, want: EarningsScope) =>
  have === "all" || have === want;

// "YYYY-MM-DD" za lokalni datum uz pomak od N dana (šalje se kao ?from=). Lokalni,
// ne UTC: toISOString() bi između ponoći i 02:00 vratio jučerašnji dan.
const isoDay = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return toLocalDayKey(d);
};

export const useDeliveriesStore = defineStore("deliveries", () => {
  const alerts = useAlertStore();

  const courierId = ref<number | null>(null);
  // shallowRef: do 3 000 redova sa ugniježđenim restoranom i adresom - duboka
  // reaktivnost bi ih sve obmotala proxy-jem, a mijenjaju se samo zamjenom cijele liste.
  const history = shallowRef<HistoryEntry[]>([]);
  const earnings = shallowRef<OrderEarnings[]>([]);

  const historyLoaded = ref(false);
  const earningsLoaded = ref(false);
  const historyLoading = ref(false);
  // Brojač umjesto boolean-a: zahtjev za širi opseg čeka onaj u letu, i u tom
  // međuvremenu "učitava se" ne smije da trepne na false.
  const earningsPending = ref(0);
  const earningsLoading = computed(() => earningsPending.value > 0);
  // Greška stoji samo dok nema ičega boljeg za prikaz (prvo učitavanje, ili traženi
  // opseg koji nije stigao); neuspjelo pozadinsko osvježavanje ne dira prikaz.
  const historyError = ref("");
  const earningsError = ref("");
  const earningsScope = ref<EarningsScope | null>(null);
  // Najširi opseg koji je neko tražio - "Pokušaj ponovo" ponavlja baš taj.
  const wantedScope = ref<EarningsScope>("recent");

  let historyAt = 0;
  let earningsAt = 0;
  let stale = false;
  let historyRun: { id: number; promise: Promise<void> } | null = null;
  let earningsRun: { id: number; scope: EarningsScope; promise: Promise<void> } | null = null;

  const reset = () => {
    history.value = [];
    earnings.value = [];
    historyLoaded.value = false;
    earningsLoaded.value = false;
    historyLoading.value = false;
    earningsPending.value = 0;
    historyError.value = "";
    earningsError.value = "";
    earningsScope.value = null;
    wantedScope.value = "recent";
    historyAt = 0;
    earningsAt = 0;
    stale = false;
    // Zahtjevi u letu za prethodnog kurira ostaju u letu, ali im je rezultat
    // odbačen (courierId se ne poklapa).
    historyRun = null;
    earningsRun = null;
  };

  const deliveries = computed(() => buildDeliveries(history.value, earnings.value));
  const byId = computed(() => new Map(deliveries.value.map((d) => [d.id, d])));

  // --- Istorija ---------------------------------------------------------------

  const runHistory = async (id: number, loud: boolean) => {
    try {
      const rows = await fetchCourierHistory(id);
      if (courierId.value !== id) return;
      history.value = rows;
      historyLoaded.value = true;
      historyError.value = "";
      historyAt = Date.now();
    } catch (error) {
      if (courierId.value !== id) return;
      if (!historyLoaded.value) {
        historyError.value = toFriendlyErrorMessage(error, "Ne mogu da učitam istoriju dostava.");
      } else if (loud) {
        alerts.error(toFriendlyErrorMessage(error, "Ne mogu da osvježim istoriju dostava."));
      }
    } finally {
      if (courierId.value === id) historyLoading.value = false;
    }
  };

  // loud = traži ga kurir (otvaranje stranice, osvježavanje, "Pokušaj ponovo"):
  // greška se pokazuje. Pozadinsko osvježavanje je tiho.
  const loadHistory = (loud: boolean): Promise<void> => {
    const id = courierId.value;
    if (!id) return Promise.resolve();
    if (historyRun?.id === id) return historyRun.promise;

    if (loud && !historyLoaded.value) historyError.value = "";
    historyLoading.value = true;
    const promise: Promise<void> = runHistory(id, loud).finally(() => {
      if (historyRun?.promise === promise) historyRun = null;
    });
    historyRun = { id, promise };
    return promise;
  };

  // --- Zarada -----------------------------------------------------------------

  const runEarnings = async (id: number, scope: EarningsScope, loud: boolean) => {
    try {
      const result = await fetchCourierEarnings(id, scope === "recent" ? isoDay(RECENT_DAYS) : undefined);
      if (courierId.value !== id) return;
      earnings.value = result.orders;
      earningsScope.value = scope;
      earningsLoaded.value = true;
      earningsError.value = "";
      earningsAt = Date.now();
    } catch (error) {
      if (courierId.value !== id) return;
      const missingSomething = !earningsLoaded.value || !covers(earningsScope.value, scope);
      if (missingSomething) {
        earningsError.value = toFriendlyErrorMessage(error, "Ne mogu da učitam zaradu.");
      } else if (loud) {
        alerts.error(toFriendlyErrorMessage(error, "Ne mogu da osvježim zaradu."));
      }
    }
  };

  const loadEarnings = (scope: EarningsScope, loud: boolean): Promise<void> => {
    const id = courierId.value;
    if (!id) return Promise.resolve();
    if (scope === "all") wantedScope.value = "all";

    const inFlight = earningsRun;
    if (inFlight?.id === id) {
      if (covers(inFlight.scope, scope)) return inFlight.promise;
      // U letu je uži opseg ("recent"), traži se širi ("all"): sačekaj pa pošalji.
      earningsPending.value += 1;
      const chained: Promise<void> = inFlight.promise
        .then(() => runEarnings(id, scope, loud))
        .finally(() => {
          earningsPending.value = Math.max(0, earningsPending.value - 1);
          if (earningsRun?.promise === chained) earningsRun = null;
        });
      earningsRun = { id, scope, promise: chained };
      return chained;
    }

    if (loud && !earningsLoaded.value) earningsError.value = "";
    earningsPending.value += 1;
    const promise: Promise<void> = runEarnings(id, scope, loud).finally(() => {
      earningsPending.value = Math.max(0, earningsPending.value - 1);
      if (earningsRun?.promise === promise) earningsRun = null;
    });
    earningsRun = { id, scope, promise };
    return promise;
  };

  // --- Ulaz za stranice -------------------------------------------------------

  const fresh = (at: number) => !stale && Date.now() - at < FRESH_MS;

  // Poziva stranica pri otvaranju: sve što je svježe ostaje, staro se osvježava u
  // pozadini, a ono čega nema se učitava (uz skeleton).
  const open = async (scope: EarningsScope = "recent"): Promise<void> => {
    if (scope === "all") wantedScope.value = "all";
    const jobs: Promise<void>[] = [];

    if (!historyLoaded.value) jobs.push(loadHistory(true));
    else if (!fresh(historyAt)) jobs.push(loadHistory(false));

    if (!earningsLoaded.value || !covers(earningsScope.value, scope)) {
      jobs.push(loadEarnings(scope, true));
    } else if (!fresh(earningsAt)) {
      jobs.push(loadEarnings(earningsScope.value ?? scope, false));
    }

    stale = false;
    await Promise.all(jobs);
  };

  // Dugme "Osvježi" i povratak u aplikaciju: sve ponovo, bez obzira na svježinu.
  const refreshAll = async (): Promise<void> => {
    await Promise.all([loadHistory(true), loadEarnings(earningsScope.value ?? wantedScope.value, true)]);
  };

  const retryHistory = () => loadHistory(true);
  const retryEarnings = () => loadEarnings(wantedScope.value, true);

  // Kurir je upravo završio dostavu: sljedeće otvaranje stranice ne smije da vjeruje
  // keširanom stanju.
  const invalidate = () => {
    stale = true;
  };

  const start = (id: number) => {
    if (!Number.isFinite(id) || id <= 0) {
      stop();
      return;
    }
    if (courierId.value !== id) {
      reset();
      courierId.value = id;
    }
  };

  function stop() {
    courierId.value = null;
    reset();
  }

  return {
    courierId,
    history,
    earnings,
    deliveries,
    byId,
    historyLoaded,
    earningsLoaded,
    historyLoading,
    earningsLoading,
    historyError,
    earningsError,
    earningsScope,
    start,
    stop,
    open,
    refreshAll,
    retryHistory,
    retryEarnings,
    invalidate,
  };
});
