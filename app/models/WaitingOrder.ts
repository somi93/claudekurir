import type { WaitingOrderDto } from "~/types/waitingOrder";
import type { Location } from "~/types/order";

export type WaitingOrder = {
  id: number;
  restaurantName: string;
  orderedAt: string;
  deliveryTime: string;
  waitingMinutes: number;
  minutesUntilDelivery: number;
  status: string;
  readyInMinutes: number;
  readyAt: string;
  deliveryPrice: number;
  location: Location | null;
  // Zona adrese dostave + rutna udaljenost restoran -> kupac (28.08, DIO 7.2).
  // null je legitimno (adresa van zona / udaljenost neizračunljiva).
  deliveryZone: string | null;
  distanceKm: number | null;
};

export const mapWaitingOrderDto = (dto: WaitingOrderDto): WaitingOrder => ({
  id: dto.id,
  restaurantName: dto.restaurant_name,
  orderedAt: dto.ordered_at,
  deliveryTime: dto.delivery_time,
  waitingMinutes: dto.waiting_minutes,
  minutesUntilDelivery: dto.minutes_until_delivery,
  status: dto.status,
  readyInMinutes: dto.ready_in_minutes,
  readyAt: dto.ready_at,
  deliveryPrice: dto.delivery_price,
  location: dto.location ?? null,
  deliveryZone: dto.delivery_zone ?? null,
  distanceKm: dto.distance_km ?? null,
});
