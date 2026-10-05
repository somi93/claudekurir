// Mjerenje PROTOTIPA istim mjerilom kao stara stranica: kontrast svakog teksta, mete < 44 px, polja bez imena, najmanji font.
// Prototip se učitava nerazmjeren (1440 ili 390 px), bez table. Pokretanje: node proto-check.mjs
import { launch } from "./cdp.mjs";
import { scanContrast, smallTargets, unnamedFields } from "./flib.mjs";
import { measure } from "./colib.mjs";
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, "..");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8"), js = fs.readFileSync(path.join(root, "app.js"), "utf8");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pc-")), page = path.join(tmp, "p.html");
fs.writeFileSync(page, `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>t</title><style>:root{--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif}body{margin:0}#r{width:100vw;height:100vh}</style><style>${css}</style><div class="apx" id="r"></div><script>${js}</script><script>var o=JSON.parse(new URLSearchParams(location.search).get("o")||"{}");PricingProto.create(document.getElementById("r"),o);</script>`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
const run = async (label, phone, cases) => {
  const b = await launch({ shotsDir: tmp, width: phone ? 390 : 1440, height: phone ? 844 : 900, dpr: phone ? 2 : 1, mobile: phone });
  for (const [name, o] of cases) {
    await b.goto("file://" + page + "?o=" + encodeURIComponent(JSON.stringify(o))); await sleep(500);
    const c = await scanContrast(b, "#r"), t = await smallTargets(b, "#r"), u = await unnamedFields(b, "#r"), m = await measure(b);
    out[label + ":" + name] = { texts: c.count, minContrast: c.min, badContrast: c.bad, small: t.map((x) => `${x.t} ${x.w}×${x.h}`), unnamed: u, minFont: m.minFont, docW: m.docW, vw: m.vw };
  }
  out[label + ":errors"] = { exc: b.exceptions.length, console: b.consoleMsgs.filter((x) => x.type === "error").length };
  await b.close();
};
const dirty = { draft: { base: "2,50", km: "8,00" } };
await run("desk", false, [["cijena", {}], ["cijena-nacrt", dirty], ["doplate", { tab: "sur" }], ["doplata-editor", { tab: "sur", es: 502 }], ["nova-doplata-greske", { tab: "sur", es: "new", esDraft: { name: "Kiša", val: "abc" } }], ["pravila", { tab: "rules", dist: 3 }], ["pravilo-editor", { tab: "rules", er: "new", erDraft: { type: "dist", min: "6", max: "4", veh: [] } }], ["brisanje", { tab: "sur", es: 501, del: { kind: "sur", id: 501 } }], ["ucitavanje", { mode: "loading" }], ["greska", { mode: "error" }], ["prazno", { mode: "empty", tab: "sur" }]]);
await run("tel", true, [["cijena", {}], ["cijena-nacrt", dirty], ["doplate", { tab: "sur" }], ["doplata-list", { tab: "sur", es: 502 }], ["pravila", { tab: "rules" }], ["pravilo-list", { tab: "rules", er: 702 }], ["primjer", { simSheet: true }], ["brisanje", { tab: "sur", del: { kind: "sur", id: 501 } }], ["ucitavanje", { mode: "loading" }], ["greska", { mode: "error" }]]);
console.log(JSON.stringify(out, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
