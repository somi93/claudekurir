import {
  formatClockTime,
  formatMinutesDuration,
  formatShortDateIfNotToday,
  formatWaitingDuration,
} from "~/utils/datetime";
import { isLateDelivery, isScheduledOrder, restaurantWaitTier } from "~/utils/dispatchBoard";
import { toLatin } from "~/utils/toLatin";
import type { WaitingOrder } from "~/models/WaitingOrder";
import type { ActiveDelivery } from "~/models/ActiveDelivery";
import type { PendingRestaurantOrder } from "~/models/PendingRestaurantOrder";

// Prikazni helperi za "Dodela narudžbi" tabove - izvučeni iz DispatchBoardPanel
// da ih dijele sve tab komponente (Board*Tab.vue).

export type Timing = { text: string; cssClass: string };

// Pretraga po nazivu restorana (latinični prikaz) ili #ID - isti obrazac na
// svakom tabu.
export const orderMatchesSearch = (query: string, restaurantName: string, id: number) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return toLatin(restaurantName).toLowerCase().includes(q) || String(id).includes(q);
};

// "Naručeno u HH:MM" (+ datum ako nije danas). Prazan string za nevalidan datum
// - pozivalac tada izostavi segment.
export const orderedAtLabel = (order: { orderedAt: string }) => {
  const time = formatClockTime(order.orderedAt);
  if (!time) return "";
  const date = formatShortDateIfNotToday(order.orderedAt);
  return date ? `Naručeno ${date} u ${time}` : `Naručeno u ${time}`;
};

export const readyLabel = (order: WaitingOrder) => {
  if (order.status === "ready") return "hrana gotova - čeka preuzimanje";
  if (order.readyInMinutes <= 0) return "restoran prihvatio - gotovo uskoro";
  return `restoran prihvatio - gotovo za ~${order.readyInMinutes} min`;
};

export const waitingTiming = (order: WaitingOrder): Timing => {
  if (isLateDelivery(order.minutesUntilDelivery)) {
    return {
      text: `Kasni ${formatMinutesDuration(order.minutesUntilDelivery)}`,
      cssClass: "timing-late",
    };
  }
  if (isScheduledOrder(order)) {
    return {
      text: `Zakazano · za ${formatMinutesDuration(order.minutesUntilDelivery)}`,
      cssClass: "timing-calm",
    };
  }
  return { text: `Čeka ${order.waitingMinutes} min`, cssClass: "timing-waiting" };
};

export const deliveryTiming = (delivery: ActiveDelivery): Timing => {
  if (isLateDelivery(delivery.minutesUntilDelivery)) {
    return {
      text: `Kasni ${formatMinutesDuration(delivery.minutesUntilDelivery)}`,
      cssClass: "timing-late",
    };
  }
  return {
    text: `Isporuka za ${formatMinutesDuration(delivery.minutesUntilDelivery)}`,
    cssClass: "timing-calm",
  };
};

// "Čeka restoran" tab - tekst nosi skaliranu jedinicu (min/h/dani/godine),
// klasa prati nivo hitnosti (calm / warning / critical / stale). Stale dobija
// drugačiji tekst ("Bez odgovora ...") jer to više nije normalno čekanje.
export const restaurantTiming = (order: PendingRestaurantOrder): Timing => {
  const tier = restaurantWaitTier(order.waitingMinutes);
  const duration = formatWaitingDuration(order.waitingMinutes);
  if (tier === "stale") {
    return { text: `Bez odgovora ${duration}`, cssClass: "timing-muted" };
  }
  const text = `Čeka potvrdu ${duration}`;
  if (tier === "critical") return { text, cssClass: "timing-late" };
  if (tier === "warning") return { text, cssClass: "timing-warning" };
  return { text, cssClass: "timing-waiting" };
};

export const isRestaurantCritical = (order: PendingRestaurantOrder) =>
  restaurantWaitTier(order.waitingMinutes) === "critical";

// delivery_type -> ikonica + labela (task "Čeka restoran", stavka 5). Backend je
// 30.08 potvrdio pun rječnik (odgovor §2.1): 0 = dostava na adresu, 1 =
// preuzimanje u restoranu, 2 = ručak u restoranu (rezervacija), 3 = slanje
// poštom, 4 = napušteno (rezervacije stolova - posebna tabela, ne bi se trebalo
// pojaviti na ovoj listi).
export const deliveryTypeMeta = (type: number) => {
  if (type === 0) return { icon: "mdi-moped", label: "Kurir" };
  if (type === 1) return { icon: "mdi-bag-personal-outline", label: "Preuzimanje" };
  if (type === 2) return { icon: "mdi-silverware-fork-knife", label: "Ručak u restoranu" };
  if (type === 3) return { icon: "mdi-mailbox-outline", label: "Pošta" };
  if (type === 4) return { icon: "mdi-table-furniture", label: "Rezervacija stola" };
  return { icon: "mdi-help-circle-outline", label: "Nepoznat tip" };
};
