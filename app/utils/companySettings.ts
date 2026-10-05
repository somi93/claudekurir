import { summarizeCashLimit } from "~/utils/cashLimit";
import { formatAmount, resolveCurrency, toAmount } from "~/utils/currency";
import { pluralizeSr } from "~/utils/datetime";
import { toLatin } from "~/utils/toLatin";
import type { FieldMsg, ShowFn } from "~/utils/profileForm";
import type { CourierBalance } from "~/types/courier-balance";
import type {
  AssignmentCourierPool,
  AssignmentMode,
  AssignmentTimeoutAction,
  CashLimitEnforcement,
  FinanceSettings,
  FinanceSettingsUpdate,
} from "~/types/finance-settings";

// Čista logika postavki firme (bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u): koje
// postavke postoje i kako se grupišu, nacrt jednog editora, provjere polja, tijelo koje ide
// serveru i tekst reda u listi. Ekran ne mijenja šta backend prima: PATCH i dalje nosi svih 11
// polja (stanje iz spremišta + izmijenjena polja), jer djelimično tijelo nije potvrđeno.

export type SettingKind =
  | "limit"
  | "handover"
  | "payout"
  | "mode"
  | "pool"
  | "price"
  | "currency";

export type SettingMeta = {
  title: string;
  sub: string;
  icon: string;
};

export const SETTING_META: Record<SettingKind, SettingMeta> = {
  limit: {
    title: "Limit gotovine",
    sub: "Koliko novca kurir smije držati prije predaje",
    icon: "mdi-cash-multiple",
  },
  handover: {
    title: "Predaja gotovine",
    sub: "Dnevno vrijeme predaje",
    icon: "mdi-clock-outline",
  },
  payout: {
    title: "Isplata zarade",
    sub: "Koliko često se kuriru isplaćuje",
    icon: "mdi-calendar-check-outline",
  },
  mode: {
    title: "Način dodjele",
    sub: "Ko dobija ponudu kad stigne nova narudžba",
    icon: "mdi-map-marker-radius-outline",
  },
  pool: {
    title: "Koje kurire uzeti u obzir",
    sub: "Skup kurira za dodjelu",
    icon: "mdi-account-group-outline",
  },
  price: {
    title: "Cijena dostave",
    sub: "Šta kupac vidi prije potvrde narudžbe",
    icon: "mdi-receipt",
  },
  currency: {
    title: "Valuta firme",
    sub: "Prikazuje se uz sve iznose",
    icon: "mdi-currency-usd",
  },
};

export const SETTING_GROUPS: { key: string; title: string; kinds: SettingKind[] }[] = [
  { key: "cash", title: "Gotovina", kinds: ["limit", "handover", "payout"] },
  { key: "assign", title: "Dodjela narudžbi", kinds: ["mode", "pool"] },
  { key: "customer", title: "Kupac vidi", kinds: ["price"] },
  { key: "firm", title: "Firma", kinds: ["currency"] },
];

// --- Nacrt ------------------------------------------------------------------------------------

export type PayoutChoice = "1" | "7" | "15" | "other";

// Jedan ravan nacrt za sve editore: forme čitaju samo svoja polja (DRAFT_KEYS). Brojevi su tekst
// jer se kucaju; pretvaraju se tek pri provjeri i slanju.
export type SettingDraft = {
  limitOn: boolean;
  limit: string;
  enforcement: CashLimitEnforcement;
  handover: string;
  payout: PayoutChoice;
  payoutOther: string;
  mode: AssignmentMode;
  count: string;
  timeout: string;
  action: AssignmentTimeoutAction;
  pool: AssignmentCourierPool;
  breakdown: boolean;
  currency: string;
};

export type DraftKey = keyof SettingDraft;

export const DRAFT_KEYS: Record<SettingKind, DraftKey[]> = {
  limit: ["limitOn", "limit", "enforcement"],
  handover: ["handover"],
  payout: ["payout", "payoutOther"],
  mode: ["mode", "count", "timeout", "action"],
  pool: ["pool"],
  price: ["breakdown"],
  currency: ["currency"],
};

const PRESET_DAYS = [1, 7, 15];
const DEFAULT_COUNT = 3;
const DEFAULT_TIMEOUT = 20;

// "Čekanje odgovora" postoji samo kad ponuda ne ide svima odjednom.
export const needsTimeout = (mode: AssignmentMode): boolean =>
  mode === "NEAREST" || mode === "TOP_N";

export const makeDraft = (saved: FinanceSettings): SettingDraft => {
  const days = Number(saved.payout_period_days);
  const preset = PRESET_DAYS.includes(days);
  const limit = saved.cash_limit_amount;
  return {
    // null = bez limita; 0 je stroga vrijednost, ne "bez limita".
    limitOn: limit !== null && limit !== undefined,
    limit: limit !== null && limit !== undefined ? String(limit) : "",
    enforcement: saved.cash_limit_enforcement,
    handover: saved.daily_handover_time?.slice(0, 5) ?? "",
    payout: preset ? (String(days) as PayoutChoice) : "other",
    payoutOther: preset ? "" : String(saved.payout_period_days ?? ""),
    mode: saved.assignment_mode ?? "ALL",
    count: String(saved.assignment_courier_count ?? DEFAULT_COUNT),
    timeout: String(saved.offer_timeout_seconds ?? DEFAULT_TIMEOUT),
    action: saved.assignment_timeout_action ?? "NEXT_NEAREST",
    pool: saved.assignment_courier_pool ?? "ALL_ACTIVE",
    breakdown: saved.show_price_breakdown ?? true,
    currency: resolveCurrency(saved.currency),
  };
};

// Ono što nacrt zaista znači: skriveno polje (iznos kad je limit isključen, broj kurira kad nije
// "Prvih N") ne čini izmjenu, a "Drugo = 7" je isto što i "Svake sedmice".
const meaning = (kind: SettingKind, d: SettingDraft): unknown => {
  switch (kind) {
    case "limit":
      return d.limitOn
        ? { on: true, amount: toAmount(d.limit) ?? d.limit.trim(), enforcement: d.enforcement }
        : { on: false };
    case "handover":
      return d.handover.trim();
    case "payout":
      return d.payout === "other" ? d.payoutOther.trim() : d.payout;
    case "mode":
      return {
        mode: d.mode,
        count: d.mode === "TOP_N" ? d.count.trim() : null,
        timeout: needsTimeout(d.mode) ? d.timeout.trim() : null,
        action: needsTimeout(d.mode) ? d.action : null,
      };
    case "pool":
      return d.pool;
    case "price":
      return d.breakdown;
    case "currency":
      return d.currency;
  }
};

export const isSettingDirty = (kind: SettingKind, draft: SettingDraft, saved: FinanceSettings): boolean =>
  JSON.stringify(meaning(kind, draft)) !== JSON.stringify(meaning(kind, makeDraft(saved)));

// --- Provjere -----------------------------------------------------------------------------------

export type SettingCheck = {
  fields: Partial<Record<DraftKey, FieldMsg>>;
  // Smije li se snimiti (neispravno polje blokira).
  valid: boolean;
  dirty: boolean;
};

export const LIMIT_EMPTY = "Unesi iznos. 0 znači da kurir ne smije držati nikakvu gotovinu.";

const wholeNumber = (text: string): number | null => {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
};

export const checkSetting = (
  kind: SettingKind,
  draft: SettingDraft,
  saved: FinanceSettings,
  show: ShowFn
): SettingCheck => {
  const fields: SettingCheck["fields"] = {};
  let valid = true;
  // Greška se pokazuje tek kad je polje napušteno ili je pokušano snimanje; do tada samo blokira.
  const bad = (key: DraftKey, text: string) => {
    valid = false;
    if (show(key)) fields[key] = { tone: "bad", text };
  };

  if (kind === "limit" && draft.limitOn) {
    const text = draft.limit.trim();
    if (text === "") bad("limit", LIMIT_EMPTY);
    else {
      const amount = toAmount(text);
      if (amount === null || amount < 0) bad("limit", "Unesi iznos veći ili jednak 0.");
    }
  }

  if (kind === "payout" && draft.payout === "other") {
    const days = wholeNumber(draft.payoutOther);
    if (days === null || days < 1) bad("payoutOther", "Unesi cijeli broj dana, najmanje 1.");
  }

  if (kind === "mode") {
    if (draft.mode === "TOP_N") {
      const n = wholeNumber(draft.count);
      if (n === null || n < 1 || n > 50) bad("count", "Unesi cijeli broj od 1 do 50.");
    }
    if (needsTimeout(draft.mode)) {
      const s = wholeNumber(draft.timeout);
      if (s === null || s < 5 || s > 120) bad("timeout", "Unesi vrijeme od 5 do 120 sekundi.");
    }
  }

  return { fields, valid, dirty: isSettingDirty(kind, draft, saved) };
};

// --- Šta ide serveru ----------------------------------------------------------------------------

// Samo polja ovog editora; ostalih deset ide iz sačuvanog stanja (vidi useFinanceSettings).
// Skrivena zavisna polja se ne dira: timeout i akcija ostaju kakvi jesu kad ponuda ide svima, a
// broj kurira je null kad način nije "Prvih N" (isto pravilo kao i do sada).
export const toPatch = (kind: SettingKind, d: SettingDraft): Partial<FinanceSettingsUpdate> => {
  switch (kind) {
    case "limit":
      return d.limitOn
        ? {
            cash_limit_amount: toAmount(d.limit) ?? 0,
            cash_limit_enforcement: d.enforcement,
          }
        : { cash_limit_amount: null };
    case "handover":
      return { daily_handover_time: d.handover.trim() || null };
    case "payout":
      return {
        payout_period_days: d.payout === "other" ? Number(d.payoutOther.trim()) : Number(d.payout),
      };
    case "mode":
      return {
        assignment_mode: d.mode,
        assignment_courier_count: d.mode === "TOP_N" ? Number(d.count.trim()) : null,
        ...(needsTimeout(d.mode)
          ? { offer_timeout_seconds: Number(d.timeout.trim()), assignment_timeout_action: d.action }
          : {}),
      };
    case "pool":
      return { assignment_courier_pool: d.pool };
    case "price":
      return { show_price_breakdown: d.breakdown };
    case "currency":
      return { currency: d.currency };
  }
};

// Cijelo tijelo PATCH-a: sačuvano stanje + polja izmijenjenog editora. Broj kurira je null kad
// način nije "Prvih N" (validaciono pravilo iz Uputstva 02.09); polja sa backend podrazumijevanom
// vrijednošću uvijek idu s vrijednošću.
export const buildFinanceBody = (
  saved: FinanceSettings,
  patch: Partial<FinanceSettingsUpdate>
): FinanceSettingsUpdate => {
  const body: FinanceSettingsUpdate = {
    cash_limit_amount: saved.cash_limit_amount,
    cash_limit_enforcement: saved.cash_limit_enforcement,
    payout_period_days: saved.payout_period_days,
    currency: resolveCurrency(saved.currency),
    daily_handover_time: saved.daily_handover_time || null,
    assignment_mode: saved.assignment_mode ?? "ALL",
    assignment_courier_count: saved.assignment_courier_count ?? null,
    assignment_timeout_action: saved.assignment_timeout_action ?? "NEXT_NEAREST",
    assignment_courier_pool: saved.assignment_courier_pool ?? "ALL_ACTIVE",
    offer_timeout_seconds: saved.offer_timeout_seconds ?? null,
    show_price_breakdown: saved.show_price_breakdown ?? true,
    ...patch,
  };
  if (body.assignment_mode !== "TOP_N") body.assignment_courier_count = null;
  return body;
};

// Poruke servera (errors.polje) stižu pod imenima iz API-ja; polje u formi ima drugo ime.
export const SERVER_FIELD: Record<string, DraftKey> = {
  cash_limit_amount: "limit",
  cash_limit_enforcement: "enforcement",
  payout_period_days: "payoutOther",
  currency: "currency",
  daily_handover_time: "handover",
  assignment_mode: "mode",
  assignment_courier_count: "count",
  assignment_timeout_action: "action",
  assignment_courier_pool: "pool",
  offer_timeout_seconds: "timeout",
  show_price_breakdown: "breakdown",
};

const INLINE_KEYS: DraftKey[] = ["limit", "handover", "payoutOther", "count", "timeout"];

// Da li polje trenutno ima mjesto za poruku uz sebe.
const hasInlineSlot = (key: DraftKey, d: SettingDraft): boolean => {
  if (!INLINE_KEYS.includes(key)) return false;
  if (key === "limit") return d.limitOn;
  if (key === "payoutOther") return d.payout === "other";
  if (key === "count") return d.mode === "TOP_N";
  if (key === "timeout") return needsTimeout(d.mode);
  return true;
};

// Poruke servera podijeljene na one koje stoje uz polje i one koje nemaju gdje: izbor kartica i
// skriveno polje nemaju poruku uz sebe, pa idu u tonirani blok na vrhu.
export const placeServerMessages = (
  apiFields: Record<string, string>,
  draft: SettingDraft
): { inline: Partial<Record<DraftKey, string>>; loose: string[] } => {
  const inline: Partial<Record<DraftKey, string>> = {};
  const loose: string[] = [];
  for (const [apiKey, text] of Object.entries(apiFields)) {
    const key = SERVER_FIELD[apiKey];
    if (key && hasInlineSlot(key, draft)) inline[key] = text;
    else loose.push(text);
  }
  return { inline, loose };
};

// --- Izbori -------------------------------------------------------------------------------------

export type Option<V extends string = string> = { value: V; label: string; hint?: string };

export const ENFORCEMENT_OPTIONS: Option<CashLimitEnforcement>[] = [
  { value: "NOTIFY_ONLY", label: "Samo obavijesti", hint: "Kurir i dalje prima narudžbe." },
  {
    value: "BLOCK",
    label: "Blokiraj nove narudžbe",
    hint: "Ne može da prihvati ponudu dok ne preda gotovinu.",
  },
];

export const PAYOUT_OPTIONS: Option<PayoutChoice>[] = [
  { value: "1", label: "Svaki dan" },
  { value: "7", label: "Svake sedmice" },
  { value: "15", label: "Svakih 15 dana" },
  { value: "other", label: "Drugo" },
];

// BEST_MATCH je stara vrijednost: nudi se samo firmi koja je već ima, da je PATCH ne izgubi.
export const modeOptions = (saved: FinanceSettings | null): Option<AssignmentMode>[] => {
  const base: Option<AssignmentMode>[] = [
    { value: "ALL", label: "Svi kuriri istovremeno", hint: "Prvi koji prihvati dobija narudžbu." },
    {
      value: "NEAREST",
      label: "Najbliži kurir prvi",
      hint: "Ako ne odgovori, ponuda ide dalje.",
    },
    {
      value: "TOP_N",
      label: "Prvih N najbližih istovremeno",
      hint: "Prvi koji prihvati dobija narudžbu.",
    },
  ];
  if (saved?.assignment_mode === "BEST_MATCH") {
    base.push({
      value: "BEST_MATCH",
      label: "Najbolji kurir (stara postavka)",
      hint: "Zadržana dok je ne promijeniš na neki od novih načina.",
    });
  }
  return base;
};

export const TIMEOUT_ACTION_OPTIONS: Option<AssignmentTimeoutAction>[] = [
  { value: "NEXT_NEAREST", label: "Šalji sljedećem najbližem" },
  { value: "OPEN_TO_ALL", label: "Otvori svim kuririma" },
];

export const POOL_OPTIONS: Option<AssignmentCourierPool>[] = [
  {
    value: "ALL_ACTIVE",
    label: "Svi aktivni kuriri firme",
    hint: "Bez provjere da su označili „dostupan za rad“.",
  },
  {
    value: "AVAILABLE_NOW",
    label: "Samo dostupni za rad",
    hint: "Kuriri koji su se označili kao dostupni.",
  },
  {
    value: "SCHEDULED_SHIFT",
    label: "Samo sa prijavljenom smjenom",
    hint: "Prema planu angažovanja za ovo vrijeme.",
  },
];

// Šta će se desiti pri novoj narudžbi, na osnovu onoga što je trenutno u formi.
export const explainMode = (d: SettingDraft, countValid: boolean, timeoutValid: boolean): string => {
  if (d.mode === "ALL") {
    return "Nova narudžba odmah ide svim kuririma iz skupa. Dobija je prvi koji prihvati.";
  }
  if (d.mode === "BEST_MATCH") {
    return "Stara postavka: sistem bira najboljeg kurira. Ne mijenja se dok je ne zamijeniš novim načinom.";
  }
  const first =
    d.mode === "NEAREST"
      ? "Nova narudžba ide najbližem kuriru."
      : `Nova narudžba ide ${countValid ? d.count.trim() : "N"} najbližih kurira istovremeno.`;
  const wait = timeoutValid ? d.timeout.trim() : "…";
  const then = d.action === "OPEN_TO_ALL" ? "otvara se svim kuririma." : "ide sljedećem najbližem.";
  return `${first} Ako niko ne odgovori za ${wait} s, ${then}`;
};

// --- Uticaj limita ------------------------------------------------------------------------------

export type CashRowView = {
  id: number;
  name: string;
  owed: number;
  level: "ok" | "near" | "over";
  percent: number;
};

export type CashImpact = {
  tone: "warn" | "bad" | "info" | "ok";
  icon: string;
  title: string;
  body: string;
  rows: CashRowView[];
};

const nameOf = (b: CourierBalance): string => toLatin(b.name) || `Kurir #${b.courier_id}`;

// Ko drži gotovinu: samo pozitivan dug firmi se računa u limit (negativan saldo ne "puni" limit).
const holdersOf = (balances: CourierBalance[]): CourierBalance[] =>
  balances
    .filter((b) => toAmount(b.cash_owed_to_company) !== null && Number(b.cash_owed_to_company) > 0)
    .sort((a, b) => Number(b.cash_owed_to_company) - Number(a.cash_owed_to_company));

// Prebrojavanje za red u listi ("2 kurira su preko limita"); null kad se stanje ne zna.
export const overLimitCount = (balances: CourierBalance[] | null, limit: number | null): number | null => {
  if (balances === null || limit === null) return null;
  return holdersOf(balances).filter(
    (b) => summarizeCashLimit(Number(b.cash_owed_to_company), limit).state === "over"
  ).length;
};

// Posljedica limita koji se upravo kuca, nad stanjem kurira (couriers-balance): koliko ih je odmah
// preko, koliko blizu i šta im se tada dešava. Isto pravilo kao Novčanik i Kuriri (summarizeCashLimit).
// null kad iznos još nije ispravan.
export const describeCashImpact = (
  balances: CourierBalance[],
  draft: Pick<SettingDraft, "limitOn" | "limit" | "enforcement">,
  currency: string
): CashImpact | null => {
  const cur = resolveCurrency(currency);
  const holders = holdersOf(balances);

  if (!draft.limitOn) {
    if (holders.length === 0) {
      return {
        tone: "info",
        icon: "mdi-information-outline",
        title: "Bez limita",
        body: "Niko od kurira trenutno ne drži gotovinu. Ništa ih ne bi zaustavilo da drže koliko god.",
        rows: [],
      };
    }
    const total = holders.reduce((sum, b) => sum + Number(b.cash_owed_to_company), 0);
    const top = holders[0]!;
    return {
      tone: "info",
      icon: "mdi-information-outline",
      title: "Bez limita",
      body: `Kuriri sada drže ukupno ${formatAmount(total, cur)}, najviše ${nameOf(top)} (${formatAmount(
        Number(top.cash_owed_to_company),
        cur
      )}). Ništa ih ne zaustavlja da drže i više.`,
      rows: [],
    };
  }

  const limit = toAmount(draft.limit);
  if (limit === null || limit < 0) return null;

  const view = (b: CourierBalance): CashRowView => {
    const owed = Number(b.cash_owed_to_company);
    const s = summarizeCashLimit(owed, limit);
    return { id: b.courier_id, name: nameOf(b), owed, level: s.state, percent: s.percent };
  };
  const all = holders.map(view);
  const over = all.filter((r) => r.level === "over");
  const near = all.filter((r) => r.level === "near");
  const rows = [...over, ...near].slice(0, 4);
  const block = draft.enforcement === "BLOCK";
  const amount = formatAmount(limit, cur);

  if (limit === 0) {
    if (holders.length === 0) {
      return {
        tone: "bad",
        icon: "mdi-alert-circle-outline",
        title: `0 ${cur} znači da kurir ne smije držati nikakvu gotovinu`,
        body: "Trenutno niko ne drži gotovinu, pa se ništa ne mijenja odmah. Čim neko primi pazar, bit će preko limita.",
        rows,
      };
    }
    return {
      tone: "bad",
      icon: "mdi-alert-circle-outline",
      title: block
        ? `0 ${cur} blokira svakoga ko drži ijedan iznos`
        : `0 ${cur} znači da je svako ko drži gotovinu preko limita`,
      body: `${
        block
          ? `Sada bi ${holders.length} od ${balances.length} kurira odmah ostalo bez novih narudžbi.`
          : `Sada bi ${holders.length} od ${balances.length} kurira bilo preko limita.`
      } Ako je to namjera, u redu je. Ako nije, upiši veći iznos.`,
      rows,
    };
  }

  const nearText = near.length
    ? over.length
      ? `, ${near.length} blizu`
      : `, ${near.length} ${near.length === 1 ? "je" : "su"} blizu`
    : "";
  const title = over.length
    ? `Sa ${amount}: ${over.length} ${pluralizeSr(over.length, "kurir je", "kurira su", "kurira je")} odmah preko limita${nearText}`
    : `Sa ${amount} niko nije preko limita${nearText}`;
  const effect = block
    ? "Preko limita ne mogu da prihvate novu narudžbu dok ne predaju gotovinu."
    : "Preko limita i dalje primaju narudžbe.";

  return {
    tone: over.length ? (block ? "warn" : "info") : near.length ? "info" : "ok",
    icon: over.length ? "mdi-alert-outline" : "mdi-check-circle-outline",
    title,
    body: effect,
    rows,
  };
};

// --- Upozorenje o valuti ------------------------------------------------------------------------

// "Iznosi se ne preračunavaju": šta se desi kad se valuta promijeni, uz broj restorana u drugoj
// valuti. `saved` je sačuvana valuta (uporedba ide s njom, ne s izabranom).
export const describeCurrencyChange = (
  picked: string,
  saved: FinanceSettings,
  restaurantsOther: number | null,
  restaurantsTotal: number | null
): { title: string; body: string } | null => {
  const current = resolveCurrency(saved.currency);
  if (picked === current) return null;
  const limit = saved.cash_limit_amount;
  const limitText =
    limit !== null && limit !== undefined
      ? ` Limit gotovine od ${limit} ${current} postaje ${limit} ${picked}.`
      : "";
  const restaurants =
    restaurantsOther !== null && restaurantsTotal !== null && restaurantsOther > 0
      ? ` ${restaurantsOther} od ${restaurantsTotal} restorana koristi drugu valutu.`
      : "";
  return {
    title: "Iznosi se ne preračunavaju",
    body: `Cijene i limit ostaju isti brojevi.${limitText}${restaurants}`,
  };
};

// --- Redovi u listi -----------------------------------------------------------------------------

export type RowTag = { tone: "bad" | "warn" | "info"; text: string; icon?: string };

export type RowView = {
  label: string;
  value: string;
  empty?: boolean;
  hint?: string;
  tag?: RowTag | null;
};

export type RowContext = {
  // Koliko kurira je preko sačuvanog limita; null dok se stanje ne zna.
  overLimit: number | null;
  // Koliko restorana koristi valutu različitu od sačuvane; null dok se lista ne zna.
  otherCurrency: number | null;
};

export const payoutText = (days: number): string =>
  days === 1 ? "Svaki dan" : days === 7 ? "Svake sedmice" : `Svakih ${days} dana`;

export const modeText = (s: FinanceSettings): string => {
  const mode = s.assignment_mode ?? "ALL";
  const wait = s.offer_timeout_seconds ?? DEFAULT_TIMEOUT;
  if (mode === "NEAREST") return `Najbliži kurir prvi · ${wait} s`;
  if (mode === "TOP_N") return `Prvih ${s.assignment_courier_count ?? DEFAULT_COUNT} najbližih · ${wait} s`;
  if (mode === "BEST_MATCH") return "Najbolji kurir (stara postavka)";
  return "Svi kuriri istovremeno";
};

const POOL_TEXT: Record<AssignmentCourierPool, string> = {
  ALL_ACTIVE: "Svi aktivni kuriri",
  AVAILABLE_NOW: "Samo dostupni za rad",
  SCHEDULED_SHIFT: "Samo sa prijavljenom smjenom",
};

export const rowView = (kind: SettingKind, s: FinanceSettings, ctx: RowContext): RowView => {
  const label = SETTING_META[kind].title;
  const cur = resolveCurrency(s.currency);
  switch (kind) {
    case "limit": {
      const limit = s.cash_limit_amount;
      if (limit === null || limit === undefined) return { label, value: "Bez limita" };
      const over = ctx.overLimit ?? 0;
      return {
        label,
        value: `${formatAmount(Number(limit), cur)} · ${
          s.cash_limit_enforcement === "BLOCK" ? "blokira nove narudžbe" : "samo obavještava"
        }`,
        tag: over
          ? {
              tone: "bad",
              icon: "mdi-cash-multiple",
              text: `${over} ${pluralizeSr(over, "kurir je", "kurira su", "kurira je")} preko limita`,
            }
          : null,
      };
    }
    case "handover": {
      const time = s.daily_handover_time?.slice(0, 5);
      return time
        ? { label, value: `Svaki dan u ${time}` }
        : { label, value: "Vrijeme nije određeno", empty: true };
    }
    case "payout":
      return { label, value: payoutText(Number(s.payout_period_days)) };
    case "mode":
      return { label, value: modeText(s) };
    case "pool":
      return { label, value: POOL_TEXT[s.assignment_courier_pool ?? "ALL_ACTIVE"] };
    case "price":
      return {
        label,
        value: (s.show_price_breakdown ?? true) ? "Detaljan raspis" : "Samo ukupan iznos",
      };
    case "currency": {
      const other = ctx.otherCurrency ?? 0;
      return {
        label,
        value: cur,
        tag: other
          ? {
              tone: "warn",
              icon: "mdi-alert-outline",
              text: `${other} ${pluralizeSr(other, "restoran", "restorana", "restorana")} u drugoj valuti`,
            }
          : null,
      };
    }
  }
};

export const commissionText = (s: FinanceSettings): string =>
  s.commission_percentage === null || s.commission_percentage === undefined
    ? "Nije postavljena"
    : `${s.commission_percentage} %`;
