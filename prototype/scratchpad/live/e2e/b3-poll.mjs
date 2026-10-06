// "PRIJE" 3: osvježavanje - interval, popup svježeg kurira, skriven tab, treptanje dugmeta, tastatura u listi.
import fs from "node:fs";
import path from "node:path";
import { session, sleep, out } from "./lh.mjs";

const M = {};
const s = await session("before", { width: 1440, height: 900 });
const getMap = `(() => { const el = document.querySelector('.leaflet-container'); let p = el.__vueParentComponent, map = null; for (let i = 0; i < 6 && p && !map; i++) { map = p.setupState && p.setupState.leafletObject; p = p.parent; } return map; })()`;
try {
  await s.load("/dispatcher", { wait: ".courier-item", timeout: 120000 });
  await s.idle(800, 30000);
  await sleep(1500);

  // --- tastatura u listi: Tab u listu, strelica, Enter
  await s.evalJs(`document.querySelector('.courier-search input').focus()`);
  await s.key("Tab");
  await s.key("ArrowDown");
  const before = await s.evalJs(`(document.activeElement.querySelector('.courier-name') || {}).textContent`);
  await s.key("Enter");
  await sleep(1500);
  M.keyboard = await s.evalJs(`({ focusedName: (document.activeElement.querySelector && document.activeElement.querySelector('.courier-name') || {}).textContent || null, selected: !!document.querySelector('.selected-card'), cardName: (document.querySelector('.selected-card .selected-id') || {}).textContent || null })`);
  M.keyboard.before = before;
  console.log("tastatura:", JSON.stringify(M.keyboard));

  // --- popup svježeg kurira (u dostavi) i osvježavanje
  await s.evalJs(`(${getMap}).setView([44.7722, 17.191], 14, { animate: false }) && true`);
  await sleep(1200);
  // nađi marker koji pripada kuriru u dostavi sa svježim signalom: Amir Hodžić 30189 - klikni red pa zatim marker u sredini mape
  await s.click(".courier-item", { nth: 0, scroll: false });
  await sleep(2500);
  // izabrani marker je 26 px i u sredini mape
  const sel = await s.evalJs(`(() => { const ps = [...document.querySelectorAll('path.leaflet-interactive')].map((p) => { const r = p.getBoundingClientRect(); return { w: Math.round(r.width), x: r.left + r.width / 2, y: r.top + r.height / 2 }; }).filter((m) => m.w === 26); return ps[0] || null; })()`);
  console.log("izabrani marker:", JSON.stringify(sel));
  if (sel) {
    await s.clickAt(sel.x, sel.y, 500);
    M.popupOpen = await s.evalJs(`!!document.querySelector('.leaflet-popup')`);
    s.clearLog();
    // sačekaj prvi automatski krug (15 s)
    const t0 = Date.now();
    let closedAt = null;
    for (let i = 0; i < 90 && closedAt === null; i++) {
      await sleep(250);
      if (!(await s.evalJs(`!!document.querySelector('.leaflet-popup')`))) closedAt = Date.now() - t0;
    }
    M.popupClosedByPollMs = closedAt;
    console.log("popup otvoren:", M.popupOpen, "; zatvorio ga je automatski krug poslije (ms):", closedAt);
  }

  // --- interval i treptanje dugmeta "Osveži" uz kašnjenje odgovora 700 ms; 36 s uzorkovanja
  s.setFlags({ delays: [{ re: /courier-locations/, ms: 700 }] });
  s.clearLog();
  const samples = [];
  const tEnd = Date.now() + 36000;
  const t00 = Date.now();
  while (Date.now() < tEnd) {
    const busy = await s.evalJs(`!!document.querySelector('.page-header .v-btn--loading')`);
    samples.push({ t: Date.now() - t00, busy });
    await sleep(100);
  }
  const reqs = s.logOf(/courier-locations/).map((e) => Math.round((e.t - t00) / 100) / 10);
  const busyMs = samples.filter((x) => x.busy).length * 100;
  M.poll = { requestsAtSec: reqs, busyMs, observedMs: 36000 };
  console.log("interval (s od starta):", JSON.stringify(reqs), "; dugme 'Osveži' u stanju učitavanja ms:", busyMs);

  // --- skriven tab: preglašen document.hidden; broji zahtjeve 36 s
  s.setFlags({ delays: [] });
  await s.evalJs(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));`);
  s.clearLog();
  await sleep(36000);
  M.hidden = { requestsWhileHidden: s.logOf(/courier-locations/).length, flaggedHidden: s.logOf(/courier-locations/).every((e) => e.hidden === true) };
  console.log("zahtjeva dok je tab skriven (36 s):", JSON.stringify(M.hidden));
  await s.evalJs(`delete document.hidden; delete document.visibilityState;`);

  fs.writeFileSync(path.join(out, "b3.json"), JSON.stringify(M, null, 1));
} finally {
  await s.close();
}
console.log("gotovo");
