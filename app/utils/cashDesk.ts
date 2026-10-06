import type { CompanyCourier } from "~/types/company-courier";
import type { CashHandoverHistoryItem, PendingCashHandover } from "~/types/cash-handover";
import type { CourierBalance } from "~/types/courier-balance";
import type { CompanyPayout } from "~/types/payout";
import { summarizeCashLimit, type CashLimitState } from "~/utils/cashLimit";
import { PAY_TYPES, cashLevel, matchCourier, paySuffix, type CashLevel } from "~/utils/courierRoster";
import { relativeTime } from "~/utils/courierStatus";
import { toAmount } from "~/utils/currency";
import { pluralizeSr } from "~/utils/datetime";
import { foldForSearch, searchNeedle } from "~/utils/searchFold";
import { toLatin } from "~/utils/toLatin";

// Čista logika stranice Finansije (bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u):
// knjiga kurira sa novcem (couriers-balance + couriers-status + cash-handovers/pending), brojevi za
// pločice, filteri, pretraga, redoslijed, provjere unosa, plan isplate svima, promet (predaje +
// isplate), zbirovi i CSV. Pretpostavke o backendu su označene sa [PRETPOSTAVKA].
// Gotovina i zarada su dva odvojena računa i nigdje se ne sabiraju.

// --- Brojevi i novac ------------------------------------------------------------------------

export const r2 = (value: number): number => Math.round(value * 100) / 100;

export const money = (value: number, currency = "KM"): string => `${Number(value).toFixed(2)} ${currency}`;
export const absMoney = (value: number, currency = "KM"): string => money(Math.abs(value), currency);
export const signed = (value: number, currency = "KM"): string =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)} ${currency}`;

export const plural = pluralizeSr;
export const couriersText = (n: number): string => `${n} ${pluralizeSr(n, "kurir", "kurira", "kurira")}`;
export const handoversText = (n: number): string => `${n} ${pluralizeSr(n, "predaja", "predaje", "predaja")}`;

// Ime bez ćirilice i bez dijakritika, kao u pretrazi Kuriri.
export const fold = (value: string): string => foldForSearch(toLatin(value));

export const initials = (name: string): string => {
  const parts = toLatin(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
};

// --- Vrijeme (lokalni getteri, kao ostatak aplikacije) --------------------------------------

const p2 = (n: number) => String(n).padStart(2, "0");
export const ms = (value: number | string): number => (typeof value === "number" ? value : Date.parse(value));

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
const WEEKDAYS = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];

export const dayKey = (value: number | string): string => {
  const d = new Date(ms(value));
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
export const hm = (value: number | string): string => {
  const d = new Date(ms(value));
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const dateShort = (value: number | string): string => {
  const d = new Date(ms(value));
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};
export const dateTimeShort = (value: number | string): string => `${dateShort(value)} ${hm(value)}`;
// "2026-10-06" -> "6. okt" (bez računanja sa vremenskom zonom).
export const dayKeyShort = (key: string): string => {
  const [, m, d] = key.split("-").map(Number);
  return `${d}. ${MONTHS[(m ?? 1) - 1]}`;
};

export const addDaysKey = (key: string, n: number): string => {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
};

export const dayLabel = (key: string, now: number): string => {
  const today = dayKey(now);
  if (key === today) return "Danas";
  if (key === addDaysKey(today, -1)) return "Juče";
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d}. ${MONTHS[m - 1]}`;
};

export const ageText = (iso: string | number, now: number): string =>
  relativeTime(typeof iso === "number" ? new Date(iso).toISOString() : iso, now);

export const DAY_MS = 24 * 3600_000;
// [PRETPOSTAVKA] predaja je dnevni ciklus: starija od 24 h kasni (nije potvrđeno šta pokreće
// daily_handover_time, dokument od 05.10., stavka 23). Granica je ova jedna konstanta.
export const overdue = (iso: string | number, now: number): boolean => now - ms(iso) > DAY_MS;

// --- Limit -----------------------------------------------------------------------------------

export type Meter = { state: CashLimitState; percent: number; pctRaw: number };

// Mjerač: isto pravilo kao Novčanik (utils/cashLimit); procenat iznad 100 se piše, a traka staje na 100.
export const meterOf = (owed: number, limit: number): Meter => {
  const s = summarizeCashLimit(owed, limit);
  const counted = Math.max(0, owed);
  const ratio = limit === 0 ? (counted > 0 ? 1 : 0) : counted / limit;
  return { state: s.state, percent: s.percent, pctRaw: Math.round(ratio * 100) };
};

// Ko se pojavljuje u listu uplate i isplate (CashSheet): red Kuriri (RosterCourier) i red knjige Finansija (CashRow).
export type CashParty = {
  id: number;
  name: string;
  cash: number | null;
  wage: number | null;
  // Žiro račun i IBAN za bankovni transfer (prazno = nije upisano).
  bank?: string;
  iban?: string;
};

// --- Knjiga ----------------------------------------------------------------------------------

export type PendingItem = { id: number; amount: number; at: string };

export type CashRow = {
  id: number;
  name: string;
  initials: string;
  phone: string | null;
  // Polja koja traži matchCourier (isto pretraživanje kao Kuriri).
  first: string;
  last: string;
  email: null;
  cash: number;
  wage: number;
  level: CashLevel;
  pct: number | null;
  pctRaw: number | null;
  pending: PendingItem[];
  pendingSum: number;
  pendingAt: string | null;
  suspended: boolean;
  reason: string | null;
  inFirm: boolean;
  bank: string;
  iban: string;
  pay: string;
  zero: boolean;
};

export const payText = (c: CompanyCourier, currency: string): string => {
  const type = c.paying_type;
  if (!type) return "";
  const amount = toAmount(c.paying);
  return `${PAY_TYPES[type].label}${amount != null ? ` · ${amount.toFixed(2)} ${paySuffix(type, currency)}` : ""}`;
};

export type BookSources = {
  balances: CourierBalance[];
  couriers: CompanyCourier[];
  pending: PendingCashHandover[];
  // null = firma nije postavila limit; 0 je stroga vrijednost.
  limit: number | null;
  currency?: string;
  // false = couriers-status nije stigao: ne tvrdi se ko je u firmi (inače bi svi bili "Nije u firmi").
  couriersKnown?: boolean;
};

// Redovi su svi iz couriers-balance, spojeni po courier_id sa couriers-status (ime, telefon, računi,
// ugovor, suspenzija) i cash-handovers/pending. Predaja kurira kojeg nema u balansu se ne gubi.
export const buildBook = ({ balances, couriers, pending, limit, currency = "KM", couriersKnown = true }: BookSources): CashRow[] => {
  const byId = new Map(couriers.map((c) => [c.courier_id, c]));
  const pend = new Map<number, PendingItem[]>();
  for (const p of pending) {
    const amount = toAmount(p.reported_amount);
    if (amount == null) continue;
    const list = pend.get(p.courier_id) ?? [];
    list.push({ id: p.id, amount, at: p.reported_at });
    pend.set(p.courier_id, list);
  }
  for (const list of pend.values()) list.sort((a, b) => ms(a.at) - ms(b.at));

  const make = (id: number, bal: CourierBalance | null): CashRow => {
    const c = byId.get(id);
    const cash = toAmount(bal?.cash_owed_to_company) ?? 0;
    const wage = toAmount(bal?.wage_owed_to_courier) ?? 0;
    const name = toLatin(c?.name || bal?.name || `Kurir #${id}`);
    const p = pend.get(id) ?? [];
    const level = cashLevel(cash, limit);
    const meter = limit == null || !(cash > 0) ? null : meterOf(cash, limit);
    return {
      id,
      name,
      initials: initials(name),
      phone: c?.phone || bal?.phone || null,
      first: name,
      last: "",
      email: null,
      cash,
      wage,
      level,
      pct: meter ? meter.percent : null,
      pctRaw: meter ? meter.pctRaw : null,
      pending: p,
      pendingSum: r2(p.reduce((s, x) => s + x.amount, 0)),
      pendingAt: p[0]?.at ?? null,
      suspended: Boolean(c?.suspended),
      reason: c?.suspended_reason ?? null,
      inFirm: couriersKnown ? Boolean(c) : true,
      bank: c?.bank_account ?? "",
      iban: c?.detail?.iban ?? "",
      pay: c ? payText(c, currency) : "",
      zero: cash === 0 && wage === 0 && p.length === 0,
    };
  };

  const seen = new Set<number>();
  const rows: CashRow[] = [];
  for (const b of balances) {
    seen.add(b.courier_id);
    rows.push(make(b.courier_id, b));
  }
  for (const id of pend.keys()) if (!seen.has(id)) rows.push(make(id, null));
  return rows;
};

export type CashCounts = {
  all: number;
  pending: number;
  debt: number;
  limit: number;
  wage: number;
  zero: number;
  over: number;
  near: number;
  sumCash: number;
  sumWage: number;
  credit: number;
  pendingN: number;
  pendingSum: number;
  oldestAt: string | null;
  oldestOverdue: boolean;
};

// Brojevi za pločice i filtere: uvijek iz cijele knjige, ne iz filtriranog dijela.
export const counts = (book: CashRow[], now: number): CashCounts => {
  const o: CashCounts = {
    all: 0, pending: 0, debt: 0, limit: 0, wage: 0, zero: 0, over: 0, near: 0, sumCash: 0, sumWage: 0,
    credit: 0, pendingN: 0, pendingSum: 0, oldestAt: null, oldestOverdue: false,
  };
  for (const r of book) {
    if (r.zero) {
      o.zero++;
      continue;
    }
    o.all++;
    if (r.pending.length) {
      o.pending++;
      o.pendingN += r.pending.length;
      o.pendingSum = r2(o.pendingSum + r.pendingSum);
      if (r.pendingAt && (!o.oldestAt || ms(r.pendingAt) < ms(o.oldestAt))) o.oldestAt = r.pendingAt;
    }
    if (r.cash > 0) {
      o.debt++;
      o.sumCash = r2(o.sumCash + r.cash);
    }
    if (r.cash < 0) o.credit = r2(o.credit + -r.cash);
    if (r.level === "near") o.near++;
    if (r.level === "over") o.over++;
    if (r.level === "near" || r.level === "over") o.limit++;
    if (r.wage > 0) {
      o.wage++;
      o.sumWage = r2(o.sumWage + r.wage);
    }
  }
  o.oldestOverdue = o.oldestAt ? overdue(o.oldestAt, now) : false;
  return o;
};

export type CashFilter = "all" | "pending" | "debt" | "limit" | "wage" | "zero";

export const FILTER_ORDER: CashFilter[] = ["all", "pending", "debt", "limit", "wage", "zero"];
export const FILTER_LABELS: Record<CashFilter, string> = {
  all: "Svi",
  pending: "Čeka potvrdu",
  debt: "Duguju",
  limit: "Limit",
  wage: "Za isplatu",
  zero: "Nulti",
};

export const FILTERS: Record<CashFilter, (r: CashRow) => boolean> = {
  all: () => true,
  pending: (r) => r.pending.length > 0,
  debt: (r) => r.cash > 0,
  limit: (r) => r.level === "near" || r.level === "over",
  wage: (r) => r.wage > 0,
  zero: (r) => r.zero,
};

// "Svi" skriva nulte redove (šum), ali pretraga ih pokazuje: ko traži kurira, treba ga naći bez
// obzira na saldo.
export const filterBook = (book: CashRow[], { q = "", filter = "all" }: { q?: string; filter?: CashFilter } = {}): CashRow[] => {
  const f = FILTERS[filter] ?? FILTERS.all;
  const hasQ = Boolean(searchNeedle(q));
  return book.filter((r) => {
    if (filter === "all") {
      if (r.zero && !hasQ) return false;
    } else if (!f(r)) return false;
    return !hasQ || matchCourier(r, q);
  });
};

export type CashSort = "debt" | "wage" | "age" | "name";
export const SORTS: Record<CashSort, string> = {
  debt: "Najviše duguje",
  wage: "Najviše zarade",
  age: "Najstarija predaja",
  name: "Ime A–Z",
};

const byName = (a: CashRow, b: CashRow) => fold(a.name).localeCompare(fold(b.name), "sr");

export const sortBook = (book: CashRow[], mode: CashSort = "debt"): CashRow[] => {
  const a = book.slice();
  if (mode === "name") return a.sort(byName);
  if (mode === "wage") return a.sort((x, y) => y.wage - x.wage || y.cash - x.cash || byName(x, y));
  if (mode === "age") {
    const at = (r: CashRow) => (r.pendingAt ? ms(r.pendingAt) : Infinity);
    return a.sort((x, y) => (at(x) === at(y) ? 0 : at(x) < at(y) ? -1 : 1) || y.cash - x.cash || byName(x, y));
  }
  return a.sort((x, y) => y.cash - x.cash || y.wage - x.wage || byName(x, y));
};

export const parseFilter = (value: string | null | undefined): CashFilter =>
  value && (FILTER_ORDER as string[]).includes(value) ? (value as CashFilter) : "all";
export const parseSort = (value: string | null | undefined): CashSort =>
  value && value in SORTS ? (value as CashSort) : "debt";

// --- Provjere unosa --------------------------------------------------------------------------

export type CheckMsg = { tone: "ok" | "warn"; text: string };

const twoDecimals = (amount: number) => Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6;

export type ConfirmCheck = {
  valid: boolean;
  amount: number;
  diff: number;
  after: number | null;
  msgs: CheckMsg[];
  hint: string;
};

// Potvrda predaje: iznos koji je dispečer stvarno primio. Razlika naspram prijave i dug poslije
// potvrde vide se prije slanja.
export const confirmCheck = (o: { text: string; reported: number; owed: number | null; currency?: string }): ConfirmCheck => {
  const currency = o.currency ?? "KM";
  const amount = toAmount(o.text);
  const msgs: CheckMsg[] = [];
  if (amount == null || !(amount > 0)) return { valid: false, amount: 0, diff: 0, after: null, msgs, hint: "Upiši iznos veći od 0." };
  if (!twoDecimals(amount)) return { valid: false, amount, diff: 0, after: null, msgs, hint: "Najviše dvije decimale." };
  const diff = r2(amount - o.reported);
  if (diff === 0) msgs.push({ tone: "ok", text: "Isto kao prijava." });
  else {
    msgs.push({
      tone: "warn",
      text: `Razlika od prijave: ${signed(diff, currency)}. Sistem sam upiše napomenu o razlici; možeš dodati svoju.`,
    });
  }
  if (o.owed != null && o.owed >= 0 && amount > o.owed + 0.001) {
    msgs.push({
      tone: "warn",
      text: `Veće je od duga (${money(o.owed, currency)}) za ${money(r2(amount - o.owed), currency)}. Sistem dopušta, ali provjeri.`,
    });
  }
  const after = o.owed == null ? null : r2(o.owed - amount);
  return { valid: true, amount, diff, after, msgs, hint: "" };
};

// --- Isplata svima ---------------------------------------------------------------------------

export type PlanItem = { id: number; name: string; amount: number; bank: string; suspended: boolean; inFirm: boolean };

export const payoutPlan = (book: CashRow[]): { items: PlanItem[]; total: number } => {
  const items = sortBook(book.filter((r) => r.wage > 0), "name").map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.wage,
    bank: r.bank || r.iban || "",
    suspended: r.suspended,
    inFirm: r.inFirm,
  }));
  return { items, total: r2(items.reduce((s, i) => s + i.amount, 0)) };
};

export type BatchResult = { ok: boolean; message?: string; warning?: string };
export type BatchUpdate = { state: "run" } | { state: "ok"; warning?: string } | { state: "err"; message?: string };

// Pokreće `run(item)` za svaki red, najviše `concurrency` istovremeno. run vraća { ok, message?,
// warning? }; izuzetak je neuspjeh. Pad jednog ne zaustavlja ostale. [PRETPOSTAVKA] 3 istovremeno
// (ograničenje brzine nije potvrđeno, B8): ako smeta, ovo je jedina konstanta.
export const BATCH_CONCURRENCY = 3;

export const runBatch = async <T extends { id: number }>(
  items: T[],
  run: (item: T) => Promise<BatchResult>,
  { concurrency = BATCH_CONCURRENCY, onUpdate = () => {} }: { concurrency?: number; onUpdate?: (id: number, update: BatchUpdate) => void } = {}
): Promise<Record<number, BatchResult>> => {
  const results: Record<number, BatchResult> = {};
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      onUpdate(item.id, { state: "run" });
      let res: BatchResult;
      try {
        res = await run(item);
      } catch (error) {
        res = { ok: false, message: (error as Error | undefined)?.message || "Server ne odgovara." };
      }
      results[item.id] = res;
      onUpdate(item.id, res.ok ? { state: "ok", warning: res.warning } : { state: "err", message: res.message });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
};

export const batchSummary = (results: Record<number, BatchResult>) => {
  const v = Object.values(results);
  return {
    ok: v.filter((r) => r.ok).length,
    failed: v.filter((r) => !r.ok).length,
    warnings: v.filter((r) => r.ok && r.warning).length,
  };
};

// --- Promet (cash-handovers + payouts) ---------------------------------------------------------

export type JournalPeriod = "today" | "7d" | "month" | "prev" | "custom";
export const PERIODS: Record<JournalPeriod, string> = {
  today: "Danas",
  "7d": "7 dana",
  month: "Ovaj mjesec",
  prev: "Prošli mjesec",
  custom: "Od–do",
};
export const parsePeriod = (value: string | null | undefined): JournalPeriod =>
  value && value in PERIODS ? (value as JournalPeriod) : "7d";

export const periodRange = (preset: JournalPeriod, now: number): { from: string; to: string } => {
  const today = dayKey(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === "prev") {
    const last = addDaysKey(`${today.slice(0, 8)}01`, -1);
    return { from: `${last.slice(0, 8)}01`, to: last };
  }
  return { from: addDaysKey(today, -6), to: today };
};

// Datum "YYYY-MM-DD" koji je stvarno upisan (ne dopuštamo smeće u adresi).
export const validDay = (value: string | null | undefined): string => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");

export type PayMethod = "gotovina" | "bankovni transfer";
// [PRETPOSTAVKA, B2] način isplate se čita iz teksta napomene koji backend sam dopisuje.
export const methodOf = (note: string | null | undefined): PayMethod | null => {
  const m = /\((gotovina|bankovni transfer)\)/i.exec(String(note ?? ""));
  return m ? (m[1]?.toLowerCase() as PayMethod) : null;
};
export const METHOD_LABELS: Record<PayMethod, string> = { gotovina: "Gotovina", "bankovni transfer": "Bankovni transfer" };

export type JournalRow = {
  key: string;
  kind: "handover" | "payout";
  id: number;
  courierId: number;
  name: string;
  status: "pending" | "confirmed" | "paid";
  reported: number | null;
  confirmed: number | null;
  diff: number;
  amount: number;
  at: string;
  reportedAt: string | null;
  confirmedAt: string | null;
  by: string | null;
  note: string | null;
  method: PayMethod | null;
  ref: string;
};

export const buildJournal = ({
  handovers,
  payouts,
  nameOf,
}: {
  handovers: CashHandoverHistoryItem[];
  payouts: CompanyPayout[];
  nameOf: (courierId: number) => string;
}): JournalRow[] => {
  const rows: JournalRow[] = [];
  for (const h of handovers) {
    const reported = toAmount(h.reported_amount);
    const confirmed = toAmount(h.confirmed_amount);
    const done = h.status === "confirmed";
    if (reported == null) continue;
    rows.push({
      key: `h${h.id}`,
      kind: "handover",
      id: h.id,
      courierId: h.courier_id,
      name: toLatin(nameOf(h.courier_id)),
      status: done ? "confirmed" : "pending",
      reported,
      confirmed: done ? confirmed : null,
      diff: done && confirmed != null ? r2(confirmed - reported) : 0,
      amount: done && confirmed != null ? confirmed : reported,
      at: done && h.confirmed_at ? h.confirmed_at : h.reported_at,
      reportedAt: h.reported_at,
      confirmedAt: h.confirmed_at || null,
      by: h.confirmed_by_name ? toLatin(h.confirmed_by_name) : null,
      note: h.note || null,
      method: null,
      ref: `Predaja #${h.id}`,
    });
  }
  for (const p of payouts) {
    const amount = toAmount(p.amount);
    if (amount == null) continue;
    rows.push({
      key: `p${p.id}`,
      kind: "payout",
      id: p.id,
      courierId: p.courier_id,
      name: toLatin(nameOf(p.courier_id)),
      status: "paid",
      reported: null,
      confirmed: null,
      diff: 0,
      amount,
      at: p.created_at,
      reportedAt: null,
      confirmedAt: null,
      by: null,
      note: p.note || null,
      method: methodOf(p.note),
      ref: p.transaction_id ? `Isplata ${p.transaction_id}` : `Isplata #${p.id}`,
    });
  }
  return rows.sort((a, b) => ms(b.at) - ms(a.at) || (a.key < b.key ? 1 : -1));
};

export type JournalType = "all" | "handover" | "payout";
export const parseJournalType = (value: string | null | undefined): JournalType =>
  value === "handover" || value === "payout" ? value : "all";

export const isDiffRow = (r: JournalRow): boolean => r.kind === "handover" && r.status === "confirmed" && r.diff !== 0;

export const filterJournal = (
  rows: JournalRow[],
  { type = "all", courier = null, diffOnly = false }: { type?: JournalType; courier?: number | null; diffOnly?: boolean } = {}
): JournalRow[] =>
  rows.filter((r) => {
    if (type !== "all" && r.kind !== type) return false;
    if (courier != null && r.courierId !== courier) return false;
    if (diffOnly && !isDiffRow(r)) return false;
    return true;
  });

export type JournalTotals = {
  inN: number;
  inSum: number;
  outN: number;
  outSum: number;
  diffN: number;
  diffSum: number;
  pendingN: number;
  pendingSum: number;
};

export const journalTotals = (rows: JournalRow[]): JournalTotals => {
  const o: JournalTotals = { inN: 0, inSum: 0, outN: 0, outSum: 0, diffN: 0, diffSum: 0, pendingN: 0, pendingSum: 0 };
  for (const r of rows) {
    if (r.kind === "payout") {
      o.outN++;
      o.outSum = r2(o.outSum + r.amount);
    } else if (r.status === "confirmed") {
      o.inN++;
      o.inSum = r2(o.inSum + r.amount);
      if (r.diff !== 0) {
        o.diffN++;
        o.diffSum = r2(o.diffSum + r.diff);
      }
    } else {
      o.pendingN++;
      o.pendingSum = r2(o.pendingSum + r.amount);
    }
  }
  return o;
};

export type DayGroup = { key: string; label: string; rows: JournalRow[]; inSum: number; outSum: number };

export const groupDays = (rows: JournalRow[], now: number): DayGroup[] => {
  const out: DayGroup[] = [];
  for (const r of rows) {
    const k = dayKey(r.at);
    let g = out[out.length - 1];
    if (!g || g.key !== k) {
      g = { key: k, label: dayLabel(k, now), rows: [], inSum: 0, outSum: 0 };
      out.push(g);
    }
    g.rows.push(r);
    if (r.kind === "payout") g.outSum = r2(g.outSum + r.amount);
    else if (r.status === "confirmed") g.inSum = r2(g.inSum + r.amount);
  }
  return out;
};

// CSV za lokalni Excel: ";" kao razdvajač, zarez kao decimalni znak; BOM dodaje onaj ko pravi
// datoteku. Tekst koji počinje sa = + - @ dobija ' ispred (CSV injekcija iz napomene).
export const csvText = (value: unknown): string => {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvNum = (value: number | null): string => (value == null ? "" : Number(value).toFixed(2).replace(".", ","));

export const CSV_HEAD = [
  "Datum", "Vrijeme", "Vrsta", "Kurir", "ID kurira", "Prijavljeno", "Potvrđeno ili isplaćeno", "Razlika",
  "Status", "Potvrdio", "Način isplate", "Napomena", "Referenca",
];

export const toCsv = (rows: JournalRow[]): string => {
  const lines = [CSV_HEAD.join(";")];
  for (const r of rows) {
    const d = new Date(ms(r.at));
    const date = `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}.`;
    lines.push(
      [
        date,
        hm(r.at),
        r.kind === "payout" ? "Isplata zarade" : "Predaja gotovine",
        csvText(r.name),
        r.courierId,
        csvNum(r.reported),
        csvNum(r.kind === "payout" ? r.amount : r.confirmed),
        r.kind === "handover" && r.status === "confirmed" ? csvNum(r.diff) : "",
        r.kind === "payout" ? "Isplaćeno" : r.status === "confirmed" ? "Potvrđeno" : "Na čekanju",
        csvText(r.by || ""),
        csvText(r.method || ""),
        csvText(r.note || ""),
        csvText(r.ref),
      ].join(";")
    );
  }
  return lines.join("\r\n");
};

export const csvName = (now: number): string => `finansije-${dayKey(now)}.csv`;
