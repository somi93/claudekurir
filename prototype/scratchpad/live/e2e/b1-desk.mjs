// "PRIJE" 1: računar 1440x900 i 1280x720 - šta dispečer vidi pri otvaranju, raspored, markeri, kontrast, mete, tab zaustavljanja.
import fs from "node:fs";
import path from "node:path";
import { session, check, summary, sleep, out, COLORS_FN, ratio } from "./lh.mjs";

const M = {};
const s = await session("before", { width: 1440, height: 900 });
const mapState = `(() => {
  const el = document.querySelector('.leaflet-container');
  const c = el && el.__vueParentComponent;
  let st = c && c.setupState, map = st && st.leafletObject;
  if (!map) { let p = c; for (let i = 0; i < 6 && p && !map; i++) { map = p.setupState && p.setupState.leafletObject; p = p.parent; } }
  if (!map) return null;
  const ctr = map.getCenter(), b = map.getBounds();
  return { lat: ctr.lat, lng: ctr.lng, zoom: map.getZoom(), south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() };
})()`;
try {
  const t0 = Date.now();
  await s.load("/dispatcher", { wait: ".courier-item", timeout: 120000 });
  M.t_firstRows_ms = Date.now() - t0;
  await s.idle(800, 30000);
  await sleep(2500);
  const world = s.W;
  const locs = world.locations();
  M.world = { couriers: world.couriers.length, withPosition: locs.length, delivering: locs.filter((l) => l.location.status === "delivering").length };

  M.map = await s.evalJs(mapState);
  console.log("map:", JSON.stringify(M.map));
  M.pills = await s.evalJs(`[...document.querySelectorAll('.status-chip')].map((e) => e.textContent.replace(/\\s+/g,' ').trim())`);
  M.rowsRendered = await s.count(".courier-item");
  // koliko markera je u vidnom polju mape
  M.markers = await s.evalJs(`(() => {
    const box = document.querySelector('.leaflet-container').getBoundingClientRect();
    const ps = [...document.querySelectorAll('path.leaflet-interactive')];
    const vis = ps.filter((p) => { const r = p.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; return cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom; });
    const sizes = ps.map((p) => { const r = p.getBoundingClientRect(); return Math.round(r.width); });
    return { total: ps.length, visible: vis.length, minW: Math.min(...sizes), maxW: Math.max(...sizes) };
  })()`);
  console.log("markers:", JSON.stringify(M.markers));
  // udaljenost centra mape od centra svojih kurira
  if (M.map) {
    const lat = locs.reduce((a, l) => a + l.location.latitude, 0) / locs.length;
    const lng = locs.reduce((a, l) => a + l.location.longitude, 0) / locs.length;
    const R = 6371, rad = (x) => (x * Math.PI) / 180;
    const h = Math.sin(rad(lat - M.map.lat) / 2) ** 2 + Math.cos(rad(M.map.lat)) * Math.cos(rad(lat)) * Math.sin(rad(lng - M.map.lng) / 2) ** 2;
    M.mapOffKm = Math.round(2 * R * Math.asin(Math.sqrt(h)));
    console.log("udaljenost centra mape od kurira (km):", M.mapOffKm);
  }

  // raspored
  const rects = await s.evalJs(`(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom) }; };
    return { header: r('.page-header'), pills: r('.status-filter'), map: r('.map-card'), side: r('.sidebar-card'), list: r('.courier-list'), search: r('.courier-search'), hint: r('.hint-copy'), grid: r('.dispatcher-grid'), scrollH: document.documentElement.scrollHeight, innerH: innerHeight };
  })()`);
  M.rects = rects;
  console.log(JSON.stringify(rects));
  const fold = await s.evalJs(`(() => {
    const list = document.querySelector('.courier-list').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.courier-item')].map((e) => e.getBoundingClientRect());
    const inList = rows.filter((r) => r.bottom <= list.bottom + 1 && r.top >= list.top - 1).length;
    const first = rows[0];
    return { fullyVisibleInList: inList, rowH: Math.round(first.height), listH: Math.round(list.height), viewportRows: rows.filter((r) => r.bottom <= innerHeight && r.top >= 0).length };
  })()`);
  M.fold = fold;
  console.log("fold:", JSON.stringify(fold));

  // veličina avatara i da li ID staje u krug
  M.avatar = await s.evalJs(`(() => { const a = document.querySelector('.courier-avatar'); const b = a.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(a); const t = range.getBoundingClientRect(); return { box: Math.round(b.width), text: a.textContent.trim(), textW: Math.round(t.width), overflow: t.width > b.width - 4 }; })()`);
  console.log("avatar:", JSON.stringify(M.avatar));
  // dugme-čip "U dostavi" odsječen kod dugog imena
  M.chipClipped = await s.evalJs(`(() => { const items = [...document.querySelectorAll('.courier-item')]; const bad = []; for (const it of items) { const chip = it.querySelector('.v-chip'); const title = it.querySelector('.v-list-item-title'); if (!chip || !title) continue; const cb = chip.getBoundingClientRect(), tb = title.getBoundingClientRect(); const content = chip.querySelector('.v-chip__content'); const clipped = content && content.scrollWidth > content.clientWidth + 1 || cb.right > tb.right + 1 || chip.scrollWidth > chip.clientWidth + 1; if (clipped) bad.push(it.querySelector('.courier-name').textContent.trim()); } return bad; })()`);
  console.log("čip odsječen:", JSON.stringify(M.chipClipped));
  // brzina u m/s i "stoji" za kurira u dostavi bez brzine
  M.speedTexts = await s.evalJs(`(() => [...document.querySelectorAll('.courier-item')].map((it) => ({ n: it.querySelector('.courier-name').textContent.trim(), st: it.querySelector('.v-chip').textContent.trim(), sub: it.querySelector('.v-list-item-subtitle').textContent.replace(/\\s+/g,' ').trim() })))()`);
  fs.writeFileSync(path.join(out, "b1-rows.json"), JSON.stringify(M.speedTexts, null, 1));

  await s.shot("b1-desk-1440x900");

  // tab zaustavljanja u sadržaju stranice (bez bočnog menija)
  M.tabStops = await s.evalJs(`(() => {
    const root = document.querySelector('.dispatcher-content');
    const sel = 'a[href],button,input,select,textarea,[tabindex]';
    const all = [...root.querySelectorAll(sel)].filter((e) => { const ti = e.getAttribute('tabindex'); if (ti === '-1' || e.disabled) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const rowsFocusable = [...root.querySelectorAll('.courier-item')].filter((e) => e.tabIndex >= 0).length;
    return { stops: all.length, rowStops: rowsFocusable, markerFocusable: [...root.querySelectorAll('path.leaflet-interactive')].filter((e) => e.tabIndex >= 0).length };
  })()`);
  console.log("tab:", JSON.stringify(M.tabStops));

  // kontrast svakog teksta u zaglavlju i sadržaju
  const nodes = await s.evalJs(`(() => {
    const roots = [document.querySelector('.page-header'), document.querySelector('.dispatcher-content')];
    const out = [];
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n; const seen = new Set();
      while ((n = walker.nextNode())) {
        const t = n.textContent.replace(/\\s+/g, ' ').trim();
        if (!t) continue;
        const el = n.parentElement;
        if (!el || seen.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest('.leaflet-container') && !el.closest('.overlay-sync')) continue; // pločice mape
        seen.add(el);
        const c = (${COLORS_FN})(el);
        out.push(c);
      }
    }
    return out;
  })()`);
  const cs = nodes.filter((c) => c && c.fg).map((c) => ({ ...c, ratio: Math.round(ratio(c.fg, c.bg) * 100) / 100 }));
  cs.sort((a, b) => a.ratio - b.ratio);
  M.contrast = { count: cs.length, min: cs[0] && cs[0].ratio, below45: cs.filter((c) => c.ratio < 4.5).length, worst: cs.slice(0, 8).map((c) => `${c.ratio}:1 "${c.text}" ${c.size}px`) };
  console.log("kontrast:", JSON.stringify(M.contrast, null, 1));

  // mete (px)
  M.targets = await s.evalJs(`(() => {
    const sz = (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    return { pills: sz('.status-chip')[0], headerBtns: sz('.page-header button, .page-header a'), zoom: sz('.leaflet-control-zoom a'), rowH: sz('.courier-item')[0], search: sz('.courier-search input')[0], markerPx: sz('path.leaflet-interactive').slice(0, 3) };
  })()`);
  console.log("mete:", JSON.stringify(M.targets));

  // pomak rasporeda (CLS) i dugi zadaci
  M.cls = await s.evalJs(`({ cls: Math.round(window.__cls * 1000) / 1000, src: [...new Set(window.__clsSrc)].slice(0, 6), long: Math.round(window.__long) })`);
  console.log("cls:", JSON.stringify(M.cls));

  // zahtjevi
  M.requests = s.mode.counts;
  console.log("zahtjevi:", JSON.stringify(M.requests));
  M.console = s.consoleMsgs.filter((m) => /warn|error/.test(m.type)).map((m) => `${m.type}: ${m.text.slice(0, 140)}`);

  // ---- 1280x720 (prijenosnik) ----
  await s.setViewport(1280, 720, 1, false);
  await sleep(700);
  M.laptop = await s.evalJs(`(() => { const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top), h: Math.round(b.height), b: Math.round(b.bottom) }; }; return { map: r('.map-card'), side: r('.sidebar-card'), list: r('.courier-list'), hint: r('.hint-copy'), scrollH: document.documentElement.scrollHeight, innerH: innerHeight, rows: [...document.querySelectorAll('.courier-item')].filter((e) => { const b = e.getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; }).length }; })()`);
  console.log("1280x720:", JSON.stringify(M.laptop));
  await s.shot("b1-desk-1280x720");
  fs.writeFileSync(path.join(out, "b1.json"), JSON.stringify(M, null, 1));
} finally {
  await s.close();
}
console.log("gotovo");
