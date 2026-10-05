import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { WaitingOrderDto } from "~/types/waitingOrder";
import { mapWaitingOrderDto, type WaitingOrder } from "~/models/WaitingOrder";

export const fetchWaitingOrders = async (deliveryCompanyId: number): Promise<WaitingOrder[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<WaitingOrderDto>>(
    "/dispatcher/orders/waiting",
    { query: { delivery_company_id: deliveryCompanyId } }
  );
  return (response.data ?? []).map(mapWaitingOrderDto);
};
