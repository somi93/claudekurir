import type { DispatcherMessageCategory } from "~/types/inbox";

// Čista logika poruka jednog kurira (bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u).
//
// GET /couriers/{id}/inbox miješa poruke dispečera sa ponudama za dostavu (kategorija "offer"), a
// nema filter po pošiljaocu. Zato se čitaju samo tri kategorije koje dispečer šalje (svaka sa
// ?category=), a ponude se nikad ne čitaju. Tri izvora, svaki sortiran od najnovije poruke, spajaju
// se po vremenu (k-way merge).

// Kategorije koje se čitaju (bez rezervisane "offer").
export const HISTORY_CATEGORIES: DispatcherMessageCategory[] = ["announcement", "todo", "promotion"];

// Koliko poruka jedan zahtjev traži po kategoriji.
export const HISTORY_FETCH_SIZE = 10;
// Koliko se poruka dodaje po "Prikaži starije".
export const HISTORY_PAGE = 8;

export type HistorySource<T> = {
  key: DispatcherMessageCategory;
  // Pročitane, a još neizdate poruke ovog izvora (najnovija prva).
  buf: T[];
  // Nema više stranica.
  done: boolean;
  // Zadnja pročitana stranica.
  page: number;
};

export const newSources = <T>(category: DispatcherMessageCategory | null): HistorySource<T>[] =>
  (category ? [category] : HISTORY_CATEGORIES).map((key) => ({ key, buf: [], done: false, page: 0 }));

const at = (m: { sentAt: string }): number => Date.parse(m.sentAt);

export type TakeResult<T> = {
  out: T[];
  // Izvori čija sljedeća stranica mora da se pročita prije nego što se išta izda.
  need: DispatcherMessageCategory[];
  // Svi izvori su ispražnjeni i pročitani do kraja.
  end: boolean;
};

// Najviše `n` najnovijih poruka. Poruka se smije izdati tek kad je za SVAKI izvor sa praznim
// baferom pročitana sljedeća stranica; inače bi starija poruka iz jednog izvora preskočila novu iz
// drugog. Pozivalac čita tražene stranice, ubacuje ih u `buf` i poziva ponovo.
export const takeNext = <T extends { sentAt: string }>(srcs: HistorySource<T>[], n: number): TakeResult<T> => {
  const out: T[] = [];
  while (out.length < n) {
    const blocked = srcs.filter((s) => s.buf.length === 0 && !s.done);
    if (blocked.length) return { out, need: blocked.map((s) => s.key), end: false };
    const live = srcs.filter((s) => s.buf.length);
    if (!live.length) return { out, need: [], end: true };
    const best = live.reduce((a, b) => (at(b.buf[0] as T) > at(a.buf[0] as T) ? b : a));
    out.push(best.buf.shift() as T);
  }
  const more = srcs.some((s) => s.buf.length || !s.done);
  return { out, need: [], end: !more };
};
