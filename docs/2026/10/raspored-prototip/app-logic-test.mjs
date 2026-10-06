// Provjera čiste logike APLIKACIJE (app/utils/schedule.ts i zoneGeo.ts) u običnom Node-u: iste provjere kao logic-test.mjs
// (koji gleda prototip), nad portovanim kodom. esbuild bundle sa alias "~" -> app.
// Pokretanje iz korijena repoa: node docs/2026/10/raspored-prototip/app-logic-test.mjs
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const require = createRequire(join(repo, "package.json"));
const esbuild = require("esbuild");
const dir = mkdtempSync(join(tmpdir(), "raspored-logic-"));
const entry = join(dir, "entry.ts");
writeFileSync(entry, ['export * from "~/utils/schedule";', 'export * from "~/utils/zoneGeo";'].join("\n"));
const out = join(dir, "bundle.mjs");
await esbuild.build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: out, alias: { "~": join(repo, "app") }, logLevel: "error" });
const SC = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });
const W = createRequire(import.meta.url)("./world.js");
let ok = 0, bad = 0;
const check = (name, cond, detail = "") => {
  if (cond) ok++;
  else { bad++; console.log(`  ✘ ${name}${detail ? " — " + detail : ""}`); }
};
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

/* ---- datumi ---- */
const d = new Date(2026, 9, 5);
eq("weekLabel isti mjesec", SC.weekLabel(SC.mondayOf(d)), "5–11. oktobar 2026.");
eq("weekLabel preko mjeseca", SC.weekLabel(SC.mondayOf(new Date(2026, 8, 30))), "28. septembar – 4. oktobar 2026.");
eq("mondayOf nedjelja", SC.iso(SC.mondayOf(new Date(2026, 9, 11))), "2026-10-05");
eq("mondayOf ponedjeljak", SC.iso(SC.mondayOf(new Date(2026, 9, 5))), "2026-10-05");
eq("weekIsos", SC.weekIsos(SC.mondayOf(d)).length, 7);
eq("diffDays", SC.diffDays("2026-10-05", "2026-10-12"), 7);
eq("dayLong", SC.dayLong("2026-10-06"), "utorak 6. oktobar");
eq("plural 1", SC.plural(1, "kurir", "kurira", "kurira"), "kurir");
eq("plural 2", SC.plural(2, "kurir", "kurira", "kurira"), "kurira");
eq("plural 11", SC.plural(11, "kurir", "kurira", "kurira"), "kurira");
eq("plural 21", SC.plural(21, "kurir", "kurira", "kurira"), "kurir");

/* ---- vrijeme ---- */
eq("parseTime 9", SC.parseTime("9"), 540);
eq("parseTime 930", SC.parseTime("930"), 570);
eq("parseTime 0930", SC.parseTime("0930"), 570);
eq("parseTime 17.30", SC.parseTime("17.30"), 1050);
eq("parseTime 17,30", SC.parseTime("17,30"), 1050);
eq("parseTime 9:5", SC.parseTime("9:5"), 545);
eq("parseTime 23:59", SC.parseTime("23:59"), 1439);
eq("parseTime 24:00", SC.parseTime("24:00"), null);
eq("parseTime 17:61", SC.parseTime("17:61"), null);
eq("parseTime prazno", SC.parseTime(""), null);
eq("parseTime slova", SC.parseTime("abc"), null);
eq("parseTime null", SC.parseTime(null), null);
eq("fmtTime", SC.fmtTime(570), "09:30");
eq("short 11:00", SC.short("11:00"), "11");
eq("short 08:00", SC.short("08:00"), "8");
eq("short 11:30", SC.short("11:30"), "11:30");
eq("fmtWin", SC.fmtWin("11:00", "15:00"), "11–15");
eq("fmtWin pola", SC.fmtWin("11:30", "15:00"), "11:30–15");
eq("stepTime +15", SC.stepTime("17:00", 15), "17:15");
eq("stepTime -15 preko sata", SC.stepTime("17:00", -15), "16:45");
eq("stepTime granica gore", SC.stepTime("23:50", 15), "23:59");
eq("stepTime granica dole", SC.stepTime("00:05", -15), "00:00");
eq("stepTime neispravno", SC.stepTime("x", 15), null);

/* ---- statusi ---- */
eq("status ispod min", SC.statusOf(2, 4, 6, 1), "understaffed");
eq("status ispod cilja", SC.statusOf(2, 4, 6, 3), "below_target");
eq("status cilj", SC.statusOf(2, 4, 6, 4), "target_reached");
eq("status puno", SC.statusOf(2, 4, 6, 6), "full");
eq("status max null nikad puno", SC.statusOf(1, 2, null, 5), "target_reached");
eq("status min == booked", SC.statusOf(2, 4, 6, 2), "below_target");
const now = SC.nowOf(W.NOW);
eq("now", now, { date: "2026-10-05", min: 860 });
const sh = (date, start, end) => ({ id: 1, zoneId: 11, date, start, end, min: 1, target: 2, max: null, booked: 1, hot: false });
eq("phase prošli dan", SC.phase(sh("2026-10-04", "11:00", "15:00"), now), "past");
eq("phase kraj == sada je prošla", SC.phase(sh("2026-10-05", "11:00", "14:20"), now), "past");
eq("phase početak == sada je u toku", SC.phase(sh("2026-10-05", "14:20", "18:00"), now), "live");
eq("phase u toku", SC.phase(sh("2026-10-05", "11:00", "15:00"), now), "live");
eq("phase kasnije danas", SC.phase(sh("2026-10-05", "17:00", "22:00"), now), "upcoming");
eq("phase sutra", SC.phase(sh("2026-10-06", "08:00", "09:00"), now), "upcoming");
eq("need ispod min", SC.need({ min: 2, target: 4, max: 6, booked: 1 }), "Fale još 1 kurir do minimuma");
eq("need ispod min 2", SC.need({ min: 3, target: 4, max: 6, booked: 0 }), "Fale još 3 kurira do minimuma");
eq("need ispod cilja", SC.need({ min: 2, target: 6, max: 8, booked: 3 }), "Fale još 3 kurira do cilja");
eq("need cilj", SC.need({ min: 2, target: 4, max: 6, booked: 4 }), "Cilj dostignut");
eq("need puno", SC.need({ min: 2, target: 4, max: 6, booked: 6 }), "Popunjeno do maksimuma");
eq("missing", SC.missing({ target: 4, booked: 1 }), 3);
eq("missing nikad negativno", SC.missing({ target: 4, booked: 6 }), 0);

/* ---- svijet i sedmica ---- */
const world = W.build();
const mon0 = SC.mondayOf(W.NOW);
const dates0 = SC.weekIsos(mon0);
const M0 = SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: dates0, now });
const M = {};
M.shiftsWeek0 = M0.total;
M.countsWeek0 = M0.counts;
check("sedmica 0 ima smjene", M0.total > 30, String(M0.total));
eq("redovi su sve zone", M0.rows.length, 7);
check("Zalužani je prazan red", M0.rows.find((r) => r.zone.name === "Zalužani").empty);
check("Petrićevac ima smjene (vikend)", !M0.rows.find((r) => r.zone.name === "Petrićevac").empty);
eq("redovi po abecedi", M0.rows.map((r) => r.zone.name), ["Borik", "Centar", "Lauš", "Obilićevo", "Petrićevac", "Starčevica", "Zalužani"]);
check("današnji dan označen", M0.days[0].today && !M0.days[1].today);
check("danas ima završenu smjenu (Obilićevo 08–11)", M0.counts.past >= 1, JSON.stringify(M0.counts));
check("brojači aktivnih = zbir statusa", M0.counts.all === M0.counts.understaffed + M0.counts.below_target + M0.counts.target_reached + M0.counts.full);
check("ukupno = aktivne + završene", M0.total === M0.counts.all + M0.counts.past);
const tue = M0.rows.find((r) => r.zone.name === "Lauš").cells[1];
eq("Lauš utorak je rupa", tue.shifts.length, 0);
const centarMon = M0.rows.find((r) => r.zone.name === "Centar").cells[0].shifts;
eq("Centar ponedjeljak sortiran po početku", centarMon.map((s) => s.start), ["11:00", "17:00"]);
eq("Centar 11–15 danas je u toku", centarMon[0].phase, "live");
eq("Centar 11–15 ispod minimuma", centarMon[0].status, "understaffed");
const MF = SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: dates0, now, filter: "understaffed" });
check("filter: samo ispod minimuma se poklapa", MF.shifts.filter((s) => s.match).every((s) => s.status === "understaffed" && s.phase !== "past"));
check("filter: završena smjena se ne poklapa", MF.shifts.filter((s) => s.phase === "past").every((s) => !s.match));
const MZ = SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: dates0, now, zoneId: 11 });
eq("filter zone: jedan red", MZ.rows.length, 1);
check("filter zone: samo ta zona", MZ.shifts.every((s) => s.zoneId === 11));
const P0 = SC.problemList(M0);
M.problemsWeek0 = P0.length;
check("problemi su ispod minimuma i nisu završeni", P0.every((s) => s.status === "understaffed" && s.phase !== "past"));
check("problemi redom po vremenu", P0.every((s, i) => i === 0 || (P0[i - 1].date < s.date || (P0[i - 1].date === s.date && SC.mm(P0[i - 1].start) <= SC.mm(s.start)))));
check("prvi problem je danas", P0[0].date === "2026-10-05");
eq("sljedeći problem iz ničega = prvi", SC.nextProblem(M0, null).id, P0[0].id);
eq("sljedeći problem ide dalje", SC.nextProblem(M0, P0[0].id).id, P0[1].id);
eq("sljedeći problem iz zadnjeg = prvi", SC.nextProblem(M0, P0[P0.length - 1].id).id, P0[0].id);
eq("nema problema -> null", SC.nextProblem({ shifts: [] }, 1), null);
const Mprev = SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: SC.weekIsos(SC.addDays(mon0, -7)), now });
eq("prošla sedmica: sve završeno", Mprev.counts.all, 0);
check("prošla sedmica: ima smjena", Mprev.total > 30, String(Mprev.total));
M.shiftsWeekPrev = Mprev.total;
const Mnext = SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: SC.weekIsos(SC.addDays(mon0, 7)), now });
eq("sljedeća sedmica prazna", Mnext.total, 0);
check("zbir dana = broj smjena", M0.days.reduce((a, x) => a + x.slots, 0) === M0.total);
check("dan: pad prikaza ne računa završene u problem", M0.days[0].under === M0.shifts.filter((s) => s.date === dates0[0] && s.phase !== "past" && s.status === "understaffed").length);

/* ---- prečice za trajanje ---- */
const pw = SC.presetWindows(world.shifts, 4);
M.presets = pw;
eq("prečice: 4", pw.length, 4);
check("prečice: opadajuće po broju", pw.every((p, i) => i === 0 || pw[i - 1].count >= p.count));
check("prečica nosi kapacitet", pw.every((p) => p.min >= 1 && p.target >= p.min));
const topSix = pw.find((p) => p.start === "17:00" && p.end === "22:00");
check("17–22 je među prečicama", !!topSix);
eq("presetWindows prazno", SC.presetWindows([], 4), []);

/* ---- nova smjena ---- */
const existing = world.shifts;
const lausTue = SC.iso(SC.addDays(mon0, 1));
const spec = { days: [lausTue], zones: [13], start: "17:00", end: "22:00", min: 1, target: 2, max: null, hot: false };
const ex1 = SC.expandCreate(spec, existing);
eq("create: 1 stavka", ex1.items.length, 1);
eq("create: nije duplikat", ex1.dup, 0);
eq("create: bez preklapanja", ex1.overlaps, 0);
const specOv = { ...spec, zones: [11], start: "12:00", end: "16:00" };
const ex2 = SC.expandCreate({ ...specOv, days: [SC.iso(SC.addDays(mon0, 1))] }, existing);
eq("create: preklapanje sa Centar 11–15", ex2.overlaps, 1);
const exDup = SC.expandCreate({ ...spec, zones: [11], start: "11:00", end: "15:00" }, existing);
eq("create: duplikat se preskače", exDup.dup, 1);
eq("create: duplikat nije u listi za slanje", exDup.create.length, 0);
const exMany = SC.expandCreate({ ...spec, zones: [11, 12, 13, 14, 15, 16], days: dates0 }, existing);
eq("create: 6×7 = 42", exMany.items.length, 42);
eq("create: ispod granice od 60", exMany.tooMany, false);
const exTooMany = SC.expandCreate({ ...spec, zones: [11, 12, 13, 14, 15, 16, 17, 11, 12, 13], days: dates0 }, existing);
eq("create: preko 60 se zaustavlja", exTooMany.tooMany, true);
eq("create: max prazan string -> null", SC.expandCreate({ ...spec, max: "" }, []).items[0].max, null);
eq("overlapsOf: susjedne se ne preklapaju", SC.overlapsOf({ zoneId: 11, date: world.shifts[0].date, start: "15:00", end: "17:00" }, existing.filter((s) => s.zoneId === 11)).length, 0);
check("validate: valjano", Object.keys(SC.validateShift({ start: "17:00", end: "22:00", min: 1, target: 2, max: null })).length === 0);
eq("validate: kraj prije početka", !!SC.validateShift({ start: "22:00", end: "17:00", min: 1, target: 2 }).end, true);
eq("validate: cilj manji od minimuma", !!SC.validateShift({ start: "17:00", end: "22:00", min: 3, target: 2 }).target, true);
eq("validate: max manji od cilja", !!SC.validateShift({ start: "17:00", end: "22:00", min: 1, target: 4, max: 3 }).max, true);
eq("validate: min 0", !!SC.validateShift({ start: "17:00", end: "22:00", min: 0, target: 2 }).min, true);
eq("validate: loše vrijeme", !!SC.validateShift({ start: "25:00", end: "22:00", min: 1, target: 2 }).start, true);
eq("validate: preko ponoći nije podržano", !!SC.validateShift({ start: "22:00", end: "02:00", min: 1, target: 2 }).end, true);

/* ---- kopiranje ---- */
const mon1 = SC.addDays(mon0, 7);
const cw = SC.copyWeekPlan({ src: world.shifts, tgt: world.shifts, srcMon: mon0, tgtMon: mon1 });
M.copyWeek0to1 = { source: cw.source, create: cw.create.length, dup: cw.dup };
eq("kopiranje sedmice: izvor = broj smjena", cw.source, M0.total);
eq("kopiranje u praznu sedmicu: sve se pravi", cw.create.length, M0.total);
eq("kopiranje u praznu sedmicu: nema duplikata", cw.dup, 0);
const cw2 = SC.copyWeekPlan({ src: world.shifts, tgt: world.shifts, srcMon: SC.addDays(mon0, -7), tgtMon: mon0 });
check("kopiranje prošle sedmice u tekuću: ima duplikata", cw2.dup > 0, JSON.stringify({ c: cw2.create.length, d: cw2.dup }));
M.copyWeekPrevTo0 = { source: cw2.source, create: cw2.create.length, dup: cw2.dup };
check("kopiranje: datum pomjeren za 7 dana", cw.items[0].date === SC.iso(SC.addDays(SC.parseIso(world.shifts.filter((s) => dates0.includes(s.date))[0].date), 7)));
const cwz = SC.copyWeekPlan({ src: world.shifts, tgt: world.shifts, srcMon: mon0, tgtMon: mon1, zoneId: 11 });
check("kopiranje samo jedne zone", cwz.items.every((i) => i.zoneId === 11) && cwz.source < M0.total);
const cd = SC.copyDayPlan({ src: world.shifts, fromIso: dates0[0], toIsos: dates0.slice(1, 5), existing: world.shifts });
M.copyDay = { source: cd.source, create: cd.create.length, dup: cd.dup };
check("kopiranje dana: izvor je dan", cd.source === M0.days[0].slots);
check("kopiranje dana: cilj nije izvor", cd.items.every((i) => i.date !== dates0[0]));
check("kopiranje dana: duplikati se broje", cd.dup + cd.create.length === cd.items.length);
eq("kopiranje dana na isti dan = ništa", SC.copyDayPlan({ src: world.shifts, fromIso: dates0[0], toIsos: [dates0[0]], existing: [] }).items.length, 0);

/* ---- rupe ---- */
eq("rupa Centar 15–17", SC.gaps(centarMon).map((g) => `${g.from}-${g.to}`), ["15:00-17:00"]);
eq("susjedne smjene nemaju rupu", SC.gaps([{ start: "08:00", end: "11:00" }, { start: "11:00", end: "21:00" }]), []);
eq("preklopljene nemaju rupu", SC.gaps([{ start: "08:00", end: "12:00" }, { start: "11:00", end: "15:00" }]), []);
eq("jedna smjena nema rupu", SC.gaps([{ start: "08:00", end: "12:00" }]), []);
eq("rupa nakon dugačke smjene", SC.gaps([{ start: "08:00", end: "20:00" }, { start: "10:00", end: "12:00" }, { start: "22:00", end: "23:00" }]).map((g) => `${g.from}-${g.to}`), ["20:00-22:00"]);

/* ---- Sada ---- */
const state = world.zones.filter((z) => z.id !== 17).map((z) => {
  const plan = SC.nowPlan({ shifts: world.shifts, zoneId: z.id, now });
  return { name: z.name, plan, zn: SC.zoneNow(plan, world.live[z.id]) };
});
const byName = Object.fromEntries(state.map((s) => [s.name, s]));
eq("Sada: Starčevica = nikoga u zoni", byName["Starčevica"].zn.code, "empty");
eq("Sada: Centar = ispod minimuma", byName["Centar"].zn.code, "under");
eq("Sada: Lauš = sljedeća ispod minimuma", byName["Lauš"].zn.code, "next-under");
eq("Sada: Obilićevo = u redu", byName["Obilićevo"].zn.code, "ok");
eq("Sada: Borik = nema smjene sada", byName["Borik"].zn.code, "next");
eq("Sada: Petrićevac = danas nema smjena", byName["Petrićevac"].zn.code, "none");
eq("Sada: poredak po hitnosti", state.slice().sort((a, b) => a.zn.rank - b.zn.rank).map((s) => s.name).slice(0, 3), ["Starčevica", "Centar", "Lauš"]);
eq("Sada: Centar još traje", byName["Centar"].plan.minutesLeft, 40);
eq("Sada: Lauš počinje za", byName["Lauš"].plan.minutesToNext, 160);
eq("Sada: tekst 160 min", SC.inText(160), "2 h 40 min");
eq("Sada: tekst 40 min", SC.inText(40), "40 min");
eq("Sada: tekst 120 min", SC.inText(120), "2 h");
eq("ago 3 s", SC.ago(3), "upravo sada");
eq("ago 12 s", SC.ago(12), "prije 12 s");
eq("ago 125 s", SC.ago(125), "prije 2 min");
eq("liveTotal", SC.liveTotal({ online: 2, idle: 1, delivering: 5 }), 8);
eq("liveTotal bez podatka", SC.liveTotal(undefined), 0);
M.now = state.map((s) => ({ zone: s.name, code: s.zn.code, label: s.zn.label }));

/* ---- provjera dostupnosti ---- */
const imp = SC.enforceImpact({ shifts: world.shifts, now, zones: world.zones });
M.enforce = imp;
eq("provjera: 3 smjene u toku", imp.inProgress, 3);
eq("provjera: 3 potvrđena", imp.booked, 3);
eq("provjera: 1 smjena bez potvrđenog", imp.zeroShifts, 1);
eq("provjera: nivo djelimično", imp.level, "partial");
const night = SC.enforceImpact({ shifts: world.shifts, now: { date: "2026-10-05", min: 23 * 60 + 30 }, zones: world.zones });
eq("provjera: noću nijedna smjena ne traje", night.level, "none");
const zeroWorld = world.shifts.map((s) => ({ ...s, booked: 0 }));
eq("provjera: svi 0 -> zero", SC.enforceImpact({ shifts: zeroWorld, now, zones: world.zones }).level, "zero");
const fullWorld = world.shifts.map((s) => ({ ...s, booked: s.target }));
eq("provjera: svi popunjeni -> ok", SC.enforceImpact({ shifts: fullWorld, now, zones: world.zones }).level, "ok");

/* ---- poruka ---- */
const cen = centarMon[0];
const ad = SC.askDraft(cen, "Centar", now);
M.askTitle = ad.title;
eq("poruka: naslov", ad.title, "Treba nam još kurira: Centar, danas 11–15");
check("poruka: tekst sadrži broj", /još 3 kurira/.test(ad.body), ad.body);
check("poruka: pominje Radno vrijeme", /Radno vrijeme/.test(ad.body));
eq("poruka: kategorija je obavještenje", ad.category, "announcement");
eq("poruka: sutra piše dan", SC.askDraft({ ...cen, date: "2026-10-06" }, "Centar", now).title, "Treba nam još kurira: Centar, utorak 6. oktobar 11–15");
eq("poruka: najmanje 1", /još 1 kurir\b/.test(SC.askDraft({ ...cen, booked: cen.target }, "Centar", now).body), true);

/* ---- zone ---- */
const Z = Object.fromEntries(world.zones.map((z) => [z.name, z]));
eq("preklapanje: isti krug", SC.overlapPct(Z["Centar"], Z["Centar"]), 100);
eq("preklapanje: daleko", SC.overlapPct(Z["Centar"], { lat: 45.5, lng: 18.5, r: 1000 }), 0);
const ov = SC.overlaps(Z["Centar"], world.zones);
M.overlapCentar = ov.map((o) => `${o.zone.name} ${o.pct}%`);
check("preklapanje: Centar ima susjede", ov.length >= 2);
check("preklapanje: poredano opadajuće", ov.every((o, i) => i === 0 || ov[i - 1].pct >= o.pct));
check("preklapanje: zona bez geometrije se preskače", !SC.overlaps(Z["Centar"], world.zones).some((o) => o.zone.name === "Zalužani"));
eq("preklapanje: zona bez geometrije nema susjede", SC.overlaps(Z["Zalužani"], world.zones).length, 0);
eq("preklapanje: manji unutar većeg", SC.overlapPct({ lat: 44.77, lng: 17.19, r: 300 }, { lat: 44.77, lng: 17.19, r: 3000 }), 100);
check("površina 1000 m", Math.abs(SC.areaKm2(1000) - 3.14) < 0.01);
eq("fmtKm 1800", SC.fmtKm(1800), "1,8 km");
eq("fmtKm 2000", SC.fmtKm(2000), "2 km");
eq("fmtKm 500", SC.fmtKm(500), "500 m");
eq("fmtNum", SC.fmtNum(1.5), "1,5");
eq("pretraga bez dijakritika", SC.searchZones(world.zones, "starcevica").map((z) => z.name), ["Starčevica"]);
eq("pretraga djelimična", SC.searchZones(world.zones, "lau").map((z) => z.name), ["Lauš"]);
eq("pretraga prazna = sve", SC.searchZones(world.zones, "  ").length, 7);
eq("pretraga bez rezultata", SC.searchZones(world.zones, "xyz").length, 0);
const useCentar = SC.usage(11, world.shifts, now, 28);
M.usageCentar28 = useCentar;
check("upotreba: samo od danas", useCentar > 0 && useCentar <= 28 * 3, String(useCentar));
eq("upotreba: zona bez smjena", SC.usage(17, world.shifts, now, 28), 0);
check("upotreba: prozor od 7 dana je manji", SC.usage(11, world.shifts, now, 7) < useCentar);

console.log(`\nLogika aplikacije: ${ok}/${ok + bad} provjera prošlo${bad ? `, ${bad} pada` : ""}`);
process.exit(bad ? 1 : 0);
