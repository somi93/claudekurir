import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type { VehicleRule, VehicleRuleConditionType, VehicleRuleVehicle } from "~/types/pricing";

export const fetchVehicleRules = async (companyId: number): Promise<VehicleRule[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<VehicleRule>>(
    `/delivery-companies/${companyId}/vehicle-rules`
  );
  return response.data ?? [];
};

export type VehicleRulePayload = {
  condition_text: string;
  vehicle: VehicleRuleVehicle;
  zone_id: number | null;
  max_terrain_factor: number | null;
  note: string | null;
  condition_type?: VehicleRuleConditionType;
  surcharge_id?: number | null;
  min_distance_km?: number | null;
  max_distance_km?: number | null;
  preferred_vehicles?: string[];
  priority?: number;
};

export const createVehicleRule = async (
  companyId: number,
  payload: VehicleRulePayload
): Promise<VehicleRule> => {
  const response = await useNuxtApp().$api<ApiItemResponse<VehicleRule>>(
    `/delivery-companies/${companyId}/vehicle-rules`,
    { method: "POST", body: payload }
  );
  return response.data;
};

// Flat ruta pod delivery-companies prefiksom, bez companyId u putanji
// (pravilo već zna svoju firmu) - potvrđeno 16.08, isti obrazac kao
// surcharges/{id}. `/vehicle-rules/{id}` (bez prefiksa) vraća 404.
export const updateVehicleRule = async (
  ruleId: number,
  payload: Partial<VehicleRulePayload>
): Promise<VehicleRule> => {
  const response = await useNuxtApp().$api<ApiItemResponse<VehicleRule>>(
    `/delivery-companies/vehicle-rules/${ruleId}`,
    { method: "PUT", body: payload }
  );
  return response.data;
};

export const deleteVehicleRule = async (ruleId: number): Promise<void> => {
  await useNuxtApp().$api(`/delivery-companies/vehicle-rules/${ruleId}`, {
    method: "DELETE",
  });
};
