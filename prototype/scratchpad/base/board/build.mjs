// Sklapa tablu: board.css + app.css + b1..b5 + skripte + snimci (webp, data URI) + mjerenja. Izlaz: board.html (za Artifact) i board.preview.html (za lokalnu provjeru).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.resolve(process.env.REPO_ROOT || "H:/projects/bosna/dostavljaci-front", "package.json"));
const sharp = req("sharp");
const read = (f) => fs.readFileSync(path.join(here, f), "utf8");

// --- snimci: PNG -> WebP (računar 1176 px, telefon 585 px); dugi snimci se režu na prvi dio ---
const shotsIn = path.resolve(here, "..", "shots", "board");
const shotsOut = path.resolve(here, "..", "shots", "board-webp");
fs.mkdirSync(shotsOut, { recursive: true });
const CROP = { "d-history": 1150, "d-payouts": 1150, "p-balances": 1900, "p-history": 1900, "p-handovers": 1900 };
for (const f of fs.readdirSync(shotsIn).filter((x) => x.endsWith(".png"))) {
  const name = f.replace(/\.png$/, "");
  const phone = name.startsWith("p-");
  let img = sharp(path.join(shotsIn, f));
  const meta = await img.metadata();
  if (CROP[name] && meta.height > CROP[name]) img = sharp(await img.extract({ left: 0, top: 0, width: meta.width, height: CROP[name] }).toBuffer());
  await img.resize({ width: phone ? 585 : 1176 }).webp({ quality: 82 }).toFile(path.join(shotsOut, name + ".webp"));
}

const metrics = JSON.parse(read("metrics.json"));
let body = ["b1-top.html", "b2-analysis.html", "b3-proposal.html", "b4-spec.html", "b5-end.html"].map(read).join("\n");

// slike
body = body.replace(/__IMG_([a-z0-9-]+)__/g, (m, name) => {
  const f = path.join(shotsOut, name + ".webp");
  if (!fs.existsSync(f)) throw new Error("nema snimka: " + name);
  return "data:image/webp;base64," + fs.readFileSync(f).toString("base64");
});
// mjerenja
const used = new Set();
body = body.replace(/__M_([A-Za-z0-9_]+)__/g, (m, key) => {
  if (!(key in metrics)) throw new Error("nema mjerenja: " + key);
  used.add(key);
  return String(metrics[key]);
});
const unused = Object.keys(metrics).filter((k) => !used.has(k));

const scripts = ["icons.js", "logic.js", "world.js", "p0-core.js", "p1-stanje.js", "p2-promet.js", "p3-sheets.js", "p5-boot.js", "board.js"].map(read).join("\n;\n");
if (/<\/script/i.test(scripts)) throw new Error("skripta sadrži </script");
const css = read("board.css") + "\n[hidden]{display:none!important}\n" + read("app.css");

const html = `<title>Dizajn stranice Finansije</title>\n<style>\n${css}\n</style>\n\n${body}\n<script>\n${scripts}\n</script>\n`;
fs.writeFileSync(path.join(here, "board.html"), html);
fs.writeFileSync(path.join(here, "board.preview.html"), `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`);
console.log("board.html", Math.round(html.length / 1024), "KB; neiskorištene mjere:", unused.join(", ") || "-");
