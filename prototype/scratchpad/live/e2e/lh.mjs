// Harness za "Kuriri uživo": pravi Chrome (CDP, svoj port) + presretanje API-ja (Fetch domena) nad POSTOJEĆIM dev serverom.
// Server (tuđ) ostaje netaknut, `app/` se ne dira; SVE rute odgovara ova skripta (mock na 4011 ne treba da radi).
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";
import { buildLiveWorld, serveLive, COMPANIES } from "./world.mjs";

export const BASE = process.env.E2E_BASE || "http://localhost:3001";
export const API = process.env.E2E_API || "http://localhost:4011";
export const dir = path.dirname(fileURLToPath(import.meta.url));
export const out = path.resolve(dir, "..", "out");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });

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

export async function session(name, { width = 1440, height = 900, dpr = 1, mobile = false, n = 26, perm = "granted", flags = {} } = {}) {
  const b = await launch({ shotsDir: path.join(dir, "..", "shots", name), width, height, dpr, mobile });
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: HIDE });
  await b.browserSend("Browser.setPermission", { origin: BASE, permission: { name: "notifications" }, setting: perm });
  await b.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__cls = 0; window.__long = 0; window.__clsSrc = [];
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; for (const s of e.sources || []) window.__clsSrc.push((s.node && (s.node.className || s.node.nodeName)) + ''); } }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration; }).observe({ type: "longtask", buffered: true }); } catch (e) {}`,
  });

  const now = new Date();
  const W = buildLiveWorld({ now, n });
  W.clock = () => Date.now();
  Object.assign(W.flags, flags);
  const mode = {
    W,
    delays: [], // {re, ms}
    fails: [], // {re, status, times, body}
    log: [],
    counts: {},
    inflight: 0,
    me: { id: 30369, name: "Test", lastname: "Dispečer", email: "dispecer@ordera", type: "TYPE_ADMIN_DELIVERY", must_change_password: false },
    companies: COMPANIES,
    noCompanies: false,
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
      mode.log.push({ t: Date.now(), method, path: pth, q: u.search, body, hidden: await b.evalJs("document.hidden").catch(() => null) });
      const key = pth.replace(/\/\d+/g, "/:id");
      mode.counts[`${method} ${key}`] = (mode.counts[`${method} ${key}`] ?? 0) + 1;

      for (const d of mode.delays) if (d.re.test(`${method} ${pth}`)) await sleep(d.ms);
      for (const f of mode.fails) {
        if (f.times > 0 && f.re.test(`${method} ${pth}`)) {
          f.times--;
          return await fulfill(f.status ?? 500, f.body ?? { message: "Server Error" });
        }
      }
      if (pth === "/me") return await fulfill(200, mode.me);
      if (pth === "/dispatcher/my-companies") return await fulfill(200, { success: true, data: mode.noCompanies ? [] : mode.companies });
      if (pth === "/dispatcher/outbox/status") return await fulfill(200, { success: true, data: { pending: 0, failed: 0, dead: 0, oldest_pending_age_sec: 0, last_sent_at: null, last_run_at: iso(new Date()), relay_alive: true } });
      if (pth === "/push-tokens" || pth.startsWith("/push-tokens/")) return await fulfill(200, { success: true });
      if (pth === "/logout") return await fulfill(200, {});
      if (pth === "/broadcasting/auth") return await fulfill(403, { message: "mock" });
      const r = serveLive(W, { pth, method, body, q: u.searchParams });
      if (r) return await fulfill(r[0], r[1]);
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
  const load = async (p = "/dispatcher", { wait = "body", extra = 0, timeout = 150000 } = {}) => {
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
    const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Space: 32 };
    const base = { key: k, windowsVirtualKeyCode: codes[k], code: k };
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(k === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}), ...extra });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", ...base, ...extra });
  };
  const focusSel = (sel) => b.evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.focus(); return document.activeElement === e; })()`);
  const click = async (sel, { nth = 0, textIncludes = null, wait = 90, scroll = true } = {}) => {
    const r = await b.evalJs(`(() => {
      let els = [...document.querySelectorAll(${JSON.stringify(sel)})];
      ${textIncludes ? `els = els.filter(e => e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(textIncludes)}));` : ""}
      const el = els[${nth}];
      if (!el) return null;
      ${scroll ? `el.scrollIntoView({ block: "center", inline: "center" });` : ""}
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!r) throw new Error(`click: nema elementa ${sel}${textIncludes ? ` sa tekstom "${textIncludes}"` : ""}`);
    if (r.w === 0 && r.h === 0) throw new Error(`click: element nije vidljiv ${sel}`);
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
  const setFlags = ({ delays, fails } = {}) => {
    if (delays) mode.delays = delays;
    if (fails) mode.fails = fails;
  };
  const clip = async (fileName, r, scale = 1) => {
    const res = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h, scale } });
    const file = path.join(dir, "..", "shots", name, `${fileName}.png`);
    fs.writeFileSync(file, Buffer.from(res.data, "base64"));
    return file;
  };
  const docRect = (sel, nth = 0) =>
    b.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);

  return { ...b, mode, W, q, count, text, rectOf, docRect, clip, load, idle, logOf, clearLog, typeText, key, focusSel, click, clickAt, setFlags, now };
}

// ---------- kontrast ----------
export const COLORS_FN = `(el) => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; } const s = c.match(/color\\(srgb ([0-9.]+) ([0-9.]+) ([0-9.]+)(?: \\/ ([0-9.]+))?\\)/); if (s) return { r: +s[1] * 255, g: +s[2] * 255, b: +s[3] * 255, a: s[4] === undefined ? 1 : +s[4] }; return null; };
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  let bg = null, n = el, layers = [];
  while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) layers.push(c); if (c && c.a > 0.99) { bg = c; break; } n = n.parentElement; }
  let base = bg || { r: 255, g: 255, b: 255, a: 1 };
  const stack = layers.slice(0, bg ? layers.length - 1 : layers.length).reverse();
  for (const l of stack) base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a), a: 1 };
  let op = 1; n = el; while (n) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
  let f = fg; if (f && op < 1) f = { r: f.r * op + base.r * (1 - op), g: f.g * op + base.g * (1 - op), b: f.b * op + base.b * (1 - op), a: 1 };
  return { fg: f, bg: base, size: parseFloat(cs.fontSize), weight: cs.fontWeight, text: (el.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 40) };
}`;
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
