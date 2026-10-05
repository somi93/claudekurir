import type { WaitingOrder } from "~/models/WaitingOrder";

// "Odmah" vs "zakazano" - razlika (delivery_time - ordered_at) veća od ovog
// praga znači da je narudžba unapred zakazana, ne treba joj kurir odmah.
// Front odluka (Dopuna_dodela_narudzbi_frontend.md, 16.08) - backend
// namerno ne šalje gotov flag, lakše je podešavati bez deploy-a.
const SCHEDULED_THRESHOLD_MINUTES = 45;

// Kritični pragovi za eskalaciono "Dodeli odmah" dugme - isto front odluka.
// "Odmah" narudžbe eskaliraju po dužini čekanja, "zakazane" po preostalom
// vremenu do isporuke.
const WAITING_CRITICAL_MINUTES = 15;
const DELIVERY_CRITICAL_MINUTES = 20;

export const isScheduledOrder = (order: WaitingOrder) => {
  const diffMinutes =
    (new Date(order.deliveryTime).getTime() - new Date(order.orderedAt).getTime()) / 60000;
  return diffMinutes > SCHEDULED_THRESHOLD_MINUTES;
};

export const isCriticalWaitingOrder = (order: WaitingOrder) =>
  isScheduledOrder(order)
    ? order.minutesUntilDelivery <= DELIVERY_CRITICAL_MINUTES
    : order.waitingMinutes >= WAITING_CRITICAL_MINUTES;

// "Kasni" oznaka - važi na bilo kom tabu koji ima minutes_until_delivery
// (waiting, active-deliveries; refused ga nema jer je terminalno stanje).
export const isLateDelivery = (minutesUntilDelivery: number) => minutesUntilDelivery < 0;

// "Čeka restoran" tab - nivoi hitnosti po vremenu čekanja na potvrdu restorana
// (task "nov ekran/tab: Čeka restoran"). Front sam računa prag, backend šalje
// samo sirov waiting_minutes.
//   0-5 min    -> calm (neutralno)
//   5-15 min   -> warning (žuto)
//   15 min-3h  -> critical (crveno - poziv restoranu sad ima smisla)
//   3h+        -> stale (sivo - restoran očito ne reaguje kroz app; ručno
//                 riješiti ili očistiti, ali NIJE "act now" hitnost). Bez ovog
//                 nivoa 7-dnevni prozor ispuni listu redovima gdje su svi
//                 jednako crveni pa dispečer ne vidi šta je stварно svježe.
export type RestaurantWaitTier = "calm" | "warning" | "critical" | "stale";

const RESTAURANT_WAIT_WARNING_MINUTES = 5;
const RESTAURANT_WAIT_CRITICAL_MINUTES = 15;
const RESTAURANT_WAIT_STALE_MINUTES = 180;

export const restaurantWaitTier = (waitingMinutes: number): RestaurantWaitTier => {
  if (waitingMinutes >= RESTAURANT_WAIT_STALE_MINUTES) return "stale";
  if (waitingMinutes >= RESTAURANT_WAIT_CRITICAL_MINUTES) return "critical";
  if (waitingMinutes >= RESTAURANT_WAIT_WARNING_MINUTES) return "warning";
  return "calm";
};

// Red je "za akciju" (poziv / ručno rješavanje sad) dok nije skliznuo u stale.
export const isActionableRestaurantWait = (waitingMinutes: number) =>
  restaurantWaitTier(waitingMinutes) !== "stale";
