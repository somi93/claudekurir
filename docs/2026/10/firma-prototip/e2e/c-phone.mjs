import { session, sleep } from "./nh.mjs";
import { cap, markAt, unmark, pt, measure, elInfo, contrastOf } from "./colib.mjs";
const out = {};
const s = await session("p", { width: 390, height: 844, dpr: 2, mobile: true }); s.__name = "p";
await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(800); await sleep(500);
out.base = await measure(s);
out.appBar = await elInfo(s, ".dispatcher-app-bar");
out.header = await elInfo(s, ".page-header");
out.title = await s.text(".page-title");
out.save = await s.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Sačuvaj postavke')); const r=b.getBoundingClientRect(); return {top: Math.round(r.top+scrollY), h: Math.round(r.height)}; })()`);
out.tab = await elInfo(s, ".tab-pill");
out.tabFont = await s.evalJs(`getComputedStyle(document.querySelector('.tab-pill-label')).fontSize`);
// 1) vrh finansija
let pts = []; const add = async (n, sel, o) => { const p = await pt(s, sel, o); if (p) pts.push({ n, x: p.x, y: p.y }); };
await add(1, ".dispatcher-app-bar", { fx: .5, fy: .5, dx: 20 });
await add(2, ".page-title", { fx: 1, fy: .5, dx: 14 });
await add(3, ".global-tab-bar", { fx: .98, fy: .5 });
await add(4, ".limit-toggle-row", { fx: .98, fy: .1, dx: -4 });
await markAt(s, pts);
out.p1 = await cap(s, "p1-finance-top", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2, quality: 80 });
await unmark(s);
// 2) sredina: dodjela
await s.evalJs(`document.querySelector('.assignment-section').scrollIntoView({block:'start'}); window.scrollBy(0,-70)`); await sleep(300);
const sy = await s.evalJs("scrollY");
pts = []; await add(5, ".assignment-section", { fx: .02, fy: .02, dx: 12, dy: 12 });
await add(6, ".v-select", { nth: 2, fx: .96, fy: .5 });
await markAt(s, pts);
out.p2 = await cap(s, "p2-finance-assign", { x: 0, y: sy, w: 390, h: 844 }, { scale: 2, quality: 80 });
await unmark(s);
// 3) dno sa Sačuvaj
await s.evalJs(`window.scrollTo(0, document.documentElement.scrollHeight)`); await sleep(300);
const sy3 = await s.evalJs("scrollY");
pts = []; await add(7, "button.v-btn", { text: "Sačuvaj postavke", fx: 1, fy: .5, dx: 16 });
await markAt(s, pts);
out.p3 = await cap(s, "p3-finance-save", { x: 0, y: sy3, w: 390, h: 844 }, { scale: 2, quality: 80 });
await unmark(s);
out.screensToSave = Math.ceil(out.save.top / (844 - 130));
// 4) restorani
await s.evalJs(`window.scrollTo(0,0)`); await sleep(200);
await s.click(".tab-pill", { nth: 1 }); await s.waitFor(`document.querySelectorAll('.restaurant-row').length>0`, { timeout: 15000 }); await s.idle(500); await sleep(400);
out.rest = await measure(s);
out.restRowH = await s.evalJs(`[...document.querySelectorAll('.restaurant-row')].map(r=>Math.round(r.getBoundingClientRect().height))`);
out.restSwitch = await s.evalJs(`(() => { const e=document.querySelector('.restaurant-row .v-switch'); const r=e.getBoundingClientRect(); const b=document.querySelector('.restaurant-actions .v-btn').getBoundingClientRect(); return {sw:[Math.round(r.width),Math.round(r.height)], info:[Math.round(b.width),Math.round(b.height)]}; })()`);
pts = []; await add(1, ".dispatcher-app-bar", { fx: .5, fy: .5, dx: 20 });
await add(2, ".list-toolbar", { fx: .98, fy: .5, dx: -4 });
await add(3, ".restaurant-row", { nth: 0, fx: .03, fy: .5, dx: -10 });
await add(4, ".restaurant-row", { nth: 2, fx: .55, fy: .5, dx: 90 });
await add(5, ".restaurant-row", { nth: 3, fx: .55, fy: .8 });
await add(6, ".restaurant-row", { nth: 0, fx: .96, fy: .5, dx: -22 });
await markAt(s, pts);
out.p4 = await cap(s, "p4-rest", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2, quality: 80 });
await unmark(s);
// 5) dijalog suspenzije na telefonu
await s.click(".restaurant-row:nth-of-type(1) input"); await sleep(900);
out.p5 = await cap(s, "p5-suspend", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2, quality: 80 });
out.dlg = await s.evalJs(`(() => { const d=document.querySelector('.v-dialog .v-overlay__content'); const r=d.getBoundingClientRect(); const btns=[...d.querySelectorAll('.v-btn')].map(b=>{const q=b.getBoundingClientRect();return [b.textContent.trim(), Math.round(q.width), Math.round(q.height)]}); return {w:Math.round(r.width), h:Math.round(r.height), top:Math.round(r.top), btns}; })()`);
await s.key("Escape"); await sleep(500);
// 6) detalj
await s.click(".restaurant-info", { nth: 2 }); await sleep(900);
out.p6 = await cap(s, "p6-detail", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2, quality: 80 });
await s.close();
console.log(JSON.stringify(out, null, 1));
