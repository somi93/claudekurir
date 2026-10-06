// Provjera da nove provjere imaju zube: vrati stari CSS (poruka na karti preko cijele karte, razmjera s tekstom "shematska karta") i očekuj da padnu.
import { openProto, sleep } from "./lib.mjs";

const UNDO = `.lv:not(.lv-wide) .lv-mnote{bottom:0!important}.lv:not(.lv-wide) .lv-scale span:last-child{display:inline!important}`;
const run = async (width) => {
  const PH = await openProto({ name: "teeth", width, height: 844, dpr: 2, mobile: true, url: new URL("phone.html", import.meta.url).href });
  const pev = PH.ev;
  const boot = async (opts) => { await pev(`fresh('p', ${JSON.stringify({ wide: false, pollMs: 60000, ordersMs: 60000, slowMs: 60000, ...opts })})`); await PH.waitFor("A('p').ctx.ready", { timeout: 15000 }); await sleep(900); };
  const bits = () => pev(`(() => { const r = (s) => { const e = document.querySelector('#p ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; }; return { note: r('.lv-mnote > div'), leg: r('.lv-leg > button'), scale: r('.lv-scale'), panel: r('.lv-panel') }; })()`);
  const hit = (a, b) => !!(a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t);
  try {
    await pev(`(() => { const s = document.createElement('style'); s.id = 'undo'; s.textContent = ${JSON.stringify(UNDO)}; document.head.appendChild(s); return true; })()`);
    await boot({ fail: "rows", snap: "half" });
    const b = await bits();
    console.log(`${width}px  poruka iza lista: ${b.note.b > b.panel.t + 1}  (poruka do ${b.note.b}, list od ${b.panel.t});  poruka ~ legenda/razmjera: ${hit(b.note, b.leg) || hit(b.note, b.scale)}`);
    await boot({ snap: "half" });
    const bad = [];
    for (let z = 10; z <= 17; z += 0.5) {
      await pev(`(() => { const m = A('p').ctx.parts.map; m.setView({ cx: m.view.cx, cy: m.view.cy, z: ${z} }); return true; })()`);
      await sleep(120);
      const x = await bits();
      if (hit(x.leg, x.scale)) bad.push(z);
    }
    console.log(`${width}px  zumovi na kojima se razmjera i legenda dodiruju (stari CSS): ${bad.join(", ") || "nijedan"}`);
  } finally { await PH.close(); }
};
await run(390);
await run(320);
