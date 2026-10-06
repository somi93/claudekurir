// Više snimaka prototipa u jednom pokretanju Chrome-a: node multishot.mjs scenariji.json
import { launch } from "../e2e/cdp.mjs";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), "utf8"));
const b = await launch({ shotsDir: path.join(here, "..", "shots", "dev"), width: 1480, height: 960, dpr: 1, mobile: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.goto(pathToFileURL(path.join(here, "dev.html")).href);
  await sleep(800);
  for (const sc of list) {
    const wide = sc.mode !== "phone";
    const id = wide ? "d" : "p";
    await b.evalJs(`document.getElementById('d').style.display='${wide ? "block" : "none"}'; document.getElementById('p').style.display='${wide ? "none" : "block"}'; 1`);
    await b.evalJs(`fresh('${id}', ${JSON.stringify({ wide, ...(sc.opts || {}) })}); 1`);
    await sleep(sc.wait || 900);
    if (sc.js) { const r = await b.evalJs(`(async () => { ${sc.js} })()`); if (r != null) console.log(sc.name, "js ->", JSON.stringify(r).slice(0, 300)); }
    await sleep(sc.after || 600);
    const rect = await b.evalJs(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
    const res = await b.send("Page.captureScreenshot", { format: "png", clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 }, captureBeyondViewport: true });
    fs.writeFileSync(path.join(here, "..", "shots", "dev", `${sc.name}.png`), Buffer.from(res.data, "base64"));
    console.log("snimak", sc.name);
  }
  console.log("izuzeci:", JSON.stringify(b.exceptions.map((e) => String(e.text).slice(0, 300))));
  console.log("konzola:", JSON.stringify(b.consoleMsgs.filter((m) => /error|warn/.test(m.type)).map((m) => m.text.slice(0, 200))));
} finally { await b.close(); }
