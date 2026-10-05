// Snimci stvarne aplikacije (stranica Firma) za dokument-tablu: cio prozor, računar 1440 × 900 prvo, pa telefon 390 × 844.
// Izlaz: docs/2026/10/firma-prototip/shots/n-*.webp
import fs from "node:fs";
import path from "node:path";
import { session, sleep, dir } from "./nh.mjs";
import { SAVE } from "./flib.mjs";

const out = path.join(dir, "..", "shots");
fs.mkdirSync(out, { recursive: true });
const shot = async (s, name, w, h) => {
  const res = await s.send("Page.captureScreenshot", { format: "webp", quality: 84, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  const file = path.join(out, `${name}.webp`);
  fs.writeFileSync(file, Buffer.from(res.data, "base64"));
  console.log(name, fs.statSync(file).size);
};
const quiet = async (s) => { await s.evalJs(`document.querySelectorAll('.global-alert-card').forEach(e => e.remove())`); await sleep(150); };
const balances = (s) => {
  s.mode.balances = [["Marko Petrović", 214.4], ["Darko Ilić", 188], ["Jelena Radić", 142.7], ["Nikola Savić", 61.2], ["Milica Jović", 35], ["Amra Hadžić", 0], ["Stefan Kovač", -19.2], ["Vladimir Lukić", 0]]
    .map(([name, cash], i) => ({ courier_id: 7000 + i, name, phone: null, cash_owed_to_company: cash, wage_owed_to_courier: 0 }));
};

// ---------------- računar ----------------
{
  const s = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "f"; balances(s);
  await s.load("/dispatcher/company", { wait: "[data-setting='limit']", extra: 900, timeout: 150000 }); await s.idle(800);
  await shot(s, "n-d-1-postavke", 1440, 900);
  await s.clearField('[data-field="limit"]'); await s.typeText("150"); await sleep(300);
  await shot(s, "n-d-2-limit-posljedica", 1440, 900);
  await s.clearField('[data-field="limit"]'); await s.typeText("0"); await sleep(300);
  await shot(s, "n-d-3-limit-nula", 1440, 900);
  await s.clearField('[data-field="limit"]'); await s.typeText("120"); await sleep(200);
  s.mode.fails = [{ re: /PATCH .*finance-settings/, status: 422, times: 1, body: { message: "x", errors: { cash_limit_amount: ["Limit ne smije biti manji od dugovanja."] } } }];
  await s.click(SAVE); await s.idle(600); await sleep(400); await quiet(s);
  await shot(s, "n-d-4-greska-servera", 1440, 900);
  await s.click('[data-setting="handover"]'); await sleep(400);
  await shot(s, "n-d-5-nesacuvano", 1440, 900);
  await s.click("[data-discard=drop]"); await sleep(400);
  await s.click('[data-setting="mode"]'); await sleep(400);
  await s.click('[data-choice="TOP_N"]'); await sleep(300);
  await s.evalJs(`document.querySelector('.cs-det').scrollTop = 0; window.scrollTo(0, 0)`); await sleep(200);
  await shot(s, "n-d-6-nacin-dodjele", 1440, 900);
  await s.click("[data-company=editor-close]"); await sleep(300); await s.click("[data-discard=drop]"); await sleep(400);
  await s.click('.tab-pill[data-tab="restaurants"]'); await s.waitFor(`document.querySelectorAll('[data-row^="row:"]').length > 0`, { timeout: 15000 }); await s.idle(500); await sleep(500);
  await s.click('[data-row^="row:"]', { nth: 3 }); await sleep(600);
  await s.evalJs(`window.scrollTo(0, 0)`); await sleep(200);
  await shot(s, "n-d-7-restorani", 1440, 900);
  await s.click("[data-detail=activate]"); await sleep(700);
  await shot(s, "n-d-8-uključi-saradnju".replace("ú", "u").replace("č", "c"), 1440, 900);
  await s.close();
}
{
  const s = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "f";
  await s.load("/dispatcher/company?t=restorani", { wait: '[data-row^="row:"]', extra: 900, timeout: 150000 }); await s.idle(800);
  await s.click('[data-row^="row:"]', { nth: 1 }); await sleep(600);
  await s.click("[data-detail=suspend]"); await sleep(600);
  await s.click(".cs-chip"); await sleep(300);
  await shot(s, "n-d-9-suspenzija", 1440, 900);
  await s.close();
}

// ---------------- telefon ----------------
{
  const s = await session("f", { width: 390, height: 844, dpr: 2, mobile: true }); s.__name = "f"; balances(s);
  await s.load("/dispatcher/company", { wait: "[data-setting='limit']", extra: 900, timeout: 150000 }); await s.idle(800);
  await shot(s, "n-p-1-postavke", 390, 844);
  await s.click('[data-setting="limit"]'); await sleep(800);
  await s.clearField('[data-field="limit"]'); await s.typeText("150"); await sleep(300);
  await shot(s, "n-p-2-limit-list", 390, 844);
  await s.click(".as-ib"); await sleep(400); await s.click("[data-discard=drop]"); await sleep(700);
  await s.click('.tab-pill[data-tab="restaurants"]'); await s.waitFor(`document.querySelectorAll('[data-row^="row:"]').length > 0`, { timeout: 15000 }); await sleep(600);
  await shot(s, "n-p-3-restorani", 390, 844);
  await s.click('[data-row^="row:"]', { nth: 3 }); await sleep(800);
  await shot(s, "n-p-4-restoran-detalj", 390, 844);
  await s.close();
}
