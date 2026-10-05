import type { DispatcherMessageCategory, InboxMessage } from "~/types/inbox";
import type { MessageDraft } from "~/utils/messageDraft";

// Čista logika praćenja poslatih poruka (bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u).
//
// Backend nema oznaku grupne poruke niti "ko je pročitao". Zato se poslije slanja sanduče svakog
// primaoca čita sa ?category= (ponude se tako ne miješaju) i poruka se traži po tekstu. Gornja
// granica čuva server od naleta. Kad backend da paket poruke (B1), ovo postaje jedan zahtjev.

// Praćenje samo do ovoliko primalaca.
export const CHECK_MAX = 40;
// Poruka se traži u razmaku do ovoliko od slanja.
export const SKEW_MS = 15 * 60 * 1000;
// Koliko poruka jedan zahtjev traži po sandučiću.
export const CHECK_PAGE = 10;
// Najviše zahtjeva istovremeno (čitanje sandučića i povlačenje).
export const CONCURRENCY = 6;
// Automatske provjere poslije slanja.
export const AUTO_CHECKS_MS = [20_000, 120_000];

export type ReadState = "read" | "unread" | "missing" | "error" | "pending";

export type RecipientResult = {
  state: Exclude<ReadState, "pending">;
  // Id poruke u sandučiću primaoca (za povlačenje); null kad poruke nema.
  inboxId: number | null;
};

export type BatchStatus = "sent" | "retracted" | "partial";

// Jedna poslata poruka i ono što se o njoj zna. Živi u ovoj sesiji (sessionStorage).
export type SentBatch = {
  id: string;
  category: DispatcherMessageCategory;
  title: string;
  body: string;
  sentAt: number;
  recipients: number[];
  // "U dostavi", "Svi kuriri", ime kurira...
  audience: string;
  // Koliko je ekran obećao i koliko je server javio.
  intended: number;
  sentCount: number;
  results: Record<number, RecipientResult>;
  checkedAt: number | null;
  status: BatchStatus;
  retracted: { ok: number; fail: number; total: number } | null;
};

export const canTrack = (batch: Pick<SentBatch, "recipients">): boolean => batch.recipients.length <= CHECK_MAX;

export const checkQuery = (batch: Pick<SentBatch, "category">) => ({
  category: batch.category,
  page: 1,
  perPage: CHECK_PAGE,
});

const at = (m: { sentAt: string }): number => Date.parse(m.sentAt);
const same = (a: unknown, b: unknown): boolean => String(a ?? "").trim() === String(b ?? "").trim();

// Poruka u sandučiću primaoca koja je ova poslana poruka: pošiljalac dispečer, ista kategorija,
// naslov i tekst, u razmaku do SKEW_MS od slanja; najbliža vremenu slanja. `taken` su poruke koje je
// već preuzeo drugi paket istog teksta (isti tekst poslan dvaput u istoj sesiji).
export const matchSent = (
  batch: Pick<SentBatch, "category" | "title" | "body" | "sentAt">,
  rows: InboxMessage[],
  taken: ReadonlySet<number> = new Set()
): InboxMessage | null => {
  const t0 = batch.sentAt;
  const candidates = rows
    .filter(
      (m) =>
        m.sender === "dispatcher" &&
        m.category === batch.category &&
        same(m.title, batch.title) &&
        same(m.body, batch.body) &&
        !taken.has(m.id) &&
        Math.abs(at(m) - t0) <= SKEW_MS
    )
    .sort((a, b) => Math.abs(at(a) - t0) - Math.abs(at(b) - t0));
  return candidates[0] ?? null;
};

// Id-jevi poruka koje su drugi paketi istog teksta već preuzeli.
export const claimedByOthers = (batch: SentBatch, all: SentBatch[]): Set<number> => {
  const taken = new Set<number>();
  for (const b of all) {
    if (b === batch || b.category !== batch.category || b.title !== batch.title || b.body !== batch.body) continue;
    for (const r of Object.values(b.results)) if (r.inboxId != null) taken.add(r.inboxId);
  }
  return taken;
};

export type Tally = { total: number; read: number; unread: number; missing: number; error: number; pending: number };

export const tally = (batch: Pick<SentBatch, "recipients" | "results">): Tally => {
  const o: Tally = { total: batch.recipients.length, read: 0, unread: 0, missing: 0, error: 0, pending: 0 };
  for (const id of batch.recipients) {
    const r = batch.results[id];
    o[r ? r.state : "pending"] += 1;
  }
  return o;
};

export const unreadIds = (batch: Pick<SentBatch, "recipients" | "results">): number[] =>
  batch.recipients.filter((id) => batch.results[id]?.state === "unread");

export const REMINDER_PREFIX = "Podsjetnik: ";

// Podsjetnik je ista poruka sa prefiksom (prefiks se ne udvostručava).
export const reminderDraft = (batch: Pick<SentBatch, "category" | "title" | "body">): MessageDraft => ({
  category: batch.category,
  title: /^podsjetnik:/i.test(batch.title) ? batch.title : `${REMINDER_PREFIX}${batch.title}`,
  body: batch.body,
});

export const retractTargets = (
  batch: Pick<SentBatch, "recipients" | "results">
): { courierId: number; inboxId: number }[] =>
  batch.recipients.flatMap((id) => {
    const inboxId = batch.results[id]?.inboxId;
    return inboxId != null ? [{ courierId: id, inboxId }] : [];
  });

// Provjera staje kad je palo više od trećine svih zahtjeva: server je zauzet, nastavak bi ga samo
// dodatno opteretio.
export const tooManyFailures = (failed: number, total: number): boolean => failed * 3 > total;

// Obrađuje stavke sa najviše `limit` istovremenih poziva (čitanje sandučića, povlačenje).
export const runPool = async <T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  const queue = items.slice();
  const run = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, run));
};
