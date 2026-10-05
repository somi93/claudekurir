import { computed, onMounted, reactive, ref, watch, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { useInboxStore } from "~/stores/inbox";
import { CATEGORY_META } from "~/utils/inbox";
import { groupInboxByDay, isOffer } from "~/utils/inboxGroups";
import type { InboxCategory } from "~/types/inbox";

export type InboxCategoryFilter = "all" | InboxCategory;

export type InboxFilterChip = {
  value: InboxCategoryFilter;
  label: string;
  // Nepročitane PRAVE poruke u kategoriji (ponude se ne broje).
  unread: number;
};

// Redoslijed filtera: prvo ono što traži akciju.
const CATEGORY_FILTER_ORDER: InboxCategory[] = ["todo", "announcement", "promotion", "offer"];

// Pogled stranice "Poruke" (filter, grupisanje po danu, rasklopljeni sažeci
// ponuda) nad zajedničkim store-om sandučeta. Same poruke, brojač i osvježavanje
// žive u stores/inbox.ts - da bedž na početnoj i u navigaciji bude isti broj.
export const useCourierInbox = (courierId: ComputedRef<number>) => {
  const store = useInboxStore();
  const { messages, loaded, loading, loadingMore, errorMessage, unreadCount, hasMore, pagesLoaded } =
    storeToRefs(store);

  const categoryFilter = ref<InboxCategoryFilter>("all");
  // Ključevi dana ("YYYY-MM-DD") čiji je sažetak ponuda rasklopljen.
  const expandedDigests = reactive(new Set<string>());

  // Čipovi se grade iz stvarnih poruka - prikazujemo samo kategorije koje kurir
  // zaista ima, plus "Sve".
  const chips = computed<InboxFilterChip[]>(() => {
    const present = new Set(messages.value.map((m) => m.category));
    const unreadIn = (category: InboxCategory) =>
      messages.value.filter((m) => !m.read && m.category === category).length;

    const list: InboxFilterChip[] = [
      { value: "all", label: "Sve", unread: unreadCount.value },
    ];
    for (const category of CATEGORY_FILTER_ORDER) {
      if (!present.has(category)) continue;
      list.push({
        value: category,
        label: CATEGORY_META[category].chip,
        unread: isOffer({ category }) ? 0 : unreadIn(category),
      });
    }
    return list;
  });

  const filteredMessages = computed(() =>
    categoryFilter.value === "all"
      ? messages.value
      : messages.value.filter((m) => m.category === categoryFilter.value)
  );

  const dayGroups = computed(() =>
    groupInboxByDay(filteredMessages.value, categoryFilter.value === "all" ? "digest" : "flat")
  );

  // Ako izabrana kategorija više ne postoji (npr. posle osvježavanja), vrati na "Sve".
  watch(chips, (list) => {
    if (!list.some((c) => c.value === categoryFilter.value)) categoryFilter.value = "all";
  });

  const toggleDigest = (key: string) => {
    if (expandedDigests.has(key)) expandedDigests.delete(key);
    else expandedDigests.add(key);
  };

  const open = (id: number) => {
    if (!Number.isFinite(id) || id <= 0) return;
    store.start(id);
    void store.openInbox();
  };

  onMounted(() => open(courierId.value));
  watch(courierId, open);

  return {
    messages,
    loaded,
    loading,
    loadingMore,
    errorMessage,
    unreadCount,
    hasMore,
    pagesLoaded,
    categoryFilter,
    chips,
    filteredMessages,
    dayGroups,
    expandedDigests,
    toggleDigest,
    retry: () => store.load(),
    loadMore: () => store.loadMore(),
    markRead: (id: number) => store.markRead(id),
    markUnread: (id: number) => store.markUnread(id),
    markAllRead: () => store.markAllRead(),
  };
};
