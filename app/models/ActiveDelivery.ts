import type {
  ActiveDeliveryCourierDto,
  ActiveDeliveryDto,
  ActiveDeliveryStatus,
} from "~/types/activeDelivery";
import type { CandidateCourierVehicle } from "~/types/candidateCourier";
import type { Location } from "~/types/order";

export type ActiveDeliveryCourier = {
  id: number;
  name: string;
  phone: string | null;
  vehicle: CandidateCourierVehicle;
};

export type ActiveDelivery = {
  id: number;
  restaurantName: string;
  orderedAt: string;
  deliveryTime: string;
  minutesUntilDelivery: number;
  status: ActiveDeliveryStatus;
  deliveryPrice: number;
  // null kad backend vrati red bez kurira - prikaz to podnosi (vidi
  // DispatchBoardPanel), ne ruši listu.
  courier: ActiveDeliveryCourier | null;
  location: Location | null;
};

const mapCourier = (dto: ActiveDeliveryCourierDto): ActiveDeliveryCourier => ({
  id: dto.id,
  name: dto.name,
  phone: dto.phone,
  vehicle: dto.vehicle,
});

export const mapActiveDeliveryDto = (dto: ActiveDeliveryDto): ActiveDelivery => ({
  id: dto.id,
  restaurantName: dto.restaurant_name,
  orderedAt: dto.ordered_at,
  deliveryTime: dto.delivery_time,
  minutesUntilDelivery: dto.minutes_until_delivery,
  status: dto.status,
  deliveryPrice: dto.delivery_price,
  courier: dto.courier ? mapCourier(dto.courier) : null,
  location: dto.location ?? null,
});
