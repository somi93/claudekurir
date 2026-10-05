import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import { PAGE_ROWS, WIDE_QUERY } from "~/composables/useRosterView";
import {
  filterRestaurants,
  parseRestaurantFilter,
  restaurantCounts,
  type RestaurantFilter,
} from "~/utils/restaurantCooperation";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

export type CompanyTab = "settings" | "restaurants";

// Spisak i detalj (ili editor) se na računaru vide zajedno; ispod granice WIDE_QUERY detalj restorana
// je zasebna stranica, a editor postavke donji list. Granica i broj redova po prolazu (PAGE_ROWS)
// su isti kao na stranici Kuriri, pa se uzimaju odatle.
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

// Širina: na računaru su spisak i panel uz jedno drugo. Računar je zadano stanje (dispečeri rade
// uglavnom na računaru), pa se prije mjerenja pretpostavlja široko.
export const useWideLayout = () => {
  const wide = ref(true);
  let mq: MediaQueryList | null = null;
  const sync = () => {
    wide.value = mq?.matches ?? true;
  };
  onMounted(() => {
    mq = window.matchMedia(WIDE_QUERY);
    sync();
    mq.addEventListener("change", sync);
  });
  onBeforeUnmount(() => mq?.removeEventListener("change", sync));
  return wide;
};

// Pogled na stranicu Firma: tab (?t=restorani), izabrani restoran (?r), filter (?f), pretraga (?q).
// Tako povratak sa druge stranice vraća isti pogled, dugme Nazad na telefonu zatvara detalj
// restorana, a veza ka restoranu može da se pošalje dalje. Filter i pretraga se upisuju sa replace
// (istorija ostaje čista); otvaranje detalja na telefonu je push.
export const useCompanyView = (
  restaurants: Ref<RestaurantCooperation[]>,
  companyCurrency: Ref<string>
) => {
  const route = useRoute();
  const router = useRouter();

  const tab = computed<CompanyTab>(() =>
    queryString(route.query.t) === "restorani" ? "restaurants" : "settings"
  );
  const filter = computed<RestaurantFilter>(() => parseRestaurantFilter(route.query.f));
  const selectedId = computed(() => queryId(route.query.r));
  // Tekst pretrage je lokalan (da kucanje ne čeka router); u adresu ide s odgodom.
  const q = ref(queryString(route.query.q) ?? "");

  const shown = ref(PAGE_ROWS);

  const setQuery = (patch: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
    const next: Record<string, unknown> = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") delete next[key];
      else next[key] = value;
    }
    void router[mode]({ query: next as Record<string, string | string[]> });
  };

  const resetPaging = () => {
    shown.value = PAGE_ROWS;
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

  const setTab = (next: CompanyTab) => {
    setQuery({ t: next === "restaurants" ? "restorani" : null });
  };

  const setFilter = (next: RestaurantFilter) => {
    resetPaging();
    setQuery({ f: filter.value === next || next === "all" ? null : next });
  };

  const hasFilter = computed(() => filter.value !== "all" || Boolean(q.value.trim()));

  const reset = () => {
    resetPaging();
    q.value = "";
    setQuery({ q: null, f: null });
  };

  // Brojevi su iz cijele liste, ne iz filtriranog dijela, pa ostaju stabilni dok se filtrira.
  const counts = computed(() => restaurantCounts(restaurants.value, companyCurrency.value));

  const matched = computed(() =>
    filterRestaurants(restaurants.value, { q: q.value, filter: filter.value }, companyCurrency.value)
  );
  const visible = computed(() => matched.value.slice(0, shown.value));
  const more = () => {
    shown.value += PAGE_ROWS;
  };

  const selected = computed(() =>
    selectedId.value == null
      ? null
      : (restaurants.value.find((r) => r.id === selectedId.value) ?? null)
  );

  const isWide = () => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches;

  // Na računaru se izbor mijenja strelicama pa je replace; na telefonu je detalj stranica pa je push.
  const open = (id: number) => {
    setQuery({ r: String(id) }, isWide() ? "replace" : "push");
  };

  // Zatvaranje detalja: ako je prethodni zapis ista stranica bez ?r, vraća se unazad (telefon),
  // inače se samo skida ?r iz adrese.
  const close = () => {
    const back = (window.history.state as { back?: string | null } | null)?.back;
    if (back) {
      const [path = "", search = ""] = back.split("?");
      if (path === route.path && !new URLSearchParams(search).has("r")) {
        router.back();
        return;
      }
    }
    setQuery({ r: null }, "replace");
  };

  // Restoran koji se više ne nalazi na listi (druga firma, uklonjena veza) ne smije ostati izabran u adresi.
  watch(
    [restaurants, selectedId],
    ([list, id]) => {
      if (id != null && list.length > 0 && !list.some((r) => r.id === id)) setQuery({ r: null });
    },
    { flush: "post" }
  );

  // Poslije promjene filtera ili pretrage prvi prolaz je opet kratak.
  watch(filter, () => void nextTick(resetPaging));

  return {
    tab,
    filter,
    q,
    selectedId,
    selected,
    shown,
    counts,
    matched,
    visible,
    hasFilter,
    setTab,
    setFilter,
    reset,
    more,
    open,
    close,
    setQuery,
  };
};
