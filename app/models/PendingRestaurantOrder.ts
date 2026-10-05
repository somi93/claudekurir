import type { PendingRestaurantOrderDto } from "~/types/pendingRestaurantOrder";
import type { Location } from "~/types/order";

export type PendingRestaurantOrder = {
  id: number;
  restaurantName: string;
  restaurantPhone: string | null;
  deliveryType: number;
  orderedAt: string;
  waitingMinutes: number;
  deliveryTime: string | null;
  deliveryPrice: number | null;
  location: Location | null;
};

export const mapPendingRestaurantOrderDto = (
  dto: PendingRestaurantOrderDto
): PendingRestaurantOrder => ({
  id: dto.id,
  restaurantName: dto.restaurant_name,
  restaurantPhone: dto.restaurant_phone || null,
  deliveryType: dto.delivery_type,
  orderedAt: dto.ordered_at,
  waitingMinutes: dto.waiting_minutes,
  deliveryTime: dto.delivery_time,
  deliveryPrice: dto.delivery_price,
  // Backend šalje prazan {} kad adrese nema - svedimo na null.
  location: dto.location && Object.keys(dto.location).length > 0 ? dto.location : null,
});
