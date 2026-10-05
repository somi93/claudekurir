import { isEveryone, liveGroup, type RosterCourier } from "~/utils/courierRoster";
import { toLatin } from "~/utils/toLatin";

// Čista logika ekrana Poruke: kome ide poruka (grupe primalaca) i kako se šalje (plan slanja).
// Bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u.
//
// Primaoci su PRAVILA, ne snimci: "U dostavi" je ko je u dostavi u času slanja. Suspendovani su van
// svih grupa osim "Duguju gotovinu" (njima se i dalje šalje opomena) i "Suspendovani". Izbor je
// jedan skup id-jeva; grupe su prečice do njega.

export type PresetKey = "active" | "delivering" | "online" | "offline" | "debt" | "suspended";

// Izvor podataka od kog grupa zavisi (null = samo spisak kurira).
export type PresetSource = "locations" | "balances" | null;

export const PRESETS: Record<PresetKey, { label: string; icon: string; needs: PresetSource }> = {
  active: { label: "Svi aktivni", icon: "mdi-account-group-outline", needs: null },
  delivering: { label: "U dostavi", icon: "mdi-moped-outline", needs: "locations" },
  online: { label: "Slobodni", icon: "mdi-wifi", needs: "locations" },
  offline: { label: "Offline", icon: "mdi-wifi-off", needs: "locations" },
  debt: { label: "Duguju gotovinu", icon: "mdi-cash-multiple", needs: "balances" },
  suspended: { label: "Suspendovani", icon: "mdi-account-off-outline", needs: null },
};

export const PRESET_ORDER: PresetKey[] = ["active", "delivering", "online", "offline", "debt", "suspended"];

// Boja ikone i podloge pločice grupe.
export const PRESET_TONE: Record<PresetKey, { tint: string; ink: string }> = {
  active: { tint: "#eef4ff", ink: "#2459c7" },
  delivering: { tint: "#eef4ff", ink: "#2459c7" },
  online: { tint: "#e3f8ef", ink: "#00734f" },
  offline: { tint: "#eceff3", ink: "#5b6676" },
  debt: { tint: "#fff2df", ink: "#9a4a07" },
  suspended: { tint: "#fde8e6", ink: "#b42318" },
};

// Koji izvori trenutno rade (stanje uživo, novac).
export type SourcesOk = { locations: boolean; balances: boolean };

export const presetAvailable = (key: PresetKey, ok: SourcesOk): boolean => {
  const needs = PRESETS[key].needs;
  return needs === null || ok[needs];
};

// preset: pravilo; manual: ručno izabrani id-jevi.
export type Selection = { kind: "preset"; key: PresetKey } | { kind: "manual"; ids: ReadonlySet<number> };

export const DEFAULT_SELECTION: Selection = { kind: "preset", key: "active" };

export const inPreset = (c: RosterCourier, key: PresetKey, now: number): boolean => {
  switch (key) {
    case "active":
      return !c.suspended;
    case "delivering":
    case "online":
    case "offline":
      return !c.suspended && liveGroup(c, now) === key;
    case "debt":
      return (c.cash ?? 0) > 0;
    case "suspended":
      return c.suspended;
  }
};

export const presetCounts = (roster: RosterCourier[], now: number): Record<PresetKey, number> => {
  const out = { active: 0, delivering: 0, online: 0, offline: 0, debt: 0, suspended: 0 };
  for (const c of roster) for (const k of PRESET_ORDER) if (inPreset(c, k, now)) out[k] += 1;
  return out;
};

// Izabrana grupa čiji izvor ne radi pada na "Svi aktivni" (ne ostaje tiho prazna).
export const normalizeSelection = (sel: Selection, ok: SourcesOk): Selection =>
  sel.kind === "preset" && !presetAvailable(sel.key, ok) ? DEFAULT_SELECTION : sel;

// Kurir iz izbora koji više nije u spisku (uklonjen) ne ostaje primalac.
export const audienceOf = (roster: RosterCourier[], sel: Selection, now: number): RosterCourier[] =>
  sel.kind === "manual"
    ? roster.filter((c) => sel.ids.has(c.id))
    : roster.filter((c) => inPreset(c, sel.key, now));

// "Amir H." (ime i prvo slovo prezimena, latinicom).
const shortName = (c: RosterCourier): string => {
  const first = toLatin(c.first.trim());
  const last = toLatin(c.last.trim());
  return last ? `${first} ${last.charAt(0)}.` : first;
};

// "Amir H., Kenan M. i još 22" / "Amir H. i Kenan M." / "Amir H."
export const audienceText = (list: RosterCourier[], k = 3): string => {
  if (!list.length) return "";
  const head = list.slice(0, k).map(shortName);
  const rest = list.length - head.length;
  return rest > 0 ? `${head.join(", ")} i još ${rest}` : head.join(", ").replace(/, ([^,]*)$/, " i $1");
};

export const suspendedIn = (list: RosterCourier[]): number => list.filter((c) => c.suspended).length;

export const suspendedText = (n: number): string => `uključuje ${n} ${n === 1 ? "suspendovanog" : "suspendovana"}`;

// --- Plan slanja ----------------------------------------------------------------------------------

// Od ovoliko primalaca list traži potvrdu prije slanja.
export const CONFIRM_AT = 10;

export type SendPlan = { ids: number[]; count: number; everyone: boolean; confirm: boolean };

// Kad je izabran cijeli spisak firme šalje se all_couriers (kao i do sada), inače izričit spisak id-jeva.
export const sendPlan = (roster: RosterCourier[], list: RosterCourier[]): SendPlan => {
  const ids = list.map((c) => c.id);
  return { ids, count: ids.length, everyone: isEveryone(ids, roster), confirm: ids.length >= CONFIRM_AT };
};

// Naziv publike za karticu "Poslato": ime kurira, naziv grupe ili "Ručno izabrani".
export const audienceLabel = (plan: SendPlan, sel: Selection, list: RosterCourier[]): string => {
  if (plan.count === 1) return list[0]?.name ?? `#${plan.ids[0]}`;
  if (sel.kind === "preset") return PRESETS[sel.key].label;
  return plan.everyone ? "Svi kuriri" : "Ručno izabrani";
};
