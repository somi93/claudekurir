// Pomoćne funkcije za provjeru PROTOTIPA (dev.html ili board.preview.html): pravi Chrome, pravi događaji (miš, tipke, dodir), kontrast, mete, Tab redoslijed.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "../e2e/cdp.mjs";
import { COLORS_FN, ratio } from "../e2e/fh.mjs";

export const here = path.dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
export const URL_DEFAULT = pathToFileURL(path.join(here, process.env.E2E_PAGE || "dev.html")).href;

export async function openProto({ name = "p", width = 1480, height = 960, mobile = false, dpr = 1, url = URL_DEFAULT, frames = true } = {}) {
  const b = await launch({ shotsDir: path.join(here, "..", "shots", name), width, height, dpr, mobile });
  await b.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__cls = 0; window.__long = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration; }).observe({ type: "longtask", buffered: true }); } catch (e) {}`,
  });
  await b.goto(url);
  await sleep(600);
  const ev = (js) => b.evalJs(js);
  const q = (sel) => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
  const count = (sel) => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
  const text = (sel, nth = 0) => ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
  const texts = (sel) => ev(`[...document.querySelectorAll(${JSON.stringify(sel)})].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  const attr = (sel, a, nth = 0) => ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; return e ? e.getAttribute(${JSON.stringify(a)}) : null; })()`);
  const val = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.value : null; })()`);
  const rectOf = (sel, nth = 0) => ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom, r: r.right }; })()`);
  const active = () => ev(`(() => { const e = document.activeElement; if (!e) return null; return { tag: e.tagName.toLowerCase(), id: e.id, fk: e.getAttribute('data-fk'), act: e.getAttribute('data-act'), role: e.getAttribute('role'), text: (e.getAttribute('aria-label') || e.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 40), cls: String(e.className).slice(0, 40) }; })()`);
  const key = async (k, extra = {}) => {
    const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Home: 36, End: 35, " ": 32 };
    const base = { key: k, windowsVirtualKeyCode: codes[k], code: k === " " ? "Space" : k };
    const txt = k === "Enter" ? { text: "\r", unmodifiedText: "\r" } : k === " " ? { text: " ", unmodifiedText: " " } : {};
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", ...base, ...txt, ...extra });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", ...base, ...extra });
    await sleep(40);
  };
  const typeText = async (str, delay = 6) => {
    for (const ch of str) {
      await b.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch, unmodifiedText: ch, key: ch });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
      await sleep(delay);
    }
  };
  const focusSel = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.focus(); return document.activeElement === e; })()`);
  const clearField = async (sel) => {
    await focusSel(sel);
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await key("Backspace");
  };
  const where = async (sel, { nth = 0, textIncludes = null } = {}) => {
    const r = await ev(`(() => {
      let els = [...document.querySelectorAll(${JSON.stringify(sel)})];
      ${textIncludes ? `els = els.filter(e => e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(textIncludes)}));` : ""}
      const el = els[${nth}];
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!r) throw new Error(`nema elementa ${sel}${textIncludes ? ` sa tekstom "${textIncludes}"` : ""}`);
    if (r.w === 0 && r.h === 0) throw new Error(`element nije vidljiv ${sel}`);
    return r;
  };
  const click = async (sel, o = {}) => {
    const r = await where(sel, o);
    await sleep(30);
    const base = { x: r.x, y: r.y, button: "left", clickCount: 1, pointerType: "mouse" };
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
    await b.send("Input.dispatchMouseEvent", { ...base, type: "mousePressed", buttons: 1 });
    await b.send("Input.dispatchMouseEvent", { ...base, type: "mouseReleased", buttons: 0 });
    await sleep(o.wait ?? 90);
    return r;
  };
  const tap = async (sel, o = {}) => {
    const r = await where(sel, o);
    await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y }] });
    await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(o.wait ?? 120);
    return r;
  };
  const hitTest = async (x, y) => ev(`(() => { const e = document.elementFromPoint(${x}, ${y}); return e ? { tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 40), fk: (e.closest('[data-fk]') || {}).getAttribute ? e.closest('[data-fk]').getAttribute('data-fk') : null } : null; })()`);
  const log = (id = "d") => ev(`A('${id}').log.map((e) => ({ method: e.method, path: e.path, body: e.body, failed: !!e.failed, t: e.t }))`);
  const clearLog = (id = "d") => ev(`(A('${id}').log.length = 0, 1)`);
  const toast = () => ev(`(() => { const t = document.querySelector('.fc-toast'); return t && !t.hidden ? t.textContent.replace(/\\s+/g,' ').trim() : null; })()`);
  const waitFor = (expr, o = {}) => b.waitFor(expr, { timeout: 8000, interval: 40, ...o });
  const shot = async (nm, { sel = null, scale = 1 } = {}) => {
    let clip;
    if (sel) { const r = await ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`); clip = { x: r.x, y: r.y, width: r.w, height: r.h, scale }; }
    const res = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, ...(clip ? { clip } : {}) });
    const f = path.join(here, "..", "shots", name, `${nm}.png`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(res.data, "base64"));
    return f;
  };
  // Kontrast svakog vidljivog teksta unutar root-a (stvarne boje, slojevi prozirnosti). Prag 4.5 (krupan tekst 3).
  const scanContrast = async (root = ".fc") => {
    const items = await ev(`(() => {
      const fn = ${COLORS_FN};
      const rootEl = document.querySelector(${JSON.stringify(root)}) || document.body;
      const out = [];
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim()) continue;
        const p = n.parentElement;
        if (!p || seen.has(p) || !vis(p)) continue;
        if (p.closest('button:disabled, [aria-disabled=true], .sr, .fc-side, .fc-bar')) continue;
        seen.add(p);
        const c = fn(p);
        if (c && c.fg) out.push({ fg: c.fg, bg: c.bg, size: c.size, weight: c.weight, text: c.text, cls: String(p.className && p.className.baseVal === undefined ? p.className : '').slice(0, 40) });
      }
      return out;
    })()`);
    const rows = items.map((i) => {
      const r = Math.round(ratio(i.fg, i.bg) * 100) / 100;
      const large = i.size >= 24 || (i.size >= 18.66 && Number(i.weight) >= 700);
      return { ...i, ratio: r, need: large ? 3 : 4.5 };
    });
    const bad = rows.filter((r) => r.ratio < r.need);
    return { count: rows.length, min: rows.reduce((m, r) => Math.min(m, r.ratio), 99), bad: bad.map((x) => `${x.ratio} ${x.cls} "${x.text}"`), minFont: rows.reduce((m, r) => Math.min(m, r.size), 99) };
  };
  // Mete ispod 44 px (dugmad, veze, polja, checkbox, radio); ::after proširenja se računaju.
  const smallTargets = (root = ".fc") => ev(`(() => {
    const rootEl = document.querySelector(${JSON.stringify(root)}) || document.body;
    const out = [];
    for (const e of rootEl.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=radio], [role=tab], [tabindex]:not([tabindex="-1"])')) {
      if (e.closest('.fc-side, .fc-bar')) continue;
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || e.disabled) continue;
      let w = r.width, h = r.height;
      if (e.type === 'checkbox') { const l = e.closest('label'); if (l) { const lr = l.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); } }
      const af = getComputedStyle(e, '::after');
      if (af.content !== 'none' && af.position === 'absolute') {
        const ins = (v) => parseFloat(v) || 0;
        w = Math.max(w, r.width + Math.max(0, -ins(af.left)) + Math.max(0, -ins(af.right)));
        h = Math.max(h, r.height + Math.max(0, -ins(af.top)) + Math.max(0, -ins(af.bottom)));
      }
      if (w < 43.5 || h < 43.5) out.push({ t: (e.getAttribute('aria-label') || e.textContent || e.type || '').replace(/\\s+/g, ' ').trim().slice(0, 30), w: Math.round(w), h: Math.round(h) });
    }
    return out;
  })()`);
  const overflowX = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? { sw: e.scrollWidth, cw: e.clientWidth } : null; })()`);
  // Tab redoslijed: počni od prvog elementa u okviru i broji zaustavljanja dok fokus ne izađe iz njega.
  const tabStops = async (rootSel, max = 80) => {
    await ev(`(() => { const r = document.querySelector(${JSON.stringify(rootSel)}); const f = r.querySelector('button, a[href], input, select, textarea, [tabindex="0"]'); if (f) f.focus(); })()`);
    const stops = [];
    for (let i = 0; i < max; i++) {
      await key("Tab");
      const info = await ev(`(() => { const e = document.activeElement; const r = document.querySelector(${JSON.stringify(rootSel)}); if (!e || e === document.body || !r.contains(e)) return null; return { tag: e.tagName.toLowerCase(), fk: e.getAttribute('data-fk'), text: (e.getAttribute('aria-label') || e.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 30) }; })()`);
      if (!info) break;
      stops.push(info);
    }
    return stops;
  };
  const close = () => b.close();
  return { b, ev, q, count, text, texts, attr, val, rectOf, active, key, typeText, focusSel, clearField, where, click, tap, hitTest, log, clearLog, toast, waitFor, shot, scanContrast, smallTargets, overflowX, tabStops, close, sleep };
}
