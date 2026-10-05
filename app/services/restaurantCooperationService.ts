import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// URL je BEZ "delivery-companies" segmenta (companyId ide direktno iza
// /dispatcher/), uprkos imenu rute api.dispatcher.delivery-companies.restaurants
// - backend ispravka 27.08, ovo je bio uzrok 404 na produkciji.
// Podrazumevano ponašanje endpointa promenjeno (27.08): bez ikakvih parametara
// vraća SVE veze firme, uključujući i ranije "sakrivene" (status = 0 u bazi).
// Ne šaljemo nikakav parametar - želimo kompletnu listu.
export const fetchRestaurantCooperations = async (
  companyId: number
): Promise<RestaurantCooperation[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<RestaurantCooperation>>(
    `/dispatcher/${companyId}/restaurants`
  );
  return response.data ?? [];
};

// active_restoran je jedino polje koje dispečer sme da menja - vidi
// types/restaurant-cooperation.ts. suspension_reason (27.08) je opciono i ide
// samo pri suspenziji; pri reaktivaciji backend sam vraća reason na null, pa
// tada šaljemo samo active_restoran. Ostala polja u telu backend tiho ignoriše.
export const setRestaurantActive = async (
  linkId: number,
  active: boolean,
  reason?: string
): Promise<RestaurantCooperation> => {
  const body: { active_restoran: boolean; suspension_reason?: string | null } = {
    active_restoran: active,
  };
  if (!active) body.suspension_reason = reason ?? null;
  const response = await useNuxtApp().$api<ApiItemResponse<RestaurantCooperation>>(
    `/dispatcher/restaurant-delivery-company/${linkId}`,
    { method: "PATCH", body }
  );
  return response.data;
};
