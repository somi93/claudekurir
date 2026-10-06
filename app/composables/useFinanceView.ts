import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import { WIDE_QUERY } from "~/composables/useRosterView";
import {
  counts,
  filterBook,
  parseFilter,
  parseJournalType,
  parsePeriod,
  parseSort,
  periodRange,
  sortBook,
  validDay,
  type CashFilter,
  type CashRow,
  type CashSort,
  type JournalPeriod,
  type JournalType,
} from "~/utils/cashDesk";

export type FinanceTab = "stanje" | "promet";

// Redova spiska u jednom prolazu: spisak se filtrira i sortira na klijentu, a iscrtava po dio.
export const BOOK_ROWS = 12;
export const BOOK_MORE = 24;
// Stavki prometa u jednom prolazu (server ne straniči, B3 u dokumentu od 06.10.).
export const JOURNAL_ROWS = 40;
// Pretraga se upisuje u adresu tek kad dispečer stane sa kucanjem.
const URL_DEBOUNCE_MS = 250;

const queryString = (raw: unknown): string | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value ? value : null;
};

const queryId = (raw: unknown): number | null => {
  const id = Number(queryString(raw));
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Pogled na Finansije živi u adresi: ?t (stanje | promet), ?c (kurir), ?f ?q ?o (filter, pretraga, redoslijed),
// a za Promet ?p (period), ?pf i ?pt (Od–do), ?k (vrsta), ?kc (kurir), ?d=1 (samo razlike). Nepoznata vrijednost
// je zadana. Tako dugme Nazad na telefonu zatvara detalj, povratak sa Kuriri vraća isti pogled, a veza ka
// kuriru ("Pogledaj novac", /dispatcher/finance?c=ID) može da se pošalje dalje. Filteri se upisuju sa replace
// (istorija ostaje čista); otvaranje detalja na telefonu je push.
export const useFinanceView = (book: Ref<CashRow[]>, ready: Ref<boolean>, now: Ref<number>) => {
  const route = useRoute();
  const router = useRouter();

  const tab = computed<FinanceTab>(() => (queryString(route.query.t) === "promet" ? "promet" : "stanje"));
  const selectedId = computed(() => queryId(route.query.c));
  const filter = computed<CashFilter>(() => parseFilter(queryString(route.query.f)));
  const sort = computed<CashSort>(() => parseSort(queryString(route.query.o)));
  // Tekst pretrage je lokalan (da kucanje ne čeka router); u adresu ide s odgodom.
  const q = ref(queryString(route.query.q) ?? "");
  const shown = ref(BOOK_ROWS);

  const period = computed<JournalPeriod>(() => parsePeriod(queryString(route.query.p)));
  const jType = computed<JournalType>(() => parseJournalType(queryString(route.query.k)));
  const jCourier = computed(() => queryId(route.query.kc));
  const diffOnly = computed(() => queryString(route.query.d) === "1");
  const jShown = ref(JOURNAL_ROWS);

  const range = computed(() => {
    if (period.value !== "custom") return periodRange(period.value, now.value);
    const base = periodRange("7d", now.value);
    let from = validDay(queryString(route.query.pf)) || base.from;
    let to = validDay(queryString(route.query.pt)) || base.to;
    if (from > to) [from, to] = [to, from];
    return { from, to };
  });

  const setQuery = (patch: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
    const next: Record<string, unknown> = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") delete next[key];
      else next[key] = value;
    }
    void router[mode]({ query: next as Record<string, string | string[]> });
  };

  const resetPaging = () => {
    shown.value = BOOK_ROWS;
  };

  let urlTimer: ReturnType<typeof setTimeout> | null = null;
  watch(q, (value) => {
    resetPaging();
    if (urlTimer) clearTimeout(urlTimer);
    urlTimer = setTimeout(() => setQuery({ q: value.trim() || null }), URL_DEBOUNCE_MS);
  });
  onBeforeUnmount(() => {
    if (urlTimer) clearTimeout(urlTimer);
  });

  // Adresa se promijenila spolja (dugme Nazad, veza): tekst pretrage ide za njom.
  watch(
    () => queryString(route.query.q) ?? "",
    (value) => {
      if (value !== q.value.trim()) q.value = value;
    }
  );

  // --- Stanje --------------------------------------------------------------------------------

  const isWide = () => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches;

  // Izbor "Čeka potvrdu" prebacuje redoslijed na najstariju predaju, a odlazak sa njega vraća zadani.
  const sortFor = (next: CashFilter): string | null => {
    if (next === "pending") return "age";
    return sort.value === "age" ? null : sort.value === "debt" ? null : sort.value;
  };

  const setFilter = (next: CashFilter, extra: Record<string, string | null> = {}) => {
    resetPaging();
    setQuery({ f: next === "all" ? null : next, o: sortFor(next), ...extra });
  };

  // Pločica: druga pritisnuta gasi filter. "Čeka potvrdu" na računaru još i zatvara detalj da se vidi red predaja.
  const toggleKpi = (key: Exclude<CashFilter, "all" | "limit" | "zero">) => {
    const next: CashFilter = filter.value === key ? "all" : key;
    setFilter(next, next === "pending" && isWide() ? { c: null } : {});
  };

  const setSort = (next: CashSort) => {
    resetPaging();
    setQuery({ o: next === "debt" ? null : next });
  };

  const hasFilter = computed(() => filter.value !== "all" || Boolean(q.value.trim()));

  const reset = () => {
    resetPaging();
    q.value = "";
    setQuery({ q: null, f: null, o: null });
  };

  const totals = computed(() => counts(book.value, now.value));

  const matched = computed(() => sortBook(filterBook(book.value, { q: q.value, filter: filter.value }), sort.value));
  const visible = computed(() => matched.value.slice(0, shown.value));
  const more = () => {
    shown.value += BOOK_MORE;
  };

  const selected = computed(() => (selectedId.value == null ? null : (book.value.find((r) => r.id === selectedId.value) ?? null)));

  // Na računaru se izbor mijenja strelicama pa je replace; na telefonu je detalj stranica pa je push.
  const open = (id: number) => {
    setQuery({ c: String(id) }, isWide() ? "replace" : "push");
  };

  // Zatvaranje detalja: ako je prethodni zapis ista stranica bez ?c, vraća se unazad (telefon), inače se
  // samo skida ?c iz adrese.
  const close = () => {
    const back = (window.history.state as { back?: string | null } | null)?.back;
    if (back) {
      const [path = "", search = ""] = back.split("?");
      if (path === route.path && !new URLSearchParams(search).has("c")) {
        router.back();
        return;
      }
    }
    setQuery({ c: null }, "replace");
  };

  const setTab = (next: FinanceTab) => {
    if (next === tab.value) return;
    // Promet se otvara bez izabranog kurira u adresi: izbor kurira za Promet je ?kc.
    setQuery({ t: next === "promet" ? "promet" : null, c: null });
  };

  // Detalj kurira -> Promet samo za njega.
  const openJournalFor = (courierId: number) => {
    jShown.value = JOURNAL_ROWS;
    setQuery({ t: "promet", kc: String(courierId), c: null });
  };

  // Stavka prometa -> detalj kurira na Stanju (filteri i pretraga se skidaju da se kurir vidi).
  const showCourier = (courierId: number) => {
    resetPaging();
    q.value = "";
    setQuery({ t: null, q: null, f: null, o: null, c: String(courierId) }, isWide() ? "replace" : "push");
  };

  // --- Promet ---------------------------------------------------------------------------------

  const setPeriod = (next: JournalPeriod) => {
    jShown.value = JOURNAL_ROWS;
    if (next === "custom") {
      const base = periodRange("7d", now.value);
      setQuery({ p: "custom", pf: validDay(queryString(route.query.pf)) || base.from, pt: validDay(queryString(route.query.pt)) || base.to });
    } else setQuery({ p: next === "7d" ? null : next, pf: null, pt: null });
  };

  const setCustomDay = (which: "from" | "to", value: string) => {
    jShown.value = JOURNAL_ROWS;
    const day = validDay(value);
    if (!day) return;
    const r = range.value;
    let from = which === "from" ? day : r.from;
    let to = which === "to" ? day : r.to;
    if (from > to) [from, to] = [to, from];
    setQuery({ p: "custom", pf: from, pt: to });
  };

  const setJType = (next: JournalType) => {
    jShown.value = JOURNAL_ROWS;
    setQuery({ k: next === "all" ? null : next });
  };

  const toggleDiff = () => {
    jShown.value = JOURNAL_ROWS;
    setQuery({ d: diffOnly.value ? null : "1" });
  };

  const setJCourier = (id: number | null) => {
    jShown.value = JOURNAL_ROWS;
    setQuery({ kc: id == null ? null : String(id) });
  };

  const jMore = () => {
    jShown.value += JOURNAL_ROWS;
  };

  const jReset = () => {
    jShown.value = JOURNAL_ROWS;
    setQuery({ p: null, pf: null, pt: null, k: null, kc: null, d: null });
  };

  // Kurir koji nije u spisku (uklonjen) ne smije ostati izabran u adresi.
  watch(
    [book, selectedId, ready],
    ([list, id, isReady]) => {
      if (isReady && id != null && list.length > 0 && !list.some((r) => r.id === id)) setQuery({ c: null });
    },
    { flush: "post" }
  );

  return {
    tab,
    selectedId,
    selected,
    q,
    filter,
    sort,
    shown,
    totals,
    matched,
    visible,
    hasFilter,
    setFilter,
    toggleKpi,
    setSort,
    reset,
    more,
    open,
    close,
    setTab,
    openJournalFor,
    showCourier,
    period,
    range,
    jType,
    jCourier,
    diffOnly,
    jShown,
    setPeriod,
    setCustomDay,
    setJType,
    toggleDiff,
    setJCourier,
    jMore,
    jReset,
    setQuery,
  };
};
