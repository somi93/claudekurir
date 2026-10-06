// "PRIJE" 2: izbor kurira (lista -> mapa, mapa -> lista), popup, kartica, tab zaustavljanja, tastatura, ponašanje popupa pri osvježavanju.
import fs from "node:fs";
import path from "node:path";
import { session, check, summary, sleep, out } from "./lh.mjs";

const M = {};
const s = await session("before", { width: 1440, height: 900 });
const mapState = `(() => {
  const el = document.querySelector('.leaflet-container');
  const c = el && el.__vueParentComponent; let map = null; let p = c;
  for (let i = 0; i < 6 && p && !map; i++) { map = p.setupState && p.setupState.leafletObject; p = p.parent; }
  if (!map) return null;
  const ctr = map.getCenter();
  return { lat: ctr.lat, lng: ctr.lng, zoom: map.getZoom() };
})()`;
const settle = async () => {
  // čekaj da se animacija leta završi
  let last = "";
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const st = JSON.stringify(await s.evalJs(mapState));
    if (st === last && !(await s.evalJs(`!!document.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim')`))) { await sleep(500); return; }
    last = st;
  }
};
try {
  await s.load("/dispatcher", { wait: ".courier-item", timeout: 120000 });
  await s.idle(800, 30000);
  await sleep(1500);

  // 1) tab zaustavljanja: šta su
  M.stopsList = await s.evalJs(`(() => {
    const root = document.querySelector('.dispatcher-content');
    const all = [...root.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter((e) => { const ti = e.getAttribute('tabindex'); if (ti === '-1' || e.disabled) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const by = {};
    for (const e of all) { const k = e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').filter(Boolean)[0] : ''); by[k] = (by[k] || 0) + 1; }
    return by;
  })()`);
  console.log("stops by:", JSON.stringify(M.stopsList));

  // 2) klik na red u listi -> mapa leti, kartica kurira
  const rowName = await s.evalJs(`document.querySelectorAll('.courier-item')[1].querySelector('.courier-name').textContent.trim()`);
  await s.click(".courier-item", { nth: 1, scroll: false });
  await settle();
  M.afterRowClick = await s.evalJs(`(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top), h: Math.round(b.height), b: Math.round(b.bottom) }; };
    return { card: r('.selected-card'), side: r('.sidebar-card'), list: r('.courier-list'), innerH: innerHeight, scrollH: document.documentElement.scrollHeight, scrollY: Math.round(scrollY), cardText: (document.querySelector('.selected-card') || {}).innerText };
  })()`);
  M.afterRowClick.map = await s.evalJs(mapState);
  console.log("posle klika na red:", rowName, JSON.stringify(M.afterRowClick));
  await s.shot("b2-selected");

  // 3) markeri: veličina i klik na pravi marker u vidnom polju
  M.markerPx = await s.evalJs(`(() => { const box = document.querySelector('.leaflet-container').getBoundingClientRect(); return [...document.querySelectorAll('path.leaflet-interactive')].map((p) => { const r = p.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), vis: r.width > 0 && r.left + r.width / 2 >= box.left && r.left + r.width / 2 <= box.right && r.top + r.height / 2 >= box.top && r.top + r.height / 2 <= box.bottom }; }).filter((m) => m.vis); })()`);
  console.log("markeri u vidnom polju:", JSON.stringify(M.markerPx));

  // 4) zumiraj da se vidi više markera pa klikni jedan na mapi (drugi kurir) -> popup + da li se kartica osvježi
  await s.evalJs(`(() => { const el = document.querySelector('.leaflet-container'); let p = el.__vueParentComponent, map = null; for (let i = 0; i < 6 && p && !map; i++) { map = p.setupState && p.setupState.leafletObject; p = p.parent; } map.setView([44.7722, 17.191], 13, { animate: false }); })()`);
  await sleep(1200);
  M.markerView13 = await s.evalJs(`(() => { const box = document.querySelector('.leaflet-container').getBoundingClientRect(); return [...document.querySelectorAll('path.leaflet-interactive')].map((p) => { const r = p.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), vis: r.width > 0 && r.left + r.width / 2 >= box.left && r.left + r.width / 2 <= box.right && r.top + r.height / 2 >= box.top && r.top + r.height / 2 <= box.bottom }; }).filter((m) => m.vis); })()`);
  console.log("markeri na zoom 13 nad Banjom Lukom:", M.markerView13.length);
  await s.shot("b2-zoom13");
  // klik na prvi marker koji nije selektovan
  const mk = M.markerView13.find((m) => m.w > 0 && m.w <= 22);
  if (mk) {
    await s.clickAt(mk.x, mk.y, 400);
    M.popup = await s.evalJs(`(() => { const p = document.querySelector('.leaflet-popup'); return p ? { text: p.innerText.replace(/\\n+/g, ' | '), w: Math.round(p.getBoundingClientRect().width), h: Math.round(p.getBoundingClientRect().height) } : null; })()`);
    console.log("popup:", JSON.stringify(M.popup));
    M.cardAfterMarker = await s.evalJs(`(() => (document.querySelector('.selected-card') || {}).innerText)()`);
    console.log("kartica poslije klika na marker:", JSON.stringify(M.cardAfterMarker));
    await s.shot("b2-popup");
  }

  // 5) osvježavanje zatvara popup? (marker ima ključ sa updated_at; svježi kuriri dobijaju novo vrijeme)
  await s.evalJs(`window.__popupOpen = !!document.querySelector('.leaflet-popup');`);
  await s.evalJs(`(() => { window.__mut = { removed: 0, added: 0 }; const pane = document.querySelector('.leaflet-overlay-pane svg'); const mo = new MutationObserver((l) => { for (const m of l) { for (const n of m.removedNodes) if (n.nodeName === 'path') window.__mut.removed++; for (const n of m.addedNodes) if (n.nodeName === 'path') window.__mut.added++; } }); mo.observe(pane, { childList: true, subtree: true }); })()`);
  s.clearLog();
  await s.click(".page-header button.v-btn--variant-elevated, .page-header .v-btn:last-child", { scroll: false }).catch(() => {});
  await sleep(2500);
  M.refresh = await s.evalJs(`({ popupStill: !!document.querySelector('.leaflet-popup'), mut: window.__mut, polls: 0 })`);
  M.refresh.requests = s.mode.counts["GET /dispatcher/delivery-companies/:id/courier-locations"] ?? 0;
  console.log("poslije 'Osveži':", JSON.stringify(M.refresh));

  // 6) tastatura: Tab do prvog reda liste, Enter
  await s.evalJs(`document.querySelector('.courier-search input').focus()`);
  await s.key("Tab");
  M.afterTab = await s.evalJs(`(() => { const a = document.activeElement; return { tag: a.tagName, cls: String(a.className).slice(0, 60), inRow: !!a.closest('.courier-item') }; })()`);
  console.log("Tab iz pretrage ->", JSON.stringify(M.afterTab));

  fs.writeFileSync(path.join(out, "b2.json"), JSON.stringify(M, null, 1));
} finally {
  await s.close();
}
console.log("gotovo");
