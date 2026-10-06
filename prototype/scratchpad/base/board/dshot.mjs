// Brzi snimak prototipa (dev.html): node dshot.mjs <ime> [js koji se izvrši prije snimka] [wide|phone]
import { launch } from "../e2e/cdp.mjs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const [name = "x", js = "", mode = "wide"] = process.argv.slice(2);
const wide = mode !== "phone";
const b = await launch({ shotsDir: path.join(here, "..", "shots", "dev"), width: wide ? 1480 : 420, height: wide ? 960 : 820, dpr: 1, mobile: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
b.ws?.on?.("x", () => {});
try {
  await b.goto(pathToFileURL(path.join(here, "dev.html")).href);
  await sleep(900);
  const errs = [];
  await b.evalJs(`document.getElementById('${wide ? "p" : "d"}').style.display='none'; 1`);
  if (js) { const r = await b.evalJs(js); if (r !== undefined && r !== null) console.log("js ->", JSON.stringify(r).slice(0, 400)); }
  await sleep(700);
  const sel = wide ? "#d" : "#p";
  const rect = await b.evalJs(`(() => { const e = document.querySelector('${sel}'); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const res = await b.send("Page.captureScreenshot", { format: "png", clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale: 1 }, captureBeyondViewport: true });
  const f = path.join(here, "..", "shots", "dev", `${name}.png`);
  (await import("node:fs")).mkdirSync(path.dirname(f), { recursive: true });
  (await import("node:fs")).writeFileSync(f, Buffer.from(res.data, "base64"));
  console.log("snimak:", f);
  console.log("izuzeci:", JSON.stringify(b.exceptions.map((e) => String(e.text).slice(0, 300))));
  console.log("konzola:", JSON.stringify(b.consoleMsgs.filter((m) => /error|warn/.test(m.type)).map((m) => m.text.slice(0, 200))));
} finally { await b.close(); }
