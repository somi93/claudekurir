import type { DispatcherZone } from "~/types/dispatcherZone";
import type {
  Surcharge,
  SurchargeType,
  VehicleRule,
  VehicleRuleConditionType,
  VehicleRuleVehicle,
} from "~/types/pricing";
import { resolveCurrency, toAmount } from "~/utils/currency";
import { parseTimestamp } from "~/utils/datetime";
import { ruleVehicleMeta } from "~/utils/vehicle";

// Čista logika Cjenovnika (bez Vuea i Nuxta, pa se provjerava u običnom Node-u): brojevi sa zarezom,
// obračun cijene, izbor pravila za vozila, redoslijed pravila i tabela cijena. Jedan izvor za Primjer
// narudžbe, tabelu po udaljenosti i uticaj doplate. Prototip (docs/2026/10/cjenovnik-prototip/app.js)
// koristi interne nazive (km/fix/note; sur/zone/dist); ovdje su API nazivi (per_km/fixed/note;
// surcharge/zone/distance/default).

// --- Brojevi ------------------------------------------------------------------------------------

// Rezultat čitanja unesenog iznosa: prazno, nije broj, ili broj.
export type AmountParse =
  | { state: "empty" }
  | { state: "nan" }
  | { state: "ok"; value: number };

// Jedan znak razdvajanja (tačka ili zarez), bez eksponenta i heksa zapisa: "1e3" i "0x10" nisu iznos.
const AMOUNT_RE = /^[+-]?(\d+[.,]?\d*|[.,]\d+)$/;

// Čita tekst iz polja ("2,5", "2.5", "  "); prazno je zasebno stanje jer poruka za prazno i za slova nije ista.
export const parseAmount = (text: string | null | undefined): AmountParse => {
  const t = String(text ?? "").trim();
  if (t === "") return { state: "empty" };
  if (!AMOUNT_RE.test(t)) return { state: "nan" };
  const value = Number(t.replace(",", "."));
  return Number.isFinite(value) ? { state: "ok", value } : { state: "nan" };
};

// Na dvije decimale, pola naviše (kao PHP round). Mala tolerancija jer 1.005 * 100 daje 100.49999999999999.
export const round2 = (n: number): number => {
  const r = Math.round(Math.abs(n) * 100 + 1e-9) / 100;
  return n < 0 && r !== 0 ? -r : r;
};

// "2,50": iznos sa dvije decimale i zarezom.
export const formatNum2 = (n: number): string => round2(n).toFixed(2).replace(".", ",");

// "4,5": kilometri sa jednom decimalom i zarezom (klizač ide u koracima od 0,5).
export const formatKm = (n: number): string => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");

// "4", "4,5", "4,25": kilometri bez nepotrebne nule, za naslove pravila ("Udaljenost 4–8 km").
export const formatKmShort = (n: number): string => String(Math.round(n * 100) / 100).replace(".", ",");

// "2,50 KM": iznos i valuta firme (prazna valuta je "KM").
export const formatMoney = (n: number, currency?: string | null): string =>
  `${formatNum2(n)} ${resolveCurrency(currency)}`;

// Korak ± dugmadi: čita tekst (ili uzme `fallback` kad nije broj), pomjeri za dir * step, najmanje 0.
export const stepAmount = (text: string, dir: 1 | -1, step: number, fallback: number): string => {
  const parsed = parseAmount(text);
  const current = parsed.state === "ok" ? parsed.value : fallback;
  return formatNum2(Math.max(0, round2(current + dir * step)));
};

// "45 min", "1 h 12 min", "2 d": koliko dugo nešto traje, najviše dvije jedinice.
export const formatDuration = (minutes: number): string => {
  const m = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0));
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const rest = m % 60;
    return rest === 0 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 60)} h ${rest} min`;
  }
  return `${Math.floor(m / 1440)} d`;
};

// Vrijednost iz API-ja (broj ili tekst "0.30") kao broj; neispravno je 0 da obračun nikad ne padne na NaN.
const amountOf = (value: unknown): number => toAmount(value) ?? 0;

// Broj iz polja ili null kad je prazno ili nije broj (za granice koje su opcione).
export const amountOrNull = (text: string | null | undefined): number | null => {
  const parsed = parseAmount(text);
  return parsed.state === "ok" ? parsed.value : null;
};

// Terenski faktor kao u polju: "1,6", "1,0", "1,25" (najviše jedna završna nula se skida).
export const formatTerrain = (n: number): string => formatNum2(n).replace(/0$/, "");

// "HH:mm" iz "HH:mm:ss" (backend šalje sekunde, forma ih ne treba).
export const clockText = (time: string | null | undefined): string => (time ? time.slice(0, 5) : "");

// --- Obračun ------------------------------------------------------------------------------------

// Cijena dostave bez doplata: startna i po kilometru.
export type PriceConfig = { base: number; km: number };

// Koje su doplate uključene, po id-u doplate.
export type ActiveMap = Record<number, boolean>;

// Jedna stavka obračuna: uključena doplata i koliko košta za datu udaljenost.
export type PriceLine = { id: number; name: string; amount: number };

// Raspis cijene: startna, po kilometrima, stavke doplata, zbir doplata i ukupno.
export type PriceBreakdown = {
  base: number;
  perKm: number;
  lines: PriceLine[];
  surchargeTotal: number;
  total: number;
};

// Najmanje što obračun traži od doplate (pun Surcharge to ispunjava).
export type SurchargeCalcInput = Pick<Surcharge, "id" | "name" | "type" | "value">;

// Obračun za udaljenost: napomene se ne računaju, od ostalih samo uključene; svaka stavka se zaokružuje posebno.
export const calcPrice = (
  distKm: number,
  cfg: PriceConfig,
  surcharges: readonly SurchargeCalcInput[],
  active: ActiveMap
): PriceBreakdown => {
  const perKm = round2(cfg.km * distKm);
  const lines: PriceLine[] = [];
  for (const s of surcharges) {
    if (s.type === "note" || !active[s.id]) continue;
    const value = amountOf(s.value);
    lines.push({ id: s.id, name: s.name, amount: round2(s.type === "per_km" ? value * distKm : value) });
  }
  const surchargeTotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  return { base: cfg.base, perKm, lines, surchargeTotal, total: round2(cfg.base + perKm + surchargeTotal) };
};

// Stvarno stanje doplata: uključena je ona koja je `active` na serveru.
export const activeOf = (surcharges: readonly Pick<Surcharge, "id" | "active">[]): ActiveMap => {
  const map: ActiveMap = {};
  for (const s of surcharges) map[s.id] = s.active;
  return map;
};

// "Šta ako": stvarno stanje preko kojeg su prepisane doplate koje je dispečer prebacio u primjeru.
export const activeWithOverrides = (
  surcharges: readonly Pick<Surcharge, "id" | "active">[],
  over: Record<number, boolean>
): ActiveMap => {
  const map: ActiveMap = {};
  for (const s of surcharges) map[s.id] = over[s.id] ?? s.active;
  return map;
};

// Napomena nema jedinicu pa se piše kao u ranijim presetima ("prilagođeno vozilo"), da stari prikaz ostane isti.
const NOTE_UNIT = "prilagođeno vozilo";

// Jedinica doplate izvedena iz tipa i valute firme: "KM/km", "KM" ili tekst za napomenu.
export const surchargeUnit = (type: SurchargeType, currency?: string | null): string => {
  const cur = resolveCurrency(currency);
  if (type === "per_km") return `${cur}/km`;
  if (type === "fixed") return cur;
  return NOTE_UNIT;
};

// Kratak opis iznosa u redu: "+0,30 KM/km", "+1,50 KM", "Samo napomena".
export const surchargeSummary = (
  s: Pick<Surcharge, "type" | "value">,
  currency?: string | null
): string => {
  if (s.type === "note") return "Samo napomena";
  const amount = formatNum2(amountOf(s.value));
  return s.type === "per_km"
    ? `+${amount} ${resolveCurrency(currency)}/km`
    : `+${amount} ${resolveCurrency(currency)}`;
};

// Da li se doplata sama uključuje i isključuje po vremenu (ima i početak i kraj).
export const isAutoSurcharge = (s: Pick<Surcharge, "time_from" | "time_to">): boolean =>
  Boolean(s.time_from && s.time_to);

// "Ručno" ili "Automatski 22:00–06:00".
export const surchargeScheduleText = (s: Pick<Surcharge, "time_from" | "time_to">): string =>
  isAutoSurcharge(s) ? `Automatski ${clockText(s.time_from)}–${clockText(s.time_to)}` : "Ručno";

// Stanje doplate za oznaku u redu: ton i tekst.
export type SurchargeStatus = { tone: "on" | "auto" | "off"; text: string };

// "Na snazi 1 h 12 min", "Uključuje se u 22:00" ili "Isključena". PRETPOSTAVKA B3: activated_at je
// trenutak kad je active prešao u true (nije potvrđeno ni šta ručni prekidač radi usred vremenskog
// prozora); bez njega piše samo "Na snazi". `nowMs` se prosljeđuje da test i ekran ne čitaju sat sami.
export const surchargeStatus = (
  s: Pick<Surcharge, "active" | "activated_at" | "time_from" | "time_to">,
  nowMs: number
): SurchargeStatus => {
  if (s.active) {
    const since = parseTimestamp(s.activated_at);
    const minutes = since === null ? 0 : Math.floor((nowMs - since) / 60000);
    return { tone: "on", text: minutes > 0 ? `Na snazi ${formatDuration(minutes)}` : "Na snazi" };
  }
  if (isAutoSurcharge(s)) return { tone: "auto", text: `Uključuje se u ${clockText(s.time_from)}` };
  return { tone: "off", text: "Isključena" };
};

// --- Pravila za vozila (PRETPOSTAVKA B1) --------------------------------------------------------

// Zona onoliko koliko pravilima treba (pun DispatcherZone to ispunjava).
export type ZoneLike = Pick<DispatcherZone, "id" | "name" | "terrainFactor">;

// Vozila u redoslijedu u kojem se nude u formi pravila.
export const RULE_VEHICLE_KEYS: readonly VehicleRuleVehicle[] = ["car", "motorbike", "bicycle", "walk"];

// Naziv, ikona i boja vozila za pravila. Tuđi RULE_VEHICLE_META još piše "Pešice", pa ovdje stoji "Pješice".
export const ruleVehicleView = (vehicle: string): { label: string; icon: string; color: string } => {
  const meta = ruleVehicleMeta(vehicle);
  return vehicle === "walk" ? { ...meta, label: "Pješice" } : meta;
};

// Tip uslova pravila: upisan condition_type, a kod starih pravila izveden iz popunjenih polja
// (isto kao inferConditionType u useVehicleRules).
export const ruleKind = (rule: VehicleRule): VehicleRuleConditionType => {
  if (rule.condition_type) return rule.condition_type;
  if (rule.zone_id != null) return "zone";
  if (rule.min_distance_km != null || rule.max_distance_km != null) return "distance";
  if (rule.surcharge_id != null) return "surcharge";
  return "default";
};

// Vozila pravila redom preferencije: preferred_vehicles, a kod starih pravila samo `vehicle`.
// Nepoznata vrijednost (npr. staro "scooter") prolazi dalje; ruleVehicleView za nju ima rezervu.
export const ruleVehicles = (rule: VehicleRule): VehicleRuleVehicle[] =>
  (rule.preferred_vehicles && rule.preferred_vehicles.length > 0
    ? [...rule.preferred_vehicles]
    : [rule.vehicle]) as VehicleRuleVehicle[];

type RankedRule = { rule: VehicleRule; priority: number };

// Pravila poređana po priority rastuće, a kod istog (ili izostalog) priority po id-u. Pravilo bez
// priority uzima svoje mjesto u odgovoru (kao u useVehicleRules: priority ?? index + 1).
const rankRules = (rules: readonly VehicleRule[]): RankedRule[] =>
  rules
    .map((rule, index) => ({ rule, priority: toAmount(rule.priority) ?? index + 1 }))
    .sort((a, b) => a.priority - b.priority || a.rule.id - b.rule.id);

// Podjela pravila na uređenu listu i zadano pravilo ("Sve ostalo"). PRETPOSTAVKA B1: zadano je uvijek
// posljednje, pa i kad API vrati default sa nižim priority od ostalih; ako ih ima više, posljednje po
// redoslijedu je zadano, a ranija ostaju u listi da se vide i mogu obrisati.
export const splitRules = (
  rules: readonly VehicleRule[]
): { list: VehicleRule[]; fallback: VehicleRule | null } => {
  const ranked = rankRules(rules);
  let fallbackAt = -1;
  for (let i = ranked.length - 1; i >= 0; i--) {
    const item = ranked[i];
    if (item && ruleKind(item.rule) === "default") {
      fallbackAt = i;
      break;
    }
  }
  const fallback = ranked[fallbackAt]?.rule ?? null;
  return { list: ranked.filter((_, i) => i !== fallbackAt).map((r) => r.rule), fallback };
};

// Primjer za koji se bira pravilo: zona (null = svejedno), udaljenost, uključene doplate i poznate zone.
export type RuleContext = {
  zoneId: number | null;
  distKm: number;
  active: ActiveMap;
  zones: readonly ZoneLike[];
};

// Da li se pravilo poklapa sa primjerom. Najveći faktor terena važi za svako pravilo (i zadano) čim je
// zona izabrana; bez zone ("Svejedno") se ne provjerava. Udaljenost bez ijedne granice se ne poklapa.
export const ruleMatches = (rule: VehicleRule, ctx: RuleContext): boolean => {
  const maxTerrain = toAmount(rule.max_terrain_factor);
  const zone = ctx.zoneId === null ? undefined : ctx.zones.find((z) => z.id === ctx.zoneId);
  const terrain = zone ? toAmount(zone.terrainFactor) : null;
  if (maxTerrain !== null && terrain !== null && terrain > maxTerrain) return false;
  switch (ruleKind(rule)) {
    case "default":
      return true;
    case "zone":
      return rule.zone_id != null && rule.zone_id === ctx.zoneId;
    case "surcharge":
      return rule.surcharge_id != null && ctx.active[rule.surcharge_id] === true;
    case "distance": {
      const min = toAmount(rule.min_distance_km);
      const max = toAmount(rule.max_distance_km);
      if (min === null && max === null) return false;
      return (min === null || ctx.distKm >= min) && (max === null || ctx.distKm <= max);
    }
  }
};

// Pravilo koje bira vozila i njegovo mjesto u listi (-1 = zadano pravilo).
export type RuleRecommendation = { rule: VehicleRule; index: number };

// Prvo pravilo koje se poklopi, odozgo prema dolje; ako nijedno, zadano; ako ga nema, null.
// PRETPOSTAVKA B1: server bira isto (prvo po rastućem priority, zadano zadnje); nije potvrđeno.
export const recommendRule = (
  rules: readonly VehicleRule[],
  ctx: RuleContext
): RuleRecommendation | null => {
  const { list, fallback } = splitRules(rules);
  for (let i = 0; i < list.length; i++) {
    const rule = list[i];
    if (rule && ruleMatches(rule, ctx)) return { rule, index: i };
  }
  return fallback ? { rule: fallback, index: -1 } : null;
};

// Gdje se traže nazivi zona i doplata kad se piše naslov pravila.
export type RuleTitleLookup = {
  zones: readonly ZoneLike[];
  surcharges: readonly Pick<Surcharge, "id" | "name">[];
};

// Uslov pravila u obliku koji ima i pravilo i nacrt (brojevi, ne tekst iz polja).
export type RuleCondition = {
  kind: VehicleRuleConditionType;
  zoneId: number | null;
  surchargeId: number | null;
  min: number | null;
  max: number | null;
  // Tekst iz servera (condition_text), rezerva kad zona nije poznata.
  text?: string | null;
};

// Naslov uslova: "Zona: Centar", "Doplata: Kiša", "Udaljenost 4–8 km" / "preko 4 km" / "do 4 km",
// "Sve ostalo". Nepoznata zona koristi condition_text; obrisana doplata je "(obrisana doplata)".
export const conditionTitle = (c: RuleCondition, lookup: RuleTitleLookup): string => {
  const text = c.text?.trim() ?? "";
  switch (c.kind) {
    case "zone": {
      const zone = c.zoneId === null ? undefined : lookup.zones.find((z) => z.id === c.zoneId);
      return zone ? `Zona: ${zone.name}` : text || "Zona: ?";
    }
    case "surcharge": {
      const s = c.surchargeId === null ? undefined : lookup.surcharges.find((x) => x.id === c.surchargeId);
      return `Doplata: ${s ? s.name : "(obrisana doplata)"}`;
    }
    case "distance":
      if (c.min !== null && c.max !== null) return `Udaljenost ${formatKmShort(c.min)}–${formatKmShort(c.max)} km`;
      if (c.min !== null) return `Udaljenost preko ${formatKmShort(c.min)} km`;
      if (c.max !== null) return `Udaljenost do ${formatKmShort(c.max)} km`;
      return text || "Udaljenost";
    case "default":
      return "Sve ostalo";
  }
};

// Naslov postojećeg pravila (vidi conditionTitle).
export const ruleTitle = (rule: VehicleRule, lookup: RuleTitleLookup): string =>
  conditionTitle(
    {
      kind: ruleKind(rule),
      zoneId: rule.zone_id ?? null,
      surchargeId: rule.surcharge_id ?? null,
      min: toAmount(rule.min_distance_km),
      max: toAmount(rule.max_distance_km),
      text: rule.condition_text,
    },
    lookup
  );

// Oznaka tipa uz naslov: "Zona", "Doplata", "Udaljenost" (zadano pravilo je bez oznake).
export const ruleKindLabel = (kind: VehicleRuleConditionType): string =>
  kind === "zone" ? "Zona" : kind === "surcharge" ? "Doplata" : kind === "distance" ? "Udaljenost" : "";

// Pravila koja koriste doplatu, redom kojim se primjenjuju (za dijalog pri brisanju).
export const rulesUsingSurcharge = (rules: readonly VehicleRule[], surchargeId: number): VehicleRule[] =>
  splitRules(rules).list.filter((r) => ruleKind(r) === "surcharge" && r.surcharge_id === surchargeId);

// Uslov iz nacrta pravila (tekst u poljima) za poređenje sa postojećim pravilima.
export type RuleConditionLike = {
  type: VehicleRuleConditionType;
  zone: number | null;
  sur: number | null;
  min: string;
  max: string;
};


// Mjesto (od 1) ranijeg pravila sa istim uslovom, pa se ovo nikad ne bi primijenilo; 0 ako ga nema.
// Pravilo koje se mijenja (selfId) gleda samo pravila iznad sebe; novo pravilo gleda sva.
export const findDuplicateRule = (
  draft: RuleConditionLike,
  rules: readonly VehicleRule[],
  selfId: number | null
): number => {
  if (draft.type === "default") return 0;
  const { list } = splitRules(rules);
  const selfAt = selfId === null ? -1 : list.findIndex((r) => r.id === selfId);
  const end = selfAt >= 0 ? selfAt : list.length;
  const min = amountOrNull(draft.min);
  const max = amountOrNull(draft.max);
  for (let i = 0; i < end; i++) {
    const rule = list[i];
    if (!rule || ruleKind(rule) !== draft.type) continue;
    if (draft.type === "zone" && draft.zone !== null && rule.zone_id === draft.zone) return i + 1;
    if (draft.type === "surcharge" && draft.sur !== null && rule.surcharge_id === draft.sur) return i + 1;
    if (draft.type === "distance" && (min !== null || max !== null)) {
      if (toAmount(rule.min_distance_km) === min && toAmount(rule.max_distance_km) === max) return i + 1;
    }
  }
  return 0;
};

// Nova vrijednost priority za jedno pravilo.
export type PriorityChange = { id: number; priority: number };

// Priority za novo pravilo: ide iza svih pravila u listi, a ispred zadanog. Računa po najvećem priority i
// po broju pravila, pa radi i kad su priority neuređeni, dupli ili ih nema. `shiftFallback` je zadano
// pravilo koje treba pomjeriti iza novog (null ako je već iza). PRETPOSTAVKA B1.
export const planNewRule = (
  rules: readonly VehicleRule[]
): { priority: number; shiftFallback: PriorityChange | null } => {
  const ranked = rankRules(rules);
  const { fallback } = splitRules(rules);
  const inList = ranked.filter((r) => r.rule !== fallback);
  const priority = Math.max(inList.length, ...inList.map((r) => r.priority)) + 1;
  const fallbackPriority = fallback ? toAmount(fallback.priority) : null;
  const shift = fallback !== null && (fallbackPriority === null || fallbackPriority <= priority);
  return {
    priority,
    shiftFallback: shift && fallback ? { id: fallback.id, priority: priority + 1 } : null,
  };
};

// Pomjeranje pravila za jedno mjesto (-1 gore, 1 dolje): `a` je pravilo koje se pomjera, `b` njegov
// susjed, a `others` pravila koja treba prenumerisati kad su priority bili dupli ili izostali (obično
// prazno, jer je tada dovoljna zamjena a i b). null kad se ne može (zadano, nepoznato, rub liste).
export const planMove = (
  rules: readonly VehicleRule[],
  id: number,
  dir: -1 | 1
): { a: PriorityChange; b: PriorityChange; others: PriorityChange[] } | null => {
  const { list, fallback } = splitRules(rules);
  const i = list.findIndex((r) => r.id === id);
  const j = i + dir;
  const a = list[i];
  const b = list[j];
  if (i < 0 || j < 0 || !a || !b) return null;

  const stored = list.map((r) => toAmount(r.priority));
  const fallbackPriority = fallback ? toAmount(fallback.priority) : null;
  // Zamjena dva priority je dovoljna samo kad su svi zadani i strogo rastu (bez duplih).
  let distinct = true;
  let prev = -Infinity;
  for (const p of stored) {
    if (p === null || p <= prev) {
      distinct = false;
      break;
    }
    prev = p;
  }

  if (distinct) {
    const pa = stored[i];
    const pb = stored[j];
    if (pa === null || pa === undefined || pb === null || pb === undefined) return null;
    const others: PriorityChange[] = [];
    // Zadano pravilo mora ostati iza svih: jedna ispravka, i to samo ako ga je API postavio ispred.
    const top = Math.max(...stored.map((p) => p ?? 0));
    if (fallback && (fallbackPriority === null || fallbackPriority <= top)) {
      others.push({ id: fallback.id, priority: top + 1 });
    }
    return { a: { id: a.id, priority: pb }, b: { id: b.id, priority: pa }, others };
  }

  // Dupli ili izostali priority: sve se numeriše po mjestu (1..n), uz zamjenu a i b.
  const order = [...list];
  order[i] = b;
  order[j] = a;
  const next = new Map<number, number>(order.map((r, k) => [r.id, k + 1]));
  const others: PriorityChange[] = [];
  list.forEach((r, k) => {
    if (r.id === a.id || r.id === b.id) return;
    const was = stored[k];
    const now = next.get(r.id);
    if (now !== undefined && was !== now) others.push({ id: r.id, priority: now });
  });
  if (fallback && (fallbackPriority === null || fallbackPriority <= list.length)) {
    others.push({ id: fallback.id, priority: list.length + 1 });
  }
  return {
    a: { id: a.id, priority: next.get(a.id) ?? j + 1 },
    b: { id: b.id, priority: next.get(b.id) ?? i + 1 },
    others,
  };
};

// --- Tabela cijena po udaljenosti ----------------------------------------------------------------

// Udaljenosti u tabeli "Šta kupac plaća po udaljenosti", u km.
export const sampleDistances: readonly number[] = [1, 2, 3, 5, 8, 12];

// Najmanja udaljenost u Primjeru narudžbe, u km.
export const SIM_MIN = 0.5;

// Najveća udaljenost u Primjeru narudžbe, u km.
export const SIM_MAX = 15;

// Korak klizača i ± dugmadi u Primjeru narudžbe, u km.
export const SIM_STEP = 0.5;

// Početna udaljenost u Primjeru narudžbe, u km.
export const SIM_DEFAULT = 4.5;

// Udaljenost u granice primjera i na korak od 0,5 km; nešto što nije broj postaje početna udaljenost.
export const clampDist = (n: number): number =>
  Number.isFinite(n)
    ? Math.min(SIM_MAX, Math.max(SIM_MIN, Math.round(n / SIM_STEP) * SIM_STEP))
    : SIM_DEFAULT;

// Jedan red tabele: udaljenost, startna + km po nacrtu, ukupno sa doplatama prije i poslije, i oznake.
export type LadderRow = {
  dist: number;
  startPlusKm: number;
  before: number;
  after: number;
  changed: boolean;
  up: boolean;
  current: boolean;
};

// Redovi tabele cijena: `saved` je sačuvana cijena, `draft` nacrt (isto kad nema izmjene), a doplate su
// one koje su sada na snazi. `current` označava red najbliži udaljenosti iz primjera (razlika manja od 0,5 km).
export const ladderRows = (
  distances: readonly number[],
  saved: PriceConfig,
  draft: PriceConfig,
  surcharges: readonly SurchargeCalcInput[],
  active: ActiveMap,
  currentDist: number
): LadderRow[] =>
  distances.map((dist) => {
    const before = calcPrice(dist, saved, surcharges, active).total;
    const after = calcPrice(dist, draft, surcharges, active).total;
    return {
      dist,
      startPlusKm: round2(draft.base + draft.km * dist),
      before,
      after,
      changed: before !== after,
      up: after > before,
      current: Math.abs(dist - currentDist) < 0.5,
    };
  });
