export type AvailabilitySlotStatus = "confirmed" | "waitlisted";

export type AvailabilityZoneRef = {
  id: number;
  name: string;
};

export type AvailabilityTimeSlot = {
  id: number;
  zone: AvailabilityZoneRef | null;
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  durationMinutes: number;
  status: AvailabilitySlotStatus;
};

export type AvailabilityTimeSlotDto = {
  id: number;
  zone?: AvailabilityZoneRef | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: AvailabilitySlotStatus;
};

// Odgovor POST .../availability dodaje matched_shift - da li dispečer uopšte
// ima definisanu smjenu za taj period (informativno, ne utiče na status).
export type NewAvailabilityTimeSlotDto = AvailabilityTimeSlotDto & {
  matched_shift: boolean;
};

export type DayAvailability = {
  date: string; // "2026-07-21"
  available: boolean;
  totalMinutes: number;
  slots: AvailabilityTimeSlot[];
};

export type DayAvailabilityDto = {
  is_available: boolean;
  total_minutes: number;
  slots: AvailabilityTimeSlotDto[];
};

// GET .../availability vraća objekat keyovan po datumu, ne niz.
export type CourierAvailabilityResponse = {
  data: Record<string, DayAvailabilityDto>;
};

// PATCH .../availability/toggle-day vraća jedan dan, upakovan u "data"
// (isti oblik kao dan iz GET-a, samo bez total_minutes).
export type ToggleDayResponse = {
  data: {
    is_available: boolean;
    slots: AvailabilityTimeSlotDto[];
  };
};
