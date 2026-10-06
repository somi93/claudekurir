// Snimci stare stranice za tablu (sa učitanim pločicama mape): izbor kurira, popup, isječak spiska.
import fs from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./lh.mjs";

const getMap = `(() => { const el = document.querySelector('.leaflet-container'); let p = el.__vueParentComponent, map = null; for (let i = 0; i < 6 && p && !map; i++) { map = p.setupState && p.setupState.leafletObject; p = p.parent; } return map; })()`;
const tilesLoaded = async (s, ms = 9000) => {
  const t0 = Date.now();
  for (;;) {
    const busy = await s.evalJs(`document.querySelectorAll('.leaflet-tile-loading').length`);
    if (!busy && Date.now() - t0 > 1500) return;
    if (Date.now() - t0 > ms) return;
    await sleep(250);
  }
};
const s = await session("before", { width: 1440, height: 900 });
try {
  await s.load("/dispatcher", { wait: ".courier-item", timeout: 120000 });
  await s.idle(800, 30000);
  await sleep(2500);
  await tilesLoaded(s);
  // f2: izbor kurira sa liste
  await s.click(".courier-item", { nth: 1, scroll: false });
  await sleep(1500);
  await tilesLoaded(s);
  await s.shot("f2-selected");
  // f4: popup izabranog kurira bez brzine (Nikola Radić): popup kaže n/a, kartica "stoji"
  await s.evalJs(`(${getMap}).setView([44.7722, 17.191], 14, { animate: false }) && true`);
  await sleep(800);
  await tilesLoaded(s);
  const mk = await s.evalJs(`(() => { const box = document.querySelector('.leaflet-container').getBoundingClientRect(); const ps = [...document.querySelectorAll('path.leaflet-interactive')].map((p) => { const r = p.getBoundingClientRect(); return { w: r.width, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }).filter((m) => m.w > 0 && m.w <= 22 && m.x > box.left + 60 && m.x < box.right - 60 && m.y > box.top + 120 && m.y < box.bottom - 60); return ps[0] || null; })()`);
  if (mk) {
    await s.clickAt(mk.x, mk.y, 600);
    await sleep(1200);
    await tilesLoaded(s);
    await s.shot("f4-popup");
  }
  // f7: isječak spiska 2x (avatar sa ID-jem, odsječen čip, m/s)
  await s.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  await sleep(600);
  await s.click(".courier-item", { nth: 2, scroll: false }).catch(() => {});
  const r = await s.docRect(".sidebar-card");
  await s.clip("f7-rows", { x: r.x, y: r.y + 60, w: r.w, h: 380 }, 2);
  console.log("snimci gotovi", JSON.stringify(mk));
} finally {
  await s.close();
}
