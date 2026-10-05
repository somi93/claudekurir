import { onBeforeUnmount, ref, watch, type Ref } from "vue";
import { fetchCourierInboxPage } from "~/services/courierInboxService";
import type { InboxMessage } from "~/types/inbox";

const WANTED = 3;
const PAGE_SIZE = 20;
// Gornja granica stranica: kurir koji je dobio stotine ponuda ne smije da vuče cijeli sandučić.
const MAX_PAGES = 5;

// Zadnje poruke koje je poslao DISPEČER izabranom kuriru (za sekciju Poruke u detalju).
// GET /couriers/{id}/inbox vraća i ponude i poruke platforme, a nema filter po pošiljaocu, pa se
// stranice dopunjavaju dok se ne skupe tri dispečerske poruke (ili dok ima stranica, najviše
// MAX_PAGES). Kurir sa 25 ponuda i tri starije poruke zato pokazuje sve tri.
export const useRecentMessages = (courierId: Ref<number | null>) => {
  const items = ref<InboxMessage[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  let token = 0;

  const load = async () => {
    const id = courierId.value;
    const mine = ++token;
    items.value = [];
    failed.value = false;
    if (id == null) {
      loading.value = false;
      return;
    }
    loading.value = true;
    const found: InboxMessage[] = [];
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { messages, meta } = await fetchCourierInboxPage(id, { page, perPage: PAGE_SIZE });
        if (mine !== token) return;
        // Ponuda za dostavu nije poruka dispečera, ma koji pošiljalac stajao na njoj.
        found.push(...messages.filter((m) => m.sender === "dispatcher" && m.category !== "offer"));
        if (found.length >= WANTED || !meta || meta.current_page >= meta.last_page) break;
      }
      items.value = found.slice(0, WANTED);
    } catch {
      if (mine === token) failed.value = true;
    } finally {
      if (mine === token) loading.value = false;
    }
  };

  watch(courierId, load, { immediate: true });
  onBeforeUnmount(() => {
    token += 1;
  });

  return { items, loading, failed, reload: load };
};
