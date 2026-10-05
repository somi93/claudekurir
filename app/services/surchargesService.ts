import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type { NewSurchargeForm, Surcharge } from "~/types/pricing";
import type { SurchargeBody } from "~/utils/pricingDrafts";

export const fetchSurcharges = async (companyId: number): Promise<Surcharge[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<Surcharge>>(
    `/delivery-companies/${companyId}/surcharges`
  );
  return response.data ?? [];
};

// STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga setSurchargeActive).
export const updateSurchargeActive = async (
  surchargeId: number,
  active: boolean
): Promise<void> => {
  await useNuxtApp().$api(`/delivery-companies/surcharges/${surchargeId}`, {
    method: "PUT",
    body: { active },
  });
};

// STARI EKRAN: ukloniti kad pricing.vue pređe na novi (zamjenjuje ga createSurchargeFromBody).
// form.icon/conditionTagId dolaze iz izabranog kataloga taga ili lokalnog
// preseta (vidi useSurcharges.selectConditionTag/selectPreset) - front mora
// sam da kopira name/icon iz taga u telo zahteva, backend to ne radi
// automatski (vidi Dopuna_katalog_tagovi_frontend_cirilica.md, stavka 2).
export const createSurcharge = async (
  companyId: number,
  form: NewSurchargeForm
): Promise<Surcharge> => {
  const response = await useNuxtApp().$api<ApiItemResponse<Surcharge>>(
    `/delivery-companies/${companyId}/surcharges`,
    {
      method: "POST",
      body: {
        name: form.name.trim(),
        description: form.description.trim() || null,
        icon: form.icon,
        type: form.type,
        value: form.value,
        unit: form.unit.trim() || null,
        time_from: form.autoTime ? form.timeFrom || null : null,
        time_to: form.autoTime ? form.timeTo || null : null,
        active: true,
        condition_tag_id: form.conditionTagId,
      },
    }
  );
  return response.data;
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
