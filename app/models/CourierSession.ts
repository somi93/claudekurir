import type { WorkSession, WorkSessionDto } from "~/types/session";

export const mapWorkSessionDto = (dto: WorkSessionDto): WorkSession => ({
  id: dto.id,
  date: dto.date,
  startTime: dto.start_time,
  endTime: dto.end_time,
  zone: dto.zone,
  highDemand: dto.high_demand,
  status: dto.status,
  offeredForSwap: dto.offered_for_swap,
});
