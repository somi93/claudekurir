import { resolveCurrency } from "~/utils/currency";
import { foldForSearch, searchNeedle } from "~/utils/searchFold";
import { toLatin } from "~/utils/toLatin";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// Valuta restorana (odgovor 2.2) se od 01.09 vraća po redu. Ako je postavljena i
// razlikuje se od valute firme, vraćamo je za prikaz upozorenja - dispečer da
// zna prije nego uključi saradnju da cijene neće biti u istoj valuti. Bez
// restaurant_currency (stari zapis) nema šta da se poredi. Koristi ga i lista
// (RestaurantRow) i detalj restorana (RestaurantDetail).
export const currencyMismatch = (
  restaurant: RestaurantCooperation,
  companyCurrency: string
): string | null => {
  if (!restaurant.restaurant_currency?.trim()) return null;
  const restaurantCurrency = resolveCurrency(restaurant.restaurant_currency);
  return restaurantCurrency !== resolveCurrency(companyCurrency) ? restaurantCurrency : null;
};

// --- Stanje saradnje ------------------------------------------------------------------------

// Jedan izvor za red, filter, brojač i detalj. Redoslijed prednosti je isti kao i do sada: sopstvena
// dostava, pa NAŠA suspenzija (active_restoran = false), pa odluka restorana (active_company =
// false), pa aktivna. Kad su oba prekidača isključena, vrijedi naša suspenzija - poruka o odluci
// restorana joj ne smije protivrječiti. active_restoran mijenja dispečer (PATCH), active_company
// mijenja restoran nezavisno od ovog API-ja.
export type CoopState = "active" | "ours" | "theirs" | "internal";

export const coopState = (restaurant: RestaurantCooperation): CoopState =>
  restaurant.internal
    ? "internal"
    : !restaurant.active_restoran
      ? "ours"
      : !restaurant.active_company
        ? "theirs"
        : "active";

// Tamni tekst na blagom tonu (≥ 4.5 : 1), tačka stanja u jačoj boji.
export const COOP_META: Record<
  CoopState,
  { label: string; tint: string; ink: string; dot: string }
> = {
  active: { label: "Aktivna saradnja", tint: "#e3f8ef", ink: "#00734f", dot: "#00b37e" },
  ours: { label: "Suspendovali ste", tint: "#fde8e6", ink: "#b42318", dot: "#e5484d" },
  theirs: { label: "Isključio vas je restoran", tint: "#fff2df", ink: "#9a4a07", dot: "#e08a14" },
  internal: { label: "Sopstvena dostava", tint: "#f1f3f6", ink: "#46505f", dot: "#8a94a3" },
};

export type RestaurantFilter = "all" | CoopState | "currency";

export const RESTAURANT_FILTER_ORDER: RestaurantFilter[] = [
  "all",
  "active",
  "ours",
  "theirs",
  "internal",
  "currency",
];

export const parseRestaurantFilter = (raw: unknown): RestaurantFilter => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return RESTAURANT_FILTER_ORDER.includes(value as RestaurantFilter)
    ? (value as RestaurantFilter)
    : "all";
};

export type RestaurantCounts = Record<RestaurantFilter, number>;

// Restoran sa sopstvenom dostavom nema šta da se poredi (nema prave firme), pa ne ulazi u "drugu valutu".
export const inOtherCurrency = (restaurant: RestaurantCooperation, companyCurrency: string): boolean =>
  !restaurant.internal && currencyMismatch(restaurant, companyCurrency) !== null;

// Brojevi su iz cijele liste (ne iz filtriranog dijela), pa ostaju stabilni dok se filtrira.
export const restaurantCounts = (
  list: RestaurantCooperation[],
  companyCurrency: string
): RestaurantCounts => {
  const counts: RestaurantCounts = {
    all: list.length,
    active: 0,
    ours: 0,
    theirs: 0,
    internal: 0,
    currency: 0,
  };
  for (const restaurant of list) {
    counts[coopState(restaurant)] += 1;
    if (inOtherCurrency(restaurant, companyCurrency)) counts.currency += 1;
  }
  return counts;
};

// Pretraga bez dijakritika i ćirilice, po nazivu i po broju restorana (sa "#" i bez).
export const filterRestaurants = (
  list: RestaurantCooperation[],
  query: { q: string; filter: RestaurantFilter },
  companyCurrency: string
): RestaurantCooperation[] => {
  const needle = searchNeedle(query.q);
  return list.filter((restaurant) => {
    if (query.filter === "currency") {
      if (!inOtherCurrency(restaurant, companyCurrency)) return false;
    } else if (query.filter !== "all" && coopState(restaurant) !== query.filter) {
      return false;
    }
    if (!needle) return true;
    return (
      foldForSearch(toLatin(restaurant.restaurant_name)).includes(needle) ||
      String(restaurant.restaurant_id).includes(needle)
    );
  });
};

// "3. 9. 2026." ili "" kad backend ne vrati datum.
export const startDateText = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sr-RS");
};
