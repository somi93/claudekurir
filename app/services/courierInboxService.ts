import { useNuxtApp } from "nuxt/app";
import type {
  BroadcastMessagePayload,
  BroadcastResponse,
  CourierInboxPage,
  CourierInboxQuery,
  CourierInboxResponse,
  InboxMessage,
  InboxMessageDto,
  InboxSummaryEntry,
  InboxSummaryEntryDto,
  SendInboxMessagePayload,
} from "~/types/inbox";
import type { ApiListResponse } from "~/types/api";
import { mapInboxMessageDto, mapInboxSummaryEntryDto } from "~/models/InboxMessage";

// GET .../inbox - bez parametara vraća SVE poruke kurira (isti format kao ranije).
// Sa ?category= filtrira, sa ?page= aktivira paginaciju i dodaje `meta` objekat
// (spec #223681, tačka 3).
export const fetchCourierInboxPage = async (
  courierId: number,
  query: CourierInboxQuery = {}
): Promise<CourierInboxPage> => {
  const params: Record<string, string | number> = {};
  if (query.category) params.category = query.category;
  if (query.page) params.page = query.page;
  if (query.perPage) params.per_page = query.perPage;

  const response = await useNuxtApp().$api<CourierInboxResponse>(
    `/couriers/${courierId}/inbox`,
    { params }
  );
  return {
    messages: (response.data ?? []).map(mapInboxMessageDto),
    meta: response.meta ?? null,
  };
};

// Zadržana radi postojećih pozivalaca (kurirski inbox) - vraća samo niz poruka.
export const fetchCourierInbox = async (
  courierId: number,
  query: CourierInboxQuery = {}
): Promise<InboxMessage[]> => {
  const { messages } = await fetchCourierInboxPage(courierId, query);
  return messages;
};

// Dispečer -> jedan kurir. sender se uvijek šalje kao "dispatcher" (vidi spec).
export const sendCourierInboxMessage = async (
  courierId: number,
  payload: SendInboxMessagePayload
): Promise<InboxMessage> => {
  const response = await useNuxtApp().$api<{ success: boolean; data: InboxMessageDto }>(
    `/couriers/${courierId}/inbox`,
    { method: "POST", body: { sender: "dispatcher", ...payload } }
  );
  return mapInboxMessageDto(response.data);
};

// Dispečer -> više / svi kuriri firme (spec #223681, tačka 2).
export const broadcastCourierMessage = async (
  companyId: number,
  payload: BroadcastMessagePayload
): Promise<number> => {
  const response = await useNuxtApp().$api<BroadcastResponse>(
    `/dispatcher/delivery-companies/${companyId}/broadcast`,
    { method: "POST", body: payload }
  );
  return response.data?.sent_to_count ?? 0;
};

// DELETE /api/inbox/{id} - brisanje pojedinačne poruke (spec #223681, tačka 4).
export const deleteInboxMessage = async (id: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/inbox/${id}`, { method: "DELETE" });
};

// PUT /inbox/{id} - {read:true} je potvrđeno; {read:false} ("Označi kao
// nepročitano") još nije potvrđen sa backendom (vidi docs/2026/10/
// 03_10_2026_Frontend_pitanja_za_backend.textile), pa pozivalac mora da vrati
// optimistički upis ako poziv padne.
export const setInboxMessageRead = async (id: number, read: boolean): Promise<InboxMessage> => {
  const dto = await useNuxtApp().$api<InboxMessageDto>(`/inbox/${id}`, {
    method: "PUT",
    body: { read },
  });
  return mapInboxMessageDto(dto);
};

export const markInboxMessageRead = (id: number): Promise<InboxMessage> =>
  setInboxMessageRead(id, true);

export const markAllInboxRead = async (courierId: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/couriers/${courierId}/inbox/mark-all-read`, {
    method: "PUT",
  });
};

// GET .../inbox-summary (odgovor backend 15.09) - zbirni red po kuriru (zadnja
// poruka + broj nepročitanih od dispečera), za "Istorija poslatih poruka" bez
// N poziva. Ruta pretpostavljena kao /dispatcher/... (isti prefiks kao
// broadcast) - backend odgovor nije naveo puni prefiks, provjeriti prvim
// live pozivom (network checklist 15.09).
export const fetchInboxSummary = async (companyId: number): Promise<InboxSummaryEntry[]> => {
  const response = await useNuxtApp().$api<ApiListResponse<InboxSummaryEntryDto>>(
    `/dispatcher/delivery-companies/${companyId}/inbox-summary`
  );
  return (response.data ?? []).map(mapInboxSummaryEntryDto);
};
