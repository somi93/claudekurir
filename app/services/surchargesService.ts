import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type { NewSurchargeForm, Surcharge } from "~/types/pricing";

export const fetchSurcharges = async (companyId: number): Promise<Surcharge[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<Surcharge>>(
    `/delivery-companies/${companyId}/surcharges`
  );
  return response.data ?? [];
};

export const updateSurchargeActive = async (
  surchargeId: number,
  active: boolean
): Promise<void> => {
  await useNuxtApp().$api(`/delivery-companies/surcharges/${surchargeId}`, {
    method: "PUT",
    body: { active },
  });
};

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

export const deleteSurcharge = async (surchargeId: number): Promise<void> => {
  await useNuxtApp().$api(`/delivery-companies/surcharges/${surchargeId}`, {
    method: "DELETE",
  });
};
