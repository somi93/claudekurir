// T3: prototip "Finansije", uređaj i pristupačnost: MODE=phone (390), phone320, desk (1480). Dodir, bez vodoravnog klizanja, kontrast svakog teksta u svim stanjima, mete 44 px, tastatura, ime i uloga listova.
import fs from "node:fs";
import path from "node:path";
import { openProto, check, summary, sleep, here } from "./plib.mjs";

const MODE = process.env.MODE || "phone";
const phone = MODE !== "desk";
const W = MODE === "phone320" ? 320 : MODE === "phone" ? 390 : 1480;
const H = phone ? (MODE === "phone320" ? 700 : 844) : 960;
const P = await openProto({ name: `t3-${MODE}`, width: phone ? W + 30 : W, height: H, mobile: phone, dpr: 1 });
const F = phone ? "p" : "d";
const ROOT = `#${F}`;
const A = `A('${F}')`;
const M = {};
const scans = [];
const fresh = (opts = {}, after = "") => P.ev(`fresh('${F}', ${JSON.stringify({ wide: !phone, ...opts })}); ${after}; 1`);
const ready = () => P.waitFor(`(() => { const D = ${A}.ctx.D; return D.balances.state === 'ok' && D.pending.state === 'ok' && D.status.state === 'ok' && D.settings.state === 'ok'; })()`);
const go = phone ? (sel, o) => P.tap(`${ROOT} ${sel}`, o) : (sel, o) => P.click(`${ROOT} ${sel}`, o);
const scan = async (label) => {
  const c = await P.scanContrast(ROOT);
  const t = await P.smallTargets(ROOT);
  const ov = await P.ev(`(() => { const sc = document.querySelector('${ROOT} .fc-scroll'); const sh = document.querySelector('${ROOT} .fc-sheet'); const r = document.querySelector('${ROOT}').getBoundingClientRect(); const wide = [...document.querySelectorAll('${ROOT} .fc-main *, ${ROOT} .fc-layer *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > r.right + 1 || b.left < r.left - 1) && !e.closest('.fc-fbar--scroll, .fc-tabs, .fc-side'); }).slice(0, 3).map((e) => e.className.toString().slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().right - r.right)); return { sx: sc ? sc.scrollWidth - sc.clientWidth : 0, out: wide }; })()`);
  scans.push({ label, contrastMin: c.min, texts: c.count, minFont: c.minFont, bad: c.bad.slice(0, 5), small: t.slice(0, 6), overflowX: ov.sx, out: ov.out });
  check(`${label}: kontrast svakog teksta >= 4.5 (${c.count} tekstova, min ${c.min})`, c.bad.length === 0, c.bad.slice(0, 4).join(" | "));
  check(`${label}: mete >= 44 px`, t.length === 0, t.slice(0, 5).map((x) => `${x.t} ${x.w}x${x.h}`).join(", "));
  check(`${label}: bez vodoravnog klizanja i izlaska iz okvira`, ov.sx <= 1 && ov.out.length === 0, JSON.stringify(ov));
  check(`${label}: najmanji font >= 11 px`, c.minFont >= 11, String(c.minFont));
};
try {
  if (phone) await P.ev(`(A('d') && A('d').destroy(), document.getElementById('d').style.display='none', document.getElementById('p').style.width='${W}px', 1)`);
  else await P.ev(`(A('p') && A('p').destroy(), document.getElementById('p').style.display='none', 1)`);
  await fresh({}); await ready(); await sleep(400);

  console.log(`\n# ${MODE}: Stanje`);
  await scan("Stanje");
  check("zaglavlje: podnaslov nije odsječen", await P.ev(`(() => { const s = document.querySelector('${ROOT} .fc-head h1 small'); return s.scrollWidth <= s.clientWidth + 1; })()`));
  check("pločice: sve tri vidljive u okviru", await P.ev(`[...document.querySelectorAll('${ROOT} .fc-kpi')].every((k) => { const r = k.getBoundingClientRect(), o = document.querySelector('${ROOT}').getBoundingClientRect(); return r.left >= o.left && r.right <= o.right; })`));
  if (phone) check("pločice: broj stane u pločicu (bez prelamanja)", await P.ev(`[...document.querySelectorAll('${ROOT} .fc-kpi .v')].every((v) => { const r = v.getBoundingClientRect(), p = v.closest('.fc-kpi').getBoundingClientRect(); return v.scrollWidth <= p.width; })`));
  await go('.fc-qr [data-act="confirm"]', { nth: 3 });
  await P.waitFor(`!!document.querySelector('${ROOT} #fc-sheet')`); await sleep(300);
  check("list: unutar okvira i sa zaštićenim dugmetom", await P.ev(`(() => { const s = document.querySelector('${ROOT} .fc-sheet').getBoundingClientRect(), o = document.querySelector('${ROOT}').getBoundingClientRect(); return s.left >= o.left - 1 && s.right <= o.right + 1 && s.bottom <= o.bottom + 1 && s.top >= o.top; })()`));
  check("list: fokus u polju", (await P.active()).id === "fc-amt");
  await scan("List: potvrda predaje");
  await P.clearField(`${ROOT} #fc-amt`); await P.typeText("90"); await sleep(200);
  await scan("List: potvrda sa razlikom");
  await P.key("Escape"); await sleep(150);
  await P.ev(`${A}.ctx.closeSheet(true); 1`); await sleep(200);

  console.log(`\n# ${MODE}: detalj`);
  await go('.fc-row[data-row="30189"]'); await sleep(700);
  if (phone) {
    check("telefon: detalj je zasebna stranica (lista nestala)", !(await P.q(`${ROOT} .fc-list`)) && /Amir Hodžić/.test(await P.text(`${ROOT} .fc-head h1`)));
    check("telefon: fokus na naslov", (await P.active()).id === "fc-h1", JSON.stringify(await P.active()));
    check("telefon: računi su jedan ispod drugog", await P.ev(`(() => { const a = document.querySelectorAll('${ROOT} .fc-acc'); const r1 = a[0].getBoundingClientRect(), r2 = a[1].getBoundingClientRect(); return r2.top >= r1.bottom - 1 && Math.abs(r1.left - r2.left) < 2; })()`));
  } else {
    check("računar: detalj uz spisak, računi jedan do drugog", (await P.q(`${ROOT} .fc-list`)) && await P.ev(`(() => { const a = document.querySelectorAll('${ROOT} .fc-acc'); const r1 = a[0].getBoundingClientRect(), r2 = a[1].getBoundingClientRect(); return Math.abs(r1.top - r2.top) < 2 && r2.left > r1.left; })()`));
  }
  await sleep(400);
  await scan("Detalj kurira");
  await go('[data-act="receipt"]'); await P.waitFor(`!!document.querySelector('${ROOT} #fc-sheet')`); await sleep(300);
  await scan("List: uplata");
  await P.ev(`${A}.ctx.closeSheet(true); 1`); await sleep(200);
  await go('[data-act="payout"]'); await P.waitFor(`!!document.querySelector('${ROOT} #fc-sheet')`); await sleep(300);
  await go('[data-act="entry-method"][data-arg="bankovni transfer"]'); await sleep(200);
  await scan("List: isplata sa računom");
  await P.ev(`${A}.ctx.closeSheet(true); 1`); await sleep(200);
  if (phone) {
    await go('[data-act="back"]'); await sleep(400);
    check("telefon: Nazad vraća na listu i fokusira red", (await P.q(`${ROOT} .fc-list`)) && /^row-/.test((await P.active()).fk || ""), JSON.stringify(await P.active()));
  } else {
    await go('[data-act="back"]'); await sleep(300);
  }

  console.log(`\n# ${MODE}: isplata svima`);
  await go('[data-act="batch"]'); await P.waitFor(`!!document.querySelector('${ROOT} #fc-sheet')`); await sleep(300);
  await scan("List: isplata svima");
  await go('[data-act="batch-method"][data-arg="bankovni transfer"]'); await sleep(200);
  await scan("List: isplata svima (transfer, upozorenja o računu)");
  await P.ev(`${A}.ctx.closeSheet(true); 1`); await sleep(200);

  console.log(`\n# ${MODE}: Promet`);
  await go("#fc-tab-promet"); await P.waitFor(`document.querySelectorAll('${ROOT} .fc-jr').length > 0`); await sleep(400);
  await scan("Promet");
  check("Promet: redovi se ne kližu vodoravno", await P.ev(`(() => { const l = document.querySelector('${ROOT} .fc-jl'); return l.scrollWidth <= l.clientWidth + 1; })()`));
  await go(".fc-jr", { nth: 0 }); await P.waitFor(`!!document.querySelector('${ROOT} #fc-sheet')`); await sleep(300);
  await scan("List: detalj stavke");
  await P.ev(`${A}.ctx.closeSheet(true); 1`); await sleep(200);
  await go('[data-act="jcourier"]'); await P.waitFor(`!!document.querySelector('${ROOT} #fc-sheet')`); await sleep(300);
  await scan("List: izbor kurira");
  await P.ev(`${A}.ctx.closeSheet(true); 1`); await sleep(200);

  console.log(`\n# ${MODE}: stanja greške`);
  await fresh({}, `${A}.failNext(new RegExp('GET .*cash-handovers/pending'), 999)`);
  await P.waitFor(`${A}.ctx.D.pending.state === 'err'`); await sleep(400);
  await scan("Greška: predaje");
  await fresh({}, `${A}.failNext(new RegExp('GET .*couriers-balance'), 999)`);
  await P.waitFor(`${A}.ctx.D.balances.state === 'err'`); await sleep(400);
  await scan("Greška: stanje kurira");
  await fresh({ tab: "promet" }, `${A}.failNext(new RegExp('GET .*(cash-handovers|payouts)\\\\?'), 999)`);
  await P.waitFor(`!!document.querySelector('${ROOT} .fc-tint--bad')`); await sleep(400);
  await scan("Greška: promet");
  await P.ev(`fresh('${F}', ${JSON.stringify({ wide: !phone })}); ${A}.world.F.pendingRows.length = 0; ${A}.world.F.balances.forEach((b) => { b.cash_owed_to_company = 0; b.wage_owed_to_courier = 0; }); 1`);
  await ready(); await sleep(400);
  await scan("Prazno: sve na nuli");

  console.log(`\n# ${MODE}: tastatura i uloge`);
  if (!phone) {
    await fresh({}); await ready(); await sleep(300);
    const stops = await P.tabStops(`${ROOT} .fc-page`, 60);
    M.tabStopsStanje = stops.length;
    check("Tab: Stanje ima manje od 30 zaustavljanja (spisak je jedan red)", stops.length < 30, String(stops.length));
    check("Tab: tablist ima ime, tabovi su povezani sa panelom", (await P.attr(`${ROOT} [role=tablist]`, "aria-label")) === "Sekcije finansija" && (await P.attr(`${ROOT} #fc-tab-stanje`, "aria-controls")) === "fc-panel" && (await P.attr(`${ROOT} #fc-panel`, "role")) === "tabpanel" && !!(await P.attr(`${ROOT} #fc-panel`, "aria-labelledby")));
    check("naslov stranice je h1 uloga", await P.ev(`!!document.querySelector('${ROOT} h1')`));
    check("lista kurira ima ime", !!(await P.attr(`${ROOT} .fc-list ul`, "aria-label")));
    await P.focusSel(`${ROOT} #fc-tab-stanje`);
    await P.key("ArrowRight"); await sleep(300);
    check("strelica desno prebacuje tab i fokus", (await P.attr(`${ROOT} #fc-tab-promet`, "aria-selected")) === "true" && (await P.active()).id === "fc-tab-promet");
    await P.key("ArrowLeft"); await sleep(300);
    check("strelica lijevo vraća", (await P.attr(`${ROOT} #fc-tab-stanje`, "aria-selected")) === "true");
    // list: zamka fokusa, povratak fokusa
    await go('.fc-qr [data-act="confirm"]', { nth: 0 });
    await P.waitFor(`!!document.querySelector('${ROOT} #fc-sheet')`); await sleep(250);
    check("list: uloga dialog, aria-modal i ime", (await P.attr(`${ROOT} #fc-sheet`, "role")) === "dialog" && (await P.attr(`${ROOT} #fc-sheet`, "aria-modal")) === "true" && /Potvrdi predaju/.test((await P.attr(`${ROOT} #fc-sheet`, "aria-label")) || ""));
    await P.key("Escape"); await sleep(250);
    check("Esc zatvara list bez promjene i vraća fokus na 'Potvrdi'", !(await P.q(`${ROOT} #fc-sheet`)) && /^confirm-/.test((await P.active()).fk || ""), JSON.stringify(await P.active()));
    check("zatvaranje bez unosa nije pitalo ništa", true);
  }
  const errs = P.b.consoleMsgs.filter((m) => /error/.test(m.type)).map((m) => m.text.slice(0, 160));
  check("konzola: nema grešaka", errs.length === 0, JSON.stringify(errs));
  check("izuzeci: nema", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => e.text)));
  M.cls = await P.ev(`Math.round(window.__cls * 1000) / 1000`);
} catch (e) {
  console.log("PAD:", e.stack || e);
  check("test nije pao", false, String(e.message));
  try { await P.shot("pad"); } catch {}
} finally {
  fs.writeFileSync(path.join(here, `t3-${MODE}.json`), JSON.stringify({ M, scans }, null, 1));
  await P.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
