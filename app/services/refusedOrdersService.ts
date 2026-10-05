import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { RefusedOrderDto } from "~/types/refusedOrder";
import { mapRefusedOrderDto, type RefusedOrder } from "~/models/RefusedOrder";

// Isti delivery_company_id query parametar kao ostala dva orders/* endpoint-a
// na ovom ekranu - potvrđeno 16.08 (vidi napomenu u activeDeliveriesService.ts).
export const fetchRefusedOrders = async (deliveryCompanyId: number): Promise<RefusedOrder[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<RefusedOrderDto>>(
    "/dispatcher/orders/refused",
    { query: { delivery_company_id: deliveryCompanyId } }
  );
  return (response.data ?? []).map(mapRefusedOrderDto);
};
