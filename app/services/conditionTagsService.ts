import { useNuxtApp } from "nuxt/app";
import type { ApiListResponse } from "~/types/api";
import type { ConditionTag } from "~/types/pricing";

// Zajednički katalog za sve firme - ne traži companyId u putanji (vidi
// Dopuna_katalog_tagovi_frontend_cirilica.md).
export const fetchConditionTags = async (): Promise<ConditionTag[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<ConditionTag>>("/condition-tags");
  return response.data ?? [];
};
