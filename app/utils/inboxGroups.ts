import type { InboxMessage } from "~/types/inbox";
import { formatDayLabel, pluralizeSr, toLocalDayKey, toTimestamp } from "~/utils/datetime";
import { splitOfferBody } from "~/utils/inbox";

// Jedan red u listi: obična poruka ili dnevni "sažetak ponuda" (N ponuda za
// dostavu u jednom redu - ponude su trag, ne poruke, pa ih ne prikazujemo
// pojedinačno dok ih kurir ne rašири).
export type InboxEntry =
  | { kind: "message"; key: string; at: number; message: InboxMessage }
  | { kind: "digest"; key: string; at: number; offers: InboxMessage[] };

export type InboxDayGroup = {
  // Lokalni "YYYY-MM-DD" - ključ za rasklapanje sažetka.
  key: string;
  // "Danas" / "Juče" / "3. sep" (prošle godine sa godinom).
  label: string;
  at: number;
  // Nepročitane PRAVE poruke u tom danu (ponude se ne računaju).
  unread: number;
  entries: InboxEntry[];
};

export const isOffer = (message: Pick<InboxMessage, "category">): boolean =>
  message.category === "offer";

// Poruke su već najnovije-prve sa backenda, ali sortiramo po vremenu (pa po id-u)
// da spajanje stranica / osvježavanje nikad ne ostavi lošiji redoslijed.
export const sortNewestFirst = (messages: InboxMessage[]): InboxMessage[] =>
  [...messages].sort((a, b) => {
    const diff = toTimestamp(b.sentAt) - toTimestamp(a.sentAt);
    return diff !== 0 ? diff : b.id - a.id;
  });

/**
 * Grupiše poruke po (lokalnom) danu.
 *
 * - mode "digest" ("Sve"): obične poruke ostaju redovi, a SVE ponude jednog dana
 *   se skupe u jedan sažetak, postavljen na vrijeme najnovije ponude.
 * - mode "flat" (izabrana kategorija): svaka poruka je svoj red.
 */
export const groupInboxByDay = (
  messages: InboxMessage[],
  mode: "digest" | "flat"
): InboxDayGroup[] => {
  const groups = new Map<string, InboxDayGroup & { offers: InboxMessage[] }>();

  for (const message of sortNewestFirst(messages)) {
    const at = toTimestamp(message.sentAt);
    const key = toLocalDayKey(new Date(at));
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: formatDayLabel(message.sentAt),
        at,
        unread: 0,
        entries: [],
        offers: [],
      };
      groups.set(key, group);
    }

    if (!message.read && !isOffer(message)) group.unread += 1;

    if (mode === "digest" && isOffer(message)) {
      group.offers.push(message);
      continue;
    }
    group.entries.push({ kind: "message", key: `m${message.id}`, at, message });
  }

  return [...groups.values()].map(({ offers, ...group }) => {
    if (offers.length > 0) {
      group.entries.push({
        kind: "digest",
        key: `d${group.key}`,
        at: toTimestamp(offers[0]!.sentAt),
        offers,
      });
      group.entries.sort((a, b) => b.at - a.at);
    }
    return group;
  });
};

// "Roštiljnica Laguna, Urban Food i još 3" - prva dva različita naziva restorana.
// Prima već prevedene (latinica) nazive, jer ih zove komponenta.
export const summarizeOfferNames = (names: string[]): string => {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length <= 2) return unique.join(", ");
  return `${unique[0]}, ${unique[1]} i još ${unique.length - 2}`;
};

export const offerHeadline = (message: InboxMessage): string =>
  splitOfferBody(message.body).headline || message.title;

export const offersCountLabel = (count: number): string =>
  `${count} ${pluralizeSr(count, "ponuda", "ponude", "ponuda")} za dostavu`;

export const unreadCountLabel = (count: number): string =>
  `${count} ${pluralizeSr(count, "nepročitana", "nepročitane", "nepročitanih")}`;

export const unreadMessagesLabel = (count: number): string =>
  `${count} ${pluralizeSr(count, "nepročitana poruka", "nepročitane poruke", "nepročitanih poruka")}`;
