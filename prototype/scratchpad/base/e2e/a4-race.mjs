// A4: osvježavanje (nema ga?) i trka pri promjeni firme na stranici Finansije "prije".
import { writeFileSync } from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./fh.mjs";
import { texts } from "./ff.mjs";

const out = {};
const s = await session("a4", { width: 1440, height: 900, dpr: 1, mobile: false });
s.__name = "a4";
const F = s.mode.fin;
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
try {
  // ---------- osvježavanje: novi zahtjev stiže dok je stranica otvorena
  await s.load("/dispatcher/finance", { wait: ".handover-row", extra: 600 });
  await s.idle(600);
  s.clearLog();
  const t0 = Date.now();
  await sleep(3000);
  // kurir prijavi predaju (novi red na serveru)
  F.pendingRows.push({ id: 1500, courier_id: 30189, reported_amount: "50.00", reported_at: iso(new Date()) });
  F.history.unshift({ id: 1500, courier_id: 30189, reported_amount: "50.00", confirmed_amount: null, reported_at: iso(new Date()), confirmed_at: null, status: "pending", note: null, confirmed_by: null, confirmed_by_name: null });
  const WAIT = Number(process.env.POLL_S || 65);
  await sleep(WAIT * 1000);
  out.polling = {
    seconds: Math.round((Date.now() - t0) / 1000),
    requestsDuringWait: s.mode.log.map((e) => `${e.method} ${e.path}`),
    rowsShown: (await texts(s, ".handover-row")).length,
    serverHasPending: F.pendingRows.length,
    badge: await s.evalJs(`document.querySelector('.tab-pill-badge')?.textContent.trim() ?? null`),
  };
  // tab vraćen u prvi plan?
  s.clearLog();
  await s.evalJs(`document.dispatchEvent(new Event('visibilitychange'))`);
  await sleep(1200);
  out.afterVisibility = { requests: s.mode.log.map((e) => `${e.method} ${e.path}`) };

  // ---------- trka pri promjeni firme: spor odgovor firme 24 stiže POSLIJE odgovora firme 27
  F.balances27 = [{ courier_id: 31000, name: "Neko Iz Druge Firme", phone: "061 000 111", cash_owed_to_company: 12.5, wage_owed_to_courier: 0 }];
  F.pending27 = [];
  await s.load("/dispatcher/finance", { wait: ".handover-row", extra: 600 });
  await s.idle(600);
  s.setFlags({ delays: [{ re: /GET \/dispatcher\/delivery-companies\/24\/couriers-balance/, ms: 1800 }] });
  await s.click("[role=tab][data-tab=balances]");
  await sleep(200);
  // sidebar: izaberi firmu 27
  await s.click(".dispatcher-sidebar .v-field");
  await s.waitFor(`document.querySelectorAll('.v-overlay--active .v-list-item').length > 0`);
  await sleep(300);
  await s.click(".v-overlay--active .v-list-item", { textIncludes: "Glovo" });
  await sleep(500);
  const early = await texts(s, ".global-table tbody tr");
  await sleep(2600);
  const late = await texts(s, ".global-table tbody tr");
  out.companySwitch = {
    selectedCompanyText: await s.evalJs(`document.querySelector('.dispatcher-sidebar .v-field__input, .dispatcher-sidebar .v-select__selection')?.textContent.replace(/\\s+/g,' ').trim() ?? null`),
    rowsEarly: early.slice(0, 3),
    rowsLate: late.slice(0, 3),
    lateRowCount: late.length,
    showsOtherCompanyData: late.some((t) => /Amir Hodžić|Kenan Mujić/.test(t)),
  };
  await s.shot("a4-race-after");
  // akcija nad "pogrešnim" redom: koji company id ide u tijelo zahtjeva?
  s.clearLog();
  if (out.companySwitch.showsOtherCompanyData) {
    await s.click(".row-actions button", { textIncludes: "Uplata" });
    await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`);
    await sleep(500);
    await s.click(".v-overlay--active input[type=number]");
    await s.typeText("10", 4);
    await s.click(".v-overlay--active button[type=submit]");
    await sleep(1000);
    out.companySwitch.actionBody = s.mode.log.filter((e) => e.method === "POST").map((e) => `${e.path} ${JSON.stringify(e.body)}`);
  }
} catch (e) {
  out.error = String(e.stack || e);
  console.error(out.error);
} finally {
  writeFileSync(path.join(dir, "a4-race.json"), JSON.stringify(out, null, 1));
  await s.close();
}
console.log(JSON.stringify(out, null, 1));
