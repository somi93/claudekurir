// Snimci table (računar ili telefon, svijetla ili tamna tema): node board-shot.mjs <ime> [desk|phone] [light|dark]
import fs from "node:fs";
import path from "node:path";
import { openProto, sleep, here } from "./plib.mjs";
import { pathToFileURL } from "node:url";

const [name = "b", mode = "desk", theme = "light"] = process.argv.slice(2);
const phone = mode === "phone";
const P = await openProto({ name: "board", width: phone ? 390 : 1440, height: phone ? 844 : 900, mobile: phone, dpr: 1, url: pathToFileURL(path.join(here, "board.preview.html")).href });
try {
  if (theme === "dark") await P.b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  else await P.b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await P.ev(`document.documentElement.setAttribute('data-theme', '${theme}'); 1`);
  await sleep(3500);
  const info = await P.ev(`({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, vw: innerWidth, imgs: [...document.images].map((i) => i.naturalWidth > 0), frames: document.querySelectorAll('[data-fx] .fc').length, fxTotal: document.querySelectorAll('[data-fx]').length, rawM: /__M_|__IMG_/.test(document.body.innerHTML) })`);
  console.log(JSON.stringify({ ...info, imgs: info.imgs.length + " slika, ucitano " + info.imgs.filter(Boolean).length }));
  const secs = await P.ev(`[...document.querySelectorAll('header.top, section.facts, section.sec')].map((e) => ({ id: e.id || e.className, y: Math.round(e.getBoundingClientRect().top + scrollY), h: Math.round(e.getBoundingClientRect().height) }))`);
  console.log(JSON.stringify(secs));
  const which = (process.env.SECS || "").split(",").filter(Boolean);
  for (const s of secs) {
    if (which.length && !which.includes(s.id)) continue;
    const off = Math.min(Number(process.env.OFFY || 0), Math.max(0, s.h - 50));
    const h = Math.min(s.h - off, Number(process.env.MAXH || 2400));
    const r = await P.b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: s.y + off, width: phone ? 390 : 1440, height: h, scale: 1 } });
    const f = path.join(here, "..", "shots", "board-look", `${name}-${s.id || "x"}${off ? "-" + off : ""}.png`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(r.data, "base64"));
  }
  for (const [i, sel] of (process.env.CSEL || "").split("|").filter(Boolean).entries()) {
    const r0 = await P.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);
    if (!r0) { console.log("nema", sel); continue; }
    const r = await P.b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: r0.x, y: r0.y, width: r0.w, height: Math.min(r0.h, Number(process.env.MAXH || 2400)), scale: 1 } });
    const f = path.join(here, "..", "shots", "board-look", `${name}-sel${i}.png`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(r.data, "base64"));
    console.log("snimak", f);
  }
  console.log("izuzeci:", JSON.stringify(P.b.exceptions.map((e) => String(e.text).slice(0, 200))));
  console.log("greške konzole:", JSON.stringify(P.b.consoleMsgs.filter((m) => /error/.test(m.type)).map((m) => m.text.slice(0, 200))));
} finally { await P.close(); }
