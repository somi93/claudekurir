// Sklapa tablu: board.css + app.css + b1..b5 + skripte + snimci (webp, data URI, sa brojevima) + mjerenja. Izlaz: board.html (za Artifact) i board.preview.html (za lokalnu provjeru).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(path.resolve(process.env.REPO_ROOT || "H:/projects/bosna/dostavljaci-front", "package.json"));
const sharp = req("sharp");
const read = (f) => fs.readFileSync(path.join(here, f), "utf8");

// --- snimci stare stranice: crveni brojevi (kao u spisku ispod slike) pa PNG -> WebP (računar 1176 px, telefon 585 px) ---
// Brojevi stoje u praznom prostoru pored onoga što označavaju, ne preko teksta.
const FIGS = {
  "d-open": { src: "b1-desk-1440x900", w: 1440, h: 900, marks: [[1, 640, 520], [2, 462, 76], [3, 1424, 330], [4, 640, 842], [5, 1160, 32]] },
  "d-selected": { src: "f2-selected", w: 1440, h: 900, marks: [[1, 842, 466], [2, 1424, 800], [3, 1018, 322]] },
  "d-popup": { src: "f4-popup", w: 1440, h: 900, marks: [[1, 878, 409], [2, 1228, 836]] },
  "d-fail": { src: "b4-fail-first", w: 1440, h: 900, marks: [[1, 932, 112], [2, 1352, 286], [3, 700, 202]] },
  "d-rows": { src: "f7-rows", w: 1600, h: 1520, marks: [[1, 100, 410], [2, 1520, 1115], [3, 1520, 450]], r: 34 },
  "p-open": { src: "b6-phone-top", w: 780, h: 1688, marks: [[1, 700, 960], [2, 724, 1560]], r: 26 },
  "p-after": { src: "b6-phone-after-row", w: 780, h: 1688, marks: [[1, 710, 260], [2, 730, 1640]], r: 26 },
};
const shotsIn = path.resolve(here, "..", "shots", "before");
const shotsOut = path.resolve(here, "..", "shots", "board-webp");
fs.mkdirSync(shotsOut, { recursive: true });
for (const [name, f] of Object.entries(FIGS)) {
  const file = path.join(shotsIn, f.src + ".png");
  const meta = await sharp(file).metadata();
  if (meta.width !== f.w || meta.height !== f.h) throw new Error(`${name}: očekivano ${f.w}x${f.h}, a snimak je ${meta.width}x${meta.height}`);
  const r = f.r || 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}">${f.marks.map(([n, x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e5484d" stroke="#fff" stroke-width="${Math.round(r / 6)}"/><text x="${x}" y="${y + r * 0.36}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${Math.round(r * 1.05)}" fill="#fff">${n}</text>`).join("")}</svg>`;
  const phone = name.startsWith("p-");
  const marked = await sharp(file).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toBuffer();
  await sharp(marked).resize({ width: phone ? 585 : 1176 }).webp({ quality: 82 }).toFile(path.join(shotsOut, name + ".webp"));
}

const metrics = JSON.parse(fs.readFileSync(path.resolve(here, "..", "out", "metrics.json"), "utf8"));
let body = ["b1-top.html", "b2-analysis.html", "b3-proposal.html", "b4-spec.html", "b5-end.html"].map(read).join("\n");

body = body.replace(/__IMG_([a-z0-9-]+)__/g, (m, name) => {
  const f = path.join(shotsOut, name + ".webp");
  if (!fs.existsSync(f)) throw new Error("nema snimka: " + name);
  return "data:image/webp;base64," + fs.readFileSync(f).toString("base64");
});
const used = new Set();
body = body.replace(/__M_([A-Za-z0-9_]+)__/g, (m, key) => {
  if (!(key in metrics)) throw new Error("nema mjerenja: " + key);
  used.add(key);
  return String(metrics[key]);
});
const unused = Object.keys(metrics).filter((k) => !used.has(k));
// FINAL=1: konačno sklapanje za objavu mora imati upisane brojeve provjera nad tablom (CHK_BOARD, CHK_BOARD_OWN, LEAK_PROPS, LEAK_STATES)
if (process.env.FINAL && !(metrics.A_chkBoard > 0 && metrics.A_chkBoardOwn > 0 && metrics.A_leakStates > 0)) throw new Error("FINAL: brojevi provjera nad tablom nisu upisani (pokreni metrics.mjs sa CHK_BOARD, CHK_BOARD_OWN, LEAK_PROPS, LEAK_STATES)");

const scripts = ["icons.js", "world.js", "logic.js", "p0-core.js", "p1-map.js", "p2-panel.js", "p3-sheets.js", "p5-boot.js", "board.js"].map(read).join("\n;\n");
if (/<\/script/i.test(scripts)) throw new Error("skripta sadrži </script");
const css = read("board.css") + "\n[hidden]{display:none!important}\n" + read("app.css");

const html = `<title>Dizajn stranice Kuriri uživo</title>\n<style>\n${css}\n</style>\n\n${body}\n<script>\n${scripts}\n</script>\n`;
fs.writeFileSync(path.join(here, "board.html"), html);
fs.writeFileSync(path.join(here, "board.preview.html"), `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`);
console.log("board.html", Math.round(html.length / 1024), "KB; neiskorištene mjere:", unused.join(", ") || "-");
