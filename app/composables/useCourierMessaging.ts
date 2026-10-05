import { computed, ref } from "vue";
import {
  broadcastCourierMessage,
  deleteInboxMessage,
  fetchCourierInboxPage,
  sendCourierInboxMessage,
} from "~/services/courierInboxService";
import { getErrorStatus, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type {
  BroadcastMessagePayload,
  InboxCategory,
  InboxMessage,
  InboxPaginationMeta,
  SendInboxMessagePayload,
} from "~/types/inbox";

const HISTORY_PAGE_SIZE = 20;

// Dispečerska strana inbox sistema (spec 27_08_2026 + #223681) - slanje poruke
// jednom kuriru ili grupno, pregled istorije poslatog (paginacija + filter po
// kategoriji) i brisanje. Nema companyId za slanje jednom kuriru: autorizaciju
// radi backend (403 ako veza ne postoji).
export const useCourierMessaging = () => {
  const alertStore = useAlertStore();

  const sending = ref(false);
  const broadcasting = ref(false);

  const history = ref<InboxMessage[]>([]);
  const historyMeta = ref<InboxPaginationMeta | null>(null);
  const loadingHistory = ref(false);
  const loadingMore = ref(false);
  const historyError = ref("");

  const hasMoreHistory = computed(() => {
    const meta = historyMeta.value;
    return !!meta && meta.current_page < meta.last_page;
  });

  const sendMessage = async (
    courierId: number,
    payload: SendInboxMessagePayload
  ): Promise<boolean> => {
    sending.value = true;
    try {
      await sendCourierInboxMessage(courierId, payload);
      alertStore.success("Poruka je poslata kuriru.");
      return true;
    } catch (error) {
      if (getErrorStatus(error) === 403) {
        alertStore.error(
          "Nemaš pravo da šalješ poruke ovom kuriru - nije vezan za tvoju firmu."
        );
      } else {
        alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da pošaljem poruku."));
      }
      return false;
    } finally {
      sending.value = false;
    }
  };

  const broadcast = async (
    companyId: number,
    payload: BroadcastMessagePayload
  ): Promise<boolean> => {
    broadcasting.value = true;
    try {
      const count = await broadcastCourierMessage(companyId, payload);
      alertStore.success(`Poruka poslata ${count} ${count === 1 ? "kuriru" : "kurira"}.`);
      return true;
    } catch (error) {
      alertStore.error(
        toFriendlyErrorMessage(error, "Ne mogu da pošaljem grupnu poruku.")
      );
      return false;
    } finally {
      broadcasting.value = false;
    }
  };

  // page 1 - resetuje listu. category null = bez filtera.
  const loadHistory = async (courierId: number, category: InboxCategory | null = null) => {
    loadingHistory.value = true;
    historyError.value = "";
    try {
      const { messages, meta } = await fetchCourierInboxPage(courierId, {
        category: category ?? undefined,
        page: 1,
        perPage: HISTORY_PAGE_SIZE,
      });
      history.value = messages;
      historyMeta.value = meta;
    } catch (error) {
      history.value = [];
      historyMeta.value = null;
      historyError.value = toFriendlyErrorMessage(
        error,
        "Ne mogu da učitam istoriju poruka."
      );
    } finally {
      loadingHistory.value = false;
    }
  };

  const loadMoreHistory = async (
    courierId: number,
    category: InboxCategory | null = null
  ) => {
    if (loadingMore.value || !hasMoreHistory.value) return;
    loadingMore.value = true;
    try {
      const nextPage = (historyMeta.value?.current_page ?? 1) + 1;
      const { messages, meta } = await fetchCourierInboxPage(courierId, {
        category: category ?? undefined,
        page: nextPage,
        perPage: HISTORY_PAGE_SIZE,
      });
      history.value = [...history.value, ...messages];
      historyMeta.value = meta;
    } catch (error) {
      alertStore.error(
        toFriendlyErrorMessage(error, "Ne mogu da učitam još poruka.")
      );
    } finally {
      loadingMore.value = false;
    }
  };

  const deleteMessage = async (id: number): Promise<boolean> => {
    try {
      await deleteInboxMessage(id);
      history.value = history.value.filter((m) => m.id !== id);
      if (historyMeta.value) {
        historyMeta.value = {
          ...historyMeta.value,
          total: Math.max(0, historyMeta.value.total - 1),
        };
      }
      return true;
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da obrišem poruku."));
      return false;
    }
  };

  return {
    sending,
    broadcasting,
    history,
    historyMeta,
    loadingHistory,
    loadingMore,
    historyError,
    hasMoreHistory,
    sendMessage,
    broadcast,
    loadHistory,
    loadMoreHistory,
    deleteMessage,
  };
};
