// Odgovara App\Http\Controllers\Admin\OrderEventController (web-dostavljaci).
// Redovi se pisu na backendu preko OrderEventLogger, iz Order.php (promene
// stanja), OrderOfferService.php (offer runde) i NotifyCouriersOrderAccepted.php
// (push notifikacije) - svaki bitan korak u zivotu jedne narudzbe.
export type OrderEvent = {
  id: number;
  event_type: string;
  payload: Record<string, unknown> | null;
  actor_type: string | null;
  actor_id: number | null;
  actor_name: string | null;
  created_at: string;
};

export type OrderEventsOrder = {
  id: number;
  state: string;
  delivery_company_id: number | null;
  delivery_user_id: number | null;
  created_at: string;
};

export type OrderEventsResponse = {
  success: boolean;
  order: OrderEventsOrder;
  data: OrderEvent[];
};
