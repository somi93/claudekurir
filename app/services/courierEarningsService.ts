import { useNuxtApp } from "nuxt/app";
import type { CourierEarnings, CourierEarningsResponse } from "~/types/earnings";
import { mapDailyEarningsDto } from "~/models/DailyEarnings";
import { mapOrderEarningsDto } from "~/models/OrderEarnings";

// Sistemski dnevni agregat (zarada, dostave po danu) + ukupno. Oblik potvrđen
// uživo 29.08 - defanzivno mapiranje jer je tiket #223636 §6 opisivao drugačiji
// (nepostojeći) oblik. Opcioni ?from= ("YYYY-MM-DD", SQL-filtriran, odgovor
// §3.4) - inače kurir sa 2 god. staža povuče ogroman payload.
export const fetchCourierEarnings = async (
  courierId: number,
  from?: string
): Promise<CourierEarnings> => {
  const response = await useNuxtApp().$api<CourierEarningsResponse>(
    `/couriers/${courierId}/earnings`,
    from ? { query: { from } } : undefined
  );
  return {
    total: response.total ?? 0,
    daily: (response.daily ?? []).map(mapDailyEarningsDto),
    orders: (response.data ?? []).map(mapOrderEarningsDto),
  };
};
