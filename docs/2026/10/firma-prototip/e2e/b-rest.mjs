import { session, sleep } from "./nh.mjs";
import { buildRestaurants } from "./co-fx.mjs";
import { cap, markAt, unmark, pt, measure, elInfo, contrastOf } from "./colib.mjs";
const out = {};
const openRest = async (s) => { await s.click(".tab-pill", { nth: 1 }); await s.waitFor(`document.querySelectorAll('.restaurant-row').length>0`, { timeout: 15000 }); await s.idle(500); await sleep(300); };
{
  const s = await session("c", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "c";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(800);
  await openRest(s);
  out.base = await measure(s);
  out.rows = await s.evalJs(`[...document.querySelectorAll('.restaurant-row')].map(r=>({name:r.querySelector('.restaurant-name').childNodes[0].textContent.trim().slice(0,30), chips:[...r.querySelectorAll('.v-chip')].map(c=>c.textContent.replace(/\\s+/g,' ').trim()), status:r.querySelector('.restaurant-status').textContent.trim().slice(0,90), cls:r.className.includes('row-active'), h:Math.round(r.getBoundingClientRect().height), sw: r.querySelector('input').checked, swDisabled: r.querySelector('input').disabled}))`);
  out.listH = (await elInfo(s, ".restaurant-list")).h;
  out.toolbar = await elInfo(s, ".list-toolbar");
  const cs = {};
  for (const [k, sel] of [["statusOff", ".status-off"], ["statusWarn", ".status-warning"], ["statusActive", ".status-active"], ["sub", ".panel-subtitle"], ["searchPh", ".restaurant-search input"]]) {
    try { cs[k] = (await contrastOf(s, sel, 0))?.ratio; } catch (e) { cs[k] = "err"; }
  }
  out.contrast = cs;
  // filter "Aktivni": šta se zaista vidi
  await s.click(".status-select .v-field"); await sleep(500);
  await s.click(".v-overlay-container .v-list-item", { textIncludes: "Aktivni" }); await sleep(500);
  out.filterAktivni = await s.evalJs(`[...document.querySelectorAll('.restaurant-status')].map(e=>e.textContent.trim().slice(0,40))`);
  await s.click(".status-select .v-field"); await sleep(500);
  await s.click(".v-overlay-container .v-list-item", { textIncludes: "Suspendovani" }); await sleep(500);
  out.filterSusp = await s.evalJs(`[...document.querySelectorAll('.restaurant-status')].map(e=>e.textContent.trim().slice(0,60))`);
  await s.click(".status-select .v-field"); await sleep(500);
  await s.click(".v-overlay-container .v-list-item", { textIncludes: "Svi" }); await sleep(500);
  // oznake i snimak
  await s.evalJs(`window.scrollTo(0,0)`);
  const pts = []; const add = async (n, sel, o) => { const p = await pt(s, sel, o); if (p) pts.push({ n, x: p.x, y: p.y }); };
  await add(1, ".page-title", { fx: 1, fy: .5, dx: 14 });
  await add(2, ".list-toolbar", { fx: 1, fy: .5, dx: -10 });
  await add(3, ".restaurant-row", { nth: 0, fx: .02, fy: .5, dx: -14 });
  await add(4, ".restaurant-row", { nth: 2, fx: .5, fy: .5, dx: 40 }); // EUR chip row
  await add(5, ".restaurant-row", { nth: 4, fx: .55, fy: .5, dx: 120 });
  await add(6, ".restaurant-row", { nth: 0, fx: .985, fy: .5, dx: 0 });
  await markAt(s, pts);
  out.shotR1 = await cap(s, "r1-restaurants", { x: 264, y: 0, w: 1176, h: Math.min(out.base.docH, 1000) }, { quality: 82 });
  await unmark(s);
  // isključivanje: switch -> dijalog suspenzije
  s.clearLog();
  await s.click(".restaurant-row:nth-of-type(1) input"); await sleep(900);
  out.suspendDialog = await s.evalJs(`(() => { const d=document.querySelector('.v-dialog .v-overlay__content'); return d? d.textContent.replace(/\\s+/g,' ').trim().slice(0,200):null })()`);
  out.suspendShot = await cap(s, "r2-suspend-dialog", { x: 464, y: 100, w: 700, h: 500 }, { quality: 82 });
  await s.evalJs(`document.querySelector('.v-dialog textarea').focus()`); await s.typeText("Dug za proviziju"); 
  await s.click(".v-dialog .v-btn", { textIncludes: "Suspenduj" }); await s.idle(700); await sleep(400);
  out.patchSusp = s.logOf(/PATCH/).map((e) => e.body);
  out.afterSusp = await s.evalJs(`(() => { const r=document.querySelectorAll('.restaurant-row')[0]; return {status:r.querySelector('.restaurant-status').textContent.trim(), sw:r.querySelector('input').checked}; })()`);
  out.toastSusp = await s.evalJs(`[...document.querySelectorAll('.global-alert-card')].map(e=>e.textContent.trim())`);
  // 403 pri uključivanju: revert + poruka
  await sleep(300);
  s.setFlags({ fails: [{ re: /PATCH .*restaurant-delivery-company/, status: 403, times: 1, body: { message: "Niste vezani za ovu firmu." } }] });
  await s.click(".restaurant-row:nth-of-type(1) input"); await sleep(700);
  out.confirmDialog = await s.evalJs(`(() => { const d=document.querySelector('.v-dialog .v-overlay__content'); return d? d.textContent.replace(/\\s+/g,' ').trim().slice(0,200):null })()`);
  await s.click(".v-dialog .v-btn", { textIncludes: "Potvrdi" }).catch(async () => { await s.click(".v-dialog .v-btn:last-child"); });
  await s.idle(700); await sleep(400);
  out.after403 = await s.evalJs(`(() => { const r=document.querySelectorAll('.restaurant-row')[0]; return {status:r.querySelector('.restaurant-status').textContent.trim(), sw:r.querySelector('input').checked, alert:(document.querySelector('.page-alert')||{}).textContent}; })()`);
  // detalj
  await s.evalJs(`window.scrollTo(0,0)`);
  await s.click(".restaurant-info", { nth: 2 }); await sleep(900);
  out.detailRows = await s.evalJs(`[...document.querySelectorAll('.v-dialog .detail-row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim())`);
  out.detailShot = await cap(s, "r3-detail", { x: 464, y: 40, w: 700, h: 860 }, { quality: 82 });
  await s.close();
}
// ---------- 150 restorana, CPU 4x ----------
{
  const s = await session("c", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "c";
  s.mode.restaurants[24] = buildRestaurants(150);
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(800);
  await openRest(s);
  out.big = await measure(s);
  out.bigRows = await s.evalJs(`document.querySelectorAll('.restaurant-row').length`);
  out.bigListH = (await elInfo(s, ".restaurant-list")).h;
  await s.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await s.evalJs(`document.querySelector('.restaurant-search input').focus()`);
  out.typeMs = await s.evalJs(`new Promise(res => { const i=document.querySelector('.restaurant-search input'); const t0=performance.now(); i.value='ko'; i.dispatchEvent(new Event('input',{bubbles:true})); requestAnimationFrame(()=>requestAnimationFrame(()=>res(Math.round(performance.now()-t0)))); })`);
  out.afterSearchRows = await s.evalJs(`document.querySelectorAll('.restaurant-row').length`);
  await s.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await s.close();
}
console.log(JSON.stringify(out, null, 1));
