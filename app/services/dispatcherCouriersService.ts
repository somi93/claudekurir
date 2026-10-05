import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type {
  CompanyCourier,
  CourierCreatePayload,
  CourierSuspendPayload,
  CourierUpdatePayload,
} from "~/types/company-courier";

export const fetchCompanyCouriers = async (companyId: number): Promise<CompanyCourier[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<CompanyCourier>>(
    `/dispatcher/delivery-companies/${companyId}/couriers-status`
  );
  return response.data ?? [];
};

export const setCourierSuspended = async (
  companyId: number,
  courierId: number,
  payload: CourierSuspendPayload
): Promise<void> => {
  await useNuxtApp().$api(
    `/dispatcher/delivery-companies/${companyId}/couriers/${courierId}/suspend`,
    { method: "PATCH", body: payload }
  );
};

// Odgovor vraća PUN red (odgovor §3.11 / §1.2 - zajednički fullCourierRow),
// identičan couriers-status redu, pa pozivalac može optimistički da ga ubaci u
// listu bez dodatnog GET-a.
export const createCompanyCourier = async (
  companyId: number,
  payload: CourierCreatePayload
): Promise<CompanyCourier> => {
  const response = await useNuxtApp().$api<{ data: CompanyCourier }>(
    `/dispatcher/delivery-companies/${companyId}/couriers`,
    { method: "POST", body: payload }
  );
  return response.data;
};

// PATCH /dispatcher/delivery-companies/{companyId}/couriers/{courierId} -
// backend 28.08 (DIO 5, 5.1) POTVRDIO ovaj endpoint kao novi, firma-specifičan
// (name/lastname/phone/vehicle_type + contact_phone/bank_account/note).
// vehicle_type: null BRIŠE postojeće vozilo (nije posebna akcija).
//
// Odgovor vraća PUN red (odgovor §1.2 - zajednički fullCourierRow, uključuje i
// suspended*), pa pozivalac može direktno da zamijeni red u listi.
export const updateCompanyCourier = async (
  companyId: number,
  courierId: number,
  payload: CourierUpdatePayload
): Promise<CompanyCourier> => {
  const response = await useNuxtApp().$api<{ data: CompanyCourier }>(
    `/dispatcher/delivery-companies/${companyId}/couriers/${courierId}`,
    { method: "PATCH", body: payload }
  );
  return response.data;
};

// Bez tela zahteva - ne brise kurira iz sistema, samo ga uklanja sa liste ove
// firme (vidi napomena u types/company-courier.ts).
export const removeCompanyCourier = async (companyId: number, courierId: number): Promise<void> => {
  await useNuxtApp().$api(`/dispatcher/delivery-companies/${companyId}/couriers/${courierId}`, {
    method: "DELETE",
  });
};
