import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { CourierBalance } from "~/types/courier-balance";
import type {
  CashHandoverHistoryFilters,
  CashHandoverHistoryItem,
  PendingCashHandover,
} from "~/types/cash-handover";
import type {
  CashPayoutActionResponse,
  CashReceiptRequest,
  CompanyPayout,
  CompanyPayoutFilters,
  PayoutRequest,
} from "~/types/payout";

export const fetchCouriersBalance = async (companyId: number): Promise<CourierBalance[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<CourierBalance>>(
    `/dispatcher/delivery-companies/${companyId}/couriers-balance`
  );
  return response.data ?? [];
};

export const fetchPendingCashHandovers = async (
  companyId: number
): Promise<PendingCashHandover[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<PendingCashHandover>>(
    `/dispatcher/delivery-companies/${companyId}/cash-handovers/pending`
  );
  return response.data ?? [];
};

// Cijela istorija predaja (ne samo pending) - za rješavanje sporova i pregled ko
// konzistentno kasni. Opcioni filteri idu kao query string. Odgovor backenda
// DIO 3, tačka 3.2.
export const fetchCashHandoverHistory = async (
  companyId: number,
  filters: CashHandoverHistoryFilters
): Promise<CashHandoverHistoryItem[]> => {
  const query: Record<string, string> = {};
  if (filters.courierId) query.courier_id = String(filters.courierId);
  if (filters.status) query.status = filters.status;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;

  const response = await useNuxtApp().$api<ApiListResponse<CashHandoverHistoryItem>>(
    `/dispatcher/delivery-companies/${companyId}/cash-handovers`,
    { query }
  );
  return response.data ?? [];
};

// POST /dispatcher/cash-handovers/{id}/confirm - backend ZAHTEVA confirmed_amount
// (bez njega vraća 422, NE postavlja automatski = reported_amount). Ako se
// confirmed_amount razlikuje od prijavljenog, backend knjiži potvrđeni iznos i
// sam generiše napomenu o razlici; ako dispečer pošalje svoj `note`, on je
// preglašava. Odgovor backenda DIO 3, tačka 3.1.
export const confirmCashHandover = async (
  handoverId: number,
  confirmedAmount: number,
  note?: string
): Promise<void> => {
  await useNuxtApp().$api(`/dispatcher/cash-handovers/${handoverId}/confirm`, {
    method: "POST",
    body: { confirmed_amount: confirmedAmount, ...(note ? { note } : {}) },
  });
};

// Cijela istorija isplata firme (analogno cash-handovers istoriji) - dispečer
// nema drugi pregled isplata na nivou firme. Opcioni filteri idu kao query.
// Odgovor backenda §3.6.
export const fetchCompanyPayouts = async (
  companyId: number,
  filters: CompanyPayoutFilters
): Promise<CompanyPayout[]> => {
  const query: Record<string, string> = {};
  if (filters.courierId) query.courier_id = String(filters.courierId);
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;

  const response = await useNuxtApp().$api<ApiListResponse<CompanyPayout>>(
    `/dispatcher/delivery-companies/${companyId}/payouts`,
    { query }
  );
  return response.data ?? [];
};

// POST /dispatcher/couriers/{courierId}/cash-receipt (issue #223636, tačka 4c) -
// dispečer direktno evidentira primljenu gotovinu, bez prethodne prijave kurira.
// delivery_company_id ide u telu (kurir može biti u više firmi kroz vrijeme).
// Odgovor može nositi `warning` ako iznos premašuje dug (odgovor §2.3).
export const recordCashReceipt = async (
  courierId: number,
  payload: CashReceiptRequest
): Promise<CashPayoutActionResponse> => {
  return useNuxtApp().$api<CashPayoutActionResponse>(
    `/dispatcher/couriers/${courierId}/cash-receipt`,
    { method: "POST", body: payload }
  );
};

// POST /dispatcher/couriers/{courierId}/payout (issue #223636, tačka 5) -
// isplata zarade kuriru. Potvrđeno uživo 30.08: telo { delivery_company_id,
// amount, method, note? }, odgovor { success, transaction_id } + opcioni
// `warning` ako iznos premašuje dug (odgovor §2.3). NAPOMENA: tiket §5 je naveo
// /couriers/{id}/payout bez /dispatcher/ prefiksa - ta ruta 404-uje, tačna je
// ova.
export const payoutCourierWage = async (
  courierId: number,
  payload: PayoutRequest
): Promise<CashPayoutActionResponse> => {
  return useNuxtApp().$api<CashPayoutActionResponse>(
    `/dispatcher/couriers/${courierId}/payout`,
    { method: "POST", body: payload }
  );
};
