// Dopuna mjerenja stare stranice: prazno polje cijene, valuta, simulacija sa udaljenošću, zasjenjeno pravilo, telefon.
import { session, sleep } from "./nh.mjs";
import { scanContrast, smallTargets, unnamedFields, texts, visibleText, snap } from "./flib.mjs";
import { measure } from "./colib.mjs";

const mk = async (name, o) => { const s = await session(name, o); s.__name = name; return s; };
const R = {};
const step = async (name, fn) => { try { R[name] = await fn(); } catch (e) { R[name] = { error: String(e.message).slice(0, 220) }; } };
const tab = (s, label) => s.click(".global-tab-bar button, .global-tab-bar [role=tab], .tab-pill", { textIncludes: label });
const load = async (s) => { await s.load("/dispatcher/pricing", { wait: "input[type=number]", extra: 600, timeout: 170000 }); await s.idle(800); await sleep(400); };

{
  const s = await mk("a", { width: 1440, height: 900, dpr: 1, mobile: false });
  await load(s);
  await step("x.currencyOnPage", () => s.evalJs(`(() => { const p = document.querySelector('.global-page-body'); return { selects: p.querySelectorAll('.v-select').length, text: /valut|currency/i.test(p.textContent) }; })()`));
  await step("x.emptyCalc", async () => {
    const e0 = s.exceptions.length, c0 = s.consoleMsgs.length;
    await s.clearField("input[type=number]"); await sleep(300);
    const calcEmpty = await s.evalJs(`document.querySelector('.calc-total')?.textContent.replace(/\\s+/g,' ').trim()`);
    const exc = s.exceptions.slice(e0).map((x) => String(x.text).slice(0, 160));
    const cons = s.consoleMsgs.slice(c0).filter((m) => m.type === "error" || m.type === "warning").map((m) => m.text.slice(0, 160));
    await s.typeText("4"); await sleep(300);
    const calcBack = await s.evalJs(`document.querySelector('.calc-total')?.textContent.replace(/\\s+/g,' ').trim()`);
    const lines = await s.evalJs(`[...document.querySelectorAll('.calc-line')].map((l) => l.textContent.replace(/\\s+/g,' ').trim())`);
    return { calcEmpty, exc, cons, calcBack, lines };
  });
  await step("x.sliderRange", () => s.evalJs(`(() => { const i = document.querySelector('.calc-panel input[type=range]'); return i ? { min: i.min, max: i.max, step: i.step, name: i.getAttribute('aria-label') } : null; })()`));

  // tab vozila: prekidač udaljenosti i zasjenjeno pravilo
  await load(s); await tab(s, "Vozila i pravila"); await sleep(900); await s.idle(900);
  await step("x.sim", async () => {
    s.clearLog();
    await s.click(".v-switch .v-selection-control__input, .v-switch input", { nth: 0 });
    await sleep(900); await s.idle(700);
    const calls = s.logOf(/recommend-vehicle/).map((e) => e.q);
    const price = await visibleText(s, ".price-breakdown");
    const range = await s.evalJs(`(() => { const i = document.querySelector('.v-slider input'); return i ? { min: i.min, max: i.max } : null; })()`);
    await snap(s, "m-veh-sim2", { x: 264, y: 90, w: 1176, h: 780 });
    return { calls, price, range };
  });
  // ugasi kišu (doplata 501) da pravilo 1 ne zasjeni ostale, dodaj pravilo "preko 2 km", simuliraj 3 km
  await step("x.shadow", async () => {
    s.mode.pr.surcharges[24].find((x) => x.id === 501).active = false;
    await load(s); await tab(s, "Vozila i pravila"); await sleep(900); await s.idle(900);
    await s.click("button.v-btn", { textIncludes: "Novo pravilo" }); await sleep(500);
    await s.click(".cond-tab", { textIncludes: "Udaljenost" }); await sleep(250);
    await s.evalJs(`[...document.querySelectorAll('.add-rule-card input[type=number]')].forEach((i, n) => i.setAttribute('data-n', n))`);
    await s.focusSel(`.add-rule-card input[data-n="0"]`); await s.typeText("2");
    await s.click(".vehicle-picker button", { textIncludes: "Automobil" }); await sleep(200);
    await s.click(".add-rule-card button.v-btn", { textIncludes: "Sačuvaj pravilo" }); await s.idle(700); await sleep(500);
    await s.click(".v-switch .v-selection-control__input, .v-switch input", { nth: 0 }); await sleep(900); await s.idle(700);
    // slajder: pritisak strelice udesno dok ne pređe 2 km (podrazumijevano 5)
    const matched = await visibleText(s, ".matched-rule-title");
    const order = await s.evalJs(`[...document.querySelectorAll('.rule-item')].map((c) => c.textContent.replace(/\\s+/g,' ').trim().replace('Klikni za izmenu pravila','').slice(0, 60))`);
    await snap(s, "m-veh-shadow", { x: 264, y: 90, w: 1176, h: 810 });
    return { matched, order };
  });
  await s.close();
}

// ===================== telefon =====================
{
  const s = await mk("p", { width: 390, height: 844, dpr: 2, mobile: true });
  await s.load("/dispatcher/pricing", { wait: "input[type=number]", extra: 600, timeout: 170000 }); await s.idle(900); await sleep(600);
  await step("p.base", async () => ({ m: await measure(s), small: await smallTargets(s, "body"), contrast: await scanContrast(s, "body") }));
  await snap(s, "m-p-base", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2 });
  await step("p.chrome", () => s.evalJs(`(() => { const nav = document.querySelector('.bottom-nav, .app-bottom-nav, nav[class*=bottom]'); const bar = document.querySelector('.dispatcher-app-bar'); return { bottomNav: nav ? Math.round(nav.getBoundingClientRect().height) : null, appBar: bar ? Math.round(bar.getBoundingClientRect().height) : null, tabBarH: Math.round(document.querySelector('.global-tab-bar')?.getBoundingClientRect().height ?? 0) }; })()`));
  await tab(s, "Dodatni parametri"); await sleep(700); await s.idle(600);
  await step("p.sur", async () => ({ m: await measure(s), small: await smallTargets(s, "body") }));
  await snap(s, "m-p-sur", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2 });
  await tab(s, "Vozila i pravila"); await sleep(900); await s.idle(900);
  await step("p.veh", async () => ({ m: await measure(s), small: await smallTargets(s, "body") }));
  await snap(s, "m-p-veh", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2 });
  await s.click(".rule-item", { nth: 1 }); await sleep(700);
  await snap(s, "m-p-veh-edit", { x: 0, y: 0, w: 390, h: 844 }, { scale: 2 });
  await step("p.vehEdit", () => s.evalJs(`(() => { const f = document.querySelector('.add-rule-card'); if (!f) return null; const r = f.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), scrollY: Math.round(scrollY) }; })()`));
  await s.close();
}

console.log(JSON.stringify(R, null, 1));
