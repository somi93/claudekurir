import type { HistoryEntry, Order } from "~/models/Order";
import type { OrderEarnings } from "~/types/earnings";
import type { CourierDelivery, PayMode } from "~/types/courier-delivery";
import { parseTimestamp } from "~/utils/datetime";
import { locationCity, streetOf } from "~/utils/orderDisplay";
import { foldForSearch } from "~/utils/searchFold";
import { toLatin } from "~/utils/toLatin";

// Pravilo iz dokumentacije (types/earnings.ts): pay_rate_label je null samo kad se
// kuriru plaća mjesečno. Bez reda u /earnings način obračuna nije poznat.
const payModeOf = (earnings: OrderEarnings | null): PayMode => {
  if (!earnings) return "unknown";
  return earnings.payRateLabel == null ? "monthly" : "delivery";
};

const makeDelivery = (
  id: number,
  ts: number | null,
  order: Order | null,
  earnings: OrderEarnings | null
): CourierDelivery => {
  const payMode = payModeOf(earnings);
  const restaurant = toLatin(order?.restaurant?.name).trim() || null;
  const address = toLatin(order?.location?.address).trim() || null;
  const city = order ? locationCity(order) : null;
  const restaurantCity = toLatin(order?.restaurant?.city?.name).trim();
  const crossCity = Boolean(
    city && restaurantCity && foldForSearch(city) !== foldForSearch(restaurantCity)
  );

  // Zarada: iz /earnings po dostavi; bez tog reda koristi se courier_earning sa
  // same narudžbe ako ga backend pošalje (Dio 3 dokumenta od 03.10.).
  let wage: number | null = null;
  if (payMode === "delivery") wage = earnings?.wage ?? null;
  else if (payMode === "unknown") wage = order?.courierEarning ?? null;

  return {
    id,
    ts,
    order,
    earnings,
    restaurant,
    address,
    street: streetOf(order?.location?.address),
    city,
    crossCity,
    payMode,
    wage,
    collected: earnings?.collectedFromCustomer ?? null,
    search: foldForSearch([restaurant, address, city, `#${id}`].filter(Boolean).join(" ")),
  };
};

// Spaja istoriju i zaradu po broju narudžbe.
// - Osnova su redovi iz istorije; vrijeme je delivered_at, a kad njega nema (ili
//   je nečitljivo) datum iz /earnings.
// - Redovi iz /earnings kojih nema u istoriji (istorija nije stigla, ili je red
//   starije dostave) ulaze kao skromniji redovi - bez restorana i rute. Tako lista
//   i zbirovi pokrivaju sve što Novčanik zna, pa se brojevi u dva ekrana slažu.
// - Isti broj narudžbe dvaput: ostaje red sa kasnijim vremenom.
export const buildDeliveries = (
  history: readonly HistoryEntry[],
  earnings: readonly OrderEarnings[]
): CourierDelivery[] => {
  const earningsById = new Map<number, OrderEarnings>();
  for (const row of earnings) {
    if (Number.isFinite(row.orderId)) earningsById.set(row.orderId, row);
  }

  const out = new Map<number, CourierDelivery>();
  for (const entry of history) {
    const id = entry.order.id;
    const matched = earningsById.get(id) ?? null;
    const ts = entry.deliveredAt ?? parseTimestamp(matched?.date);
    const previous = out.get(id);
    if (previous && (previous.ts ?? 0) >= (ts ?? 0)) continue;
    out.set(id, makeDelivery(id, ts, entry.order, matched));
  }

  for (const [id, row] of earningsById) {
    if (!out.has(id)) out.set(id, makeDelivery(id, parseTimestamp(row.date), null, row));
  }

  return [...out.values()];
};
