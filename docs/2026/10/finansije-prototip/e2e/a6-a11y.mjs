// A6: semantika stranice Finansije "prije": tablist/tabpanel, naslov, tabela, dijalog, URL stanje, zaglavlje bez firme.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./fh.mjs";

const out = {};
const s = await session("a6", { width: 1440, height: 900, dpr: 1, mobile: false });
try {
  await s.load("/dispatcher/finance", { wait: ".handover-row", extra: 600 });
  await s.idle(500);
  out.shell = await s.evalJs(`(() => {
    const tl = document.querySelector('[role=tablist]');
    return {
      title: document.title,
      h1: [...document.querySelectorAll('h1, [role=heading][aria-level="1"]')].map((e) => e.textContent.trim()),
      tablistLabel: tl?.getAttribute('aria-label') ?? null,
      tabControls: [...document.querySelectorAll('[role=tab]')].map((t) => t.getAttribute('aria-controls')),
      tabpanel: !!document.querySelector('[role=tabpanel]'),
      main: !!document.querySelector('main, [role=main]'),
      headerText: document.querySelector('.page-header')?.textContent.replace(/\\s+/g,' ').trim(),
      companyInHeader: /Ordera Dostava|Glovo/.test(document.querySelector('.page-header')?.textContent ?? ''),
      handoverRowRole: document.querySelector('.handover-row')?.getAttribute('role'),
    };
  })()`);
  await s.load("/dispatcher/finance?tab=balances", { wait: ".global-tab-bar", extra: 800 });
  out.urlTab = await s.evalJs(`document.querySelector('[role=tab][aria-selected=true]')?.dataset.tab`);
  await s.click("[role=tab][data-tab=history]"); await sleep(400);
  out.urlAfterClick = await s.evalJs(`location.pathname + location.search`);
  out.table = await s.evalJs(`(() => { const t = document.querySelector('.global-table'); return { caption: !!t?.querySelector('caption'), ariaLabel: t?.getAttribute('aria-label') ?? null, thScope: [...document.querySelectorAll('.global-table th')].map((h) => h.getAttribute('scope')) }; })()`);
  await s.click("[role=tab][data-tab=handovers]"); await sleep(400);
  await s.click(".handover-row button");
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`);
  await sleep(500);
  out.dialog = await s.evalJs(`(() => { const c = document.querySelector('.v-overlay--active [role=dialog]') || document.querySelector('.v-overlay--active .v-overlay__content'); return { role: c?.getAttribute('role'), modal: c?.getAttribute('aria-modal'), labelledby: c?.getAttribute('aria-labelledby'), label: c?.getAttribute('aria-label') }; })()`);
  await s.key("Escape"); await sleep(500);
  out.focusAfterClose = await s.evalJs(`(() => { const e = document.activeElement; return e ? e.tagName.toLowerCase() + ':' + (e.textContent || '').trim().slice(0, 20) : null; })()`);
} catch (e) {
  out.error = String(e.stack || e);
} finally {
  writeFileSync(path.join(dir, "a6-a11y.json"), JSON.stringify(out, null, 1));
  await s.close();
}
console.log(JSON.stringify(out, null, 1));
