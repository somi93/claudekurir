import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import type { useCourierDeliveries } from "~/composables/useCourierDeliveries";
import {
  DEFAULT_PERIOD,
  HISTORY_PERIODS,
  HISTORY_SORTS,
  deliveriesLabel,
  filterRows,
  groupByDay,
  makeBuckets,
  money,
  moneyModeOf,
  periodFromQuery,
  periodRangeLabel,
  periodRows,
  sortFromQuery,
  sortRows,
  summarize,
  summaryCells,
  takeGroups,
  totalKm,
  weekTrend,
  widerPeriod,
  type HistoryPeriod,
  type HistorySort,
} from "~/utils/historyGroups";

// Prvi ekran: dovoljno redova da se vide najmanje dva dana, a ostalo se otvara
// dugmetom "Prikaži starije" (3 000 dostava odjednom bi bilo ~95 000 DOM čvorova).
const FIRST_ROWS = 24;
const MORE_ROWS = 30;
// Pretraga se upisuje u adresu tek kad kurir stane sa kucanjem.
const URL_DEBOUNCE_MS = 250;
// "Sada" se osvježava povremeno (i pri povratku u aplikaciju) da "Danas" ne ostane
// zalijepljen za jučerašnji dan ako stranica ostane otvorena preko ponoći.
const NOW_TICK_MS = 5 * 60_000;

const queryString = (raw: unknown): string | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value ? value : null;
};
const queryId = (raw: unknown): number | null => {
  const id = Number(queryString(raw));
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Pogled ekrana Istorija dostava nad zajedničkim podacima (useCourierDeliveries):
// period, stubić, pretraga, sortiranje i otvorena dostava žive u adresi (?p ?d ?q ?s
// ?o) - tako dugme Nazad zatvara detalj, a veza ka dostavi može da se pošalje dalje.
// Filteri se upisuju sa replace (istorija pregledača ostaje čista), otvaranje
// detalja sa push (kao u Porukama).
export const useHistoryView = (source: ReturnType<typeof useCourierDeliveries>) => {
  const route = useRoute();
  const router = useRouter();

  const now = ref(Date.now());

  // --- Adresa -----------------------------------------------------------------

  const period = computed<HistoryPeriod>(() => periodFromQuery(queryString(route.query.p)));
  const requestedSort = computed<HistorySort>(() => sortFromQuery(queryString(route.query.s)));
  const bucketKey = computed(() => queryString(route.query.d));
  const openId = computed(() => queryId(route.query.o));
  // Tekst pretrage je lokalan (da kucanje ne čeka router); u adresu ide s odgodom.
  const text = ref(queryString(route.query.q) ?? "");

  const setQuery = (patch: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
    const next: Record<string, unknown> = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") delete next[key];
      else next[key] = value;
    }
    void router[mode]({ query: next as Record<string, string | string[]> });
  };

  // --- Podaci ------------------------------------------------------------------

  const state = computed<"loading" | "error" | "empty" | "ready">(() => {
    const historySettled = source.historyLoaded.value || Boolean(source.historyError.value);
    const earningsSettled = source.earningsLoaded.value || Boolean(source.earningsError.value);
    if (!historySettled) return "loading";
    // Istorija nije stigla: ako zarada ima dostava, ekran radi bez restorana; ako ni
    // zarada nema šta da pokaže, čekamo je pa tek onda javljamo grešku.
    if (source.historyError.value && source.deliveries.value.length === 0) {
      return earningsSettled ? "error" : "loading";
    }
    return source.deliveries.value.length === 0 ? "empty" : "ready";
  });

  const inPeriod = computed(() => periodRows(source.deliveries.value, period.value, now.value));
  const summary = computed(() => summarize(inPeriod.value));
  const mode = computed(() => moneyModeOf(summary.value));

  // Dostava bez ikakvog obračuna dok zarada još stiže: iznos je "učitava se", a ne "nema".
  const missingMoney = (d: { earnings: unknown; wage: number | null }) =>
    d.earnings == null && d.wage == null;
  const pendingMoney = (d: { earnings: unknown; wage: number | null }) =>
    source.earningsLoading.value && missingMoney(d);
  const summaryPending = computed(
    () => source.earningsLoading.value && inPeriod.value.some(missingMoney)
  );

  const buckets = computed(() => makeBuckets(inPeriod.value, period.value, now.value));
  const metric = computed<"wage" | "count">(() => (mode.value === "wage" ? "wage" : "count"));
  // Grafikon ima smisla tek sa bar dva stubića sa dostavama (jedan stubić je samo
  // glavni broj nacrtan veliki), i ne dok zarada još stiže (pogrešne visine).
  const chartVisible = computed(
    () =>
      period.value !== "today" &&
      !summaryPending.value &&
      buckets.value.length >= 2 &&
      buckets.value.filter((b) => b.count > 0).length >= 2 &&
      Math.max(0, ...buckets.value.map((b) => (metric.value === "wage" ? b.wage : b.count))) > 0
  );
  const activeBucket = computed(() => buckets.value.find((b) => b.key === bucketKey.value) ?? null);

  // "Najveća zarada" nema smisla bez zarade - tada ostaje vremenski redoslijed. Dok zarada
  // još stiže izbor se zadržava, da lista ne skače između dva oblika.
  const sort = computed<HistorySort>(() =>
    requestedSort.value === "top" && mode.value !== "wage" && !summaryPending.value
      ? "new"
      : requestedSort.value
  );
  const sortOptions = computed(() =>
    HISTORY_SORTS.filter((option) => option.value !== "top" || mode.value === "wage")
  );

  const rows = computed(() =>
    sortRows(filterRows(inPeriod.value, activeBucket.value, text.value), sort.value)
  );
  const filtering = computed(() => Boolean(text.value.trim()) || activeBucket.value != null);
  const filteredWage = computed(() =>
    mode.value === "wage" ? rows.value.reduce((acc, d) => acc + (d.wage ?? 0), 0) : null
  );

  // --- Lista (postepeno iscrtavanje) -------------------------------------------

  const limit = ref(FIRST_ROWS);
  watch([period, bucketKey, text, sort], () => {
    limit.value = FIRST_ROWS;
  });
  const showMore = () => {
    limit.value += MORE_ROWS;
  };

  // Najveća zarada prvo je jedna ravna lista (dani bi samo smetali), ostalo po danima.
  const flat = computed(() => sort.value === "top");
  const list = computed(() => {
    if (flat.value) {
      const shown = rows.value.slice(0, limit.value);
      return { groups: null, flatRows: shown, restGroups: 0, restRows: rows.value.length - shown.length };
    }
    const taken = takeGroups(groupByDay(rows.value, now.value), limit.value);
    return { groups: taken.shown, flatRows: null, restGroups: taken.restGroups, restRows: taken.restRows };
  });

  // Prvi širi period u kome zaista ima dostava (za "Prikaži ..." kad je izabrani prazan).
  const widerTarget = computed<HistoryPeriod | null>(() => {
    let next = widerPeriod(period.value);
    while (next) {
      if (periodRows(source.deliveries.value, next, now.value).length > 0) return next;
      next = widerPeriod(next);
    }
    return null;
  });

  // --- Sažetak -----------------------------------------------------------------

  const trend = computed(() =>
    period.value === "week" && mode.value === "wage" && !summaryPending.value
      ? weekTrend(source.deliveries.value, now.value)
      : null
  );
  const cells = computed(() => summaryCells(summary.value, period.value, mode.value, now.value));
  const range = computed(() => periodRangeLabel(period.value, summary.value, now.value));
  const km = computed(() => totalKm(inPeriod.value));

  // Pojašnjenje ispod glavnog broja kad zbir nije "cio".
  const note = computed<string | null>(() => {
    const s = summary.value;
    if (mode.value === "monthly") {
      return "Zaradu za ove dostave firma obračunava mjesečno, pa ovdje nema iznosa. U Novčaniku vidiš šta si naplatio.";
    }
    if (mode.value === "wage") {
      if (s.missingRows > 0) {
        return `Za ${deliveriesLabel(s.missingRows)} zarada još nije obračunata, pa nije u zbiru.`;
      }
      if (s.monthlyRows > 0) {
        return `${deliveriesLabel(s.monthlyRows)} firma obračunava mjesečno, pa nije u zbiru.`;
      }
      return null;
    }
    // Bez zarade: ako je razlog greška, o tome govori upozorenje na vrhu.
    return source.earningsError.value ? null : "Zarada za ove dostave još nije obračunata.";
  });

  // --- Upozorenja --------------------------------------------------------------

  // Zarada nije stigla, a ovom periodu treba (u "Sedmici" ne smeta što nije stigao
  // opseg "Sve").
  const earningsAlert = computed(
    () =>
      state.value === "ready" &&
      Boolean(source.earningsError.value) &&
      !source.earningsLoading.value &&
      inPeriod.value.some(missingMoney)
  );
  // Istorija nije stigla, a zarada jeste: lista je skromnija (bez restorana i rute).
  const historyAlert = computed(
    () => state.value === "ready" && Boolean(source.historyError.value)
  );

  // --- Zaglavlje ---------------------------------------------------------------

  const periodLabel = computed(
    () => HISTORY_PERIODS.find((p) => p.value === period.value)?.label ?? ""
  );
  const subtitle = computed(() => {
    if (state.value === "loading") return "Učitavam…";
    if (state.value === "error") return "Nije učitano";
    if (state.value === "empty") return "Nema dostava";
    return `${periodLabel.value} · ${
      inPeriod.value.length ? deliveriesLabel(inPeriod.value.length) : "nema dostava"
    }`;
  });

  // --- Akcije ------------------------------------------------------------------

  const setPeriod = (next: HistoryPeriod) => {
    setQuery({
      p: next === DEFAULT_PERIOD ? null : (HISTORY_PERIODS.find((p) => p.value === next)?.query ?? null),
      d: null,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const widen = () => {
    if (widerTarget.value) setPeriod(widerTarget.value);
  };
  const setSort = (next: HistorySort) =>
    setQuery({ s: next === "new" ? null : (HISTORY_SORTS.find((s) => s.value === next)?.query ?? null) });
  const selectBucket = (key: string | null) =>
    setQuery({ d: key && key !== bucketKey.value ? key : null });
  const clearBucket = () => setQuery({ d: null });
  const clearSearch = () => {
    text.value = "";
    setQuery({ q: null });
  };
  const clearFilters = () => {
    text.value = "";
    setQuery({ q: null, d: null, s: null });
  };

  let urlTimer: ReturnType<typeof setTimeout> | null = null;
  watch(text, (value) => {
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => setQuery({ q: value.trim() || null }), URL_DEBOUNCE_MS);
  });

  // Izabrani stubić koji u ovom periodu ne postoji (veza iz drugog perioda) se skida.
  watch(
    [state, buckets, bucketKey],
    () => {
      if (
        state.value === "ready" &&
        bucketKey.value &&
        buckets.value.length > 0 &&
        !activeBucket.value
      ) {
        setQuery({ d: null });
      }
    },
    { flush: "post" }
  );

  // --- Detalj dostave (?o=ID) ---------------------------------------------------

  const openDelivery = computed(() =>
    openId.value != null ? (source.byId.value.get(openId.value) ?? null) : null
  );

  // Dostave kroz koje se kreće dugmadima Novija / Starija: ono što je trenutno u listi.
  const sequence = computed(() => (openDelivery.value ? rows.value : []));
  const sequenceIndex = computed(() =>
    openDelivery.value ? sequence.value.findIndex((d) => d.id === openDelivery.value!.id) : -1
  );
  const neighbour = (towardNewer: boolean) => {
    const i = sequenceIndex.value;
    if (i < 0) return null;
    // U "starije prvo" je novija dostava sljedeća u listi, inače prethodna.
    const step = (sort.value === "old" ? 1 : -1) * (towardNewer ? 1 : -1);
    return sequence.value[i + step] ?? null;
  };
  const newer = computed(() => neighbour(true));
  const older = computed(() => neighbour(false));

  const withDelivery = (id: number) => String(id);
  const openSheet = (id: number) => setQuery({ o: withDelivery(id) }, "push");
  const goToDelivery = (id: number) => setQuery({ o: withDelivery(id) });

  // Ako je prethodni zapis u istoriji ova ista lista (detalj je otvoren iz nje),
  // vraćamo se unazad - tako Nazad na telefonu i X rade isto, a istorija ostaje
  // čista. Kad je detalj otvoren direktno (veza), samo se skida ?o= iz adrese.
  const closeSheet = () => {
    const back = (window.history.state as { back?: string | null } | null)?.back;
    if (back) {
      const [path = "", search = ""] = back.split("?");
      if (path === route.path && !new URLSearchParams(search).has("o")) {
        router.back();
        return;
      }
    }
    setQuery({ o: null });
  };

  // Adresa upućuje na dostavu kojih nema među učitanim podacima: skida se tiho, ali
  // tek kad su oba izvora stigla (dostava može da bude samo u jednom od njih).
  watch(
    [openId, openDelivery, state, () => source.earningsLoading.value],
    () => {
      if (
        openId.value != null &&
        !openDelivery.value &&
        state.value !== "loading" &&
        !source.earningsLoading.value
      ) {
        setQuery({ o: null });
      }
    },
    { flush: "post" }
  );

  // --- Osvježavanje ------------------------------------------------------------

  const refresh = async () => {
    now.value = Date.now();
    await source.refreshAll();
  };

  // "Pokušaj ponovo": ponovi ono što je palo; ako ništa nije palo (npr. nova dostava
  // još nema obračun), osvježi sve.
  const retry = async () => {
    const jobs: Promise<void>[] = [];
    if (source.historyError.value) jobs.push(source.retryHistory());
    if (source.earningsError.value) jobs.push(source.retryEarnings());
    if (jobs.length === 0) jobs.push(source.refreshAll());
    await Promise.all(jobs);
  };

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  const onVisible = () => {
    if (!document.hidden) now.value = Date.now();
  };
  onMounted(() => {
    now.value = Date.now();
    tickTimer = setInterval(() => {
      now.value = Date.now();
    }, NOW_TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  });
  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer);
    if (urlTimer) clearTimeout(urlTimer);
    document.removeEventListener("visibilitychange", onVisible);
  });

  return {
    now,
    state,
    period,
    sort,
    sortOptions,
    text,
    bucketKey,
    inPeriod,
    summary,
    mode,
    summaryPending,
    pendingMoney,
    buckets,
    metric,
    chartVisible,
    activeBucket,
    widerTarget,
    rows,
    filtering,
    filteredWage,
    flat,
    list,
    showMore,
    trend,
    cells,
    range,
    km,
    note,
    earningsAlert,
    historyAlert,
    periodLabel,
    subtitle,
    setPeriod,
    widen,
    setSort,
    selectBucket,
    clearBucket,
    clearSearch,
    clearFilters,
    openId,
    openDelivery,
    sequence,
    sequenceIndex,
    newer,
    older,
    openSheet,
    goToDelivery,
    closeSheet,
    refresh,
    retry,
    money,
  };
};
