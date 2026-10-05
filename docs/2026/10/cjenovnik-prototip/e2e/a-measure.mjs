// Mjerenja STARE stranice /dispatcher/pricing u pravom Chrome-u nad lažnim API-jem (računar 1440×900).
// Izlaz: JSON na kraju. Izmjere važe za probne podatke; ništa nije provjereno nad pravim backendom.
import { session, sleep } from "./nh.mjs";
import { scanContrast, smallTargets, unnamedFields, texts, visibleText, snap } from "./flib.mjs";
import { measure } from "./colib.mjs";

const mk = async (name, o) => { const s = await session(name, o); s.__name = name; return s; };
const R = {};
const step = async (name, fn) => { try { R[name] = await fn(); } catch (e) { R[name] = { error: String(e.message).slice(0, 200) }; } };
const tabClick = (s, label) => s.click(".global-tab-bar button, .global-tab-bar [role=tab], .tab-pill", { textIncludes: label });
const load = async (s, o = {}) => { await s.load("/dispatcher/pricing", { wait: "input[type=number]", extra: 600, timeout: 170000 }); await s.idle(800); await sleep(400); };

// ===================== računar =====================
{
  const s = await mk("a", { width: 1440, height: 900, dpr: 1, mobile: false });
  await load(s);

  // ---- tab 1: cijena dostave ----
  await step("base.layout", () => s.evalJs(`(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
    const cards = [...document.querySelectorAll('.global-card')];
    const form = cards[0], calc = cards[1];
    const fb = form.getBoundingClientRect();
    const kids = [...form.querySelectorAll('.v-field, button')].map((e) => e.getBoundingClientRect().bottom);
    const lastBottom = Math.max(...kids);
    return { page: r('.global-page'), form: r('.global-card'), calc: { ...(calc.getBoundingClientRect().toJSON()), }, formH: Math.round(fb.height), contentBottom: Math.round(lastBottom - fb.top), emptyPct: Math.round((1 - (lastBottom - fb.top) / fb.height) * 100), docH: document.documentElement.scrollHeight, vh: innerHeight };
  })()`));
  await step("base.slider", () => s.evalJs(`(() => {
    const track = document.querySelector('.v-slider-track__background'), fill = document.querySelector('.v-slider-track__fill'), thumb = document.querySelector('.v-slider-thumb__surface');
    const cs = (e) => e ? getComputedStyle(e).backgroundColor : null;
    const panel = document.querySelector('.calc-panel');
    return { track: cs(track), fill: cs(fill), thumb: cs(thumb), panel: cs(panel), trackH: track ? Math.round(track.getBoundingClientRect().height) : null, role: document.querySelector('.v-slider input')?.getAttribute('aria-label') ?? null };
  })()`));
  await step("base.contrast", () => scanContrast(s));
  await step("base.small", () => smallTargets(s));
  await step("base.unnamed", () => unnamedFields(s));
  await step("base.currencyControl", () => s.evalJs(`!!document.querySelector('.v-select')`));
  await snap(s, "m-base", { x: 0, y: 0, w: 1440, h: 900 });

  // izmjena -> uživo obračun, "Sačuvano." ostaje
  await step("base.edit", async () => {
    await s.clearField("input[type=number]"); await s.typeText("3.2");
    await sleep(150);
    const calc = await s.evalJs(`document.querySelector('.calc-total')?.textContent.replace(/\\s+/g,' ').trim()`);
    s.clearLog();
    await s.click("button.v-btn", { textIncludes: "Sačuvaj cenu" }); await s.idle(600); await sleep(300);
    const put = s.logOf(/PUT .*pricing/).map((e) => e.body);
    const saved1 = await visibleText(s, ".save-confirm");
    await s.clearField("input[type=number]"); await s.typeText("3.9"); await sleep(200);
    const saved2 = await visibleText(s, ".save-confirm");
    const calc2 = await s.evalJs(`document.querySelector('.calc-total')?.textContent.replace(/\\s+/g,' ').trim()`);
    return { calc, put, savedAfterSave: saved1, savedAfterNextEdit: saved2, calcAfterEdit: calc2 };
  });
  // prazno polje
  await step("base.empty", async () => {
    await s.clearField("input[type=number]"); await sleep(150);
    s.clearLog();
    await s.click("button.v-btn", { textIncludes: "Sačuvaj cenu" }); await s.idle(600); await sleep(400);
    const put = s.logOf(/PUT .*pricing/).map((e) => e.body);
    const alert = await visibleText(s, ".page-alert");
    const inline = await texts(s, ".v-messages__message");
    const alertTop = await s.evalJs(`(() => { const a = document.querySelector('.page-alert'); if (!a) return null; const r = a.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; })()`);
    const fieldBottom = await s.evalJs(`Math.round(document.querySelector('input[type=number]').getBoundingClientRect().bottom)`);
    await snap(s, "m-base-422", { x: 0, y: 0, w: 1440, h: 900 });
    return { put, alert, inlineMessages: inline, alertTop, fieldBottom, calcText: await s.evalJs(`document.querySelector('.calc-total')?.textContent.replace(/\\s+/g,' ').trim()`) };
  });
  // negativna vrijednost: klijent ne zabranjuje
  await step("base.negative", async () => {
    await s.clearField("input[type=number]"); await s.typeText("-5"); await sleep(150);
    s.clearLog();
    await s.click("button.v-btn", { textIncludes: "Sačuvaj cenu" }); await s.idle(600);
    return { put: s.logOf(/PUT .*pricing/).map((e) => e.body), min: await s.evalJs(`document.querySelector('input[type=number]').getAttribute('min')`) };
  });
  // izlaz sa nesačuvanim unosom (klik na Firmu u bočnoj traci)
  await step("base.leave", async () => {
    await s.clearField("input[type=number]"); await s.typeText("9.9"); await sleep(150);
    await s.click("a[href='/dispatcher/company'], a[href*='company']", { textIncludes: "Firma" }); await sleep(900);
    return { path: await s.evalJs(`location.pathname`), dialog: await s.evalJs(`!!document.querySelector('.v-overlay--active .v-dialog, [role=dialog]')`) };
  });

  // ---- tab 2: dodatni parametri ----
  await load(s);
  await tabClick(s, "Dodatni parametri"); await sleep(700); await s.idle(600);
  await step("sur.layout", () => s.evalJs(`(() => {
    const cards = [...document.querySelectorAll('.surcharge-card')];
    const b = cards.map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; });
    const cols = new Set(b.map((x) => x.x)).size;
    const ctl = cards.map((c) => [...c.querySelectorAll('button, input')].length);
    return { count: cards.length, cols, h: b[0]?.h, w: b[0]?.w, docH: document.documentElement.scrollHeight, controlsPerCard: ctl, text: cards.map((c) => c.textContent.replace(/\\s+/g,' ').trim().slice(0, 140)) };
  })()`));
  await step("sur.chips", () => texts(s, ".preset-row .v-chip"));
  await step("sur.contrast", () => scanContrast(s));
  await step("sur.small", () => smallTargets(s));
  await step("sur.unnamed", () => unnamedFields(s));
  await snap(s, "m-sur", { x: 0, y: 0, w: 1440, h: 900 });
  await step("sur.cardClick", async () => {
    await s.click(".surcharge-card h3", { textIncludes: "Kiša" }); await sleep(400);
    return { formOpen: await s.evalJs(`!!document.querySelector('.add-rule-card')`), dialog: await s.evalJs(`!!document.querySelector('.v-overlay--active')`) };
  });
  // dodavanje: per_km bez jedinice, pa bilješka
  await step("sur.add", async () => {
    await s.click("button.v-btn", { textIncludes: "Novi parametar" }); await sleep(500);
    const inputs = await s.evalJs(`[...document.querySelectorAll('.add-rule-card .v-field')].map((f) => f.textContent.replace(/\\s+/g,' ').trim().slice(0, 40))`);
    await s.evalJs(`[...document.querySelectorAll('.add-rule-card input')].filter((i) => i.type === 'text' || i.type === 'number').forEach((i, n) => i.setAttribute('data-n', n))`);
    await s.focusSel(`.add-rule-card input[data-n="0"]`); await s.typeText("Test doplata");
    await s.clearField(`.add-rule-card input[type=number]`); await s.typeText("0.5");
    s.clearLog();
    await snap(s, "m-sur-form", { x: 0, y: 0, w: 1440, h: 900 });
    await s.click(".add-rule-card button.v-btn", { textIncludes: "Sačuvaj parametar" }); await s.idle(700); await sleep(400);
    const post = s.logOf(/POST .*surcharges/).map((e) => e.body);
    const card = await s.evalJs(`[...document.querySelectorAll('.surcharge-card')].map((c) => c.textContent.replace(/\\s+/g,' ').trim()).find((t) => t.includes('Test doplata'))`);
    return { fieldsInForm: inputs, post, createdCard: card };
  });
  // brisanje doplate koju koristi pravilo
  await step("sur.deleteUsed", async () => {
    await s.evalJs(`document.querySelectorAll('.surcharge-card').forEach((c) => { if (c.textContent.includes('Kiša')) c.setAttribute('data-kisa', '1'); })`);
    await s.click("[data-kisa='1'] button[aria-label='Obriši naknadu']"); await sleep(600);
    const dlg = await s.evalJs(`(document.querySelector('.v-overlay--active')?.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 200)`);
    return { confirmText: dlg };
  });
  await s.key("Escape"); await sleep(300);

  // ---- tab 3: vozila i pravila ----
  await load(s);
  await tabClick(s, "Vozila i pravila"); await sleep(900); await s.idle(900);
  await step("veh.layout", () => s.evalJs(`(() => {
    const items = [...document.querySelectorAll('.rule-item')];
    const b = items.map((c) => { const r = c.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.round(r.height) }; });
    return { count: items.length, h: b.map((x) => x.h), titles: items.map((c) => c.querySelector('.v-list-item-title')?.textContent.replace(/\\s+/g,' ').trim()), docH: document.documentElement.scrollHeight };
  })()`));
  await step("veh.contrast", () => scanContrast(s));
  await step("veh.small", () => smallTargets(s));
  await step("veh.unnamed", () => unnamedFields(s));
  await snap(s, "m-veh", { x: 0, y: 0, w: 1440, h: 900 });
  // simulacija: zona Centar bez udaljenosti, pa sa udaljenošću
  await step("veh.sim", async () => {
    const out = {};
    s.clearLog();
    out.hint = await visibleText(s, ".price-hint");
    out.firstCall = s.logOf(/recommend-vehicle/).map((e) => e.q);
    await s.click(".v-switch", { textIncludes: "Odredi udaljenost" }); await sleep(700); await s.idle(600);
    out.priceBlock = (await visibleText(s, ".price-breakdown")) ?? null;
    out.calls = s.logOf(/recommend-vehicle/).map((e) => e.q);
    await snap(s, "m-veh-sim", { x: 0, y: 0, w: 1440, h: 900 });
    return out;
  });
  // novo pravilo: gdje se upisuje u odnosu na "Uvijek"
  await step("veh.addRule", async () => {
    await s.click("button.v-btn", { textIncludes: "Novo pravilo" }); await sleep(500);
    await s.click(".cond-tab", { textIncludes: "Udaljenost" }); await sleep(250);
    await s.evalJs(`[...document.querySelectorAll('.add-rule-card input[type=number]')].forEach((i, n) => i.setAttribute('data-n', n))`);
    await s.focusSel(`.add-rule-card input[data-n="0"]`); await s.typeText("2");
    await s.click(".vehicle-picker button", { textIncludes: "Automobil" }); await sleep(200);
    s.clearLog();
    await s.click(".add-rule-card button.v-btn", { textIncludes: "Sačuvaj pravilo" }); await s.idle(700); await sleep(500);
    const post = s.logOf(/POST .*vehicle-rules/).map((e) => e.body);
    const titles = await s.evalJs(`[...document.querySelectorAll('.rule-item')].map((c) => c.querySelector('.v-list-item-title')?.textContent.replace(/\\s+/g,' ').trim())`);
    return { post, titles };
  });
  // simulacija sa udaljenošću 3 km (>2): ide li novo pravilo ili "Uvijek"
  await step("veh.addRule.sim", async () => {
    await s.evalJs(`(() => { const sl = document.querySelector('.v-slider input'); sl.focus(); })()`);
    const matched = await visibleText(s, ".matched-rule-title");
    return { matched };
  });
  // redoslijed: jedan pomak = dva PUT poziva
  await step("veh.move", async () => {
    s.clearLog();
    await s.click(".rule-item .d-flex.flex-column .v-btn", { nth: 3 }); await s.idle(700); await sleep(300);
    return { puts: s.logOf(/PUT .*vehicle-rules/).map((e) => ({ path: e.path, body: e.body })) };
  });

  // ---- stanja ----
  // prazna firma (firma 27) preko selektora u bočnoj traci
  await load(s);
  await step("state.company27", async () => {
    s.mode.pr.pricing[27] = { delivery_company_id: 27, base_price: 3, price_per_km: 0.9, currency: "KM" };
    await s.click(".sidebar-company .v-field"); await sleep(500);
    await s.click(".v-overlay-container .v-list-item", { textIncludes: "Glovo" }); await sleep(900); await s.idle(700);
    await tabClick(s, "Dodatni parametri"); await sleep(600);
    const emptySur = await visibleText(s, ".global-empty-state, .empty-state");
    await snap(s, "m-empty-sur", { x: 0, y: 0, w: 1440, h: 900 });
    await tabClick(s, "Vozila i pravila"); await sleep(800); await s.idle(600);
    const emptyRules = await visibleText(s, ".global-empty-state, .empty-state");
    await snap(s, "m-empty-veh", { x: 0, y: 0, w: 1440, h: 900 });
    return { emptySur, emptyRules };
  });
  await s.close();
}

// pad učitavanja cijene i sporo učitavanje
{
  const s = await mk("a", { width: 1440, height: 900, dpr: 1, mobile: false });
  s.setFlags({ fails: [{ re: /GET .*\/pricing$/, status: 500, times: 99 }] });
  await s.load("/dispatcher/pricing", { wait: ".global-tab-bar", extra: 1200, timeout: 170000 }); await s.idle(1200); await sleep(600);
  R["state.pricingFail"] = { alert: await visibleText(s, ".page-alert"), formCardText: await s.evalJs(`document.querySelector('.global-card')?.textContent.replace(/\\s+/g,' ').trim()`), cardH: await s.evalJs(`Math.round(document.querySelector('.global-card')?.getBoundingClientRect().height)`) };
  await snap(s, "m-fail", { x: 0, y: 0, w: 1440, h: 700 });
  await s.close();
}
{
  const s = await mk("a", { width: 1440, height: 900, dpr: 1, mobile: false });
  s.setFlags({ delays: [{ re: /GET .*\/pricing$/, ms: 2500 }, { re: /GET .*surcharges$/, ms: 2500 }] });
  await s.load("/dispatcher/pricing", { wait: ".global-tab-bar", extra: 1500, timeout: 170000 }); await sleep(900);
  R["state.loading"] = { skeleton: await s.evalJs(`!!document.querySelector('.v-skeleton-loader')`), calcText: await s.evalJs(`document.querySelector('.calc-total')?.textContent.replace(/\\s+/g,' ').trim()`) };
  await snap(s, "m-loading", { x: 0, y: 0, w: 1440, h: 700 });
  await s.close();
}

console.log(JSON.stringify(R, null, 1));
