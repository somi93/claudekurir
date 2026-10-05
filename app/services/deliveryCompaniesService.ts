import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse, ApiListResponse } from "~/types/api";
import type { Company, CompanyDto } from "~/types/pricing";

const mapCompanyDto = (dto: CompanyDto): Company => ({
  id: dto.id,
  name: dto.name,
  cityId: dto.city_id ?? null,
  cityName: dto.city_name ?? null,
  currency: dto.currency ?? null,
});

// /delivery-companies vraća SVE firme u sistemu (tuđe/test firme uključene) -
// za dispečerski panel koristi ovo, koje vraća samo firme za koje je
// ulogovani dispečer aktivno vezan (Changelog_13_avgust_frontend.md stavka 2).
export const fetchMyCompanies = async (): Promise<Company[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<CompanyDto>>("/dispatcher/my-companies");
  return (response.data ?? []).map(mapCompanyDto);
};

export const setCompanyCity = async (companyId: number, cityId: number): Promise<Company> => {
  const response = await useNuxtApp().$api<ApiItemResponse<CompanyDto>>(
    `/dispatcher/delivery-companies/${companyId}/city`,
    { method: "PATCH", body: { city_id: cityId } }
  );
  return mapCompanyDto(response.data);
};
