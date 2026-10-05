import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse } from "~/types/api";
import type { CourierProfileDto, CourierProfileUpdate } from "~/types/courier";
import { mapCourierProfileDto, type CourierProfile } from "~/models/CourierProfile";

export const fetchCourierProfile = async (courierId: number): Promise<CourierProfile> => {
  const response = await useNuxtApp().$api<ApiItemResponse<CourierProfileDto>>(
    `/couriers/${courierId}`
  );
  return mapCourierProfileDto(response.data);
};

// PUT odgovor se ne parsira - oblik nije potvrđen (za razliku od GET-a), a
// profile.vue ionako ne koristi povratnu vrednost, samo prikaže success/error.
export const updateCourierProfile = async (
  courierId: number,
  payload: CourierProfileUpdate
): Promise<void> => {
  await useNuxtApp().$api(`/couriers/${courierId}`, {
    method: "PUT",
    body: payload,
  });
};
