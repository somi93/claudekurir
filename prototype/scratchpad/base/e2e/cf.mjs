import fs from "node:fs";
import path from "node:path";
import { dir, sleep, contrastOf } from "./fh.mjs";
export { contrastOf };

// Snimak dijela dokumenta u webp (CSS px, razmjera scale).
export async function cap(s, name, r, { scale = 1, quality = 80 } = {}) {
  const res = await s.send("Page.captureScreenshot", { format: "webp", quality, captureBeyondViewport: true, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: r.h, scale } });
  const file = path.join(dir, "shots", s.__name, `${name}.webp`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(res.data, "base64"));
  return { file, bytes: fs.statSync(file).size };
}
// Crvene oznake sa brojevima na tačkama dokumenta (x,y su dokumentne koordinate).
export const markAt = (s, pts) => s.evalJs(`(() => {
  document.querySelectorAll('.__mk').forEach(e => e.remove());
  const pts = ${JSON.stringify(pts)};
  for (const p of pts) { const d = document.createElement('div'); d.className='__mk'; d.textContent = p.n;
    d.style.cssText = 'position:absolute;z-index:99999;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:#e5484d;color:#fff;font:800 12px/24px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 3px rgba(255,255,255,.95),0 2px 6px rgba(0,0,0,.32);pointer-events:none;left:' + p.x + 'px;top:' + p.y + 'px';
    document.body.appendChild(d); }
  return pts.length; })()`);
export const unmark = (s) => s.evalJs(`document.querySelectorAll('.__mk').forEach(e => e.remove())`);
// Dokumentne koordinate: tačka na elementu (fx,fy u 0..1 unutar elementa) pa opcioni pomak.
export const pt = (s, sel, { nth = 0, text = null, fx = 0, fy = 0, dx = 0, dy = 0 } = {}) =>
  s.evalJs(`(() => { let els = [...document.querySelectorAll(${JSON.stringify(sel)})];
    ${text ? `els = els.filter(e => e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(text)}));` : ""}
    const e = els[${nth}]; if (!e) return null; const r = e.getBoundingClientRect();
    return { x: r.left + scrollX + r.width * ${fx} + ${dx}, y: r.top + scrollY + r.height * ${fy} + ${dy}, w: r.width, h: r.height, top: r.top + scrollY, left: r.left + scrollX }; })()`);

// Zajedničko mjerenje stanja stranice.
export const measure = (s) => s.evalJs(`(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const doc = document.documentElement;
  const accName = (e) => {
    if (e.getAttribute('aria-label')) return e.getAttribute('aria-label');
    const lb = e.getAttribute('aria-labelledby'); if (lb) { const t = document.getElementById(lb); if (t) return t.textContent.trim(); }
    if (e.id) { const l = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
    const a = e.closest('label'); if (a && a.textContent.trim()) return a.textContent.trim();
    return '';
  };
  const inputs = [...document.querySelectorAll('input:not([type=hidden]), textarea, select')].filter(vis);
  const unnamed = inputs.filter((e) => !accName(e)).map((e) => ({ type: e.type, role: e.getAttribute('role'), cls: (e.closest('.v-switch') ? 'v-switch' : e.className).toString().slice(0, 40) }));
  const small = [];
  for (const e of document.querySelectorAll('button, a[href], input[type=checkbox], [role=switch], [role=tab]')) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect();
    const host = e.closest('.v-selection-control, .v-switch'); const rr = host ? host.getBoundingClientRect() : r;
    const w = Math.max(r.width, rr.width), h = Math.max(r.height, rr.height);
    if (w < 44 || h < 44) small.push({ t: (e.getAttribute('aria-label') || e.textContent || e.type || '').replace(/\\s+/g, ' ').trim().slice(0, 28), w: Math.round(w), h: Math.round(h) });
  }
  let minFont = 99; const fonts = {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = walker.nextNode())) { if (!n.textContent.trim()) continue; const p = n.parentElement; if (!p || !vis(p) || p.closest('.__mk')) continue; const f = parseFloat(getComputedStyle(p).fontSize); fonts[f] = (fonts[f] || 0) + 1; if (f < minFont) minFont = f; }
  return { docH: doc.scrollHeight, docW: doc.scrollWidth, vw: innerWidth, vh: innerHeight, inputs: inputs.length, unnamed, small, minFont, fonts, nodes: document.getElementsByTagName('*').length,
    hints: [...document.querySelectorAll('.v-messages__message')].filter(vis).length, cls: window.__cls, long: window.__long };
})()`);

export const elInfo = (s, sel, nth = 0) => s.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), text: e.textContent.replace(/\\s+/g,' ').trim().slice(0,90) }; })()`);

export const fmtC = (c) => (c ? c.toFixed(2) : "?");
export { sleep };
