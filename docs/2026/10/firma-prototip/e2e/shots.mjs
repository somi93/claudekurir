import { session, sleep } from "./nh.mjs";
import { cap, markAt, unmark, pt, elInfo } from "./colib.mjs";
const res = {};
const run = async (s, name, pts, region, o = {}) => {
  const list = [];
  for (const [n, sel, opt] of pts) { const p = await pt(s, sel, opt); if (p) list.push({ n, x: p.x, y: p.y }); else console.log("MISSING marker", name, n, sel); }
  await markAt(s, list);
  const r = typeof region === "function" ? await region() : region;
  res[name] = await cap(s, name, r, { scale: 1, quality: o.q ?? 78 });
  await unmark(s);
};
const pick = async (s, a, text) => { await s.click(a); await sleep(600); await s.click(".v-overlay-container .v-list-item", { textIncludes: text }); await sleep(500); };
// ===== desktop =====
{
  const s = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "f";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(900); await sleep(400);
  await run(s, "d-finance", [
    [1, ".page-title", { fx: 1, fy: .5, dx: 14 }],
    [2, ".global-tab-bar", { fx: .97, fy: .5 }],
    [3, ".limit-toggle-row .v-switch", { fx: 0, fy: .5, dx: -18 }],
    [4, ".v-messages__message", { text: "Blokiraj - kurir", fx: 1, fy: .5, dx: -4 }],
    [5, ".assignment-section", { fx: 1, fy: 0, dx: -26, dy: 26 }],
    [6, "button.v-btn", { text: "Sačuvaj postavke", fx: 1, fy: .5, dx: 20 }],
    [7, ".v-field", { text: "Period isplate", fx: 1, fy: .5, dx: -30 }],
  ], { x: 264, y: 0, w: 1176, h: 1117 });
  // 422 dok je korisnik na dnu
  await s.evalJs(`(() => { const f=[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Period isplate')); f.querySelector('input').setAttribute('data-t','payout'); })()`);
  await s.clearField("input[data-t=payout]");
  await s.evalJs(`window.scrollTo(0, document.documentElement.scrollHeight)`); await sleep(300);
  await s.click("button.v-btn", { textIncludes: "Sačuvaj postavke" }); await s.idle(700); await sleep(600);
  const sy = await s.evalJs("scrollY");
  await run(s, "d-422", [
    [1, "button.v-btn", { text: "Sačuvaj postavke", fx: 1, fy: .5, dx: 20 }],
    [2, ".v-field", { text: "Period isplate", fx: 1, fy: .5, dx: -30 }],
  ], { x: 264, y: sy, w: 1176, h: 900 });
  res.alertPos = await s.evalJs(`(() => { const a=document.querySelector('.page-alert'); const r=a.getBoundingClientRect(); return {topInViewport: Math.round(r.top), text:a.textContent.trim()}; })()`);
  // restorani
  await s.evalJs(`window.scrollTo(0,0)`);
  await s.click(".tab-pill", { nth: 1 }); await s.waitFor(`document.querySelectorAll('.restaurant-row').length>0`, { timeout: 15000 }); await s.idle(600); await sleep(500);
  await s.evalJs(`window.scrollTo(0,0)`);
  await run(s, "d-rest", [
    [1, ".page-title", { fx: 1, fy: .5, dx: 14 }],
    [2, ".status-select", { fx: 1, fy: .5, dx: 16 }],
    [3, ".restaurant-status.status-active", { nth: 0, fx: 1, fy: .5, dx: 14 }],
    [4, ".restaurant-name .v-chip", { text: "Valuta", fx: 1, fy: .5, dx: 14 }],
    [5, ".restaurant-status.status-warning", { fx: 1, fy: .5, dx: 14 }],
    [6, ".restaurant-row .v-switch", { nth: 0, fx: 1, fy: .5, dx: 14 }],
    [7, ".restaurant-actions .v-btn", { nth: 0, fx: 0, fy: .5, dx: -14 }],
  ], { x: 264, y: 0, w: 1176, h: 800 });
  await s.close();
}
// nesnimljena valuta -> restorani
{
  const s = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "f";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(900);
  await s.evalJs(`[...document.querySelectorAll('.v-select')].find(f=>f.textContent.includes('Valuta firme')).setAttribute('data-t','cur')`);
  await pick(s, "[data-t=cur] .v-field", "EUR");
  await s.click(".tab-pill", { nth: 1 }); await s.waitFor(`document.querySelectorAll('.restaurant-row').length>0`, { timeout: 15000 }); await s.idle(600); await sleep(500);
  await s.evalJs(`window.scrollTo(0,0)`);
  await run(s, "d-unsaved-eur", [
    [1, ".restaurant-name .v-chip", { nth: 0, fx: 1, fy: .5, dx: 14 }],
    [2, ".restaurant-name .v-chip", { nth: 4, fx: 1, fy: .5, dx: 14 }],
  ], { x: 264, y: 150, w: 1176, h: 640 });
  await s.close();
}
// ===== telefon =====
{
  const s = await session("f", { width: 390, height: 844, dpr: 2, mobile: true }); s.__name = "f";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(900); await sleep(600);
  await run(s, "p-top", [
    [1, ".dispatcher-app-bar", { fx: .96, fy: .5 }],
    [2, ".page-title", { fx: 1, fy: .5, dx: 16 }],
    [3, ".tab-pill", { nth: 1, fx: .97, fy: .05, dx: 0, dy: 10 }],
    [4, ".limit-toggle-row .v-switch", { fx: 0, fy: .5, dx: -16 }],
    [5, ".v-messages__message", { text: "Blokiraj - kurir", fx: 1, fy: .5, dx: 0 }],
  ], { x: 0, y: 0, w: 390, h: 844 });
  await s.evalJs(`window.scrollTo(0, document.documentElement.scrollHeight)`); await sleep(400);
  const sy = await s.evalJs("scrollY");
  await run(s, "p-save", [
    [1, ".limit-toggle-row .v-switch", { nth: 1, fx: 0, fy: .5, dx: -16 }],
    [2, "button.v-btn", { text: "Sačuvaj postavke", fx: 1, fy: .5, dx: 18 }],
  ], { x: 0, y: sy, w: 390, h: 844 });
  await s.evalJs(`window.scrollTo(0,0)`); await sleep(200);
  await s.click(".tab-pill", { nth: 1 }); await s.waitFor(`document.querySelectorAll('.restaurant-row').length>0`, { timeout: 15000 }); await s.idle(600); await sleep(500);
  await s.evalJs(`window.scrollTo(0,0)`);
  await run(s, "p-rest", [
    [1, ".page-title", { fx: 1, fy: .5, dx: 16 }],
    [2, ".status-select", { fx: .97, fy: .5 }],
    [3, ".restaurant-status.status-active", { nth: 0, fx: 1, fy: .5, dx: 16 }],
    [4, ".restaurant-name .v-chip", { text: "Valuta", fx: 1, fy: .5, dx: 14 }],
    [5, ".restaurant-row .v-switch", { nth: 0, fx: .5, fy: 0, dx: 0, dy: -4 }],
    [6, ".restaurant-actions .v-btn", { nth: 0, fx: .5, fy: 1, dy: 4 }],
  ], { x: 0, y: 0, w: 390, h: 844 });
  await s.click(".restaurant-info", { nth: 2 }); await sleep(900);
  await run(s, "p-detail", [
    [1, ".detail-value--empty", { nth: 0, fx: 0, fy: .5, dx: -16 }],
    [2, ".detail-value--empty", { nth: 2, fx: 0, fy: .5, dx: -16 }],
  ], { x: 0, y: 0, w: 390, h: 844 });
  await s.close();
}
// ===== stanja (desktop, mali isječci) =====
{
  const s = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "f";
  s.setFlags({ fails: [{ re: /GET .*finance-settings/, status: 500, times: 99 }] });
  await s.load("/dispatcher/company", { wait: ".global-card", extra: 1500, timeout: 120000 }); await s.idle(1000); await sleep(900);
  await run(s, "d-loadfail", [[1, ".global-card", { fx: .5, fy: 1, dy: 20 }]], { x: 264, y: 0, w: 1176, h: 300 });
  await s.close();
}
console.log(JSON.stringify(res, null, 1));
