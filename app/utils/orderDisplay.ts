import type { Order } from "~/models/Order";
import type { PricingCalculation } from "~/types/pricing";
import { formatAmount } from "~/utils/currency";
import { toLatin } from "~/utils/toLatin";

// Pun lifecycle porudžbine (potvrđeno sa backendom preko odgovora
// /orders/driver/{id}, koji je vratio state: "STATE_CHARGED_DELIVERY"):
//
//   ACCEPTED (2) ─┐
//                 ├─► courier.accept ─► BOOKED_DELIVERY (3)
//   READY (4)    ─┘                          │
//                                             │ geofence <100m od restorana
//                                             ▼
//                                  COURIER_AT_RESTAURANT (11)
//                                             │
//                                             │ courier.pickup
//                                             ▼
//                                   CHARGED_DELIVERY (5)
//                                             │
//                                             │ geofence <100m od naručioca
//                                             ▼
//                                    COURIER_ARRIVED (12)
//                                             │
//                                             │ courier.deliver
//                                             ▼
//                                       DELIVERED (6)
//
// COURIER_AT_RESTAURANT i COURIER_ARRIVED se upisuju automatski na osnovu
// kurirove live lokacije (geofence <100m) - taj automatski upis preko
// lokacije još nije izgrađen, pa se ta dva stanja trenutno ne pojavljuju u
// podacima sa backend-a. U praksi kurir danas vidi/menja samo preostalih 5
// stanja ispod, direktno preko courier.accept/pickup/deliver akcija.
export const ORDER_STATE = {
  ACCEPTED: "STATE_ACCEPTED",
  READY: "STATE_READY",
  BOOKED_DELIVERY: "STATE_BOOKED_DELIVERY",
  COURIER_AT_RESTAURANT: "STATE_COURIER_AT_RESTAURANT",
  CHARGED_DELIVERY: "STATE_CHARGED_DELIVERY",
  COURIER_ARRIVED: "STATE_COURIER_ARRIVED",
  DELIVERED: "STATE_DELIVERED",
} as const;

// Zadržano radi kompatibilnosti sa postojećim pozivima - CHARGED_DELIVERY je
// stanje koje je stvarno potvrđeno sa backendom.
export const ORDER_STATE_PICKED_UP = ORDER_STATE.CHARGED_DELIVERY;
export const ORDER_STATE_DELIVERED = ORDER_STATE.DELIVERED;

// "Preuzeto" znači da kurir već ima paket kod sebe - važi od CHARGED_DELIVERY
// nadalje (uključujući budući COURIER_ARRIVED) sve do DELIVERED.
export const isOrderPickedUp = (order: Order) =>
  order.state === ORDER_STATE.CHARGED_DELIVERY || order.state === ORDER_STATE.COURIER_ARRIVED;
export const isOrderDelivered = (order: Order) => order.state === ORDER_STATE.DELIVERED;

// Backend potvrdio (14.08, stavka 3.5): aktivna narudžba kurira je eksplicitno
// jedno od stanja u toku - ne osloniti se na pretpostavku da /orders/driver/{id}
// vraća najviše jednu (numeracija stanja nije sekvencijalna). Geofence stanja
// (COURIER_AT_RESTAURANT, COURIER_ARRIVED) backend još ne šalje, ali čim počne
// dostava i ruta ne smiju da nestanu sa ekrana - zato su već ovdje.
const ACTIVE_ORDER_STATES: ReadonlySet<string> = new Set([
  ORDER_STATE.BOOKED_DELIVERY,
  ORDER_STATE.COURIER_AT_RESTAURANT,
  ORDER_STATE.CHARGED_DELIVERY,
  ORDER_STATE.COURIER_ARRIVED,
]);
export const isOrderActive = (order: Order) => ACTIVE_ORDER_STATES.has(order.state ?? "");

// Labela za aktivnu dostavu (npr. kartica "Sljedeće" u ActivePanel) - svako stanje u
// toku ima sopstveni tekst umesto starog binarnog "Ide po paket"/"U dostavi".
const ACTIVE_ORDER_STATE_LABELS: Record<string, string> = {
  [ORDER_STATE.BOOKED_DELIVERY]: "Ide po paket",
  [ORDER_STATE.COURIER_AT_RESTAURANT]: "Stigao u restoran",
  [ORDER_STATE.CHARGED_DELIVERY]: "U dostavi",
  [ORDER_STATE.COURIER_ARRIVED]: "Stigao kod naručioca",
};

export const activeOrderStateLabel = (order: Order) =>
  ACTIVE_ORDER_STATE_LABELS[order.state ?? ""] ?? (isOrderPickedUp(order) ? "U dostavi" : "Ide po paket");

// Kurirske stranice uvijek prikazuju "KM" (currency.ts) - sirova valuta iz
// odgovora je bila "" na ponudama i "BAM" iz /pricing/calculate, pa su susjedne
// kartice pisale različito.
export const formatPrice = (order: Order) =>
  order.deliveryPrice !== null ? formatAmount(Number(order.deliveryPrice)) : "n/a";

// Cena za kurira se ne čita sa backend-a (delivery_price je trenutno uvek 0) -
// računa se preko /pricing/calculate iz koordinata restorana i naručioca,
// vidi useOrderDeliveryPrice.
export const formatCalculatedPrice = (calculation: PricingCalculation | null, loading: boolean) => {
  if (loading) return "...";
  if (!calculation) return "n/a";
  return formatAmount(calculation.total);
};

// Nazivi/adrese/gradovi mogu stići ćirilicom sa backend-a - prikaz je uvijek
// latinica (vidi ~/utils/toLatin), pa svaki string ovdje prolazi kroz toLatin.
export const restaurantLabel = (order: Order) =>
  toLatin(order.restaurant?.name) || `Restoran #${order.restaurantId ?? "n/a"}`;

export const restaurantAddress = (order: Order) => {
  const parts = [order.restaurant?.address, order.restaurant?.city?.name]
    .map((part) => toLatin(part))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
};

export const locationLabel = (order: Order) =>
  toLatin(order.location?.address) || `Lokacija #${order.locationId ?? "n/a"}`;

export const locationCity = (order: Order) => toLatin(order.location?.city?.name) || null;

// "Vuka Karadžića, Banja Luka, Bosnia..." -> "Vuka Karadžića" (u redu liste treba
// samo ulica, pun naziv je u detalju dostave).
export const streetOf = (address: string | null | undefined): string | null => {
  const first = toLatin(address).split(",")[0]?.trim();
  return first || null;
};

// Stan / sprat / firma kao kratki čipovi ("Stan 12", "Sprat 3", "Studio Mak d.o.o.")
// - kurir ih traži očima na vratima. Backend šalje sirovu vrijednost ("12"); ako
// je već napisana riječima ("Prizemlje", "Stan 12"), ostaje kakva jest.
const BARE_NUMBER = /^\d+[a-zA-Z]?([/-]\d+[a-zA-Z]?)?$/;
const unitChip = (label: string, value: string | null | undefined) => {
  const text = toLatin(value).trim();
  if (!text) return null;
  return BARE_NUMBER.test(text) ? `${label} ${text}` : text;
};

// Dijelovi posebno: stan i sprat idu uz ulicu u naslovu, firma u drugom redu.
export const deliveryUnitParts = (order: Order) => ({
  apartment: unitChip("Stan", order.location?.apartment),
  floor: unitChip("Sprat", order.location?.floor),
  firm: toLatin(order.location?.firm).trim() || null,
});

export const deliveryUnitChips = (order: Order): string[] => {
  const { apartment, floor, firm } = deliveryUnitParts(order);
  return [apartment, floor, firm].filter((chip): chip is string => Boolean(chip));
};

// Drugi red adrese kupca: "Banja Luka · 78000".
export const customerCityLine = (order: Order) =>
  [locationCity(order), toLatin(order.location?.zip).trim() || null].filter(Boolean).join(" · ") ||
  null;

// Pun tekst adrese za pretragu u navigaciji i kopiranje (kad nema koordinata).
export const customerFullAddress = (order: Order) =>
  [toLatin(order.location?.address), locationCity(order), toLatin(order.location?.zip)]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");

export const restaurantFullAddress = (order: Order) =>
  [toLatin(order.restaurant?.name), restaurantAddress(order)]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");

// Način plaćanja nije u odgovoru dok backend ne potvrdi vrijednosti (B1) -
// poznate prevodimo, nepoznate ostavljamo kakve jesu.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Gotovinom",
  card: "Karticom",
  online: "Plaćeno online",
};
export const paymentMethodLabel = (method: string | null | undefined) => {
  const key = (method ?? "").trim().toLowerCase();
  return key ? (PAYMENT_METHOD_LABELS[key] ?? method!.trim()) : null;
};
