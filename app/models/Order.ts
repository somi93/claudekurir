import type { DeliveredOrderDto, Location, OrderDto, Restaurant } from "~/types/order";
import { toAmount } from "~/utils/currency";
import { parseTimestamp } from "~/utils/datetime";

export type Order = {
  id: number;
  userId: number | null;
  restaurantId: number | null;
  companyId: number | null;
  deliveryCompanyId: number | null;
  locationId: number | null;
  state: string | null;
  deliveryType: number | null;
  date: string | null;
  deliveryTime: string | null;
  guestNumber: number | null;
  currency: string | null;
  deliveryPrice: number | null;
  location?: Location | null;
  restaurant?: Restaurant | null;
  // Opciona polja koja backend još ne šalje (vidi types/order.ts) - null dok ne stignu.
  amountToCollect: number | null;
  paymentMethod: string | null;
  totalPrice: number | null;
  courierEarning: number | null;
  restaurantPhone: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerNote: string | null;
  readyAt: string | null;
  distanceKm: number | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
};

const toText = (value: string | null | undefined): string | null => {
  const text = (value ?? "").trim();
  return text || null;
};

export const mapOrderDto = (dto: OrderDto): Order => ({
  id: dto.id,
  userId: dto.user_id,
  restaurantId: dto.restaurant_id,
  companyId: dto.company_id,
  deliveryCompanyId: dto.delivery_company_id,
  locationId: dto.location_id,
  state: dto.state,
  deliveryType: dto.delivery_type,
  date: dto.date,
  deliveryTime: dto.delivery_time,
  guestNumber: dto.guest_number,
  currency: dto.currency,
  deliveryPrice: toAmount(dto.delivery_price),
  location: dto.location,
  restaurant: dto.restaurant,
  amountToCollect: toAmount(dto.amount_to_collect),
  paymentMethod: toText(dto.payment_method),
  totalPrice: toAmount(dto.total_price),
  courierEarning: toAmount(dto.courier_earning),
  restaurantPhone: toText(dto.restaurant_phone),
  customerName: toText(dto.customer_name),
  customerPhone: toText(dto.customer_phone),
  customerNote: toText(dto.customer_note),
  readyAt: dto.ready_at ?? null,
  distanceKm: toAmount(dto.distance_km),
  acceptedAt: dto.accepted_at ?? null,
  pickedUpAt: dto.picked_up_at ?? null,
});

// deliveredAt je vrijeme u ms ili null kad ga backend nije poslao / ne može da se
// pročita (jedan takav red ranije je rušio cijelu stranicu Istorije).
export type HistoryEntry = { order: Order; deliveredAt: number | null };

export const mapHistoryEntryDto = (dto: DeliveredOrderDto): HistoryEntry => {
  const { delivered_at, ...orderDto } = dto;
  // Broj narudžbe je ključ za spajanje sa /earnings, pa mora biti broj i kad stigne kao tekst.
  return {
    order: { ...mapOrderDto(orderDto), id: Number(orderDto.id) },
    deliveredAt: parseTimestamp(delivered_at),
  };
};
