import { useNuxtApp } from "nuxt/app";
import type { OrderActionResponse, OrdersResponse } from "~/types/order";
import { mapOrderDto, type Order } from "~/models/Order";

// Gađa pravi backend preko $api plugina (app/plugins/api.client.ts), koji kači
// Authorization header i na 401 odjavljuje korisnika.
export const fetchMyOrders = async (courierId: number): Promise<Order[]> => {
  const response = await useNuxtApp().$api<OrdersResponse>(`/orders/driver/${courierId}`);
  return (response.data ?? []).map(mapOrderDto);
};

export const confirmOrderPickup = async (orderId: number, driverId: number): Promise<string> => {
  const response = await useNuxtApp().$api<OrderActionResponse>(`/orders/${orderId}/pickup`, {
    method: "POST",
    body: { driver_id: driverId },
  });
  return response.message;
};

export const deliverOrder = async (orderId: number, driverId: number): Promise<string> => {
  const response = await useNuxtApp().$api<OrderActionResponse>(`/orders/${orderId}/deliver`, {
    method: "POST",
    body: { driver_id: driverId },
  });
  return response.message;
};
