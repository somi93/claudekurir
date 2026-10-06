// "PRIJE" 8: veza ?c=ID (dugme "Na mapi" sa stranice Kuriri) i čiste brojke pomaka rasporeda (CLS) sa izvorima.
import fs from "node:fs";
import path from "node:path";
import { session, sleep, out } from "./lh.mjs";

const M = {};
const mapState = `(() => { const el = document.querySelector('.leaflet-container'); let p = el && el.__vueParentComponent, map = null; for (let i = 0; i < 6 && p && !map; i++) { map = p.setupState && p.setupState.leafletObject; p = p.parent; } if (!map) return null; const c = map.getCenter(); return { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), zoom: map.getZoom() }; })()`;

for (const [label, id] of [["sa pozicijom", 30189], ["bez pozicije", 30201], ["nepoznat", 99999]]) {
  const s = await session("before", { width: 1440, height: 900 });
  try {
    await s.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `window.__shifts = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: e.value, t: Math.round(e.startTime), src: (e.sources || []).map((s) => { const n = s.node; const el = n && n.nodeType === 1 ? n : n && n.parentElement; return el ? (el.closest('.v-navigation-drawer') ? 'ljuska:meni' : el.closest('.dispatcher-content') ? 'stranica:' + (el.closest('.map-card') ? 'mapa' : el.closest('.sidebar-card') ? 'lista' : el.closest('.status-filter') ? 'pilule' : 'ostalo') : el.closest('.page-header') ? 'stranica:zaglavlje' : 'ljuska:' + (el.className && String(el.className).split(' ')[0])) : '?'; }) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}`,
    });
    const t0 = Date.now();
    await s.load(`/dispatcher?c=${id}`, { wait: ".dispatcher-grid", timeout: 120000 });
    await s.idle(800, 30000);
    await sleep(3500);
    const r = {
      label, id,
      map: await s.evalJs(mapState),
      card: await s.evalJs(`(document.querySelector('.selected-card .selected-id') || {}).textContent || null`),
      msg: await s.evalJs(`[...document.querySelectorAll('.v-alert, .overlay-alert, .v-snackbar')].map((e) => e.innerText.trim())`),
    };
    if (id === 30189) {
      r.shifts = await s.evalJs(`window.__shifts`);
      r.cls = Math.round(r.shifts.reduce((a, x) => a + x.v, 0) * 1000) / 1000;
      const bySrc = {};
      for (const sh of r.shifts) for (const k of [...new Set(sh.src)]) bySrc[k] = Math.round(((bySrc[k] || 0) + sh.v / Math.max(1, sh.src.length)) * 1000) / 1000;
      r.clsBySource = bySrc;
      r.clsPage = Object.entries(bySrc).filter(([k]) => k.startsWith("stranica")).reduce((a, [, v]) => a + v, 0);
      r.clsShell = Object.entries(bySrc).filter(([k]) => k.startsWith("ljuska")).reduce((a, [, v]) => a + v, 0);
    }
    M[label] = r;
    console.log(JSON.stringify(r));
    if (id === 30189) await s.shot("b8-link");
  } finally {
    await s.close();
  }
}
fs.writeFileSync(path.join(out, "b8.json"), JSON.stringify(M, null, 1));
console.log("gotovo");
