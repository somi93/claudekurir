import type { DispatcherMessageCategory } from "~/types/inbox";
import { DEFAULT_SELECTION, PRESET_ORDER, type PresetKey, type Selection } from "~/utils/messageAudience";
import { pluralizeSr } from "~/utils/datetime";

// Čista logika pisanja poruke: provjera prije slanja, šabloni, tekst nakon slanja i oblik u kom se
// nacrt čuva na uređaju. Bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u.

export type MessageDraft = {
  category: DispatcherMessageCategory;
  title: string;
  body: string;
};

export const BLANK_DRAFT: Readonly<MessageDraft> = { category: "announcement", title: "", body: "" };

export const isBlankDraft = (d: Pick<MessageDraft, "title" | "body">): boolean =>
  !String(d.title || "").trim() && !String(d.body || "").trim();

// "___" je mjesto koje dispečer treba da popuni (šablon "Bonus od ___ KM"); sa njim se ne šalje.
const PLACEHOLDER = /_{2,}/;

export type DraftCheck = { titleOk: boolean; bodyOk: boolean; valid: boolean; hint: string };

export const checkDraft = (draft: Pick<MessageDraft, "title" | "body">, count: number): DraftCheck => {
  const t = String(draft.title || "").trim();
  const b = String(draft.body || "").trim();
  const out: DraftCheck = { titleOk: !!t, bodyOk: !!b, valid: false, hint: "" };
  if (!t && !b) out.hint = "Upiši naslov i tekst poruke.";
  else if (!t) out.hint = "Upiši naslov.";
  else if (!b) out.hint = "Upiši tekst poruke.";
  else if (count === 0) out.hint = "Izaberi bar jednog kurira.";
  else if (PLACEHOLDER.test(t) || PLACEHOLDER.test(b)) out.hint = "Zamijeni ___ pravom vrijednošću prije slanja.";
  else out.valid = true;
  return out;
};

// --- Tekst nakon slanja ---------------------------------------------------------------------------

// "1 kuriru", "2 kurira", "21 kuriru"
export const sentWho = (n: number): string => `${n} ${pluralizeSr(n, "kuriru", "kurira", "kurira")}`;

// Odgovor servera naspram onoga što je ekran obećao: razlika ne smije da prođe nezapaženo.
export const sentText = (sent: number, intended: number): { tone: "ok" | "warn"; text: string } =>
  sent === intended
    ? { tone: "ok", text: `Poruka poslata ${sentWho(sent)}.` }
    : {
        tone: "warn",
        text: `Poruka poslata ${sent} od ${intended} kurira. Provjeri u praćenju ko je nije dobio.`,
      };

// --- Šabloni --------------------------------------------------------------------------------------

export type MessageTemplate = {
  id: string;
  label: string;
  category: DispatcherMessageCategory;
  title: string;
  body: string;
};

// Početni tekstovi su prijedlog formulacije; dispečer ih mijenja prije slanja.
export const TEMPLATES: MessageTemplate[] = [
  {
    id: "t1",
    label: "Gužva u gradu",
    category: "announcement",
    title: "Velika gužva u gradu",
    body: "Trenutno imamo puno narudžbi. Ko je slobodan neka se prijavi u aplikaciji, a ko ne može neka javi dispečeru.",
  },
  {
    id: "t2",
    label: "Predaj gotovinu",
    category: "todo",
    title: "Predaj gotovinu",
    body: "Molim te da gotovinu koju imaš kod sebe predaš u poslovnici najkasnije do kraja smjene.",
  },
  {
    id: "t3",
    label: "Oprez: kiša",
    category: "announcement",
    title: "Pada kiša, pazite na put",
    body: "Kiša je cijeli dan. Vozite oprezno i nemojte žuriti zbog vremena dostave.",
  },
  {
    id: "t4",
    label: "Bonus",
    category: "promotion",
    title: "Bonus ovog vikenda",
    body: "Svaka dostava ovog vikenda nosi bonus od ___ KM. Važi subotom i nedjeljom od ___ do ___ časova.",
  },
  {
    id: "t5",
    label: "Javi se dispečeru",
    category: "todo",
    title: "Javi se dispečeru",
    body: "Molim te da se javiš dispečeru čim završiš trenutnu dostavu.",
  },
];

const CATEGORY_KEYS: DispatcherMessageCategory[] = ["announcement", "todo", "promotion"];
const isCategory = (v: unknown): v is DispatcherMessageCategory =>
  typeof v === "string" && (CATEGORY_KEYS as string[]).includes(v);

// Lični šabloni iz localStorage-a: sve što nije oblik šablona se odbacuje (pokvaren zapis ne smije
// da obori ekran).
export const parseTemplates = (raw: string | null): MessageTemplate[] => {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (t): t is MessageTemplate =>
        !!t &&
        typeof t === "object" &&
        typeof (t as MessageTemplate).id === "string" &&
        typeof (t as MessageTemplate).label === "string" &&
        typeof (t as MessageTemplate).title === "string" &&
        typeof (t as MessageTemplate).body === "string" &&
        isCategory((t as MessageTemplate).category)
    );
  } catch {
    return [];
  }
};

// --- Nacrt na uređaju -----------------------------------------------------------------------------

// Nacrt stariji od ovoga se odbacuje (poruka od prošle sedmice nije nacrt, nego ostatak).
export const DRAFT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export type StoredSelection = { kind: "preset"; key: PresetKey } | { kind: "manual"; ids: number[] };

export type StoredDraft = { draft: MessageDraft; sel: StoredSelection; at: number };

export const storeSelection = (sel: Selection): StoredSelection =>
  sel.kind === "preset" ? { kind: "preset", key: sel.key } : { kind: "manual", ids: [...sel.ids] };

export const loadSelection = (sel: StoredSelection): Selection =>
  sel.kind === "preset" ? { kind: "preset", key: sel.key } : { kind: "manual", ids: new Set(sel.ids) };

export const serializeDraft = (draft: MessageDraft, sel: Selection, at: number): string =>
  JSON.stringify({ draft: { category: draft.category, title: draft.title, body: draft.body }, sel: storeSelection(sel), at });

export const parseDraft = (raw: string | null, now: number): StoredDraft | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredDraft> | null;
    if (!v || typeof v !== "object" || typeof v.at !== "number") return null;
    if (now - v.at > DRAFT_MAX_AGE_MS || v.at > now + 60_000) return null;
    const d = v.draft;
    if (!d || typeof d.title !== "string" || typeof d.body !== "string") return null;
    const category = isCategory(d.category) ? d.category : BLANK_DRAFT.category;
    if (isBlankDraft(d)) return null;
    const s = v.sel;
    let sel: StoredSelection = storeSelection(DEFAULT_SELECTION);
    if (s && s.kind === "preset" && (PRESET_ORDER as string[]).includes(s.key)) sel = { kind: "preset", key: s.key };
    else if (s && s.kind === "manual" && Array.isArray(s.ids)) {
      sel = { kind: "manual", ids: s.ids.filter((x): x is number => typeof x === "number") };
    }
    return { draft: { category, title: d.title, body: d.body }, sel, at: v.at };
  } catch {
    return null;
  }
};
