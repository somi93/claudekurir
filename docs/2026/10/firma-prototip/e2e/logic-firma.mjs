// Provjera čiste logike stranice Firma (utils/companySettings.ts, utils/restaurantCooperation.ts,
// utils/cashLimit.ts) u običnom Node-u: TypeScript se prevede u privremeni folder, alias "~/" se
// preusmjeri na njega. Pokretanje iz korijena aplikacije: node docs/2026/10/firma-prototip/e2e/logic-firma.mjs
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");
const out = mkdtempSync(join(tmpdir(), "firma-logic-"));

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
compile("utils/companySettings.ts");
compile("utils/restaurantCooperation.ts");

const cs = await import(join(out, "utils/companySettings.mjs"));
const rc = await import(join(out, "utils/restaurantCooperation.mjs"));

let n = 0;
const ok = (name, fn) => {
  fn();
  n += 1;
  console.log(`  ok  ${name}`);
};

const saved = (over = {}) => ({
  delivery_company_id: 24,
  commission_percentage: 12,
  commission_percentage_editable: false,
  cash_limit_amount: 200,
  cash_limit_enforcement: "BLOCK",
  payout_period_days: 7,
  currency: "KM",
  available_currencies: ["KM", "BAM", "EUR", "RSD"],
  daily_handover_time: "14:16:00",
  assignment_mode: "ALL",
  assignment_courier_count: null,
  assignment_timeout_action: "NEXT_NEAREST",
  assignment_courier_pool: "ALL_ACTIVE",
  offer_timeout_seconds: null,
  show_price_breakdown: true,
  ...over,
});
const always = () => true;
const never = () => false;

console.log("nacrt i izmjene");
ok("limit 0 je uključen limit, null je isključen", () => {
  assert.equal(cs.makeDraft(saved({ cash_limit_amount: 0 })).limitOn, true);
  assert.equal(cs.makeDraft(saved({ cash_limit_amount: 0 })).limit, "0");
  assert.equal(cs.makeDraft(saved({ cash_limit_amount: null })).limitOn, false);
});
ok("vrijeme predaje se skraćuje na HH:MM", () => {
  assert.equal(cs.makeDraft(saved()).handover, "14:16");
});
ok("period 7 je izbor, 30 je Drugo", () => {
  assert.equal(cs.makeDraft(saved({ payout_period_days: 7 })).payout, "7");
  const d = cs.makeDraft(saved({ payout_period_days: 30 }));
  assert.equal(d.payout, "other");
  assert.equal(d.payoutOther, "30");
});
ok("netaknut nacrt nije izmjena, skriveno polje nije izmjena", () => {
  const s = saved();
  const d = cs.makeDraft(s);
  for (const k of Object.keys(cs.DRAFT_KEYS)) assert.equal(cs.isSettingDirty(k, d, s), false, k);
  const off = saved({ cash_limit_amount: null });
  const od = cs.makeDraft(off);
  od.limit = "123";
  assert.equal(cs.isSettingDirty("limit", od, off), false);
  const al = cs.makeDraft(saved());
  al.count = "9";
  al.timeout = "99";
  assert.equal(cs.isSettingDirty("mode", al, saved()), false);
});
ok('"Drugo = 7" je isto što i "Svake sedmice"', () => {
  const s = saved({ payout_period_days: 7 });
  const d = cs.makeDraft(s);
  d.payout = "other";
  d.payoutOther = "7";
  assert.equal(cs.isSettingDirty("payout", d, s), false);
  d.payoutOther = "8";
  assert.equal(cs.isSettingDirty("payout", d, s), true);
});

console.log("provjere polja");
ok("prazan limit blokira, poruka tek kad se pokaže", () => {
  const s = saved({ cash_limit_amount: null });
  const d = cs.makeDraft(s);
  d.limitOn = true;
  d.limit = "";
  const hidden = cs.checkSetting("limit", d, s, never);
  assert.equal(hidden.valid, false);
  assert.equal(hidden.fields.limit, undefined);
  const shown = cs.checkSetting("limit", d, s, always);
  assert.equal(shown.valid, false);
  assert.equal(shown.fields.limit.tone, "bad");
  assert.match(shown.fields.limit.text, /0 znači/);
});
ok("0 je važeći limit, negativan nije, zarez radi", () => {
  const s = saved();
  const d = cs.makeDraft(s);
  d.limit = "0";
  assert.equal(cs.checkSetting("limit", d, s, always).valid, true);
  d.limit = "-5";
  assert.equal(cs.checkSetting("limit", d, s, always).valid, false);
  d.limit = "150,5";
  assert.equal(cs.checkSetting("limit", d, s, always).valid, true);
  d.limit = "abc";
  assert.equal(cs.checkSetting("limit", d, s, always).valid, false);
});
ok("način dodjele: broj 1-50, čekanje 5-120", () => {
  const s = saved();
  const d = cs.makeDraft(s);
  d.mode = "TOP_N";
  d.count = "0";
  assert.equal(cs.checkSetting("mode", d, s, always).fields.count.tone, "bad");
  d.count = "51";
  assert.equal(cs.checkSetting("mode", d, s, always).fields.count.tone, "bad");
  d.count = "5";
  d.timeout = "4";
  assert.equal(cs.checkSetting("mode", d, s, always).fields.timeout.tone, "bad");
  d.timeout = "121";
  assert.equal(cs.checkSetting("mode", d, s, always).fields.timeout.tone, "bad");
  d.timeout = "20";
  assert.equal(cs.checkSetting("mode", d, s, always).valid, true);
  d.mode = "ALL";
  d.timeout = "x";
  assert.equal(cs.checkSetting("mode", d, s, always).valid, true);
});
ok("period isplate Drugo: cijeli broj najmanje 1", () => {
  const s = saved();
  const d = cs.makeDraft(s);
  d.payout = "other";
  for (const bad of ["", "0", "1.5", "-2", "abc"]) {
    d.payoutOther = bad;
    assert.equal(cs.checkSetting("payout", d, s, always).valid, false, bad);
  }
  d.payoutOther = "30";
  assert.equal(cs.checkSetting("payout", d, s, always).valid, true);
});

console.log("tijelo za server");
ok("limit isključen šalje null i ne dira ponašanje", () => {
  const d = cs.makeDraft(saved());
  d.limitOn = false;
  assert.deepEqual(cs.toPatch("limit", d), { cash_limit_amount: null });
});
ok("limit 0 se šalje kao 0", () => {
  const d = cs.makeDraft(saved());
  d.limit = "0";
  assert.deepEqual(cs.toPatch("limit", d), { cash_limit_amount: 0, cash_limit_enforcement: "BLOCK" });
});
ok("prelazak na ALL šalje broj kurira null, a čekanje ne dira", () => {
  const s = saved({ assignment_mode: "TOP_N", assignment_courier_count: 4, offer_timeout_seconds: 30 });
  const d = cs.makeDraft(s);
  d.mode = "ALL";
  const patch = cs.toPatch("mode", d);
  assert.deepEqual(patch, { assignment_mode: "ALL", assignment_courier_count: null });
  const body = cs.buildFinanceBody(s, patch);
  assert.equal(body.offer_timeout_seconds, 30);
  assert.equal(body.assignment_courier_count, null);
});
ok("tijelo uvijek nosi svih 11 polja", () => {
  const body = cs.buildFinanceBody(saved(), { currency: "EUR" });
  assert.equal(Object.keys(body).length, 11);
  assert.equal(body.currency, "EUR");
  assert.equal(body.daily_handover_time, "14:16:00");
  assert.equal(body.cash_limit_amount, 200);
});
ok("starija firma bez novih polja dobija podrazumijevane vrijednosti", () => {
  const body = cs.buildFinanceBody(
    saved({ assignment_mode: undefined, assignment_timeout_action: undefined, assignment_courier_pool: undefined, show_price_breakdown: undefined, currency: undefined }),
    {}
  );
  assert.equal(body.assignment_mode, "ALL");
  assert.equal(body.assignment_timeout_action, "NEXT_NEAREST");
  assert.equal(body.assignment_courier_pool, "ALL_ACTIVE");
  assert.equal(body.show_price_breakdown, true);
  assert.equal(body.currency, "KM");
});
ok("TOP_N šalje broj i čekanje, NEAREST samo čekanje", () => {
  const d = cs.makeDraft(saved());
  d.mode = "TOP_N";
  d.count = "3";
  d.timeout = "25";
  d.action = "OPEN_TO_ALL";
  assert.deepEqual(cs.toPatch("mode", d), {
    assignment_mode: "TOP_N",
    assignment_courier_count: 3,
    offer_timeout_seconds: 25,
    assignment_timeout_action: "OPEN_TO_ALL",
  });
  d.mode = "NEAREST";
  assert.equal(cs.toPatch("mode", d).assignment_courier_count, null);
});
ok("BEST_MATCH ostaje izbor samo firmi koja ga ima", () => {
  assert.equal(cs.modeOptions(saved()).length, 3);
  assert.equal(cs.modeOptions(saved({ assignment_mode: "BEST_MATCH" })).length, 4);
});

console.log("poruke servera");
ok("poruka uz skriveno ili izborno polje ide u tonirani blok", () => {
  const d = cs.makeDraft(saved());
  const r = cs.placeServerMessages({ cash_limit_amount: "Neispravan iznos.", currency: "Valuta nije dozvoljena." }, d);
  assert.deepEqual(r.inline, { limit: "Neispravan iznos." });
  assert.deepEqual(r.loose, ["Valuta nije dozvoljena."]);
  d.limitOn = false;
  assert.deepEqual(cs.placeServerMessages({ cash_limit_amount: "x" }, d).loose, ["x"]);
});

console.log("uticaj limita");
const bal = [
  { courier_id: 1, name: "Marko Petrović", cash_owed_to_company: 214.4 },
  { courier_id: 2, name: "Darko Ilić", cash_owed_to_company: 188 },
  { courier_id: 3, name: "Jelena Radić", cash_owed_to_company: 142.7 },
  { courier_id: 4, name: "Nikola Savić", cash_owed_to_company: 61.2 },
  { courier_id: 5, name: "Milica Jović", cash_owed_to_company: 35 },
  { courier_id: 6, name: "Amra Hadžić", cash_owed_to_company: 0 },
  { courier_id: 7, name: "Stefan Kovač", cash_owed_to_company: -19.2 },
  { courier_id: 8, name: "Vladimir Lukić", cash_owed_to_company: 0 },
];
ok("sa 150: dva kurira preko limita, jedan blizu", () => {
  const im = cs.describeCashImpact(bal, { limitOn: true, limit: "150", enforcement: "BLOCK" }, "KM");
  assert.equal(im.rows.filter((r) => r.level === "over").length, 2);
  assert.match(im.title, /2 kurira su odmah preko limita/);
  assert.equal(im.tone, "warn");
  assert.match(im.body, /ne mogu da prihvate/);
});
ok("sa 0 i blokadom: 5 od 8, crveno upozorenje", () => {
  const im = cs.describeCashImpact(bal, { limitOn: true, limit: "0", enforcement: "BLOCK" }, "KM");
  assert.equal(im.tone, "bad");
  assert.match(im.title, /blokira svakoga/);
  assert.match(im.body, /5 od 8/);
});
ok("sa 0 i samo obavještavanjem ne obećava blokadu", () => {
  const im = cs.describeCashImpact(bal, { limitOn: true, limit: "0", enforcement: "NOTIFY_ONLY" }, "KM");
  assert.doesNotMatch(im.title, /blokira/);
  assert.doesNotMatch(im.body, /bez novih narudžbi/);
});
ok("negativan saldo ne puni limit, neispravan iznos nema poruku", () => {
  const im = cs.describeCashImpact(bal, { limitOn: true, limit: "1000", enforcement: "BLOCK" }, "KM");
  assert.equal(im.tone, "ok");
  assert.equal(im.rows.length, 0);
  assert.equal(cs.describeCashImpact(bal, { limitOn: true, limit: "", enforcement: "BLOCK" }, "KM"), null);
});
ok("bez limita: ukupno i najveći dužnik", () => {
  const im = cs.describeCashImpact(bal, { limitOn: false, limit: "", enforcement: "BLOCK" }, "KM");
  assert.match(im.body, /ukupno 641\.30 KM/);
  assert.match(im.body, /Marko Petrović/);
});
ok("broj preko limita za red u listi", () => {
  assert.equal(cs.overLimitCount(bal, 150), 2);
  assert.equal(cs.overLimitCount(bal, 0), 5);
  assert.equal(cs.overLimitCount(null, 150), null);
  assert.equal(cs.overLimitCount(bal, null), null);
});

console.log("redovi i valuta");
ok("tekstovi redova", () => {
  const ctx = { overLimit: 2, otherCurrency: 1 };
  assert.match(cs.rowView("limit", saved(), ctx).value, /^200\.00 KM · blokira nove narudžbe$/);
  assert.equal(cs.rowView("limit", saved(), ctx).tag.text, "2 kurira su preko limita");
  assert.equal(cs.rowView("limit", saved({ cash_limit_amount: null }), ctx).value, "Bez limita");
  assert.equal(cs.rowView("handover", saved(), ctx).value, "Svaki dan u 14:16");
  assert.equal(cs.rowView("handover", saved({ daily_handover_time: null }), ctx).empty, true);
  assert.equal(cs.rowView("payout", saved({ payout_period_days: 30 }), ctx).value, "Svakih 30 dana");
  assert.equal(cs.rowView("mode", saved({ assignment_mode: "TOP_N", assignment_courier_count: 3, offer_timeout_seconds: 20 }), ctx).value, "Prvih 3 najbližih · 20 s");
  assert.equal(cs.rowView("currency", saved(), ctx).tag.text, "1 restoran u drugoj valuti");
  assert.equal(cs.rowView("currency", saved(), { overLimit: 0, otherCurrency: 3 }).tag.text, "3 restorana u drugoj valuti");
});
ok("upozorenje o valuti prati sačuvanu valutu", () => {
  assert.equal(cs.describeCurrencyChange("KM", saved(), 2, 12), null);
  const w = cs.describeCurrencyChange("EUR", saved(), 2, 12);
  assert.match(w.body, /200 KM postaje 200 EUR/);
  assert.match(w.body, /2 od 12 restorana/);
});

console.log("restorani");
const R = (over) => ({ id: 1, restaurant_id: 100, restaurant_name: "Test", active_restoran: true, active_company: true, cooperation_active: true, internal: false, suspension_reason: null, record_status: 1, restaurant_currency: "KM", ...over });
ok("redoslijed prednosti stanja", () => {
  assert.equal(rc.coopState(R({ internal: true, active_restoran: false })), "internal");
  assert.equal(rc.coopState(R({ active_restoran: false, active_company: false })), "ours");
  assert.equal(rc.coopState(R({ active_company: false })), "theirs");
  assert.equal(rc.coopState(R()), "active");
});
const list = [
  R({ id: 1, restaurant_id: 106, restaurant_name: "Roštiljnica Laguna" }),
  R({ id: 2, restaurant_id: 112, restaurant_name: "Urban Food", restaurant_currency: "EUR" }),
  R({ id: 3, restaurant_id: 115, restaurant_name: "Pizzeria Napoli", active_restoran: false }),
  R({ id: 4, restaurant_id: 118, restaurant_name: "Pekara Zlatni klas", active_company: false }),
  R({ id: 5, restaurant_id: 121, restaurant_name: "Burger", internal: true, restaurant_currency: "EUR" }),
  R({ id: 6, restaurant_id: 124, restaurant_name: "Ćevabdžinica Sarajevo" }),
  R({ id: 7, restaurant_id: 127, restaurant_name: "Без валуте", restaurant_currency: null }),
];
ok("brojači i druga valuta (sopstvena dostava se ne računa)", () => {
  const c = rc.restaurantCounts(list, "KM");
  assert.deepEqual(c, { all: 7, active: 4, ours: 1, theirs: 1, internal: 1, currency: 1 });
});
ok("brojač druge valute prati sačuvanu valutu", () => {
  assert.equal(rc.restaurantCounts(list, "EUR").currency, 4); // KM restorani; bez valute i sopstvena dostava se ne porede
});
ok("filter i pretraga bez dijakritika, ćirilice, po broju", () => {
  const f = (q, filter = "all") => rc.filterRestaurants(list, { q, filter }, "KM").map((r) => r.id);
  assert.deepEqual(f("rostiljnica"), [1]);
  assert.deepEqual(f("cevabdzinica"), [6]);
  assert.deepEqual(f("#115"), [3]);
  assert.deepEqual(f("124"), [6]);
  assert.deepEqual(f("", "ours"), [3]);
  assert.deepEqual(f("", "theirs"), [4]);
  assert.deepEqual(f("", "currency"), [2]);
  assert.deepEqual(f("Pizzeria", "ours"), [3]);
  assert.deepEqual(f("Pizzeria", "active"), []);
  assert.deepEqual(f("Bez valute"), [7]);
});
ok("nepoznat filter u adresi je Svi", () => {
  assert.equal(rc.parseRestaurantFilter("bilo-sta"), "all");
  assert.equal(rc.parseRestaurantFilter("ours"), "ours");
  assert.equal(rc.parseRestaurantFilter(["theirs"]), "theirs");
});

console.log(`\n${n} provjera prošlo`);
