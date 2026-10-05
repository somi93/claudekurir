// Snimci STARE stranice /dispatcher/pricing sa crvenim oznakama (za dokument cjenovnik-dizajn.html). Računar prvo, telefon drugi.
import { session, sleep } from "./nh.mjs";
import { cap, markAt, unmark, pt } from "./colib.mjs";

const mk = async (name, o) => { const s = await session(name, o); s.__name = name; return s; };
const res = {};
const run = async (s, name, pts, region, o = {}) => {
  const list = [];
  for (const [n, sel, opt] of pts) { const p = await pt(s, sel, opt); if (p) list.push({ n, x: p.x, y: p.y }); else console.log("MISSING marker", name, n, sel); }
  await markAt(s, list);
  const r = typeof region === "function" ? await region() : region;
  res[name] = await cap(s, name, r, { scale: o.scale ?? 1, quality: o.q ?? 78 });
  await unmark(s);
};
const tab = (s, label) => s.click(".global-tab-bar button, .global-tab-bar [role=tab], .tab-pill", { textIncludes: label });
const load = async (s) => { await s.load("/dispatcher/pricing", { wait: "input[type=number]", extra: 600, timeout: 170000 }); await s.idle(800); await sleep(500); };
const D = { x: 264, y: 0, w: 1176 };

// ===== računar =====
{
  const s = await mk("d", { width: 1440, height: 900, dpr: 1, mobile: false });
  await load(s);
  await run(s, "d-base", [
    [1, ".global-card", { nth: 0, fx: .5, fy: .78 }],
    [2, ".calc-panel .v-slider", { fx: .5, fy: .5 }],
    [3, "button.v-btn", { text: "Sačuvaj cenu", fx: 1, fy: .5, dx: 20 }],
    [4, ".panel-subtitle", { nth: 0, fx: 1, fy: .5, dx: 14 }],
    [5, ".global-card", { nth: 0, fx: 1, fy: 0, dx: -30, dy: 30 }],
  ], { ...D, h: 560 });

  // prazno polje: izuzetak u kalkulatoru, opšta poruka
  await s.clearField("input[type=number]"); await sleep(250);
  await s.click("button.v-btn", { textIncludes: "Sačuvaj cenu" }); await s.idle(700); await sleep(500);
  await run(s, "d-422", [
    [1, ".page-alert", { fx: 1, fy: .5, dx: -30 }],
    [2, "input[type=number]", { nth: 0, fx: .5, fy: 1, dy: 22 }],
    [3, ".calc-total strong", { fx: 1, fy: .5, dx: -4, dy: -26 }],
  ], { ...D, h: 560 });

  // doplate
  await load(s); await tab(s, "Dodatni parametri"); await sleep(800); await s.idle(600);
  await run(s, "d-sur", [
    [1, ".surcharge-card .v-switch", { nth: 0, fx: .5, fy: .5 }],
    [2, ".surcharge-card h3", { nth: 0, fx: 1, fy: .5, dx: 14 }],
    [3, ".preset-row .v-chip", { text: "Kiša", fx: .5, fy: 0, dy: -12 }],
    [4, ".surcharge-card", { nth: 1, fx: .5, fy: .5 }],
    [5, ".surcharge-card .reminder-label", { nth: 0, fx: 1, fy: .5, dx: 14 }],
  ], { ...D, y: 90, h: 800 });
  await s.click("button.v-btn", { textIncludes: "Novi parametar" }); await sleep(500);
  await s.evalJs(`[...document.querySelectorAll('.add-rule-card input')].filter((i) => i.type === 'text' || i.type === 'number').forEach((i, n) => i.setAttribute('data-n', n))`);
  await s.focusSel(`.add-rule-card input[data-n="0"]`); await s.typeText("Test doplata");
  await s.clearField(`.add-rule-card input[type=number]`); await s.typeText("0.5");
  await run(s, "d-sur-form", [
    [1, ".add-rule-card .v-field", { nth: 3, fx: 1, fy: .5, dx: -30 }],
    [2, ".add-rule-card .v-field", { nth: 2, fx: 0, fy: .5, dx: 14 }],
    [3, ".auto-time-row", { fx: .5, fy: .5 }],
    [4, ".add-rule-card button.v-btn", { text: "Sačuvaj parametar", fx: 1, fy: .5, dx: 20 }],
  ], { ...D, y: 90, h: 560 });
  await s.click(".add-rule-card button.v-btn", { textIncludes: "Sačuvaj parametar" }); await s.idle(700); await sleep(500);
  await s.evalJs(`window.scrollTo(0, 360)`); await sleep(300);
  await run(s, "d-sur-created", [
    [1, ".surcharge-card", { text: "Test doplata", fx: .5, fy: .5 }],
    [2, ".surcharge-card .reminder-label", { text: "Aktivno 0min", fx: 1, fy: .5, dx: 14 }],
  ], { ...D, y: 360, h: 540 });

  // vozila i pravila
  await load(s); await tab(s, "Vozila i pravila"); await sleep(900); await s.idle(900);
  await run(s, "d-veh", [
    [1, ".rule-item", { nth: 0, fx: .5, fy: .12 }],
    [2, ".rule-item", { nth: 1, fx: .6, fy: .5 }],
    [3, ".rule-item .d-flex.flex-column .v-btn", { nth: 2, fx: .5, fy: .5 }],
    [4, ".rule-item .rule-index", { nth: 4, fx: .5, fy: .5, dx: -14 }],
    [5, ".v-switch", { text: "Odredi udaljenost", fx: .5, fy: .5 }],
  ], { ...D, y: 90, h: 780 });
  // simulacija sa udaljenošću 5 km (podrazumijevano) i Kiša isključena
  s.mode.pr.surcharges[24].find((x) => x.id === 501).active = false;
  await load(s); await tab(s, "Vozila i pravila"); await sleep(900); await s.idle(900);
  await s.click("button.v-btn", { textIncludes: "Novo pravilo" }); await sleep(500);
  await s.click(".cond-tab", { textIncludes: "Udaljenost" }); await sleep(250);
  await s.evalJs(`[...document.querySelectorAll('.add-rule-card input[type=number]')].forEach((i, n) => i.setAttribute('data-n', n))`);
  await s.focusSel(`.add-rule-card input[data-n="0"]`); await s.typeText("2");
  await s.click(".vehicle-picker button", { textIncludes: "Automobil" }); await sleep(200);
  await s.click(".add-rule-card button.v-btn", { textIncludes: "Sačuvaj pravilo" }); await s.idle(700); await sleep(500);
  await s.click(".v-switch .v-selection-control__input, .v-switch input", { nth: 0 }); await sleep(900); await s.idle(700);
  await s.focusSel(".v-slider input");
  for (let i = 0; i < 4; i++) await s.key("ArrowLeft");
  await sleep(1000); await s.idle(900);
  res.shadow = { matched: await s.evalJs(`document.querySelector('.matched-rule-title')?.textContent.replace(/\\s+/g,' ').trim()`), dist: await s.evalJs(`document.querySelector('.slider-value')?.textContent.trim()`) };
  await s.evalJs(`window.scrollTo(0,0)`); await sleep(200);
  await run(s, "d-veh-shadow", [
    [1, ".rule-item", { nth: 4, fx: .5, fy: .5, dx: 60 }],
    [2, ".rule-item", { nth: 5, fx: .5, fy: .5, dx: 60 }],
    [3, ".matched-rule-card", { fx: .5, fy: .5 }],
  ], { ...D, y: 90, h: 810 });
  await s.close();
}

// ===== stanja =====
{
  const s = await mk("d", { width: 1440, height: 900, dpr: 1, mobile: false });
  s.setFlags({ fails: [{ re: /GET .*\/pricing$/, status: 500, times: 99 }] });
  await s.load("/dispatcher/pricing", { wait: ".global-tab-bar", extra: 1200, timeout: 170000 }); await s.idle(1200); await sleep(700);
  await run(s, "d-fail", [
    [1, ".page-alert", { fx: 1, fy: .5, dx: -30 }],
    [2, ".global-card", { nth: 0, fx: .5, fy: .6 }],
    [3, ".calc-total strong", { fx: 1, fy: .5, dx: -4, dy: -26 }],
  ], { ...D, h: 560 });
  await s.close();
}
{
  const s = await mk("d", { width: 1440, height: 900, dpr: 1, mobile: false });
  s.setFlags({ delays: [{ re: /GET .*\/pricing$/, ms: 4000 }, { re: /GET .*surcharges$/, ms: 4000 }] });
  await s.load("/dispatcher/pricing", { wait: ".global-tab-bar", extra: 1500, timeout: 170000 }); await sleep(900);
  await run(s, "d-loading", [
    [1, ".calc-total strong", { fx: 1, fy: .5, dx: -4, dy: -26 }],
    [2, ".v-skeleton-loader", { nth: 0, fx: .5, fy: .5 }],
  ], { ...D, h: 560 });
  await s.close();
}

// ===== telefon =====
{
  const s = await mk("p", { width: 390, height: 844, dpr: 2, mobile: true });
  await s.load("/dispatcher/pricing", { wait: "input[type=number]", extra: 600, timeout: 170000 }); await s.idle(900); await sleep(700);
  await run(s, "p-base", [
    [1, ".calc-panel .v-slider", { fx: .5, fy: .5 }],
    [2, "button.v-btn", { text: "Sačuvaj cenu", fx: 1, fy: .5, dx: 16 }],
    [3, ".tab-pill", { nth: 1, fx: .9, fy: .15 }],
  ], { x: 0, y: 0, w: 390, h: 844 }, { scale: 2 });
  await tab(s, "Dodatni parametri"); await sleep(800); await s.idle(600);
  await run(s, "p-sur", [
    [1, ".surcharge-card .v-switch", { nth: 0, fx: .5, fy: .5 }],
    [2, ".preset-row .v-chip", { text: "Kiša", fx: .5, fy: 0, dy: -10 }],
    [3, ".surcharge-card .reminder-label", { nth: 0, fx: 1, fy: .5, dx: 14 }],
  ], { x: 0, y: 0, w: 390, h: 1100 }, { scale: 2, q: 70 });
  await tab(s, "Vozila i pravila"); await sleep(900); await s.idle(900);
  await run(s, "p-veh", [
    [1, ".rule-item", { nth: 0, fx: .5, fy: .12 }],
    [2, ".rule-item .d-flex.flex-column .v-btn", { nth: 0, fx: .5, fy: .5 }],
    [3, "button.v-btn", { text: "Novo pravilo", fx: 1, fy: .5, dx: 16 }],
  ], { x: 0, y: 0, w: 390, h: 1100 }, { scale: 2, q: 70 });
  await s.close();
}
console.log(JSON.stringify(res, null, 1));
