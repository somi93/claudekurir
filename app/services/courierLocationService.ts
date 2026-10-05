import { useNuxtApp } from "nuxt/app";
import type {
  CourierLocation,
  CourierLocationPayload,
  CourierLocationsResponse,
  DispatcherCourierLocationsQuery,
  DispatcherCourierLocationsResponse,
} from "~/types/courier";

export const fetchCourierLocations = async (): Promise<CourierLocation[]> => {
  const response = await useNuxtApp().$api<CourierLocationsResponse>("/courier/locations");
  return response.data ?? [];
};

// GET /dispatcher/delivery-companies/{companyId}/courier-locations (09.09,
// odgovor 1.3). Vraća cijeli odgovor (data + opciono meta) - pozivalac bira
// paginirani ili flat režim po tome šalje li `page`. NAPOMENA: oblik reda
// (DispatcherCourierLocation) je još provizoran, stranica ga ne troši dok
// backend ne potvrdi polja - vidi
// docs/2026/09/09_09_2026_Frontend_pitanja_za_backend.textile §1.3.
export const fetchDispatcherCourierLocations = async (
  companyId: number,
  query: DispatcherCourierLocationsQuery = {}
): Promise<DispatcherCourierLocationsResponse> => {
  return await useNuxtApp().$api<DispatcherCourierLocationsResponse>(
    `/dispatcher/delivery-companies/${companyId}/courier-locations`,
    { query }
  );
};

export const sendCourierLocation = async (payload: CourierLocationPayload): Promise<void> => {
  await useNuxtApp().$api<void>("/courier/location", {
    method: "POST",
    body: payload,
  });
};
