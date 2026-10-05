import { session, sleep } from "./nh.mjs";
import { cap, markAt, unmark, pt, measure, elInfo } from "./colib.mjs";
const out = {};
const pick = async (s, selActivator, text) => {
  await s.click(selActivator); await sleep(600);
  await s.click(".v-overlay-container .v-list-item", { textIncludes: text }); await sleep(500);
};
// ---------- A) 422 pri čuvanju, korisnik na dnu stranice ----------
{
  const s = await session("b", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "b";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(800);
  await s.clearField('.v-field input[type=number][step="1"]'); // prvo number polje sa step=1 (limit) - ispravljeno ispod
  await s.evalJs(`document.querySelector('.v-form').scrollIntoView()`);
  await s.close();
}
// ---------- A2) isto, ciljano na period isplate ----------
{
  const s = await session("b", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "b";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(800);
  const sel = await s.evalJs(`(() => { const f=[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Period isplate')); const i=f.querySelector('input'); i.setAttribute('data-t','payout'); return true; })()`);
  await s.clearField('input[data-t=payout]');
  await s.evalJs(`window.scrollTo(0, document.documentElement.scrollHeight)`); await sleep(300);
  s.clearLog();
  await s.click("button.v-btn", { textIncludes: "Sačuvaj postavke" });
  await s.idle(700); await sleep(400);
  out.A_patch = s.logOf(/PATCH/).map((e) => e.body && e.body.payout_period_days);
  out.A_pageAlert = await s.evalJs(`(() => { const a=document.querySelector('.page-alert'); if(!a) return null; const r=a.getBoundingClientRect(); return {text:a.textContent.replace(/\\s+/g,' ').trim(), topInViewport: Math.round(r.top), docTop: Math.round(r.top+scrollY), scrollY: Math.round(scrollY), inView: r.bottom>0 && r.top<innerHeight}; })()`);
  out.A_fieldErrors = await s.evalJs(`document.querySelectorAll('.v-input--error, .v-field--error').length`);
  out.A_toasts = await s.evalJs(`[...document.querySelectorAll('.global-alert-card')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())`);
  out.A_shotView = await cap(s, "e1-422-view", { x: 264, y: await s.evalJs("scrollY"), w: 1176, h: 900 }, { quality: 80 });
  await s.close();
}
// ---------- B) GET finance-settings pada (500) ----------
{
  const s = await session("b", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "b";
  s.setFlags({ fails: [{ re: /GET .*finance-settings/, status: 500, times: 99 }] });
  await s.load("/dispatcher/company", { wait: ".global-card", extra: 1500, timeout: 120000 }); await s.idle(1000); await sleep(800);
  out.B_cardText = await s.evalJs(`document.querySelector('.global-card').textContent.replace(/\\s+/g,' ').trim()`);
  out.B_alert = await s.evalJs(`(document.querySelector('.page-alert')||{}).textContent`);
  out.B_buttonsInCard = await s.evalJs(`document.querySelectorAll('.global-card button').length`);
  out.B_cardH = (await elInfo(s, ".global-card")).h;
  out.B_getCount = s.logOf(/GET .*finance-settings/).length;
  out.B_shot = await cap(s, "e2-load-fail", { x: 264, y: 0, w: 1176, h: 420 }, { quality: 80 });
  await s.close();
}
// ---------- C) sporo učitavanje ----------
{
  const s = await session("b", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "b";
  s.setFlags({ delays: [{ re: /GET .*finance-settings/, ms: 2500 }] });
  await s.load("/dispatcher/company", { wait: ".global-card", extra: 600, timeout: 120000 });
  await sleep(900);
  out.C_during = await s.evalJs(`document.querySelector('.global-card').textContent.replace(/\\s+/g,' ').trim()`);
  out.C_duringH = (await elInfo(s, ".global-card")).h;
  out.C_shotDuring = await cap(s, "e3-loading", { x: 264, y: 0, w: 1176, h: 420 }, { quality: 80 });
  await s.waitFor(`!!document.querySelector('.v-form')`, { timeout: 15000 }); await sleep(600);
  out.C_afterH = (await elInfo(s, ".global-card")).h;
  out.C_cls = await s.evalJs("window.__cls");
  await s.close();
}
// ---------- D) neosnimljene izmjene: tab, promjena firme ----------
{
  const s = await session("b", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "b";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(800);
  await s.evalJs(`(() => { const f=[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Limit gotovine')); f.querySelector('input').setAttribute('data-t','limit'); })()`);
  await s.clearField("input[data-t=limit]"); await s.typeText("350"); await sleep(200);
  out.D_edit = await s.evalJs(`document.querySelector('input[data-t=limit]').value`);
  out.D_dirtyIndicator = await s.evalJs(`!!document.querySelector('[data-dirty], .unsaved, .dirty') || /nesačuvan/i.test(document.body.innerText)`);
  await s.click(".tab-pill", { nth: 1 }); await s.idle(700); await sleep(300);
  await s.click(".tab-pill", { nth: 0 }); await sleep(400);
  out.D_afterTabs = await s.evalJs(`document.querySelector('input[data-t=limit]')?.value ?? [...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Limit gotovine'))?.querySelector('input')?.value`);
  s.clearLog();
  await pick(s, ".sidebar-company .v-field", "Glovo");
  await s.idle(900); await sleep(400);
  out.D_afterCompany = await s.evalJs(`[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Limit gotovine'))?.querySelector('input')?.value`);
  out.D_dialog = await s.evalJs(`!!document.querySelector('.v-dialog .v-overlay__content')`);
  out.D_requests = s.mode.log.map((e) => e.method + " " + e.path);
  out.D_title = await s.text(".page-title");
  await s.close();
}
// ---------- E) valuta (nesnimljena) mijenja tab restorana; TOP_N ----------
{
  const s = await session("b", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "b";
  await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 }); await s.idle(800);
  await s.evalJs(`(() => { const f=[...document.querySelectorAll('.v-select')].find(f=>f.textContent.includes('Valuta firme')); f.setAttribute('data-t','cur'); const m=[...document.querySelectorAll('.v-select')].find(f=>f.textContent.includes('Način dodele')); m.setAttribute('data-t','mode'); })()`);
  await pick(s, "[data-t=cur] .v-field", "EUR");
  out.E_limitLabel = await s.evalJs(`[...document.querySelectorAll('.v-field-label')].map(l=>l.textContent).find(t=>t.includes('Limit gotovine'))`);
  out.E_limitValue = await s.evalJs(`[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Limit gotovine')).querySelector('input').value`);
  await s.click(".tab-pill", { nth: 1 }); await s.idle(900); await sleep(400);
  out.E_mismatchChips = await s.evalJs(`[...document.querySelectorAll('.restaurant-name .v-chip')].filter(c=>c.textContent.includes('Valuta')).length`);
  out.E_rows = await s.evalJs(`document.querySelectorAll('.restaurant-row').length`);
  out.E_shot = await cap(s, "e4-unsaved-currency", { x: 264, y: 0, w: 1176, h: 700 }, { quality: 80 });
  await s.click(".tab-pill", { nth: 0 }); await sleep(400);
  await pick(s, "[data-t=mode] .v-field", "Prvih N");
  out.E_topN = await s.evalJs(`({count: [...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Broj kurira'))?.querySelector('input')?.value, timeout: [...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Vrijeme čekanja'))?.querySelector('input')?.value, action: [...document.querySelectorAll('.v-select')].find(f=>f.textContent.includes('Ako niko ne odgovori'))?.textContent.replace(/\\s+/g,' ').trim().slice(0,120), h: document.documentElement.scrollHeight})`);
  await s.close();
}
console.log(JSON.stringify(out, null, 1));
