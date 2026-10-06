// Brzi snimak dev.html (računar + telefon) i ispis grešaka iz konzole.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "../e2e/cdp.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.resolve(here, "..", "shots", "proto");
fs.mkdirSync(shots, { recursive: true });
const name = process.argv[2] || "dev";
const wait = Number(process.argv[3] || 2500);
const b = await launch({ shotsDir: shots, width: 1480, height: 1800, dpr: 1, mobile: false });
try {
  await b.goto(pathToFileURL(path.join(here, process.env.PAGE || "dev.html")).href);
  await b.waitFor("window.__apps && window.__apps.length > 0", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, wait));
  const clip = async (sel, file) => {
    const r = await b.evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`);
    const res = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    fs.writeFileSync(path.join(shots, file + ".png"), Buffer.from(res.data, "base64"));
  };
  await clip("#d", name + "-d");
  if (await b.evalJs(`!!document.querySelector('#p')`)) await clip("#p", name + "-p");
  console.log("konzola:", b.consoleMsgs.filter((m) => /error|warn/.test(m.type)).map((m) => `${m.type}: ${m.text.slice(0, 200)}`).join("\n") || "(čisto)");
  console.log("izuzeci:", b.exceptions.map((e) => (e.text || "").slice(0, 300)).join("\n") || "(nema)");
} finally { await b.close(); }
