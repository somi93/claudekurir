import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type {
  DispatcherZone,
  DispatcherZoneDto,
  DispatcherZonePayload,
  ZoneLiveCoverage,
  ZoneLiveCoverageDto,
} from "~/types/dispatcherZone";

const mapZoneDto = (dto: DispatcherZoneDto): DispatcherZone => ({
  id: dto.id,
  cityId: dto.city_id,
  name: dto.name,
  terrainFactor: dto.terrain_factor,
  centerLat: dto.center_lat ?? null,
  centerLng: dto.center_lng ?? null,
  radiusMeters: dto.radius_meters ?? null,
});

// city_id je opcion filter - bez njega vraća zone iz svih gradova (nema
// posebnog "lista gradova" endpointa, pa dispatcher scheduling ekran ne
// filtrira po gradu po defaultu).
export const fetchDispatcherZones = async (cityId?: number | null): Promise<DispatcherZone[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<DispatcherZoneDto>>("/dispatcher/zones", {
    query: cityId ? { city_id: cityId } : undefined,
  });
  return (response.data ?? []).map(mapZoneDto);
};

export const createDispatcherZone = async (payload: DispatcherZonePayload): Promise<DispatcherZone> => {
  const response = await useNuxtApp().$api<ApiItemResponse<DispatcherZoneDto>>("/dispatcher/zones", {
    method: "POST",
    body: payload,
  });
  return mapZoneDto(response.data);
};

export const updateDispatcherZone = async (
  zoneId: number,
  payload: DispatcherZonePayload
): Promise<DispatcherZone> => {
  const response = await useNuxtApp().$api<ApiItemResponse<DispatcherZoneDto>>(
    `/dispatcher/zones/${zoneId}`,
    { method: "PUT", body: payload }
  );
  return mapZoneDto(response.data);
};

export const deleteDispatcherZone = async (zoneId: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/dispatcher/zones/${zoneId}`, { method: "DELETE" });
};

export const fetchZoneLiveCoverage = async (deliveryCompanyId: number): Promise<ZoneLiveCoverage[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<ZoneLiveCoverageDto>>(
    "/dispatcher/zones/live-coverage",
    { query: { delivery_company_id: deliveryCompanyId } }
  );
  return (response.data ?? []).map((dto) => ({
    zoneId: dto.zone_id,
    zoneName: dto.zone_name,
    online: dto.online,
    idle: dto.idle,
    delivering: dto.delivering,
  }));
};
