import { useNuxtApp } from "nuxt/app";
import type { ApiItemResponse } from "~/types/api";
import type { OutboxStatus, OutboxSyncResult } from "~/types/outbox";

// Knjiženje dostava u glavnu knjigu (outbox relay) - backend odgovor
// 16.09.2026 §1. Bez delivery_company_id u putanji - status je globalan
// (kvar servisa/crona, ne po firmi).
export const fetchOutboxStatus = async (): Promise<OutboxStatus> => {
  const response = await useNuxtApp().$api<ApiItemResponse<OutboxStatus>>(
    "/dispatcher/outbox/status"
  );
  return response.data;
};

export const syncOutbox = async (): Promise<OutboxSyncResult> => {
  const response = await useNuxtApp().$api<ApiItemResponse<OutboxSyncResult>>(
    "/dispatcher/outbox/sync",
    { method: "POST" }
  );
  return response.data;
};

export const retryOutboxItem = async (id: number): Promise<void> => {
  await useNuxtApp().$api(`/dispatcher/outbox/${id}/retry`, { method: "POST" });
};
