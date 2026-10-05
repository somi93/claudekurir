import { useNuxtApp } from "nuxt/app";
import type { CourierScoringResponse } from "~/types/scoring";
import { mapCourierScoringDto, type CourierScoring } from "~/models/CourierScoring";

// Singleton po kuriru (kao user_details) - show/store/update/destroy, nema index.
// Scoring je sistemski (nedeljni batch job) - kurirska strana je samo za čitanje.
export const fetchCourierScoring = async (courierId: number): Promise<CourierScoring> => {
  const response = await useNuxtApp().$api<CourierScoringResponse>(
    `/couriers/${courierId}/scoring`
  );
  return mapCourierScoringDto(response.data);
};
