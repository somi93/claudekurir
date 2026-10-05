// Harness: pravi Chrome (CDP 9336) + presretanje API-ja (Fetch domena) za dispečerski ekran Kuriri.
// Dev server 3100 (tuđi) ostaje netaknut; sve rute odgovara OVA skripta, mock na 4011 ne treba da radi.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";
import { buildCouriers, buildLocations, buildBalances, buildInboxSummary, buildInbox, COMPANIES, FINANCE, IDS } from "./fx.mjs";
import { buildWorld, inboxResponse } from "./nfx.mjs";
import { buildRestaurants } from "./co-fx.mjs";
import { buildPricingWorld, handlePricing } from "./pr-fx.mjs";

export { IDS };
export const BASE = process.env.E2E_BASE || "http://localhost:3100";
export const API = "http://localhost:4011";
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

export async function session(name, { width = 1440, height = 900, dpr = 1, mobile = false, n = 24, couriers, perm = "granted", world: worldOpts = null } = {}) {
  const b = await launch({ shotsDir: path.join(dir, "shots", name), width, height, dpr, mobile });
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: HIDE });
  await b.browserSend("Browser.setPermission", { origin: BASE, permission: { name: "notifications" }, setting: perm });
  await b.browserSend("Browser.grantPermissions", { origin: BASE, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] }).catch(() => {});
  await b.browserSend("Browser.setPermission", { origin: BASE, permission: { name: "notifications" }, setting: perm });
  // mjerenje pomaka rasporeda (CLS) i dugih zadataka
  await b.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__cls = 0; window.__long = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration; }).observe({ type: "longtask", buffered: true }); } catch (e) {}`,
  });

  const now = new Date();
  const W = worldOpts ? buildWorld({ now, ...worldOpts }) : null;
  const mode = {
    finance: { 24: { ...FINANCE, delivery_company_id: 24, cash_limit_amount: 200, cash_limit_enforcement: "BLOCK", payout_period_days: 1, daily_handover_time: "14:16" }, 27: { ...FINANCE, delivery_company_id: 27, commission_percentage: null } },
    restaurants: { 24: buildRestaurants(12), 27: buildRestaurants(3) },
    pr: buildPricingWorld(now),
    world: W,
    summaryVariant: "polluted", // "polluted" (po dokumentu 21.09) | "clean" (backend ispravljen)
    couriers: W ? W.couriers : (couriers ?? buildCouriers(n, { now })),
    couriers27: buildCouriers(9, { now, seed: 99 }).map((c, i) => ({ ...c, courier_id: 31000 + i })),
    locations: null,
    balances: null,
    summary: null,
    inbox: new Map(),
    delays: [], // {re, ms}
    fails: [], // {re, status, times}
    log: [],
    counts: {},
    inflight: 0,
    nextId: 39000,
    me: { id: 30369, name: "Test", lastname: "Dispečer", email: "dispecer@ordera", type: "TYPE_ADMIN_DELIVERY", must_change_password: false },
    withLocations: true,
    withBalances: true,
    withSummary: true,
  };
  const reseed = () => {
    if (mode.world) {
      mode.locations = mode.world.locations;
      mode.balances = mode.world.balances;
      mode.summary = mode.summaryVariant === "clean" ? mode.world.summaryClean : mode.world.summary;
      return;
    }
    mode.locations = buildLocations(mode.couriers, { now: new Date() });
    mode.balances = buildBalances(mode.couriers);
    mode.summary = buildInboxSummary(mode.couriers, { now: new Date() });
  };
  reseed();
  const rowOf = (id, list = mode.couriers) => list.find((c) => c.courier_id === Number(id));

  const fullName = (first, last) => `${first} ${last}`.trim();
  const applyPatch = (row, body) => {
    if ("name" in body || "lastname" in body) {
      const first = body.name ?? row.first_name ?? row.name.split(" ")[0];
      const last = body.lastname ?? row.last_name ?? row.name.split(" ").slice(1).join(" ");
      row.first_name = first; row.last_name = last; row.name = fullName(first, last);
    }
    for (const k of ["phone", "contact_phone", "bank_account", "note", "paying_type", "paying", "contract_signed_at", "contract_active_from"]) if (k in body) row[k] = body[k];
    if ("vehicle_type" in body) row.vehicle = body.vehicle_type ? { id: 9500 + row.courier_id % 100, type: body.vehicle_type } : null;
    for (const k of ["date_of_birth", "iban", "emergency_contact_name", "emergency_contact_phone"]) {
      if (k in body) {
        row.detail = row.detail ?? { date_of_birth: null, iban: null, emergency_contact_name: null, emergency_contact_phone: null, referral_url: null, referral_short_url: null, referred_by: null };
        row.detail[k] = body[k];
      }
    }
    return row;
  };

  b.on("Fetch.requestPaused", async (p) => {
    const { requestId, request } = p;
    const u = new URL(request.url);
    if (u.hostname === "cdn.jsdelivr.net") {
      const fs = await import("node:fs");
      const rel = u.pathname.replace("/npm/@mdi/font@5.x/", "");
      const file = (process.env.MDI_DIR || "/tmp/mdi/node_modules/@mdi/font/") + rel;
      try {
        const buf = fs.readFileSync(file);
        const type = rel.endsWith(".css") ? "text/css" : rel.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
        return await b.send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: type }, { name: "Access-Control-Allow-Origin", value: "*" }], body: buf.toString("base64") });
      } catch { return await b.send("Fetch.failRequest", { requestId, errorReason: "Failed" }); }
    }
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
      const entry = { t: Date.now(), method, path: pth, q: u.search, body };
      mode.log.push(entry);
      const key = pth.replace(/\/\d+/g, "/:id");
      mode.counts[`${method} ${key}`] = (mode.counts[`${method} ${key}`] ?? 0) + 1;

      for (const d of mode.delays) if (d.re.test(`${method} ${pth}`)) await sleep(d.ms);
      for (const f of mode.fails) {
        if (f.times > 0 && f.re.test(`${method} ${pth}`)) {
          f.times--;
          return await fulfill(f.status ?? 500, f.body ?? { message: "Server Error" });
        }
      }

      if (await handlePricing(mode, { pth, method, body, u, fulfill })) return;
      let rm;
      if ((rm = pth.match(/^\/dispatcher\/(\d+)\/restaurants$/))) return await fulfill(200, { success: true, data: mode.restaurants[Number(rm[1])] ?? [] });
      if ((rm = pth.match(/^\/dispatcher\/restaurant-delivery-company\/(\d+)$/)) && method === "PATCH") {
        let row; for (const k of Object.keys(mode.restaurants)) { const r = mode.restaurants[k].find((x) => x.id === Number(rm[1])); if (r) row = r; }
        if (!row) return await fulfill(404, { message: "No query results" });
        row.active_restoran = Boolean(body.active_restoran);
        row.suspension_reason = row.active_restoran ? null : (body.suspension_reason ?? null);
        row.cooperation_active = row.active_restoran && row.active_company && !row.internal;
        return await fulfill(200, { success: true, data: row });
      }
      if (pth === "/me") return await fulfill(200, mode.me);
      if (pth === "/dispatcher/my-companies") return await fulfill(200, { success: true, data: COMPANIES });
      if (pth === "/dispatcher/outbox/status") return await fulfill(200, { success: true, data: { pending: 0, failed: 0, dead: 0, oldest_pending_age_sec: 0, last_sent_at: null, last_run_at: iso(new Date()), relay_alive: true } });
      if (pth === "/push-tokens" || pth.startsWith("/push-tokens/")) return await fulfill(200, { success: true });
      if (pth === "/logout") return await fulfill(200, {});
      if (pth === "/broadcasting/auth") return await fulfill(403, { message: "mock" });

      let m;
      if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/(.*)$/))) {
        const cid = Number(m[1]);
        const rest = m[2];
        const list = cid === 27 ? mode.couriers27 : mode.couriers;
        if (rest === "finance-settings") {
          const f = mode.finance[cid] ?? (mode.finance[cid] = { ...FINANCE, delivery_company_id: cid });
          if (method === "PATCH") {
            if (body && body.currency && !f.available_currencies.includes(body.currency)) return await fulfill(422, { message: "The given data was invalid.", errors: { currency: ["Valuta nije dozvoljena."] } });
            if (body && body.payout_period_days !== undefined && !(Number.isInteger(body.payout_period_days) && body.payout_period_days >= 1)) return await fulfill(422, { message: "The given data was invalid.", errors: { payout_period_days: ["Period isplate mora biti cijeli broj najmanje 1."] } });
            Object.assign(f, body);
          }
          return await fulfill(200, { success: true, data: { ...f } });
        }
        if (rest === "couriers-status") return await fulfill(200, { success: true, data: list });
        if (rest === "courier-locations") return await fulfill(200, { success: true, data: mode.withLocations && cid === 24 ? mode.locations : [] });
        if (rest === "couriers-balance") return await fulfill(200, { success: true, data: mode.withBalances && cid === 24 ? mode.balances : [] });
        if (rest === "inbox-summary") return await fulfill(mode.withSummary ? 200 : 404, mode.withSummary ? { success: true, data: cid === 24 ? mode.summary : [] } : { message: "Not Found" });
        if (rest === "broadcast") {
          const ids = body?.all_couriers ? list.map((c) => c.courier_id) : (body?.courier_ids ?? []);
          const count = mode.broadcastOverride ?? ids.length;
          if (mode.world) {
            const at = new Date();
            ids.forEach((cid, i) => {
              const rows = mode.world.inbox.get(Number(cid));
              if (!rows) return;
              rows.unshift({ id: mode.world.nextId(), sender: "dispatcher", category: body.category ?? "announcement", title: body.title, body: body.body, sent_at: iso(new Date(at.getTime() + i * 5)), read: false, _batch: "live" });
            });
          }
          return await fulfill(200, { success: true, data: { sent_to_count: count } });
        }
        if (rest === "couriers" && method === "POST") {
          const first = body.name, last = body.lastname;
          const row = {
            courier_id: mode.nextId++, name: fullName(first, last), first_name: first, last_name: last, phone: body.phone, email: body.email,
            suspended: false, suspended_reason: null, suspended_at: null, vehicle: body.vehicle_type ? { id: 9900 + mode.nextId % 100, type: body.vehicle_type } : null,
            contact_phone: null, bank_account: body.bank_account ?? null, note: body.note ?? null,
            paying_type: body.paying_type ?? null, paying: body.paying ?? null, contract_signed_at: body.contract_signed_at ?? null, contract_active_from: body.contract_active_from ?? null,
            image_path: null, created_at: iso(new Date()),
            detail: { date_of_birth: body.date_of_birth ?? null, iban: body.iban ?? null, emergency_contact_name: body.emergency_contact_name ?? null, emergency_contact_phone: body.emergency_contact_phone ?? null, referral_url: null, referral_short_url: null, referred_by: null },
          };
          list.push(row);
          return await fulfill(200, { success: true, data: row });
        }
        if ((m = rest.match(/^couriers\/(\d+)\/suspend$/)) && method === "PATCH") {
          const row = rowOf(m[1], list);
          if (!row) return await fulfill(404, { message: "Kurir nije vezan za ovu firmu." });
          row.suspended = Boolean(body.suspended);
          row.suspended_reason = body.suspended ? body.reason ?? null : null;
          row.suspended_at = body.suspended ? iso(new Date()) : null;
          return await fulfill(200, { success: true, data: row });
        }
        if ((m = rest.match(/^couriers\/(\d+)$/))) {
          const row = rowOf(m[1], list);
          if (!row) return await fulfill(404, { message: "Kurir nije vezan za ovu firmu." });
          if (method === "PATCH") return await fulfill(200, { success: true, data: applyPatch(row, body ?? {}) });
          if (method === "DELETE") { list.splice(list.indexOf(row), 1); return await fulfill(200, { success: true }); }
        }
      }
      if (mode.world && (m = pth.match(/^\/couriers\/(\d+)\/inbox$/))) {
        const id = Number(m[1]);
        const rows = mode.world.inbox.get(id);
        if (!rows) return await fulfill(404, { message: "Kurir nije pronađen." });
        if (method === "POST") {
          const msg = { id: mode.world.nextId(), sender: "dispatcher", category: body.category ?? "announcement", title: body.title, body: body.body, sent_at: iso(new Date()), read: false, _batch: "live" };
          rows.unshift(msg);
          const { _batch, ...out } = msg;
          return await fulfill(200, { success: true, data: { ...out, courier_id: id } });
        }
        return await fulfill(200, inboxResponse(rows, u.searchParams));
      }
      if (mode.world && (m = pth.match(/^\/inbox\/(\d+)$/)) && method === "DELETE") {
        let found = false;
        for (const [, arr] of mode.world.inbox) { const i = arr.findIndex((x) => x.id === Number(m[1])); if (i >= 0) { arr.splice(i, 1); found = true; } }
        return await fulfill(found ? 200 : 404, found ? { success: true } : { message: "Poruka nije pronađena." });
      }
      if ((m = pth.match(/^\/couriers\/(\d+)\/inbox$/))) {
        const id = Number(m[1]);
        if (!mode.inbox.has(id)) mode.inbox.set(id, buildInbox(id, id === IDS.main ? 25 : 6));
        const all = mode.inbox.get(id);
        if (method === "POST") {
          const msg = { id: id * 100 + 90 + all.length, sender: "dispatcher", category: body.category ?? "announcement", title: body.title, body: body.body, sent_at: iso(new Date()), read: false };
          all.unshift(msg);
          return await fulfill(200, { success: true, data: msg });
        }
        let rows = all;
        const cat = u.searchParams.get("category");
        if (cat) rows = rows.filter((x) => x.category === cat);
        const page = Number(u.searchParams.get("page") || 0);
        const per = Number(u.searchParams.get("per_page") || 50);
        if (page) {
          const last = Math.max(1, Math.ceil(rows.length / per));
          return await fulfill(200, { success: true, data: rows.slice((page - 1) * per, page * per), meta: { current_page: page, last_page: last, total: rows.length } });
        }
        return await fulfill(200, { success: true, data: rows });
      }
      if ((m = pth.match(/^\/dispatcher\/couriers\/(\d+)\/(cash-receipt|payout)$/)) && method === "POST") {
        const bal = mode.balances.find((x) => x.courier_id === Number(m[1]));
        if (!bal) return await fulfill(404, { message: "Kurir nije bio vezan za ovu firmu." });
        if (m[2] === "payout") {
          mode.keys = mode.keys ?? new Set();
          if (mode.keys.has(body.idempotency_key)) return await fulfill(200, { success: true, transaction_id: 1, duplicate: true });
          mode.keys.add(body.idempotency_key);
          const warning = body.amount > bal.wage_owed_to_courier ? "Iznos je veći od zarade." : undefined;
          bal.wage_owed_to_courier = Math.max(0, Math.round((bal.wage_owed_to_courier - body.amount) * 100) / 100);
          return await fulfill(200, { success: true, transaction_id: 2, ...(warning ? { warning } : {}) });
        }
        const warning = body.amount > bal.cash_owed_to_company ? "Iznos je veći od duga." : undefined;
        bal.cash_owed_to_company = Math.round((bal.cash_owed_to_company - body.amount) * 100) / 100;
        return await fulfill(200, { success: true, ...(warning ? { warning } : {}) });
      }
      if ((m = pth.match(/^\/inbox\/(\d+)$/)) && method === "DELETE") {
        for (const [, arr] of mode.inbox) { const i = arr.findIndex((x) => x.id === Number(m[1])); if (i >= 0) arr.splice(i, 1); }
        return await fulfill(200, { success: true });
      }
      return await fulfill(404, { message: `mock: nije implementirano (${method} ${pth})` });
    } catch (e) {
      console.error("intercept greška:", e.message);
    } finally {
      mode.inflight--;
    }
  });
  await b.send("Fetch.enable", { patterns: [{ urlPattern: `${API}/*` }, { urlPattern: "https://cdn.jsdelivr.net/*" }] });

  // ---------- pomoćne funkcije ----------
  const q = (sel) => b.evalJs(`!!document.querySelector(${JSON.stringify(sel)})`);
  const count = (sel) => b.evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
  const text = (sel) => b.evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
  const rectOf = (sel, nth = 0) =>
    b.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; })()`);
  const load = async (p = "/dispatcher/couriers", { wait = "body", extra = 0, timeout = 150000 } = {}) => {
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

  // Kucanje pravim tasterima (char po char) u fokusirano polje.
  const typeText = async (str, delay = 12) => {
    for (const ch of str) {
      await b.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch, unmodifiedText: ch, key: ch });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
      await sleep(delay);
    }
  };
  const key = async (k, extra = {}) => {
    const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, Backspace: 8, Space: 32 };
    const base = { key: k, windowsVirtualKeyCode: codes[k], code: k };
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...(k === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}), ...extra });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", ...base, ...extra });
  };
  const focusSel = (sel) => b.evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.focus(); return document.activeElement === e; })()`);
  const clearField = async (sel) => {
    await focusSel(sel);
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await key("Backspace");
  };
  // Pravi klik na centar elementa (hit-testing): pozicija se računa poslije scrollIntoView.
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
    // Skriven element ima pravougaonik 0x0: klik bi pao na (0,0) i pogodio nešto drugo (npr. vezu u bočnoj traci).
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

  // Stanje DOM-a stranice (za snimač: šta korisnik vidi u tijelu kartice)
  const setFlags = ({ delays, fails } = {}) => {
    if (delays) mode.delays = delays;
    if (fails) mode.fails = fails;
  };

  // Snimak dijela stranice (CSS px) u zadanoj razmjeri.
  const clip = async (fileName, r, scale = 2) => {
    const res = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h, scale } });
    const file = path.join(dir, "shots", name, `${fileName}.png`);
    (await import("node:fs")).writeFileSync(file, Buffer.from(res.data, "base64"));
    return file;
  };
  // Dokumentne koordinate elementa (uz skrol), za clip().
  const docRect = (sel, nth = 0) =>
    b.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);

  return { ...b, mode, reseed, rowOf, q, count, text, rectOf, docRect, clip, load, idle, logOf, clearLog, typeText, key, focusSel, clearField, click, clickAt, setFlags, now };
}

// ---------- kontrast ----------
export const COLORS_FN = `(el) => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; } const s = c.match(/color\\(srgb ([0-9.]+) ([0-9.]+) ([0-9.]+)(?: \\/ ([0-9.]+))?\\)/); if (s) return { r: +s[1] * 255, g: +s[2] * 255, b: +s[3] * 255, a: s[4] === undefined ? 1 : +s[4] }; return null; };
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  let bg = null, n = el, layers = [];
  while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) layers.push(c); if (c && c.a > 0.99) { bg = c; break; } n = n.parentElement; }
  let base = bg || { r: 255, g: 255, b: 255, a: 1 };
  // slojevi sa prozirnošću se slažu odozdo prema gore
  const stack = layers.slice(0, bg ? layers.length - 1 : layers.length).reverse();
  for (const l of stack) base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a), a: 1 };
  let op = 1; n = el; while (n) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
  let f = fg; if (f && op < 1) f = { r: f.r * op + base.r * (1 - op), g: f.g * op + base.g * (1 - op), b: f.b * op + base.b * (1 - op), a: 1 };
  return { fg: f, bg: base, size: parseFloat(cs.fontSize), weight: cs.fontWeight, text: (el.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 40) };
}`;
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
export const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const contrastOf = async (b, sel, nth = 0) => {
  const c = await b.evalJs(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; return el ? (${COLORS_FN})(el) : null; })()`);
  if (!c || !c.fg) return null;
  return { ...c, ratio: Math.round(ratio(c.fg, c.bg) * 100) / 100 };
};
