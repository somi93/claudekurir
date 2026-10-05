import type { RefusedOrderDto } from "~/types/refusedOrder";
import type { Location } from "~/types/order";

export type RefusedOrder = {
  id: number;
  restaurantName: string;
  deliveryTime: string;
  deliveryPrice: number;
  courierName: string;
  location: Location | null;
};

export const mapRefusedOrderDto = (dto: RefusedOrderDto): RefusedOrder => ({
  id: dto.id,
  restaurantName: dto.restaurant_name,
  deliveryTime: dto.delivery_time,
  deliveryPrice: dto.delivery_price,
  courierName: dto.courier_name,
  location: dto.location ?? null,
});
