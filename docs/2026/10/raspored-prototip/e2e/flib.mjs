// Pomoćne funkcije za provjere stranice Raspored i zone: kontrast, mete, imena polja, tekstovi.
import { COLORS_FN, ratio } from "./colors.mjs";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Kontrast svakog vidljivog teksta unutar `root` (stvarne boje iz stila, uz slojeve prozirnosti).
// Prag: 4.5, a za krupan tekst (≥ 24 px ili ≥ 18.66 px podebljan) 3.
export const scanContrast = async (s, root = ".global-page") => {
  const items = await s.evalJs(`(() => {
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
      if (!p || seen.has(p) || !vis(p) || p.closest('.__mk')) continue;
      // Onemogućena dugmad su izuzeta iz pravila o kontrastu (WCAG 1.4.3, neaktivne komponente).
      if (p.closest('button:disabled, [aria-disabled=true]')) continue;
      seen.add(p);
      const c = fn(p);
      if (c && c.fg) out.push({ fg: c.fg, bg: c.bg, size: c.size, weight: c.weight, text: c.text, cls: (p.className && p.className.baseVal === undefined ? p.className : '').toString().slice(0, 40) });
    }
    return out;
  })()`);
  const rows = items.map((i) => {
    const r = Math.round(ratio(i.fg, i.bg) * 100) / 100;
    const large = i.size >= 24 || (i.size >= 18.66 && Number(i.weight) >= 700);
    return { ...i, ratio: r, need: large ? 3 : 4.5 };
  });
  const bad = rows.filter((r) => r.ratio < r.need);
  const min = rows.reduce((m, r) => Math.min(m, r.ratio), 99);
  return { count: rows.length, min, bad: bad.map((b) => `${b.ratio} ${b.cls} "${b.text}"`) };
};

// Mete ispod 44 px među vidljivim dugmadima, vezama i poljima (u okviru `root`).
export const smallTargets = (s, root = ".global-page") =>
  s.evalJs(`(() => {
    const rootEl = document.querySelector(${JSON.stringify(root)}) || document.body;
    const out = [];
    for (const e of rootEl.querySelectorAll('button, a[href], input:not([type=hidden]), [role=radio], [role=tab], [role=switch]')) {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
      if (e.type === 'checkbox' && e.getAttribute('role') === 'switch') { if (r.width < 44 || r.height < 44) out.push({ t: 'switch', w: Math.round(r.width), h: Math.round(r.height) }); continue; }
      if (e.disabled) continue;
      // Meta od 44 px sa izgledom manjim od toga: ::after je razvučen preko dugmeta (inset negativan).
      const af = getComputedStyle(e, '::after');
      let w = r.width, h = r.height;
      if (af.content !== 'none' && af.position === 'absolute') { w = Math.max(w, parseFloat(af.width) || 0); h = Math.max(h, parseFloat(af.height) || 0); }
      if (w < 44 || h < 44) { out.push({ t: (e.getAttribute('aria-label') || e.textContent || e.type || '').replace(/\\s+/g,' ').trim().slice(0, 30), w: Math.round(w), h: Math.round(h) }); continue; }
    }
    return out;
  })()`);

// Polja bez imena za čitač ekrana (label, aria-label, aria-labelledby).
export const unnamedFields = (s, root = ".global-page") =>
  s.evalJs(`(() => {
    const rootEl = document.querySelector(${JSON.stringify(root)}) || document.body;
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const name = (e) => {
      if (e.getAttribute('aria-label')) return e.getAttribute('aria-label');
      const lb = e.getAttribute('aria-labelledby'); if (lb) { const t = document.getElementById(lb); if (t) return t.textContent.trim(); }
      if (e.id) { const l = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
      const a = e.closest('label'); if (a && a.textContent.trim()) return a.textContent.trim();
      return '';
    };
    return [...rootEl.querySelectorAll('input:not([type=hidden]), textarea, select, [role=radiogroup], [role=tablist]')].filter(vis).filter((e) => !name(e)).map((e) => ({ tag: e.tagName.toLowerCase(), type: e.type, role: e.getAttribute('role'), field: e.getAttribute('data-field') }));
  })()`);

export const visibleText = (s, sel) =>
  s.evalJs(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getBoundingClientRect().width > 0); return e ? e.textContent.replace(/\\s+/g,' ').trim() : null; })()`);

export const texts = (s, sel) =>
  s.evalJs(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.replace(/\\s+/g,' ').trim())`);

export const attr = (s, sel, name, nth = 0) =>
  s.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; return e ? e.getAttribute(${JSON.stringify(name)}) : null; })()`);

export const active = (s) =>
  s.evalJs(`(() => { const a = document.activeElement; return a ? { tag: a.tagName.toLowerCase(), field: a.getAttribute('data-field'), row: a.getAttribute('data-row'), text: (a.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 40), id: a.id } : null; })()`);

// Tijelo posljednjeg PATCH-a na finance-settings / restaurant-delivery-company.
export const lastPatch = (s, re = /PATCH .*finance-settings/) => {
  const l = s.logOf(re);
  return l.length ? l[l.length - 1].body : null;
};
export const FINANCE_KEYS = [
  "cash_limit_amount", "cash_limit_enforcement", "payout_period_days", "currency", "daily_handover_time",
  "assignment_mode", "assignment_courier_count", "assignment_timeout_action", "assignment_courier_pool",
  "offer_timeout_seconds", "show_price_breakdown",
];

// Pritisak na dugme Sačuvaj u panelu (računar) ili u listu (telefon).
export const SAVE = ".se-foot button[type=submit], .as-foot button[type=submit]";

// Snimak dijela vidljivog ekrana (bez captureBeyondViewport: Chrome tada na tren smanji prozor na 1 px,
// pa se preklopi raspored i izgubi nesačuvani unos u editoru, što pravi korisnik nikad ne doživi).
import fs from "node:fs";
import path from "node:path";
import { dir } from "./harness.mjs";
export const snap = async (s, name, r, { scale = 1, quality = 82 } = {}) => {
  const res = await s.send("Page.captureScreenshot", { format: "webp", quality, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h, scale } });
  const file = path.join(dir, "shots", s.__name, `${name}.webp`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(res.data, "base64"));
  return { file, bytes: fs.statSync(file).size };
};
