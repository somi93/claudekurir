import type { VehicleRulePayload } from "~/services/vehicleRulesService";
import type {
  ConditionTag,
  Pricing,
  Surcharge,
  SurchargePreset,
  SurchargeType,
  VehicleRule,
  VehicleRuleConditionType,
  VehicleRuleVehicle,
} from "~/types/pricing";
import { resolveCurrency, toAmount } from "~/utils/currency";
import {
  amountOrNull,
  clockText,
  conditionTitle,
  formatKm,
  formatKmShort,
  formatMoney,
  formatNum2,
  formatTerrain,
  isAutoSurcharge,
  parseAmount,
  round2,
  ruleKind,
  ruleVehicles,
  surchargeUnit,
  type PriceConfig,
  type RuleTitleLookup,
} from "~/utils/pricing";

// Nacrti i provjere za Cjenovnik (čista logika, kao companySettings.ts za Firmu): šta se kuca u poljima,
// kako se provjerava, šta ide serveru i gdje stoji poruka servera. Brojevi u nacrtu su tekst sa
// zarezom jer se kucaju; pretvaraju se tek pri provjeri i slanju, a serveru uvijek idu BROJEVI.

// --- Cijena -------------------------------------------------------------------------------------

// Šta nacrt cijene čita od sačuvane cijene (pun Pricing to ispunjava).
type SavedPrice = Pick<Pricing, "base_price" | "price_per_km">;

// Nacrt cijene dostave: startna cijena i cijena po kilometru kako su ukucane.
export type PriceDraft = { base: string; km: string };

// Pragovi provjere iznosa, prijedlog D5, podešavaju se: promjena jednog iznosa za 50 % ili više
// (SANITY_CHANGE), cijena po km od 3 ili više (SANITY_KM), a primjer u poruci je za 10 km (SANITY_PROBE_KM).
export const SANITY_CHANGE = 0.5;
export const SANITY_KM = 3;
export const SANITY_PROBE_KM = 10;

// Naslov žute poruke provjere iznosa.
export const SANITY_TITLE = "Provjeri iznos";

// Sačuvana cijena kao brojevi za obračun (iznos koji nije broj je 0).
export const priceConfigOf = (saved: SavedPrice): PriceConfig => ({
  base: toAmount(saved.base_price) ?? 0,
  km: toAmount(saved.price_per_km) ?? 0,
});

// Nacrt iz sačuvane cijene: oba iznosa sa dvije decimale i zarezom.
export const makePriceDraft = (saved: Pricing): PriceDraft => {
  const cfg = priceConfigOf(saved);
  return { base: formatNum2(cfg.base), km: formatNum2(cfg.km) };
};

const amountError = (text: string, example: string): string | null => {
  const parsed = parseAmount(text);
  if (parsed.state === "empty") return `Unesi iznos, npr. ${example}.`;
  if (parsed.state === "nan") return `Unesi broj, npr. ${example}.`;
  return parsed.value < 0 ? "Iznos ne može biti manji od 0." : null;
};

// Greške polja cijene (prazno, nije broj, manje od 0); prazan objekat znači da se može sačuvati.
export const priceErrors = (draft: PriceDraft): { base?: string; km?: string } => {
  const errors: { base?: string; km?: string } = {};
  const base = amountError(draft.base, "2,50");
  const km = amountError(draft.km, "0,80");
  if (base) errors.base = base;
  if (km) errors.km = km;
  return errors;
};

const validAmount = (text: string, fallback: number): number => {
  const parsed = parseAmount(text);
  return parsed.state === "ok" && parsed.value >= 0 ? round2(parsed.value) : round2(fallback);
};

// Iznosi za obračun: uneseni ako su važeći, inače sačuvani (obračun nikad ne računa sa praznim poljem).
export const priceNumbers = (draft: PriceDraft, saved: SavedPrice): PriceConfig => {
  const was = priceConfigOf(saved);
  return { base: validAmount(draft.base, was.base), km: validAmount(draft.km, was.km) };
};

const amountChanged = (text: string, saved: number): boolean => {
  const parsed = parseAmount(text);
  return parsed.state !== "ok" || round2(parsed.value) !== round2(saved);
};

// Koje polje cijene se razlikuje od sačuvanog; prazno ili neispravno polje je izmjena.
export const priceDirtyFields = (draft: PriceDraft, saved: SavedPrice): { base: boolean; km: boolean } => {
  const was = priceConfigOf(saved);
  return { base: amountChanged(draft.base, was.base), km: amountChanged(draft.km, was.km) };
};

// Da li nacrt cijene nosi izmjenu ("2,5" i "2,50" je ista cijena).
export const priceDirty = (draft: PriceDraft, saved: SavedPrice): boolean => {
  const changed = priceDirtyFields(draft, saved);
  return changed.base || changed.km;
};

const SANITY_HINT = "Ako si mislio na manji iznos, provjeri zarez.";

// Žuta poruka (bez blokade) kad izgleda kao greška u zarezu: iznos se mijenja za SANITY_CHANGE ili više,
// ili je nova cijena po km SANITY_KM ili veća (tada s primjerom za 10 km). Samo za ono što se mijenja i
// samo kad su oba polja ispravna; inače null. Tekst je bez naslova (SANITY_TITLE).
export const priceSanity = (draft: PriceDraft, saved: SavedPrice, currency: string): string | null => {
  const errors = priceErrors(draft);
  if (errors.base || errors.km) return null;
  const now = priceNumbers(draft, saved);
  const was = priceConfigOf(saved);
  const changed = priceDirtyFields(draft, saved);
  const notes: string[] = [];
  const rel = (next: number, prev: number, what: string) => {
    const before = Math.round(prev * 100);
    const diff = Math.abs(Math.round(next * 100) - before);
    if (before > 0 && diff > 0 && diff / before >= SANITY_CHANGE) {
      notes.push(`${what} ${next > prev ? "raste" : "pada"} za ${Math.round((diff / before) * 100)} %.`);
    }
  };
  rel(now.km, was.km, "Cijena po kilometru");
  rel(now.base, was.base, "Startna cijena");
  if (changed.km && now.km >= SANITY_KM) {
    notes.push(`Za ${SANITY_PROBE_KM} km to je ${formatMoney(now.base + now.km * SANITY_PROBE_KM, currency)}.`);
  }
  return notes.length ? `${notes.join(" ")} ${SANITY_HINT}` : null;
};

// Tijelo PUT /pricing: BROJEVI (nikad tekst ni ""), na dvije decimale. Baca grešku ako nacrt nije
// ispravan; ekran zato prvo provjeri priceErrors.
export const toPricingBody = (
  draft: PriceDraft,
  currency?: string | null
): { base_price: number; price_per_km: number; currency: string } => {
  const base = parseAmount(draft.base);
  const km = parseAmount(draft.km);
  if (base.state !== "ok" || km.state !== "ok" || base.value < 0 || km.value < 0) {
    throw new Error("Nacrt cijene nije ispravan.");
  }
  return {
    base_price: round2(base.value),
    price_per_km: round2(km.value),
    currency: resolveCurrency(currency),
  };
};

// --- Doplata ------------------------------------------------------------------------------------

// Ikona nove doplate kad nije izabrana iz kataloga (ista kao u starom ekranu).
export const DEFAULT_SURCHARGE_ICON = "mdi-tune-variant";

// Nacrt doplate: `val` je tekst sa zarezom, `from`/`to` su "HH:mm" (važe samo uz sched "auto"), `on` važi
// samo za novu doplatu, a `icon` i `conditionTagId` dolaze iz kataloga ili preseta i ne mijenjaju se u formi.
export type SurchargeDraft = {
  name: string;
  desc: string;
  type: SurchargeType;
  val: string;
  sched: "manual" | "auto";
  from: string;
  to: string;
  on: boolean;
  icon: string;
  conditionTagId: number | null;
};

// Vrijeme koje forma nudi kad dispečer izabere "Po vremenu" (noćna dostava).
const DEFAULT_FROM = "22:00";
const DEFAULT_TO = "06:00";

const blankSurchargeDraft = (): SurchargeDraft => ({
  name: "",
  desc: "",
  type: "per_km",
  val: "",
  sched: "manual",
  from: DEFAULT_FROM,
  to: DEFAULT_TO,
  on: false,
  icon: DEFAULT_SURCHARGE_ICON,
  conditionTagId: null,
});

// Nacrt doplate iz postojeće doplate (izmjena), iz kataloga, iz preseta ili prazan (null). Nova doplata
// je uvijek isključena (D2). Katalog nosi samo naziv, ikonu i predloženo vrijeme, pa tip i iznos ostaju prazni.
export const makeSurchargeDraft = (
  source: Surcharge | ConditionTag | SurchargePreset | null
): SurchargeDraft => {
  const draft = blankSurchargeDraft();
  if (source === null) return draft;
  if ("delivery_company_id" in source) {
    const auto = isAutoSurcharge(source);
    return {
      name: source.name,
      desc: source.description ?? "",
      type: source.type,
      val: source.type === "note" ? "" : formatNum2(toAmount(source.value) ?? 0),
      sched: auto ? "auto" : "manual",
      from: auto ? clockText(source.time_from) : DEFAULT_FROM,
      to: auto ? clockText(source.time_to) : DEFAULT_TO,
      on: source.active,
      icon: source.icon || DEFAULT_SURCHARGE_ICON,
      conditionTagId: source.condition_tag?.id ?? null,
    };
  }
  if ("key" in source) {
    const auto = Boolean(source.default_time_from && source.default_time_to);
    return {
      ...draft,
      name: source.name,
      sched: auto ? "auto" : "manual",
      from: auto ? clockText(source.default_time_from) : DEFAULT_FROM,
      to: auto ? clockText(source.default_time_to) : DEFAULT_TO,
      icon: source.icon || DEFAULT_SURCHARGE_ICON,
      conditionTagId: source.id,
    };
  }
  const auto = Boolean(source.time_from && source.time_to);
  return {
    ...draft,
    name: source.name,
    desc: source.description,
    type: source.type,
    val: source.type === "note" || !source.value ? "" : formatNum2(source.value),
    sched: auto ? "auto" : "manual",
    from: auto ? clockText(source.time_from) : DEFAULT_FROM,
    to: auto ? clockText(source.time_to) : DEFAULT_TO,
    icon: source.icon || DEFAULT_SURCHARGE_ICON,
  };
};

// Greške polja doplate: naziv (obavezan, jedinstven bez obzira na veličinu slova), iznos (osim za napomenu),
// vrijeme (oba kraja i različita).
export type SurchargeErrors = { name?: string; val?: string; time?: string };

// Provjera nacrta doplate; `selfId` je doplata koja se mijenja (null za novu), da sebe ne smatra duplikatom.
export const surchargeErrors = (
  draft: SurchargeDraft,
  surcharges: readonly Pick<Surcharge, "id" | "name">[],
  selfId: number | null
): SurchargeErrors => {
  const errors: SurchargeErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Upiši naziv, npr. Kiša.";
  else if (surcharges.some((s) => s.id !== selfId && s.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.name = "Doplata sa tim nazivom već postoji.";
  }
  if (draft.type !== "note") {
    const val = amountError(draft.val, "0,30");
    if (val) errors.val = val;
  }
  if (draft.sched === "auto") {
    if (!draft.from || !draft.to) errors.time = "Izaberi vrijeme od i do.";
    else if (draft.from === draft.to) errors.time = "Početak i kraj ne mogu biti isti.";
  }
  return errors;
};

// Ono što nacrt doplate zaista znači: skriveno polje (iznos napomene, vrijeme kad je ručno) nije izmjena.
const surchargeMeaning = (d: SurchargeDraft): unknown => {
  const parsed = parseAmount(d.val);
  return {
    name: d.name.trim(),
    desc: d.desc.trim(),
    type: d.type,
    val: d.type === "note" ? null : parsed.state === "ok" ? round2(parsed.value) : d.val.trim(),
    sched: d.sched,
    from: d.sched === "auto" ? d.from : null,
    to: d.sched === "auto" ? d.to : null,
    on: d.on,
    icon: d.icon,
    conditionTagId: d.conditionTagId,
  };
};

// Da li nacrt doplate nosi izmjenu u odnosu na početni (`original` je nacrt napravljen pri otvaranju).
export const surchargeDirty = (draft: SurchargeDraft, original: SurchargeDraft): boolean =>
  JSON.stringify(surchargeMeaning(draft)) !== JSON.stringify(surchargeMeaning(original));

// Tijelo POST/PUT doplate. Uvijek: name, description (null kad je prazan), icon, type, value (napomena je 0),
// unit (iz tipa i valute) i time_from/time_to ("HH:mm" samo za "Po vremenu", inače null da PUT očisti
// vrijeme). Samo za novu: active (D2) i condition_tag_id. PRETPOSTAVKA B2: PUT prima sva ova polja.
export type SurchargeBody = {
  name: string;
  description: string | null;
  icon: string;
  type: SurchargeType;
  value: number;
  unit: string;
  time_from: string | null;
  time_to: string | null;
  active?: boolean;
  condition_tag_id?: number | null;
};

// Pravi tijelo za slanje; baca grešku ako iznos nije ispravan (ekran zato prvo provjeri surchargeErrors).
export const toSurchargeBody = (
  draft: SurchargeDraft,
  opts: { isNew: boolean; currency?: string | null }
): SurchargeBody => {
  let value = 0;
  if (draft.type !== "note") {
    const parsed = parseAmount(draft.val);
    if (parsed.state !== "ok" || parsed.value < 0) throw new Error("Iznos doplate nije ispravan.");
    value = round2(parsed.value);
  }
  const auto = draft.sched === "auto";
  const body: SurchargeBody = {
    name: draft.name.trim(),
    description: draft.desc.trim() || null,
    icon: draft.icon || DEFAULT_SURCHARGE_ICON,
    type: draft.type,
    value,
    unit: surchargeUnit(draft.type, opts.currency),
    time_from: auto ? draft.from : null,
    time_to: auto ? draft.to : null,
  };
  if (opts.isNew) {
    body.active = draft.on;
    body.condition_tag_id = draft.conditionTagId;
  }
  return body;
};

// Uticaj doplate na primjer: napomena ne mijenja iznos; inače koliko doplata dodaje za udaljenost.
export type SurchargeImpact = { kind: "note" } | { kind: "amount"; amount: number; text: string };

// Rečenica uz napomenu (kind "note").
export const SURCHARGE_NOTE_IMPACT = "Napomena ne mijenja iznos. Služi pravilima za vozila i dispečeru.";

// Šta doplata iz nacrta znači za primjer od `distKm`; null dok iznos nije ispravan.
export const surchargeImpact = (
  draft: SurchargeDraft,
  distKm: number,
  currency?: string | null
): SurchargeImpact | null => {
  if (draft.type === "note") return { kind: "note" };
  const parsed = parseAmount(draft.val);
  if (parsed.state !== "ok" || parsed.value < 0) return null;
  const amount = round2(draft.type === "per_km" ? parsed.value * distKm : parsed.value);
  const tail = draft.on ? "Uključena je odmah." : "Ulazi u cijenu tek kad je uključiš.";
  return {
    kind: "amount",
    amount,
    text: `Za ${formatKm(distKm)} km: +${formatMoney(amount, currency)} na cijenu dostave. ${tail}`,
  };
};

// --- Pravilo ------------------------------------------------------------------------------------

// Nacrt pravila: uslov (zona, doplata ili udaljenost od/do kao tekst, ili zadano), vozila redom
// preferencije, najveći faktor terena (tekst, prazno = bez ograničenja) i napomena.
export type RuleDraft = {
  type: VehicleRuleConditionType;
  zone: number | null;
  sur: number | null;
  min: string;
  max: string;
  veh: VehicleRuleVehicle[];
  maxT: string;
  note: string;
};

// Nacrt iz postojećeg pravila (izmjena) ili prazan (null). Novo pravilo počinje kao zona, a ako zadanog
// pravila još nema, kao zadano ("Počni od njega").
export const makeRuleDraft = (rule: VehicleRule | null, opts: { hasFallback: boolean }): RuleDraft => {
  if (rule === null) {
    return {
      type: opts.hasFallback ? "zone" : "default",
      zone: null,
      sur: null,
      min: "",
      max: "",
      veh: [],
      maxT: "",
      note: "",
    };
  }
  const kind = ruleKind(rule);
  const min = toAmount(rule.min_distance_km);
  const max = toAmount(rule.max_distance_km);
  const terrain = toAmount(rule.max_terrain_factor);
  return {
    type: kind,
    zone: kind === "zone" ? (rule.zone_id ?? null) : null,
    sur: kind === "surcharge" ? (rule.surcharge_id ?? null) : null,
    min: kind === "distance" && min !== null ? formatKmShort(min) : "",
    max: kind === "distance" && max !== null ? formatKmShort(max) : "",
    veh: ruleVehicles(rule),
    maxT: terrain === null ? "" : formatTerrain(terrain),
    note: rule.note ?? "",
  };
};

// Greške polja pravila: vozila, zona, doplata, udaljenost (od/do) i faktor terena.
export type RuleErrors = { veh?: string; zone?: string; sur?: string; dist?: string; maxT?: string };

// Provjera nacrta pravila; prazan objekat znači da se može sačuvati.
export const ruleErrors = (draft: RuleDraft): RuleErrors => {
  const errors: RuleErrors = {};
  if (draft.veh.length === 0) errors.veh = "Izaberi bar jedno vozilo.";
  if (draft.type === "zone" && !draft.zone) errors.zone = "Izaberi zonu.";
  if (draft.type === "surcharge" && !draft.sur) errors.sur = "Izaberi doplatu.";
  if (draft.type === "distance") {
    const min = parseAmount(draft.min);
    const max = parseAmount(draft.max);
    if ((min.state === "empty" && max.state === "empty") || min.state === "nan" || max.state === "nan") {
      errors.dist = "Upiši bar jedno: od ili do (km), npr. 4.";
    } else if ((min.state === "ok" && min.value < 0) || (max.state === "ok" && max.value < 0)) {
      errors.dist = "Udaljenost ne može biti manja od 0.";
    } else if (min.state === "ok" && max.state === "ok" && min.value >= max.value) {
      errors.dist = "„Do“ mora biti veće od „od“.";
    }
  }
  const terrain = parseAmount(draft.maxT);
  if (terrain.state === "nan" || (terrain.state === "ok" && terrain.value < 1)) {
    errors.maxT = "Faktor terena je najmanje 1,0.";
  }
  return errors;
};

// Ono što nacrt pravila zaista znači: polja koja ne važe za izabrani uslov nisu izmjena, a redoslijed
// vozila jeste.
const ruleMeaning = (d: RuleDraft): unknown => ({
  type: d.type,
  zone: d.type === "zone" ? d.zone : null,
  sur: d.type === "surcharge" ? d.sur : null,
  min: d.type === "distance" ? (amountOrNull(d.min) ?? d.min.trim()) : null,
  max: d.type === "distance" ? (amountOrNull(d.max) ?? d.max.trim()) : null,
  veh: d.veh,
  maxT: amountOrNull(d.maxT) ?? d.maxT.trim(),
  note: d.note.trim(),
});

// Da li nacrt pravila nosi izmjenu u odnosu na početni.
export const ruleDirty = (draft: RuleDraft, original: RuleDraft): boolean =>
  JSON.stringify(ruleMeaning(draft)) !== JSON.stringify(ruleMeaning(original));

// Tijelo POST/PUT pravila: condition_text je naslov uslova, vehicle je prvo vozilo, a preferred_vehicles
// cijeli redoslijed; polja koja ne važe za tip uslova su null. Baca grešku bez vozila (ekran prvo provjeri
// ruleErrors).
export const toRuleBody = (
  draft: RuleDraft,
  priority: number,
  lookup: RuleTitleLookup
): VehicleRulePayload => {
  const first = draft.veh[0];
  if (!first) throw new Error("Pravilo mora imati bar jedno vozilo.");
  const isDistance = draft.type === "distance";
  const min = isDistance ? amountOrNull(draft.min) : null;
  const max = isDistance ? amountOrNull(draft.max) : null;
  const terrain = amountOrNull(draft.maxT);
  return {
    condition_text: conditionTitle(
      { kind: draft.type, zoneId: draft.zone, surchargeId: draft.sur, min, max },
      lookup
    ),
    vehicle: first,
    zone_id: draft.type === "zone" ? draft.zone : null,
    max_terrain_factor: terrain === null ? null : round2(terrain),
    note: draft.note.trim() || null,
    condition_type: draft.type,
    surcharge_id: draft.type === "surcharge" ? draft.sur : null,
    min_distance_km: min,
    max_distance_km: max,
    preferred_vehicles: [...draft.veh],
    priority,
  };
};

// --- Poruke servera -----------------------------------------------------------------------------

// Ključevi nacrta uz koje stoji poruka servera, po vrsti nacrta.
type PlaceKeys = {
  price: "base" | "km";
  surcharge: "name" | "desc" | "val" | "time";
  rule: "zone" | "sur" | "dist" | "veh" | "maxT";
};

// Poruke servera (errors.polje) stižu pod imenima iz API-ja; polje u formi ima drugo ime.
const SERVER_FIELD: { [K in keyof PlaceKeys]: Record<string, PlaceKeys[K]> } = {
  price: { base_price: "base", price_per_km: "km" },
  surcharge: {
    name: "name",
    value: "val",
    description: "desc",
    time_from: "time",
    time_to: "time",
  },
  rule: {
    zone_id: "zone",
    surcharge_id: "sur",
    min_distance_km: "dist",
    max_distance_km: "dist",
    preferred_vehicles: "veh",
    max_terrain_factor: "maxT",
  },
};

// Poruke servera podijeljene na one uz polje nacrta (inline) i one koje nemaju gdje (loose: tip, ikona,
// nepoznato polje), te idu u tonirani blok na vrhu. Dvije poruke za isto polje (od/do) se spajaju.
export const placeServerMessages = <K extends keyof PlaceKeys>(
  kind: K,
  fields: Record<string, string>
): { inline: Partial<Record<PlaceKeys[K], string>>; loose: string[] } => {
  const map: Record<string, PlaceKeys[K]> = SERVER_FIELD[kind];
  const inline: Partial<Record<PlaceKeys[K], string>> = {};
  const loose: string[] = [];
  for (const [apiKey, text] of Object.entries(fields)) {
    const key = Object.prototype.hasOwnProperty.call(map, apiKey) ? map[apiKey] : undefined;
    if (key === undefined) {
      loose.push(text);
      continue;
    }
    const prev = inline[key];
    inline[key] = prev === undefined ? text : prev.includes(text) ? prev : `${prev} ${text}`;
  }
  return { inline, loose };
};
