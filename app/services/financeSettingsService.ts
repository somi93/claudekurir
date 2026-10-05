import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse } from "~/types/api";
import type { FinanceSettings, FinanceSettingsUpdate } from "~/types/finance-settings";

export const fetchFinanceSettings = async (companyId: number): Promise<FinanceSettings> => {
  const response = await useNuxtApp().$api<ApiItemResponse<FinanceSettings>>(
    `/dispatcher/delivery-companies/${companyId}/finance-settings`
  );
  return response.data;
};

export const updateFinanceSettings = async (
  companyId: number,
  payload: FinanceSettingsUpdate
): Promise<FinanceSettings> => {
  const response = await useNuxtApp().$api<ApiItemResponse<FinanceSettings>>(
    `/dispatcher/delivery-companies/${companyId}/finance-settings`,
    { method: "PATCH", body: payload }
  );
  return response.data;
};
