// A3b: šta se vidi KADAR PO KADAR dok se Finansije učitavaju (realna kašnjenja API-ja).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./fh.mjs";

const REC = `(() => {
  window.__frames = [];
  const sample = () => {
    const c = document.querySelector('.global-card');
    const txt = c ? c.textContent.replace(/\\s+/g,' ').trim().slice(0, 140) : '(nema kartice)';
    const rows = document.querySelectorAll('.handover-row, .global-table tbody tr').length;
    const sk = !!document.querySelector('.table-skeleton');
    const key = txt + '|' + rows + '|' + sk;
    const last = window.__frames[window.__frames.length - 1];
    if (!last || last.key !== key) window.__frames.push({ t: Math.round(performance.now()), key, txt, rows, skeleton: sk });
    requestAnimationFrame(sample);
  };
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(sample));
})()`;

const out = {};
const s = await session("a3b", { width: 1440, height: 900, dpr: 1, mobile: false });
try {
  await s.send("Page.addScriptToEvaluateOnNewDocument", { source: REC });
  s.setFlags({
    delays: [
      { re: /GET \/me$/, ms: 250 },
      { re: /GET \/dispatcher\/my-companies/, ms: 250 },
      { re: /GET \/dispatcher\/delivery-companies\/\d+\/finance-settings/, ms: 150 },
      { re: /GET \/dispatcher\/delivery-companies\/\d+\/couriers-status/, ms: 300 },
      { re: /GET \/dispatcher\/delivery-companies\/\d+\/cash-handovers\/pending/, ms: 500 },
      { re: /GET \/dispatcher\/delivery-companies\/\d+\/couriers-balance/, ms: 600 },
      { re: /GET \/dispatcher\/delivery-companies\/\d+\/cash-handovers$/, ms: 600 },
      { re: /GET \/dispatcher\/delivery-companies\/\d+\/payouts/, ms: 600 },
    ],
  });
  await s.load("/dispatcher/finance", { wait: ".handover-row", extra: 400 });
  out.initial = await s.evalJs(`window.__frames`);
  // balansi
  await s.evalJs(`window.__frames = []`);
  await s.click("[role=tab][data-tab=balances]");
  await sleep(1600);
  out.balances = await s.evalJs(`window.__frames`);
  await s.evalJs(`window.__frames = []`);
  await s.click("[role=tab][data-tab=history]");
  await sleep(1600);
  out.history = await s.evalJs(`window.__frames`);
} catch (e) {
  out.error = String(e.stack || e);
} finally {
  writeFileSync(path.join(dir, "a3b-load.json"), JSON.stringify(out, null, 1));
  await s.close();
}
const show = (name, frames) => { console.log("\n##", name); for (const f of frames ?? []) console.log(String(f.t).padStart(6), "ms |", `rows=${f.rows} skel=${f.skeleton}`, "|", f.txt.slice(0, 110)); };
show("initial (ms od početka navigacije)", out.initial);
show("balances (ms od klika)", out.balances);
show("history (ms od klika)", out.history);
if (out.error) console.log(out.error);
