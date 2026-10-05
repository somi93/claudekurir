import { session, sleep, ratio } from "./nh.mjs";
import { cap, markAt, unmark, pt, measure, elInfo, contrastOf } from "./colib.mjs";
const out = {};
const s = await session("a", { width: 1440, height: 900, dpr: 1, mobile: false });
s.__name = "a";
await s.load("/dispatcher/company", { wait: ".v-form", extra: 800, timeout: 120000 });
await s.idle(800);
out.base = await measure(s);
out.title = await s.text(".page-title");
out.tabbar = await elInfo(s, ".global-tab-bar");
out.firstTab = await elInfo(s, ".tab-pill");
out.save = await s.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Sačuvaj postavke')); const r=b.getBoundingClientRect(); return {top: Math.round(r.top+scrollY), h: Math.round(r.height), disabled: b.disabled}; })()`);
out.selectText = await s.evalJs(`[...document.querySelectorAll('.v-select .v-select__selection-text')].map(e=>e.textContent.trim())`);
out.messagesText = await s.evalJs(`[...document.querySelectorAll('.v-messages__message')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())`);
// kontrast
const cs = {};
for (const [k, sel, nth] of [["hintLimit", ".switch-hint", 0], ["cardSub", ".panel-subtitle", 0], ["msg", ".v-messages__message", 0], ["label", ".v-field-label", 0], ["sectionHint", ".section-hint", 0], ["tabInactive", ".tab-pill:not(.tab-pill--active) .tab-pill-label", 0], ["tabActive", ".tab-pill--active .tab-pill-label", 0], ["sidebarSub", ".v-list-item-subtitle", 0]]) {
  try { cs[k] = await contrastOf(s, sel, nth); } catch (e) { cs[k] = String(e.message).slice(0, 60); }
}
out.contrast = cs;
// oznake i snimak desktopa (sadržaj, bez sidebara)
const pts = [];
const add = async (n, sel, o) => { const p = await pt(s, sel, o); if (p) pts.push({ n, x: p.x, y: p.y }); return p; };
await add(1, ".page-title", { fx: 1, fy: 0.5, dx: 14 });
await add(2, ".global-tab-bar", { fx: 0.5, fy: 0.5, dx: 120 });
await add(3, ".limit-toggle-row", { fx: 0.97, fy: 0.5, dx: 20 });
await add(4, ".v-select", { nth: 1, fx: 0.5, fy: 0.5, dx: -200 }); // enforcement select (2nd v-select)
await add(5, ".assignment-section", { fx: 0, fy: 0, dx: 12, dy: 12 });
await add(6, "button.v-btn", { text: "Sačuvaj postavke", fx: 1, fy: 0.5, dx: 20 });
await markAt(s, pts);
const dh = out.base.docH;
out.shotD1 = await cap(s, "d1-finance", { x: 264, y: 0, w: 1176, h: Math.min(dh, 1130) }, { scale: 1, quality: 82 });
await unmark(s);

// ---- 1) limit on/off ----
await s.click(".limit-toggle-row .v-switch input");
await sleep(250);
out.limitOff = await s.evalJs(`(() => { const i=[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Limit gotovine')).querySelector('input'); return {value:i.value, disabled:i.disabled}; })()`);
await s.click(".limit-toggle-row .v-switch input");
await sleep(250);
out.limitBackOn = await s.evalJs(`(() => { const i=[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Limit gotovine')).querySelector('input'); return {value:i.value, disabled:i.disabled}; })()`);
s.clearLog();
await s.click("button.v-btn", { textIncludes: "Sačuvaj postavke" });
await s.idle(600);
out.patch1 = s.logOf(/PATCH/).map((e) => e.body);
out.toast1 = await s.evalJs(`(document.querySelector('.v-snackbar, .global-alert, [role=alert], [role=status]')||{}).textContent`);

// ---- 2) prazan period isplate -> 422 ----
await s.clearField('input[type=number][step="1"]:not([min])');
out.payoutEmpty = await s.evalJs(`[...document.querySelectorAll('.v-field')].find(f=>f.textContent.includes('Period isplate')).querySelector('input').value`);
s.clearLog();
await s.evalJs(`window.scrollTo(0, document.documentElement.scrollHeight)`);
await s.click("button.v-btn", { textIncludes: "Sačuvaj postavke" });
await s.idle(700);
out.patch2 = s.logOf(/PATCH/).map((e) => e.body && e.body.payout_period_days);
out.alert2 = await s.evalJs(`(() => { const a=document.querySelector('.page-alert, .v-alert, [role=alert]'); if(!a) return null; const r=a.getBoundingClientRect(); return {text:a.textContent.replace(/\\s+/g,' ').trim(), top: Math.round(r.top), scrollY: Math.round(scrollY), inView: r.bottom>0 && r.top<innerHeight}; })()`);
out.fieldError2 = await s.evalJs(`[...document.querySelectorAll('.v-field--error')].length`);
out.shotAlert = await cap(s, "d2-alert-offscreen", { x: 264, y: await s.evalJs("scrollY"), w: 1176, h: 900 }, { scale: 1, quality: 80 });
await s.evalJs(`window.scrollTo(0,0)`);
out.alertTop = await cap(s, "d2-alert-top", { x: 264, y: 0, w: 1176, h: 330 }, { scale: 1, quality: 80 });

// ---- 3) tastatura ----
await s.evalJs(`window.scrollTo(0,0); document.querySelector('.tab-pill').focus()`);
await s.key("ArrowRight");
await sleep(150);
out.arrowTab = await s.evalJs(`[...document.querySelectorAll('.tab-pill')].map(t=>t.getAttribute('aria-selected'))`);
out.tabRoles = await s.evalJs(`({tablist: !!document.querySelector('[role=tablist]'), tabsWithTabindex: [...document.querySelectorAll('.tab-pill')].map(t=>t.getAttribute('tabindex')), panel: !!document.querySelector('[role=tabpanel]')})`);
out.perf = { cls: await s.evalJs("window.__cls"), long: await s.evalJs("window.__long") };
console.log(JSON.stringify(out, null, 1));
await s.close();
