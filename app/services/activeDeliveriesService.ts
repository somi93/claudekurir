import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { ActiveDeliveryDto } from "~/types/activeDelivery";
import { mapActiveDeliveryDto, type ActiveDelivery } from "~/models/ActiveDelivery";

// Isti delivery_company_id query parametar kao /dispatcher/orders/waiting
// (waitingOrdersService.ts) - potvrđeno 16.08 (ranije pretpostavljeno po
// analogiji, sad potvrđeno iz koda na backend strani).
export const fetchActiveDeliveries = async (
  deliveryCompanyId: number
): Promise<ActiveDelivery[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<ActiveDeliveryDto>>(
    "/dispatcher/orders/active-deliveries",
    { query: { delivery_company_id: deliveryCompanyId } }
  );
  return (response.data ?? []).map(mapActiveDeliveryDto);
};
