import { useNuxtApp } from "nuxt/app";
import type { CourierHistoryResponse } from "~/types/order";
import { mapHistoryEntryDto, type HistoryEntry } from "~/models/Order";

// Izvedeno iz orders_guest na backendu (nema svoju tabelu) - GET vraća Order + delivered_at.
export const fetchCourierHistory = async (courierId: number): Promise<HistoryEntry[]> => {
  const response = await useNuxtApp().$api<CourierHistoryResponse>(
    `/couriers/${courierId}/history`
  );
  // Red bez broja narudžbe ne može ni da se spoji sa zaradom ni da se otvori - preskače se.
  return (response.data ?? []).filter((dto) => Number.isFinite(Number(dto?.id))).map(mapHistoryEntryDto);
};
