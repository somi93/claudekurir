// "PRIJE" 6: telefon 390x844 - raspored, izbor kurira, gdje završi kartica, da li se mapa vidi poslije izbora.
import fs from "node:fs";
import path from "node:path";
import { session, sleep, out } from "./lh.mjs";

const M = {};
const s = await session("before", { width: 390, height: 844, dpr: 2, mobile: true });
const rect = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), h: Math.round(b.height), w: Math.round(b.width), b: Math.round(b.bottom + scrollY), vy: Math.round(b.top), vb: Math.round(b.bottom) }; })()`;
const tap = async (sel, nth = 0) => {
  const r = await s.evalJs(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await sleep(120);
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(250);
};
try {
  await s.load("/dispatcher", { wait: ".courier-item", timeout: 120000 });
  await s.idle(800, 30000);
  await sleep(2500);
  M.layout = await s.evalJs(`(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top + scrollY), h: Math.round(b.height), w: Math.round(b.width), b: Math.round(b.bottom + scrollY) }; };
    return { appbar: r('.dispatcher-app-bar'), header: r('.page-header'), pills: r('.status-filter'), map: r('.map-card'), side: r('.sidebar-card'), list: r('.courier-list'), hint: r('.hint-copy'), scrollH: document.documentElement.scrollHeight, innerH: innerHeight, innerW: innerWidth,
      headerBtns: [...document.querySelectorAll('.page-header button, .page-header a')].map((e) => [e.innerText.trim(), Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]),
      pillRects: [...document.querySelectorAll('.status-chip')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; }),
      sticky: getComputedStyle(document.querySelector('.page-header')).position,
      rowsInFirstScreen: [...document.querySelectorAll('.courier-item')].filter((e) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }).length };
  })()`);
  console.log(JSON.stringify(M.layout));
  await s.shot("b6-phone-top");

  // tap na red u listi (korisnik je morao da skroluje do liste)
  await tap(".courier-item", 1);
  await sleep(2500);
  M.afterRowTap = await s.evalJs(`(() => {
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); const v = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)); return { visiblePx: Math.round(v), of: Math.round(b.height), top: Math.round(b.top) }; };
    return { map: vis('.map-card'), card: vis('.selected-card'), scrollY: Math.round(scrollY), scrollH: document.documentElement.scrollHeight };
  })()`);
  console.log("poslije dodira na red:", JSON.stringify(M.afterRowTap));
  await s.shot("b6-phone-after-row");

  // skroluj do vrha: da li je marker izabranog u vidu (mapa je poletjela)
  await s.evalJs(`window.scrollTo(0, 0)`);
  await sleep(600);
  await s.shot("b6-phone-map-after");
  fs.writeFileSync(path.join(out, "b6.json"), JSON.stringify(M, null, 1));
} finally {
  await s.close();
}
console.log("gotovo");
