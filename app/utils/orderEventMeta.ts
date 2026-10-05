// Prikazni opis za svaki `event_type` iz order_events (vidi
// App\Support\OrderEventLogger na backendu - svaki poziv odatle mora imati
// unos ovde, inače timeline padne na generički fallback).
export type OrderEventMeta = {
  label: string;
  icon: string;
  color: string;
};

const EVENT_META: Record<string, OrderEventMeta> = {
  "order.courier_accepted": {
    label: "Kurir prihvatio narudžbu",
    icon: "mdi-account-check",
    color: "success",
  },
  "order.picked_up": {
    label: "Kurir preuzeo iz restorana",
    icon: "mdi-shopping-outline",
    color: "primary",
  },
  "order.delivered": {
    label: "Dostavljeno",
    icon: "mdi-flag-checkered",
    color: "success",
  },
  "order.reservation_canceled": {
    label: "Kurir otkazao rezervaciju",
    icon: "mdi-account-cancel",
    color: "warning",
  },
  "order.state_changed_manually": {
    label: "Dispečer ručno promenio status",
    icon: "mdi-hand-back-right",
    color: "warning",
  },
  "offer.round_opened_manual": {
    label: "Dispečer poslao ponudu",
    icon: "mdi-send",
    color: "primary",
  },
  "offer.round_opened_auto": {
    label: "Automatska runda otvorena",
    icon: "mdi-robot-outline",
    color: "primary",
  },
  "offer.auto_round_skipped_active_exists": {
    label: "Firma preskočena - druga firma je vec otvorila rundu",
    icon: "mdi-alert-octagon-outline",
    color: "error",
  },
  "offer.auto_skipped_order_state": {
    label: "Automatska dodela preskočena - narudžba više nije dostupna",
    icon: "mdi-alert-octagon-outline",
    color: "warning",
  },
  "offer.auto_pool_empty": {
    label: "Nema kandidata u poolu - otvoreno svima",
    icon: "mdi-account-off-outline",
    color: "warning",
  },
  "offer.batch_dispatched": {
    label: "Ponuda poslata kuriru(ima)",
    icon: "mdi-bell-ring-outline",
    color: "primary",
  },
  "offer.accepted": {
    label: "Kurir prihvatio ponudu",
    icon: "mdi-check-circle-outline",
    color: "success",
  },
  "offer.declined": {
    label: "Kurir odbio ponudu",
    icon: "mdi-close-circle-outline",
    color: "error",
  },
  "offer.batch_expired": {
    label: "Ponuda istekla bez odgovora",
    icon: "mdi-clock-alert-outline",
    color: "warning",
  },
  "offer.round_canceled": {
    label: "Runda zatvorena (dispečer)",
    icon: "mdi-cancel",
    color: "secondary",
  },
  "offer.round_canceled_order_moved": {
    label: "Runda tiho zatvorena - narudžba je već otišla dalje",
    icon: "mdi-cancel",
    color: "secondary",
  },
  "offer.round_exhausted": {
    label: "Runda iscrpljena - niko nije prihvatio",
    icon: "mdi-flag-outline",
    color: "error",
  },
  "notification.push_summary": {
    label: "Push notifikacije poslate",
    icon: "mdi-bell-outline",
    color: "info",
  },
  "notification.no_delivery_companies": {
    label: "Nijedna firma nije vezana za restoran",
    icon: "mdi-domain-off",
    color: "error",
  },
};

const FALLBACK: OrderEventMeta = { label: "Događaj", icon: "mdi-circle-small", color: "grey" };

export const getOrderEventMeta = (eventType: string): OrderEventMeta => EVENT_META[eventType] ?? {
  ...FALLBACK,
  label: eventType,
};
