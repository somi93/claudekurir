import type { ShiftTemplate } from "~/types/shiftTemplate";

// Čista logika stranice "Raspored i zone": datumi, vrijeme u danu, statusi smjena, sedmica i filteri,
// "Sljedeći problem", nova smjena (dani × zone), kopiranje, "Sada" i procjena provjere dostupnosti.
// Bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u (docs/2026/10/raspored-prototip/app-logic-test.mjs).
// Pretpostavke o backendu (značenje current_bookings, pravilo preskakanja pri kopiranju) su označene
// sa [PRETPOSTAVKA] i u ekranu se pišu kao "procjena".

export type ShiftStatus = "understaffed" | "below_target" | "target_reached" | "full";
export type ShiftPhase = "past" | "live" | "upcoming";

// Smjena u obliku koji logika koristi (isti podaci kao ShiftTemplate, kraća imena).
export type SchedShift = {
  id: number;
  zoneId: number;
  date: string;
  start: string;
  end: string;
  min: number;
  target: number;
  max: number | null;
  booked: number;
  hot: boolean;
};

export type DecoratedShift = SchedShift & { status: ShiftStatus; phase: ShiftPhase; match: boolean };

export type Clock = { date: string; min: number };

export type NamedZone = { id: number; name: string };

export const fromTemplate = (t: ShiftTemplate): SchedShift => ({
  id: t.id,
  zoneId: t.zone.id,
  date: t.date,
  start: t.startTime.slice(0, 5),
  end: t.endTime.slice(0, 5),
  min: t.minCouriers,
  target: t.targetCouriers,
  max: t.maxCouriers,
  booked: t.currentBookings,
  hot: t.highDemand,
});

/* ---------- datumi ---------- */
const pad = (n: number): string => String(n).padStart(2, "0");
export const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s: string): Date => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
};
export const mondayOf = (d: Date): Date => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const w = r.getDay();
  r.setDate(r.getDate() + (w === 0 ? -6 : 1 - w));
  return r;
};
export const wdIndex = (d: Date): number => (d.getDay() === 0 ? 6 : d.getDay() - 1);
export const weekIsos = (mon: Date): string[] => Array.from({ length: 7 }, (_, i) => iso(addDays(mon, i)));
export const diffDays = (a: string, b: string): number =>
  Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);

export const WD_SHORT = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
export const WD_LONG = ["ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota", "nedjelja"];
export const MONTH = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "juni",
  "juli",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
];

// "5–11. oktobar 2026." ili "28. septembar – 4. oktobar 2026."
export const weekLabel = (mon: Date): string => {
  const e = addDays(mon, 6);
  if (mon.getMonth() === e.getMonth()) {
    return `${mon.getDate()}–${e.getDate()}. ${MONTH[e.getMonth()]} ${e.getFullYear()}.`;
  }
  return `${mon.getDate()}. ${MONTH[mon.getMonth()]} – ${e.getDate()}. ${MONTH[e.getMonth()]} ${e.getFullYear()}.`;
};
export const dayLong = (isoDate: string): string => {
  const d = parseIso(isoDate);
  return `${WD_LONG[wdIndex(d)]} ${d.getDate()}. ${MONTH[d.getMonth()]}`;
};
export const cap1 = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const plural = (n: number, one: string, few: string, many: string): string => {
  const m100 = n % 100;
  const m10 = n % 10;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/* ---------- vrijeme u danu ---------- */
// "11:30" -> 690; neispravno -> null. Prihvata i "9", "930", "0930", "17.30", "17,30".
export const parseTime = (raw: unknown): number | null => {
  const t = String(raw == null ? "" : raw)
    .trim()
    .replace(/[.,]/, ":");
  let h: number;
  let m: number;
  if (/^\d{1,2}:\d{1,2}$/.test(t)) {
    const [a, b] = t.split(":").map(Number);
    h = a ?? 0;
    m = b ?? 0;
  } else if (/^\d{1,2}$/.test(t)) {
    h = Number(t);
    m = 0;
  } else if (/^\d{3,4}$/.test(t)) {
    h = Number(t.slice(0, -2));
    m = Number(t.slice(-2));
  } else return null;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
};
export const fmtTime = (min: number): string => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const mm = (hhmm: string): number => parseTime(hhmm) ?? 0;
// "11:00" -> "11", "11:30" -> "11:30" (kratak oblik za pločicu)
export const short = (hhmm: string): string => {
  const [h, m] = String(hhmm).split(":");
  return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
};
export const fmtWin = (a: string, b: string): string => `${short(a)}–${short(b)}`;
export const fmtWinFull = (a: string, b: string): string => `${a}–${b}`;
export const stepTime = (str: string, delta: number): string | null => {
  const v = parseTime(str);
  if (v == null) return null;
  return fmtTime(Math.min(23 * 60 + 59, Math.max(0, v + delta)));
};

/* ---------- statusi ---------- */
export const STATUS: Record<ShiftStatus, { key: ShiftStatus; label: string; rank: number; tone: "bad" | "warn" | "ok" | "blue" }> = {
  understaffed: { key: "understaffed", label: "Ispod minimuma", rank: 0, tone: "bad" },
  below_target: { key: "below_target", label: "Ispod cilja", rank: 1, tone: "warn" },
  target_reached: { key: "target_reached", label: "Cilj dostignut", rank: 2, tone: "ok" },
  full: { key: "full", label: "Popunjeno", rank: 3, tone: "blue" },
};
// Ista formula kao deriveStatus u services/shiftTemplatesService.ts.
export const statusOf = (min: number, target: number, max: number | null, booked: number): ShiftStatus => {
  if (booked < min) return "understaffed";
  if (booked < target) return "below_target";
  if (max != null && booked >= max) return "full";
  return "target_reached";
};

// Boja mjerača i ivice pločice po statusu (tekst uz njih nosi isti podatak).
export const STATUS_COLOR: Record<ShiftStatus, string> = {
  understaffed: "#e5484d",
  below_target: "#e08a14",
  target_reached: "#1f9d6b",
  full: "#2f6fed",
};

export const nowOf = (date: Date): Clock => ({ date: iso(date), min: date.getHours() * 60 + date.getMinutes() });
// Smjena je završena kad je prošao njen kraj; tada status više nije radnja nego istorija.
export const phase = (s: Pick<SchedShift, "date" | "start" | "end">, now: Clock): ShiftPhase => {
  if (s.date < now.date) return "past";
  if (s.date > now.date) return "upcoming";
  if (mm(s.end) <= now.min) return "past";
  if (mm(s.start) <= now.min) return "live";
  return "upcoming";
};
export const decorate = (s: SchedShift, now: Clock): DecoratedShift => ({
  ...s,
  status: statusOf(s.min, s.target, s.max, s.booked),
  phase: phase(s, now),
  match: true,
});

// "Fale još 2 kurira do minimuma"
export const need = (s: Pick<SchedShift, "min" | "target" | "max" | "booked">): string => {
  if (s.booked < s.min) {
    const d = s.min - s.booked;
    return `Fale još ${d} ${plural(d, "kurir", "kurira", "kurira")} do minimuma`;
  }
  if (s.booked < s.target) {
    const d = s.target - s.booked;
    return `Fale još ${d} ${plural(d, "kurir", "kurira", "kurira")} do cilja`;
  }
  if (s.max != null && s.booked >= s.max) return "Popunjeno do maksimuma";
  return "Cilj dostignut";
};
// Koliko kurira treba da bi se stiglo do cilja (za poruku).
export const missing = (s: Pick<SchedShift, "target" | "booked">): number => Math.max(0, s.target - s.booked);

/* ---------- pretraga ---------- */
export const fold = (v: unknown): string =>
  String(v == null ? "" : v)
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/* ---------- sedmica ---------- */
const byStart = (a: SchedShift, b: SchedShift): number =>
  mm(a.start) - mm(b.start) || mm(a.end) - mm(b.end) || a.id - b.id;
export type ShiftFilter = "all" | ShiftStatus;
export const FILTERS: ShiftFilter[] = ["all", "understaffed", "below_target", "target_reached", "full"];

export type WeekCounts = Record<ShiftFilter | "past", number>;
export type DayTotals = {
  date: string;
  slots: number;
  target: number;
  booked: number;
  under: number;
  below: number;
  past: boolean;
  today: boolean;
};
export type WeekRow = {
  zone: NamedZone;
  cells: { date: string; shifts: DecoratedShift[] }[];
  empty: boolean;
};
export type WeekModel = {
  rows: WeekRow[];
  days: DayTotals[];
  counts: WeekCounts;
  total: number;
  shifts: DecoratedShift[];
};

// zones: zone grada; dates: 7 iso datuma. Redovi su SVE zone grada (ne samo one sa smjenom): prazna zona se može planirati.
export const weekModel = (args: {
  shifts: SchedShift[];
  zones: NamedZone[];
  dates: string[];
  now: Clock;
  zoneId?: number | null;
  filter?: ShiftFilter;
}): WeekModel => {
  const { shifts, zones, dates, now, zoneId = null, filter = "all" } = args;
  const inWeek = shifts
    .filter((s) => dates.includes(s.date) && (!zoneId || s.zoneId === zoneId))
    .map((s) => decorate(s, now));
  const matches = (s: DecoratedShift) => filter === "all" || (s.phase !== "past" && s.status === filter);
  inWeek.forEach((s) => {
    s.match = matches(s);
  });
  const counts: WeekCounts = { all: 0, understaffed: 0, below_target: 0, target_reached: 0, full: 0, past: 0 };
  inWeek.forEach((s) => {
    if (s.phase === "past") {
      counts.past++;
      return;
    }
    counts.all++;
    counts[s.status]++;
  });
  const days: DayTotals[] = dates.map((date) => {
    const list = inWeek.filter((s) => s.date === date);
    const active = list.filter((s) => s.phase !== "past");
    return {
      date,
      slots: list.length,
      target: list.reduce((a, s) => a + s.target, 0),
      booked: list.reduce((a, s) => a + s.booked, 0),
      under: active.filter((s) => s.status === "understaffed").length,
      below: active.filter((s) => s.status === "below_target").length,
      past: date < now.date,
      today: date === now.date,
    };
  });
  const zoneList = zones
    .filter((z) => !zoneId || z.id === zoneId)
    .slice()
    .sort((a, b) => fold(a.name).localeCompare(fold(b.name)));
  const rows: WeekRow[] = zoneList.map((z) => {
    const cells = dates.map((date) => ({
      date,
      shifts: inWeek.filter((s) => s.zoneId === z.id && s.date === date).sort(byStart),
    }));
    return { zone: z, cells, empty: cells.every((c) => c.shifts.length === 0) };
  });
  return { rows, days, counts, total: inWeek.length, shifts: inWeek };
};

// Smjene ispod minimuma koje još nisu završile, redom po vremenu: to su "problemi" (dugme "Sljedeći problem").
export const problemList = (model: { shifts: DecoratedShift[] }): DecoratedShift[] =>
  model.shifts
    .filter((s) => s.phase !== "past" && s.status === "understaffed")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : byStart(a, b)));
export const nextProblem = (model: { shifts: DecoratedShift[] }, currentId: number | null): DecoratedShift | null => {
  const list = problemList(model);
  if (!list.length) return null;
  const i = list.findIndex((s) => s.id === currentId);
  return list[(i + 1) % list.length] ?? null;
};

/* ---------- nove smjene ---------- */
export type ShiftWindow = { start: string; end: string; count: number; min: number; target: number; max: number | null };

// Prečice za trajanje: najčešće (od, do) iz smjena koje firma već ima, sa najčešćim kapacitetom.
export const presetWindows = (shifts: SchedShift[], n = 4): ShiftWindow[] => {
  const by = new Map<string, { start: string; end: string; count: number; caps: Map<string, number> }>();
  shifts.forEach((s) => {
    const k = `${s.start}|${s.end}`;
    const e = by.get(k) ?? { start: s.start, end: s.end, count: 0, caps: new Map<string, number>() };
    e.count++;
    const ck = `${s.min}|${s.target}|${s.max == null ? "" : s.max}`;
    e.caps.set(ck, (e.caps.get(ck) ?? 0) + 1);
    by.set(k, e);
  });
  return [...by.values()]
    .sort((a, b) => b.count - a.count || mm(a.start) - mm(b.start))
    .slice(0, n)
    .map((e) => {
      const best = [...e.caps.entries()].sort((a, b) => b[1] - a[1])[0];
      const [min, target, max] = (best ? best[0] : "1|1|").split("|");
      return {
        start: e.start,
        end: e.end,
        count: e.count,
        min: Number(min),
        target: Number(target),
        max: max === "" || max === undefined ? null : Number(max),
      };
    });
};

export type ShiftSpec = { zoneId: number; date: string; start: string; end: string };

export const overlapsOf = (spec: ShiftSpec, shifts: SchedShift[], ignoreId: number | null = null): SchedShift[] =>
  shifts.filter(
    (s) =>
      s.id !== ignoreId &&
      s.zoneId === spec.zoneId &&
      s.date === spec.date &&
      mm(s.start) < mm(spec.end) &&
      mm(spec.start) < mm(s.end)
  );

export type ShiftFormErrors = Partial<Record<"start" | "end" | "min" | "target" | "max", string>>;

export const validateShift = (v: {
  start: string;
  end: string;
  min: string | number;
  target: string | number;
  max: string | number | null;
}): ShiftFormErrors => {
  const e: ShiftFormErrors = {};
  const a = parseTime(v.start);
  const b = parseTime(v.end);
  if (a == null) e.start = "Vrijeme upiši kao 17:30.";
  if (b == null) e.end = "Vrijeme upiši kao 22:00.";
  if (a != null && b != null && b <= a) e.end = "Kraj mora biti poslije početka (smjena preko ponoći nije podržana).";
  const mi = Number(v.min);
  const ta = Number(v.target);
  if (!Number.isInteger(mi) || mi < 1) e.min = "Najmanje 1 kurir.";
  if (!Number.isInteger(ta) || ta < 1) e.target = "Cilj je najmanje 1 kurir.";
  else if (Number.isInteger(mi) && ta < mi) e.target = "Cilj ne može biti manji od minimuma.";
  if (v.max != null && v.max !== "") {
    const mx = Number(v.max);
    if (!Number.isInteger(mx) || mx < 1) e.max = "Unesi cijeli broj, najmanje 1.";
    else if (Number.isInteger(ta) && mx < ta) e.max = "Maksimum ne može biti manji od cilja.";
  }
  return e;
};

export const MAX_BATCH = 60;

export type PlanItem = {
  zoneId: number;
  date: string;
  start: string;
  end: string;
  min: number;
  target: number;
  max: number | null;
  hot: boolean;
  dup: boolean;
  overlap?: number[];
};

export type CreateSpec = {
  days: string[];
  zones: number[];
  start: string;
  end: string;
  min: number;
  target: number;
  max: number | string | null;
  hot: boolean;
};

export type CreatePlan = { items: PlanItem[]; create: PlanItem[]; dup: number; overlaps: number; tooMany: boolean };

// Svaka kombinacija dan × zona je jedan POST.
export const expandCreate = (spec: CreateSpec, existing: SchedShift[]): CreatePlan => {
  const items: PlanItem[] = [];
  spec.zones.forEach((zoneId) =>
    spec.days.forEach((date) => {
      const it: PlanItem = {
        zoneId,
        date,
        start: spec.start,
        end: spec.end,
        min: spec.min,
        target: spec.target,
        max: spec.max == null || spec.max === "" ? null : Number(spec.max),
        hot: !!spec.hot,
        dup: false,
      };
      it.dup = existing.some(
        (s) => s.zoneId === zoneId && s.date === date && s.start === spec.start && s.end === spec.end
      );
      it.overlap = it.dup ? [] : overlapsOf(it, existing).map((s) => s.id);
      items.push(it);
    })
  );
  const create = items.filter((i) => !i.dup);
  return {
    items,
    create,
    dup: items.length - create.length,
    overlaps: create.filter((i) => (i.overlap?.length ?? 0) > 0).length,
    tooMany: items.length > MAX_BATCH,
  };
};

/* ---------- kopiranje ---------- */
const asPlanItem = (s: SchedShift, date: string, dup: boolean): PlanItem => ({
  zoneId: s.zoneId,
  date,
  start: s.start,
  end: s.end,
  min: s.min,
  target: s.target,
  max: s.max,
  hot: s.hot,
  dup,
});

// [PRETPOSTAVKA] server preskače smjenu koja već postoji (ista zona, isti dan, isto vrijeme); pravilo nije dokumentovano.
export const copyWeekPlan = (args: {
  src: SchedShift[];
  tgt: SchedShift[];
  srcMon: Date;
  tgtMon: Date;
  zoneId?: number | null;
}): { items: PlanItem[]; create: PlanItem[]; dup: number; source: number } => {
  const { src, tgt, srcMon, tgtMon, zoneId = null } = args;
  const off = diffDays(iso(srcMon), iso(tgtMon));
  const srcDates = weekIsos(srcMon);
  const list = src.filter((s) => srcDates.includes(s.date) && (!zoneId || s.zoneId === zoneId));
  const out = list.map((s) => {
    const date = iso(addDays(parseIso(s.date), off));
    const dup = tgt.some((t) => t.zoneId === s.zoneId && t.date === date && t.start === s.start && t.end === s.end);
    return asPlanItem(s, date, dup);
  });
  return { items: out, create: out.filter((i) => !i.dup), dup: out.filter((i) => i.dup).length, source: list.length };
};

// Kopiranje jednog dana na druge dane: isti kapacitet, isto vrijeme.
export const copyDayPlan = (args: {
  src: SchedShift[];
  fromIso: string;
  toIsos: string[];
  zoneId?: number | null;
  existing: SchedShift[];
}): { items: PlanItem[]; create: PlanItem[]; dup: number; source: number; tooMany: boolean } => {
  const { src, fromIso, toIsos, zoneId = null, existing } = args;
  const list = src.filter((s) => s.date === fromIso && (!zoneId || s.zoneId === zoneId));
  const items: PlanItem[] = [];
  toIsos
    .filter((d) => d !== fromIso)
    .forEach((date) =>
      list.forEach((s) => {
        const dup = existing.some(
          (t) => t.zoneId === s.zoneId && t.date === date && t.start === s.start && t.end === s.end
        );
        items.push(asPlanItem(s, date, dup));
      })
    );
  const create = items.filter((i) => !i.dup);
  return { items, create, dup: items.length - create.length, source: list.length, tooMany: items.length > MAX_BATCH };
};

/* ---------- pokrivenost u toku dana ---------- */
// Rupe u jednoj zoni jednog dana: vrijeme između dvije smjene u kojem nema nijedne ("15–17").
export const gaps = (zoneDayShifts: Pick<SchedShift, "start" | "end">[]): { from: string; to: string; minutes: number }[] => {
  const list = zoneDayShifts.map((s): [number, number] => [mm(s.start), mm(s.end)]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let end: number | null = null;
  list.forEach(([a, b]) => {
    if (end != null && a > end) out.push([end, a]);
    end = end == null ? b : Math.max(end, b);
  });
  return out.map(([a, b]) => ({ from: fmtTime(a), to: fmtTime(b), minutes: b - a }));
};

/* ---------- "Sada" ---------- */
export type LiveCounts = { online: number; idle: number; delivering: number };

export type NowPlan = {
  today: DecoratedShift[];
  current: DecoratedShift[];
  next: DecoratedShift | null;
  worst: DecoratedShift | null;
  minutesLeft: number | null;
  minutesToNext: number | null;
};

export const nowPlan = (args: { shifts: SchedShift[]; zoneId: number; now: Clock }): NowPlan => {
  const { shifts, zoneId, now } = args;
  const today = shifts
    .filter((s) => s.zoneId === zoneId && s.date === now.date)
    .map((s) => decorate(s, now))
    .sort(byStart);
  const current = today.filter((s) => s.phase === "live");
  const next = today.find((s) => s.phase === "upcoming") ?? null;
  const worst = current.slice().sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank)[0] ?? null;
  const minutesLeft = current.length ? Math.min(...current.map((s) => mm(s.end) - now.min)) : null;
  const minutesToNext = next ? mm(next.start) - now.min : null;
  return { today, current, next, worst, minutesLeft, minutesToNext };
};
export const liveTotal = (l: LiveCounts | null | undefined): number => (l ? l.online + l.idle + l.delivering : 0);

export type ZoneNowCode = "empty" | "under" | "below" | "ok" | "next-under" | "next" | "none";
export type ZoneNow = { code: ZoneNowCode; tone: "bad" | "warn" | "ok" | "idle"; label: string; rank: number };

// Jedan znak po zoni; poredak kartica ide po `rank` (manji = hitnije). Ne poredi plan sa brojem na terenu osim u jednom slučaju:
// smjena traje, a u zoni nema nikoga (online + idle + delivering = 0). Značenje polja online/idle nije dokumentovano.
export const zoneNow = (plan: NowPlan, live: LiveCounts | null | undefined): ZoneNow => {
  if (plan.current.length) {
    if (liveTotal(live) === 0) return { code: "empty", tone: "bad", label: "Nikoga u zoni", rank: 0 };
    if (plan.worst?.status === "understaffed") return { code: "under", tone: "bad", label: "Ispod minimuma", rank: 1 };
    if (plan.worst?.status === "below_target") return { code: "below", tone: "warn", label: "Ispod cilja", rank: 3 };
    return { code: "ok", tone: "ok", label: "U redu", rank: 4 };
  }
  if (plan.next) {
    const d = decorate(plan.next, { date: plan.next.date, min: 0 });
    if (d.status === "understaffed") {
      return { code: "next-under", tone: "warn", label: "Sljedeća smjena je ispod minimuma", rank: 2 };
    }
    return { code: "next", tone: "idle", label: "Nema smjene sada", rank: 5 };
  }
  return { code: "none", tone: "idle", label: "Danas nema smjena", rank: 6 };
};
export const ago = (sec: number): string =>
  sec < 5 ? "upravo sada" : sec < 60 ? `prije ${Math.round(sec)} s` : `prije ${Math.floor(sec / 60)} min`;
export const inText = (min: number): string =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? " " + (min % 60) + " min" : ""}`;

/* ---------- provjera dostupnosti ---------- */
export type EnforceImpact = {
  inProgress: number;
  booked: number;
  zeroShifts: number;
  lines: { zone: string; win: string; booked: number; target: number }[];
  level: "none" | "zero" | "partial" | "ok";
};

// Procjena iz smjena koje sada traju: zbir `booked` (current_bookings). [PRETPOSTAVKA] server odlučuje po potvrđenim
// terminima kurira; tačan broj bi dao zaseban odgovor (pitanje B8). Zato se u ekranu piše "procjena".
export const enforceImpact = (args: { shifts: SchedShift[]; now: Clock; zones: NamedZone[] }): EnforceImpact => {
  const { shifts, now, zones } = args;
  const live = shifts.filter((s) => phase(s, now) === "live").map((s) => decorate(s, now));
  const booked = live.reduce((a, s) => a + s.booked, 0);
  const name = (id: number) => zones.find((z) => z.id === id)?.name ?? `Zona #${id}`;
  return {
    inProgress: live.length,
    booked,
    zeroShifts: live.filter((s) => s.booked === 0).length,
    lines: live.map((s) => ({ zone: name(s.zoneId), win: fmtWin(s.start, s.end), booked: s.booked, target: s.target })),
    level: live.length === 0 ? "none" : booked === 0 ? "zero" : live.some((s) => s.booked === 0) ? "partial" : "ok",
  };
};

/* ---------- poruka kuririma ---------- */
export type AskDraft = { category: "announcement"; title: string; body: string };

export const askDraft = (s: SchedShift, zoneName: string, now: Clock): AskDraft => {
  const n = Math.max(1, missing(s) || 1);
  const when = s.date === now.date ? "danas" : dayLong(s.date);
  return {
    category: "announcement",
    title: `Treba nam još kurira: ${zoneName}, ${when} ${fmtWin(s.start, s.end)}`,
    body: `U zoni ${zoneName}, ${when} od ${s.start} do ${s.end}, treba nam još ${n} ${plural(n, "kurir", "kurira", "kurira")}. Ko može da radi neka potvrdi termin u aplikaciji (Radno vrijeme) ili javi dispečeru.`,
  };
};
