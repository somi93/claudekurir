// Harness za stranicu Raspored i zone: pravi Chrome (CDP, svoj port) + presretanje API-ja (Fetch domena).
// Dev server 3100 (već podignut za ovaj repo) ostaje netaknut; sve rute odgovara OVA skripta, mock na 4011 ne treba da radi.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";
import { buildSchedulingWorld, handleScheduling } from "./world.mjs";

export { COLORS_FN, ratio, contrastOf } from "./colors.mjs";
export const BASE = process.env.E2E_BASE || "http://localhost:3100";
export const API = process.env.E2E_API || "http://localhost:4011";
export const dir = path.dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HIDE = `(() => { const s = document.createElement('style'); s.textContent = '#nuxt-devtools-container, [data-nuxt-devtools], .nuxt-devtools-panel {display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s)); })()`;

export const results = [];
export const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "  ✔" : "  ✘"} ${name}${detail ? "  — " + detail : ""}`);
  return Boolean(ok);
};
export const summary = () => {
  const failed = results.filter((r) => !r.ok);
  console.log(`\nUkupno: ${results.length - failed.length}/${results.length} prošlo`);
  for (const f of failed) console.log(`  ✘ ${f.name}${f.detail ? " — " + f.detail : ""}`);
  return failed.length;
};

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");

// Sat stranice: zaključan na ponedjeljak 5. oktobar 2026, 14:20 (kao u prototipu), pa brojke u provjerama ostaju iste;
// sat i dalje teče od te tačke. `clock: null` ostavlja pravo vrijeme.
const FIXED_CLOCK = [2026, 9, 5, 14, 20, 0];
const clockScript = (parts) => `(() => {
  const Real = Date;
  const offset = new Real(${parts.join(",")}).getTime() - Real.now();
  class FakeDate extends Real {
    constructor(...a) { if (a.length === 0) super(Real.now() + offset); else super(...a); }
    static now() { return Real.now() + offset; }
  }
  window.Date = FakeDate;
})()`;

export async function session(name, { width = 1440, height = 900, dpr = 1, mobile = false, perm = "granted", world: worldOpts = {}, clock = FIXED_CLOCK } = {}) {
  const b = await launch({ shotsDir: path.join(dir, "shots", name), width, height, dpr, mobile });
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: HIDE });
  if (clock) await b.send("Page.addScriptToEvaluateOnNewDocument", { source: clockScript(clock) });
  await b.browserSend("Browser.setPermission", { origin: BASE, permission: { name: "notifications" }, setting: perm });
  // mjerenje pomaka rasporeda (CLS) i dugih zadataka
  await b.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__cls = 0; window.__long = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration; }).observe({ type: "longtask", buffered: true }); } catch (e) {}`,
  });

  const now = new Date();
  const mode = {
    sc: buildSchedulingWorld(now, worldOpts),
    companies: [
      { id: 24, name: "Ordera Dostava Banja Luka", city_id: 1, city_name: worldOpts.cityCenter ? "Sarajevo" : "Banja Luka", currency: "KM" },
      { id: 27, name: "Glovo BL", city_id: 1, city_name: worldOpts.cityCenter ? "Sarajevo" : "Banja Luka", currency: "KM" },
      { id: 31, name: "Nova firma", city_id: null, city_name: null, currency: "KM" },
    ],
    delays: [], // {re, ms}
    fails: [], // {re, status, times, body}
    log: [],
    counts: {},
    unknown: [],
    inflight: 0,
    me: { id: 30369, name: "Test", lastname: "Dispečer", email: "dispecer@ordera", type: "TYPE_ADMIN_DELIVERY", must_change_password: false },
  };

  b.on("Fetch.requestPaused", async (p) => {
    const { requestId, request } = p;
    const u = new URL(request.url);
    const origin = request.headers.Origin || request.headers.origin || BASE;
    const hdr = [
      { name: "Access-Control-Allow-Origin", value: origin },
      { name: "Access-Control-Allow-Credentials", value: "true" },
      { name: "Access-Control-Allow-Headers", value: "authorization, content-type, accept" },
      { name: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
      { name: "Content-Type", value: "application/json" },
    ];
    const fulfill = (code, body) =>
      b.send("Fetch.fulfillRequest", { requestId, responseCode: code, responseHeaders: hdr, body: body === undefined ? "" : Buffer.from(JSON.stringify(body)).toString("base64") });
    mode.inflight++;
    try {
      const pth = u.pathname;
      const method = request.method;
      if (method === "OPTIONS") return await fulfill(204);
      let body = null;
      try { body = request.postData ? JSON.parse(request.postData) : null; } catch { body = request.postData ?? null; }
      mode.log.push({ t: Date.now(), method, path: pth, q: u.search, body });
      const key = pth.replace(/\/\d+/g, "/:id");
      mode.counts[`${method} ${key}`] = (mode.counts[`${method} ${key}`] ?? 0) + 1;

      for (const d of mode.delays) if (d.re.test(`${method} ${pth}`)) await sleep(d.ms);
      for (const f of mode.fails) {
        if (f.times > 0 && f.re.test(`${method} ${pth}`)) {
          f.times--;
          return await fulfill(f.status ?? 500, f.body ?? { message: "Server Error" });
        }
      }

      if (await handleScheduling(mode, { pth, method, body, u, fulfill })) return;
      if (pth === "/me") return await fulfill(200, mode.me);
      if (pth === "/dispatcher/my-companies") return await fulfill(200, { success: true, data: mode.companies });
      if (pth === "/dispatcher/outbox/status") return await fulfill(200, { success: true, data: { pending: 0, failed: 0, dead: 0, oldest_pending_age_sec: 0, last_sent_at: null, last_run_at: iso(new Date()), relay_alive: true } });
      if (pth === "/push-tokens" || pth.startsWith("/push-tokens/")) return await fulfill(200, { success: true });
      if (pth === "/logout") return await fulfill(200, {});
      if (pth === "/broadcasting/auth") return await fulfill(403, { message: "mock" });
      mode.unknown.push(`${method} ${pth}`);
      return await fulfill(404, { message: `mock: nije implementirano (${method} ${pth})` });
    } catch (e) {
      console.error("intercept greška:", e.message);
    } finally {
      mode.inflight--;
    }
  });
  await b.send("Fetch.enable", { patterns: [{ urlPattern: `${API}/*` }] });

  // ---------- pomoćne funkcije ----------
  const q = (sel) => b.evalJs(`!!document.querySelector(${JSON.stringify(sel)})`);
  const count = (sel) => b.evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
  const text = (sel) => b.evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
  const rectOf = (sel, nth = 0) =>
    b.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; })()`);
  const load = async (p = "/dispatcher/scheduling", { wait = "body", extra = 0, timeout = 150000 } = {}) => {
    await b.goto(`${BASE}${p}`);
    await b.waitFor(`!!document.querySelector(${JSON.stringify(wait)})`, { timeout });
    if (extra) await sleep(extra);
  };
  const idle = async (ms = 500, timeout = 20000) => {
    const t0 = Date.now();
    let quiet = 0;
    while (Date.now() - t0 < timeout) {
      if (mode.inflight === 0) { quiet += 100; if (quiet >= ms) return true; } else quiet = 0;
      await sleep(100);
    }
    return false;
  };
  const logOf = (re) => mode.log.filter((e) => re.test(`${e.method} ${e.path}`));
  const clearLog = () => { mode.log.length = 0; for (const k of Object.keys(mode.counts)) delete mode.counts[k]; };

  const typeText = async (str, delay = 12) => {
    for (const ch of str) {
      await b.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch, unmodifiedText: ch, key: ch });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
      await sleep(delay);
    }
  };
  const key = async (k, extra = {}) => {
    const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Space: 32, Home: 36, End: 35 };
    const base = { key: k, windowsVirtualKeyCode: codes[k], code: k };
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(k === "Enter" ? { text: "\r", unmodifiedText: "\r" } : k === "Space" ? { text: " ", unmodifiedText: " " } : {}), ...extra });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", ...base, ...extra });
  };
  const focusSel = (sel) => b.evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.focus(); return document.activeElement === e; })()`);
  const clearField = async (sel) => {
    await focusSel(sel);
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await key("Backspace");
  };
  const click = async (sel, { nth = 0, textIncludes = null, wait = 90 } = {}) => {
    const r = await b.evalJs(`(() => {
      let els = [...document.querySelectorAll(${JSON.stringify(sel)})];
      ${textIncludes ? `els = els.filter(e => e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(textIncludes)}));` : ""}
      const el = els[${nth}];
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!r) throw new Error(`click: nema elementa ${sel}${textIncludes ? ` sa tekstom "${textIncludes}"` : ""}`);
    if (r.w === 0 && r.h === 0) throw new Error(`click: element nije vidljiv ${sel}${textIncludes ? ` sa tekstom "${textIncludes}"` : ""}`);
    await sleep(40);
    const base = { x: r.x, y: r.y, button: "left", clickCount: 1, pointerType: "mouse" };
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
    await b.send("Input.dispatchMouseEvent", { ...base, type: "mousePressed", buttons: 1 });
    await b.send("Input.dispatchMouseEvent", { ...base, type: "mouseReleased", buttons: 0 });
    await sleep(wait);
    return r;
  };
  const clickAt = async (x, y, wait = 90) => {
    const base = { x, y, button: "left", clickCount: 1, pointerType: "mouse" };
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await b.send("Input.dispatchMouseEvent", { ...base, type: "mousePressed", buttons: 1 });
    await b.send("Input.dispatchMouseEvent", { ...base, type: "mouseReleased", buttons: 0 });
    await sleep(wait);
  };
  const hover = async (x, y) => b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  const setFlags = ({ delays, fails } = {}) => {
    if (delays) mode.delays = delays;
    if (fails) mode.fails = fails;
  };
  // Snimak ekrana (vidljivi dio) ili isječak u dokumentnim koordinatama.
  const fs = await import("node:fs");
  const shotTo = async (fileName, clipRect = null, scale = 1) => {
    const params = { format: "png" };
    if (clipRect) { params.captureBeyondViewport = true; params.clip = { x: Math.max(0, clipRect.x), y: Math.max(0, clipRect.y), width: clipRect.w, height: clipRect.h, scale }; }
    const res = await b.send("Page.captureScreenshot", params);
    const file = path.join(dir, "shots", name, `${fileName}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(res.data, "base64"));
    return file;
  };
  const docRect = (sel, nth = 0) =>
    b.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
  const store = (id) => b.evalJs(`window.useNuxtApp().$pinia._s.get(${JSON.stringify(id)})`);

  return { ...b, mode, q, count, text, rectOf, docRect, shotTo, load, idle, logOf, clearLog, typeText, key, focusSel, clearField, click, clickAt, hover, setFlags, now };
}
