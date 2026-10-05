// Provjera čiste logike stranice Cjenovnik (utils/pricing.ts, utils/pricingDrafts.ts) u običnom Node-u:
// TypeScript se prevede u privremeni folder, alias "~/" se preusmjeri na njega.
// Pokretanje iz korijena aplikacije: node docs/2026/10/cjenovnik-prototip/e2e/logic-pricing.mjs
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");
const out = mkdtempSync(join(tmpdir(), "cjenovnik-logic-"));

const compiled = new Set();
const compile = (rel) => {
  if (compiled.has(rel)) return;
  compiled.add(rel);
  const src = readFileSync(join(root, "app", rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const dest = join(out, rel.replace(/\.ts$/, ".mjs"));
  mkdirSync(dirname(dest), { recursive: true });
  const fixed = js.replace(/from "~\/([^"]+)"/g, (_, p) => {
    compile(`${p}.ts`);
    let r = relative(dirname(dest), join(out, `${p}.mjs`));
    if (!r.startsWith(".")) r = `./${r}`;
    return `from "${r}"`;
  });
  writeFileSync(dest, fixed);
};
compile("utils/pricing.ts");
compile("utils/pricingDrafts.ts");

const pr = await import(join(out, "utils/pricing.mjs"));
const pd = await import(join(out, "utils/pricingDrafts.mjs"));

let n = 0;
const ok = (name, fn) => {
  fn();
  n += 1;
  console.log(`  ok  ${name}`);
};

// --- Podaci kao iz API-ja -------------------------------------------------------------------------

const NOW = Date.parse("2026-10-05T12:00:00Z");
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString();

const S = (id, name, type, value, over = {}) => ({
  id,
  delivery_company_id: 24,
  name,
  description: null,
  icon: null,
  type,
  value,
  unit: null,
  time_from: null,
  time_to: null,
  active: false,
  activated_at: null,
  condition_tag: null,
  ...over,
});
const surcharges = () => [
  S(501, "Kiša", "per_km", 0.3, { active: true, activated_at: minutesAgo(72), icon: "ti-cloud-rain" }),
  S(502, "Noćna dostava", "fixed", 1.5, { time_from: "22:00:00", time_to: "06:00:00" }),
  S(503, "Gužva", "fixed", 1),
  S(504, "Centar grada", "note", 0, { active: true }),
  S(505, "Praznik", "fixed", 2),
];

const Z = (id, name, terrainFactor) => ({ id, name, terrainFactor });
const zones = [Z(11, "Centar", 1.0), Z(12, "Starčevica", 1.4), Z(13, "Lauš", 1.1), Z(14, "Obilićevo", 1.0)];

const R = (id, over = {}) => ({
  id,
  delivery_company_id: 24,
  condition_text: "",
  vehicle: "car",
  zone_id: null,
  max_terrain_factor: null,
  note: null,
  ...over,
});
const rules = () => [
  R(701, { condition_type: "surcharge", surcharge_id: 501, preferred_vehicles: ["car", "motorbike"], priority: 1, note: "Kiša: biciklisti ne voze." }),
  R(702, { condition_type: "zone", zone_id: 12, max_terrain_factor: 1.6, vehicle: "motorbike", preferred_vehicles: ["motorbike", "car"], priority: 2, note: "Brdovit teren." }),
  R(703, { condition_type: "zone", zone_id: 11, vehicle: "bicycle", preferred_vehicles: ["bicycle", "walk", "motorbike"], priority: 3 }),
  R(704, { condition_type: "distance", min_distance_km: 4, max_distance_km: null, preferred_vehicles: ["car", "motorbike"], priority: 4 }),
  R(705, { condition_type: "default", vehicle: "motorbike", preferred_vehicles: ["motorbike", "bicycle", "car"], priority: 5 }),
];
const ids = (list) => list.map((r) => r.id);
const cfg = { base: 2.5, km: 0.8 };
const lookup = { zones, surcharges: surcharges() };
const ctx = (over = {}) => ({ zoneId: null, distKm: 4.5, active: pr.activeOf(surcharges()), zones, ...over });
const without = (over) => pr.activeWithOverrides(surcharges(), over);

console.log("brojevi");
ok('parseAmount: "2,5" i "2.5" su 2.5', () => {
  assert.deepEqual(pr.parseAmount("2,5"), { state: "ok", value: 2.5 });
  assert.deepEqual(pr.parseAmount("2.5"), { state: "ok", value: 2.5 });
  assert.deepEqual(pr.parseAmount("  2,50 "), { state: "ok", value: 2.5 });
});
ok("parseAmount: slova su nan", () => {
  assert.deepEqual(pr.parseAmount("abc"), { state: "nan" });
  assert.deepEqual(pr.parseAmount("2,50 KM"), { state: "nan" });
});
ok("parseAmount: prazno i razmaci su empty", () => {
  assert.deepEqual(pr.parseAmount(""), { state: "empty" });
  assert.deepEqual(pr.parseAmount("   "), { state: "empty" });
  assert.deepEqual(pr.parseAmount(null), { state: "empty" });
  assert.deepEqual(pr.parseAmount(undefined), { state: "empty" });
});
ok("parseAmount: negativan je broj (greška je posao provjere)", () => {
  assert.deepEqual(pr.parseAmount("-1,5"), { state: "ok", value: -1.5 });
  assert.deepEqual(pr.parseAmount("-0"), { state: "ok", value: -0 });
});
ok("parseAmount: eksponent, heksa i više zareza nisu iznos", () => {
  assert.equal(pr.parseAmount("1e3").state, "nan");
  assert.equal(pr.parseAmount("0x10").state, "nan");
  assert.equal(pr.parseAmount("1,2,3").state, "nan");
  assert.equal(pr.parseAmount("1.234,5").state, "nan");
  assert.equal(pr.parseAmount("Infinity").state, "nan");
  assert.equal(pr.parseAmount("-").state, "nan");
  assert.equal(pr.parseAmount(".").state, "nan");
});
ok('parseAmount: ".5" i "2," su važeći', () => {
  assert.deepEqual(pr.parseAmount(".5"), { state: "ok", value: 0.5 });
  assert.deepEqual(pr.parseAmount("2,"), { state: "ok", value: 2 });
});
ok("round2: pola naviše, bez greške pomične tačke", () => {
  assert.equal(pr.round2(1.005), 1.01);
  assert.equal(pr.round2(2.675), 2.68);
  assert.equal(pr.round2(0.1 + 0.2), 0.3);
  assert.equal(pr.round2(4.5 * 0.8), 3.6);
  assert.equal(pr.round2(-1.005), -1.01);
  assert.equal(pr.round2(1.4985), 1.5);
});
ok("round2: sitan negativan broj je 0, ne -0", () => {
  assert.ok(Object.is(pr.round2(-0.001), 0));
});
ok("formatNum2: dvije decimale i zarez", () => {
  assert.equal(pr.formatNum2(2.5), "2,50");
  assert.equal(pr.formatNum2(0), "0,00");
  assert.equal(pr.formatNum2(6.1), "6,10");
  assert.equal(pr.formatNum2(7.45), "7,45");
  assert.equal(pr.formatNum2(12), "12,00");
  assert.equal(pr.formatNum2(1234.5), "1234,50");
  assert.equal(pr.formatNum2(-0.3), "-0,30");
});
ok("formatKm: jedna decimala sa zarezom", () => {
  assert.equal(pr.formatKm(4.5), "4,5");
  assert.equal(pr.formatKm(4), "4,0");
  assert.equal(pr.formatKm(0.5), "0,5");
  assert.equal(pr.formatKm(15), "15,0");
});
ok("formatKmShort: bez nepotrebne nule", () => {
  assert.equal(pr.formatKmShort(4), "4");
  assert.equal(pr.formatKmShort(4.5), "4,5");
  assert.equal(pr.formatKmShort(4.25), "4,25");
});
ok("formatMoney: iznos i valuta, KM kad valute nema", () => {
  assert.equal(pr.formatMoney(2.5, "KM"), "2,50 KM");
  assert.equal(pr.formatMoney(2.5), "2,50 KM");
  assert.equal(pr.formatMoney(2.5, null), "2,50 KM");
  assert.equal(pr.formatMoney(2.5, " EUR "), "2,50 EUR");
});
ok("stepAmount: korak sa zarezom, najmanje 0, dvije decimale", () => {
  assert.equal(pr.stepAmount("2,50", 1, 0.1, 0), "2,60");
  assert.equal(pr.stepAmount("0,80", 1, 0.05, 0), "0,85");
  assert.equal(pr.stepAmount("0,80", -1, 0.05, 0), "0,75");
  assert.equal(pr.stepAmount("0,00", -1, 0.05, 0), "0,00");
  assert.equal(pr.stepAmount("0,03", -1, 0.05, 0), "0,00");
  assert.equal(pr.stepAmount("2,5", 1, 0.1, 0), "2,60");
});
ok("stepAmount: prazno ili slova kreću od zadate vrijednosti", () => {
  assert.equal(pr.stepAmount("", 1, 0.1, 2.5), "2,60");
  assert.equal(pr.stepAmount("abc", -1, 0.05, 0.8), "0,75");
});
ok("formatDuration: min, h min, d", () => {
  assert.equal(pr.formatDuration(45), "45 min");
  assert.equal(pr.formatDuration(72), "1 h 12 min");
  assert.equal(pr.formatDuration(2880), "2 d");
  assert.equal(pr.formatDuration(1440), "1 d");
  assert.equal(pr.formatDuration(2600), "1 d");
});
ok("formatDuration: ivice (0, puni sat, negativno, razlomak)", () => {
  assert.equal(pr.formatDuration(0), "0 min");
  assert.equal(pr.formatDuration(60), "1 h");
  assert.equal(pr.formatDuration(-5), "0 min");
  assert.equal(pr.formatDuration(59.9), "59 min");
});
ok("formatTerrain i clockText", () => {
  assert.equal(pr.formatTerrain(1.6), "1,6");
  assert.equal(pr.formatTerrain(1), "1,0");
  assert.equal(pr.formatTerrain(1.25), "1,25");
  assert.equal(pr.clockText("22:00:00"), "22:00");
  assert.equal(pr.clockText(null), "");
});

console.log("obračun");
ok("primjer sa table: 2,50 + 4,5 km × 0,80 = 6,10", () => {
  const c = pr.calcPrice(4.5, cfg, surcharges(), {});
  assert.equal(c.base, 2.5);
  assert.equal(c.perKm, 3.6);
  assert.deepEqual(c.lines, []);
  assert.equal(c.surchargeTotal, 0);
  assert.equal(c.total, 6.1);
});
ok("sa Kišom 0,30/km: 7,45", () => {
  const c = pr.calcPrice(4.5, cfg, surcharges(), pr.activeOf(surcharges()));
  assert.deepEqual(c.lines, [{ id: 501, name: "Kiša", amount: 1.35 }]);
  assert.equal(c.surchargeTotal, 1.35);
  assert.equal(c.total, 7.45);
});
ok("fiksna doplata se ne množi kilometrima", () => {
  assert.equal(pr.calcPrice(4.5, cfg, surcharges(), { 503: true }).total, 7.1);
  assert.equal(pr.calcPrice(12, cfg, surcharges(), { 503: true }).lines[0].amount, 1);
});
ok("napomena se ne računa ni kad je uključena", () => {
  const c = pr.calcPrice(4.5, cfg, surcharges(), { 504: true });
  assert.deepEqual(c.lines, []);
  assert.equal(c.total, 6.1);
});
ok("isključene doplate se ne računaju", () => {
  const c = pr.calcPrice(4.5, cfg, surcharges(), { 501: false, 502: false });
  assert.equal(c.total, 6.1);
  assert.equal(pr.calcPrice(4.5, cfg, surcharges(), {}).total, 6.1);
});
ok("više doplata: Kiša 1,35 + Gužva 1 + Noć 1,5 = 9,95", () => {
  const c = pr.calcPrice(4.5, cfg, surcharges(), { 501: true, 503: true, 502: true });
  assert.deepEqual(c.lines.map((l) => l.amount), [1.35, 1.5, 1]);
  assert.equal(c.surchargeTotal, 3.85);
  assert.equal(c.total, 9.95);
});
ok("iznosi iz API-ja kao tekst (Laravel decimal)", () => {
  const s = [S(1, "Kiša", "per_km", "0.30"), S(2, "Gužva", "fixed", "1,00")];
  const c = pr.calcPrice(4.5, cfg, s, { 1: true, 2: true });
  assert.equal(c.total, 8.45);
});
ok("svaka stavka se zaokružuje posebno", () => {
  const c = pr.calcPrice(4.5, cfg, [S(1, "X", "per_km", 0.333)], { 1: true });
  assert.equal(c.lines[0].amount, 1.5);
  assert.equal(c.total, 7.6);
});
ok("doplata bez iznosa ne daje NaN", () => {
  const c = pr.calcPrice(4.5, cfg, [S(1, "X", "fixed", null)], { 1: true });
  assert.equal(c.total, 6.1);
});
ok("activeOf i activeWithOverrides", () => {
  const s = surcharges();
  assert.deepEqual(pr.activeOf(s), { 501: true, 502: false, 503: false, 504: true, 505: false });
  assert.equal(pr.activeWithOverrides(s, {})[501], true);
  assert.equal(pr.activeWithOverrides(s, { 501: false })[501], false);
  assert.equal(pr.activeWithOverrides(s, { 503: true })[503], true);
  assert.equal(pr.activeWithOverrides(s, { 503: true })[505], false);
});
ok("surchargeUnit prati tip i valutu", () => {
  assert.equal(pr.surchargeUnit("per_km", "KM"), "KM/km");
  assert.equal(pr.surchargeUnit("fixed", "KM"), "KM");
  assert.equal(pr.surchargeUnit("note", "KM"), "prilagođeno vozilo");
  assert.equal(pr.surchargeUnit("per_km", "EUR"), "EUR/km");
  assert.equal(pr.surchargeUnit("fixed", null), "KM");
});
ok('surchargeSummary: "+0,30 KM/km", "+1,50 KM", "Samo napomena"', () => {
  assert.equal(pr.surchargeSummary(S(1, "a", "per_km", 0.3), "KM"), "+0,30 KM/km");
  assert.equal(pr.surchargeSummary(S(1, "a", "fixed", 1.5), "KM"), "+1,50 KM");
  assert.equal(pr.surchargeSummary(S(1, "a", "note", 0), "KM"), "Samo napomena");
  assert.equal(pr.surchargeSummary(S(1, "a", "per_km", "0.30"), "EUR"), "+0,30 EUR/km");
});
ok('surchargeScheduleText: "Ručno" ili "Automatski 22:00–06:00"', () => {
  const [kisa, noc] = surcharges();
  assert.equal(pr.surchargeScheduleText(kisa), "Ručno");
  assert.equal(pr.surchargeScheduleText(noc), "Automatski 22:00–06:00");
  assert.equal(pr.surchargeScheduleText(S(1, "a", "fixed", 1, { time_from: "22:00" })), "Ručno");
});
ok('surchargeStatus: "Na snazi 1 h 12 min" iz activated_at', () => {
  const st = pr.surchargeStatus(surcharges()[0], NOW);
  assert.deepEqual(st, { tone: "on", text: "Na snazi 1 h 12 min" });
});
ok('surchargeStatus: bez activated_at samo "Na snazi"', () => {
  assert.deepEqual(pr.surchargeStatus(S(1, "a", "fixed", 1, { active: true }), NOW), { tone: "on", text: "Na snazi" });
  assert.deepEqual(pr.surchargeStatus(S(1, "a", "fixed", 1, { active: true, activated_at: "nije datum" }), NOW), { tone: "on", text: "Na snazi" });
});
ok('surchargeStatus: tek uključena (0 min) je "Na snazi"; dani su "2 d"', () => {
  assert.equal(pr.surchargeStatus(S(1, "a", "fixed", 1, { active: true, activated_at: minutesAgo(0) }), NOW).text, "Na snazi");
  assert.equal(pr.surchargeStatus(S(1, "a", "fixed", 1, { active: true, activated_at: minutesAgo(2900) }), NOW).text, "Na snazi 2 d");
});
ok('surchargeStatus: "Uključuje se u 22:00" i "Isključena"', () => {
  const [, noc, guzva] = surcharges();
  assert.deepEqual(pr.surchargeStatus(noc, NOW), { tone: "auto", text: "Uključuje se u 22:00" });
  assert.deepEqual(pr.surchargeStatus(guzva, NOW), { tone: "off", text: "Isključena" });
});

console.log("pravila: tip, vozila, redoslijed");
ok("ruleKind: upisan condition_type ima prednost", () => {
  assert.equal(pr.ruleKind(R(1, { condition_type: "surcharge", zone_id: 5 })), "surcharge");
});
ok("ruleKind: za stara pravila se izvodi iz polja", () => {
  assert.equal(pr.ruleKind(R(1, { zone_id: 11 })), "zone");
  assert.equal(pr.ruleKind(R(1, { min_distance_km: 4 })), "distance");
  assert.equal(pr.ruleKind(R(1, { max_distance_km: 4 })), "distance");
  assert.equal(pr.ruleKind(R(1, { surcharge_id: 501 })), "surcharge");
  assert.equal(pr.ruleKind(R(1)), "default");
  assert.equal(pr.ruleKind(R(1, { zone_id: undefined })), "default");
});
ok("ruleVehicles: preferred_vehicles, inače [vehicle]", () => {
  assert.deepEqual(pr.ruleVehicles(R(1, { preferred_vehicles: ["walk", "car"] })), ["walk", "car"]);
  assert.deepEqual(pr.ruleVehicles(R(1, { vehicle: "bicycle" })), ["bicycle"]);
  assert.deepEqual(pr.ruleVehicles(R(1, { vehicle: "bicycle", preferred_vehicles: [] })), ["bicycle"]);
});
ok("ruleVehicles vraća kopiju, ne sam niz iz pravila", () => {
  const rule = R(1, { preferred_vehicles: ["car"] });
  pr.ruleVehicles(rule).push("walk");
  assert.deepEqual(rule.preferred_vehicles, ["car"]);
});
ok("splitRules: lista po priority, zadano posebno", () => {
  const shuffled = [rules()[3], rules()[4], rules()[0], rules()[2], rules()[1]];
  const { list, fallback } = pr.splitRules(shuffled);
  assert.deepEqual(ids(list), [701, 702, 703, 704]);
  assert.equal(fallback.id, 705);
});
ok("splitRules: default sa NIŽIM priority od ostalih je ipak zadnji", () => {
  const api = rules().map((r) => ({ ...r, priority: r.condition_type === "default" ? 1 : r.priority + 1 }));
  const { list, fallback } = pr.splitRules(api);
  assert.deepEqual(ids(list), [701, 702, 703, 704]);
  assert.equal(fallback.id, 705);
});
ok("splitRules: dupli priority se rješavaju po id-u", () => {
  const api = [R(30, { priority: 2 }), R(10, { priority: 2, zone_id: 1 }), R(20, { priority: 1, zone_id: 2 }), R(99, { priority: 2, condition_type: "default" })];
  const { list, fallback } = pr.splitRules(api);
  assert.deepEqual(ids(list), [20, 10, 30]);
  assert.equal(fallback.id, 99);
});
ok("splitRules: bez zadanog pravila fallback je null", () => {
  const { list, fallback } = pr.splitRules(rules().slice(0, 4));
  assert.equal(fallback, null);
  assert.equal(list.length, 4);
  assert.deepEqual(pr.splitRules([]), { list: [], fallback: null });
});
ok("splitRules: pravila bez priority ostaju redom iz odgovora", () => {
  const api = [R(5, { zone_id: 1 }), R(4, { zone_id: 2 }), R(3, { zone_id: 3 })];
  assert.deepEqual(ids(pr.splitRules(api).list), [5, 4, 3]);
});
ok("splitRules: dva zadana, posljednje je zadano, ranije ostaje u listi", () => {
  const api = [R(1, { priority: 1, condition_type: "default" }), R(2, { priority: 2, zone_id: 1 }), R(3, { priority: 3, condition_type: "default" })];
  const { list, fallback } = pr.splitRules(api);
  assert.equal(fallback.id, 3);
  assert.deepEqual(ids(list), [1, 2]);
});
ok("splitRules ne mijenja ulazni niz", () => {
  const api = [rules()[4], rules()[0]];
  pr.splitRules(api);
  assert.deepEqual(ids(api), [705, 701]);
});

console.log("pravila: poklapanje i preporuka");
ok("ruleMatches: zadano pravilo se uvijek poklapa", () => {
  assert.equal(pr.ruleMatches(rules()[4], ctx()), true);
});
ok("ruleMatches: zona, samo kad je ta zona izabrana", () => {
  assert.equal(pr.ruleMatches(rules()[2], ctx({ zoneId: 11 })), true);
  assert.equal(pr.ruleMatches(rules()[2], ctx({ zoneId: 12 })), false);
  assert.equal(pr.ruleMatches(rules()[2], ctx({ zoneId: null })), false);
});
ok("ruleMatches: doplata, samo kad je uključena", () => {
  assert.equal(pr.ruleMatches(rules()[0], ctx()), true);
  assert.equal(pr.ruleMatches(rules()[0], ctx({ active: without({ 501: false }) })), false);
  assert.equal(pr.ruleMatches(R(1, { condition_type: "surcharge", surcharge_id: null }), ctx()), false);
});
ok("ruleMatches: udaljenost od (uključivo)", () => {
  assert.equal(pr.ruleMatches(rules()[3], ctx({ distKm: 4 })), true);
  assert.equal(pr.ruleMatches(rules()[3], ctx({ distKm: 3.5 })), false);
  assert.equal(pr.ruleMatches(rules()[3], ctx({ distKm: 15 })), true);
});
ok("ruleMatches: udaljenost do i raspon", () => {
  const upTo = R(1, { condition_type: "distance", max_distance_km: 4 });
  assert.equal(pr.ruleMatches(upTo, ctx({ distKm: 4 })), true);
  assert.equal(pr.ruleMatches(upTo, ctx({ distKm: 4.5 })), false);
  const range = R(2, { condition_type: "distance", min_distance_km: "4.00", max_distance_km: "8.00" });
  assert.equal(pr.ruleMatches(range, ctx({ distKm: 5 })), true);
  assert.equal(pr.ruleMatches(range, ctx({ distKm: 9 })), false);
  assert.equal(pr.ruleMatches(range, ctx({ distKm: 3 })), false);
});
ok("ruleMatches: udaljenost bez ijedne granice ne poklapa ništa", () => {
  assert.equal(pr.ruleMatches(R(1, { condition_type: "distance" }), ctx()), false);
});
ok("ruleMatches: najveći faktor terena isključuje preteške zone", () => {
  const r = R(1, { condition_type: "zone", zone_id: 12, max_terrain_factor: 1.2 });
  assert.equal(pr.ruleMatches(r, ctx({ zoneId: 12 })), false);
  const ok2 = R(2, { condition_type: "zone", zone_id: 11, max_terrain_factor: 1.2 });
  assert.equal(pr.ruleMatches(ok2, ctx({ zoneId: 11 })), true);
  assert.equal(pr.ruleMatches(rules()[1], ctx({ zoneId: 12 })), true); // 1,4 <= 1,6
});
ok("ruleMatches: faktor terena kao tekst iz API-ja", () => {
  const r = R(1, { condition_type: "zone", zone_id: 12, max_terrain_factor: "1.20" });
  assert.equal(pr.ruleMatches(r, ctx({ zoneId: 12 })), false);
  assert.equal(pr.ruleMatches(R(2, { condition_type: "zone", zone_id: 12, max_terrain_factor: "1.60" }), ctx({ zoneId: 12 })), true);
});
ok("ruleMatches: terenski faktor važi i za druge tipove i za zadano, ali ne za zonu 'Svejedno'", () => {
  const dist = R(1, { condition_type: "distance", min_distance_km: 1, max_terrain_factor: 1.2 });
  assert.equal(pr.ruleMatches(dist, ctx({ zoneId: 12 })), false);
  assert.equal(pr.ruleMatches(dist, ctx({ zoneId: null })), true);
  assert.equal(pr.ruleMatches(R(2, { condition_type: "default", max_terrain_factor: 1.2 }), ctx({ zoneId: 12 })), false);
});
ok("recommendRule: prvo poklapanje odozgo (Kiša je na snazi)", () => {
  const rec = pr.recommendRule(rules(), ctx());
  assert.equal(rec.rule.id, 701);
  assert.equal(rec.index, 0);
});
ok('recommendRule: "šta ako" bez Kiše pada na udaljenost', () => {
  const rec = pr.recommendRule(rules(), ctx({ active: without({ 501: false }) }));
  assert.equal(rec.rule.id, 704);
  assert.equal(rec.index, 3);
});
ok('recommendRule: "šta ako" uključena doplata mijenja izbor', () => {
  const rs = [...rules().slice(0, 4), R(706, { condition_type: "surcharge", surcharge_id: 503, priority: 1.5, preferred_vehicles: ["walk"] }), rules()[4]];
  const off = pr.recommendRule(rs, ctx({ distKm: 2, zoneId: null, active: without({ 501: false }) }));
  assert.equal(off.index, -1);
  const on = pr.recommendRule(rs, ctx({ distKm: 2, zoneId: null, active: without({ 501: false, 503: true }) }));
  assert.equal(on.rule.id, 706);
});
ok("recommendRule: ništa se ne poklopi, vrati zadano (index -1)", () => {
  const rec = pr.recommendRule(rules(), ctx({ distKm: 2, active: without({ 501: false }) }));
  assert.equal(rec.rule.id, 705);
  assert.equal(rec.index, -1);
});
ok("recommendRule: zona bira svoje pravilo", () => {
  const off = without({ 501: false });
  assert.equal(pr.recommendRule(rules(), ctx({ zoneId: 11, distKm: 2, active: off })).rule.id, 703);
  assert.equal(pr.recommendRule(rules(), ctx({ zoneId: 12, distKm: 2, active: off })).rule.id, 702);
  assert.equal(pr.recommendRule(rules(), ctx({ zoneId: 11, distKm: 2, active: off })).index, 2);
});
ok("recommendRule: zona sa preteškim terenom preskače pravilo", () => {
  const api = rules().map((r) => (r.id === 702 ? { ...r, max_terrain_factor: 1.2 } : r));
  const rec = pr.recommendRule(api, ctx({ zoneId: 12, distKm: 2, active: without({ 501: false }) }));
  assert.equal(rec.rule.id, 705);
});
ok('recommendRule: zona "Svejedno" ne provjerava teren', () => {
  const api = [R(1, { condition_type: "distance", min_distance_km: 1, max_terrain_factor: 1.0, priority: 1 }), rules()[4]];
  assert.equal(pr.recommendRule(api, ctx({ zoneId: null, distKm: 3 })).rule.id, 1);
});
ok("recommendRule: bez pravila je null, bez zadanog i bez poklapanja je null", () => {
  assert.equal(pr.recommendRule([], ctx()), null);
  assert.equal(pr.recommendRule(rules().slice(0, 4), ctx({ distKm: 2, active: without({ 501: false }) })), null);
});
ok("recommendRule: zadano sa nižim priority ne pretiče pravila iznad", () => {
  const api = rules().map((r) => ({ ...r, priority: r.condition_type === "default" ? 1 : r.priority + 1 }));
  assert.equal(pr.recommendRule(api, ctx()).rule.id, 701);
  assert.equal(pr.recommendRule(api, ctx({ distKm: 2, active: without({ 501: false }) })).rule.id, 705);
});

console.log("pravila: naslovi, korištenje, duplikati");
ok("ruleTitle: zona i doplata", () => {
  assert.equal(pr.ruleTitle(rules()[2], lookup), "Zona: Centar");
  assert.equal(pr.ruleTitle(rules()[0], lookup), "Doplata: Kiša");
});
ok("ruleTitle: obrisana doplata", () => {
  assert.equal(pr.ruleTitle(R(1, { condition_type: "surcharge", surcharge_id: 999 }), lookup), "Doplata: (obrisana doplata)");
  assert.equal(pr.ruleTitle(R(1, { condition_type: "surcharge", surcharge_id: null }), lookup), "Doplata: (obrisana doplata)");
});
ok("ruleTitle: udaljenost, raspon, preko i do", () => {
  const d = (min, max) => R(1, { condition_type: "distance", min_distance_km: min, max_distance_km: max });
  assert.equal(pr.ruleTitle(d(4, 8), lookup), "Udaljenost 4–8 km");
  assert.equal(pr.ruleTitle(d(4, null), lookup), "Udaljenost preko 4 km");
  assert.equal(pr.ruleTitle(d(null, 4), lookup), "Udaljenost do 4 km");
  assert.equal(pr.ruleTitle(d("4.50", "8.00"), lookup), "Udaljenost 4,5–8 km");
  assert.equal(pr.ruleTitle(d(null, null), lookup), "Udaljenost");
});
ok('ruleTitle: zadano je "Sve ostalo", nepoznata zona koristi condition_text', () => {
  assert.equal(pr.ruleTitle(rules()[4], lookup), "Sve ostalo");
  assert.equal(pr.ruleTitle(R(1, { condition_type: "default", condition_text: "Uvijek" }), lookup), "Sve ostalo");
  assert.equal(pr.ruleTitle(R(1, { condition_type: "zone", zone_id: 99, condition_text: " Stari Grad " }), lookup), "Stari Grad");
  assert.equal(pr.ruleTitle(R(1, { condition_type: "zone", zone_id: 99 }), lookup), "Zona: ?");
});
ok("ruleKindLabel", () => {
  assert.equal(pr.ruleKindLabel("zone"), "Zona");
  assert.equal(pr.ruleKindLabel("surcharge"), "Doplata");
  assert.equal(pr.ruleKindLabel("distance"), "Udaljenost");
  assert.equal(pr.ruleKindLabel("default"), "");
});
ok("rulesUsingSurcharge: samo pravila te doplate, redom primjene", () => {
  assert.deepEqual(ids(pr.rulesUsingSurcharge(rules(), 501)), [701]);
  assert.deepEqual(ids(pr.rulesUsingSurcharge(rules(), 502)), []);
  const more = [...rules(), R(706, { condition_type: "surcharge", surcharge_id: 501, priority: 0 })];
  assert.deepEqual(ids(pr.rulesUsingSurcharge(more, 501)), [706, 701]);
});
ok("rulesUsingSurcharge: pravilo drugog tipa sa starim surcharge_id ne računa", () => {
  assert.deepEqual(pr.rulesUsingSurcharge([R(1, { condition_type: "zone", zone_id: 1, surcharge_id: 501 })], 501), []);
});
const like = (over) => ({ type: "zone", zone: null, sur: null, min: "", max: "", ...over });
ok("findDuplicateRule: ista zona kao ranije pravilo (pozicija od 1)", () => {
  assert.equal(pr.findDuplicateRule(like({ type: "zone", zone: 12 }), rules(), null), 2);
  assert.equal(pr.findDuplicateRule(like({ type: "zone", zone: 13 }), rules(), null), 0);
  assert.equal(pr.findDuplicateRule(like({ type: "zone", zone: null }), rules(), null), 0);
});
ok("findDuplicateRule: ista doplata", () => {
  assert.equal(pr.findDuplicateRule(like({ type: "surcharge", sur: 501 }), rules(), null), 1);
  assert.equal(pr.findDuplicateRule(like({ type: "surcharge", sur: 503 }), rules(), null), 0);
});
ok("findDuplicateRule: ista udaljenost, zarez i tačka su isto", () => {
  assert.equal(pr.findDuplicateRule(like({ type: "distance", min: "4" }), rules(), null), 4);
  assert.equal(pr.findDuplicateRule(like({ type: "distance", min: "4,0" }), rules(), null), 4);
  assert.equal(pr.findDuplicateRule(like({ type: "distance", min: "4", max: "8" }), rules(), null), 0);
  assert.equal(pr.findDuplicateRule(like({ type: "distance" }), rules(), null), 0);
});
ok("findDuplicateRule: pravilo ne smatra sebe duplikatom, zadano nikad", () => {
  assert.equal(pr.findDuplicateRule(like({ type: "zone", zone: 12 }), rules(), 702), 0);
  assert.equal(pr.findDuplicateRule(like({ type: "default" }), rules(), null), 0);
});
ok("findDuplicateRule: pravilo koje se mijenja gleda samo pravila iznad sebe", () => {
  const api = [...rules(), R(706, { condition_type: "zone", zone_id: 12, priority: 6 })];
  // 706 je iza 702: pri izmjeni 706 upozorenje je za 702; pri izmjeni 702 ga nema
  assert.equal(pr.findDuplicateRule(like({ type: "zone", zone: 12 }), api, 706), 2);
  assert.equal(pr.findDuplicateRule(like({ type: "zone", zone: 12 }), api, 702), 0);
});

console.log("redoslijed pravila");
// Primijeni plan i vrati pravila kakva bi bila na serveru.
const applyChanges = (rs, changes) =>
  rs.map((r) => {
    const c = changes.find((x) => x.id === r.id);
    return c ? { ...r, priority: c.priority } : r;
  });
// Redoslijed koji bi dao server: po priority rastuće, tie po id-u (sva pravila zajedno, zadano nije izdvojeno).
const serverOrder = (rs) => ids([...rs].sort((a, b) => a.priority - b.priority || a.id - b.id));
const withPriority = (r, priority) => ({ ...r, priority });

ok("planNewRule: iza svih pravila, zadano se pomjera za jedan", () => {
  assert.deepEqual(pr.planNewRule(rules()), { priority: 5, shiftFallback: { id: 705, priority: 6 } });
});
ok("planNewRule: zadano koje je već daleko iza se ne dira", () => {
  const api = rules().map((r) => (r.id === 705 ? { ...r, priority: 100 } : r));
  assert.deepEqual(pr.planNewRule(api), { priority: 5, shiftFallback: null });
});
ok("planNewRule: zadano sa nižim priority od ostalih ide iza novog", () => {
  const api = rules().map((r) => ({ ...r, priority: r.condition_type === "default" ? 1 : r.priority + 1 }));
  assert.deepEqual(pr.planNewRule(api), { priority: 6, shiftFallback: { id: 705, priority: 7 } });
});
ok("planNewRule: dupli priority", () => {
  const api = [R(1, { priority: 1, zone_id: 1 }), R(2, { priority: 1, zone_id: 2 }), R(3, { priority: 2, zone_id: 3 }), R(9, { priority: 3, condition_type: "default" })];
  assert.deepEqual(pr.planNewRule(api), { priority: 4, shiftFallback: { id: 9, priority: 5 } });
});
ok("planNewRule: priority nisu počeli od 1 (10, 20), zadano 30 ostaje iza novog", () => {
  const api = [R(1, { priority: 10, zone_id: 1 }), R(2, { priority: 20, zone_id: 2 }), R(9, { priority: 30, condition_type: "default" })];
  assert.deepEqual(pr.planNewRule(api), { priority: 21, shiftFallback: null });
});
ok("planNewRule: zadano sa istim priority kao zadnje pravilo se pomjera", () => {
  const api = [R(1, { priority: 10, zone_id: 1 }), R(2, { priority: 20, zone_id: 2 }), R(9, { priority: 20, condition_type: "default" })];
  assert.deepEqual(pr.planNewRule(api), { priority: 21, shiftFallback: { id: 9, priority: 22 } });
});
ok("planNewRule: bez zadanog pravila nema pomjeranja", () => {
  assert.deepEqual(pr.planNewRule(rules().slice(0, 4)), { priority: 5, shiftFallback: null });
});
ok("planNewRule: prazna lista", () => {
  assert.deepEqual(pr.planNewRule([]), { priority: 1, shiftFallback: null });
  assert.deepEqual(pr.planNewRule([R(9, { priority: 1, condition_type: "default" })]), { priority: 1, shiftFallback: { id: 9, priority: 2 } });
});
ok("planNewRule: pravila bez priority", () => {
  const api = [R(1, { zone_id: 1 }), R(2, { zone_id: 2 }), R(3, { zone_id: 3 }), R(9, { condition_type: "default" })];
  assert.deepEqual(pr.planNewRule(api), { priority: 4, shiftFallback: { id: 9, priority: 5 } });
});
ok("planMove: gore i dolje mijenja priority dva susjeda", () => {
  assert.deepEqual(pr.planMove(rules(), 702, -1), { a: { id: 702, priority: 1 }, b: { id: 701, priority: 2 }, others: [] });
  assert.deepEqual(pr.planMove(rules(), 703, 1), { a: { id: 703, priority: 4 }, b: { id: 704, priority: 3 }, others: [] });
});
ok("planMove: rub liste, zadano i nepoznato pravilo nemaju pomjeranja", () => {
  assert.equal(pr.planMove(rules(), 701, -1), null);
  assert.equal(pr.planMove(rules(), 704, 1), null);
  assert.equal(pr.planMove(rules(), 705, -1), null);
  assert.equal(pr.planMove(rules(), 999, 1), null);
});
ok("planMove: priority koji nisu 1..n (10, 20, 30) se samo zamijene", () => {
  const api = [R(1, { priority: 10, zone_id: 1 }), R(2, { priority: 20, zone_id: 2 }), R(3, { priority: 30, zone_id: 3 }), R(9, { priority: 40, condition_type: "default" })];
  assert.deepEqual(pr.planMove(api, 3, -1), { a: { id: 3, priority: 20 }, b: { id: 2, priority: 30 }, others: [] });
});
ok("planMove: zadano sa nižim priority se usput stavlja iza svih", () => {
  const api = rules().map((r) => ({ ...r, priority: r.condition_type === "default" ? 1 : r.priority + 1 }));
  const plan = pr.planMove(api, 702, -1);
  assert.deepEqual(plan.a, { id: 702, priority: 2 });
  assert.deepEqual(plan.b, { id: 701, priority: 3 });
  assert.deepEqual(plan.others, [{ id: 705, priority: 6 }]);
});
ok("planMove: dupli priority se numerišu po mjestu", () => {
  const api = [R(1, { priority: 1, zone_id: 1 }), R(2, { priority: 1, zone_id: 2 }), R(3, { priority: 2, zone_id: 3 }), R(9, { priority: 3, condition_type: "default" })];
  const plan = pr.planMove(api, 2, -1);
  assert.deepEqual(plan.a, { id: 2, priority: 1 });
  assert.deepEqual(plan.b, { id: 1, priority: 2 });
  assert.deepEqual(plan.others, [{ id: 3, priority: 3 }, { id: 9, priority: 4 }]);
  assert.deepEqual(serverOrder(applyChanges(api, [plan.a, plan.b, ...plan.others])), [2, 1, 3, 9]);
});
ok("planMove: pravila bez priority se numerišu po mjestu", () => {
  const api = [R(1, { zone_id: 1 }), R(2, { zone_id: 2 }), R(3, { zone_id: 3 }), R(9, { condition_type: "default" })];
  const plan = pr.planMove(api, 3, -1);
  assert.deepEqual(serverOrder(applyChanges(api, [plan.a, plan.b, ...plan.others])), [1, 3, 2, 9]);
});
ok("planMove: dva pomjeranja zaredom (poslije prvog su priority uređeni)", () => {
  let api = [R(1, { priority: 1, zone_id: 1 }), R(2, { priority: 1, zone_id: 2 }), R(3, { priority: 1, zone_id: 3 }), R(9, { priority: 1, condition_type: "default" })];
  const p1 = pr.planMove(api, 3, -1);
  api = applyChanges(api, [p1.a, p1.b, ...p1.others]);
  assert.deepEqual(serverOrder(api), [1, 3, 2, 9]);
  const p2 = pr.planMove(api, 3, -1);
  api = applyChanges(api, [p2.a, p2.b, ...p2.others]);
  assert.deepEqual(p2.others, []);
  assert.deepEqual(serverOrder(api), [3, 1, 2, 9]);
});

// Mali deterministički generator da provjera ne zavisi od sreće.
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const randomRules = (rand, withDefault = true) => {
  const count = 1 + Math.floor(rand() * 6);
  const list = [];
  for (let i = 0; i < count; i++) list.push(R(100 + i, { condition_type: "zone", zone_id: i + 1, priority: 1 + Math.floor(rand() * 4) }));
  if (withDefault) list.push(R(900, { condition_type: "default", priority: 1 + Math.floor(rand() * 8) }));
  return list.sort(() => rand() - 0.5);
};
ok("planMove: za 300 nasumičnih lista redoslijed poslije plana je tačna zamjena", () => {
  const rand = rng(7);
  for (let t = 0; t < 300; t++) {
    const rs = randomRules(rand);
    const { list } = pr.splitRules(rs);
    if (list.length < 2) continue;
    const i = Math.floor(rand() * list.length);
    const dir = rand() < 0.5 ? -1 : 1;
    const plan = pr.planMove(rs, list[i].id, dir);
    const j = i + dir;
    if (j < 0 || j >= list.length) {
      assert.equal(plan, null);
      continue;
    }
    const expected = ids(list);
    [expected[i], expected[j]] = [expected[j], expected[i]];
    const after = applyChanges(rs, [plan.a, plan.b, ...plan.others]);
    assert.deepEqual(serverOrder(after), [...expected, 900], JSON.stringify(rs));
  }
});
ok("planNewRule: za 300 nasumičnih lista novo pravilo je zadnje u listi, ispred zadanog", () => {
  const rand = rng(11);
  for (let t = 0; t < 300; t++) {
    const rs = randomRules(rand, rand() < 0.8);
    const { list, fallback } = pr.splitRules(rs);
    const plan = pr.planNewRule(rs);
    const created = R(1000, { condition_type: "zone", zone_id: 77, priority: plan.priority });
    const after = applyChanges([...rs, created], plan.shiftFallback ? [plan.shiftFallback] : []);
    const expected = [...ids(list), 1000, ...(fallback ? [fallback.id] : [])];
    assert.deepEqual(serverOrder(after), expected, JSON.stringify(rs));
  }
});

console.log("tabela cijena");
ok("konstante primjera", () => {
  assert.deepEqual([...pr.sampleDistances], [1, 2, 3, 5, 8, 12]);
  assert.equal(pr.SIM_MIN, 0.5);
  assert.equal(pr.SIM_MAX, 15);
  assert.equal(pr.SIM_STEP, 0.5);
});
ok("clampDist: granice i korak od 0,5", () => {
  assert.equal(pr.clampDist(0), 0.5);
  assert.equal(pr.clampDist(-3), 0.5);
  assert.equal(pr.clampDist(99), 15);
  assert.equal(pr.clampDist(4.7), 4.5);
  assert.equal(pr.clampDist(4.8), 5);
  assert.equal(pr.clampDist(4.5), 4.5);
  assert.equal(pr.clampDist(Number.NaN), 4.5);
});
ok("ladderRows: bez izmjene nema promjene, startna + km po udaljenosti", () => {
  const rows = pr.ladderRows(pr.sampleDistances, cfg, cfg, surcharges(), pr.activeOf(surcharges()), 4.5);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => !r.changed && !r.up && r.before === r.after));
  assert.equal(rows[3].dist, 5);
  assert.equal(rows[3].startPlusKm, 6.5);
  assert.equal(rows[3].after, 6.5 + 1.5);
});
ok("ladderRows: nacrt 0,85 po km poskupljuje svaki red", () => {
  const rows = pr.ladderRows(pr.sampleDistances, cfg, { base: 2.5, km: 0.85 }, surcharges(), {}, 4.5);
  assert.ok(rows.every((r) => r.changed && r.up));
  assert.equal(rows[0].before, 3.3);
  assert.equal(rows[0].after, 3.35);
  assert.equal(rows[5].startPlusKm, 12.7);
});
ok("ladderRows: pojeftinjenje nije up; doplate su u ukupnom iznosu", () => {
  const rows = pr.ladderRows([5], cfg, { base: 2, km: 0.8 }, surcharges(), { 501: true }, 5);
  assert.equal(rows[0].changed, true);
  assert.equal(rows[0].up, false);
  assert.equal(rows[0].before, 2.5 + 4 + 1.5);
  assert.equal(rows[0].after, 2 + 4 + 1.5);
});
ok("ladderRows: current je red najbliži primjeru (razlika manja od 0,5)", () => {
  const rows = pr.ladderRows(pr.sampleDistances, cfg, cfg, [], {}, 3.2);
  assert.deepEqual(rows.filter((r) => r.current).map((r) => r.dist), [3]);
  assert.equal(pr.ladderRows(pr.sampleDistances, cfg, cfg, [], {}, 4.5).filter((r) => r.current).length, 0);
});

console.log("cijena: nacrt i provjere");
const price = { delivery_company_id: 24, base_price: 2.5, price_per_km: 0.8, currency: "KM" };
ok("makePriceDraft: tekst sa zarezom, i iz brojeva kao tekst", () => {
  assert.deepEqual(pd.makePriceDraft(price), { base: "2,50", km: "0,80" });
  assert.deepEqual(pd.makePriceDraft({ ...price, base_price: "3.00", price_per_km: "0.30" }), { base: "3,00", km: "0,30" });
});
ok("priceErrors: prazno, slova, negativno", () => {
  assert.deepEqual(pd.priceErrors({ base: "", km: "" }), { base: "Unesi iznos, npr. 2,50.", km: "Unesi iznos, npr. 0,80." });
  assert.deepEqual(pd.priceErrors({ base: "abc", km: "x" }), { base: "Unesi broj, npr. 2,50.", km: "Unesi broj, npr. 0,80." });
  assert.deepEqual(pd.priceErrors({ base: "-1", km: "-0,5" }), { base: "Iznos ne može biti manji od 0.", km: "Iznos ne može biti manji od 0." });
});
ok("priceErrors: ispravno i nula nemaju grešku", () => {
  assert.deepEqual(pd.priceErrors({ base: "2,50", km: "0,80" }), {});
  assert.deepEqual(pd.priceErrors({ base: "0", km: "0,00" }), {});
  assert.deepEqual(pd.priceErrors({ base: "  ", km: "0,8" }), { base: "Unesi iznos, npr. 2,50." });
});
ok("priceNumbers: važeći uneseni, inače sačuvani", () => {
  assert.deepEqual(pd.priceNumbers({ base: "3,10", km: "0,90" }, price), { base: 3.1, km: 0.9 });
  assert.deepEqual(pd.priceNumbers({ base: "", km: "abc" }, price), { base: 2.5, km: 0.8 });
  assert.deepEqual(pd.priceNumbers({ base: "-1", km: "1" }, price), { base: 2.5, km: 1 });
});
ok("priceNumbers: dvije decimale", () => {
  assert.deepEqual(pd.priceNumbers({ base: "2,505", km: "0,8" }, price), { base: 2.51, km: 0.8 });
});
ok("priceDirty: isti iznos nije izmjena ni sa drugačijim zapisom", () => {
  assert.equal(pd.priceDirty({ base: "2,50", km: "0,80" }, price), false);
  assert.equal(pd.priceDirty({ base: "2,5", km: "0,8" }, price), false);
  assert.equal(pd.priceDirty({ base: "2.50", km: "0.80" }, price), false);
});
ok("priceDirty: izmjena, prazno i slova su izmjena", () => {
  assert.equal(pd.priceDirty({ base: "2,60", km: "0,80" }, price), true);
  assert.equal(pd.priceDirty({ base: "2,50", km: "" }, price), true);
  assert.equal(pd.priceDirty({ base: "abc", km: "0,80" }, price), true);
  assert.deepEqual(pd.priceDirtyFields({ base: "2,50", km: "0,85" }, price), { base: false, km: true });
});
ok("priceSanity: 0,80 na 8,00 daje upozorenje sa primjerom za 10 km", () => {
  const text = pd.priceSanity({ base: "2,50", km: "8,00" }, price, "KM");
  assert.match(text, /Cijena po kilometru raste za 900 %\./);
  assert.match(text, /Za 10 km to je 82,50 KM\./);
  assert.match(text, /provjeri zarez\.$/);
});
ok("priceSanity: 0,80 na 0,85 nema upozorenja", () => {
  assert.equal(pd.priceSanity({ base: "2,50", km: "0,85" }, price, "KM"), null);
  assert.equal(pd.priceSanity({ base: "2,50", km: "0,80" }, price, "KM"), null);
});
ok("priceSanity: startna cijena raste ili pada za 50 % ili više", () => {
  assert.match(pd.priceSanity({ base: "25,00", km: "0,80" }, price, "KM"), /Startna cijena raste za 900 %\./);
  assert.match(pd.priceSanity({ base: "1,25", km: "0,80" }, price, "KM"), /Startna cijena pada za 50 %\./);
  assert.equal(pd.priceSanity({ base: "1,26", km: "0,80" }, price, "KM"), null);
});
ok("priceSanity: tačno 50 % se hvata (0,80 na 1,20)", () => {
  assert.match(pd.priceSanity({ base: "2,50", km: "1,20" }, price, "KM"), /raste za 50 %\./);
});
ok("priceSanity: cijena po km od 3 ili više, samo kad se ona mijenja", () => {
  const dear = { ...price, price_per_km: 2.9 };
  assert.match(pd.priceSanity({ base: "2,50", km: "3,00" }, dear, "KM"), /Za 10 km to je 32,50 KM\./);
  const same = { ...price, price_per_km: 3.5 };
  assert.equal(pd.priceSanity({ base: "2,50", km: "3,50" }, same, "KM"), null);
  assert.equal(pd.priceSanity({ base: "2,60", km: "3,50" }, same, "KM"), null);
});
ok("priceSanity: neispravno polje nema upozorenja, valuta je firmina", () => {
  assert.equal(pd.priceSanity({ base: "", km: "8" }, price, "KM"), null);
  assert.match(pd.priceSanity({ base: "2,50", km: "8,00" }, price, "EUR"), /82,50 EUR/);
});
ok("pragovi provjere iznosa su izvezeni", () => {
  assert.equal(pd.SANITY_CHANGE, 0.5);
  assert.equal(pd.SANITY_KM, 3);
  assert.equal(pd.SANITY_PROBE_KM, 10);
  assert.equal(pd.SANITY_TITLE, "Provjeri iznos");
});
ok("toPricingBody: BROJEVI, ne tekst", () => {
  const body = pd.toPricingBody({ base: "2,50", km: "0,8" }, "KM");
  assert.deepEqual(body, { base_price: 2.5, price_per_km: 0.8, currency: "KM" });
  assert.equal(typeof body.base_price, "number");
  assert.equal(typeof body.price_per_km, "number");
});
ok("toPricingBody: zaokružuje, valuta ima rezervu, nula je važeća", () => {
  assert.deepEqual(pd.toPricingBody({ base: "2,505", km: "0" }, null), { base_price: 2.51, price_per_km: 0, currency: "KM" });
});
ok('toPricingBody: nikad ne šalje ""', () => {
  assert.throws(() => pd.toPricingBody({ base: "", km: "0,8" }, "KM"));
  assert.throws(() => pd.toPricingBody({ base: "2,5", km: "abc" }, "KM"));
  assert.throws(() => pd.toPricingBody({ base: "-1", km: "1" }, "KM"));
});

console.log("doplata: nacrt i provjere");
ok("makeSurchargeDraft(null): prazna, isključena, po kilometru", () => {
  assert.deepEqual(pd.makeSurchargeDraft(null), {
    name: "", desc: "", type: "per_km", val: "", sched: "manual", from: "22:00", to: "06:00", on: false, icon: "mdi-tune-variant", conditionTagId: null,
  });
});
ok("makeSurchargeDraft(doplata): polja kao u redu", () => {
  const s = surcharges()[0];
  const d = pd.makeSurchargeDraft({ ...s, description: "Dodatak dok pada kiša.", condition_tag: { id: 1, key: "rain", name: "Kiša", icon: "ti-cloud-rain" } });
  assert.equal(d.name, "Kiša");
  assert.equal(d.desc, "Dodatak dok pada kiša.");
  assert.equal(d.type, "per_km");
  assert.equal(d.val, "0,30");
  assert.equal(d.sched, "manual");
  assert.equal(d.on, true);
  assert.equal(d.icon, "ti-cloud-rain");
  assert.equal(d.conditionTagId, 1);
});
ok("makeSurchargeDraft(doplata po vremenu): HH:mm bez sekundi", () => {
  const d = pd.makeSurchargeDraft(surcharges()[1]);
  assert.equal(d.sched, "auto");
  assert.equal(d.from, "22:00");
  assert.equal(d.to, "06:00");
  assert.equal(d.on, false);
  assert.equal(d.icon, "mdi-tune-variant");
});
ok("makeSurchargeDraft(napomena): bez iznosa", () => {
  const d = pd.makeSurchargeDraft(surcharges()[3]);
  assert.equal(d.type, "note");
  assert.equal(d.val, "");
});
ok("makeSurchargeDraft(katalog): naziv, ikona, tag i predloženo vrijeme; isključena", () => {
  const tag = { id: 4, key: "night", name: "Noćna dostava", icon: "ti-moon", default_time_from: "22:00:00", default_time_to: "06:00:00" };
  const d = pd.makeSurchargeDraft(tag);
  assert.equal(d.name, "Noćna dostava");
  assert.equal(d.sched, "auto");
  assert.equal(d.from, "22:00");
  assert.equal(d.to, "06:00");
  assert.equal(d.icon, "ti-moon");
  assert.equal(d.conditionTagId, 4);
  assert.equal(d.on, false);
  assert.equal(d.val, "");
  const plain = pd.makeSurchargeDraft({ id: 1, key: "rain", name: "Kiša", icon: "ti-cloud-rain" });
  assert.equal(plain.sched, "manual");
});
ok("makeSurchargeDraft(preset): napomena Centar grada", () => {
  const d = pd.makeSurchargeDraft({ name: "Centar grada", description: "Poseban obračun.", icon: "mdi-city", type: "note", value: 0, unit: "prilagođeno vozilo" });
  assert.equal(d.name, "Centar grada");
  assert.equal(d.desc, "Poseban obračun.");
  assert.equal(d.type, "note");
  assert.equal(d.icon, "mdi-city");
  assert.equal(d.conditionTagId, null);
  assert.equal(d.on, false);
});
const surDraft = (over = {}) => ({ ...pd.makeSurchargeDraft(null), name: "Snijeg", val: "0,40", ...over });
ok("surchargeErrors: ispravna doplata nema grešku", () => {
  assert.deepEqual(pd.surchargeErrors(surDraft(), surcharges(), null), {});
});
ok("surchargeErrors: naziv obavezan i jedinstven bez obzira na veličinu slova", () => {
  assert.equal(pd.surchargeErrors(surDraft({ name: "  " }), surcharges(), null).name, "Upiši naziv, npr. Kiša.");
  assert.equal(pd.surchargeErrors(surDraft({ name: "kiša" }), surcharges(), null).name, "Doplata sa tim nazivom već postoji.");
  assert.equal(pd.surchargeErrors(surDraft({ name: " KIŠA " }), surcharges(), null).name, "Doplata sa tim nazivom već postoji.");
});
ok("surchargeErrors: doplata ne smeta sama sebi pri izmjeni", () => {
  assert.equal(pd.surchargeErrors(surDraft({ name: "Kiša" }), surcharges(), 501).name, undefined);
  assert.equal(pd.surchargeErrors(surDraft({ name: "Gužva" }), surcharges(), 501).name, "Doplata sa tim nazivom već postoji.");
});
ok("surchargeErrors: iznos (prazno, slova, negativno), napomena ga ne traži", () => {
  assert.equal(pd.surchargeErrors(surDraft({ val: "" }), surcharges(), null).val, "Unesi iznos, npr. 0,30.");
  assert.equal(pd.surchargeErrors(surDraft({ val: "x" }), surcharges(), null).val, "Unesi broj, npr. 0,30.");
  assert.equal(pd.surchargeErrors(surDraft({ val: "-1" }), surcharges(), null).val, "Iznos ne može biti manji od 0.");
  assert.equal(pd.surchargeErrors(surDraft({ type: "note", val: "" }), surcharges(), null).val, undefined);
  assert.equal(pd.surchargeErrors(surDraft({ type: "note", val: "abc" }), surcharges(), null).val, undefined);
  assert.equal(pd.surchargeErrors(surDraft({ val: "0" }), surcharges(), null).val, undefined);
});
ok("surchargeErrors: vrijeme traži oba kraja i različita", () => {
  assert.equal(pd.surchargeErrors(surDraft({ sched: "auto", from: "", to: "06:00" }), surcharges(), null).time, "Izaberi vrijeme od i do.");
  assert.equal(pd.surchargeErrors(surDraft({ sched: "auto", from: "22:00", to: "22:00" }), surcharges(), null).time, "Početak i kraj ne mogu biti isti.");
  assert.equal(pd.surchargeErrors(surDraft({ sched: "auto", from: "22:00", to: "06:00" }), surcharges(), null).time, undefined);
  assert.equal(pd.surchargeErrors(surDraft({ sched: "manual", from: "", to: "" }), surcharges(), null).time, undefined);
});
ok("surchargeDirty: netaknut nacrt nije izmjena", () => {
  const d = pd.makeSurchargeDraft(surcharges()[0]);
  assert.equal(pd.surchargeDirty(d, pd.makeSurchargeDraft(surcharges()[0])), false);
});
ok("surchargeDirty: razmaci u nazivu i zapis iznosa nisu izmjena", () => {
  const orig = pd.makeSurchargeDraft(surcharges()[0]);
  assert.equal(pd.surchargeDirty({ ...orig, name: " Kiša " }, orig), false);
  assert.equal(pd.surchargeDirty({ ...orig, val: "0,3" }, orig), false);
  assert.equal(pd.surchargeDirty({ ...orig, val: "0,35" }, orig), true);
  assert.equal(pd.surchargeDirty({ ...orig, name: "Kiša!" }, orig), true);
});
ok("surchargeDirty: skrivena polja nisu izmjena", () => {
  const orig = pd.makeSurchargeDraft(surcharges()[0]);
  assert.equal(pd.surchargeDirty({ ...orig, from: "21:00" }, orig), false);
  const note = pd.makeSurchargeDraft(surcharges()[3]);
  assert.equal(pd.surchargeDirty({ ...note, val: "5" }, note), false);
  assert.equal(pd.surchargeDirty({ ...orig, sched: "auto" }, orig), true);
  assert.equal(pd.surchargeDirty({ ...orig, type: "fixed" }, orig), true);
});
ok("toSurchargeBody (nova): oblik za POST, isključena, jedinica iz tipa", () => {
  const body = pd.toSurchargeBody(surDraft({ desc: "", icon: "ti-snowflake", conditionTagId: 2 }), { isNew: true, currency: "KM" });
  assert.deepEqual(body, {
    name: "Snijeg",
    description: null,
    icon: "ti-snowflake",
    type: "per_km",
    value: 0.4,
    unit: "KM/km",
    time_from: null,
    time_to: null,
    active: false,
    condition_tag_id: 2,
  });
  assert.equal(typeof body.value, "number");
});
ok("toSurchargeBody (nova): odmah uključena i prilagođena (bez taga)", () => {
  const body = pd.toSurchargeBody(surDraft({ on: true }), { isNew: true, currency: "KM" });
  assert.equal(body.active, true);
  assert.equal(body.condition_tag_id, null);
});
ok("toSurchargeBody (izmjena): bez active i condition_tag_id", () => {
  const body = pd.toSurchargeBody(surDraft({ on: true, conditionTagId: 3 }), { isNew: false, currency: "KM" });
  assert.equal("active" in body, false);
  assert.equal("condition_tag_id" in body, false);
});
ok('toSurchargeBody: vrijeme "HH:mm" samo za "Po vremenu", inače null', () => {
  const auto = pd.toSurchargeBody(surDraft({ sched: "auto", from: "22:00", to: "06:00" }), { isNew: false, currency: "KM" });
  assert.equal(auto.time_from, "22:00");
  assert.equal(auto.time_to, "06:00");
  const manual = pd.toSurchargeBody(surDraft({ sched: "manual", from: "22:00", to: "06:00" }), { isNew: false, currency: "KM" });
  assert.equal(manual.time_from, null);
  assert.equal(manual.time_to, null);
});
ok("toSurchargeBody: napomena je 0 sa jedinicom za napomenu; fiksna dobija valutu", () => {
  const note = pd.toSurchargeBody(surDraft({ type: "note", val: "" }), { isNew: true, currency: "KM" });
  assert.equal(note.value, 0);
  assert.equal(note.unit, "prilagođeno vozilo");
  const fixed = pd.toSurchargeBody(surDraft({ type: "fixed", val: "1,5" }), { isNew: true, currency: "EUR" });
  assert.equal(fixed.value, 1.5);
  assert.equal(fixed.unit, "EUR");
});
ok("toSurchargeBody: opis se čisti, naziv se trimuje, ikona ima rezervu", () => {
  const body = pd.toSurchargeBody(surDraft({ name: " Snijeg ", desc: "  Po snijegu. ", icon: "" }), { isNew: true });
  assert.equal(body.name, "Snijeg");
  assert.equal(body.description, "Po snijegu.");
  assert.equal(body.icon, "mdi-tune-variant");
  assert.equal(body.unit, "KM/km");
});
ok("toSurchargeBody: neispravan iznos baca grešku", () => {
  assert.throws(() => pd.toSurchargeBody(surDraft({ val: "" }), { isNew: true }));
  assert.throws(() => pd.toSurchargeBody(surDraft({ val: "-2" }), { isNew: true }));
});
ok("surchargeImpact: napomena", () => {
  assert.deepEqual(pd.surchargeImpact(surDraft({ type: "note", val: "" }), 4.5, "KM"), { kind: "note" });
  assert.match(pd.SURCHARGE_NOTE_IMPACT, /Napomena ne mijenja iznos/);
});
ok("surchargeImpact: po kilometru i fiksno, isključena i uključena", () => {
  const per = pd.surchargeImpact(surDraft({ val: "0,30" }), 4.5, "KM");
  assert.equal(per.kind, "amount");
  assert.equal(per.amount, 1.35);
  assert.equal(per.text, "Za 4,5 km: +1,35 KM na cijenu dostave. Ulazi u cijenu tek kad je uključiš.");
  const fix = pd.surchargeImpact(surDraft({ type: "fixed", val: "1,5", on: true }), 12, "KM");
  assert.equal(fix.amount, 1.5);
  assert.equal(fix.text, "Za 12,0 km: +1,50 KM na cijenu dostave. Uključena je odmah.");
});
ok("surchargeImpact: neispravan iznos nema uticaja", () => {
  assert.equal(pd.surchargeImpact(surDraft({ val: "" }), 4.5, "KM"), null);
  assert.equal(pd.surchargeImpact(surDraft({ val: "x" }), 4.5, "KM"), null);
  assert.equal(pd.surchargeImpact(surDraft({ val: "-1" }), 4.5, "KM"), null);
});

console.log("pravilo: nacrt i provjere");
ok("makeRuleDraft(null): zona, a bez zadanog pravila zadano", () => {
  assert.equal(pd.makeRuleDraft(null, { hasFallback: true }).type, "zone");
  assert.equal(pd.makeRuleDraft(null, { hasFallback: false }).type, "default");
  assert.deepEqual(pd.makeRuleDraft(null, { hasFallback: true }), { type: "zone", zone: null, sur: null, min: "", max: "", veh: [], maxT: "", note: "" });
});
ok("makeRuleDraft: zona sa terenom i napomenom", () => {
  const d = pd.makeRuleDraft(rules()[1], { hasFallback: true });
  assert.deepEqual(d, { type: "zone", zone: 12, sur: null, min: "", max: "", veh: ["motorbike", "car"], maxT: "1,6", note: "Brdovit teren." });
});
ok("makeRuleDraft: doplata, udaljenost (samo od) i zadano", () => {
  assert.equal(pd.makeRuleDraft(rules()[0], { hasFallback: true }).sur, 501);
  const dist = pd.makeRuleDraft(rules()[3], { hasFallback: true });
  assert.equal(dist.type, "distance");
  assert.equal(dist.min, "4");
  assert.equal(dist.max, "");
  const def = pd.makeRuleDraft(rules()[4], { hasFallback: true });
  assert.equal(def.type, "default");
  assert.equal(def.zone, null);
});
ok("makeRuleDraft: stara pravila i brojevi kao tekst iz API-ja", () => {
  const legacy = R(1, { zone_id: 11, vehicle: "bicycle", max_terrain_factor: "1.50", condition_text: "Centar" });
  assert.deepEqual(pd.makeRuleDraft(legacy, { hasFallback: true }), { type: "zone", zone: 11, sur: null, min: "", max: "", veh: ["bicycle"], maxT: "1,5", note: "" });
  const dist = R(2, { condition_type: "distance", min_distance_km: "4.50", max_distance_km: "8.00" });
  const d = pd.makeRuleDraft(dist, { hasFallback: true });
  assert.equal(d.min, "4,5");
  assert.equal(d.max, "8");
});
const ruleDraft = (over = {}) => ({ type: "zone", zone: 11, sur: null, min: "", max: "", veh: ["car"], maxT: "", note: "", ...over });
ok("ruleErrors: ispravno pravilo nema grešku", () => {
  assert.deepEqual(pd.ruleErrors(ruleDraft()), {});
  assert.deepEqual(pd.ruleErrors(ruleDraft({ type: "default", zone: null })), {});
});
ok("ruleErrors: bar jedno vozilo", () => {
  assert.equal(pd.ruleErrors(ruleDraft({ veh: [] })).veh, "Izaberi bar jedno vozilo.");
});
ok("ruleErrors: zona i doplata su obavezne za svoj tip", () => {
  assert.equal(pd.ruleErrors(ruleDraft({ zone: null })).zone, "Izaberi zonu.");
  assert.equal(pd.ruleErrors(ruleDraft({ type: "surcharge", sur: null })).sur, "Izaberi doplatu.");
  assert.equal(pd.ruleErrors(ruleDraft({ type: "surcharge", sur: 501 })).sur, undefined);
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", zone: null, min: "4" })).zone, undefined);
});
ok("ruleErrors: udaljenost traži bar jednu granicu", () => {
  const msg = "Upiši bar jedno: od ili do (km), npr. 4.";
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "", max: "" })).dist, msg);
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "abc", max: "" })).dist, msg);
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "4", max: "x" })).dist, msg);
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "4", max: "" })).dist, undefined);
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "", max: "4" })).dist, undefined);
});
ok('ruleErrors: negativna udaljenost i "do" mora biti veće od "od"', () => {
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "-1", max: "" })).dist, "Udaljenost ne može biti manja od 0.");
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "8", max: "4" })).dist, "„Do“ mora biti veće od „od“.");
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "4", max: "4" })).dist, "„Do“ mora biti veće od „od“.");
  assert.equal(pd.ruleErrors(ruleDraft({ type: "distance", min: "4", max: "8" })).dist, undefined);
});
ok("ruleErrors: faktor terena najmanje 1,0, prazno je bez ograničenja", () => {
  assert.equal(pd.ruleErrors(ruleDraft({ maxT: "0,5" })).maxT, "Faktor terena je najmanje 1,0.");
  assert.equal(pd.ruleErrors(ruleDraft({ maxT: "abc" })).maxT, "Faktor terena je najmanje 1,0.");
  assert.equal(pd.ruleErrors(ruleDraft({ maxT: "1" })).maxT, undefined);
  assert.equal(pd.ruleErrors(ruleDraft({ maxT: "1,6" })).maxT, undefined);
  assert.equal(pd.ruleErrors(ruleDraft({ maxT: "" })).maxT, undefined);
  assert.equal(pd.ruleErrors(ruleDraft({ maxT: "  " })).maxT, undefined);
});
ok("ruleDirty: netaknut nacrt i zapis broja nisu izmjena", () => {
  const orig = pd.makeRuleDraft(rules()[1], { hasFallback: true });
  assert.equal(pd.ruleDirty({ ...orig, veh: [...orig.veh] }, orig), false);
  assert.equal(pd.ruleDirty({ ...orig, maxT: "1,60", note: " Brdovit teren. " }, orig), false);
});
ok("ruleDirty: redoslijed vozila jeste izmjena", () => {
  const orig = pd.makeRuleDraft(rules()[1], { hasFallback: true });
  assert.equal(pd.ruleDirty({ ...orig, veh: ["car", "motorbike"] }, orig), true);
  assert.equal(pd.ruleDirty({ ...orig, veh: [...orig.veh, "walk"] }, orig), true);
});
ok("ruleDirty: polje koje ne važe za tip nije izmjena, ostalo jeste", () => {
  const orig = pd.makeRuleDraft(rules()[3], { hasFallback: true });
  assert.equal(pd.ruleDirty({ ...orig, zone: 12, sur: 501 }, orig), false);
  assert.equal(pd.ruleDirty({ ...orig, max: "8" }, orig), true);
  assert.equal(pd.ruleDirty({ ...orig, type: "zone" }, orig), true);
  assert.equal(pd.ruleDirty({ ...orig, maxT: "1,5" }, orig), true);
});
ok("toRuleBody: zona", () => {
  const body = pd.toRuleBody(ruleDraft({ zone: 12, veh: ["motorbike", "car"], maxT: "1,6", note: " Brdovit teren. " }), 2, lookup);
  assert.deepEqual(body, {
    condition_text: "Zona: Starčevica",
    vehicle: "motorbike",
    zone_id: 12,
    max_terrain_factor: 1.6,
    note: "Brdovit teren.",
    condition_type: "zone",
    surcharge_id: null,
    min_distance_km: null,
    max_distance_km: null,
    preferred_vehicles: ["motorbike", "car"],
    priority: 2,
  });
});
ok("toRuleBody: doplata i udaljenost", () => {
  const sur = pd.toRuleBody(ruleDraft({ type: "surcharge", zone: 11, sur: 501 }), 1, lookup);
  assert.equal(sur.condition_text, "Doplata: Kiša");
  assert.equal(sur.surcharge_id, 501);
  assert.equal(sur.zone_id, null);
  const dist = pd.toRuleBody(ruleDraft({ type: "distance", min: "4", max: "8,5" }), 4, lookup);
  assert.equal(dist.condition_text, "Udaljenost 4–8,5 km");
  assert.equal(dist.min_distance_km, 4);
  assert.equal(dist.max_distance_km, 8.5);
  assert.equal(dist.zone_id, null);
  assert.equal(dist.surcharge_id, null);
  const from = pd.toRuleBody(ruleDraft({ type: "distance", min: "4", max: "" }), 4, lookup);
  assert.equal(from.condition_text, "Udaljenost preko 4 km");
  assert.equal(from.max_distance_km, null);
});
ok("toRuleBody: zadano pravilo, prazna napomena i teren su null", () => {
  const body = pd.toRuleBody(ruleDraft({ type: "default", zone: null, veh: ["motorbike", "bicycle", "car"] }), 5, lookup);
  assert.equal(body.condition_text, "Sve ostalo");
  assert.equal(body.condition_type, "default");
  assert.equal(body.vehicle, "motorbike");
  assert.equal(body.note, null);
  assert.equal(body.max_terrain_factor, null);
  assert.equal(body.zone_id, null);
  assert.deepEqual(body.preferred_vehicles, ["motorbike", "bicycle", "car"]);
});
ok("toRuleBody: priority i kopija vozila; bez vozila baca grešku", () => {
  const d = ruleDraft({ veh: ["car", "walk"] });
  const body = pd.toRuleBody(d, 7, lookup);
  assert.equal(body.priority, 7);
  body.preferred_vehicles.push("bicycle");
  assert.deepEqual(d.veh, ["car", "walk"]);
  assert.throws(() => pd.toRuleBody(ruleDraft({ veh: [] }), 1, lookup));
});

console.log("poruke servera");
ok("placeServerMessages(price): polja uz nacrt", () => {
  const { inline, loose } = pd.placeServerMessages("price", { base_price: "Iznos je prevelik.", price_per_km: "Iznos je neispravan." });
  assert.deepEqual(inline, { base: "Iznos je prevelik.", km: "Iznos je neispravan." });
  assert.deepEqual(loose, []);
});
ok("placeServerMessages(price): nepoznato polje ide u loose", () => {
  const { inline, loose } = pd.placeServerMessages("price", { currency: "Valuta nije podržana.", base_price: "x" });
  assert.deepEqual(inline, { base: "x" });
  assert.deepEqual(loose, ["Valuta nije podržana."]);
});
ok("placeServerMessages(surcharge): value, description, time_from/time_to", () => {
  const { inline, loose } = pd.placeServerMessages("surcharge", {
    name: "Naziv je zauzet.",
    value: "Iznos je neispravan.",
    description: "Opis je predug.",
    time_from: "Vrijeme od nije ispravno.",
    time_to: "Vrijeme do nije ispravno.",
    type: "Tip nije ispravan.",
    icon: "Ikona nije ispravna.",
  });
  assert.deepEqual(inline, {
    name: "Naziv je zauzet.",
    val: "Iznos je neispravan.",
    desc: "Opis je predug.",
    time: "Vrijeme od nije ispravno. Vrijeme do nije ispravno.",
  });
  assert.deepEqual(loose, ["Tip nije ispravan.", "Ikona nije ispravna."]);
});
ok("placeServerMessages(rule): sva polja pravila", () => {
  const { inline, loose } = pd.placeServerMessages("rule", {
    zone_id: "Zona ne postoji.",
    surcharge_id: "Doplata ne postoji.",
    min_distance_km: "Od je neispravno.",
    max_distance_km: "Do mora biti veće.",
    preferred_vehicles: "Vozila nisu ispravna.",
    max_terrain_factor: "Faktor je neispravan.",
    priority: "Redoslijed nije ispravan.",
  });
  assert.deepEqual(inline, {
    zone: "Zona ne postoji.",
    sur: "Doplata ne postoji.",
    dist: "Od je neispravno. Do mora biti veće.",
    veh: "Vozila nisu ispravna.",
    maxT: "Faktor je neispravan.",
  });
  assert.deepEqual(loose, ["Redoslijed nije ispravan."]);
});
ok("placeServerMessages: ista poruka za od i do se ne ponavlja", () => {
  const { inline } = pd.placeServerMessages("rule", { min_distance_km: "Neispravna udaljenost.", max_distance_km: "Neispravna udaljenost." });
  assert.equal(inline.dist, "Neispravna udaljenost.");
});
ok("placeServerMessages: ime koje liči na svojstvo objekta je loose, ne ruši ništa", () => {
  const { inline, loose } = pd.placeServerMessages("price", { constructor: "Čudna poruka.", toString: "Druga." });
  assert.deepEqual(inline, {});
  assert.deepEqual(loose, ["Čudna poruka.", "Druga."]);
});
ok("placeServerMessages: bez poruka", () => {
  assert.deepEqual(pd.placeServerMessages("rule", {}), { inline: {}, loose: [] });
});

console.log("vozila");
ok('ruleVehicleView: "Pješice" (ne "Pešice"), ostala vozila iz RULE_VEHICLE_META', () => {
  assert.equal(pr.ruleVehicleView("walk").label, "Pješice");
  assert.equal(pr.ruleVehicleView("walk").icon, "mdi-walk");
  assert.equal(pr.ruleVehicleView("car").label, "Automobil");
  assert.equal(pr.ruleVehicleView("motorbike").label, "Motor");
  assert.equal(pr.ruleVehicleView("bicycle").label, "Bicikl");
});
ok("ruleVehicleView: nepoznata vrijednost ima rezervu sa svojim nazivom", () => {
  const v = pr.ruleVehicleView("scooter");
  assert.equal(v.label, "scooter");
  assert.ok(v.icon.startsWith("mdi-"));
});
ok("RULE_VEHICLE_KEYS: četiri vozila, Pješice zadnje", () => {
  assert.deepEqual([...pr.RULE_VEHICLE_KEYS], ["car", "motorbike", "bicycle", "walk"]);
});
ok("cijeli tok: nacrt cijene, upozorenje, tijelo i primjer", () => {
  const draft = { base: "2,50", km: "0,85" };
  assert.equal(pd.priceDirty(draft, price), true);
  assert.equal(pd.priceSanity(draft, price, "KM"), null);
  const cfgNow = pd.priceNumbers(draft, price);
  assert.equal(pr.calcPrice(4.5, cfgNow, surcharges(), pr.activeOf(surcharges())).total, 7.68);
  assert.deepEqual(pd.toPricingBody(draft, "KM"), { base_price: 2.5, price_per_km: 0.85, currency: "KM" });
});

console.log(`\n${n} provjera prošlo`);
assert.ok(n >= 80, `očekivano najmanje 80 provjera, ima ${n}`);
