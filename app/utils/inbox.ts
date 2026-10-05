import type { DispatcherMessageCategory, InboxCategory, InboxSender } from "~/types/inbox";

export const SENDER_META: Record<InboxSender, { label: string; icon: string; color: string }> = {
  dispatcher: { label: "Dispečer", icon: "mdi-account-voice", color: "#2f6fed" },
  platform: { label: "Platforma", icon: "mdi-bullhorn-outline", color: "#00b37e" },
};

export type CategoryMeta = {
  // Jednina - uz poruku i u detalju ("Obaveštenje").
  label: string;
  // Množina - za filter čipove ("Obaveštenja"), kratko da staje u red.
  chip: string;
  icon: string;
  // Svijetla boja za ikonu / akcente (ne za sitan tekst - kontrast je ispod 3:1).
  color: string;
  // Providna podloga iza ikone.
  tint: string;
  // Tamnija varijanta za TEKST na bijeloj/tintovanoj podlozi (kontrast >= 4.5:1).
  ink: string;
};

// Prikazne oznake za sve kategorije (i "offer" koji dispečer ne bira, ali ga
// može zateći u istoriji). `color` je ostao isti ključ kao ranije jer ga čita i
// dispečerska istorija poruka; `ink`/`tint`/`chip` su novi.
export const CATEGORY_META: Record<InboxCategory, CategoryMeta> = {
  announcement: {
    label: "Obaveštenje",
    chip: "Obaveštenja",
    icon: "mdi-bullhorn-outline",
    color: "#2f6fed",
    tint: "#2f6fed1f",
    ink: "#2459c7",
  },
  todo: {
    label: "Za uraditi",
    chip: "Za uraditi",
    icon: "mdi-checkbox-marked-circle-outline",
    color: "#ff9f1c",
    tint: "#ff9f1c1f",
    ink: "#9a4a07",
  },
  promotion: {
    label: "Promocija",
    chip: "Promocije",
    icon: "mdi-tag-outline",
    color: "#00b37e",
    tint: "#00b37e1f",
    ink: "#007a56",
  },
  offer: {
    label: "Ponuda za dostavu",
    chip: "Ponude",
    icon: "mdi-moped-outline",
    color: "#5b6676",
    tint: "#eceff3",
    ink: "#5b6676",
  },
};

export const getCategoryMeta = (category: InboxCategory | null | undefined): CategoryMeta =>
  (category && CATEGORY_META[category]) || CATEGORY_META.announcement;

// Dropdown u dijalozima za slanje - bez "offer" (rezervisan za automatske
// ponude, spec #223681). Default je "announcement".
export const DISPATCHER_MESSAGE_CATEGORIES: {
  value: DispatcherMessageCategory;
  label: string;
}[] = [
  { value: "announcement", label: CATEGORY_META.announcement.label },
  { value: "todo", label: CATEGORY_META.todo.label },
  { value: "promotion", label: CATEGORY_META.promotion.label },
];

export const DEFAULT_MESSAGE_CATEGORY: DispatcherMessageCategory = "announcement";

// --- Ponude u sandučetu ---------------------------------------------------
//
// Poruka kategorije "offer" je sistemski trag o ponudi za dostavu (ponuda se
// prihvata na ekranu Dostave, ovdje je samo zapis). Tekst je u obliku
// "Restoran — adresa · cijena" (oblik potvrditi uživo - vidi docs/2026/10/
// 03_10_2026_Frontend_pitanja_za_backend.textile). Zato ga čitamo odbrambeno:
// ako razdvajača nema, cijeli tekst je naslov.
const OFFER_SEPARATOR = /\s+[—–]\s+/;

export const splitOfferBody = (body: string): { headline: string; details: string } => {
  const text = (body ?? "").trim();
  const match = OFFER_SEPARATOR.exec(text);
  if (!match) return { headline: text, details: "" };
  return {
    headline: text.slice(0, match.index).trim(),
    details: text.slice(match.index + match[0].length).trim(),
  };
};

export { formatRelativeTime } from "~/utils/datetime";
