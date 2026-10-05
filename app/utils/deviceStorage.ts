// localStorage / sessionStorage koji ne ruše ekran: u privatnom prozoru, uz blokirane podatke sajta ili
// van pregledača (SSR) pristup baca grešku ili nema, pa čitanje vraća null, a upis tiho ne radi.
type Kind = "local" | "session";

const area = (kind: Kind): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const readStored = (kind: Kind, key: string): string | null => {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const writeStored = (kind: Kind, key: string, value: string | null): void => {
  try {
    const a = area(kind);
    if (!a) return;
    if (value == null) a.removeItem(key);
    else a.setItem(key, value);
  } catch {
    // Puno ili blokirano: ekran radi i bez toga.
  }
};
