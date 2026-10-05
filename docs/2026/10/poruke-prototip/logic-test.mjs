// Provjera čiste logike ekrana Poruke u običnom Node-u.
import assert from "node:assert/strict";
import "./logic.js";
import "./world.js";

const M = globalThis.__M, W = globalThis.__MW;
let n = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); n++; console.log("  ✔", name); } catch (e) { fail++; n++; console.log("  ✘", name, "\n     ", String(e.message).split("\n")[0]); }
};

const world = W.build(0);
const roster = world.roster;
const ids = (l) => l.map((c) => c.id);

console.log("— množina i tekst");
t("kurir/kurira", () => {
  assert.equal(M.couriersText(1), "1 kurir");
  assert.equal(M.couriersText(2), "2 kurira");
  assert.equal(M.couriersText(5), "5 kurira");
  assert.equal(M.couriersText(11), "11 kurira");
  assert.equal(M.couriersText(21), "21 kurir");
  assert.equal(M.couriersText(22), "22 kurira");
});
t("dativ: 1 kuriru, 21 kuriru, 22 kurira", () => {
  assert.equal(M.sentWho(1), "1 kuriru");
  assert.equal(M.sentWho(21), "21 kuriru");
  assert.equal(M.sentWho(25), "25 kurira");
  assert.equal(M.sentWho(12), "12 kurira");
});

console.log("— grupe primalaca");
const counts = M.presetCounts(roster);
t("28 kurira u svijetu", () => assert.equal(roster.length, 28));
t("brojevi grupa", () => assert.deepEqual(counts, { active: 25, delivering: 4, online: 10, offline: 11, debt: 6, suspended: 3 }));
t("aktivni + suspendovani = svi", () => assert.equal(counts.active + counts.suspended, roster.length));
t("U dostavi + Slobodni + Offline = aktivni", () => assert.equal(counts.delivering + counts.online + counts.offline, counts.active));
t("Duguju gotovinu uključuje suspendovane (njima se opomena šalje)", () => {
  const d = M.audienceOf(roster, { kind: "preset", key: "debt" });
  assert.equal(d.length, 6);
  assert.equal(M.suspendedIn(d), 2);
});
t("Kurir bez signala je Offline, ne nigdje", () => {
  const off = ids(M.audienceOf(roster, { kind: "preset", key: "offline" }));
  assert.ok(off.includes(30201) && off.includes(30228) && off.includes(30249));
});
t("ručni izbor drži samo kurire koji postoje u spisku", () => {
  const a = M.audienceOf(roster, { kind: "manual", ids: new Set([30189, 99999, 30192]) });
  assert.deepEqual(ids(a), [30189, 30192]);
});
t("tekst primalaca", () => {
  const all = M.audienceOf(roster, { kind: "preset", key: "active" });
  assert.match(M.audienceText(all), /^Amir H\., Kenan M\., Aleksandar-Nemanja P\. i još 22$/);
  assert.equal(M.audienceText(all.slice(0, 2)), "Amir H. i Kenan M.");
  assert.equal(M.audienceText(all.slice(0, 1)), "Amir H.");
  assert.equal(M.audienceText([]), "");
});
t("ćirilično ime se prikazuje latinicom", () => {
  const z = roster.find((c) => c.id === 30204);
  assert.equal(M.shortName(z.first, z.last), "Željko M.");
});

console.log("— plan slanja");
t("cijeli spisak -> all_couriers", () => {
  const plan = M.sendPlan(roster, roster);
  assert.equal(plan.everyone, true);
  const r = M.requestFor({ category: "announcement", title: " T ", body: " B " }, plan);
  assert.deepEqual(r.body, { category: "announcement", title: "T", body: "B", all_couriers: true });
  assert.match(r.path, /broadcast$/);
});
t("izabrani -> courier_ids", () => {
  const a = M.audienceOf(roster, { kind: "preset", key: "delivering" });
  const plan = M.sendPlan(roster, a);
  assert.equal(plan.everyone, false);
  const r = M.requestFor({ category: "todo", title: "x", body: "y" }, plan);
  assert.equal(r.body.all_couriers, false);
  assert.deepEqual(r.body.courier_ids, ids(a));
});
t("jedan kurir -> njegovo sanduče, sa sender", () => {
  const plan = M.sendPlan(roster, [roster[0]]);
  const r = M.requestFor({ category: "todo", title: "x", body: "y" }, plan);
  assert.equal(r.path, "/couriers/30189/inbox");
  assert.equal(r.body.sender, "dispatcher");
  assert.equal(r.body.courier_ids, undefined);
});
t("potvrda od 10 primalaca", () => {
  assert.equal(M.sendPlan(roster, roster.slice(0, 9)).confirm, false);
  assert.equal(M.sendPlan(roster, roster.slice(0, 10)).confirm, true);
  assert.equal(M.sendPlan(roster, roster.slice(0, 4)).confirm, false);
});
t("provjera nacrta", () => {
  assert.equal(M.checkDraft({ title: "", body: "" }, 5).hint, "Upiši naslov i tekst poruke.");
  assert.equal(M.checkDraft({ title: "a", body: "" }, 5).hint, "Upiši tekst poruke.");
  assert.equal(M.checkDraft({ title: "", body: "b" }, 5).hint, "Upiši naslov.");
  assert.equal(M.checkDraft({ title: "a", body: "b" }, 0).hint, "Izaberi bar jednog kurira.");
  assert.equal(M.checkDraft({ title: "a", body: "b" }, 3).valid, true);
  assert.equal(M.checkDraft({ title: "  ", body: "  " }, 3).valid, false);
  const ph = M.checkDraft({ title: "Bonus", body: "bonus od ___ KM" }, 3);
  assert.equal(ph.valid, false);
  assert.match(ph.hint, /___/);
});
t("šabloni: svi imaju kategoriju koju dispečer smije; samo bonus ima ___", () => {
  for (const x of M.TEMPLATES) assert.ok(M.CAT_ORDER.includes(x.category), x.id);
  assert.deepEqual(M.TEMPLATES.filter((x) => /___/.test(x.body) || /___/.test(x.title)).map((x) => x.id), ["t4"]);
});
t("odgovor servera: isti broj / manji broj", () => {
  assert.equal(M.sentText(25, 25).tone, "ok");
  assert.equal(M.sentText(1, 1).text, "Poruka poslata 1 kuriru.");
  const w = M.sentText(25, 28);
  assert.equal(w.tone, "warn");
  assert.match(w.text, /25 od 28/);
});

console.log("— praćenje čitanja");
const T0 = Date.parse("2026-10-05T12:00:00Z");
const batch = { category: "todo", title: "Javi se", body: "Javi se dispečeru", sentAt: T0, recipients: [1, 2, 3, 4] };
const row = (id, over = {}) => ({ id, sender: "dispatcher", category: "todo", title: "Javi se", body: "Javi se dispečeru", sent_at: new Date(T0 + 2000).toISOString(), read: false, ...over });
t("nalazi poruku istog teksta", () => assert.equal(M.matchSent(batch, [row(10)])?.id, 10));
t("razmaci oko teksta ne smetaju", () => assert.equal(M.matchSent(batch, [row(10, { title: " Javi se ", body: "Javi se dispečeru " })])?.id, 10));
t("druga kategorija / drugi tekst / ponuda se ne uzimaju", () => {
  assert.equal(M.matchSent(batch, [row(10, { category: "announcement" })]), null);
  assert.equal(M.matchSent(batch, [row(10, { body: "drugi tekst" })]), null);
  assert.equal(M.matchSent(batch, [row(10, { sender: "platform" })]), null);
});
t("prevelika razlika u vremenu (isti tekst poslan sjutradan) se ne uzima", () => {
  assert.equal(M.matchSent(batch, [row(10, { sent_at: new Date(T0 + 20 * 60 * 1000).toISOString() })]), null);
  assert.equal(M.matchSent(batch, [row(10, { sent_at: new Date(T0 - 14 * 60 * 1000).toISOString() })])?.id, 10);
});
t("dva paketa istog teksta: svaki dobija svoju poruku", () => {
  const b2 = { ...batch, sentAt: T0 + 5 * 60 * 1000 };
  const rows = [row(11, { sent_at: new Date(T0 + 5 * 60 * 1000 + 1000).toISOString() }), row(10)];
  const first = M.matchSent(batch, rows);
  const second = M.matchSent(b2, rows, new Set([first.id]));
  assert.equal(first.id, 10);
  assert.equal(second.id, 11);
  assert.equal(M.matchSent(batch, [row(10)], new Set([10])), null);
});
t("najbliža vremenu slanja pobjeđuje", () => {
  const rows = [row(20, { sent_at: new Date(T0 + 9 * 60 * 1000).toISOString() }), row(21, { sent_at: new Date(T0 + 1000).toISOString() })];
  assert.equal(M.matchSent(batch, rows)?.id, 21);
});
t("zbir stanja", () => {
  const res = new Map([[1, { state: "read", inboxId: 5 }], [2, { state: "unread", inboxId: 6 }], [3, { state: "missing" }]]);
  assert.deepEqual(M.tally(batch, res), { total: 4, read: 1, unread: 1, missing: 1, error: 0, pending: 1 });
  assert.deepEqual(M.unreadIds(batch, res), [2]);
  assert.deepEqual(M.retractTargets(batch, res), [{ courierId: 1, inboxId: 5 }, { courierId: 2, inboxId: 6 }]);
  assert.deepEqual(M.tally(batch, null), { total: 4, read: 0, unread: 0, missing: 0, error: 0, pending: 4 });
});
t("podsjetnik ne udvostručava prefiks", () => {
  assert.equal(M.reminderDraft(batch).title, "Podsjetnik: Javi se");
  assert.equal(M.reminderDraft({ ...batch, title: "Podsjetnik: Javi se" }).title, "Podsjetnik: Javi se");
});
t("praćenje samo do 40 primalaca", () => {
  assert.equal(M.canTrack({ recipients: Array.from({ length: 40 }, (_, i) => i) }), true);
  assert.equal(M.canTrack({ recipients: Array.from({ length: 41 }, (_, i) => i) }), false);
  assert.deepEqual(M.checkQuery(batch), { category: "todo", page: 1, per_page: 10 });
});

console.log("— poruke jednog kurira: spajanje tri kategorije");
const mkSrc = (key, times) => ({ key, done: false, page: 0, all: times.map((x, i) => ({ id: `${key}${i}`, sent_at: new Date(x).toISOString() })), buf: [] });
const pageOf = (s, per) => { const rows = s.all.slice(s.page * per, (s.page + 1) * per); s.page += 1; if (s.page * per >= s.all.length) s.done = true; return rows; };
const drive = (srcs, per, want) => {
  const all = [];
  let guard = 0;
  for (;;) {
    if (++guard > 1000) throw new Error("beskonačna petlja");
    const r = M.takeNext(srcs, want);
    all.push(...r.out);
    if (r.need.length) { for (const k of r.need) { const s = srcs.find((x) => x.key === k); s.buf.push(...pageOf(s, per)); } continue; }
    if (r.end || all.length >= want) break;
  }
  return all;
};
t("spojeno po vremenu, bez preskakanja", () => {
  const a = mkSrc("a", [100, 90, 80, 10]), b = mkSrc("b", [95, 5]), c = mkSrc("c", []);
  const out = drive([a, b, c], 2, 100);
  assert.deepEqual(out.map((x) => x.id), ["a0", "b0", "a1", "a2", "a3", "b1"]);
});
t("svojstvo: 200 nasumičnih skupova daje isti redoslijed kao potpuno sortiranje", () => {
  const r = W.mulberry(7);
  for (let k = 0; k < 200; k++) {
    const mk = (key) => mkSrc(key, Array.from({ length: Math.floor(r() * 25) }, () => Math.floor(r() * 1e6)).sort((x, y) => y - x));
    const srcs = [mk("a"), mk("b"), mk("c")];
    const expect = srcs.flatMap((s) => s.all).sort((x, y) => Date.parse(y.sent_at) - Date.parse(x.sent_at)).map((x) => x.sent_at);
    const per = 1 + Math.floor(r() * 6);
    const got = drive(srcs, per, 1000).map((x) => x.sent_at);
    assert.deepEqual(got, expect);
  }
});
t("traži samo toliko stranica koliko treba za prvih 10", () => {
  const a = mkSrc("a", Array.from({ length: 50 }, (_, i) => 1000 - i)), b = mkSrc("b", Array.from({ length: 50 }, (_, i) => 500 - i)), c = mkSrc("c", Array.from({ length: 50 }, (_, i) => 100 - i));
  const out = drive([a, b, c], 10, 10);
  assert.equal(out.length, 10);
  assert.equal(a.page, 1);
  assert.ok(b.page <= 1 && c.page <= 1);
});

console.log("— tekst poruke");
t("telefon i link postaju dodirljivi, datum ne", () => {
  const s = M.linkify("Javi se na 051 123 456 do 03/10/2026. Vidi www.ordera.app/raspored.");
  const links = s.filter((x) => x.type === "link");
  assert.equal(links.length, 2);
  assert.equal(links[0].href, "tel:051123456");
  assert.equal(links[1].href, "https://www.ordera.app/raspored");
});
t("ćirilica u naslovu se prikazuje latinicom", () => assert.equal(M.toLatin("Жељко"), "Željko"));

console.log("— pretraga");
const queries = ["hodzic", "Hodžić", "djuric", "zeljko", "Željko", "Жељко", "065", "123-456", "30189", "#30189", "amir hodzic", "hodzic amir"];
t("svih 12 upita nalazi bar jednog kurira", () => {
  const miss = queries.filter((q) => !roster.some((c) => M.matchCourier(c, q)));
  assert.deepEqual(miss, []);
});

console.log("— vrijeme");
t("dan i sat", () => {
  const now = W.NOW_MS;
  assert.equal(M.dayLabel(now - 3600_000, now), "Danas");
  assert.equal(M.dayLabel(now - 26 * 3600_000, now), "Juče");
  assert.equal(M.dayLabel(now - 9 * 86400_000, now), "26. sep");
  assert.equal(M.clock(new Date(2026, 9, 5, 7, 5).getTime()), "07:05");
});

console.log(`\nUkupno: ${n - fail}/${n} prošlo`);
process.exit(fail ? 1 : 0);
