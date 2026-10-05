import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import {
  rosterCounts,
  filterRoster,
  parseFlags,
  parseLive,
  parseSort,
  sortRoster,
  FLAG_ORDER,
  type RosterCourier,
  type RosterFlag,
  type RosterLive,
  type RosterSort,
} from "~/utils/courierRoster";

// Lista i detalj se na računaru vide zajedno; ispod ove širine detalj je zasebna stranica.
export const WIDE_QUERY = "(min-width: 1100px)";
// Redova u jednom prolazu: lista se filtrira i sortira na klijentu, a iscrtava po dio.
export const PAGE_ROWS = 12;
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

// Pogled na listu: izabrani kurir (?c), pretraga (?q), filteri (?f = stanje uživo i oznake pažnje,
// odvojeni zarezom) i redoslijed (?o) žive u adresi. Tako povratak sa Finansija vraća isti pogled,
// dugme Nazad na telefonu zatvara detalj, a veza ka kuriru može da se pošalje dalje. Filteri se
// upisuju sa replace (istorija ostaje čista); otvaranje detalja na telefonu je push.
export const useRosterView = (roster: Ref<RosterCourier[]>, now: Ref<number>) => {
  const route = useRoute();
  const router = useRouter();

  const live = computed<RosterLive>(() => {
    const tokens = (queryString(route.query.f) ?? "").split(",");
    return parseLive(tokens.find((t) => t === "delivering" || t === "online" || t === "offline"));
  });
  const flags = computed<RosterFlag[]>(() => parseFlags(queryString(route.query.f)));
  const sort = computed<RosterSort>(() => parseSort(queryString(route.query.o)));
  const selectedId = computed(() => queryId(route.query.c));
  // Tekst pretrage je lokalan (da kucanje ne čeka router); u adresu ide s odgodom.
  const q = ref(queryString(route.query.q) ?? "");

  const shown = ref(PAGE_ROWS);
  // Tek dodat kurir ostaje na vrhu liste dok dispečer ne promijeni pretragu, filter ili redoslijed.
  const pinId = ref<number | null>(null);

  const select = ref(false);
  const picked = ref<Set<number>>(new Set());

  const setQuery = (patch: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
    const next: Record<string, unknown> = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") delete next[key];
      else next[key] = value;
    }
    void router[mode]({ query: next as Record<string, string | string[]> });
  };

  const encodeFilter = (l: RosterLive, f: RosterFlag[]) => {
    const parts = [...(l === "all" ? [] : [l]), ...FLAG_ORDER.filter((x) => f.includes(x))];
    return parts.join(",") || null;
  };

  const resetPaging = () => {
    shown.value = PAGE_ROWS;
    pinId.value = null;
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

  const setLive = (next: RosterLive) => {
    resetPaging();
    setQuery({ f: encodeFilter(live.value === next ? "all" : next, flags.value) });
  };

  const toggleFlag = (flag: RosterFlag) => {
    resetPaging();
    const f = flags.value.includes(flag) ? flags.value.filter((x) => x !== flag) : [...flags.value, flag];
    setQuery({ f: encodeFilter(live.value, f) });
  };

  const setSort = (next: RosterSort) => {
    resetPaging();
    setQuery({ o: next === "live" ? null : next });
  };

  const hasFilter = computed(
    () => live.value !== "all" || flags.value.length > 0 || Boolean(q.value.trim())
  );

  const reset = () => {
    resetPaging();
    q.value = "";
    setQuery({ q: null, f: null });
  };

  // Brojevi se računaju iz cijele liste, ne iz filtriranog dijela, pa ostaju stabilni.
  const totals = computed(() => rosterCounts(roster.value, now.value));

  const matched = computed(() => {
    const list = sortRoster(
      filterRoster(roster.value, { q: q.value, live: live.value, flags: flags.value }, now.value),
      sort.value,
      now.value
    );
    const pin = pinId.value != null ? roster.value.find((c) => c.id === pinId.value) : null;
    return pin ? [pin, ...list.filter((c) => c.id !== pin.id)] : list;
  });

  const visible = computed(() => matched.value.slice(0, shown.value));
  const more = () => {
    shown.value += PAGE_ROWS;
  };

  const selected = computed(() =>
    selectedId.value == null ? null : (roster.value.find((c) => c.id === selectedId.value) ?? null)
  );

  const isWide = () => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches;

  // Na računaru se izbor mijenja strelicama pa je replace; na telefonu je detalj stranica pa je push.
  const open = (id: number) => {
    if (pinId.value != null && pinId.value !== id) pinId.value = null;
    setQuery({ c: String(id) }, isWide() ? "replace" : "push");
  };

  // Zatvaranje detalja: ako je prethodni zapis ista stranica bez ?c, vraća se unazad (telefon),
  // inače se samo skida ?c iz adrese.
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

  // Tek dodat kurir: filteri i pretraga se skidaju da bi se vidio, stoji na vrhu liste i izabran je.
  const showNew = async (id: number) => {
    q.value = "";
    await nextTick(); // pretraga resetuje listu, pa se oznaka postavlja tek poslije
    shown.value = PAGE_ROWS;
    pinId.value = id;
    setQuery({ q: null, f: null, c: String(id) }, isWide() ? "replace" : "push");
  };

  const togglePick = (id: number) => {
    const next = new Set(picked.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    picked.value = next;
  };

  const startSelect = () => {
    select.value = true;
  };
  const endSelect = () => {
    select.value = false;
    picked.value = new Set();
  };

  // Kurir koji je uklonjen iz firme ne smije ostati izabran u adresi.
  watch(
    [roster, selectedId],
    ([list, id]) => {
      if (id != null && list.length > 0 && !list.some((c) => c.id === id)) setQuery({ c: null });
    },
    { flush: "post" }
  );

  return {
    q,
    live,
    flags,
    sort,
    selectedId,
    selected,
    shown,
    pinId,
    select,
    picked,
    totals,
    matched,
    visible,
    hasFilter,
    setLive,
    toggleFlag,
    setSort,
    reset,
    more,
    open,
    close,
    togglePick,
    showNew,
    startSelect,
    endSelect,
    setQuery,
  };
};
