// Provjere čiste logike (običan Node, bez browsera). Izlaz: broj prošlih provjera + metrics-logic.json sa brojevima za tekst table.
import { createRequire } from "node:module";
import fs from "node:fs";
import { buildCouriers } from "../e2e/fx.mjs";
import { buildFinanceWorld, serveFinance } from "../e2e/fin-fx.mjs";
const require = createRequire(import.meta.url);
const FC = require("./logic.js");

let ok = 0, bad = 0;
const check = (name, cond, detail = "") => { if (cond) ok++; else { bad++; console.log(`  ✘ ${name}${detail ? " — " + detail : ""}`); } };
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const near = (name, a, b) => check(name, Math.abs(a - b) < 0.005, `${a} != ${b}`);

const NOW = Date.parse("2026-10-06T12:20:00.000Z");
const now = new Date(NOW);
const couriers = buildCouriers(24, { now });
const F = buildFinanceWorld({ now, couriers });
const get = (p, q = "") => serveFinance(F, { pth: p, method: "GET", body: null, q: new URLSearchParams(q) })[1].data;
const CO = "/dispatcher/delivery-companies/24";
const balances = get(`${CO}/couriers-balance`), pending = get(`${CO}/cash-handovers/pending`);
const book = FC.buildBook({ balances, couriers, pending, limit: 200 });
const M = {};

/* ---- brojevi, novac, množina ---- */
eq("toAmount broj", FC.toAmount(12.5), 12.5);
eq("toAmount tekst", FC.toAmount("12.50"), 12.5);
eq("toAmount zarez", FC.toAmount(" 12,5 "), 12.5);
eq("toAmount prazno", FC.toAmount("  "), null);
eq("toAmount slova", FC.toAmount("abc"), null);
eq("toAmount NaN", FC.toAmount(NaN), null);
eq("toAmount null", FC.toAmount(null), null);
eq("money", FC.money(180.7), "180.70 KM");
eq("money valuta", FC.money(5, "EUR"), "5.00 EUR");
eq("absMoney", FC.absMoney(-45.5), "45.50 KM");
eq("signed minus", FC.signed(-5.24), "−5.24 KM");
eq("signed plus", FC.signed(2), "+2.00 KM");
eq("signed nula", FC.signed(0), "0.00 KM");
eq("plural 1", FC.plural(1, "kurir", "kurira", "kurira"), "kurir");
eq("plural 3", FC.plural(3, "kurir", "kurira", "kurira"), "kurira");
eq("plural 12", FC.plural(12, "kurir", "kurira", "kurira"), "kurira");
eq("plural 21", FC.plural(21, "kurir", "kurira", "kurira"), "kurir");
eq("couriersText", FC.couriersText(10), "10 kurira");

/* ---- tekst i pretraga: isti upiti kao na staroj stranici (tamo 5 od 12) ---- */
eq("toLatin ćirilica", FC.toLatin("Жељко Марковић"), "Željko Marković");
eq("fold", FC.fold("Đurić Čolić"), "djuric colic");
eq("needle #", FC.needle(" #4258 "), "4258");
eq("initials 2 riječi", FC.initials("Amir Hodžić"), "AH");
eq("initials ćirilica", FC.initials("Жељко Марковић"), "ŽM");
eq("initials jedna", FC.initials("Kurir"), "K");
eq("initials prazno", FC.initials(""), "?");
const ids = (q) => book.filter((r) => FC.matchCourier(r, q)).map((r) => r.id).sort((a, b) => a - b);
const Q = [
  ["hodzic", [30189]], ["Hodžić", [30189]], ["zeljko", [30234, 30239]], ["željko", [30234, 30239]], ["djuric", [30234, 30255]], ["đurić", [30234, 30255]],
  ["марковић", [30239, 30242, 30253]], ["Zeljko Djuric", [30234]], ["065/123-456", [30234]], ["065123456", [30234]], ["+387 65 123 456", [30234]], ["30189", [30189]],
];
let found = 0;
for (const [q, exp] of Q) { const got = ids(q); const hit = JSON.stringify(got) === JSON.stringify(exp); if (hit) found++; eq(`pretraga "${q}"`, got, exp); }
M.searchFound = found; M.searchTotal = Q.length;
eq("pretraga prazna = svi", ids("").length, book.length);
eq("pretraga #ID", ids("#30189"), [30189]);
eq("pretraga djelimičan telefon 3 cifre", ids("123").includes(30234), true);

/* ---- knjiga ---- */
const row = (id) => book.find((r) => r.id === id);
eq("knjiga: redova", book.length, 26);
eq("knjiga: siroče nije u firmi", row(29980).inFirm, false);
eq("knjiga: kurir u firmi", row(30189).inFirm, true);
eq("knjiga: ime ćirilica -> latinica", row(30204).name, FC.toLatin(couriers.find((c) => c.courier_id === 30204).name));
eq("knjiga: gotovina", row(30189).cash, 180.7);
eq("knjiga: zarada", row(30189).wage, 6);
eq("knjiga: nivo blizu (90%)", row(30189).level, "near");
eq("knjiga: nivo preko", row(30192).level, "over");
eq("knjiga: nivo preko 2", row(30195).level, "over");
eq("knjiga: nivo blizu (82%)", row(30234).level, "near");
eq("knjiga: negativna gotovina", row(30210).level, "none");
eq("knjiga: pct 90", row(30189).pctRaw, 90);
eq("knjiga: pct negativne gotovine je null", row(30210).pct, null);
eq("knjiga: predaja spojena", row(30189).pending.map((p) => p.amount), [95.24]);
eq("knjiga: predaja suma", row(30192).pendingSum, 214.5);
eq("knjiga: bez predaje", row(30195).pending.length, 0);
eq("knjiga: suspendovan", row(30198).suspended, true);
eq("knjiga: ugovor tekst", row(30189).pay, "Po dostavi · 2.00 KM");
check("knjiga: žiro račun", row(30189).bank.startsWith("161-"));
eq("knjiga: IBAN", row(30189).iban, "BA39 1990 4401 2345 6789");
eq("knjiga: nulti", row(30207).zero, true);
eq("knjiga: dispečerski nalog je nulti", row(30369).zero, true);
// predaja kurira kojeg nema u balansu ne smije nestati
const b2 = FC.buildBook({ balances: balances.filter((b) => b.courier_id !== 30189), couriers, pending, limit: 200 });
eq("knjiga: predaja bez balansa se čuva", b2.find((r) => r.id === 30189) && b2.find((r) => r.id === 30189).pending.length, 1);
eq("knjiga: ime bez balansa iz liste kurira", b2.find((r) => r.id === 30189).name, "Amir Hodžić");
// iznosi kao tekst (Laravel decimal) ne ruše knjigu
const bs = FC.buildBook({ balances: balances.map((b) => ({ ...b, cash_owed_to_company: b.cash_owed_to_company.toFixed(2), wage_owed_to_courier: b.wage_owed_to_courier.toFixed(2) })), couriers, pending: pending.map((p) => ({ ...p })), limit: 200 });
eq("knjiga: iznosi kao tekst", bs.find((r) => r.id === 30189).cash, 180.7);
eq("knjiga: iznos null = 0", FC.buildBook({ balances: [{ courier_id: 1, name: "X", cash_owed_to_company: null, wage_owed_to_courier: undefined }], couriers: [], pending: [], limit: null })[0].zero, true);
eq("knjiga: bez limita nema nivoa 'blizu'", FC.buildBook({ balances: [{ courier_id: 1, name: "X", cash_owed_to_company: 999, wage_owed_to_courier: 0 }], couriers: [], pending: [], limit: null })[0].level, "ok");
eq("knjiga: limit 0 je strog", FC.buildBook({ balances: [{ courier_id: 1, name: "X", cash_owed_to_company: 1, wage_owed_to_courier: 0 }], couriers: [], pending: [], limit: 0 })[0].level, "over");

/* ---- brojevi za pločice ---- */
const c = FC.counts(book, NOW);
const sumPos = balances.filter((b) => b.cash_owed_to_company > 0).reduce((s, b) => s + b.cash_owed_to_company, 0);
const sumWage = balances.filter((b) => b.wage_owed_to_courier > 0).reduce((s, b) => s + b.wage_owed_to_courier, 0);
near("brojevi: Σ gotovina", c.sumCash, sumPos); near("brojevi: Σ zarada", c.sumWage, sumWage);
eq("brojevi: predaje", c.pendingN, 4); near("brojevi: Σ predaja", c.pendingSum, 429.74);
eq("brojevi: najstarija kasni", c.oldestOverdue, true);
eq("brojevi: najstarija", c.oldestAt, pending[0].reported_at);
eq("brojevi: duguju", c.debt, 12); eq("brojevi: preko limita", c.over, 2); eq("brojevi: blizu", c.near, 2); eq("brojevi: limit", c.limit, 4);
eq("brojevi: za isplatu", c.wage, 10); eq("brojevi: nulti", c.zero, 9); eq("brojevi: svi (bez nultih)", c.all, 17);
near("brojevi: kredit", c.credit, 45.5);
M.sumCash = c.sumCash; M.sumWage = c.sumWage; M.pendingSum = c.pendingSum; M.over = c.over; M.near = c.near; M.debt = c.debt; M.wageN = c.wage;

/* ---- filteri i redoslijed ---- */
eq("filter svi skriva nulte", FC.filterBook(book, { filter: "all" }).length, 17);
eq("filter svi + pretraga pokazuje nulti", FC.filterBook(book, { filter: "all", q: "Lazar" }).length >= 1, true);
eq("filter svi + pretraga nultog kurira", FC.filterBook(book, { filter: "all", q: "30207" }).map((r) => r.id), [30207]);
eq("filter čeka", FC.filterBook(book, { filter: "pending" }).length, 4);
eq("filter duguju", FC.filterBook(book, { filter: "debt" }).length, 12);
eq("filter limit", FC.filterBook(book, { filter: "limit" }).map((r) => r.id).sort(), [30189, 30192, 30195, 30234]);
eq("filter za isplatu", FC.filterBook(book, { filter: "wage" }).length, 10);
eq("filter nulti", FC.filterBook(book, { filter: "zero" }).length, 9);
eq("filter + pretraga se sabiraju", FC.filterBook(book, { filter: "limit", q: "Hodžić" }).map((r) => r.id), [30189]);
eq("filter nepoznat = svi", FC.parseFilter("xyz"), "all"); eq("sort nepoznat = debt", FC.parseSort("xyz"), "debt");
eq("sort debt: prvi", FC.sortBook(book, "debt")[0].id, 30195);
eq("sort debt: opada", FC.sortBook(book, "debt").every((r, i, a) => i === 0 || a[i - 1].cash >= r.cash), true);
eq("sort wage: prvi", FC.sortBook(book, "wage")[0].id, 30204);
eq("sort age: prva je najstarija predaja", FC.sortBook(book, "age")[0].id, 30210);
eq("sort age: redovi bez predaje su na kraju", FC.sortBook(book, "age").slice(0, 4).every((r) => r.pending.length === 1), true);
eq("sort name: azbučno bez dijakritika", FC.sortBook(book, "name").slice(0, 3).map((r) => r.name.charAt(0)), ["A", "A", "A"]);
eq("sort ne mijenja ulaz", book[0].id, balances[0].courier_id);

/* ---- vrijeme (isti tekstovi kao relativeTime u aplikaciji) ---- */
eq("ageText 12 min", FC.ageText(pending[3].reported_at, NOW), "pre 12 min");
eq("ageText 3h", FC.ageText(pending[2].reported_at, NOW), "pre 3h");
eq("ageText 1 dan", FC.ageText(pending[1].reported_at, NOW), "pre 1 dan");
eq("ageText 3 dana", FC.ageText(pending[0].reported_at, NOW), "pre 3 dana");
eq("ageText upravo", FC.ageText(new Date(NOW - 2000).toISOString(), NOW), "upravo sad");
eq("ageText sekunde", FC.ageText(new Date(NOW - 30000).toISOString(), NOW), "pre 30s");
eq("overdue granica", FC.overdue(new Date(NOW - 24 * 3600_000).toISOString(), NOW), false);
eq("overdue poslije granice", FC.overdue(new Date(NOW - 24 * 3600_000 - 1000).toISOString(), NOW), true);
eq("dayKey (+02:00)", FC.dayKey("2026-10-06T22:30:00.000Z"), "2026-10-07");
eq("hm", FC.hm("2026-10-06T12:20:00.000Z"), "14:20");
eq("dateTimeShort", FC.dateTimeShort("2026-10-06T12:20:00.000Z"), "6. okt 14:20");
eq("dayLabel danas", FC.dayLabel("2026-10-06", NOW), "Danas");
eq("dayLabel juče", FC.dayLabel("2026-10-05", NOW), "Juče");
eq("dayLabel dalje", FC.dayLabel("2026-10-04", NOW), "ned, 4. okt");
eq("addDaysKey preko mjeseca", FC.addDaysKey("2026-10-01", -1), "2026-09-30");
eq("addDaysKey preko godine", FC.addDaysKey("2026-12-31", 1), "2027-01-01");

/* ---- nivo limita ---- */
eq("levelOf nula", FC.levelOf(0, 200), "none"); eq("levelOf negativno", FC.levelOf(-5, 200), "none"); eq("levelOf null saldo", FC.levelOf(null, 200), "none");
eq("levelOf ok", FC.levelOf(100, 200), "ok"); eq("levelOf blizu", FC.levelOf(160, 200), "near"); eq("levelOf baš na limitu", FC.levelOf(200, 200), "over"); eq("levelOf bez limita", FC.levelOf(500, null), "ok");
eq("summarize ostaje", FC.summarize(150, 200).remaining, 50); eq("summarize višak", FC.summarize(230, 200).exceeded, 30); eq("summarize pct preko 100", FC.summarize(300, 200).percent, 100);

/* ---- potvrda predaje ---- */
const cc = (text, reported, owed) => FC.confirmCheck({ text, reported, owed });
eq("potvrda: isti iznos", [cc("95.24", 95.24, 180.7).valid, cc("95.24", 95.24, 180.7).diff, cc("95.24", 95.24, 180.7).msgs[0].tone], [true, 0, "ok"]);
eq("potvrda: dug poslije", cc("95.24", 95.24, 180.7).after, 85.46);
eq("potvrda: razlika manja", cc("90", 95.24, 180.7).diff, -5.24);
check("potvrda: tekst razlike", cc("90", 95.24, 180.7).msgs[0].text.includes("−5.24 KM"));
eq("potvrda: razlika ima ton", cc("90", 95.24, 180.7).msgs[0].tone, "warn");
eq("potvrda: veća od prijave", cc("100", 95.24, 180.7).diff, 4.76);
eq("potvrda: veće od duga upozorava", cc("300", 95.24, 214.5).msgs.some((m) => /Veće je od duga/.test(m.text)), true);
eq("potvrda: veće od duga ipak vrijedi", cc("300", 95.24, 214.5).valid, true);
eq("potvrda: negativan dug ne upozorava na dug", cc("10", 10, -5).msgs.some((m) => /duga/.test(m.text)), false);
eq("potvrda: nula", cc("0", 10, 10).valid, false);
eq("potvrda: prazno", cc("", 10, 10).hint, "Upiši iznos veći od 0.");
eq("potvrda: slova", cc("abc", 10, 10).valid, false);
eq("potvrda: tri decimale", cc("10.123", 10, 10).valid, false);
eq("potvrda: zarez", cc("10,5", 10.5, 20).amount, 10.5);
eq("potvrda: bez poznatog duga", cc("5", 5, null).after, null);
eq("potvrda: poslije potvrde dug negativan", cc("50", 50, 40).after, -10);

/* ---- uplata i isplata ---- */
const ec = (mode, text, owed) => FC.entryCheck({ mode, text, owed });
eq("uplata: ostaje dug", ec("receipt", "100", 180.7).msg.text, "Ostaje dug 80.70 KM.");
eq("uplata: zatvara dug", ec("receipt", "180.70", 180.7).msg.text, "Dug se zatvara.");
eq("uplata: veće od duga", ec("receipt", "999", 45.5).msg.tone, "warn");
check("uplata: tekst veće od duga", ec("receipt", "999", 45.5).msg.text.startsWith("Veće je od duga za 953.50 KM"));
eq("isplata: cijela", ec("payout", "6", 6).msg.text, "Zarada se isplaćuje u cijelosti.");
eq("isplata: ostaje", ec("payout", "2", 6).msg.text, "Ostaje 4.00 KM.");
eq("isplata: veće od dugovanja", ec("payout", "10", 6).msg.text.startsWith("Veće je od dugovanja za 4.00 KM"), true);
eq("isplata: nula nevažeća", ec("payout", "0", 6).valid, false);
eq("isplata: bez poznate zarade", ec("payout", "5", null).msg, null);

/* ---- isplata svima ---- */
const plan = FC.payoutPlan(book);
eq("isplata svima: broj", plan.items.length, 10); near("isplata svima: zbir", plan.total, 633.68);
eq("isplata svima: samo zarada > 0", plan.items.every((i) => i.amount > 0), true);
eq("isplata svima: abecedno", plan.items.map((i) => i.name), plan.items.map((i) => i.name).slice().sort((a, b) => FC.fold(a).localeCompare(FC.fold(b), "sr")));
M.planN = plan.items.length; M.planTotal = plan.total;
const run = async () => {
  let inflight = 0, max = 0;
  const log = [];
  const items = Array.from({ length: 8 }, (_, i) => ({ id: i + 1 }));
  const res = await FC.runBatch(items, async (it) => { inflight++; max = Math.max(max, inflight); await new Promise((r) => setTimeout(r, 15)); inflight--; if (it.id === 3) throw new Error("Server ne odgovara."); if (it.id === 5) return { ok: false, message: "422" }; return { ok: true, warning: it.id === 7 ? "w" : undefined }; }, { concurrency: 3, onUpdate: (id, s) => log.push(`${id}:${s.state}`) });
  eq("serija: najviše 3 istovremeno", max, 3);
  eq("serija: sažetak", FC.batchSummary(res), { ok: 6, failed: 2, warnings: 1 });
  eq("serija: pad jednog ne zaustavlja ostale", Object.keys(res).length, 8);
  eq("serija: izuzetak postaje neuspjeh sa porukom", res[3], { ok: false, message: "Server ne odgovara." });
  eq("serija: svaki red dobije run pa ishod", log.filter((l) => l.endsWith(":run")).length, 8);
  eq("serija: prazan spisak", Object.keys(await FC.runBatch([], async () => ({ ok: true }))).length, 0);
  M.batchMax = max;
};
await run();

/* ---- promet ---- */
eq("period danas", FC.periodRange("today", NOW), { from: "2026-10-06", to: "2026-10-06" });
eq("period 7 dana", FC.periodRange("7d", NOW), { from: "2026-09-30", to: "2026-10-06" });
eq("period ovaj mjesec", FC.periodRange("month", NOW), { from: "2026-10-01", to: "2026-10-06" });
eq("period prošli mjesec", FC.periodRange("prev", NOW), { from: "2026-09-01", to: "2026-09-30" });
eq("period januar -> decembar", FC.periodRange("prev", Date.parse("2027-01-15T10:00:00Z")), { from: "2026-12-01", to: "2026-12-31" });
eq("način iz napomene", FC.methodOf("Isplata kuriru (bankovni transfer)"), "bankovni transfer");
eq("način: gotovina", FC.methodOf("Isplata kuriru (gotovina)"), "gotovina");
eq("način: nepoznat", FC.methodOf("Isplata za avgust"), null);
eq("način: prazno", FC.methodOf(null), null);
const hist = get(`${CO}/cash-handovers`), pays = get(`${CO}/payouts`);
const nameOf = (id) => (balances.find((b) => b.courier_id === id) || {}).name || `Kurir #${id}`;
const J = FC.buildJournal({ handovers: hist, payouts: pays, nameOf });
eq("promet: spojeno", J.length, hist.length + pays.length);
eq("promet: najnovije prvo", J.every((r, i, a) => i === 0 || FC.ms(a[i - 1].at) >= FC.ms(r.at)), true);
eq("promet: na čekanju koristi vrijeme prijave", J.find((r) => r.key === "h903").at, pending[3].reported_at);
eq("promet: razlika potvrđene", J.find((r) => r.key === "h699").diff, -5);
eq("promet: razlika na čekanju je 0", J.find((r) => r.key === "h903").diff, 0);
eq("promet: iznos potvrđene je potvrđeni", J.find((r) => r.key === "h699").amount, 92.79);
eq("promet: iznos čekanja je prijavljeni", J.find((r) => r.key === "h903").amount, 95.24);
eq("promet: isplata sa načinom", J.filter((r) => r.kind === "payout").every((r) => r.method === "gotovina" || r.method === "bankovni transfer"), true);
eq("promet: prazan ulaz", FC.buildJournal({ handovers: [], payouts: [], nameOf }).length, 0);
eq("promet: red bez iznosa se preskače", FC.buildJournal({ handovers: [{ id: 1, courier_id: 1, reported_amount: "x", status: "confirmed" }], payouts: [{ id: 1, courier_id: 1, amount: null }], nameOf }).length, 0);
const T = FC.journalTotals(J);
eq("promet: čekanja", T.pendingN, 4); eq("promet: potvrđene", T.inN, hist.filter((h) => h.status === "confirmed").length); eq("promet: isplate", T.outN, 22);
near("promet: Σ potvrđenih", T.inSum, hist.filter((h) => h.status === "confirmed").reduce((s, h) => s + Number(h.confirmed_amount), 0));
near("promet: Σ isplata", T.outSum, pays.reduce((s, p) => s + Number(p.amount), 0));
const withDiff = hist.filter((h) => h.status === "confirmed" && h.reported_amount !== h.confirmed_amount);
eq("promet: broj razlika", T.diffN, withDiff.length);
near("promet: Σ razlika", T.diffSum, withDiff.reduce((s, h) => s + Number(h.confirmed_amount) - Number(h.reported_amount), 0));
M.diffN = T.diffN; M.confirmedN = T.inN; M.historyN = hist.length; M.payoutN = pays.length;
eq("filter: samo predaje", FC.filterJournal(J, { type: "handover" }).every((r) => r.kind === "handover"), true);
eq("filter: samo isplate", FC.filterJournal(J, { type: "payout" }).length, 22);
eq("filter: samo razlike", FC.filterJournal(J, { diffOnly: true }).length, withDiff.length);
eq("filter: kurir", FC.filterJournal(J, { courier: 30189 }).every((r) => r.courierId === 30189), true);
eq("filter: kurir + razlike", FC.filterJournal(J, { courier: 30189, diffOnly: true }).map((r) => r.key).sort(), withDiff.filter((h) => h.courier_id === 30189).map((h) => `h${h.id}`).sort());
check("filter: kurir + razlike sadrži stvarni slučaj 97.79 -> 92.79", FC.filterJournal(J, { courier: 30189, diffOnly: true }).some((r) => r.key === "h699"));
const G = FC.groupDays(J, NOW);
eq("dani: zbir redova", G.reduce((s, g) => s + g.rows.length, 0), J.length);
eq("dani: prvi je danas", G[0].label, "Danas");
eq("dani: ključevi opadaju", G.every((g, i, a) => i === 0 || a[i - 1].key > g.key), true);
near("dani: Σ po danima = ukupno predaje", G.reduce((s, g) => s + g.inSum, 0), T.inSum);
near("dani: Σ po danima = ukupno isplate", G.reduce((s, g) => s + g.outSum, 0), T.outSum);
M.dayGroups = G.length;

/* ---- CSV ---- */
const csv = FC.toCsv(J.slice(0, 5));
const lines = csv.split("\r\n");
eq("csv: zaglavlje", lines[0].split(";").length, 13); eq("csv: redova", lines.length, 6);
check("csv: decimalni zarez", /;\d+,\d{2};/.test(lines[1]));
eq("csv: bez tačke u iznosu", /;\d+\.\d{2};/.test(lines[1]), false);
eq("csv: injekcija", FC.csvText("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
eq("csv: plus", FC.csvText("+387"), "'+387");
eq("csv: razdvajač u tekstu", FC.csvText("a;b"), "\"a;b\"");
eq("csv: navodnici", FC.csvText('a"b'), '"a""b"');
eq("csv: obično", FC.csvText("Amir"), "Amir");
eq("csv: prazno", FC.csvText(null), "");
eq("csv: naziv", FC.csvName(NOW), "finansije-2026-10-06.csv");
const withNote = FC.toCsv([{ ...J[0], note: "=cmd|' /C calc'!A0", name: "-2+3" }]);
check("csv: napomena i ime neutralisani", withNote.includes("'=cmd") && withNote.includes("'-2+3"));
eq("csv: prazan spisak ima samo zaglavlje", FC.toCsv([]).split("\r\n").length, 1);

/* ---- server (isti kao mock stranice): osnovna pravila koja prototip koristi ---- */
const post = (p, body) => serveFinance(F, { pth: p, method: "POST", body, q: new URLSearchParams() });
const before = get(`${CO}/couriers-balance`).find((b) => b.courier_id === 30189).cash_owed_to_company;
const r1 = post("/dispatcher/cash-handovers/903/confirm", { confirmed_amount: 90 });
eq("server: potvrda 200", r1[0], 200); eq("server: razlika upisana", r1[1].handover.note, "Razlika: prijavljeno 95.24, potvrđeno 90.00");
near("server: dug smanjen za potvrđeni iznos", get(`${CO}/couriers-balance`).find((b) => b.courier_id === 30189).cash_owed_to_company, before - 90);
eq("server: ponovna potvrda 422", post("/dispatcher/cash-handovers/903/confirm", { confirmed_amount: 90 })[0], 422);
const k = "kljuc-1";
const p1 = post("/dispatcher/couriers/30201/payout", { delivery_company_id: 24, amount: 10, method: "gotovina", idempotency_key: k });
const p2 = post("/dispatcher/couriers/30201/payout", { delivery_company_id: 24, amount: 10, method: "gotovina", idempotency_key: k });
eq("server: isti ključ = ista transakcija", p1[1].transaction_id, p2[1].transaction_id);
near("server: isti ključ ne isplaćuje dvaput", get(`${CO}/couriers-balance`).find((b) => b.courier_id === 30201).wage_owed_to_courier, 76.4);
eq("server: nepoznat kurir 404", post("/dispatcher/couriers/1/cash-receipt", { amount: 1 })[0], 404);

console.log(`\nLogika: ${ok} prošlo, ${bad} palo.`);
fs.writeFileSync(new URL("./metrics-logic.json", import.meta.url), JSON.stringify({ ...M, checks: ok + bad }, null, 1));
process.exit(bad ? 1 : 0);
