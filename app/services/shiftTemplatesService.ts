import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type {
  DuplicateWeekPayload,
  DuplicateWeekResult,
  NewShiftTemplatePayload,
  ShiftTemplate,
  ShiftTemplateCapacityPayload,
  ShiftTemplateDto,
  ShiftTemplateStatus,
} from "~/types/shiftTemplate";

const VALID_STATUSES: ShiftTemplateStatus[] = [
  "understaffed",
  "below_target",
  "target_reached",
  "full",
];

// Od 01.09 (odgovor 2.1) store()/update() vraćaju pun red uklj. `status`; ovo
// ostaje samo kao defanziva za stare/parcijalne odgovore - izvedi iz kapaciteta.
const deriveStatus = (dto: ShiftTemplateDto): ShiftTemplateStatus => {
  if (dto.status && VALID_STATUSES.includes(dto.status)) return dto.status;
  const bookings = dto.current_bookings ?? 0;
  if (bookings < dto.min_couriers) return "understaffed";
  if (bookings < dto.target_couriers) return "below_target";
  if (dto.max_couriers !== null && bookings >= dto.max_couriers) return "full";
  return "target_reached";
};

const mapShiftTemplateDto = (dto: ShiftTemplateDto): ShiftTemplate => ({
  id: dto.id,
  zone: dto.zone ?? { id: dto.zone_id ?? 0, name: "" },
  date: dto.date,
  startTime: dto.start_time,
  endTime: dto.end_time,
  minCouriers: dto.min_couriers,
  targetCouriers: dto.target_couriers,
  maxCouriers: dto.max_couriers,
  currentBookings: dto.current_bookings ?? 0,
  status: deriveStatus(dto),
  capacitySource: dto.capacity_source ?? "",
  highDemand: dto.high_demand,
});

export const fetchShiftTemplates = async (
  deliveryCompanyId: number,
  from: string,
  to: string,
  zoneId?: number | null
): Promise<ShiftTemplate[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<ShiftTemplateDto>>("/dispatcher/shift-templates", {
    query: {
      delivery_company_id: deliveryCompanyId,
      from,
      to,
      ...(zoneId ? { zone_id: zoneId } : {}),
    },
  });
  return (response.data ?? []).map(mapShiftTemplateDto);
};

export const createShiftTemplate = async (payload: NewShiftTemplatePayload): Promise<ShiftTemplate> => {
  const response = await useNuxtApp().$api<ApiItemResponse<ShiftTemplateDto>>("/dispatcher/shift-templates", {
    method: "POST",
    body: payload,
  });
  return mapShiftTemplateDto(response.data);
};

export const updateShiftTemplateCapacity = async (
  shiftTemplateId: number,
  payload: ShiftTemplateCapacityPayload
): Promise<ShiftTemplate> => {
  const response = await useNuxtApp().$api<ApiItemResponse<ShiftTemplateDto>>(
    `/dispatcher/shift-templates/${shiftTemplateId}`,
    { method: "PUT", body: payload }
  );
  return mapShiftTemplateDto(response.data);
};

export const deleteShiftTemplate = async (shiftTemplateId: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/dispatcher/shift-templates/${shiftTemplateId}`, { method: "DELETE" });
};

export const duplicateWeekShiftTemplates = async (
  payload: DuplicateWeekPayload
): Promise<DuplicateWeekResult> => {
  const response = await useNuxtApp().$api<ApiItemResponse<{ created_count: number; skipped_count: number }>>(
    "/dispatcher/shift-templates/duplicate-week",
    { method: "POST", body: payload }
  );
  return {
    createdCount: response.data.created_count,
    skippedCount: response.data.skipped_count,
  };
};
