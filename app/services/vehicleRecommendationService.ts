import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse } from "~/types/api";
import type { VehicleRecommendation, VehicleRecommendationDto } from "~/types/vehicleRecommendation";

export const fetchVehicleRecommendation = async (
  companyId: number,
  params: { zoneId: number | null; distanceKm: number | null },
  signal?: AbortSignal
): Promise<VehicleRecommendation> => {
  const response = await useNuxtApp().$api<ApiItemResponse<VehicleRecommendationDto>>(
    `/delivery-companies/${companyId}/recommend-vehicle`,
    {
      signal,
      query: {
        zone_id: params.zoneId ?? undefined,
        distance_km: params.distanceKm ?? undefined,
      },
    }
  );
  return {
    recommendedVehicles: response.data.recommended_vehicles ?? [],
    matchedRule: response.data.matched_rule
      ? {
          id: response.data.matched_rule.id,
          conditionType: response.data.matched_rule.condition_type,
          conditionText: response.data.matched_rule.condition_text,
          note: response.data.matched_rule.note,
        }
      : null,
    price: response.data.price ?? null,
  };
};
