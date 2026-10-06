// Smoke: otvori /dispatcher (staro stanje) i vidi šta stranica stvarno pokazuje.
import { session, check, summary, sleep } from "./lh.mjs";

const s = await session("before", { width: 1440, height: 900 });
try {
  const t0 = Date.now();
  await s.load("/dispatcher", { wait: ".dispatcher-grid", extra: 0 });
  await s.idle(800, 30000);
  await sleep(2500); // pločice mape
  const info = await s.evalJs(`(() => {
    const q = (sel) => document.querySelector(sel);
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
    const tiles = [...document.querySelectorAll('img.leaflet-tile')].map((i) => i.src);
    return {
      title: document.title,
      h1: (q('.page-title') || {}).textContent,
      pills: [...document.querySelectorAll('.status-chip')].map((e) => e.textContent.replace(/\\s+/g,' ').trim()),
      markers: document.querySelectorAll('path.leaflet-interactive').length,
      sidebarCount: (q('.sidebar-count') || {}).textContent,
      rows: document.querySelectorAll('.courier-item').length,
      map: r(q('.map-card')), side: r(q('.sidebar-card')), list: r(q('.courier-list')),
      scrollH: document.documentElement.scrollHeight,
      tileSample: tiles.slice(0, 3),
      tileCount: tiles.length,
      sync: (q('.overlay-sync') || {}).textContent,
    };
  })()`);
  console.log(JSON.stringify(info, null, 2));
  await s.shot("smoke-desk");
  console.log("requests:", JSON.stringify(s.mode.counts, null, 1));
  console.log("console:", s.consoleMsgs.slice(0, 12).map((m) => `${m.type}: ${m.text.slice(0, 160)}`).join("\n"));
  console.log("exceptions:", s.exceptions.map((e) => e.text.slice(0, 200)));
  console.log("ms:", Date.now() - t0);
} finally {
  await s.close();
}
