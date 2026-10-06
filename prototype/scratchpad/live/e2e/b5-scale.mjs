// "PRIJE" 5: skaliranje - 26 / 150 / 500 kurira: DOM, vrijeme do redova, markeri, odziv uz procesor 4x sporiji.
import fs from "node:fs";
import path from "node:path";
import { session, sleep, out } from "./lh.mjs";

const M = {};
for (const n of [26, 150, 500]) {
  const s = await session("before", { width: 1440, height: 900, n });
  try {
    await s.send("Performance.enable");
    const metric = async () => Object.fromEntries((await s.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    const m0 = await metric();
    const t0 = Date.now();
    await s.load("/dispatcher", { wait: ".courier-item", timeout: 180000 });
    const tRows = Date.now() - t0;
    await s.idle(800, 30000);
    await sleep(2500);
    const m1 = await metric();
    const r = {
      n,
      withPosition: s.W.locations().length,
      msToFirstRow: tRows,
      domNodes: await s.evalJs(`document.getElementsByTagName('*').length`),
      rows: await s.count(".courier-item"),
      markers: await s.count("path.leaflet-interactive"),
      heapMB: Math.round(m1.JSHeapUsedSize / 1048576),
      scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
      layoutMs: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000),
      more: await s.evalJs(`(document.querySelector('.list-more') || {}).textContent || null`),
    };
    // odziv uz procesor 4x sporiji
    await s.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const until = async (js, timeout = 15000) => { const t = Date.now(); for (;;) { if (await s.evalJs(js)) return Date.now() - t; if (Date.now() - t > timeout) return -1; await sleep(15); } };
    const startRows = r.rows;
    await s.focusSel(".courier-search input");
    const tt = Date.now();
    await s.typeText("mar", 5);
    r.search4x_ms = await until(`document.querySelectorAll('.courier-item').length !== ${startRows} || !!document.querySelector('.v-empty-state, .empty-state')`);
    r.search4x_total_ms = Date.now() - tt;
    // očisti
    await s.evalJs(`(() => { const i = document.querySelector('.courier-search input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(500);
    const t1 = Date.now();
    await s.click(".status-chip", { nth: 1, scroll: false, wait: 0 });
    r.pill4x_ms = await until(`[...document.querySelectorAll('.status-chip')][1].classList.contains('active') && document.querySelectorAll('.courier-item').length > 0`);
    await s.click(".status-chip", { nth: 0, scroll: false, wait: 0 });
    await sleep(400);
    const t2 = Date.now();
    await s.click(".courier-item", { nth: 0, scroll: false, wait: 0 });
    r.select4x_ms = await until(`!!document.querySelector('.selected-card')`);
    await s.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    M["n" + n] = r;
    console.log(JSON.stringify(r));
  } finally {
    await s.close();
  }
}
fs.writeFileSync(path.join(out, "b5.json"), JSON.stringify(M, null, 1));
console.log("gotovo");
