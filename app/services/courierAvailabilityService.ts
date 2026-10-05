import { useNuxtApp } from "nuxt/app";
import type {
  AvailabilityTimeSlot,
  CourierAvailabilityResponse,
  DayAvailability,
  NewAvailabilityTimeSlotDto,
  ToggleDayResponse,
} from "~/types/availability";
import type { ApiItemResponse } from "~/types/api";
import { mapAvailabilityTimeSlotDto, mapDayAvailabilityDto } from "~/models/CourierAvailability";

export const fetchCourierAvailability = async (
  courierId: number,
  deliveryCompanyId: number,
  from: string,
  to: string
): Promise<DayAvailability[]> => {
  const response = await useNuxtApp().$api<CourierAvailabilityResponse>(
    `/couriers/${courierId}/availability`,
    { query: { delivery_company_id: deliveryCompanyId, from, to } }
  );
  return Object.entries(response.data ?? {}).map(([date, dto]) => mapDayAvailabilityDto(date, dto));
};

export type ToggleDayResult = {
  available: boolean;
  slots: AvailabilityTimeSlot[];
};

// Uključivanje ne šalje "omiljenu" zonu - u ovoj aplikaciji kurir je uvijek
// fleksibilan (zone_id: null), pa se kapacitet zone ne rezerviše ovim pozivom.
export const toggleDayAvailability = async (
  courierId: number,
  deliveryCompanyId: number,
  date: string,
  isAvailable: boolean
): Promise<ToggleDayResult> => {
  const response = await useNuxtApp().$api<ToggleDayResponse>(
    `/couriers/${courierId}/availability/toggle-day`,
    {
      method: "PATCH",
      body: {
        delivery_company_id: deliveryCompanyId,
        zone_id: null,
        date,
        is_available: isAvailable,
      },
    }
  );
  const day = response.data;
  return {
    available: day.is_available,
    slots: (day.slots ?? []).map(mapAvailabilityTimeSlotDto),
  };
};

export type AddSlotResult = {
  slot: AvailabilityTimeSlot;
  matchedShift: boolean;
};

export const addAvailabilitySlot = async (
  courierId: number,
  deliveryCompanyId: number,
  zoneId: number | null,
  date: string,
  startTime: string,
  endTime: string
): Promise<AddSlotResult> => {
  const response = await useNuxtApp().$api<ApiItemResponse<NewAvailabilityTimeSlotDto>>(
    `/couriers/${courierId}/availability`,
    {
      method: "POST",
      body: {
        delivery_company_id: deliveryCompanyId,
        zone_id: zoneId,
        date,
        start_time: startTime,
        end_time: endTime,
      },
    }
  );
  return {
    slot: mapAvailabilityTimeSlotDto(response.data),
    matchedShift: response.data.matched_shift,
  };
};

// Namjerno flat ruta (ne /couriers/{courierId}/availability/{id}) - backend
// sam provjerava vlasništvo nad terminom preko ulogovanog korisnika.
export const deleteAvailabilitySlot = async (slotId: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/availability/${slotId}`, { method: "DELETE" });
};
