// Snimak: novo pravilo "Udaljenost preko 2 km" završi iza "Uvijek"; simulacija 3 km (uz pretpostavku "prvo poklapanje" u mocku).
import { session, sleep } from "./nh.mjs";
import { cap, markAt, unmark, pt } from "./colib.mjs";
const s = await session("d", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "d";
s.mode.pr.surcharges[24].find((x) => x.id === 501).active = false;
const tab = (label) => s.click(".global-tab-bar button, .global-tab-bar [role=tab], .tab-pill", { textIncludes: label });
await s.load("/dispatcher/pricing", { wait: "input[type=number]", extra: 600, timeout: 170000 }); await s.idle(800); await sleep(500);
await tab("Vozila i pravila"); await sleep(900); await s.idle(900);
await s.click("button.v-btn", { textIncludes: "Novo pravilo" }); await sleep(500);
await s.click(".cond-tab", { textIncludes: "Udaljenost" }); await sleep(250);
await s.evalJs(`[...document.querySelectorAll('.add-rule-card input[type=number]')].forEach((i, n) => i.setAttribute('data-n', n))`);
await s.focusSel(`.add-rule-card input[data-n="0"]`); await s.typeText("2");
await s.click(".vehicle-picker button", { textIncludes: "Automobil" }); await sleep(200);
await s.click(".add-rule-card button.v-btn", { textIncludes: "Sačuvaj pravilo" }); await s.idle(700); await sleep(500);
await s.click(".v-switch .v-selection-control__input, .v-switch input", { nth: 0 }); await sleep(900); await s.idle(700);
await s.focusSel(".v-window-item--active .v-slider-thumb");
for (let i = 0; i < 14; i++) {
  const v = await s.evalJs(`document.querySelector('.v-window-item--active .slider-value')?.textContent.trim()`);
  if (v === "3.0 km") break;
  await s.key("ArrowLeft"); await sleep(140);
}
await sleep(1000); await s.idle(900);
const out = { matched: await s.evalJs(`document.querySelector('.matched-rule-title')?.textContent.replace(/\\s+/g,' ').trim()`), dist: await s.evalJs(`document.querySelector('.v-window-item--active .slider-value')?.textContent.trim()`), price: await s.evalJs(`document.querySelector('.price-breakdown')?.textContent.replace(/\\s+/g,' ').trim()`) };
await s.evalJs(`window.scrollTo(0,0)`); await sleep(250);
const pts = [[1, ".rule-item", { nth: 4, fx: .5, fy: .5, dx: 60 }], [2, ".rule-item", { nth: 5, fx: .5, fy: .5, dx: 60 }], [3, ".matched-rule-card", { fx: .5, fy: .5 }]];
const list = []; for (const [n, sel, o] of pts) { const p = await pt(s, sel, o); if (p) list.push({ n, x: p.x, y: p.y }); }
await markAt(s, list);
await cap(s, "d-veh-shadow", { x: 264, y: 90, w: 1176, h: 810 }, { scale: 1, quality: 78 });
console.log(JSON.stringify(out));
await s.close();
