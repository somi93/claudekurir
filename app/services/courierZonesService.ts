import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { Zone, ZoneDto } from "~/types/zone";

export const fetchCourierZones = async (
  courierId: number,
  deliveryCompanyId: number
): Promise<Zone[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<ZoneDto>>(`/couriers/${courierId}/zones`, {
    query: { delivery_company_id: deliveryCompanyId },
  });
  return (response.data ?? []).map((dto) => ({
    id: dto.id,
    name: dto.name,
    terrainFactor: dto.terrain_factor ?? null,
    vehicleSuitable: dto.vehicle_suitable ?? true,
    note: dto.note ?? null,
  }));
};
