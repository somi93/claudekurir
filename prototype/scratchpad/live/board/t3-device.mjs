// Prototip "Kuriri uživo": telefon (dodir, donji list sa tri visine), kontrast, mete, Tab redoslijed, 320 px; i računar (kontrast i mete u svim stanjima).
import fs from "node:fs";
import { openProto, check, summary, sleep } from "./lib.mjs";

/* ============ računar: kontrast, mete, Tab ============ */
const D = await openProto({ name: "t3", width: 1480, height: 1000, dpr: 1 });
const dev = D.ev;
const dboot = async (opts = {}, settle = 600) => { await dev(`fresh('d', ${JSON.stringify({ pollMs: 60000, ordersMs: 60000, slowMs: 60000, ...opts })})`); await D.waitFor("A('d').ctx.ready", { timeout: 15000 }); await sleep(settle); };
const results = { minC: 99, texts: 0, states: 0, minFont: 99 };
const scan = async (label, root = "#d .lv") => {
  const c = await D.scanContrast(root);
  const t = await D.smallTargets(root);
  check(`računar, ${label}: kontrast svakog teksta ≥ 4.5 (${c.count} tekstova, najslabije ${c.min})`, c.bad.length === 0, c.bad.slice(0, 4).join(" | "));
  check(`računar, ${label}: nijedna meta ispod 44 px`, t.length === 0, JSON.stringify(t.slice(0, 4)));
  results.minC = Math.min(results.minC, c.min); results.texts += c.count; results.states++; results.minFont = Math.min(results.minFont, c.minFont);
};
await dboot();
await scan("početno stanje");
await D.click("#d .lv-row", { nth: 1, wait: 800 });
await scan("izabran kurir");
await D.click("#d .lv-row[data-arg='30234']", { wait: 800 });
await scan("kurir bez signala (crveno upozorenje)");
await D.click("#d .lv-qa [data-act=msg]", { wait: 400 });
await scan("list za poruku");
await D.click("#d .lv-sh-x");
await D.click("#d .lv-tab", { nth: 1, wait: 500 });
await scan("tab Narudžbe sa 'Traži pažnju'");
await D.click("#d .lv-orow", { nth: 1, wait: 700 });
await scan("izabrana narudžba");
await D.click("#d [data-act=legend]", { wait: 200 });
await scan("otvorena legenda");
await D.click("#d [data-act=legend]", { wait: 100 });
await D.click("#d [data-act=menu]", { wait: 200 });
await scan("otvoren meni slojeva");
await dev(`document.querySelector('#d [data-act=menu]').click()`);
await dboot({ fail: "locs" }, 800);
await scan("pad pozicija");
await dboot({ fail: "rows" }, 800);
await scan("pad spiska");
await dboot({ empty: "fleet" }, 800);
await scan("firma bez kurira");
await dboot({}, 600);
// Tab redoslijed cijele stranice
await dev(`document.querySelector('#d [data-fk=back]').focus()`);
const stops = [];
for (let i = 0; i < 80; i++) {
  await D.key("Tab");
  const t = await dev(`(() => { const e = document.activeElement; const r = document.querySelector('#d .lv'); return e && r.contains(e) ? { fk: e.getAttribute('data-fk'), role: e.getAttribute('role') } : null; })()`);
  if (!t) break;
  stops.push(t);
}
const rowStops = stops.filter((s) => s.fk && /^row:/.test(s.fk)).length;
check("Tab: spisak kurira je jedno zaustavljanje", rowStops === 1, `${rowStops}`);
results.tabStops = stops.length;
check("Tab: cijela stranica ima razumno zaustavljanja (do 30), a nijedno nije skriveno", stops.length <= 30 && stops.every((s) => s.fk), `${stops.length}`);
// prvi ekran računara (1440x900): šta se vidi bez skrolanja
const lay = await dev(`(() => {
  const f = document.querySelector('#d').getBoundingClientRect();
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top - f.top), h: Math.round(b.height), w: Math.round(b.width), b: Math.round(b.bottom - f.top) }; };
  const body = document.querySelector('#d .lv-pbody').getBoundingClientRect();
  const rows = [...document.querySelectorAll('#d .lv-row')].map((e) => e.getBoundingClientRect());
  return { head: r('.lv-head'), strip: r('.lv-strip'), map: r('.lv-mapwrap'), panel: r('.lv-panel'), body: r('.lv-pbody'), rowH: Math.round(rows[0].height), rowsFull: rows.filter((b) => b.top >= body.top - 1 && b.bottom <= body.bottom + 1).length };
})()`);
console.log("raspored računar:", JSON.stringify(lay));
results.lay = lay;
check("računar: karta zauzima sav prostor ispod trake (do dna ekrana)", lay.map.b >= 880 && lay.map.h >= 650, JSON.stringify(lay.map));
check("računar: karta je šira od stare (700 px prema 692)", lay.map.w >= 690, String(lay.map.w));
await D.close();

/* ============ telefon ============ */
const PH = await openProto({ name: "t3p", width: 390, height: 844, dpr: 2, mobile: true, url: new URL("phone.html", import.meta.url).href });
const pev = PH.ev;
const pboot = async (opts = {}, settle = 700) => { await pev(`fresh('p', ${JSON.stringify({ wide: false, pollMs: 60000, ordersMs: 60000, slowMs: 60000, ...opts })})`); await PH.waitFor("A('p').ctx.ready", { timeout: 15000 }); await sleep(settle); };
const pst = (expr) => pev(`(() => { const a = A('p'); return (${expr}); })()`);
const tapAt = async (x, y, wait = 250) => { await PH.b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] }); await PH.b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(wait); };
const rectP = (sel) => pev(`(() => { const e = document.querySelector(${JSON.stringify('#p ' + sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right }; })()`);
const scanP = async (label) => {
  const c = await PH.scanContrast("#p .lv");
  const t = await PH.smallTargets("#p .lv");
  check(`telefon, ${label}: kontrast svakog teksta ≥ 4.5 (${c.count} tekstova, najslabije ${c.min})`, c.bad.length === 0, c.bad.slice(0, 4).join(" | "));
  check(`telefon, ${label}: nijedna meta ispod 44 px`, t.length === 0, JSON.stringify(t.slice(0, 4)));
  results.minC = Math.min(results.minC, c.min); results.texts += c.count; results.states++; results.minFont = Math.min(results.minFont, c.minFont);
};
// karta na telefonu: poruka na karti, legenda i razmjera ne smiju ni da se dodiruju ni da završe iza donjeg lista
const mapBits = () => pev(`(() => {
  const r = (s) => { const e = document.querySelector('#p ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
  return { note: r('.lv-mnote > div'), leg: r('.lv-leg > button'), scale: r('.lv-scale'), panel: r('.lv-panel'), map: r('.lv-map'), mc: r('.lv-mc') };
})()`);
const hit = (a, b) => !!(a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t);
const scaleClash = async () => {
  const bad = [];
  for (let z = 10; z <= 17; z += 0.5) {
    await pev(`(() => { const m = A('p').ctx.parts.map; m.setView({ cx: m.view.cx, cy: m.view.cy, z: ${z} }); return true; })()`);
    await sleep(120);
    const b = await mapBits();
    if (hit(b.leg, b.scale)) bad.push(`zum ${z}: ${JSON.stringify(b.leg)} ~ ${JSON.stringify(b.scale)}`);
  }
  return bad;
};
await pboot();
{
  const panel = await rectP(".lv-panel");
  check("telefon: panel je na dnu i visok 100 px (peek)", Math.abs(panel.h - 100) < 1.5 && Math.abs(panel.b - 844) < 1.5, JSON.stringify(panel));
  check("telefon: nema vodoravnog klizanja stranice", await pev(`document.documentElement.scrollWidth <= innerWidth + 1`));
  const view = await pev(`(() => { const m = A('p').ctx.parts.map; return { w: m.size.w, h: m.size.h }; })()`);
  const recent = await pst(`a.ctx.V.cs.filter((c) => c.loc && (c.live !== 'offline' || c.sigMs <= a.ctx.LV.RECENT_MS)).map((c) => c.id)`);
  let inside = 0;
  for (const id of recent) {
    const s = await pst(`(() => { const c = a.ctx.V.byId.get(${id}); const m = a.ctx.parts.map; return a.ctx.LV.toScreen(a.ctx.LV.toMeters(c.loc.latitude, c.loc.longitude), m.view, m.size); })()`);
    if (s.x >= 0 && s.x <= view.w && s.y >= 0 && s.y <= view.h - 100) inside++;
  }
  check("telefon: svi kuriri na terenu su vidljivi iznad donjeg lista", inside === recent.length, `${inside}/${recent.length}`);
  check("telefon: pločice stanja kližu vodoravno (jedan red)", await pev(`(() => { const t = document.querySelector('#p .lv-tiles'); return t.scrollWidth > t.clientWidth && t.getBoundingClientRect().height < 60; })()`));
  // izbor kurira dodirom na marker
  const mkInfo = await pev(`(() => { const m = document.querySelector('#p .lv-map').getBoundingClientRect(); const c = [...document.querySelectorAll('#p .lv-mk')].map((e) => { const b = e.getBoundingClientRect(); return { id: Number(e.getAttribute('data-arg')), x: b.left + b.width / 2, y: b.top + b.height / 2 }; }).filter((p) => p.x > 30 && p.x < m.width - 30 && p.y > 60 && p.y < m.height - 140); return c[0] || null; })()`);
  if (mkInfo) await tapAt(mkInfo.x, mkInfo.y, 900);
  check("telefon: dodir na marker bira kurira i list se diže na pola", mkInfo && (await pst(`a.st.selId`)) === mkInfo.id && (await pst(`a.st.snap`)) === "half", `${JSON.stringify(mkInfo)} ${await pst("a.st.selId")} ${await pst("a.st.snap")}`);
  const sel = await rectP(".lv-mk.is-sel");
  const pan = await rectP(".lv-panel");
  check("telefon: izabrani marker je iznad lista, ne ispod njega", sel && sel.b < pan.y + 2, `marker do ${sel && sel.b}, list od ${pan.y}`);
  check("telefon: detalj kurira je odmah vidljiv u listu", await pev(`(() => { const d = document.querySelector('#p .lv-det').getBoundingClientRect(), p = document.querySelector('#p .lv-panel').getBoundingClientRect(); return d.top >= p.top && d.top < p.bottom - 100; })()`));
  await scanP("izabran kurir (pola)");
  // ručka: dodir mijenja visinu
  await tapAt(195, (await rectP(".lv-psh")).y + 20, 400);
  check("telefon: dodir na ručku povećava list (pola -> cijeli)", (await pst(`a.st.snap`)) === "full");
  await tapAt(195, (await rectP(".lv-psh")).y + 20, 400);
  check("telefon: sljedeći dodir ga spušta (cijeli -> peek)", (await pst(`a.st.snap`)) === "peek");
  // povlačenje ručke prstom: gore, gore, dolje
  const gripY = async () => (await rectP(".lv-psh")).y + 20;
  const drag = async (dy) => {
    const y0 = await gripY();
    await PH.b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: y0, id: 1 }] });
    for (let i = 1; i <= 6; i++) await PH.b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: y0 + (dy * i) / 6, id: 1 }] });
    await PH.b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(450);
  };
  await drag(-160);
  check("telefon: povlačenje ručke prema gore diže list (peek -> pola)", (await pst(`a.st.snap`)) === "half", await pst(`a.st.snap`));
  await drag(-160);
  check("telefon: još jedno povlačenje gore (pola -> cijeli)", (await pst(`a.st.snap`)) === "full");
  await drag(160);
  check("telefon: povlačenje dolje spušta (cijeli -> pola)", (await pst(`a.st.snap`)) === "half");
  check("telefon: povlačenje ručke ne mijenja izbor", (await pst(`a.st.selId`)) === mkInfo.id);
  // zatvori detalj
  // CDP: dodir odmah poslije povlačenja Chrome ne pretvara u click (gasi "fling"); pauza je samo za alat, ne za aplikaciju
  await sleep(1500);
  const x = await rectP(".lv-x");
  await tapAt(x.x + 22, x.y + 22, 400);
  check("telefon: X zatvara detalj", (await pst(`a.st.selId`)) == null && !(await pev(`!!document.querySelector('#p .lv-det')`)));
  // pretraga i redovi u listu na pola
  await pev(`A('p').ctx.acts.snap('half')`); await sleep(400);
  const q = await rectP("#lv-q");
  await tapAt(q.x + 30, q.y + 20, 200);
  await PH.typeText("djuric", 5);
  await sleep(200);
  check("telefon: pretraga u listu ('djuric' nalazi Đuriće bez dijakritika)", (await pev(`document.querySelectorAll('#p .lv-row').length`)) >= 2 && /Đurić/.test(await pev(`document.querySelector('#p .lv-row').textContent`)));
  await scanP("spisak sa pretragom (pola)");
  await pev(`(() => { const i = document.querySelector('#p #lv-q'); i.value=''; i.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  // Narudžbe
  await pev(`A('p').ctx.acts.snap('peek')`); await sleep(400);
  const tab = await rectP("#lv-t-n");
  await tapAt(tab.x + tab.w / 2, tab.y + tab.h / 2, 500);
  check("telefon: dodir na tab 'Narudžbe' iz peek-a otvara list i tab", (await pst(`a.st.snap`)) === "half" && (await pst(`a.st.tab`)) === "n");
  await scanP("Narudžbe (pola)");
  await pev(`A('p').ctx.acts.snap('full')`); await sleep(400);
  await scanP("Narudžbe (cijeli)");
  // list za poruku na telefonu
  await pev(`A('p').ctx.selectCourier(30234)`); await sleep(500);
  await pev(`A('p').ctx.acts.msg('where')`); await sleep(300);
  const sh = await rectP(".lv-sheet");
  check("telefon: list za poruku je donji list preko cijele širine", sh && sh.w >= 380 && Math.abs(sh.b - 844) < 2, JSON.stringify(sh));
  await scanP("list za poruku");
  await pev(`A('p').ctx.closeSheet(true)`);
  // pad pozicija na telefonu
  await pboot({ fail: "locs" }, 900);
  check("telefon, pad pozicija: obavještenje ne preklapa dugmad na karti", await pev(`(() => { const n = document.querySelector('#p .lv-notes').getBoundingClientRect(), c = document.querySelector('#p .lv-mc').getBoundingClientRect(); return n.height > 0 && n.right <= c.left + 1; })()`));
  await scanP("pad pozicija");
  await PH.shot("p-locs-fail");
  await pboot({ snap: "half" }, 700);
  const clash390 = await scaleClash();
  check("telefon: razmjera i legenda se ne dodiruju ni na jednom zumu (10 do 17)", clash390.length === 0, clash390.slice(0, 2).join(" | "));
  for (const [label, opts] of [["pad spiska, pola", { fail: "rows", snap: "half" }], ["firma bez kurira, peek", { empty: "fleet" }]]) {
    await pboot(opts, 900);
    const mb = await mapBits();
    check(`telefon, ${label}: poruka na karti je cijela iznad lista`, !!(mb.note && mb.panel && mb.note.b <= mb.panel.t + 1), JSON.stringify(mb));
    check(`telefon, ${label}: poruka na karti ne preklapa legendu, razmjeru ni kontrole karte`, !!mb.note && !hit(mb.note, mb.leg) && !hit(mb.note, mb.scale) && !hit(mb.note, mb.mc), JSON.stringify(mb));
  }
}

/* ============ mali telefoni: poruka na karti staje u vidljivi dio karte ============ */
for (const [w, h] of [[375, 667], [360, 640]]) {
  await PH.b.setViewport(w, h, 2, true);
  for (const [label, opts] of [["pad spiska, pola", { fail: "rows", snap: "half" }], ["firma bez kurira, peek", { empty: "fleet" }]]) {
    await pboot(opts, 900);
    const mb = await mapBits();
    check(`${w}×${h}, ${label}: poruka na karti je cijela između vrha karte i lista`, !!(mb.note && mb.map && mb.panel && mb.note.t >= mb.map.t - 1 && mb.note.b <= mb.panel.t + 1), JSON.stringify(mb));
    check(`${w}×${h}, ${label}: poruka na karti ne preklapa legendu, razmjeru ni kontrole karte`, !!mb.note && !hit(mb.note, mb.leg) && !hit(mb.note, mb.scale) && !hit(mb.note, mb.mc), JSON.stringify(mb));
  }
}

/* ============ 320 px ============ */
await PH.b.setViewport(320, 640, 2, true);
await pboot({}, 800);
{
  check("320 px: nema vodoravnog klizanja", await pev(`document.documentElement.scrollWidth <= innerWidth + 1`), await pev(`document.documentElement.scrollWidth + ' > ' + innerWidth`));
  const head = await pev(`(() => { const h = document.querySelector('#p .lv-head'); const btns = [...h.querySelectorAll('button,a')].map((e) => e.getBoundingClientRect()); return { right: Math.max(...btns.map((b) => b.right)), w: innerWidth, h: h.getBoundingClientRect().height }; })()`);
  check("320 px: dugmad u zaglavlju staju u širinu", head.right <= head.w, JSON.stringify(head));
  check("320 px: naslov nije odsječen (h1 vidljiv)", await pev(`(() => { const e = document.querySelector('#p .lv-head h1').getBoundingClientRect(); return e.width > 80 && e.right <= innerWidth; })()`));
  await pev(`A('p').ctx.acts.snap('half')`); await sleep(400);
  const c = await PH.scanContrast("#p .lv");
  const t = await PH.smallTargets("#p .lv");
  check("320 px: kontrast i mete u redu", c.bad.length === 0 && t.length === 0, `${c.bad.slice(0, 2).join(" | ")} ${JSON.stringify(t.slice(0, 3))}`);
  const clash320 = await scaleClash();
  check("320 px: razmjera i legenda se ne dodiruju ni na jednom zumu (10 do 17)", clash320.length === 0, clash320.slice(0, 2).join(" | "));
  await PH.shot("p-320");
}

console.log("\nMJERENJA:", JSON.stringify(results));
fs.mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../out/t3.json", import.meta.url), JSON.stringify(results, null, 1));
const failed = summary();
await PH.close();
process.exit(failed ? 1 : 0);
