// "PRIJE" 7: kvalitet pretrage - pretraga sa stranice Kuriri uživo (ime/telefon/ID, bez dijakritika) naspram pretrage sa stranice Kuriri.
// Obje se pokreću nad ISTIM kuririma; stara je prepisana 1:1 iz CourierSidebar.vue (matchedEntries), nova je pravi kod (utils/courierRoster.ts).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { buildLiveWorld } from "./world.mjs";
import { out } from "./lh.mjs";

const REPO = process.env.REPO_ROOT || "H:/projects/bosna/dostavljaci-front";
const req = createRequire(path.resolve(REPO, "package.json"));
const esbuild = req("esbuild");
const entry = path.join(out, "search-entry.ts");
fs.writeFileSync(entry, `export { buildRoster, matchCourier } from "~/utils/courierRoster";\nexport { toLatin } from "~/utils/toLatin";\n`);
const bundle = path.join(out, "search-bundle.mjs");
await esbuild.build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: bundle, alias: { "~": path.join(REPO, "app") }, logLevel: "error" });
const { buildRoster, matchCourier, toLatin } = await import("file:///" + bundle.replace(/\\/g, "/"));

const W = buildLiveWorld({ now: new Date("2026-10-06T12:20:00Z") });
const locRows = W.locations();
const roster = buildRoster(W.couriers);
const byId = (name) => W.couriers.find((c) => c.name === name)?.courier_id;
const amir = byId("Amir Hodžić"), zeljko = byId("Željko Đurić"), zeljkoCyr = W.couriers.find((c) => /Жељко/.test(c.name))?.courier_id;

// stari kod (CourierSidebar.vue, matchedEntries): ID, ime (toLatin + lowerCase), telefon (lowerCase) - nad redovima courier-locations
const oldMatch = (query) => {
  const q = query.trim().toLowerCase();
  if (!q) return locRows.map((l) => l.courier_id);
  return locRows.filter((c) => String(c.courier_id).includes(q) || toLatin(c.name ?? "").toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q)).map((c) => c.courier_id);
};
const newMatch = (query) => roster.filter((c) => matchCourier(c, query)).map((c) => c.id);

// realni upiti dispečera + ko mora biti u rezultatu
const Q = [
  ["hodžić", [amir], "ime sa dijakritikom"],
  ["hodzic", [amir], "ime bez dijakritika"],
  ["amir hodzic", [amir], "ime i prezime bez dijakritika"],
  ["hodzic amir", [amir], "prezime pa ime"],
  ["zeljko djuric", [zeljko], "Željko Đurić kucano bez dijakritika"],
  ["djuric", [zeljko], "Đ kao dj"],
  ["Жељко", [zeljkoCyr], "ćirilica u upitu"],
  ["zeljko", [zeljko, zeljkoCyr], "dva Željka (jedan upisan ćirilicom)"],
  ["065123456", [zeljko], "telefon bez razdjelnika (u bazi 065/123-456)"],
  ["065 123 456", [zeljko], "telefon sa razmacima"],
  ["+38765123456", [zeljko], "telefon međunarodno"],
  ["65123456", [zeljko], "telefon bez nule"],
  ["30189", [amir], "ID"],
  ["#30189", [amir], "ID sa oznakom #"],
  ["amir.hodzic@ordera", [amir], "korisničko ime za prijavu"],
];
const rows = Q.map(([q, want, note]) => {
  const o = oldMatch(q), n = newMatch(q);
  return { q, note, old: want.every((id) => o.includes(id)), neu: want.every((id) => n.includes(id)), oldN: o.length, newN: n.length };
});
for (const r of rows) console.log(`${r.old ? "✔" : "✘"} stara  ${r.neu ? "✔" : "✘"} nova  "${r.q}"  (${r.note}) -> ${r.oldN} / ${r.newN}`);
const res = { total: rows.length, old: rows.filter((r) => r.old).length, neu: rows.filter((r) => r.neu).length, rows };
console.log(`stara pretraga: ${res.old} od ${res.total}; pretraga sa stranice Kuriri: ${res.neu} od ${res.total}`);
fs.writeFileSync(path.join(out, "b7.json"), JSON.stringify(res, null, 1));
