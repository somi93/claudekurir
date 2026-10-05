import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { CourierCompany, CourierCompanyDto } from "~/types/courier";

export const fetchCourierCompanies = async (courierId: number): Promise<CourierCompany[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<CourierCompanyDto>>(
    `/couriers/${courierId}/companies`
  );
  return (response.data ?? []).map((dto) => ({
    id: dto.id,
    name: dto.name,
    cityId: dto.city_id,
  }));
};
