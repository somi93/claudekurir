import { ref } from "vue";
import { deleteInboxMessage, fetchCourierInboxPage } from "~/services/courierInboxService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import {
  HISTORY_FETCH_SIZE,
  HISTORY_PAGE,
  newSources,
  takeNext,
  type HistorySource,
} from "~/utils/messageHistory";
import type { DispatcherMessageCategory, InboxMessage } from "~/types/inbox";

// Poruke jednog kurira za dispečera (najnovija prva), BEZ ponuda za dostavu.
// GET /couriers/{id}/inbox miješa poruke sa ponudama, a nema filter po pošiljaocu: stranica od 20
// u kojoj su same ponude pokazuje ništa (ili ponude kao poruke). Zato se čitaju tri kategorije
// koje dispečer šalje, svaka sa ?category=, i spajaju po vremenu (vidi utils/messageHistory).
// Ponude se nikad ne čitaju. Kad backend doda filter po pošiljaocu (B3), dovoljan je jedan zahtjev.
export const useCourierMessages = () => {
  const items = ref<InboxMessage[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  const loaded = ref(false);
  const error = ref("");
  const end = ref(false);

  let courierId: number | null = null;
  let sources: HistorySource<InboxMessage>[] = [];
  // Svaki novi izbor (kurir, kategorija) povećava broj; odgovor za stari izbor se odbacuje.
  let token = 0;

  // Izdaje sljedećih `HISTORY_PAGE` poruka; čita stranice izvora koji ih trebaju.
  const fill = async (mine: number): Promise<InboxMessage[] | null> => {
    const out: InboxMessage[] = [];
    for (let guard = 0; guard < 60; guard++) {
      const r = takeNext(sources, HISTORY_PAGE - out.length);
      out.push(...r.out);
      if (r.need.length) {
        await Promise.all(
          r.need.map(async (key) => {
            const src = sources.find((s) => s.key === key);
            if (!src || courierId == null) return;
            const { messages, meta } = await fetchCourierInboxPage(courierId, {
              category: key,
              page: src.page + 1,
              perPage: HISTORY_FETCH_SIZE,
            });
            if (mine !== token) return;
            // Brojač stranice ide naprijed tek kad je stranica stigla: ponovni pokušaj poslije pada
            // čita istu stranicu, ne preskače je.
            src.page += 1;
            src.buf.push(...messages.filter((m) => m.category !== "offer"));
            // Bez meta (stari odgovor) kraj je prva stranica koja nije puna.
            src.done = meta ? meta.current_page >= meta.last_page : messages.length < HISTORY_FETCH_SIZE;
          })
        );
        if (mine !== token) return null;
        continue;
      }
      end.value = r.end;
      break;
    }
    return out;
  };

  const open = async (id: number, category: DispatcherMessageCategory | null = null) => {
    const mine = ++token;
    courierId = id;
    sources = newSources<InboxMessage>(category);
    items.value = [];
    end.value = false;
    loaded.value = false;
    loadingMore.value = false;
    error.value = "";
    loading.value = true;
    try {
      const page = await fill(mine);
      if (page && mine === token) items.value = page;
    } catch (e) {
      if (mine === token) error.value = toFriendlyErrorMessage(e, "Ne mogu da učitam poruke.");
    } finally {
      if (mine === token) {
        loading.value = false;
        loaded.value = true;
      }
    }
  };

  const more = async () => {
    if (loading.value || loadingMore.value || end.value || courierId == null) return;
    const mine = token;
    loadingMore.value = true;
    error.value = "";
    try {
      const page = await fill(mine);
      if (page && mine === token) items.value = [...items.value, ...page];
    } catch (e) {
      if (mine === token) error.value = toFriendlyErrorMessage(e, "Ne mogu da učitam starije poruke.");
    } finally {
      if (mine === token) loadingMore.value = false;
    }
  };

  // DELETE /inbox/{id}: poruka nestaje iz sandučeta kurira (ko ju je pročitao, pročitao je).
  const remove = async (id: number): Promise<boolean> => {
    try {
      await deleteInboxMessage(id);
    } catch {
      return false;
    }
    items.value = items.value.filter((m) => m.id !== id);
    return true;
  };

  // Poništava sve što je u letu (zatvaranje liste, promjena kurira).
  const reset = () => {
    token += 1;
    courierId = null;
    sources = [];
    items.value = [];
    loading.value = false;
    loadingMore.value = false;
    loaded.value = false;
    error.value = "";
    end.value = false;
  };

  return { items, loading, loadingMore, loaded, error, end, open, more, remove, reset };
};
