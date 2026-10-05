import { useNuxtApp } from "nuxt/app";
import type {
  CourierSessions,
  CourierSessionsResponse,
  WorkSession,
  WorkSessionDto,
} from "~/types/session";
import { mapWorkSessionDto } from "~/models/CourierSession";

export const fetchCourierSessions = async (courierId: number): Promise<CourierSessions> => {
  const response = await useNuxtApp().$api<CourierSessionsResponse>(
    `/couriers/${courierId}/sessions`
  );
  return {
    available: (response.data?.available ?? []).map(mapWorkSessionDto),
    mine: (response.data?.mine ?? []).map(mapWorkSessionDto),
  };
};

export const reserveSession = async (
  courierId: number,
  sessionId: number
): Promise<WorkSession> => {
  const dto = await useNuxtApp().$api<WorkSessionDto>(
    `/couriers/${courierId}/sessions/${sessionId}/reserve`,
    { method: "POST" }
  );
  return mapWorkSessionDto(dto);
};

export const offerSessionSwap = async (sessionId: number): Promise<WorkSession> => {
  const dto = await useNuxtApp().$api<WorkSessionDto>(`/sessions/${sessionId}`, {
    method: "PUT",
    body: { offered_for_swap: true },
  });
  return mapWorkSessionDto(dto);
};

export const cancelSession = async (sessionId: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/sessions/${sessionId}`, {
    method: "DELETE",
  });
};
