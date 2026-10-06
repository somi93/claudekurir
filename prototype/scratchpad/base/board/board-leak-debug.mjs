// Zašto u tabli nema dugmeta „Potvrdi“ poslije otvaranja detalja? Isti koraci u dev.html i u tabli, ispis stanja.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openProto, sleep, here } from "./plib.mjs";

const boardUrl = pathToFileURL(path.join(here, "board.preview.html")).href;
async function run(label, url, scope) {
  const P = await openProto({ name: "board-leak", width: 1440, height: 900, dpr: 1, url });
  try {
    await sleep(url ? 3500 : 1200);
    const info = async (tag) => {
      const r = await P.ev(`(() => {
        const root = document.querySelector(${JSON.stringify(scope)});
        const acts = {};
        for (const e of root.querySelectorAll('[data-act]')) { const a = e.getAttribute('data-act'); acts[a] = (acts[a] || 0) + 1; }
        const st = window.A ? (window.A('d') && window.A('d').st) : null;
        const h1 = root.querySelector('#fc-h1'), h2 = root.querySelector('#fc-dh2');
        return { acts, h1: h1 ? h1.textContent.trim().slice(0, 40) : null, h2: h2 ? h2.textContent.trim().slice(0, 40) : null, sel: st ? st.sel : 'n/a', sheet: st ? (st.sheet && st.sheet.type) : 'n/a' };
      })()`);
      console.log(label, tag, JSON.stringify(r));
    };
    await info("početno");
    const first = await P.ev(`(() => { const e = document.querySelector(${JSON.stringify(scope + " [data-act=open]")}); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40), cls: e.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), inQueue: !!e.closest('.fc-q, .fc-queue') }; })()`);
    console.log(label, "prvi [data-act=open]:", JSON.stringify(first));
    await P.click(scope + " [data-act=open]", { wait: 500 });
    await info("poslije klika");
  } finally { await P.close(); }
}
await run("dev  ", undefined, ".fc");
await run("tabla", boardUrl, "#proto-d .fc");
