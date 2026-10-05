import type {
  AvailabilityTimeSlot,
  AvailabilityTimeSlotDto,
  DayAvailability,
  DayAvailabilityDto,
} from "~/types/availability";

export const mapAvailabilityTimeSlotDto = (dto: AvailabilityTimeSlotDto): AvailabilityTimeSlot => ({
  id: dto.id,
  zone: dto.zone ?? null,
  startTime: dto.start_time,
  endTime: dto.end_time,
  durationMinutes: dto.duration_minutes,
  status: dto.status,
});

export const sumSlotMinutes = (slots: AvailabilityTimeSlot[]): number =>
  slots.reduce((sum, slot) => sum + slot.durationMinutes, 0);

export const mapDayAvailabilityDto = (date: string, dto: DayAvailabilityDto): DayAvailability => ({
  date,
  available: dto.is_available,
  totalMinutes: dto.total_minutes,
  slots: (dto.slots ?? []).map(mapAvailabilityTimeSlotDto),
});
