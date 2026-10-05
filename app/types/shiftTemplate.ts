export type ShiftTemplateStatus = "understaffed" | "below_target" | "target_reached" | "full";

export type ShiftTemplateZoneRef = {
  id: number;
  name: string;
};

export type ShiftTemplateDto = {
  id: number;
  // Lista vraća pun `zone` objekat; create/update vrate samo `zone_id`.
  zone?: ShiftTemplateZoneRef;
  zone_id?: number;
  date: string;
  start_time: string;
  end_time: string;
  min_couriers: number;
  target_couriers: number;
  max_couriers: number | null;
  current_bookings?: number;
  status?: ShiftTemplateStatus;
  capacity_source?: string;
  high_demand: boolean;
};

export type ShiftTemplate = {
  id: number;
  zone: ShiftTemplateZoneRef;
  date: string;
  startTime: string;
  endTime: string;
  minCouriers: number;
  targetCouriers: number;
  maxCouriers: number | null;
  currentBookings: number;
  status: ShiftTemplateStatus;
  capacitySource: string;
  highDemand: boolean;
};

export type NewShiftTemplatePayload = {
  zone_id: number;
  delivery_company_id: number;
  date: string;
  start_time: string;
  end_time: string;
  min_couriers: number;
  target_couriers: number;
  max_couriers: number | null;
  high_demand: boolean;
};

// PUT je namjerno ograničen na kapacitet - vrijeme/zona/firma se ne mijenjaju
// (vidi API_dostupnost_kurira.md - obriši i napravi novu smjenu za to).
export type ShiftTemplateCapacityPayload = {
  min_couriers: number;
  target_couriers: number;
  max_couriers: number | null;
  high_demand: boolean;
};

export type DuplicateWeekPayload = {
  delivery_company_id: number;
  source_week_start: string;
  target_week_start: string;
  zone_id: number | null;
};

export type DuplicateWeekResult = {
  createdCount: number;
  skippedCount: number;
};
