import type {
  CompanyCourier,
  CourierCreatePayload,
  CourierPayingType,
  CourierUpdatePayload,
} from "~/types/company-courier";
import type { DispatcherCourierLocation, DispatcherCourierLocationPoint } from "~/types/courier";
import type { CourierBalance } from "~/types/courier-balance";
import type { InboxSummaryEntry } from "~/types/inbox";
import type { VehicleKey } from "~/types/vehicle";
import { summarizeCashLimit } from "~/utils/cashLimit";
import { courierState, relativeTime } from "~/utils/courierStatus";
import { toAmount } from "~/utils/currency";
import { pluralizeSr } from "~/utils/datetime";
import {
  DOB_MESSAGES,
  VEHICLE_CHOICES,
  ageText,
  digitsOnly,
  ibanClean,
  ibanState,
  isoLong,
  parseDob,
  phoneOk,
  type FieldMsg,
} from "~/utils/profileForm";
import { generateTemporaryPassword } from "~/utils/randomPassword";
import { foldForSearch, searchNeedle } from "~/utils/searchFold";
import { toLatin } from "~/utils/toLatin";

// Čista logika dispečerske liste kurira (bez DOM-a i bez Nuxta, pa se provjerava u običnom
// Node-u): spajanje izvora po courier_id, pretraga, filteri, redoslijed i - najvažnije - šta se
// šalje serveru (samo ono što je dispečer izmijenio).

// --- Red liste ------------------------------------------------------------------------------

export type RosterCourier = {
  id: number;
  // Ime i prezime kako stižu (bez ćirilice -> latinice), a `name` je za prikaz.
  first: string;
  last: string;
  name: string;
  phone: string | null;
  email: string | null;
  vehicle: VehicleKey | null;
  suspended: boolean;
  reason: string | null;
  suspendedAt: string | null;
  created: string;
  // Lični podaci (osoba) i ugovor (ova firma).
  dob: string;
  iban: string;
  ecName: string;
  ecPhone: string;
  payType: CourierPayingType | null;
  paying: string;
  bank: string;
  signed: string;
  from: string;
  note: string;
  // Stanje uživo (courier-locations): null = nema poznate pozicije.
  loc: DispatcherCourierLocationPoint | null;
  // Novac (couriers-balance): null = balansi se nisu učitali, pa se ne tvrdi ništa.
  cash: number | null;
  wage: number | null;
  // Poruke (inbox-summary).
  unread: number;
  lastMsg: { title: string; sentAt: string } | null;
};

const text = (value: unknown): string => String(value ?? "").trim();

const p2 = (n: number) => String(n).padStart(2, "0");

// Backend vraća dan kao "2026-09-14" ili kao puni ISO sa vremenom; u polje ide samo dan.
// Puni ISO se čita lokalnim getterima (kao u Profilu) da se izbjegne pomak dana.
export const isoDay = (value: unknown): string => {
  const s = text(value);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

// "14. mar 2026."
export const isoShort = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay(iso));
  return m ? `${Number(m[3])}. ${MONTHS_SHORT[Number(m[2]) - 1]} ${m[1]}.` : "";
};

const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
};

export type RosterSources = {
  locations?: DispatcherCourierLocation[] | null;
  balances?: CourierBalance[] | null;
  summary?: InboxSummaryEntry[] | null;
};

// Jedan red na ekranu: identitet iz couriers-status + stanje uživo + novac + poruke. Izvor koji
// nije stigao ne ruši listu: bez lokacije je "Bez signala", bez balansa nema oznaka duga, bez
// sažetka nema oznaka poruka.
export const buildRoster = (rows: CompanyCourier[], sources: RosterSources = {}): RosterCourier[] => {
  const loc = new Map((sources.locations ?? []).map((l) => [l.courier_id, l]));
  const bal = new Map((sources.balances ?? []).map((b) => [b.courier_id, b]));
  const sum = new Map((sources.summary ?? []).map((s) => [s.courierId, s]));
  const balancesKnown = sources.balances != null;

  return rows.map((row) => {
    const separate = row.first_name != null;
    const parsed = splitName(String(row.name ?? ""));
    const first = text(separate ? row.first_name : parsed.first);
    const last = text(separate ? row.last_name : parsed.last);
    const detail = row.detail ?? null;
    const balance = bal.get(row.courier_id);
    const summary = sum.get(row.courier_id);
    return {
      id: row.courier_id,
      first,
      last,
      name: toLatin(`${first} ${last}`.trim()),
      phone: text(row.phone) || null,
      email: text(row.email) || null,
      vehicle: row.vehicle?.type ?? null,
      suspended: Boolean(row.suspended),
      reason: text(row.suspended_reason) || null,
      suspendedAt: row.suspended_at ?? null,
      created: isoDay(row.created_at),
      dob: isoDay(detail?.date_of_birth),
      iban: ibanClean(detail?.iban),
      ecName: text(detail?.emergency_contact_name),
      ecPhone: text(detail?.emergency_contact_phone),
      payType: row.paying_type ?? null,
      paying: text(row.paying),
      bank: text(row.bank_account),
      signed: isoDay(row.contract_signed_at),
      from: isoDay(row.contract_active_from),
      note: text(row.note),
      loc: loc.get(row.courier_id)?.location ?? null,
      cash: balancesKnown ? (toAmount(balance?.cash_owed_to_company) ?? 0) : null,
      wage: balancesKnown ? (toAmount(balance?.wage_owed_to_courier) ?? 0) : null,
      unread: summary?.dispatcherUnreadCount ?? 0,
      lastMsg: summary?.lastMessage
        ? { title: summary.lastMessage.title, sentAt: summary.lastMessage.sentAt }
        : null,
    };
  });
};

export const displayName = (c: Pick<RosterCourier, "first" | "last">): string =>
  toLatin(`${text(c.first)} ${text(c.last)}`.trim());

// --- Vozilo ---------------------------------------------------------------------------------

export type VehicleView = { label: string; icon: string; ink: string; tint: string };

const UNKNOWN_VEHICLE: VehicleView = {
  label: "Nepoznato vozilo",
  icon: "mdi-help-circle-outline",
  ink: "#5b6676",
  tint: "#eceff3",
};

// Nepoznata vrijednost ne smije da obori listu (isti razlog kao courierVehicleMeta).
export const vehicleView = (vehicle: string | null | undefined): VehicleView => {
  const known = (VEHICLE_CHOICES as Record<string, VehicleView | undefined>)[vehicle ?? "foot"];
  return known ?? { ...UNKNOWN_VEHICLE, label: String(vehicle) };
};

// --- Stanje uživo ----------------------------------------------------------------------------

export type LiveKey = "delivering" | "online" | "offline" | "none";

export const LIVE_META: Record<
  LiveKey,
  { label: string; ink: string; tint: string; dot: string; rank: number }
> = {
  delivering: { label: "U dostavi", ink: "#2459c7", tint: "#eef4ff", dot: "#2f6fed", rank: 0 },
  online: { label: "Slobodan", ink: "#00734f", tint: "#e3f8ef", dot: "#00b37e", rank: 1 },
  offline: { label: "Offline", ink: "#5b6676", tint: "#eceff3", dot: "#9aa4b2", rank: 2 },
  none: { label: "Bez signala", ink: "#5b6676", tint: "#eceff3", dot: "#c7ccd6", rank: 3 },
};

// Isto pravilo kao Kuriri uživo (courierState): status sa servera je merodavan, starost zapisa
// samo kad status nije prepoznat. Kurir bez pozicije je "Bez signala".
export const liveOf = (c: RosterCourier, now: number): LiveKey => {
  if (!c.loc) return "none";
  return courierState(
    {
      courier_id: c.id,
      name: c.name,
      phone: c.phone,
      suspended: c.suspended,
      vehicle: null,
      location: c.loc,
    },
    now
  );
};

// Za filtere: "Offline" obuhvata i kurire bez ikakve pozicije.
export const liveGroup = (c: RosterCourier, now: number): "delivering" | "online" | "offline" => {
  const k = liveOf(c, now);
  return k === "none" ? "offline" : k;
};

export const seenText = (c: RosterCourier, now: number): string =>
  c.loc ? relativeTime(c.loc.updated_at, now) : "nema lokacije";

// Koliko sekundi je prošlo od zadnjeg signala (za redoslijed); bez signala = vrlo dugo.
const signalAge = (c: RosterCourier, now: number): number =>
  c.loc ? Math.max(0, (now - new Date(c.loc.updated_at).getTime()) / 1000) : 1e12;

// --- Novac ----------------------------------------------------------------------------------

export type CashLevel = "none" | "ok" | "near" | "over";

// Isto pravilo kao Novčanik i Finansije (utils/cashLimit): od 80% limita je "blizu", od 100% "preko".
export const cashLevel = (cash: number | null, limit: number | null): CashLevel => {
  if (cash == null || !(cash > 0)) return "none";
  if (limit == null) return "ok";
  return summarizeCashLimit(cash, limit).state;
};

// --- Poruke ---------------------------------------------------------------------------------

export const unreadText = (n: number): string =>
  `${n} ${pluralizeSr(n, "nepročitana", "nepročitane", "nepročitanih")}`;

export const couriersText = (n: number): string =>
  `${n} ${pluralizeSr(n, "kurir", "kurira", "kurira")}`;

// --- Pretraga -------------------------------------------------------------------------------

// "+387 65 123 456", "00387 65 123 456", "065/123-456" i "065123456" -> "65123456".
export const phoneKey = (raw: string | null | undefined): string => {
  const s = text(raw);
  let d = digitsOnly(s);
  if (!d) return "";
  const intl = s.startsWith("+") || d.startsWith("00");
  if (s.startsWith("+")) d = d.slice(3);
  else if (d.startsWith("00")) d = d.slice(5);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("0") && intl) d = d.slice(1);
  return d;
};

const PHONEISH = /^[\d\s+()/.-]+$/;

type SearchKey = { hay: string; pk: string; raw: string };
const keys = new WeakMap<object, SearchKey>();

const keyOf = (c: Pick<RosterCourier, "first" | "last" | "id" | "email" | "phone">): SearchKey => {
  let k = keys.get(c);
  if (!k) {
    k = {
      hay: `${foldForSearch(toLatin(`${c.first} ${c.last}`))} ${c.id} ${foldForSearch(c.email)}`,
      pk: phoneKey(c.phone),
      raw: digitsOnly(c.phone),
    };
    keys.set(c, k);
  }
  return k;
};

// Ime (sa i bez dijakritika, ćirilica, bilo koji redoslijed riječi), korisničko ime, #ID i
// telefon u bilo kom zapisu. Upit koji počinje sa 0 ili + je početak broja ("065..."), ostalo je
// dio broja ("65 123").
export const matchCourier = (
  c: Pick<RosterCourier, "first" | "last" | "id" | "email" | "phone">,
  query: string
): boolean => {
  const n = searchNeedle(query);
  if (!n) return true;
  const key = keyOf(c);
  if (PHONEISH.test(n) && digitsOnly(n).length >= 3) {
    const qd = digitsOnly(n);
    const qk = phoneKey(n);
    const anchored = n.startsWith("+") || qd.startsWith("0");
    return (
      String(c.id).includes(qd) ||
      (!!key.pk && !!qk && (anchored ? key.pk.startsWith(qk) : key.pk.includes(qk))) ||
      (!!key.raw && key.raw.includes(qd))
    );
  }
  return n
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => key.hay.includes(t));
};

// --- Telefon --------------------------------------------------------------------------------

const groupDigits = (d: string, sizes: number[]): string => {
  const out: string[] = [];
  let i = 0;
  for (const s of sizes) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + s));
    i += s;
  }
  while (i < d.length) {
    out.push(d.slice(i, i + 3));
    i += 3;
  }
  return out.join(" ");
};

// Jedan prikaz u listi i detalju: "065 123 456" ili "+387 65 123 456".
export const fmtPhone = (raw: string | null | undefined): string => {
  const s = text(raw);
  if (!s) return "";
  const d = digitsOnly(s);
  if (!d) return s;
  if (s.startsWith("+")) return `+${d.slice(0, 3)} ${groupDigits(d.slice(3), [2, 3, 3])}`.trim();
  if (d.startsWith("00")) return `+${d.slice(2, 5)} ${groupDigits(d.slice(5), [2, 3, 3])}`.trim();
  return groupDigits(d, [3, 3, 3]);
};

// tel: veza: samo cifre i "+".
export const telHref = (raw: string | null | undefined): string =>
  `tel:${text(raw).replace(/[^\d+]/g, "")}`;

export const emailOk = (value: string | null | undefined): boolean =>
  !value ? true : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Isti telefon ili email već ima drugi kurir (upozorenje, ne zabrana).
export const findDup = (
  roster: RosterCourier[],
  q: { phone?: string; email?: string; exceptId?: number }
): RosterCourier | null => {
  const pk = phoneKey(q.phone);
  const em = foldForSearch(q.email).trim();
  return (
    roster.find(
      (c) =>
        c.id !== q.exceptId &&
        ((pk && phoneKey(c.phone) === pk) || (em && foldForSearch(c.email) === em))
    ) ?? null
  );
};

// --- Filteri, brojevi, redoslijed ----------------------------------------------------------

export type RosterFlag = "suspended" | "noVehicle" | "debt" | "unread";
export type RosterLive = "all" | "delivering" | "online" | "offline";
export type RosterSort = "live" | "name" | "debt" | "created";

export const FLAGS: Record<RosterFlag, (c: RosterCourier) => boolean> = {
  suspended: (c) => c.suspended,
  noVehicle: (c) => !c.vehicle,
  debt: (c) => (c.cash ?? 0) > 0,
  unread: (c) => c.unread > 0,
};

export const FLAG_LABELS: Record<RosterFlag, string> = {
  suspended: "Suspendovani",
  noVehicle: "Bez vozila",
  debt: "Duguju gotovinu",
  unread: "Nepročitane poruke",
};

export const FLAG_ORDER: RosterFlag[] = ["suspended", "noVehicle", "debt", "unread"];

export const SORT_LABELS: Record<RosterSort, string> = {
  live: "Uživo prvo",
  name: "Ime A-Z",
  debt: "Najviše duguje",
  created: "Najnoviji nalog",
};

export const parseFlags = (raw: string | null | undefined): RosterFlag[] =>
  text(raw)
    .split(",")
    .filter((f): f is RosterFlag => f in FLAGS);

export const parseLive = (raw: string | null | undefined): RosterLive =>
  raw === "delivering" || raw === "online" || raw === "offline" ? raw : "all";

export const parseSort = (raw: string | null | undefined): RosterSort =>
  raw === "name" || raw === "debt" || raw === "created" ? raw : "live";

export type RosterCounts = Record<"all" | "delivering" | "online" | "offline", number> &
  Record<RosterFlag, number>;

// Brojevi se računaju iz cijele liste, ne iz filtriranog dijela: ostaju stabilni dok se filtrira.
export const rosterCounts = (roster: RosterCourier[], now: number): RosterCounts => {
  const o: RosterCounts = {
    all: roster.length,
    delivering: 0,
    online: 0,
    offline: 0,
    suspended: 0,
    noVehicle: 0,
    debt: 0,
    unread: 0,
  };
  for (const c of roster) {
    o[liveGroup(c, now)] += 1;
    for (const k of FLAG_ORDER) if (FLAGS[k](c)) o[k] += 1;
  }
  return o;
};

export const filterRoster = (
  roster: RosterCourier[],
  opts: { q?: string; live?: RosterLive; flags?: RosterFlag[] },
  now: number
): RosterCourier[] => {
  const { q = "", live = "all", flags = [] } = opts;
  return roster.filter((c) => {
    if (live !== "all" && liveGroup(c, now) !== live) return false;
    for (const f of flags) if (!FLAGS[f](c)) return false;
    return matchCourier(c, q);
  });
};

const nameKey = (c: RosterCourier) => foldForSearch(toLatin(`${c.first} ${c.last}`));
const byName = (a: RosterCourier, b: RosterCourier) => nameKey(a).localeCompare(nameKey(b), "sr");

export const sortRoster = (list: RosterCourier[], mode: RosterSort, now: number): RosterCourier[] => {
  const a = [...list];
  if (mode === "name") return a.sort(byName);
  if (mode === "debt") return a.sort((x, y) => (y.cash ?? 0) - (x.cash ?? 0) || byName(x, y));
  if (mode === "created") {
    return a.sort((x, y) => y.created.localeCompare(x.created) || byName(x, y));
  }
  // "Uživo prvo": u dostavi, slobodni, offline, bez signala; unutar grupe najsvježiji signal, pa ime.
  return a.sort(
    (x, y) =>
      LIVE_META[liveOf(x, now)].rank - LIVE_META[liveOf(y, now)].rank ||
      signalAge(x, now) - signalAge(y, now) ||
      byName(x, y)
  );
};

// --- Šta se šalje: samo ono što je izmijenjeno ---------------------------------------------

const same = (a: unknown, b: unknown): boolean => text(a) === text(b);
const nn = (v: unknown): string | null => text(v) || null;

export type ContactValues = {
  first: string;
  last: string;
  phone: string;
  ecName: string;
  ecPhone: string;
};

// Ime i prezime idu zajedno: backend inače nadopisuje sačuvano prezime (odgovor §1.1).
export const contactDiff = (saved: ContactValues, draft: ContactValues): CourierUpdatePayload => {
  const out: CourierUpdatePayload = {};
  if (!same(saved.first, draft.first) || !same(saved.last, draft.last)) {
    out.name = text(draft.first);
    out.lastname = text(draft.last);
  }
  if (!same(saved.phone, draft.phone)) out.phone = text(draft.phone);
  if (!same(saved.ecName, draft.ecName)) out.emergency_contact_name = nn(draft.ecName);
  if (!same(saved.ecPhone, draft.ecPhone)) out.emergency_contact_phone = nn(draft.ecPhone);
  return out;
};

export const vehicleDiff = (
  saved: { vehicle: VehicleKey | null },
  draft: { vehicle: VehicleKey | null }
): CourierUpdatePayload =>
  (saved.vehicle ?? null) !== (draft.vehicle ?? null) ? { vehicle_type: draft.vehicle ?? null } : {};

export type ContractValues = {
  payType: CourierPayingType | null;
  paying: string;
  bank: string;
  signed: string;
  from: string;
};

export const contractDiff = (saved: ContractValues, draft: ContractValues): CourierUpdatePayload => {
  const out: CourierUpdatePayload = {};
  if ((saved.payType ?? null) !== (draft.payType ?? null)) out.paying_type = draft.payType ?? null;
  if (!same(saved.paying, draft.paying)) out.paying = nn(draft.paying);
  if (!same(saved.bank, draft.bank)) out.bank_account = nn(draft.bank);
  if (!same(saved.signed, draft.signed)) out.contract_signed_at = draft.signed || null;
  if (!same(saved.from, draft.from)) out.contract_active_from = draft.from || null;
  return out;
};

export const personalDiff = (
  saved: { dob: string; iban: string },
  draft: { dob: string; iban: string }
): CourierUpdatePayload => {
  const out: CourierUpdatePayload = {};
  if (!same(saved.dob, draft.dob)) out.date_of_birth = draft.dob || null;
  if (!same(ibanClean(saved.iban), ibanClean(draft.iban))) out.iban = ibanClean(draft.iban) || null;
  return out;
};

export const noteDiff = (saved: { note: string }, draft: { note: string }): CourierUpdatePayload =>
  !same(saved.note, draft.note) ? { note: nn(draft.note) } : {};

// Ono što je dijalog "Izmeni kurira" slao DANAS za jednu izmjenu: svih 14 polja, uvijek. Služi samo
// za poređenje (broj polja u zahtjevu prije i poslije).
export const legacyEditPayload = (c: RosterCourier): CourierUpdatePayload => ({
  name: c.first,
  lastname: c.last,
  phone: c.phone ?? "",
  vehicle_type: c.vehicle,
  date_of_birth: c.dob || null,
  iban: nn(c.iban),
  emergency_contact_name: nn(c.ecName),
  emergency_contact_phone: nn(c.ecPhone),
  paying_type: c.payType,
  paying: nn(c.paying),
  bank_account: nn(c.bank),
  contract_signed_at: c.signed || null,
  contract_active_from: c.from || null,
  note: nn(c.note),
});

// --- Ugovor i isplata -----------------------------------------------------------------------

export const PAY_TYPES: Record<
  CourierPayingType,
  { label: string; short: string; hint: string; icon: string }
> = {
  1: { label: "Mjesečno", short: "mjesečno", hint: "Fiksna mjesečna plata.", icon: "mdi-calendar-outline" },
  2: { label: "Procenat", short: "procenat", hint: "Procenat od cijene dostave.", icon: "mdi-percent-outline" },
  3: { label: "Po dostavi", short: "po dostavi", hint: "Fiksni iznos za svaku dostavu.", icon: "mdi-moped-outline" },
};

// Sufiks iznosa: % za procenat, inače valuta firme.
export const paySuffix = (payType: CourierPayingType | null, currency: string): string =>
  payType === 2 ? "%" : currency;

export const payText = (c: Pick<RosterCourier, "payType" | "paying">, currency: string): string => {
  if (!c.payType) return "";
  const amount = toAmount(c.paying);
  return `${PAY_TYPES[c.payType].label}${amount != null ? ` · ${amount.toFixed(2)} ${paySuffix(c.payType, currency)}` : ""}`;
};

export const parseMoneyText = (value: string | null | undefined): number | null => toAmount(value);

// Maska iznosa: samo cifre, tačka i zarez.
export const maskAmount = (raw: string): string => raw.replace(/[^\d.,]/g, "");

// Datum ugovora (bilo koji dan od 2000. do iduće godine); datum rođenja ide kroz parseDob.
export type DayResult =
  | { ok: true; iso: string }
  | { ok: false; reason: "empty" | "incomplete" | "invalid" | "range" };

export const parseDay = (value: string, now: Date): DayResult => {
  const t = text(value);
  if (!t) return { ok: false, reason: "empty" };
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(t);
  if (!m) return { ok: false, reason: "incomplete" };
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return { ok: false, reason: "invalid" };
  }
  if (y < 2000 || y > now.getFullYear() + 1) return { ok: false, reason: "range" };
  return { ok: true, iso: `${y}-${p2(mo)}-${p2(d)}` };
};

export const DAY_MESSAGES = {
  incomplete: DOB_MESSAGES.incomplete,
  invalid: DOB_MESSAGES.invalid,
  range: "Provjeri godinu.",
} as const;

// --- Provjere po listu ---------------------------------------------------------------------

export type ShowFn = (key: string) => boolean;

export type RosterCheck<K extends string, P> = {
  fields: Partial<Record<K, FieldMsg>>;
  // Smije li se snimiti (neispravno polje blokira, upozorenje ne).
  valid: boolean;
  // Ima li izmjena u odnosu na sačuvano.
  dirty: boolean;
  payload: P;
  // Zašto dugme nije aktivno (kad se to ne vidi iz polja).
  hint?: string;
};

const dupText = (dup: RosterCourier, what: "phone" | "email") =>
  `${what === "phone" ? "Isti broj" : "Isti email"} ima ${displayName(dup)} (#${dup.id}).`;

export type ContactDraft = ContactValues;

export const contactValues = (c: RosterCourier): ContactValues => ({
  first: c.first,
  last: c.last,
  phone: c.phone ?? "",
  ecName: c.ecName,
  ecPhone: c.ecPhone,
});

export const checkContact = (
  draft: ContactDraft,
  saved: RosterCourier,
  roster: RosterCourier[],
  show: ShowFn
): RosterCheck<keyof ContactDraft, CourierUpdatePayload> => {
  const fields: RosterCheck<keyof ContactDraft, CourierUpdatePayload>["fields"] = {};
  let valid = true;
  const bad = (key: keyof ContactDraft, key2: string, message: string) => {
    if (show(key2)) fields[key] = { tone: "bad", text: message };
    valid = false;
  };
  if (!text(draft.first)) bad("first", "first", "Ime je obavezno.");
  if (!text(draft.last)) bad("last", "last", "Prezime je obavezno.");
  const phone = text(draft.phone);
  if (!phone) bad("phone", "phone", "Telefon je obavezan.");
  else if (!phoneOk(phone)) bad("phone", "phone", "Unesi ispravan broj telefona, npr. 065 123 456.");
  else {
    const dup = findDup(roster, { phone, exceptId: saved.id });
    if (dup) fields.phone = { tone: "warn", text: dupText(dup, "phone") };
  }
  if (text(draft.ecPhone) && !phoneOk(draft.ecPhone)) {
    bad("ecPhone", "ecPhone", "Unesi ispravan broj telefona.");
  }
  const payload = contactDiff(contactValues(saved), draft);
  return { fields, valid, dirty: Object.keys(payload).length > 0, payload };
};

export const checkVehicle = (
  draft: { vehicle: VehicleKey | null },
  saved: RosterCourier
): RosterCheck<never, CourierUpdatePayload> => {
  const payload = vehicleDiff(saved, draft);
  return { fields: {}, valid: true, dirty: Object.keys(payload).length > 0, payload };
};

export type ContractDraft = ContractValues;

export const contractValues = (c: RosterCourier): ContractValues => ({
  payType: c.payType,
  paying: c.paying,
  bank: c.bank,
  signed: c.signed,
  from: c.from,
});

// Datumi u listu su tekst (DD.MM.GGGG), u zahtjevu ISO. Dok datum nije ispravan, vrijedi sačuvani
// (da nepotpun unos ne izgleda kao brisanje).
export const checkContract = (
  draft: { payType: CourierPayingType | null; paying: string; bank: string; signed: string; from: string },
  saved: RosterCourier,
  now: Date,
  show: ShowFn
): RosterCheck<"paying" | "bank" | "signed" | "from", CourierUpdatePayload> => {
  const fields: RosterCheck<"paying" | "bank" | "signed" | "from", CourierUpdatePayload>["fields"] = {};
  let valid = true;
  const iso: { signed: string; from: string } = { signed: saved.signed, from: saved.from };

  const amountText = text(draft.paying).replace(",", ".");
  if (amountText) {
    const v = parseMoneyText(amountText);
    if (v == null || v < 0) {
      fields.paying = { tone: "bad", text: "Unesi iznos, npr. 2.00." };
      valid = false;
    } else if (draft.payType === 2 && v > 100) {
      fields.paying = { tone: "bad", text: "Procenat ne može biti veći od 100." };
      valid = false;
    }
  }

  for (const key of ["signed", "from"] as const) {
    const raw = text(draft[key]);
    if (!raw) {
      iso[key] = "";
      continue;
    }
    const r = parseDay(raw, now);
    if (r.ok) {
      iso[key] = r.iso;
    } else if (r.reason === "incomplete" && !show(key) && raw.length < 10) {
      fields[key] = { tone: "hint", text: DAY_MESSAGES.incomplete };
      valid = false;
    } else if (r.reason !== "empty") {
      fields[key] = { tone: "bad", text: DAY_MESSAGES[r.reason] };
      valid = false;
    }
  }

  const payload = contractDiff(contractValues(saved), {
    payType: draft.payType,
    paying: amountText,
    bank: draft.bank,
    signed: iso.signed,
    from: iso.from,
  });
  return { fields, valid, dirty: Object.keys(payload).length > 0, payload };
};

export const checkPersonal = (
  draft: { dob: string; iban: string },
  saved: RosterCourier,
  now: Date,
  show: ShowFn
): RosterCheck<"dob" | "iban", CourierUpdatePayload> => {
  const fields: RosterCheck<"dob" | "iban", CourierUpdatePayload>["fields"] = {};
  let valid = true;
  let dobIso = saved.dob;
  if (!text(draft.dob)) {
    dobIso = "";
  } else {
    const p = parseDob(draft.dob, now);
    if (p.ok) {
      dobIso = p.iso;
      fields.dob = { tone: "ok", text: `${ageText(p.age)} · ${isoLong(p.iso)}` };
    } else if (p.reason === "incomplete") {
      if (show("dob") || draft.dob.length >= 10) {
        fields.dob = { tone: "bad", text: DOB_MESSAGES.incomplete };
      } else {
        fields.dob = { tone: "hint", text: "Upiši cifre: dan, mjesec, godina." };
      }
      valid = false;
    } else if (p.reason !== "empty") {
      fields.dob = { tone: "bad", text: DOB_MESSAGES[p.reason] };
      valid = false;
    }
  }
  // IBAN je samo upozorenje: backend je 14.09. vratio i 11-1111111111-111.
  const ib = ibanState(draft.iban);
  if (ib.state === "ok") fields.iban = { tone: "ok", text: "IBAN je ispravan." };
  else if (ib.state === "short") {
    fields.iban = {
      tone: "warn",
      text: `BiH IBAN ima 20 znakova, upisano ${ib.len}. Možeš ga i ovako sačuvati.`,
    };
  } else if (ib.state === "bad") {
    fields.iban = {
      tone: "warn",
      text: "Kontrolni broj se ne slaže. Provjeri da nije greška u kucanju.",
    };
  }
  const payload = personalDiff(saved, { dob: dobIso, iban: draft.iban });
  return { fields, valid, dirty: Object.keys(payload).length > 0, payload };
};

export const checkNote = (
  draft: { note: string },
  saved: RosterCourier
): RosterCheck<never, CourierUpdatePayload> => {
  const payload = noteDiff(saved, draft);
  return { fields: {}, valid: true, dirty: Object.keys(payload).length > 0, payload };
};

// --- Novi kurir ----------------------------------------------------------------------------

export type CreateDraft = {
  first: string;
  last: string;
  phone: string;
  email: string;
  vehicle: VehicleKey | null;
  password: string;
  payType: CourierPayingType | null;
  paying: string;
  dob: string;
  ecName: string;
  ecPhone: string;
  note: string;
};

export const MIN_PASSWORD = 8;

export const emptyCreate = (): CreateDraft => ({
  first: "",
  last: "",
  phone: "",
  email: "",
  vehicle: null,
  password: generateTemporaryPassword(),
  payType: null,
  paying: "",
  dob: "",
  ecName: "",
  ecPhone: "",
  note: "",
});

// Šalju se samo popunjena polja (danas isti zahtjev nosi 15 polja, većina null).
export const createPayload = (draft: CreateDraft, now: Date): CourierCreatePayload => {
  const out: CourierCreatePayload = {
    name: text(draft.first),
    lastname: text(draft.last),
    phone: text(draft.phone),
    email: text(draft.email),
    temporary_password: draft.password,
  };
  if (draft.vehicle) out.vehicle_type = draft.vehicle;
  if (draft.payType) out.paying_type = draft.payType;
  const amount = text(draft.paying).replace(",", ".");
  if (amount) out.paying = amount;
  const dob = parseDob(draft.dob, now);
  if (dob.ok) out.date_of_birth = dob.iso;
  if (text(draft.ecName)) out.emergency_contact_name = text(draft.ecName);
  if (text(draft.ecPhone)) out.emergency_contact_phone = text(draft.ecPhone);
  if (text(draft.note)) out.note = text(draft.note);
  return out;
};

export const checkCreate = (
  draft: CreateDraft,
  roster: RosterCourier[],
  now: Date,
  show: ShowFn
): RosterCheck<
  "first" | "last" | "phone" | "email" | "password" | "dob" | "ecPhone" | "paying",
  CourierCreatePayload
> => {
  type K = "first" | "last" | "phone" | "email" | "password" | "dob" | "ecPhone" | "paying";
  const fields: Partial<Record<K, FieldMsg>> = {};
  const missing: string[] = [];
  const bad = (key: K, message: string, label: string) => {
    if (show(key)) fields[key] = { tone: "bad", text: message };
    missing.push(label);
  };

  if (!text(draft.first)) missing.push("ime");
  if (!text(draft.last)) missing.push("prezime");
  const phone = text(draft.phone);
  if (!phone) missing.push("telefon");
  else if (!phoneOk(phone)) bad("phone", "Unesi ispravan broj telefona.", "ispravan telefon");
  const email = text(draft.email);
  if (!email) missing.push("email");
  else if (!emailOk(email)) bad("email", "Unesi ispravan email.", "ispravan email");
  if (text(draft.password).length < MIN_PASSWORD) {
    bad("password", `Lozinka mora imati bar ${MIN_PASSWORD} znakova.`, `lozinku od ${MIN_PASSWORD} znakova`);
  }
  const dup = findDup(roster, { phone, email });
  if (dup) {
    const byPhone = !!phoneKey(dup.phone) && phoneKey(dup.phone) === phoneKey(phone);
    fields[byPhone ? "phone" : "email"] = { tone: "warn", text: dupText(dup, byPhone ? "phone" : "email") };
  }
  if (text(draft.dob)) {
    const p = parseDob(draft.dob, now);
    if (!p.ok && p.reason !== "empty") {
      bad("dob", p.reason === "incomplete" ? DOB_MESSAGES.incomplete : DOB_MESSAGES[p.reason], "ispravan datum rođenja");
    }
  }
  if (text(draft.ecPhone) && !phoneOk(draft.ecPhone)) {
    bad("ecPhone", "Unesi ispravan broj telefona.", "ispravan hitni telefon");
  }
  const amount = text(draft.paying).replace(",", ".");
  if (amount) {
    const v = parseMoneyText(amount);
    if (v == null || v < 0 || (draft.payType === 2 && v > 100)) {
      bad("paying", draft.payType === 2 ? "Procenat mora biti od 0 do 100." : "Unesi iznos, npr. 2.00.", "ispravan iznos");
    }
  }

  const valid = missing.length === 0;
  return {
    fields,
    valid,
    dirty: true,
    payload: createPayload(draft, now),
    hint: valid ? "" : `Još treba: ${missing.slice(0, 3).join(", ")}.`,
  };
};

// --- Lozinka i podaci za prijavu ------------------------------------------------------------

export const APP_URL = "https://kurir.ordera.app";

export const credText = (c: { login: string; password: string; first?: string }): string =>
  `${c.first ? `Zdravo ${c.first}, ovo su ` : "Ovo su "}podaci za prijavu u Ordera aplikaciju za kurire:\n` +
  `Korisničko ime: ${c.login}\nLozinka: ${c.password}\nAplikacija: ${APP_URL}\n` +
  "Pri prvoj prijavi promijeni lozinku.";

export const checkPassword = (
  password: string
): RosterCheck<"password", { password: string }> => {
  const valid = text(password).length >= MIN_PASSWORD;
  return {
    fields: valid ? {} : { password: { tone: "bad", text: `Lozinka mora imati bar ${MIN_PASSWORD} znakova.` } },
    valid,
    dirty: true,
    payload: { password },
  };
};

// --- Uplata i isplata ----------------------------------------------------------------------

export const checkAmount = (
  amountText: string,
  owed: number | null,
  currency: string,
  mode: "receipt" | "payout"
): { valid: boolean; amount: number; message: FieldMsg | null; hint: string } => {
  const amount = parseMoneyText(amountText) ?? 0;
  if (!(amount > 0)) return { valid: false, amount: 0, message: null, hint: "Upiši iznos veći od 0." };
  const fmt = (v: number) => `${v.toFixed(2)} ${currency}`;
  if (owed == null) return { valid: true, amount, message: null, hint: "" };
  if (amount > owed) {
    return {
      valid: true,
      amount,
      message: {
        tone: "warn",
        text: `Veće je od ${mode === "receipt" ? "duga" : "dugovanja"} za ${fmt(amount - owed)}. Sistem dopušta, ali provjeri.`,
      },
      hint: "",
    };
  }
  const left = Math.round((owed - amount) * 100) / 100;
  return {
    valid: true,
    amount,
    message: {
      tone: "ok",
      text:
        left === 0
          ? mode === "receipt"
            ? "Dug se zatvara."
            : "Zarada se isplaćuje u cijelosti."
          : `Ostaje ${mode === "receipt" ? "dug " : ""}${fmt(left)}.`,
    },
    hint: "",
  };
};

// --- Poruka --------------------------------------------------------------------------------

export const checkMessage = (draft: { title: string; body: string }) => {
  const valid = Boolean(text(draft.title) && text(draft.body));
  return { valid, hint: valid ? "" : "Upiši naslov i poruku." };
};

// "Svi kuriri firme" kad je izabran cijeli spisak; inače tačan spisak.
export const isEveryone = (recipientIds: number[], roster: RosterCourier[]): boolean =>
  roster.length > 0 &&
  recipientIds.length === roster.length &&
  roster.every((c) => recipientIds.includes(c.id));

// --- Listovi --------------------------------------------------------------------------------

// Koji list je otvoren nad detaljem (ili nad listom, za novog kurira i grupnu poruku).
export type RosterSheetKind =
  | "kontakt"
  | "vozilo"
  | "ugovor"
  | "licni"
  | "napomena"
  | "lozinka"
  | "suspenduj"
  | "aktiviraj"
  | "ukloni"
  | "uplata"
  | "isplata"
  | "poruka"
  | "nova";
