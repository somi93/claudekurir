// Zajedničke pomoćne funkcije za provjere stranice Raspored i zone.
import fs from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./harness.mjs";
export { scanContrast, smallTargets, unnamedFields, texts, visibleText, attr, active } from "./flib.mjs";
export { sleep, dir };

export const OUT = path.join(dir, "out");
fs.mkdirSync(OUT, { recursive: true });

export const mk = async (name, o = {}) => {
  const s = await session(name, o);
  s.__name = name;
  return s;
};

export const R = {};
export const step = async (name, fn) => {
  try {
    R[name] = await fn();
  } catch (e) {
    R[name] = { error: String(e.message).slice(0, 240) };
  }
  return R[name];
};
export const save = (file) => fs.writeFileSync(path.join(OUT, file), JSON.stringify(R, null, 2));

// Prvo učitavanje u dev režimu: čekaj klijentski sadržaj (sidebar pojavljuje tek poslije hidracije), pa mrežu.
export const loadPage = async (s, route = "/dispatcher/scheduling", { tab = null } = {}) => {
  await s.load(route, { wait: ".dispatcher-sidebar, .dispatcher-app-bar", extra: 500, timeout: 170000 });
  await s.waitFor(`typeof window.useNuxtApp === 'function'`, { timeout: 60000 });
  await s.idle(700);
  await sleep(400);
  if (tab) await openTab(s, tab);
};

export const openTab = async (s, label) => {
  await s.click(".global-tab-bar .tab-pill", { textIncludes: label });
  await sleep(450);
  await s.idle(600);
  await sleep(250);
};

// Mapa je "mirna" kad nema učitavanja pločica ni animacije.
export const mapSettled = async (s, timeout = 20000) => {
  const t0 = Date.now();
  let last = "";
  let stable = 0;
  while (Date.now() - t0 < timeout) {
    const sig = await s.evalJs(`(() => {
      const loading = document.querySelectorAll('.leaflet-tile-loading, .leaflet-zoom-anim').length;
      const pane = document.querySelector('.leaflet-map-pane');
      return loading + '|' + (pane ? pane.style.transform : '');
    })()`).catch(() => "");
    if (sig.startsWith("0|") && sig === last) stable++;
    else stable = 0;
    last = sig;
    if (stable >= 8) return true;
    await sleep(150);
  }
  return false;
};

// Vidljiv dio ekrana (bez captureBeyondViewport: Chrome tada na tren smanji prozor).
export const snap = async (s, name, r = null, { scale = 1 } = {}) => {
  const params = { format: "png" };
  if (r) params.clip = { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h, scale };
  const res = await s.send("Page.captureScreenshot", params);
  const file = path.join(dir, "shots", s.__name, `${name}.png`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(res.data, "base64"));
  return file;
};

export const scrollToTop = (s) => s.evalJs(`(window.scrollTo(0, 0), document.querySelector('.v-main')?.scrollTo?.(0, 0), true)`);
export const scrollBy = (s, y) => s.evalJs(`(window.scrollBy(0, ${y}), true)`);
export const docHeight = (s) => s.evalJs(`document.documentElement.scrollHeight`);
export const hScroll = (s) => s.evalJs(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`);

// Metrike učitavanja (CLS, dugi zadaci) koje je harness ubacio.
export const perf = (s) => s.evalJs(`({ cls: Math.round(window.__cls * 1000) / 1000, longMs: Math.round(window.__long) })`);
