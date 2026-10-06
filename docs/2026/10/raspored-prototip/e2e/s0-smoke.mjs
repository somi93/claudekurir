// Dim: stranica se učitava, četiri taba, bez grešaka u konzoli. Pokretanje iz korijena repoa:
//   REPO_ROOT=. CDP_PORT=9345 node docs/2026/10/raspored-prototip/e2e/s0-smoke.mjs
import { mk, loadPage, openTab, snap, sleep } from "./lib.mjs";
import { check, summary } from "./harness.mjs";

const s = await mk("s0", { width: 1440, height: 900 });
try {
  await loadPage(s);
  check("naslov stranice", (await s.text(".page-title")) === "Raspored i zone", await s.text(".page-title"));
  check("podnaslov firma · grad", /Ordera Dostava Banja Luka · Banja Luka/.test((await s.text(".page-subtitle")) || ""), await s.text(".page-subtitle"));
  check("četiri taba", (await s.count(".global-tab-bar .tab-pill")) === 4);
  await sleep(800);
  await snap(s, "raspored");
  check("mreža sedmice", await s.q("[role=grid]"), "nema mreže");
  for (const t of ["Sada", "Zone", "Pravila"]) { await openTab(s, t); await sleep(600); await snap(s, t.toLowerCase()); }
  console.log("nepoznati pozivi:", JSON.stringify(s.mode.unknown));
  const errs = s.consoleMsgs.filter((m) => m.type === "error").map((m) => m.text.slice(0, 160));
  console.log("greške u konzoli:", JSON.stringify(errs.slice(0, 6)), "izuzeci:", JSON.stringify(s.exceptions.map((e) => String(e.text).slice(0, 200)).slice(0, 4)));
} finally { await s.close(); }
process.exit(summary() ? 1 : 0);
