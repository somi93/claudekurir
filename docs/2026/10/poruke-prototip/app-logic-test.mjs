// Provjera čiste logike APLIKACIJE (app/utils/*.ts) u običnom Node-u: iste provjere kao logic-test.mjs
// (koji gleda prototip), nad portovanim kodom. esbuild bundle sa alias "~" -> app.
// Pokretanje iz korijena repoa: node docs/2026/10/poruke-prototip/app-logic-test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const require = createRequire(join(repo, "package.json"));
const esbuild = require("esbuild");

const dir = mkdtempSync(join(tmpdir(), "poruke-logic-"));
const entry = join(dir, "entry.ts");
writeFileSync(
  entry,
  [
    `export * from "~/utils/courierRoster";`,
    `export * from "~/utils/messageAudience";`,
    `export * from "~/utils/messageDraft";`,
    `export * from "~/utils/messageHistory";`,
    `export * from "~/utils/messageTime";`,
    `export * from "~/utils/messageTracking";`,
  ].join("\n")
);
const out = join(dir, "bundle.mjs");
await esbuild.build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: out, alias: { "~": join(repo, "app") }, logLevel: "error" });
const A = await import(pathToFileURL(out).href);

// Izmišljeni svijet prototipa (isti kuriri kao u logic-test.mjs).
await import("./logic.js");
await import("./world.js");
const W = globalThis.__MW;
const world = W.build(0);
const NOW = W.NOW_MS;

const rows = world.roster.map((c) => ({
  courier_id: c.id,
  name: `${c.first} ${c.last}`,
  first_name: c.first,
  last_name: c.last,
  phone: c.phone,
  email: c.email,
  suspended: c.suspended,
  suspended_reason: null,
  suspended_at: null,
  vehicle: c.vehicle ? { id: 1, type: c.vehicle } : null,
}));
const locations = world.roster.map((c) => ({
  courier_id: c.id,
  name: `${c.first} ${c.last}`,
  phone: c.phone,
  suspended: c.suspended,
  vehicle: null,
  location: c.live
    ? { latitude: 44.77, longitude: 17.19, heading: null, speed: null, status: c.live.st, updated_at: new Date(NOW - c.live.ago * 1000).toISOString() }
    : null,
}));
const balances = world.roster.map((c) => ({ courier_id: c.id, cash_owed_to_company: c.cash, wage_owed_to_courier: 0 }));
const roster = A.buildRoster(rows, { locations, balances });
const ids = (l) => l.map((c) => c.id);

let n = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); n++; console.log("  ✔", name); } catch (e) { fail++; n++; console.log("  ✘", name, "\n     ", String(e.message).split("\n")[0]); }
};

console.log("— množina i tekst");
t("kurir/kurira", () => {
  assert.equal(A.couriersText(1), "1 kurir");
  assert.equal(A.couriersText(2), "2 kurira");
  assert.equal(A.couriersText(11), "11 kurira");
  assert.equal(A.couriersText(21), "21 kurir");
});
t("dativ: 1 kuriru, 21 kuriru, 22 kurira", () => {
  assert.equal(A.sentWho(1), "1 kuriru");
  assert.equal(A.sentWho(21), "21 kuriru");
  assert.equal(A.sentWho(25), "25 kurira");
  assert.equal(A.sentWho(12), "12 kurira");
});

console.log("— grupe primalaca");
const counts = A.presetCounts(roster, NOW);
t("28 kurira u svijetu", () => assert.equal(roster.length, 28));
t("brojevi grupa", () => assert.deepEqual(counts, { active: 25, delivering: 4, online: 10, offline: 11, debt: 6, suspended: 3 }));
t("aktivni + suspendovani = svi", () => assert.equal(counts.active + counts.suspended, roster.length));
t("U dostavi + Slobodni + Offline = aktivni", () => assert.equal(counts.delivering + counts.online + counts.offline, counts.active));
t("Duguju gotovinu uključuje suspendovane (njima se opomena šalje)", () => {
  const d = A.audienceOf(roster, { kind: "preset", key: "debt" }, NOW);
  assert.equal(d.length, 6);
  assert.equal(A.suspendedIn(d), 2);
});
t("Kurir bez signala je Offline, ne nigdje", () => {
  const off = ids(A.audienceOf(roster, { kind: "preset", key: "offline" }, NOW));
  assert.ok(off.includes(30201) && off.includes(30228) && off.includes(30249));
});
t("ručni izbor drži samo kurire koji postoje u spisku", () => {
  const a = A.audienceOf(roster, { kind: "manual", ids: new Set([30189, 99999, 30192]) }, NOW);
  assert.deepEqual(ids(a), [30189, 30192]);
});
t("grupa čiji izvor ne radi pada na Svi aktivni", () => {
  const down = { locations: false, balances: true };
  assert.equal(A.normalizeSelection({ kind: "preset", key: "delivering" }, down).key, "active");
  assert.equal(A.normalizeSelection({ kind: "preset", key: "debt" }, down).key, "debt");
  assert.equal(A.normalizeSelection({ kind: "preset", key: "debt" }, { locations: true, balances: false }).key, "active");
  const manual = { kind: "manual", ids: new Set([1]) };
  assert.equal(A.normalizeSelection(manual, { locations: false, balances: false }), manual);
  assert.equal(A.presetAvailable("suspended", { locations: false, balances: false }), true);
});
t("tekst primalaca", () => {
  const all = A.audienceOf(roster, { kind: "preset", key: "active" }, NOW);
  assert.match(A.audienceText(all), /^Amir H\., Kenan M\., Aleksandar-Nemanja P\. i još 22$/);
  assert.equal(A.audienceText(all.slice(0, 2)), "Amir H. i Kenan M.");
  assert.equal(A.audienceText(all.slice(0, 1)), "Amir H.");
  assert.equal(A.audienceText([]), "");
  assert.equal(A.suspendedText(1), "uključuje 1 suspendovanog");
  assert.equal(A.suspendedText(2), "uključuje 2 suspendovana");
});
t("ćirilično ime se prikazuje latinicom", () => {
  const z = roster.find((c) => c.id === 30204);
  assert.equal(z.name, "Željko Marković");
  assert.equal(A.audienceText([z]), "Željko M.");
});

console.log("— plan slanja");
t("cijeli spisak -> everyone", () => {
  const plan = A.sendPlan(roster, roster);
  assert.equal(plan.everyone, true);
  assert.equal(plan.count, 28);
});
t("izabrani -> nije everyone, ids u redoslijedu spiska", () => {
  const a = A.audienceOf(roster, { kind: "preset", key: "delivering" }, NOW);
  const plan = A.sendPlan(roster, a);
  assert.equal(plan.everyone, false);
  assert.deepEqual(plan.ids, ids(a));
});
t("potvrda od 10 primalaca", () => {
  assert.equal(A.CONFIRM_AT, 10);
  assert.equal(A.sendPlan(roster, roster.slice(0, 9)).confirm, false);
  assert.equal(A.sendPlan(roster, roster.slice(0, 10)).confirm, true);
  assert.equal(A.sendPlan(roster, roster.slice(0, 4)).confirm, false);
});
t("naziv publike", () => {
  const sel = { kind: "preset", key: "delivering" };
  const list = A.audienceOf(roster, sel, NOW);
  assert.equal(A.audienceLabel(A.sendPlan(roster, list), sel, list), "U dostavi");
  assert.equal(A.audienceLabel(A.sendPlan(roster, [roster[0]]), sel, [roster[0]]), "Amir Hodžić");
  const man = { kind: "manual", ids: new Set(ids(roster)) };
  assert.equal(A.audienceLabel(A.sendPlan(roster, roster), man, roster), "Svi kuriri");
  assert.equal(A.audienceLabel(A.sendPlan(roster, roster.slice(0, 3)), man, roster.slice(0, 3)), "Ručno izabrani");
});

console.log("— nacrt i šabloni");
t("provjera nacrta", () => {
  assert.equal(A.checkDraft({ title: "", body: "" }, 5).hint, "Upiši naslov i tekst poruke.");
  assert.equal(A.checkDraft({ title: "a", body: "" }, 5).hint, "Upiši tekst poruke.");
  assert.equal(A.checkDraft({ title: "", body: "b" }, 5).hint, "Upiši naslov.");
  assert.equal(A.checkDraft({ title: "a", body: "b" }, 0).hint, "Izaberi bar jednog kurira.");
  assert.equal(A.checkDraft({ title: "a", body: "b" }, 3).valid, true);
  assert.equal(A.checkDraft({ title: "  ", body: "  " }, 3).valid, false);
  const ph = A.checkDraft({ title: "Bonus", body: "bonus od ___ KM" }, 3);
  assert.equal(ph.valid, false);
  assert.match(ph.hint, /___/);
});
t("šabloni: samo bonus ima ___", () => {
  assert.deepEqual(A.TEMPLATES.filter((x) => /___/.test(x.body) || /___/.test(x.title)).map((x) => x.id), ["t4"]);
  assert.equal(A.TEMPLATES.length, 5);
});
t("odgovor servera: isti broj / manji broj", () => {
  assert.equal(A.sentText(25, 25).tone, "ok");
  assert.equal(A.sentText(1, 1).text, "Poruka poslata 1 kuriru.");
  const w = A.sentText(25, 28);
  assert.equal(w.tone, "warn");
  assert.match(w.text, /25 od 28/);
});
t("lični šabloni: pokvaren zapis ne ruši", () => {
  assert.deepEqual(A.parseTemplates(null), []);
  assert.deepEqual(A.parseTemplates("{"), []);
  assert.deepEqual(A.parseTemplates('{"a":1}'), []);
  const ok = { id: "u1", label: "L", category: "todo", title: "T", body: "B" };
  assert.deepEqual(A.parseTemplates(JSON.stringify([ok, { id: 1 }, { ...ok, category: "offer" }])), [ok]);
});
t("nacrt: čuvanje, vraćanje, starost, pokvaren zapis", () => {
  const sel = { kind: "manual", ids: new Set([30189, 30192]) };
  const raw = A.serializeDraft({ category: "todo", title: "T", body: "B" }, sel, NOW - 60_000);
  const back = A.parseDraft(raw, NOW);
  assert.equal(back.draft.title, "T");
  assert.deepEqual(back.sel, { kind: "manual", ids: [30189, 30192] });
  assert.deepEqual([...A.loadSelection(back.sel).ids], [30189, 30192]);
  assert.equal(A.parseDraft(raw, NOW + A.DRAFT_MAX_AGE_MS), null);
  assert.equal(A.parseDraft("{", NOW), null);
  assert.equal(A.parseDraft(null, NOW), null);
  assert.equal(A.parseDraft(A.serializeDraft({ category: "todo", title: " ", body: "" }, sel, NOW), NOW), null);
  const bad = JSON.stringify({ draft: { category: "offer", title: "x", body: "y" }, sel: { kind: "preset", key: "nope" }, at: NOW });
  const fixed = A.parseDraft(bad, NOW);
  assert.equal(fixed.draft.category, "announcement");
  assert.deepEqual(fixed.sel, { kind: "preset", key: "active" });
  assert.equal(A.isBlankDraft({ title: " ", body: "" }), true);
});

console.log("— praćenje čitanja");
const T0 = Date.parse("2026-10-05T12:00:00Z");
const batch = { category: "todo", title: "Javi se", body: "Javi se dispečeru", sentAt: T0, recipients: [1, 2, 3, 4], results: {} };
const row = (id, over = {}) => ({ id, sender: "dispatcher", category: "todo", title: "Javi se", body: "Javi se dispečeru", sentAt: new Date(T0 + 2000).toISOString(), read: false, ...over });
t("nalazi poruku istog teksta", () => assert.equal(A.matchSent(batch, [row(10)])?.id, 10));
t("razmaci oko teksta ne smetaju", () => assert.equal(A.matchSent(batch, [row(10, { title: " Javi se ", body: "Javi se dispečeru " })])?.id, 10));
t("druga kategorija / drugi tekst / ponuda se ne uzimaju", () => {
  assert.equal(A.matchSent(batch, [row(10, { category: "announcement" })]), null);
  assert.equal(A.matchSent(batch, [row(10, { body: "drugi tekst" })]), null);
  assert.equal(A.matchSent(batch, [row(10, { sender: "platform" })]), null);
});
t("prevelika razlika u vremenu se ne uzima", () => {
  assert.equal(A.matchSent(batch, [row(10, { sentAt: new Date(T0 + 20 * 60 * 1000).toISOString() })]), null);
  assert.equal(A.matchSent(batch, [row(10, { sentAt: new Date(T0 - 14 * 60 * 1000).toISOString() })])?.id, 10);
});
t("dva paketa istog teksta: svaki dobija svoju poruku", () => {
  const b2 = { ...batch, sentAt: T0 + 5 * 60 * 1000 };
  const rows2 = [row(11, { sentAt: new Date(T0 + 5 * 60 * 1000 + 1000).toISOString() }), row(10)];
  const first = A.matchSent(batch, rows2);
  const second = A.matchSent(b2, rows2, new Set([first.id]));
  assert.equal(first.id, 10);
  assert.equal(second.id, 11);
  assert.equal(A.matchSent(batch, [row(10)], new Set([10])), null);
});
t("claimedByOthers: samo isti tekst i kategorija", () => {
  const a = { ...batch, results: { 1: { state: "unread", inboxId: 5 } } };
  const b = { ...batch, results: { 1: { state: "unread", inboxId: 6 } } };
  const c = { ...batch, title: "drugi", results: { 1: { state: "unread", inboxId: 7 } } };
  assert.deepEqual([...A.claimedByOthers(a, [a, b, c])], [6]);
});
t("najbliža vremenu slanja pobjeđuje", () => {
  const rows3 = [row(20, { sentAt: new Date(T0 + 9 * 60 * 1000).toISOString() }), row(21, { sentAt: new Date(T0 + 1000).toISOString() })];
  assert.equal(A.matchSent(batch, rows3)?.id, 21);
});
t("zbir stanja", () => {
  const b = { ...batch, results: { 1: { state: "read", inboxId: 5 }, 2: { state: "unread", inboxId: 6 }, 3: { state: "missing", inboxId: null } } };
  assert.deepEqual(A.tally(b), { total: 4, read: 1, unread: 1, missing: 1, error: 0, pending: 1 });
  assert.deepEqual(A.unreadIds(b), [2]);
  assert.deepEqual(A.retractTargets(b), [{ courierId: 1, inboxId: 5 }, { courierId: 2, inboxId: 6 }]);
  assert.deepEqual(A.tally(batch), { total: 4, read: 0, unread: 0, missing: 0, error: 0, pending: 4 });
});
t("podsjetnik ne udvostručava prefiks", () => {
  assert.equal(A.reminderDraft(batch).title, "Podsjetnik: Javi se");
  assert.equal(A.reminderDraft({ ...batch, title: "Podsjetnik: Javi se" }).title, "Podsjetnik: Javi se");
});
t("praćenje samo do 40 primalaca", () => {
  assert.equal(A.canTrack({ recipients: Array.from({ length: 40 }, (_, i) => i) }), true);
  assert.equal(A.canTrack({ recipients: Array.from({ length: 41 }, (_, i) => i) }), false);
  assert.deepEqual(A.checkQuery(batch), { category: "todo", page: 1, perPage: 10 });
});
t("provjera staje kad padne više od trećine svih zahtjeva", () => {
  assert.equal(A.tooManyFailures(3, 25), false);
  assert.equal(A.tooManyFailures(8, 25), false);
  assert.equal(A.tooManyFailures(9, 25), true);
});

console.log("— poruke jednog kurira: spajanje tri kategorije");
const mkSrc = (key, times) => ({ key, done: false, page: 0, all: times.map((x, i) => ({ id: `${key}${i}`, sentAt: new Date(x).toISOString() })), buf: [] });
const pageOf = (s, per) => { const r = s.all.slice(s.page * per, (s.page + 1) * per); s.page += 1; if (s.page * per >= s.all.length) s.done = true; return r; };
const drive = (srcs, per, want) => {
  const all = [];
  let guard = 0;
  for (;;) {
    if (++guard > 1000) throw new Error("beskonačna petlja");
    const r = A.takeNext(srcs, want);
    all.push(...r.out);
    if (r.need.length) { for (const k of r.need) { const s = srcs.find((x) => x.key === k); s.buf.push(...pageOf(s, per)); } continue; }
    if (r.end || all.length >= want) break;
  }
  return all;
};
t("spojeno po vremenu, bez preskakanja", () => {
  const a = mkSrc("a", [100, 90, 80, 10]), b = mkSrc("b", [95, 5]), c = mkSrc("c", []);
  assert.deepEqual(drive([a, b, c], 2, 100).map((x) => x.id), ["a0", "b0", "a1", "a2", "a3", "b1"]);
});
t("svojstvo: 200 nasumičnih skupova daje isti redoslijed kao potpuno sortiranje", () => {
  const r = W.mulberry(7);
  for (let k = 0; k < 200; k++) {
    const mk = (key) => mkSrc(key, Array.from({ length: Math.floor(r() * 25) }, () => Math.floor(r() * 1e6)).sort((x, y) => y - x));
    const srcs = [mk("a"), mk("b"), mk("c")];
    const expect = srcs.flatMap((s) => s.all).sort((x, y) => Date.parse(y.sentAt) - Date.parse(x.sentAt)).map((x) => x.sentAt);
    const per = 1 + Math.floor(r() * 6);
    assert.deepEqual(drive(srcs, per, 1000).map((x) => x.sentAt), expect);
  }
});
t("traži samo toliko stranica koliko treba za prvih 10", () => {
  const a = mkSrc("a", Array.from({ length: 50 }, (_, i) => 1000 - i)), b = mkSrc("b", Array.from({ length: 50 }, (_, i) => 500 - i)), c = mkSrc("c", Array.from({ length: 50 }, (_, i) => 100 - i));
  assert.equal(drive([a, b, c], 10, 10).length, 10);
  assert.equal(a.page, 1);
  assert.ok(b.page <= 1 && c.page <= 1);
});
t("izvori: sve tri kategorije, bez ponude, ili jedna", () => {
  assert.deepEqual(A.newSources(null).map((s) => s.key), ["announcement", "todo", "promotion"]);
  assert.deepEqual(A.newSources("todo").map((s) => s.key), ["todo"]);
});

console.log("— pretraga i zadnja poruka");
const queries = ["hodzic", "Hodžić", "djuric", "zeljko", "Željko", "Жељко", "065", "123-456", "30189", "#30189", "amir hodzic", "hodzic amir"];
t("svih 12 upita nalazi bar jednog kurira (isti matchCourier kao Kuriri)", () => {
  assert.deepEqual(queries.filter((q) => !roster.some((c) => A.matchCourier(c, q))), []);
});
t("D13: ponuda nije zadnja poruka", () => {
  const sum = (category) => [{ courierId: 30189, lastMessage: { title: "Nova ponuda", sentAt: "2026-10-05T12:00:00Z", category, sender: "dispatcher" }, dispatcherUnreadCount: 58 }];
  const offer = A.buildRoster(rows, { summary: sum("offer") }).find((c) => c.id === 30189);
  assert.equal(offer.lastMsg, null);
  assert.equal(offer.unread, 58);
  const real = A.buildRoster(rows, { summary: sum("todo") }).find((c) => c.id === 30189);
  assert.equal(real.lastMsg.category, "todo");
});

console.log("— vrijeme");
t("dan i sat", () => {
  assert.equal(A.dayLabel(NOW - 3600_000, NOW), "Danas");
  assert.equal(A.dayLabel(NOW - 26 * 3600_000, NOW), "Juče");
  assert.equal(A.dayLabel(NOW - 9 * 86400_000, NOW), "26. sep");
  assert.equal(A.clock(new Date(2026, 9, 5, 7, 5).getTime()), "07:05");
  assert.equal(A.agoText(3), "upravo sad");
  assert.equal(A.agoText(125), "prije 2 min");
  assert.equal(A.agoText(2 * 86400), "prije 2 dana");
});

rmSync(dir, { recursive: true, force: true });
console.log(`\nUkupno: ${n - fail}/${n} prošlo`);
process.exit(fail ? 1 : 0);
