import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse } from "~/types/api";

type AvailabilityEnforcementDto = {
  delivery_company_id: number;
  requires_availability_confirmation: boolean;
};

// GET deploy-ovan 14.08 (Odgovori_frontend_analiza_14_avgust.md, stavka 2.3) -
// prekidač sad učitava stvarno stanje sa servera umesto da se resetuje na
// false pri svakoj promeni firme/reload-u.
export const fetchAvailabilityEnforcement = async (
  deliveryCompanyId: number
): Promise<boolean> => {
  const response = await useNuxtApp().$api<ApiItemResponse<AvailabilityEnforcementDto>>(
    `/dispatcher/delivery-companies/${deliveryCompanyId}/availability-enforcement`
  );
  return response.data.requires_availability_confirmation;
};

export const setAvailabilityEnforcement = async (
  deliveryCompanyId: number,
  enabled: boolean
): Promise<void> => {
  await useNuxtApp().$api<void>(
    `/dispatcher/delivery-companies/${deliveryCompanyId}/availability-enforcement`,
    { method: "PATCH", body: { enabled } }
  );
};
