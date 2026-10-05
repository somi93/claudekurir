// Deli tekst poruke na dijelove (običan tekst / veza) da telefon i linkovi
// budu dodirljivi. Namjerno vraća NIZ, a ne HTML: tekst piše dispečer, pa se
// renderuje kroz šablon (v-for) bez v-html - ni jedan znak iz poruke ne može da
// postane markup.

export type TextSegment = {
  type: "text" | "link";
  text: string;
  // Samo za type "link": tel:+38766123456 ili https://...
  href?: string;
};

// http(s)://... ili www... - do prvog razmaka.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
// Veoma tolerantan oblik telefona (razmak, crtica, kosa crta kao razdvajači);
// stvarnu validaciju radi isPhone() ispod, jer regex ne može da razlikuje
// "066/123-456" od datuma "03/10/2026".
const PHONE_PATTERN = /\+?\d(?:[  \-/]?\d){7,16}/g;

// Interpunkcija koja se često nalazi odmah iza linka u rečenici - nije dio
// adrese ("...pogledaj https://ordera.app/raspored.").
const TRAILING_PUNCTUATION = /[.,;:!?)\]}"'»]+$/;

const DATE_LIKE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;

const isPhone = (value: string): boolean => {
  const trimmed = value.trim();
  if (DATE_LIKE.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return false;
  // Broj mora da počne sa + ili 0 (lokalni 066..., međunarodni +387.../00387...).
  // Običan niz cifara (npr. šifra, iznos) tako ne postaje poziv.
  return trimmed.startsWith("+") || trimmed.startsWith("0");
};

const toTelHref = (value: string): string => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) return `tel:+${digits.slice(2)}`;
  if (trimmed.startsWith("+")) return `tel:+${digits}`;
  return `tel:${digits}`;
};

type Match = { start: number; end: number; text: string; href: string };

const findUrls = (input: string): Match[] => {
  const matches: Match[] = [];
  for (const m of input.matchAll(URL_PATTERN)) {
    const raw = m[0];
    const text = raw.replace(TRAILING_PUNCTUATION, "");
    if (!text) continue;
    const start = m.index ?? 0;
    matches.push({
      start,
      end: start + text.length,
      text,
      href: /^https?:\/\//i.test(text) ? text : `https://${text}`,
    });
  }
  return matches;
};

const findPhones = (input: string, taken: Match[]): Match[] => {
  const matches: Match[] = [];
  for (const m of input.matchAll(PHONE_PATTERN)) {
    const start = m.index ?? 0;
    const text = m[0].replace(/[  \-/]+$/, "");
    const end = start + text.length;
    // Ne dira u već prepoznat link (npr. broj u adresi) ni u širi niz slova/cifara.
    if (taken.some((t) => start < t.end && end > t.start)) continue;
    const before = input[start - 1];
    const after = input[end];
    if ((before && /[\p{L}\d]/u.test(before)) || (after && /[\p{L}\d]/u.test(after))) continue;
    if (!isPhone(text)) continue;
    matches.push({ start, end, text, href: toTelHref(text) });
  }
  return matches;
};

export const linkify = (input: string | null | undefined): TextSegment[] => {
  const text = input ?? "";
  if (!text) return [];

  const urls = findUrls(text);
  const phones = findPhones(text, urls);
  const all = [...urls, ...phones].sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of all) {
    if (match.start < cursor) continue;
    if (match.start > cursor) segments.push({ type: "text", text: text.slice(cursor, match.start) });
    segments.push({ type: "link", text: match.text, href: match.href });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ type: "text", text: text.slice(cursor) });
  return segments;
};
