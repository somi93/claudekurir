import { openProto, sleep } from "./lib.mjs";
const P = await openProto({ name: "dbg", width: 390, height: 844, dpr: 2, mobile: true, url: new URL("phone.html", import.meta.url).href });
await P.ev(`fresh('p', { wide: false, pollMs: 60000, ordersMs: 60000, slowMs: 60000 })`); await P.waitFor("A('p').ctx.ready"); await sleep(800);
console.log(JSON.stringify(await P.ev(`(() => { const t = document.querySelector('#p .lv-tiles'); const cs = getComputedStyle(t); return { sw: t.scrollWidth, cw: t.clientWidth, h: t.getBoundingClientRect().height, display: cs.display, ov: cs.overflowX, tiles: [...t.children].map((e) => Math.round(e.getBoundingClientRect().width)), wide: document.querySelector('#p .lv').className }; })()`)));
await P.close();
