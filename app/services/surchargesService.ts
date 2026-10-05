import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type { Surcharge } from "~/types/pricing";
import type { SurchargeBody } from "~/utils/pricingDrafts";

export const fetchSurcharges = async (companyId: number): Promise<Surcharge[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<Surcharge>>(
    `/delivery-companies/${companyId}/surcharges`
  );
  return response.data ?? [];
};

// Oblik odgovora na POST/PUT nije potvrđen (B2): doplata se uzima samo ako odgovor nosi red sa id-jem,
// inače pozivalac osvježi listu.
const readSurcharge = (response: { data?: Surcharge | null } | null | undefined): Surcharge | null => {
  const data = response?.data;
  return data && typeof data.id === "number" ? data : null;
};

// Nova doplata iz tijela koje pravi toSurchargeBody (active iz nacrta, ne hardkodovano; D2: zadano
// isključena). Vraća doplatu ako je odgovor nosi, inače null.
export const createSurchargeFromBody = async (
  companyId: number,
  body: SurchargeBody
): Promise<Surcharge | null> => {
  const response = await useNuxtApp().$api<ApiItemResponse<Surcharge> | null>(
    `/delivery-companies/${companyId}/surcharges`,
    { method: "POST", body }
  );
  return readSurcharge(response);
};

// Izmjena doplate sa punim tijelom (PRETPOSTAVKA B2: PUT prima sva polja, ne samo `active`). Vraća
// doplatu ako je odgovor nosi, inače null (pozivalac tada osvježi listu).
export const updateSurcharge = async (
  surchargeId: number,
  body: SurchargeBody
): Promise<Surcharge | null> => {
  const response = await useNuxtApp().$api<ApiItemResponse<Surcharge> | null>(
    `/delivery-companies/surcharges/${surchargeId}`,
    { method: "PUT", body }
  );
  return readSurcharge(response);
};

// Uključivanje i isključivanje: samo {active}. Odgovor nosi activated_at koji backend sam postavlja
// (PRETPOSTAVKA B3), pa se vraća doplata ako stigne.
export const setSurchargeActive = async (
  surchargeId: number,
  active: boolean
): Promise<Surcharge | null> => {
  const response = await useNuxtApp().$api<ApiItemResponse<Surcharge> | null>(
    `/delivery-companies/surcharges/${surchargeId}`,
    { method: "PUT", body: { active } }
  );
  return readSurcharge(response);
};

export const deleteSurcharge = async (surchargeId: number): Promise<void> => {
  await useNuxtApp().$api(`/delivery-companies/surcharges/${surchargeId}`, {
    method: "DELETE",
  });
};
