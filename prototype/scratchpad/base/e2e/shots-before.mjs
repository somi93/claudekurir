// Snimci STARE stranice Finansije sa brojevima (za tablu): računar 1440x900 i telefon 390x844 (skala 2). Izlaz: ../shots/board/*.png
import fs from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./fh.mjs";
import { markAt, unmark, pt } from "./cf.mjs";

const OUT = path.join(dir, "..", "shots", "board");
fs.mkdirSync(OUT, { recursive: true });
const mode = process.env.MODE || "desk";
const phone = mode === "phone";
const s = await session(`sb-${mode}`, { width: phone ? 390 : 1440, height: phone ? 844 : 900, dpr: phone ? 2 : 1, mobile: phone });
s.__name = `sb-${mode}`;
const tab = async (k) => { await s.click(`[role=tab][data-tab="${k}"]`); await s.idle(600); await sleep(600); await s.evalJs(`window.scrollTo(0,0)`); };
const save = async (name, marks, { full = false, h = null } = {}) => {
  const pts = [];
  for (const m of marks) {
    const p = await pt(s, m.sel, { nth: m.nth ?? 0, text: m.text ?? null, fx: m.fx ?? 0, fy: m.fy ?? 0.5, dx: m.dx ?? 0, dy: m.dy ?? 0 });
    if (!p) { console.log("nema tačke za", name, m.n, m.sel); continue; }
    pts.push({ n: m.n, x: p.x, y: p.y });
  }
  await markAt(s, pts);
  const dims = await s.evalJs(`({ w: document.documentElement.clientWidth, h: Math.max(document.documentElement.scrollHeight, innerHeight) })`);
  const clip = full ? { x: 0, y: 0, width: dims.w, height: Math.min(dims.h, h || 2400), scale: 1 } : undefined;
  const r = await s.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, ...(clip ? { clip } : {}) });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, "base64"));
  await unmark(s);
  console.log("snimak", name, JSON.stringify(pts.map((p) => [p.n, Math.round(p.x), Math.round(p.y)])));
};
const dlgOpen = () => s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`, { timeout: 6000 });
try {
  await s.load("/dispatcher/finance", { wait: ".handover-row", extra: 900 });
  await s.idle(700);
  if (!phone) {
    await save("d-handovers", [
      { n: 1, sel: ".page-header .page-title", fx: 1, dx: 18 },
      { n: 2, sel: ".global-tab-bar", fx: 0.5, fy: 1, dy: 9 },
      { n: 3, sel: ".panel-subtitle", fx: 1, dx: 18 },
      { n: 4, sel: ".handover-row button", nth: 0, fx: 0, dx: -20 },
      { n: 5, sel: ".handover-meta", nth: 3, fx: 1, dx: 18 },
    ]);
    // dijalog potvrde
    await s.click(".handover-row button", { nth: 3 });
    await dlgOpen(); await sleep(500);
    await save("d-confirm", [
      { n: 1, sel: ".v-overlay--active .confirm-copy", fx: 1, fy: 0.5, dx: 16 },
      { n: 2, sel: ".v-overlay--active .v-card", fx: 0, fy: 0.5, dx: -26 },
    ]);
    await s.key("Escape"); await sleep(400);
    // balansi
    await tab("balances");
    await save("d-balances", [
      { n: 1, sel: ".row-actions", nth: 0, fx: 1, dx: 20 },
      { n: 2, sel: ".balance-id", nth: 0, fx: 0, dx: -20 },
      { n: 3, sel: ".cash-credit", nth: 0, fx: 1, dx: 20 },
      { n: 4, sel: ".global-table th", nth: 1, fx: 0, dx: -20 },
      { n: 5, sel: ".balance-search", fx: 0.93 },
      { n: 6, sel: ".row-actions button", nth: 0, fx: 0, dx: -22 },
    ]);
    await s.click(".global-table tbody tr td:first-child");
    await dlgOpen(); await sleep(500);
    await save("d-details", [
      { n: 1, sel: ".v-overlay--active .detail-label", nth: 0, fx: 0, dx: -22 },
      { n: 2, sel: ".v-overlay--active .detail-row", nth: 2, fx: 1, dx: 22 },
      { n: 3, sel: ".v-overlay--active .v-card", nth: 0, fx: 0.5, fy: 1, dy: 16 },
    ]);
    await s.key("Escape"); await sleep(400);
    // istorija
    await tab("history");
    await save("d-history", [
      { n: 1, sel: ".v-chip", nth: 0, fx: 0, dx: -22 },
      { n: 2, sel: ".global-table th", nth: 5, fx: 1, dx: 22 },
      { n: 3, sel: ".history-field", nth: 0, fx: 0, dx: -22 },
      { n: 4, sel: ".panel-subtitle", fx: 1, dx: 18 },
    ]);
    await tab("payouts");
    await save("d-payouts", [
      { n: 1, sel: ".global-table th", nth: 2, fx: 0.5, fy: 0, dy: -15 },
      { n: 2, sel: ".global-table th", nth: 3, fx: 1, dx: 22 },
      { n: 3, sel: ".panel-subtitle", fx: 1, dx: 18 },
    ]);
    // greška učitavanja: nov session ne treba, koristimo Fetch fails
    s.setFlags({ fails: [{ re: /GET \/dispatcher\/delivery-companies\/\d+\/cash-handovers\/pending/, status: 500, times: 999, body: { message: "Server Error" } }] });
    await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 900 }); await s.idle(700);
    await save("d-fail", [
      { n: 1, sel: ".page-alert", fx: 0.5, fy: 1, dy: 9 },
      { n: 2, sel: ".empty-state .empty-copy", fx: 1, dx: 18 },
      { n: 3, sel: ".global-tab-bar", nth: 0, fx: 0, fy: 0.5, dx: 14, dy: -12 },
    ]);
    s.setFlags({ fails: [] });
    // greška akcije dok je dijalog otvoren + iznad duga
    await s.load("/dispatcher/finance", { wait: ".handover-row", extra: 700 }); await s.idle(600);
    await tab("balances");
    await s.clearField(".balance-search input"); await s.focusSel(".balance-search input"); await s.typeText("30201");
    await sleep(300);
    s.setFlags({ fails: [{ re: /POST \/dispatcher\/couriers\/\d+\/payout/, status: 500, times: 1 }] });
    await s.click(".row-actions button", { textIncludes: "Isplata" });
    await dlgOpen(); await sleep(500);
    await s.click(".v-overlay--active input[type=number]"); await s.typeText("86.4");
    await s.click(".v-overlay--active button[type=submit]"); await sleep(900);
    await save("d-payfail", [
      { n: 1, sel: ".page-alert", fx: 0.5, fy: 1, dy: 14 },
      { n: 2, sel: ".v-overlay--active .v-card", fx: 0, fy: 0.55, dx: -26 },
    ]);
    await s.key("Escape"); await sleep(500);
    // uplata iznad duga (999 naspram 45.50): prihvaćena bez upozorenja, poruka tek poslije
    s.setFlags({ fails: [] });
    await s.load("/dispatcher/finance", { wait: ".handover-row", extra: 700 }); await s.idle(600);
    await tab("balances");
    await s.focusSel(".balance-search input"); await s.typeText("29980"); await sleep(300);
    await s.click(".row-actions button", { textIncludes: "Uplata" });
    await dlgOpen(); await sleep(500);
    await s.click(".v-overlay--active input[type=number]"); await s.typeText("999");
    await sleep(300);
    await save("d-over-before", [
      { n: 1, sel: ".v-overlay--active .v-card", fx: 0, fy: 0.5, dx: -26 },
    ]);
    await s.click(".v-overlay--active button[type=submit]"); await sleep(1200);
    await save("d-over", [
      { n: 1, sel: ".global-table tbody tr td", nth: 1, fx: 1, dx: 20 },
      { n: 2, sel: ".global-alert-card", nth: 1, fx: 1, dx: 22 },
    ]);
  } else {
    await save("p-handovers", [
      { n: 1, sel: ".global-tab-bar", fx: 0.5, fy: 1, dy: 9 },
      { n: 2, sel: ".handover-row button", nth: 0, fx: 0, dx: -18 },
    ]);
    await tab("balances");
    await save("p-balances", [
      { n: 1, sel: ".global-tab-bar", fx: 0.5, fy: 1, dy: 9 },
      { n: 2, sel: ".global-table th", nth: 2, fx: 1, dx: 12 },
      { n: 3, sel: ".balance-zero-toggle .v-label", fx: 1, dx: 22, dy: 0 },
    ]);
    await tab("history");
    await save("p-history", [
      { n: 1, sel: ".global-table th", nth: 2, fx: 1, dx: 12 },
    ]);
  }
} finally {
  await s.close();
}
console.log("gotovo");
