import type { DailyEarnings, DailyEarningsDto } from "~/types/earnings";

export const mapDailyEarningsDto = (dto: DailyEarningsDto): DailyEarnings => ({
  date: dto.date,
  deliveries: dto.deliveries,
  earnings: dto.amount,
});
