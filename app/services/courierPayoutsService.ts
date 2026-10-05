import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { CourierPayout, PayoutHistoryFilters } from "~/types/payout";

// GET /couriers/{courierId}/payouts - istorija isplata zarade (Glovo "Isplate"
// tab). Odgovor: { success, data: CourierPayout[] }. Opcioni datumski filter.
export const fetchCourierPayouts = async (
  courierId: number,
  filters: PayoutHistoryFilters = { from: null, to: null }
): Promise<CourierPayout[]> => {
  const query: Record<string, string> = {};
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;

  const response = await useNuxtApp().$api<ApiListResponse<CourierPayout>>(
    `/couriers/${courierId}/payouts`,
    { query }
  );
  return response.data ?? [];
};
