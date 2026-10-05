import { onBeforeUnmount, reactive, ref, watch, type Ref } from "vue";
import { readStored, writeStored } from "~/utils/deviceStorage";
import { DEFAULT_SELECTION, type Selection } from "~/utils/messageAudience";
import {
  BLANK_DRAFT,
  isBlankDraft,
  loadSelection,
  parseDraft,
  serializeDraft,
  type MessageDraft,
  type MessageTemplate,
} from "~/utils/messageDraft";
import { clock } from "~/utils/messageTime";

const SAVE_DELAY_MS = 250;

// Poruka koja se piše na ekranu Poruke: naslov, tekst, kategorija i izbor primalaca. Nacrt se čuva
// sam u localStorage (po firmi) i vraća kad se ekran ponovo otvori, uz natpis od kada je. Nema
// upozorenja pri izlasku: ništa se ne gubi. Nacrt stariji od 7 dana se odbacuje, a prazan se ne čuva.
export const useMessageDraft = (companyId: Ref<number | null>) => {
  const draft = reactive<MessageDraft>({ ...BLANK_DRAFT });
  const selection = ref<Selection>(DEFAULT_SELECTION);
  // "14:20" ako je ovo vraćen nacrt (za baner "Vraćen nacrt od 14:20").
  const restoredAt = ref<string | null>(null);
  // Tekst koji je šablon pregazio ("Vrati moj tekst").
  const undoDraft = ref<MessageDraft | null>(null);

  const key = () => (companyId.value ? `poruke-nacrt-${companyId.value}` : null);

  let timer: ReturnType<typeof setTimeout> | null = null;

  const saveNow = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const k = key();
    if (!k) return;
    writeStored("local", k, isBlankDraft(draft) ? null : serializeDraft(draft, selection.value, Date.now()));
  };

  const save = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveNow, SAVE_DELAY_MS);
  };

  // Vraća sačuvani nacrt (ako ga ima). Poziva se kad je firma poznata i spisak kurira učitan.
  const restore = (): boolean => {
    const k = key();
    if (!k) return false;
    const stored = parseDraft(readStored("local", k), Date.now());
    if (!stored) return false;
    Object.assign(draft, stored.draft);
    selection.value = loadSelection(stored.sel);
    restoredAt.value = clock(stored.at);
    return true;
  };

  const setSelection = (sel: Selection) => {
    selection.value = sel;
    save();
  };

  // Svaka izmjena teksta gasi baner "Vraćen nacrt" i "Vrati moj tekst".
  const edit = (patch: Partial<MessageDraft>) => {
    Object.assign(draft, patch);
    restoredAt.value = null;
    undoDraft.value = null;
    save();
  };

  const clear = () => {
    Object.assign(draft, BLANK_DRAFT);
    restoredAt.value = null;
    undoDraft.value = null;
  };

  // "Odbaci nacrt" i poslije slanja: nacrta više nema ni na uređaju.
  const drop = () => {
    clear();
    selection.value = DEFAULT_SELECTION;
    saveNow();
  };

  // Šablon zamjenjuje kategoriju, naslov i tekst; ako je dispečer već nešto napisao, to se pamti.
  const applyTemplate = (t: MessageTemplate) => {
    undoDraft.value = isBlankDraft(draft) ? null : { ...draft };
    Object.assign(draft, { category: t.category, title: t.title, body: t.body });
    restoredAt.value = null;
    save();
  };

  const undoTemplate = () => {
    if (!undoDraft.value) return;
    Object.assign(draft, undoDraft.value);
    undoDraft.value = null;
    save();
  };

  // Podsjetnik: ista poruka (sa prefiksom) samo onima koji nisu pročitali.
  const startFrom = (d: MessageDraft, sel: Selection) => {
    Object.assign(draft, d);
    selection.value = sel;
    restoredAt.value = null;
    undoDraft.value = null;
    save();
  };

  // Druga firma: nacrt prethodne ne smije da se pomiješa sa ovom.
  watch(companyId, (id, old) => {
    if (old != null && id !== old) {
      if (timer) clearTimeout(timer);
      timer = null;
      clear();
      selection.value = DEFAULT_SELECTION;
    }
  });

  const onHide = () => {
    if (typeof document !== "undefined" && document.hidden) saveNow();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onHide);
  onBeforeUnmount(() => {
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onHide);
    saveNow();
  });

  return {
    draft,
    selection,
    restoredAt,
    undoDraft,
    restore,
    setSelection,
    edit,
    drop,
    clear,
    applyTemplate,
    undoTemplate,
    startFrom,
    saveNow,
  };
};
