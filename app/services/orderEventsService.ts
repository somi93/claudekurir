import { useNuxtApp } from "nuxt/app";
import type { OrderEventsResponse } from "~/types/order-events";

export const fetchOrderEvents = async (orderId: number): Promise<OrderEventsResponse> => {
  return await useNuxtApp().$api<OrderEventsResponse>(`/admin/orders/${orderId}/events`);
};
