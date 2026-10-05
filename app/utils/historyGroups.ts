import type { CourierDelivery } from "~/types/courier-delivery";
import { MONTHS_SHORT_SR, periodStart, pluralizeSr, toLocalDayKey } from "~/utils/datetime";
import { searchNeedle } from "~/utils/searchFold";

// Čista logika ekrana Istorija dostava (bez Vue-a, da se može provjeriti u običnom
// Node-u): periodi, stubići grafikona, zbirovi, trend, pretraga, sortiranje i
// grupisanje po danima. Sve vrijeme je u ms (lokalno tumačenje), a `now` se uvijek
// prosljeđuje - ništa ovdje ne čita sat samo.

export type HistoryPeriod = "today" | "week" | "month" | "all";
export type HistorySort = "new" | "old" | "top";

// Isti periodi kao u Novčaniku (Danas / Sedmica / 30 dana) plus "Sve". `query` je
// vrijednost u adresi (?p=).
export const HISTORY_PERIODS: { value: HistoryPeriod; label: string; query: string }[] = [
  { value: "today", label: "Danas", query: "danas" },
  { value: "week", label: "Sedmica", query: "sedmica" },
  { value: "month", label: "30 dana", query: "30dana" },
  { value: "all", label: "Sve", query: "sve" },
];
export const DEFAULT_PERIOD: HistoryPeriod = "week";

export const HISTORY_SORTS: { value: HistorySort; label: string; query: string }[] = [
  { value: "new", label: "Najnovije prvo", query: "nove" },
  { value: "old", label: "Najstarije prvo", query: "stare" },
  { value: "top", label: "Najveća zarada prvo", query: "zarada" },
];

export const periodFromQuery = (raw: unknown): HistoryPeriod =>
  HISTORY_PERIODS.find((p) => p.query === raw)?.value ?? DEFAULT_PERIOD;

export const sortFromQuery = (raw: unknown): HistorySort =>
  HISTORY_SORTS.find((s) => s.query === raw)?.value ?? "new";

// Najviše mjeseci u grafikonu "Sve" - kod duge istorije stubići bi postali pretanki.
const MAX_MONTH_BUCKETS = 24;

const WEEKDAYS_SHORT = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
const WEEKDAYS_LONG = [
  "Nedjelja",
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
];

const pad = (n: number) => String(n).padStart(2, "0");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

// Lokalna ponoć dana `ms`, pomjerena za `offsetDays` - preko Date-a, da prelazak
// na ljetno vrijeme ne pomjeri sat.
const dayStart = (ms: number, offsetDays = 0): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays).getTime();
};
const dayKeyOf = (ms: number) => toLocalDayKey(new Date(ms));

// --- Oblikovanje --------------------------------------------------------------

export const money = (value: number | null | undefined): string => Number(value ?? 0).toFixed(2);

export const deliveriesLabel = (n: number): string =>
  `${n} ${pluralizeSr(n, "dostava", "dostave", "dostava")}`;

export const daysLabel = (n: number): string => `${n} ${pluralizeSr(n, "dan", "dana", "dana")}`;

export const clockOf = (ms: number): string => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "28. sep"; za drugu godinu i sa godinom ("28. sep 2025.").
export const shortDateOf = (ms: number, now: number): string => {
  const d = new Date(ms);
  const base = `${d.getDate()}. ${MONTHS_SHORT_SR[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? base : `${base} ${d.getFullYear()}.`;
};

export const weekdayOf = (ms: number): string => WEEKDAYS_SHORT[new Date(ms).getDay()] ?? "";

// "Danas" / "Juče" / "Pon, 28. sep" - dan sedmice pomaže kuriru da se snađe.
export const dayLabelOf = (ms: number, now: number): string => {
  const diff = Math.round((dayStart(now) - dayStart(ms)) / 86_400_000);
  if (diff === 0) return "Danas";
  if (diff === 1) return "Juče";
  return `${cap(weekdayOf(ms))}, ${shortDateOf(ms, now)}`;
};

// "Ponedjeljak, 28. sep · 15:14"
export const whenOf = (ms: number, now: number): string =>
  `${WEEKDAYS_LONG[new Date(ms).getDay()] ?? ""}, ${shortDateOf(ms, now)} · ${clockOf(ms)}`;

// --- Periodi ------------------------------------------------------------------

export const periodStartMs = (period: HistoryPeriod, now: number): number =>
  period === "all" ? Number.NEGATIVE_INFINITY : periodStart(period, new Date(now)).getTime();

// Dostave u periodu. Gornje granice nema namjerno: sat telefona koji kasni nekoliko
// minuta za serverom ne smije da sakrije dostavu koja je upravo završena. Dostava
// bez vremena pripada samo periodu "Sve".
export const periodRows = (
  all: readonly CourierDelivery[],
  period: HistoryPeriod,
  now: number
): CourierDelivery[] => {
  const start = periodStartMs(period, now);
  return all.filter((d) => (d.ts == null ? period === "all" : d.ts >= start));
};

// Koji period je prvi širi (za "Prikaži sve" kad je izabrani period prazan).
export const widerPeriod = (period: HistoryPeriod): HistoryPeriod | null =>
  ({ today: "week", week: "month", month: "all", all: null })[period] as HistoryPeriod | null;

export const periodRangeLabel = (
  period: HistoryPeriod,
  summary: HistorySummary,
  now: number
): string => {
  if (period === "today") return `${weekdayOf(now)}, ${shortDateOf(now, now)}`;
  if (period === "all") return summary.first != null ? `od ${shortDateOf(summary.first, now)}` : "";
  return `${shortDateOf(periodStartMs(period, now), now)} – ${shortDateOf(now, now)}`;
};

// --- Zbirovi ------------------------------------------------------------------

export type HistorySummary = {
  count: number;
  // Zbir zarade samo onih dostava za koje je zarada poznata.
  wage: number;
  wageRows: number;
  // Dostave koje firma obračunava mjesečno (nema zarade po dostavi).
  monthlyRows: number;
  // Dostave bez ikakvog obračuna (red nije stigao iz /earnings).
  missingRows: number;
  average: number | null;
  activeDays: number;
  perDay: number;
  best: { ts: number; count: number; wage: number } | null;
  first: number | null;
  last: number | null;
};

export const summarize = (rows: readonly CourierDelivery[]): HistorySummary => {
  let wage = 0;
  let wageRows = 0;
  let monthlyRows = 0;
  let missingRows = 0;
  let first: number | null = null;
  let last: number | null = null;
  const days = new Map<string, { ts: number; count: number; wage: number }>();

  for (const d of rows) {
    if (d.wage != null) {
      wage += d.wage;
      wageRows += 1;
    } else if (d.payMode === "monthly") monthlyRows += 1;
    else missingRows += 1;

    if (d.ts == null) continue;
    const key = dayKeyOf(d.ts);
    const day = days.get(key) ?? { ts: d.ts, count: 0, wage: 0 };
    day.count += 1;
    day.wage += d.wage ?? 0;
    days.set(key, day);
    if (first == null || d.ts < first) first = d.ts;
    if (last == null || d.ts > last) last = d.ts;
  }

  // Najbolji dan: po zaradi, a bez novca po broju dostava; izjednačeno - noviji.
  let best: { ts: number; count: number; wage: number } | null = null;
  for (const day of days.values()) {
    if (!best) best = day;
    else {
      const order =
        (wageRows > 0 ? cmp(day.wage, best.wage) : 0) ||
        cmp(day.count, best.count) ||
        cmp(day.ts, best.ts);
      if (order > 0) best = day;
    }
  }

  const count = rows.length;
  return {
    count,
    wage,
    wageRows,
    monthlyRows,
    missingRows,
    average: wageRows > 0 ? wage / wageRows : null,
    activeDays: days.size,
    perDay: days.size > 0 ? count / days.size : 0,
    best,
    first,
    last,
  };
};

// Šta sažetak pokazuje kao glavni broj: zaradu, broj dostava (mjesečna plata) ili
// ništa (zarada ne stiže).
export type MoneyMode = "wage" | "monthly" | "none";

export const moneyModeOf = (s: HistorySummary): MoneyMode =>
  s.wageRows > 0 ? "wage" : s.monthlyRows > 0 ? "monthly" : "none";

// Kilometri samo kad ih backend šalje za SVE dostave u periodu - zbir za dio dostava
// bi bio pogrešan broj.
export const totalKm = (rows: readonly CourierDelivery[]): number | null => {
  if (rows.length === 0) return null;
  let sum = 0;
  for (const d of rows) {
    const km = d.order?.distanceKm;
    if (km == null || km < 0) return null;
    sum += km;
  }
  return sum;
};

export type WeekTrend = { current: number; previous: number; delta: number };

// Poređenje sa ISTOM tačkom prošle sedmice (od ponedjeljka do istog dana i sata),
// a ne sa cijelom prošlom sedmicom - u srijedu poređenje sa punom sedmicom uvijek
// izgleda kao pad. Bez trenda kad prošle sedmice nema dostava ili kad za neku od
// dostava u poređenju zarada nije poznata.
export const weekTrend = (all: readonly CourierDelivery[], now: number): WeekTrend | null => {
  const start = periodStartMs("week", now);
  const previousStart = dayStart(start, -7);
  const sameMoment = new Date(now);
  sameMoment.setDate(sameMoment.getDate() - 7);
  const previousEnd = sameMoment.getTime();

  const current = all.filter((d) => d.ts != null && d.ts >= start);
  const previous = all.filter((d) => d.ts != null && d.ts >= previousStart && d.ts <= previousEnd);
  if (previous.length === 0) return null;
  if (![...current, ...previous].every((d) => d.wage != null)) return null;

  const sum = (rows: CourierDelivery[]) => rows.reduce((acc, d) => acc + (d.wage ?? 0), 0);
  const cur = sum(current);
  const prev = sum(previous);
  return { current: cur, previous: prev, delta: cur - prev };
};

// --- Stubići grafikona --------------------------------------------------------

export type HistoryBucket = {
  // Dan ("2026-09-28") za sedmicu i 30 dana (prvi dan stubića), mjesec ("2026-09") za "Sve".
  key: string;
  label: string; // ispod stubića
  long: string; // u opisu i čitaču ekrana
  from: number; // [from, to)
  to: number;
  count: number;
  wage: number;
  future: boolean;
  current: boolean;
};

const tally = (rows: readonly CourierDelivery[], from: number, to: number) => {
  let count = 0;
  let wage = 0;
  for (const d of rows) {
    if (d.ts != null && d.ts >= from && d.ts < to) {
      count += 1;
      wage += d.wage ?? 0;
    }
  }
  return { count, wage };
};

// Sedmica -> 7 dana, 30 dana -> sedmice (od ponedjeljka, prva može biti kraća),
// Sve -> mjeseci. "Danas" nema grafikon.
export const makeBuckets = (
  rows: readonly CourierDelivery[],
  period: HistoryPeriod,
  now: number
): HistoryBucket[] => {
  const out: HistoryBucket[] = [];

  if (period === "week") {
    const start = periodStartMs("week", now);
    for (let i = 0; i < 7; i++) {
      const from = dayStart(start, i);
      const to = dayStart(start, i + 1);
      const wd = weekdayOf(from);
      out.push({
        key: dayKeyOf(from),
        label: wd,
        long: `${wd} ${shortDateOf(from, now)}`,
        from,
        to,
        ...tally(rows, from, to),
        future: from > now,
        current: now >= from && now < to,
      });
    }
  } else if (period === "month") {
    const start = periodStartMs("month", now);
    let week = dayStart(start, -((new Date(start).getDay() + 6) % 7));
    while (week <= now) {
      const from = Math.max(week, start);
      const to = dayStart(week, 7);
      const lastDay = Math.min(dayStart(to, -1), now);
      out.push({
        key: dayKeyOf(from),
        label: shortDateOf(from, now),
        long: `${shortDateOf(from, now)} – ${shortDateOf(lastDay, now)}`,
        from,
        to,
        ...tally(rows, from, to),
        future: false,
        current: now >= week && now < to,
      });
      week = to;
    }
  } else if (period === "all") {
    let first: number | null = null;
    for (const d of rows) if (d.ts != null && (first == null || d.ts < first)) first = d.ts;
    if (first != null) {
      const f = new Date(first);
      let from = new Date(f.getFullYear(), f.getMonth(), 1).getTime();
      while (from <= now) {
        const m = new Date(from);
        const to = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
        out.push({
          key: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`,
          label: MONTHS_SHORT_SR[m.getMonth()] ?? "",
          long: `${MONTHS_SHORT_SR[m.getMonth()]} ${m.getFullYear()}.`,
          from,
          to,
          ...tally(rows, from, to),
          future: false,
          current: now >= from && now < to,
        });
        from = to;
      }
    }
    return out.slice(-MAX_MONTH_BUCKETS);
  }

  return out;
};

// --- Lista --------------------------------------------------------------------

// Izabrani stubić i pretraga se kombinuju (oboje sužava listu).
export const filterRows = (
  rows: readonly CourierDelivery[],
  bucket: HistoryBucket | null,
  text: string
): CourierDelivery[] => {
  let out = rows.slice();
  if (bucket) out = out.filter((d) => d.ts != null && d.ts >= bucket.from && d.ts < bucket.to);
  const needle = searchNeedle(text);
  if (needle) out = out.filter((d) => d.search.includes(needle));
  return out;
};

// Dostava bez vremena je uvijek na kraju, bez obzira na smjer sortiranja.
const tsDesc = (a: CourierDelivery, b: CourierDelivery): number =>
  a.ts == null ? (b.ts == null ? 0 : 1) : b.ts == null ? -1 : cmp(b.ts, a.ts);
const tsAsc = (a: CourierDelivery, b: CourierDelivery): number =>
  a.ts == null ? (b.ts == null ? 0 : 1) : b.ts == null ? -1 : cmp(a.ts, b.ts);

export const sortRows = (rows: readonly CourierDelivery[], sort: HistorySort): CourierDelivery[] => {
  const out = rows.slice();
  if (sort === "old") out.sort((a, b) => tsAsc(a, b) || a.id - b.id);
  else if (sort === "top")
    out.sort((a, b) => cmp(b.wage ?? 0, a.wage ?? 0) || tsDesc(a, b) || b.id - a.id);
  else out.sort((a, b) => tsDesc(a, b) || b.id - a.id);
  return out;
};

export type DayGroup = {
  key: string;
  label: string;
  ts: number | null;
  rows: CourierDelivery[];
  wage: number;
  wageRows: number;
};

export const groupByDay = (rows: readonly CourierDelivery[], now: number): DayGroup[] => {
  const groups = new Map<string, DayGroup>();
  for (const d of rows) {
    const key = d.ts == null ? "nodate" : dayKeyOf(d.ts);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: d.ts == null ? "Bez datuma" : dayLabelOf(d.ts, now),
        ts: d.ts,
        rows: [],
        wage: 0,
        wageRows: 0,
      };
      groups.set(key, group);
    }
    group.rows.push(d);
    if (d.wage != null) {
      group.wage += d.wage;
      group.wageRows += 1;
    }
  }
  return [...groups.values()];
};

// Postepeno iscrtavanje: čitavi dani dok se ne skupi `limit` redova (prvi dan se
// uvijek prikaže cio). Ostatak se javlja brojevima za dugme "Prikaži starije".
export const takeGroups = (groups: readonly DayGroup[], limit: number) => {
  const shown: DayGroup[] = [];
  let rows = 0;
  let restGroups = 0;
  let restRows = 0;
  for (const group of groups) {
    if (rows >= limit && shown.length > 0) {
      restGroups += 1;
      restRows += group.rows.length;
      continue;
    }
    shown.push(group);
    rows += group.rows.length;
  }
  return { shown, restGroups, restRows };
};

// --- Ćelije sažetka -----------------------------------------------------------

export type SummaryCell = { label: string; value: string; unit?: string };

// Tri male ćelije ispod glavnog broja; šta je u njima zavisi od perioda i od toga
// ima li zarade.
export const summaryCells = (
  s: HistorySummary,
  period: HistoryPeriod,
  mode: MoneyMode,
  now: number
): SummaryCell[] => {
  const dash = (label: string): SummaryCell => ({ label, value: "—" });
  const count: SummaryCell = { label: "dostava", value: String(s.count) };
  const average: SummaryCell =
    s.average != null ? { label: "prosjek", value: money(s.average), unit: "KM" } : dash("prosjek");
  const perDay: SummaryCell =
    s.perDay > 0
      ? { label: "po danu", value: s.perDay.toFixed(1), unit: "dostava" }
      : dash("po danu");
  const best: SummaryCell = s.best
    ? {
        label: "najbolji dan",
        value: cap(weekdayOf(s.best.ts)),
        unit: mode === "wage" ? money(s.best.wage) : String(s.best.count),
      }
    : dash("najbolji dan");
  const lastAt: SummaryCell =
    s.last != null ? { label: "zadnja", value: clockOf(s.last) } : dash("zadnja");
  const firstAt: SummaryCell =
    s.first != null ? { label: "prva", value: clockOf(s.first) } : dash("prva");
  const activeDays: SummaryCell = { label: "aktivnih dana", value: String(s.activeDays) };
  const firstDelivery: SummaryCell =
    s.first != null
      ? { label: "prva dostava", value: shortDateOf(s.first, now) }
      : dash("prva dostava");

  if (mode === "wage") {
    if (period === "today") return [count, average, lastAt];
    if (period === "week") return [count, average, best];
    if (period === "month") return [count, average, activeDays];
    return [count, average, firstDelivery];
  }
  if (period === "today") return [count, firstAt, lastAt];
  if (period === "week") return [perDay, best, lastAt];
  return [perDay, best, activeDays];
};
