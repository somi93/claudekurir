import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse } from "~/types/api";
import type { Pricing, PricingCalculation } from "~/types/pricing";

export type PricingCalculationParams = {
  restaurant_lat: number;
  restaurant_lng: number;
  customer_lat: number;
  customer_lng: number;
};

export const fetchDeliveryPricing = async (companyId: number): Promise<Pricing> => {
  const response = await useNuxtApp().$api<ApiItemResponse<Pricing>>(
    `/delivery-companies/${companyId}/pricing`
  );
  return response.data;
};

export const calculateDeliveryPricing = async (
  companyId: number,
  params: PricingCalculationParams
): Promise<PricingCalculation> => {
  const response = await useNuxtApp().$api<ApiItemResponse<PricingCalculation>>(
    `/delivery-companies/${companyId}/pricing/calculate`,
    { method: "POST", body: params }
  );
  return response.data;
};

export const updateDeliveryPricing = async (
  companyId: number,
  payload: Pick<Pricing, "base_price" | "price_per_km" | "currency">
): Promise<Pricing> => {
  const response = await useNuxtApp().$api<ApiItemResponse<Pricing>>(
    `/delivery-companies/${companyId}/pricing`,
    { method: "PUT", body: payload }
  );
  return response.data;
};
