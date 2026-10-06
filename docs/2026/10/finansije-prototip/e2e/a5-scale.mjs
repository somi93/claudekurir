// A5: skala "prije": 500 kurira, 500 predaja, 300 isplata - DOM, vrijeme prikaza, odziv pretrage (4x CPU).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./fh.mjs";

const out = {};
const s = await session("a5", { width: 1440, height: 900, dpr: 1, mobile: false, n: 500, fin: { nHistory: 500, nPayouts: 300 } });
s.__name = "a5";
const nodes = () => s.evalJs(`document.getElementsByTagName('*').length`);
const rows = () => s.evalJs(`document.querySelectorAll('.global-table tbody tr').length`);
const tab = async (key) => { const t = Date.now(); await s.click(`[role=tab][data-tab="${key}"]`, { wait: 0 }); await s.waitFor(`document.querySelectorAll('.global-table tbody tr').length > 20`, { timeout: 20000, interval: 30 }); return Date.now() - t; };
try {
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 1000 });
  await s.idle(800);
  out.initialNodes = await nodes();
  for (const rate of [1, 4]) {
    await s.send("Emulation.setCPUThrottlingRate", { rate });
    const r = {};
    r.balancesMs = await tab("balances"); await sleep(600);
    r.balancesRows = await rows(); r.balancesNodes = await nodes();
    // pretraga: kucanje 3 znaka, mjeri se vrijeme do stabilnog broja redova
    await s.click(".balance-search input");
    const t1 = Date.now();
    await s.typeText("ha", 0);
    await s.waitFor(`document.querySelectorAll('.global-table tbody tr').length < ${r.balancesRows}`, { timeout: 10000, interval: 20 }).catch(() => {});
    r.searchMs = Date.now() - t1; r.searchRows = await rows();
    await s.clearField(".balance-search input"); await sleep(400);
    // prekidač "Prikaži i nulte" -> svi redovi
    const t2 = Date.now();
    await s.click(".balance-zero-toggle input", { wait: 0 });
    await s.waitFor(`document.querySelectorAll('.global-table tbody tr').length > ${r.balancesRows}`, { timeout: 20000, interval: 30 }).catch(() => {});
    r.zeroToggleMs = Date.now() - t2; r.allRows = await rows(); r.allNodes = await nodes();
    await s.click(".balance-zero-toggle input", { wait: 0 }); await sleep(400);
    r.historyMs = await tab("history"); await sleep(600); r.historyRows = await rows(); r.historyNodes = await nodes();
    r.payoutsMs = await tab("payouts"); await sleep(600); r.payoutsRows = await rows(); r.payoutsNodes = await nodes();
    out[`cpu${rate}x`] = r;
  }
  await s.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  out.longTaskMs = await s.evalJs(`Math.round(window.__long)`);
  out.cls = await s.evalJs(`Math.round(window.__cls * 1000) / 1000`);
} catch (e) {
  out.error = String(e.stack || e);
} finally {
  writeFileSync(path.join(dir, "a5-scale.json"), JSON.stringify(out, null, 1));
  await s.close();
}
console.log(JSON.stringify(out, null, 1));
