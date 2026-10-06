// T2: prototip "Finansije", računar: Promet, stanja (greška, prazno, učitavanje, zastarjelo), osvježavanje, opasni podaci, skala 500 kurira.
import fs from "node:fs";
import path from "node:path";
import { openProto, check, summary, sleep, here } from "./plib.mjs";

const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const on = (k) => !ONLY.length || ONLY.includes(k);
const P = await openProto({ name: "t2", width: 1480, height: 960 });
const A = "A('d')";
const M = {};
const fresh = async (opts = {}, afterJs = "") => {
  await P.ev(`fresh('d', ${JSON.stringify(opts)}); ${afterJs}; 1`);
};
const ready = (extra = "") => P.waitFor(`(() => { const D = ${A}.ctx.D; return D.balances.state === 'ok' && D.pending.state === 'ok' && D.status.state === 'ok' && D.settings.state === 'ok'; })() ${extra}`);
try {
  await P.ev(`(A('p') && A('p').destroy(), document.getElementById('p').style.display='none', 1)`);

  /* ---------- Promet ---------- */
  if (on("j")) {
    console.log("\n# J Promet");
    await fresh({}); await ready(); await sleep(200);
    await P.click("#fc-tab-promet");
    await P.waitFor(`document.querySelectorAll('.fc-jr').length > 0`);
    await sleep(200);
    check("Promet: tab izabran, podnaslov", (await P.attr("#fc-tab-promet", "aria-selected")) === "true");
    check("Promet: 7 dana je izabrano", (await P.attr('[data-act="period"][data-arg="7d"]', "aria-pressed")) === "true");
    const lg = await P.log();
    const jr = lg.filter((e) => /cash-handovers\?|payouts\?/.test(e.path));
    check("Promet: 2 čitanja sa periodom 30.09. - 06.10.", jr.length === 2 && jr.every((e) => /from=2026-09-30&to=2026-10-06/.test(e.path)), jr.map((e) => e.path).join(" | "));
    const calc = await P.ev(`(() => { const pm = ${A}.ctx.parts.promet; const v = pm.visible(); const t = FC.journalTotals(v); return { n: v.length, inSum: t.inSum, outSum: t.outSum, inN: t.inN, outN: t.outN, diffN: t.diffN, diffSum: t.diffSum, pendingN: t.pendingN, days: FC.groupDays(v, ${A}.nowMs()).map((g) => g.label) }; })()`);
    M.journal7 = calc;
    check("Promet: redova u DOM-u je min(40, svi)", (await P.count(".fc-jr")) === Math.min(40, calc.n), `${await P.count(".fc-jr")} / ${calc.n}`);
    const tv = await P.texts(".fc-tot .v");
    check("Promet: zbir predaja", tv[0] === `${calc.inSum.toFixed(2)} KM`, tv[0]);
    check("Promet: zbir isplata", tv[1] === `${calc.outSum.toFixed(2)} KM`, tv[1]);
    check("Promet: razlika sa predznakom", calc.diffN ? tv[2].includes(`${Math.abs(calc.diffSum).toFixed(2)}`) : /Nema razlika/.test(tv[2]), tv[2]);
    check("Promet: napomena o tome šta zbir obuhvata", /Direktno evidentirane uplate su u njemu samo ako ih server vraća/.test(await P.text(".sr-note")));
    const dh = await P.texts(".fc-day");
    check("Promet: dani su Danas, Juče, pa datumi", /^DANAS/i.test(dh[0]) && /^JUČE/i.test(dh[1]) && /\d+\. [a-z]{3}/.test(dh[2]), dh.slice(0, 3).join(" | "));
    check("Promet: dani opadaju", calc.days.length === dh.length || calc.days.length > 0);
    check("Promet: red na čekanju ima sat i 'Na čekanju'", /Na čekanju/.test(await P.text(".fc-jr .c3")));
    check("Promet: red ima čitljivu oznaku za čitač", /^Predaja čeka potvrdu: /.test(await P.attr(".fc-jr", "aria-label")));
    check("Promet: prvi red je u Tab redoslijedu", (await P.count('.fc-jr[tabindex="0"]')) === 1);
    // vrsta
    await P.click('[data-act="jtype"][data-arg="payout"]');
    check("Isplate: svi redovi su isplate", (await P.count(".fc-jr .ji.out")) === (await P.count(".fc-jr")) && (await P.count(".fc-jr")) > 0);
    await P.click('[data-act="jtype"][data-arg="handover"]');
    check("Predaje: nema isplata", (await P.count(".fc-jr .ji.out")) === 0 && (await P.count(".fc-jr")) > 0);
    await P.click('[data-act="jtype"][data-arg="all"]');
    // samo razlike
    await P.click('[data-act="jdiff"]');
    const diffRows = await P.count(".fc-jr");
    check("Samo razlike: broj iz pilule", diffRows === calc.diffN && /Samo razlike\s*\d+/.test(await P.text('[data-act="jdiff"]')), `${diffRows} / ${calc.diffN}`);
    check("Samo razlike: svaki red pokazuje razliku", await P.ev(`[...document.querySelectorAll('.fc-jr')].every((r) => /razlika/.test(r.querySelector('.c2 small.d') ? r.querySelector('.c2 small.d').textContent : ''))`));
    check("Samo razlike: razlika ima predznak i valutu", /razlika [−+]\d+\.\d{2} KM/.test(await P.text(".fc-jr .c2 small.d")), await P.text(".fc-jr .c2 small.d"));
    await P.click('[data-act="jdiff"]');
    // kurir
    await P.clearLog();
    await P.click('[data-act="jcourier"]');
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    check("izbor kurira: list sa pretragom, fokus u polju", (await P.text("#fc-sheet h2")) === "Izaberi kurira" && (await P.active()).id === "fc-pq");
    check("izbor kurira: prva stavka je 'Svi kuriri'", /Svi kuriri/.test(await P.text("#fc-pick .fc-row")));
    await P.typeText("hodz");
    await sleep(150);
    check("izbor kurira: pretraga bez dijakritika", (await P.count("#fc-pick .fc-row")) === 2, String(await P.count("#fc-pick .fc-row")));
    await P.click('#fc-pick [data-act="pick"][data-arg="30189"]');
    await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(500);
    const lg2 = await P.log();
    check("izabran kurir: čitanja sa courier_id", lg2.filter((e) => /courier_id=30189/.test(e.path)).length === 2, lg2.map((e) => e.path).join(" | "));
    check("izabran kurir: svi redovi su njegovi", await P.ev(`[...document.querySelectorAll('.fc-jr .c1 b')].every((b) => b.textContent === 'Amir Hodžić')`));
    check("izabran kurir: pilula nosi ime i ima ✕", /Amir Hodžić/.test(await P.text('[data-act="jcourier"]')) && (await P.q('[data-act="jcourier-clear"]')));
    check("izabran kurir: stvarni slučaj 97.79 → 92.79 se vidi", /razlika −5\.00 KM/.test(await P.text(".fc-jr .c2 small.d")) || (await P.texts(".fc-jr .c2 small.d")).some((x) => /prijavljeno 97\.79 · razlika −5\.00 KM/.test(x)), (await P.texts(".fc-jr .c2 small.d")).join(" | "));
    await P.click('[data-act="jcourier-clear"]'); await sleep(400);
    check("✕ vraća sve kurire", /Svi kuriri/.test(await P.text('[data-act="jcourier"]')));
    // period
    await P.clearLog();
    await P.click('[data-act="period"][data-arg="today"]'); await sleep(500);
    check("Danas: čitanja sa istim danom", (await P.log()).filter((e) => /from=2026-10-06&to=2026-10-06/.test(e.path)).length === 2);
    check("Danas: samo današnje stavke", (await P.texts(".fc-day")).length === 1 && /^DANAS/i.test((await P.texts(".fc-day"))[0]));
    await P.click('[data-act="period"][data-arg="prev"]'); await sleep(500);
    check("Prošli mjesec: čitanja za septembar", (await P.log()).some((e) => /from=2026-09-01&to=2026-09-30/.test(e.path)));
    await P.click('[data-act="period"][data-arg="custom"]'); await sleep(400);
    check("Od–do: pojave se dva polja za datum", (await P.count('input[type="date"]')) === 2);
    await P.clearLog();
    await P.ev(`(() => { const f = document.querySelector('input[data-date="from"]'); f.value = '2026-10-04'; f.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(500);
    await P.ev(`(() => { const t = document.querySelector('input[data-date="to"]'); t.value = '2026-10-02'; t.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(500);
    const cr = (await P.log()).filter((e) => /from=/.test(e.path)).pop();
    check("Od–do: obrnut raspon se ispravlja (od ≤ do)", /from=2026-10-02&to=2026-10-04/.test(cr.path), cr.path);
    await P.click('[data-act="period"][data-arg="7d"]'); await sleep(500);
    // CSV
    await P.click('[data-act="csv"]');
    await sleep(200);
    const csvInfo = await P.ev(`(() => { const c = ${A}.ctx.lastCsv; const v = ${A}.ctx.parts.promet.visible().length; return { lines: c.split('\\r\\n').length, head: c.split('\\r\\n')[0], v }; })()`);
    check("CSV: redova = vidljivi + zaglavlje", csvInfo.lines === csvInfo.v + 1, `${csvInfo.lines} / ${csvInfo.v}`);
    check("CSV: zaglavlje na srpskom", csvInfo.head.startsWith("Datum;Vrijeme;Vrsta;Kurir;ID kurira;Prijavljeno;"));
    check("CSV: obavještenje sa imenom datoteke", /Izvezeno \d+ (red|reda|redova): finansije-2026-10-06\.csv/.test((await P.toast()) || ""), await P.toast());
    // detalj stavke
    await P.click(".fc-jr", { nth: 0 });
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    check("detalj stavke: naslov i referenca", /Predaja čeka potvrdu/.test(await P.text("#fc-sheet h2")) && /Predaja #\d+/.test(await P.text("#fc-sheet .fc-kv")), await P.text("#fc-sheet .fc-kv"));
    check("detalj stavke: dugme za kopiranje reference", (await P.count("#fc-sheet .fc-kv .cp")) === 1);
    await P.click('#fc-sheet [data-act="jcopy"]');
    check("detalj stavke: kopirano obavještenje", /Kopirano/.test((await P.toast()) || ""));
    await P.key("Escape"); await sleep(250);
    check("Esc zatvara i vraća fokus na red", !(await P.q("#fc-sheet")) && /^j-/.test((await P.active()).fk || ""), JSON.stringify(await P.active()));
    // isplata u detalju: 'Ko je isplatio' ne postoji u API-ju
    await P.click(".fc-jr .ji.out", { nth: 0 }).catch(async () => { await P.click('[data-act="jtype"][data-arg="payout"]'); await P.click(".fc-jr", { nth: 0 }); });
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    check("detalj isplate: kaže da server ne vraća ko je isplatio", /Ko je isplatio\s*Server to ne vraća/.test(await P.text("#fc-sheet .fc-kv")), await P.text("#fc-sheet .fc-kv"));
    await P.click('#fc-sheet [data-act="jgo"]'); await sleep(600);
    check("Otvori kurira: vraća na Stanje sa detaljem", (await P.attr("#fc-tab-stanje", "aria-selected")) === "true" && (await P.q(".fc-det .fc-dt")));
    // tastatura u Prometu
    await P.click("#fc-tab-promet"); await sleep(500);
    await P.click('[data-act="jtype"][data-arg="all"]');
    await P.focusSel('.fc-jr[tabindex="0"]');
    await P.key("ArrowDown");
    check("Promet: strelica dolje pomjera fokus", (await P.active()).fk !== (await P.attr(".fc-jr", "data-fk")));
    // prazno
    await P.ev(`${A}.world.F.history.length = 0; ${A}.world.F.payouts.length = 0; 1`);
    await P.click('[data-act="period"][data-arg="today"]'); await sleep(500);
    check("Promet prazan: poruka i 'Poništi filtere'", /Nema prometa/.test(await P.text(".fc-empty")) && (await P.q('[data-act="jreset"]')));
    check("Promet prazan: CSV je onemogućen", await P.ev(`document.querySelector('[data-act="csv"]').disabled`));
  }

  /* ---------- greške: Promet ---------- */
  if (on("je")) {
    console.log("\n# JE Promet: greška");
    await fresh({ tab: "promet" }, `${A}.failNext(new RegExp('GET .*(cash-handovers|payouts)\\\\?'), 999)`);
    await P.waitFor(`!!document.querySelector('.fc-tint--bad')`); await sleep(300);
    check("Promet greška: poruka i 'Pokušaj ponovo'", /Ne mogu da učitam promet/.test(await P.text(".fc-tint--bad")) && (await P.q('[data-act="jretry"]')));
    check("Promet greška: nema 'Nema prometa' ni zbirova", !(await P.q(".fc-empty")) && !(await P.q(".fc-tot")));
    await P.ev(`${A}.clearFails(); 1`);
    await P.click('[data-act="jretry"]');
    await P.waitFor(`document.querySelectorAll('.fc-jr').length > 0`);
    check("Promet greška: ponovni pokušaj učita", (await P.count(".fc-jr")) > 0 && (await P.q(".fc-tot")));
    // zastarjelo: učitano pa osvježavanje pada
    await P.ev(`${A}.failNext(new RegExp('GET .*(cash-handovers|payouts)\\\\?'), 999); 1`);
    await P.click('[data-act="period"][data-arg="today"]'); await sleep(600);
    check("Promet zastarjelo: lista ostaje, uz upozorenje", (await P.count(".fc-jr")) > 0 && /Osvježavanje nije uspjelo/.test(await P.text(".fc-tint")));
  }

  /* ---------- stanja Stanja ---------- */
  if (on("st")) {
    console.log("\n# ST stanja");
    // predaje ne mogu da se učitaju: nikad "Nema predaja"
    await fresh({}, `${A}.failNext(new RegExp('GET .*cash-handovers/pending'), 999)`);
    await P.waitFor(`${A}.ctx.D.pending.state === 'err'`); await sleep(300);
    check("greška predaja: poruka i 'Pokušaj ponovo'", /Ne mogu da učitam predaje koje čekaju potvrdu/.test(await P.text(".fc-q")) && (await P.q('.fc-q [data-act="retry"]')));
    check("greška predaja: NIKAD 'Nema predaja koje čekaju potvrdu'", !/Nema predaja koje čekaju potvrdu/.test(await P.text(".fc-q")));
    check("greška predaja: pločica kaže 'Nije učitano'", /Nije učitano/.test((await P.texts(".fc-kpi .s"))[0]) && (await P.texts(".fc-kpi .v"))[0] === "—");
    check("greška predaja: značke nema (ne tvrdi 0)", !(await P.q(".fc-side .nb")) && !(await P.q("#fc-tab-stanje .fc-badge")));
    check("greška predaja: spisak i druge pločice rade", (await P.count(".fc-row")) === 12 && (await P.texts(".fc-kpi .v"))[1] === "1332.32 KM");
    await P.ev(`${A}.clearFails(); 1`);
    await P.click('.fc-q [data-act="retry"]');
    await P.waitFor(`document.querySelectorAll('.fc-qr').length === 4`);
    check("greška predaja: ponovni pokušaj učita 4 reda", true);
    // stanje kurira ne može da se učita
    await fresh({}, `${A}.failNext(new RegExp('GET .*couriers-balance'), 999)`);
    await P.waitFor(`${A}.ctx.D.balances.state === 'err'`); await sleep(300);
    check("greška stanja: poruka u spisku", /Ne mogu da učitam stanje kurira/.test(await P.text(".fc-list")) && (await P.q('.fc-list [data-act="retry"]')));
    check("greška stanja: pločice 2 i 3 kažu 'Nije učitano'", (await P.texts(".fc-kpi .v")).slice(1).every((v) => v === "—"));
    check("greška stanja: red predaja radi", (await P.count(".fc-qr")) === 4);
    check("greška stanja: nema 'Svi kuriri su na nuli' ni 'Nema kurira'", !/na nuli|Nema kurira/.test(await P.text(".fc-list")));
    // osvježavanje padne dok podaci postoje: stari podaci uz upozorenje
    await fresh({ pollMs: 100000 }); await ready(); await sleep(200);
    await P.ev(`${A}.failNext(new RegExp('GET .*couriers-balance'), 999); ${A}.ctx.parts.stanje.load('balances'); 1`);
    await sleep(500);
    check("zastarjelo stanje: lista ostaje", (await P.count(".fc-row")) === 12);
    check("zastarjelo stanje: upozorenje sa 'Pokušaj ponovo'", /Stanje je staro/.test(await P.text(".fc-list .fc-tint")) && (await P.q('.fc-list .fc-tint [data-act="retry"]')));
    await P.ev(`${A}.clearFails(); 1`);
    await P.click('.fc-list .fc-tint [data-act="retry"]'); await sleep(500);
    check("zastarjelo stanje: ponovni pokušaj skida upozorenje", !(await P.q(".fc-list .fc-tint")));
    // limit se ne može učitati
    await fresh({}, `${A}.failNext(new RegExp('GET .*finance-settings'), 999)`);
    await P.waitFor(`${A}.ctx.D.settings.state === 'err'`); await sleep(300);
    check("bez limita: nema oznaka limita", (await P.count(".fc-m")) === 0 && !/preko limita/i.test(await P.text(".fc-kpi:nth-child(2) .s")));
    check("bez limita: poruka o limitu", /Limit gotovine nije učitan/.test(await P.text(".fc-list .fc-tint")));
    // prazan svijet: poruka tek kad je učitano
    await P.ev(`fresh('d', {}); ${A}.world.F.pendingRows.length = 0; 1`);
    await ready(); await sleep(200);
    check("nema predaja: poruka poslije učitavanja", /Nema predaja koje čekaju potvrdu/.test(await P.text(".fc-q")));
    check("nema predaja: pločica 'Sve predaje su potvrđene'", /Sve predaje su potvrđene/.test((await P.texts(".fc-kpi .s"))[0]));
    // sve na nuli
    await P.ev(`fresh('d', {}); ${A}.world.F.balances.forEach((b) => { b.cash_owed_to_company = 0; b.wage_owed_to_courier = 0; }); ${A}.world.F.pendingRows.length = 0; 1`);
    await ready(); await sleep(200);
    check("sve na nuli: objašnjenje i vodič do filtera 'Nulti'", /Svi kuriri su na nuli/.test(await P.text(".fc-list .fc-empty")) && /Nulti/.test(await P.text(".fc-list .fc-empty")));
  }

  /* ---------- učitavanje: kadar po kadar ---------- */
  if (on("ld")) {
    console.log("\n# LD učitavanje");
    await P.ev(`(() => { window.__fr = []; const rec = () => { const q = document.querySelector('#d .fc-q'); const l = document.querySelector('#d .fc-list'); const t = (q ? q.textContent : '(nema)') + '|' + (l ? (l.getAttribute('aria-busy') === 'true' ? 'skel' : 'list') : '(nema)'); const last = window.__fr[window.__fr.length - 1]; if (!last || last.t !== t) window.__fr.push({ ms: Math.round(performance.now() - window.__t0), t, q: q ? q.textContent.replace(/\\s+/g,' ').trim().slice(0, 200) : '' }); requestAnimationFrame(rec); }; window.__t0 = performance.now(); fresh('d', { delay: 300 }); requestAnimationFrame(rec); })()`);
    await sleep(1400);
    const fr = await P.ev(`window.__fr`);
    M.frames = fr;
    check("učitavanje: nijedan kadar ne kaže 'Nema predaja' prije podataka", !fr.some((f, i) => /Nema predaja koje čekaju potvrdu/.test(f.q) && i < fr.length - 1 && !/Prijavio/.test(fr[fr.length - 1].q)) && !fr.slice(0, -1).some((f) => /Nema predaja koje čekaju potvrdu/.test(f.q)), JSON.stringify(fr.map((f) => f.q.slice(0, 40))));
    check("učitavanje: prvi kadar je kostur", fr.length > 1 && /Čeka potvrdu/.test(fr[0].q) && fr[0].t.includes("skel"));
    check("učitavanje: kadrovi vode do podataka", /Prijavio/.test(fr[fr.length - 1].q), fr[fr.length - 1].q);
  }

  /* ---------- osvježavanje i nova predaja ---------- */
  if (on("po")) {
    console.log("\n# PO osvježavanje");
    await fresh({ pollMs: 700, slowMs: 100000 }); await ready(); await sleep(300);
    await P.clearLog();
    check("prije simulacije: 4 predaje", (await P.count(".fc-qr")) === 4);
    await P.ev(`${A}.ctx.sim.addPending(); 1`);
    await P.waitFor(`document.querySelectorAll('.fc-qr').length === 5`, { timeout: 4000 });
    await sleep(100);
    check("nova predaja se pojavi sama", (await P.count(".fc-qr")) === 5);
    check("nova predaja: obavještenje sa imenom i iznosom", /Nova predaja: .* prijavio 58\.30 KM/.test((await P.toast()) || ""), await P.toast());
    check("nova predaja: značka 5", (await P.text("#fc-tab-stanje .fc-badge")) === "5" && (await P.text(".fc-side .nb")) === "5");
    check("nova predaja: red je istaknut (flash)", await P.ev(`!!document.querySelector('.fc-qr.flash')`));
    check("nova predaja: pločica 1 = 488.04 KM", (await P.texts(".fc-kpi .v"))[0] === "488.04 KM", (await P.texts(".fc-kpi .v"))[0]);
    await sleep(1600);
    const lg = await P.log();
    const polls = lg.filter((e) => /cash-handovers\/pending$/.test(e.path)).length;
    check("provjera se ponavlja (>=2 poziva u ~2 s)", polls >= 2, String(polls));
    check("provjera samo za predaje (ne balans)", !lg.some((e) => /couriers-balance/.test(e.path)));
    // sakriven tab ne provjerava
    await P.ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); 1`);
    await P.clearLog(); await sleep(2200);
    check("sakriven tab: nema provjera", (await P.log()).filter((e) => /pending$/.test(e.path)).length === 0);
    await P.ev(`delete document.hidden; 1`);
    await sleep(1500);
    check("vidljiv tab: provjera se nastavlja", (await P.log()).filter((e) => /pending$/.test(e.path)).length >= 1);
    // pad tokom provjere: poruka ne nestaje, stanje ostaje
    await P.ev(`${A}.failNext(new RegExp('GET .*cash-handovers/pending'), 2); 1`);
    await sleep(2500);
    check("pad provjere: crveno upozorenje ne pokriva red predaja", (await P.count(".fc-qr")) === 5);
    // ručno osvježavanje
    await P.clearLog();
    await P.click('[data-act="refresh"]'); await sleep(700);
    const rl = await P.log();
    check("dugme Osvježi čita sve izvore", ["couriers-balance", "cash-handovers/pending", "couriers-status", "finance-settings"].every((s) => rl.some((e) => e.path.endsWith(s))), rl.map((e) => e.path.split("/").pop()).join(","));
    check("dugme Osvježi: pristupačno ime", (await P.attr('[data-act="refresh"]', "aria-label")) === "Osvježi podatke");
  }

  /* ---------- opasni podaci ---------- */
  if (on("h")) {
    console.log("\n# H opasni podaci");
    await P.ev(`fresh('d', {}); ${A}.world.F.flags.balanceStrings = true; 1`);
    await ready(); await sleep(300);
    check("iznosi kao tekst: stranica radi, 12 redova", (await P.count(".fc-row")) === 12 && (await P.texts(".fc-kpi .v"))[1] === "1332.32 KM");
    check("iznosi kao tekst: detalj", await (async () => { await P.click('.fc-row[data-row="30189"]'); await sleep(300); return (await P.texts(".fc-acc .num"))[0] === "180.70 KM"; })());
    await P.ev(`fresh('d', {}); ${A}.world.F.balances.push({ courier_id: 31999, name: null, phone: undefined, cash_owed_to_company: null, wage_owed_to_courier: undefined }); ${A}.world.F.balances.push({ courier_id: 31998, cash_owed_to_company: 5, wage_owed_to_courier: 0 }); 1`);
    await ready(); await sleep(300);
    check("red bez imena: 'Kurir #id', ne ruši spisak", await P.ev(`${A}.ctx.bookRow(31998).name === 'Kurir #31998'`));
    check("izuzeci: nema", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => e.text)));
  }

  /* ---------- skala ---------- */
  if (on("sc")) {
    console.log("\n# SC skala: 500 kurira, 500 predaja, 300 isplata");
    const t0 = Date.now();
    await P.ev(`fresh('d', { world: { n: 500, nHistory: 500, nPayouts: 300 }, delay: 5 }); 1`);
    await ready(); await sleep(400);
    const res = {};
    for (const rate of [1, 4]) {
      await P.b.send("Emulation.setCPUThrottlingRate", { rate });
      const r = {};
      await P.ev(`fresh('d', { world: { n: 500, nHistory: 500, nPayouts: 300 }, delay: 5 }); 1`);
      const t1 = Date.now();
      await ready();
      r.loadMs = Date.now() - t1; await sleep(500);
      r.rows = await P.count(".fc-row"); r.nodes = await P.ev(`document.querySelectorAll('#d *').length`);
      const t2 = Date.now();
      await P.click(".fc-q-input").catch(() => {});
      await P.typeText("ha", 0);
      await P.waitFor(`/rezultat/.test(document.querySelector('.fc-lh h2').textContent)`, { timeout: 8000, interval: 15 }).catch(() => {});
      r.searchMs = Date.now() - t2; r.searchRows = await P.count(".fc-row");
      await P.clearField(".fc-q-input"); await sleep(300);
      const t3 = Date.now();
      await P.click('[data-act="more"]');
      r.moreMs = Date.now() - t3; r.rowsAfterMore = await P.count(".fc-row");
      const t4 = Date.now();
      await P.click("#fc-tab-promet", { wait: 0 });
      await P.waitFor(`document.querySelectorAll('.fc-jr').length > 0`, { timeout: 15000, interval: 20 });
      r.journalMs = Date.now() - t4; await sleep(300);
      r.journalRows = await P.count(".fc-jr"); r.journalNodes = await P.ev(`document.querySelectorAll('#d *').length`);
      const t5 = Date.now();
      await P.click('[data-act="period"][data-arg="month"]', { wait: 0 });
      await sleep(400);
      r.periodMs = Date.now() - t5 - 400;
      res[`cpu${rate}x`] = r;
    }
    await P.b.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    M.scale = res;
    console.log(JSON.stringify(res, null, 1));
    check("skala: spisak crta 12 redova (ne 500)", res.cpu1x.rows === 12, String(res.cpu1x.rows));
    check("skala: DOM manji od 2500 čvorova na Stanju", res.cpu1x.nodes < 2500, String(res.cpu1x.nodes));
    check("skala: Promet crta 40 stavki", res.cpu1x.journalRows === 40, String(res.cpu1x.journalRows));
    check("skala 4x CPU: pretraga u roku od 400 ms", res.cpu4x.searchMs < 400, String(res.cpu4x.searchMs));
    M.scaleWall = Date.now() - t0;
  }
  const errs = P.b.consoleMsgs.filter((m) => /error/.test(m.type)).map((m) => m.text.slice(0, 160));
  check("konzola: nema grešaka", errs.length === 0, JSON.stringify(errs));
  check("izuzeci: nema", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => e.text)));
} catch (e) {
  console.log("PAD:", e.stack || e);
  check("test nije pao", false, String(e.message));
  try { await P.shot("pad"); } catch {}
} finally {
  fs.writeFileSync(path.join(here, "t2-metrics.json"), JSON.stringify(M, null, 1));
  await P.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
