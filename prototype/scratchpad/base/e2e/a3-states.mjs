// A3: stanja stranice Finansije "prije": greška izvora, prazno, učitavanje, "opasni" podaci.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./fh.mjs";
import { texts } from "./ff.mjs";

const out = {};
const run = async (name, opts, fn) => {
  const s = await session(`a3-${name}`, { width: 1440, height: 900, dpr: 1, mobile: false, ...opts.session });
  s.__name = `a3-${name}`;
  try {
    opts.pre?.(s);
    const r = await fn(s);
    out[name] = { ...r, exceptions: s.exceptions.map((e) => String(e.text).slice(0, 200)) };
  } catch (e) {
    out[name] = { error: String(e.stack || e).slice(0, 400) };
  } finally {
    await s.close();
  }
};
const tab = async (s, key) => { await s.click(`[role=tab][data-tab="${key}"]`); await s.idle(500); await sleep(500); };
const cardText = (s) => s.evalJs(`(() => { const c = document.querySelector('.global-card'); return c ? c.textContent.replace(/\\s+/g,' ').trim().slice(0, 260) : null; })()`);
const alertText = (s) => s.evalJs(`[...document.querySelectorAll('.page-alert')].map((e) => e.textContent.replace(/\\s+/g,' ').trim())`);
const fail = (re) => ({ fails: [{ re, status: 500, times: 999, body: { message: "Server Error" } }] });

// ---- greške izvora
await run("fail-pending", {}, async (s) => {
  s.setFlags(fail(/GET \/dispatcher\/delivery-companies\/\d+\/cash-handovers\/pending/));
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  await s.shot("pending-fail");
  return { card: await cardText(s), alerts: await alertText(s), badge: await s.evalJs(`document.querySelector('.tab-pill-badge')?.textContent.trim() ?? null`), retryButton: await s.evalJs(`[...document.querySelectorAll('button')].some((b) => /ponovo/i.test(b.textContent))`) };
});
await run("fail-balance", {}, async (s) => {
  s.setFlags(fail(/GET \/dispatcher\/delivery-companies\/\d+\/couriers-balance/));
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  await tab(s, "balances");
  await s.shot("balance-fail");
  return { card: await cardText(s), alerts: await alertText(s), retryButton: await s.evalJs(`[...document.querySelectorAll('button')].some((b) => /ponovo/i.test(b.textContent))`) };
});
await run("fail-history", {}, async (s) => {
  s.setFlags(fail(/GET \/dispatcher\/delivery-companies\/\d+\/cash-handovers$/));
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  await tab(s, "history");
  await s.shot("history-fail");
  return { card: await cardText(s), alerts: await alertText(s) };
});
await run("fail-payouts", {}, async (s) => {
  s.setFlags(fail(/GET \/dispatcher\/delivery-companies\/\d+\/payouts/));
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  await tab(s, "payouts");
  return { card: await cardText(s), alerts: await alertText(s) };
});
await run("fail-couriers-status", {}, async (s) => {
  s.setFlags(fail(/GET \/dispatcher\/delivery-companies\/\d+\/couriers-status/));
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  await s.shot("status-fail");
  const first = await s.evalJs(`[...document.querySelectorAll('.handover-courier')].map((e) => e.textContent.trim())`);
  return { handoverNames: first, alerts: await alertText(s) };
});

// ---- prazno
await run("empty", {}, async (s) => {
  s.mode.fin.pendingRows.length = 0;
  s.mode.fin.history.length = 0;
  s.mode.fin.payouts.length = 0;
  s.mode.fin.balances.length = 0;
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  const r = { pending: await cardText(s) };
  await s.shot("empty-pending");
  await tab(s, "balances"); r.balances = await cardText(s); await s.shot("empty-balances");
  await tab(s, "history"); r.history = await cardText(s);
  await tab(s, "payouts"); r.payouts = await cardText(s);
  return r;
});

// ---- sve na nuli (svi kuriri 0/0): poruka + toggle
await run("all-zero", {}, async (s) => {
  for (const b of s.mode.fin.balances) { b.cash_owed_to_company = 0; b.wage_owed_to_courier = 0; }
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  await tab(s, "balances");
  return { card: await cardText(s) };
});

// ---- učitavanje (sporo): šta se vidi u prvih 500 ms
await run("loading", {}, async (s) => {
  s.setFlags({ delays: [{ re: /GET \/dispatcher\/delivery-companies\/\d+\/(cash-handovers\/pending|couriers-balance|cash-handovers$|payouts)/, ms: 1800 }] });
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 300 });
  const r = { pending: await cardText(s), loadingEmptyStateIcon: await s.evalJs(`!!document.querySelector('.empty-state .mdi-timer-sand')`) };
  await s.shot("loading-pending");
  await s.click("[role=tab][data-tab=balances]"); await sleep(400);
  r.balances = { skeleton: await s.evalJs(`!!document.querySelector('.table-skeleton')`), skeletonRows: await s.evalJs(`document.querySelectorAll('.table-skeleton .v-skeleton-loader').length`), emptyShownWhileLoading: await s.evalJs(`!!document.querySelector('.empty-state')` ) };
  await s.shot("loading-balances");
  await sleep(2200);
  return r;
});

// ---- opasni podaci: iznosi kao tekst
await run("hostile-strings", {}, async (s) => {
  s.mode.fin.flags.balanceStrings = true;
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 }); await s.idle(600);
  await tab(s, "balances");
  const rows = await s.evalJs(`document.querySelectorAll('.global-table tbody tr').length`);
  const body = await cardText(s);
  await s.shot("hostile-strings");
  return { rows, body, appBlank: await s.evalJs(`document.querySelector('.global-page') === null`) };
});

writeFileSync(path.join(dir, "a3-states.json"), JSON.stringify(out, null, 1));
console.log("gotovo -> a3-states.json");
