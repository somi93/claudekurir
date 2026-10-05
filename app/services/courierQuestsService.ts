import { useNuxtApp } from "nuxt/app";
import type { CourierQuestsResponse, Quest, QuestCreate, QuestUpdate } from "~/types/quest";
import { mapQuestDto } from "~/models/Quest";

export const fetchCourierQuests = async (courierId: number): Promise<Quest[]> => {
  const response = await useNuxtApp().$api<CourierQuestsResponse>(
    `/couriers/${courierId}/quests`
  );
  return (response.data ?? []).map(mapQuestDto);
};

export const createQuest = async (courierId: number, payload: QuestCreate): Promise<Quest> => {
  const dto = await useNuxtApp().$api<Quest>(`/couriers/${courierId}/quests`, {
    method: "POST",
    body: payload,
  });
  return mapQuestDto(dto);
};

export const updateQuest = async (id: number, payload: QuestUpdate): Promise<Quest> => {
  const dto = await useNuxtApp().$api<Quest>(`/quests/${id}`, {
    method: "PUT",
    body: payload,
  });
  return mapQuestDto(dto);
};

export const deleteQuest = async (id: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/quests/${id}`, {
    method: "DELETE",
  });
};
