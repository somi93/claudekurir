// A1: stranica Finansije "prije" - računar 1440x900, sva četiri taba + dijalozi: raspored, kontrast, mete, Tab redoslijed, zahtjevi.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./fh.mjs";
import { scanContrast, smallTargets, unnamedFields, texts } from "./ff.mjs";
import { measure } from "./cf.mjs";

const out = {};
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900);
const tag = process.env.TAG || "d";
const s = await session(`a1-${tag}`, { width: W, height: H, dpr: 1, mobile: W < 700 });
s.__name = `a1-${tag}`;

const tab = async (key) => {
  await s.click(`[role=tab][data-tab="${key}"]`);
  await s.idle(700);
  await sleep(500);
};

// Redoslijed Tab tastera: počni od dugmeta Nazad u zaglavlju, broji zaustavljanja unutar .global-page.
const tabStops = async (max = 60) => {
  await s.evalJs(`(() => { const b = document.querySelector('.page-header button, .page-header a'); if (b) b.focus(); })()`);
  const stops = [];
  for (let i = 0; i < max; i++) {
    await s.key("Tab");
    const info = await s.evalJs(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const inMain = !!e.closest('.global-page'); const inDlg = !!e.closest('.v-overlay--active'); return { inMain, inDlg, tag: e.tagName.toLowerCase(), role: e.getAttribute('role'), label: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').replace(/\\s+/g,' ').trim().slice(0, 36) }; })()`);
    if (!info) break;
    if (!info.inMain && !info.inDlg && stops.length > 0) break;
    stops.push(info);
  }
  return stops;
};

const rows = (sel) => s.evalJs(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})]; return els.map((e) => { const r = e.getBoundingClientRect(); return { y: Math.round(r.top + scrollY), h: Math.round(r.height), b: Math.round(r.bottom + scrollY), w: Math.round(r.width) }; }); })()`);

try {
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 1200 });
  await s.idle(700);
  out.load = { requests: s.mode.log.filter((e) => !/\/me$|my-companies|outbox/.test(e.path)).map((e) => `${e.method} ${e.path}${e.q}`) };

  // ---- tab 1: zahtjevi
  const t1 = {};
  await s.shot(`1-handovers-${tag}`);
  await s.shot(`1-handovers-${tag}-full`, { full: true });
  await s.evalJs(`window.scrollTo(0, 0)`);
  t1.rows = await rows(".handover-row");
  t1.measure = await measure(s);
  t1.contrast = await scanContrast(s);
  t1.small = await smallTargets(s);
  t1.stops = await tabStops();
  t1.tabbar = await s.rectOf(".global-tab-bar");
  t1.card = await s.rectOf(".global-card");
  out.handovers = t1;

  // dijalog potvrde
  await s.click(".handover-row button");
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`, { timeout: 6000 });
  await sleep(500);
  const d1 = {};
  d1.card = await s.rectOf(".v-overlay--active .v-card");
  d1.title = (await texts(s, ".v-overlay--active .dialog-title-text"))[0];
  d1.fields = await s.evalJs(`[...document.querySelectorAll('.v-overlay--active input, .v-overlay--active textarea')].map((e) => ({ type: e.type, value: e.value, label: e.closest('.v-input')?.querySelector('.v-label')?.textContent.trim() }))`);
  d1.active = await s.evalJs(`(() => { const e = document.activeElement; return e ? { tag: e.tagName.toLowerCase(), type: e.type, label: e.closest('.v-input')?.querySelector('.v-label')?.textContent.trim() ?? e.textContent.trim().slice(0, 20) } : null; })()`);
  d1.contrast = await scanContrast(s, ".v-overlay--active .v-card");
  d1.small = await smallTargets(s, ".v-overlay--active .v-card");
  d1.copy = (await texts(s, ".v-overlay--active .confirm-copy"))[0];
  await s.shot(`1b-confirm-dialog-${tag}`);
  // razlika u iznosu
  await s.clearField(".v-overlay--active input[type=number]");
  await s.typeText("90");
  await sleep(300);
  d1.diffText = (await texts(s, ".v-overlay--active .confirm-diff"))[0];
  d1.fieldsAfter = await s.evalJs(`[...document.querySelectorAll('.v-overlay--active input, .v-overlay--active textarea')].map((e) => ({ type: e.type, value: e.value }))`);
  await s.shot(`1c-confirm-diff-${tag}`);
  out.confirmDialog = d1;
  await s.key("Escape");
  await sleep(400);

  // ---- tab 2: balansi
  s.clearLog();
  await tab("balances");
  const t2 = {};
  await s.shot(`2-balances-${tag}`);
  await s.shot(`2-balances-${tag}-full`, { full: true });
  await s.evalJs(`window.scrollTo(0, 0)`);
  t2.requests = s.mode.log.map((e) => `${e.method} ${e.path}${e.q}`);
  t2.rows = await rows(".global-table tbody tr");
  t2.measure = await measure(s);
  t2.contrast = await scanContrast(s);
  t2.small = await smallTargets(s);
  t2.stops = await tabStops();
  t2.headersFocusable = await s.evalJs(`[...document.querySelectorAll('.global-table th')].map((th) => ({ text: th.textContent.trim(), tabindex: th.getAttribute('tabindex'), role: th.getAttribute('role'), ariaSort: th.getAttribute('aria-sort') }))`);
  t2.rowAttrs = await s.evalJs(`(() => { const tr = document.querySelector('.global-table tbody tr'); return tr ? { tabindex: tr.getAttribute('tabindex'), role: tr.getAttribute('role'), cursor: getComputedStyle(tr).cursor } : null; })()`);
  t2.rowTexts = await texts(s, ".global-table tbody tr");
  t2.toolbar = await s.rectOf(".balance-toolbar");
  out.balances = t2;

  // zero toggle
  await s.click(".balance-zero-toggle input");
  await sleep(400);
  t2.rowsWithZero = (await rows(".global-table tbody tr")).length;
  await s.click(".balance-zero-toggle input");
  await sleep(300);

  // dijalog: detalji kurira
  await s.click(".global-table tbody tr td:first-child");
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`, { timeout: 6000 });
  await sleep(500);
  const d2 = {};
  d2.card = await s.rectOf(".v-overlay--active .v-card");
  d2.contrast = await scanContrast(s, ".v-overlay--active .v-card");
  d2.small = await smallTargets(s, ".v-overlay--active .v-card");
  d2.rows = await texts(s, ".v-overlay--active .detail-row");
  d2.actionsInside = await s.evalJs(`[...document.querySelectorAll('.v-overlay--active button')].map((b) => (b.getAttribute('aria-label') || b.textContent).replace(/\\s+/g,' ').trim())`);
  d2.phoneIsLink = await s.evalJs(`!!document.querySelector('.v-overlay--active a[href^="tel:"]')`);
  await s.shot(`2b-details-dialog-${tag}`);
  out.detailsDialog = d2;
  await s.key("Escape");
  await sleep(400);

  // dijalog: uplata
  await s.click(".row-actions button", { textIncludes: "Uplata" });
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`, { timeout: 6000 });
  await sleep(500);
  const d3 = {};
  d3.card = await s.rectOf(".v-overlay--active .v-card");
  d3.title = (await texts(s, ".v-overlay--active .dialog-title-text"))[0];
  d3.copy = (await texts(s, ".v-overlay--active .action-copy"))[0];
  d3.fields = await s.evalJs(`[...document.querySelectorAll('.v-overlay--active input, .v-overlay--active textarea')].map((e) => ({ type: e.type, value: e.value, label: e.closest('.v-input')?.querySelector('.v-label')?.textContent.trim() }))`);
  d3.contrast = await scanContrast(s, ".v-overlay--active .v-card");
  d3.small = await smallTargets(s, ".v-overlay--active .v-card");
  await s.shot(`2c-receipt-dialog-${tag}`);
  out.receiptDialog = d3;
  await s.key("Escape");
  await sleep(400);

  // dijalog: isplata
  await s.click(".row-actions button", { textIncludes: "Isplata" });
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`, { timeout: 6000 });
  await sleep(500);
  const d4 = {};
  d4.card = await s.rectOf(".v-overlay--active .v-card");
  d4.title = (await texts(s, ".v-overlay--active .dialog-title-text"))[0];
  d4.fields = await s.evalJs(`[...document.querySelectorAll('.v-overlay--active input, .v-overlay--active textarea')].map((e) => ({ type: e.type, value: e.value, label: e.closest('.v-input')?.querySelector('.v-label')?.textContent.trim() }))`);
  await s.shot(`2d-payout-dialog-${tag}`);
  out.payoutDialog = d4;
  await s.key("Escape");
  await sleep(400);

  // ---- tab 3: istorija
  s.clearLog();
  await tab("history");
  const t3 = {};
  await s.shot(`3-history-${tag}`);
  await s.shot(`3-history-${tag}-full`, { full: true });
  await s.evalJs(`window.scrollTo(0, 0)`);
  t3.requests = s.mode.log.map((e) => `${e.method} ${e.path}${e.q}`);
  t3.rows = await rows(".global-table tbody tr");
  t3.measure = await measure(s);
  t3.contrast = await scanContrast(s);
  t3.small = await smallTargets(s);
  t3.stops = await tabStops();
  t3.headers = await texts(s, ".global-table th");
  t3.row0 = (await texts(s, ".global-table tbody tr"))[0];
  t3.filters = await rows(".history-filters");
  t3.chipSize = await s.evalJs(`(() => { const c = document.querySelector('.global-table .v-chip'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), font: getComputedStyle(c).fontSize }; })()`);
  out.history = t3;

  // ---- tab 4: isplate
  s.clearLog();
  await tab("payouts");
  const t4 = {};
  await s.shot(`4-payouts-${tag}`);
  await s.shot(`4-payouts-${tag}-full`, { full: true });
  await s.evalJs(`window.scrollTo(0, 0)`);
  t4.requests = s.mode.log.map((e) => `${e.method} ${e.path}${e.q}`);
  t4.rows = await rows(".global-table tbody tr");
  t4.measure = await measure(s);
  t4.contrast = await scanContrast(s);
  t4.small = await smallTargets(s);
  t4.stops = await tabStops();
  t4.headers = await texts(s, ".global-table th");
  t4.row0 = (await texts(s, ".global-table tbody tr"))[0];
  out.payouts = t4;

  out.console = s.consoleMsgs.filter((m) => /warn|error/i.test(m.type)).map((m) => `${m.type}: ${m.text.slice(0, 160)}`);
  out.exceptions = s.exceptions;
} catch (e) {
  out.error = String(e.stack || e);
  console.error(out.error);
} finally {
  writeFileSync(path.join(dir, `a1-states-${tag}.json`), JSON.stringify(out, null, 1));
  await s.close();
}
console.log("gotovo ->", `a1-states-${tag}.json`);
