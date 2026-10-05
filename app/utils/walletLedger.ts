import type { CourierDelivery } from "~/types/courier-delivery";
import type { CourierCashHandover } from "~/types/cash-handover";
import type { CourierPayout } from "~/types/payout";
import type {
  WalletAccount,
  WalletDayGroup,
  WalletFilter,
  WalletHandover,
  WalletItem,
  WalletPayout,
  WalletPeriod,
  WalletSheetRef,
} from "~/types/wallet-ledger";
import { toAmount } from "~/utils/currency";
import { parseTimestamp, periodStart, pluralizeSr, toLocalDayKey } from "~/utils/datetime";
import { dayLabelOf, deliveriesLabel } from "~/utils/historyGroups";
import { toLatin } from "~/utils/toLatin";

// Čista logika ekrana Novčanik (bez Vue-a, da se može provjeriti u običnom Node-u):
// sklapanje liste iz tri izvora (dostave, predaje gotovine, isplate), periodi, filteri,
// zbirovi, grupisanje po danima, iznos iz polja za prijavu i adresa ekrana. Ništa ovdje
// ne čita sat - `now` se uvijek prosljeđuje.

// --- Oblikovanje --------------------------------------------------------------

export const r2 = (value: number): number => Math.round(value * 100) / 100;

// Iznos bez predznaka, dvije decimale ("94.94"). Predznak (+ / −) dodaje onaj ko piše.
export const kmText = (value: number | null | undefined): string =>
  Math.abs(r2(Number(value ?? 0))).toFixed(2);

export const MINUS = "−";

const itemsLabel = (n: number): string => `${n} ${pluralizeSr(n, "stavka", "stavke", "stavki")}`;
export const handoversLabel = (n: number): string =>
  `${n} ${pluralizeSr(n, "predaja", "predaje", "predaja")}`;
export const payoutsLabel = (n: number): string =>
  `${n} ${pluralizeSr(n, "isplata", "isplate", "isplata")}`;

// "upravo" / "prije 12 min" / "prije 3 h" / "prije 2 dana".
export const agoLabel = (ts: number, now: number): string => {
  const minutes = Math.round((now - ts) / 60_000);
  if (minutes < 1) return "upravo";
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours} h`;
  const days = Math.floor(hours / 24);
  return `prije ${days} ${pluralizeSr(days, "dan", "dana", "dana")}`;
};

// --- Periodi i adresa ----------------------------------------------------------

// Isti periodi i iste vrijednosti u adresi (?p=) kao u Istoriji, bez "Sve".
export const WALLET_PERIODS: { value: WalletPeriod; label: string; query: string }[] = [
  { value: "today", label: "Danas", query: "danas" },
  { value: "week", label: "Sedmica", query: "sedmica" },
  { value: "month", label: "30 dana", query: "30dana" },
];
export const DEFAULT_WALLET_PERIOD: WalletPeriod = "week";

export const walletPeriodFromQuery = (raw: unknown): WalletPeriod =>
  WALLET_PERIODS.find((p) => p.query === raw)?.value ?? DEFAULT_WALLET_PERIOD;

export const periodQuery = (period: WalletPeriod): string | null =>
  period === DEFAULT_WALLET_PERIOD
    ? null
    : (WALLET_PERIODS.find((p) => p.value === period)?.query ?? null);

// Stara ruta /courier/earnings vodi na ?tab=zarada.
export const accountFromQuery = (raw: unknown): WalletAccount => (raw === "zarada" ? "wage" : "cash");
export const accountQuery = (account: WalletAccount): string | null =>
  account === "wage" ? "zarada" : null;

// ?f=dostave | predaje (gotovina) | isplate (zarada). Predaje u zaradi (i obrnuto) ne
// postoje, pa se ignorišu.
export const filterFromQuery = (raw: unknown, account: WalletAccount): WalletFilter | null => {
  if (raw === "dostave") return "delivery";
  if (raw === "predaje" && account === "cash") return "settle";
  if (raw === "isplate" && account === "wage") return "settle";
  return null;
};
export const filterQuery = (filter: WalletFilter | null, account: WalletAccount): string | null =>
  filter === "delivery" ? "dostave" : filter === "settle" ? (account === "cash" ? "predaje" : "isplate") : null;

// ?o=d4261 | h912 | p41 | prijava | pomoc
export const sheetFromQuery = (raw: unknown): WalletSheetRef | null => {
  if (typeof raw !== "string") return null;
  if (raw === "prijava") return { kind: "report" };
  if (raw === "pomoc") return { kind: "help" };
  const match = /^([dhp])(\d{1,12})$/.exec(raw);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const kind = match[1] === "d" ? "delivery" : match[1] === "h" ? "handover" : "payout";
  return { kind, id };
};
export const sheetQuery = (sheet: WalletSheetRef): string => {
  switch (sheet.kind) {
    case "report":
      return "prijava";
    case "help":
      return "pomoc";
    case "delivery":
      return `d${sheet.id}`;
    case "handover":
      return `h${sheet.id}`;
    default:
      return `p${sheet.id}`;
  }
};

export const walletPeriodStartMs = (period: WalletPeriod, now: number): number =>
  periodStart(period, new Date(now)).getTime();

// Koji period je prvi širi (za "Prikaži sedmicu" kad je izabrani prazan).
export const widerWalletPeriod = (period: WalletPeriod): WalletPeriod | null =>
  period === "today" ? "week" : period === "week" ? "month" : null;

// --- Izvori -> ekran -------------------------------------------------------------

// Predaja iz /cash-handovers. Poznata su samo dva statusa (pending, confirmed); ono što
// backend jednog dana doda (npr. odbijeno) ne smije da izgleda kao predaja na čekanju,
// jer bi sakrilo dugme za prijavu - zato se takav red izostavlja.
export const toWalletHandover = (raw: CourierCashHandover): WalletHandover | null => {
  if (raw.status !== "confirmed" && raw.status !== "pending") return null;
  const reported = toAmount(raw.reported_amount) ?? 0;
  const reportedAt = parseTimestamp(raw.reported_at) ?? 0;
  const pending = raw.status === "pending";
  return {
    id: Number(raw.id),
    pending,
    reported,
    confirmed: pending ? null : (toAmount(raw.confirmed_amount) ?? reported),
    reportedAt,
    confirmedAt: pending ? null : (parseTimestamp(raw.confirmed_at) ?? reportedAt),
    confirmedBy: !pending && raw.confirmed_by_name ? toLatin(raw.confirmed_by_name).trim() || null : null,
    note: raw.note?.trim() || null,
  };
};

export const toWalletHandovers = (raw: readonly CourierCashHandover[]): WalletHandover[] =>
  raw.map(toWalletHandover).filter((h): h is WalletHandover => h !== null);

export const toWalletPayout = (raw: CourierPayout): WalletPayout => ({
  id: Number(raw.id),
  amount: toAmount(raw.amount) ?? 0,
  ts: parseTimestamp(raw.created_at) ?? 0,
  note: raw.note?.trim() || null,
  reference: String(raw.transaction_id ?? ""),
});

// Vrijeme po kojem se predaja svrstava u dan: potvrđena kad je potvrđena, prijavljena kad čeka.
export const handoverTs = (h: WalletHandover): number => h.confirmedAt ?? h.reportedAt;

// Koliko je dispečer potvrdio MANJE nego što je kurir prijavio (0 kad nije ili čeka).
export const handoverShortfall = (h: WalletHandover): number =>
  h.confirmed != null && h.confirmed < h.reported - 0.004 ? r2(h.reported - h.confirmed) : 0;

// Plata se kuriru obračunava mjesečno (nema zarade po dostavi) - pravilo iz types/earnings.ts:
// pay_rate_label je null samo za mjesečnu platu. To je osobina kurira, ne dostave, pa
// odlučuje najnovija dostava sa obračunom.
export const isMonthlyCourier = (deliveries: readonly CourierDelivery[]): boolean => {
  let latest: CourierDelivery | null = null;
  for (const d of deliveries) {
    if (!d.earnings) continue;
    if (!latest || (d.ts ?? 0) > (latest.ts ?? 0)) latest = d;
  }
  return latest?.payMode === "monthly";
};

// --- Lista ------------------------------------------------------------------------

export type WalletSource = {
  deliveries: readonly CourierDelivery[];
  handovers: readonly WalletHandover[];
  payouts: readonly WalletPayout[];
};

// Stavke računa u periodu, najnovije prvo.
//   cash: dostave sa naplaćenom gotovinom + predaje gotovine
//   wage: sve dostave (i plaćene karticom - imaju zaradu) + isplate zarade
// Dostava bez vremena ne može da se svrsta u dan, pa je nema u listi.
export const walletItems = (
  account: WalletAccount,
  source: WalletSource,
  period: WalletPeriod,
  now: number
): WalletItem[] => {
  const start = walletPeriodStartMs(period, now);
  const out: WalletItem[] = [];

  for (const delivery of source.deliveries) {
    if (delivery.ts == null || delivery.ts < start) continue;
    if (account === "cash" && delivery.collected == null) continue;
    out.push({ kind: "delivery", key: `d${delivery.id}`, ts: delivery.ts, delivery });
  }

  if (account === "cash") {
    for (const handover of source.handovers) {
      const ts = handoverTs(handover);
      if (ts >= start) out.push({ kind: "handover", key: `h${handover.id}`, ts, handover });
    }
  } else {
    for (const payout of source.payouts) {
      if (payout.ts >= start) out.push({ kind: "payout", key: `p${payout.id}`, ts: payout.ts, payout });
    }
  }

  // Isto vrijeme (npr. predaja i dostava u istoj minuti): stabilan redoslijed po ključu.
  return out.sort((a, b) => b.ts - a.ts || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
};

export const applyFilter = (items: readonly WalletItem[], filter: WalletFilter | null): WalletItem[] => {
  if (filter === "delivery") return items.filter((item) => item.kind === "delivery");
  if (filter === "settle") return items.filter((item) => item.kind !== "delivery");
  return [...items];
};

// --- Zbirovi ------------------------------------------------------------------------

export type CashSummary = {
  deliveries: number;
  // Šta je kurir naplatio od kupaca (hrana + dostava) - NIJE isto što je ušlo u dug.
  collected: number;
  // Zbir "cash_effect" (koliko je ušlo u dug) kad ga backend šalje za SVE dostave perioda;
  // inače null i ekran piše "naplaćeno".
  effect: number | null;
  // Potvrđene predaje: koliko je dug smanjen i koliko ih je.
  handed: number;
  handovers: number;
  // Predaje koje čekaju potvrdu (ne ulaze u "predato").
  waiting: number;
};

export type WageSummary = {
  deliveries: number;
  // Zarada samo onih dostava za koje je poznata (mjesečne i bez obračuna nisu u zbiru).
  earned: number;
  earnedRows: number;
  monthlyRows: number;
  paid: number;
  payouts: number;
};

export const summarizeCash = (items: readonly WalletItem[]): CashSummary => {
  const out: CashSummary = { deliveries: 0, collected: 0, effect: 0, handed: 0, handovers: 0, waiting: 0 };
  let effectKnown = true;
  for (const item of items) {
    if (item.kind === "delivery") {
      out.deliveries += 1;
      out.collected += item.delivery.collected ?? 0;
      const effect = item.delivery.earnings?.cashEffect;
      if (effect == null) effectKnown = false;
      else out.effect = (out.effect ?? 0) + effect;
    } else if (item.kind === "handover") {
      if (item.handover.pending) out.waiting += 1;
      else {
        out.handed += item.handover.confirmed ?? 0;
        out.handovers += 1;
      }
    }
  }
  out.collected = r2(out.collected);
  out.handed = r2(out.handed);
  out.effect = effectKnown && out.deliveries > 0 ? r2(out.effect ?? 0) : null;
  return out;
};

export const summarizeWage = (items: readonly WalletItem[]): WageSummary => {
  const out: WageSummary = { deliveries: 0, earned: 0, earnedRows: 0, monthlyRows: 0, paid: 0, payouts: 0 };
  for (const item of items) {
    if (item.kind === "delivery") {
      out.deliveries += 1;
      if (item.delivery.wage != null) {
        out.earned += item.delivery.wage;
        out.earnedRows += 1;
      } else if (item.delivery.payMode === "monthly") out.monthlyRows += 1;
    } else if (item.kind === "payout") {
      out.paid += item.payout.amount;
      out.payouts += 1;
    }
  }
  out.earned = r2(out.earned);
  out.paid = r2(out.paid);
  return out;
};

// --- Dani -----------------------------------------------------------------------------

// Zaglavlje dana: broj dostava (u gotovini i koliko je naplaćeno, u zaradi i koliko je
// zarađeno), a dan bez dostava samo broji stavke.
const groupMeta = (items: readonly WalletItem[], account: WalletAccount): string => {
  const deliveries = items.filter((item) => item.kind === "delivery");
  if (deliveries.length === 0) return itemsLabel(items.length);
  let meta = deliveriesLabel(deliveries.length);
  if (account === "cash") {
    const collected = deliveries.reduce(
      (sum, item) => sum + (item.kind === "delivery" ? (item.delivery.collected ?? 0) : 0),
      0
    );
    meta += ` · ${kmText(collected)} KM`;
  } else {
    const rows = deliveries.filter((item) => item.kind === "delivery" && item.delivery.wage != null);
    if (rows.length > 0) {
      const earned = rows.reduce((sum, item) => sum + (item.kind === "delivery" ? (item.delivery.wage ?? 0) : 0), 0);
      meta += ` · +${kmText(earned)} KM`;
    }
  }
  return meta;
};

// Stavke grupisane po LOKALNOM danu, redoslijed kao u `items` (najnovije prvo).
export const groupWalletByDay = (
  items: readonly WalletItem[],
  account: WalletAccount,
  now: number
): WalletDayGroup[] => {
  const groups = new Map<string, WalletItem[]>();
  for (const item of items) {
    const key = toLocalDayKey(new Date(item.ts));
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].map(([key, list]) => ({
    key,
    label: dayLabelOf(list[0]!.ts, now),
    items: list,
    meta: groupMeta(list, account),
  }));
};

// Prvih `limit` stavki; ostatak otvara dugme "Prikaži starije" (30 dana može imati stotine
// redova, a svaki je nekoliko desetina DOM čvorova).
export const takeItems = (
  items: readonly WalletItem[],
  limit: number
): { shown: WalletItem[]; rest: number } => ({
  shown: items.slice(0, limit),
  rest: Math.max(0, items.length - limit),
});

// --- Prijava predaje ------------------------------------------------------------------

// "95,24" i "95.24" su isto; najviše dvije decimale, bez slova i razmaka unutar broja.
export const parseAmount = (text: string): number | null => {
  const t = String(text).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^(\d{1,7}(\.\d{0,2})?|\.\d{1,2})$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export type ReportCheck = {
  // Ispravan iznos (> 0) ili null.
  amount: number | null;
  // Iznos je veći od duga: meko upozorenje, ne zabrana (da li backend to dopušta pita N7).
  over: boolean;
  // Šta ostaje u dugu poslije potvrde (null dok iznos nije ispravan).
  rest: number | null;
};

export const checkReport = (text: string, cash: number): ReportCheck => {
  const parsed = parseAmount(text);
  if (parsed == null || parsed <= 0) return { amount: null, over: false, rest: null };
  return { amount: parsed, over: parsed > cash + 0.004, rest: r2(cash - parsed) };
};

// Koliko gotovine kurir može da preda: samo pozitivan dug (negativan saldo je kreditiran).
export const reportableCash = (cashOwed: number): number => Math.max(0, r2(cashOwed));

// "Isplata kuriru (gotovina)" je tekst koji backend sam upiše; način isplate je u zagradi.
// Svaka druga napomena (dispečer je upisao svoju) ostaje kakva jeste.
export const payoutMethodOf = (note: string | null): string | null => {
  if (!note) return null;
  const match = /^Isplata kuriru \((.+)\)$/.exec(note.trim());
  return match?.[1]?.trim() || note.trim();
};
