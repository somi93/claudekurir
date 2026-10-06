// Prototip "Kuriri uživo": skaliranje 26 / 150 / 500 kurira - DOM, vrijeme do prikaza, klasteri, odziv uz procesor 4x sporiji (pretraga, filter, pomjeranje i zum karte).
import fs from "node:fs";
import { openProto, check, summary, sleep } from "./lib.mjs";

const out = {};
const P = await openProto({ name: "t4", width: 1480, height: 1000, dpr: 1 });
const { ev, click, waitFor } = P;
await P.b.send("Performance.enable");
const metric = async () => Object.fromEntries((await P.b.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

for (const n of [26, 150, 500]) {
  const m0 = await metric();
  const t0 = Date.now();
  await ev(`fresh('d', ${JSON.stringify({ n, pollMs: 60000, ordersMs: 60000, slowMs: 60000 })})`);
  await waitFor("A('d').ctx.ready", { timeout: 30000 });
  const tReady = Date.now() - t0;
  await sleep(900);
  const m1 = await metric();
  const r = { n, withPosition: await ev(`A('d').world.locations().length`), msReady: tReady,
    nodes: await ev(`document.querySelectorAll('#d *').length`),
    rows: await ev(`document.querySelectorAll('#d .lv-row').length`),
    markers: await ev(`document.querySelectorAll('#d .lv-mk').length`),
    clusters: await ev(`document.querySelectorAll('#d .lv-cl').length`),
    heapMB: Math.round(m1.JSHeapUsedSize / 1048576), scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000), layoutMs: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000) };
  const box0 = await ev(`(() => { const r = document.querySelector('#d .lv-map').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const zx = box0.x + box0.w * 0.5, zy = box0.y + box0.h * 0.5;
  const tz = Date.now();
  for (let i = 0; i < 10; i++) await P.b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: zx, y: zy, deltaX: 0, deltaY: i % 2 ? 120 : -120 });
  r.zoomStep1x = Math.round(((Date.now() - tz) / 10) * 10) / 10;
  await P.b.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // pretraga: tri slova
  await click("#d #lv-q");
  const t1 = Date.now();
  await P.typeText("mar", 5);
  r.search4x = Date.now() - t1;
  await ev(`(() => { const i = document.querySelector('#d #lv-q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await sleep(500);
  // filter stanja
  const t2 = Date.now();
  await click("#d .lv-tile", { nth: 1, wait: 0 });
  for (;;) { if (await ev(`document.querySelectorAll('#d .lv-tile')[1].getAttribute('aria-pressed') === 'true'`)) break; await sleep(5); if (Date.now() - t2 > 5000) break; }
  r.filter4x = Date.now() - t2;
  await click("#d .lv-tile", { nth: 0, wait: 300 });
  // pomjeranje karte: 40 koraka misa, mjeri se prosječno vrijeme koraka
  const box = await ev(`(() => { const r = document.querySelector('#d .lv-map').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const sx = box.x + box.w * 0.5, sy = box.y + box.h * 0.5;
  await P.b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: sx, y: sy, button: "left", buttons: 1, clickCount: 1 });
  const t3 = Date.now();
  for (let i = 1; i <= 40; i++) await P.b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: sx + i * 6, y: sy + i * 3, buttons: 1 });
  r.panStep4x = Math.round(((Date.now() - t3) / 40) * 10) / 10;
  await P.b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: sx + 240, y: sy + 120, button: "left", buttons: 0, clickCount: 1 });
  await sleep(300);
  // zum točkićem: 10 koraka
  const t4 = Date.now();
  for (let i = 0; i < 10; i++) await P.b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: sx, y: sy, deltaX: 0, deltaY: i % 2 ? 120 : -120 });
  r.zoomStep4x = Math.round(((Date.now() - t4) / 10) * 10) / 10;
  await P.b.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  out["n" + n] = r;
  console.log(JSON.stringify(r));
}

check("500 kurira: prikaz za manje od 3 s", out.n500.msReady < 3000, `${out.n500.msReady} ms`);
check("500 kurira: DOM ispod 3000 čvorova", out.n500.nodes < 3000, `${out.n500.nodes}`);
check("500 kurira, 4x: pomjeranje karte ispod 30 ms po koraku", out.n500.panStep4x < 30, `${out.n500.panStep4x} ms`);
check("500 kurira: zum ispod 40 ms po koraku (običan procesor; 4x sporiji: " + out.n500.zoomStep4x + " ms)", out.n500.zoomStep1x < 40, `${out.n500.zoomStep1x} ms`);
check("500 kurira, 4x: tri slova u pretragu ispod 900 ms", out.n500.search4x < 900, `${out.n500.search4x} ms`);
fs.mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../out/t4.json", import.meta.url), JSON.stringify(out, null, 1));
const failed = summary();
await P.close();
process.exit(failed ? 1 : 0);
