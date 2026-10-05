// Provjera implementirane stranice Firma na TELEFONU (390 × 844, dodir) i uskom ekranu (320). Računar je
// u f-desktop.mjs. Isti mock API (nh.mjs).
import { session, sleep, check, summary } from "./nh.mjs";
import { buildRestaurants } from "./co-fx.mjs";
import { scanContrast, smallTargets, unnamedFields, visibleText, texts, attr, lastPatch, SAVE, snap } from "./flib.mjs";

const mk = async (opts = {}) => {
  const s = await session("f", { width: 390, height: 844, dpr: 2, mobile: true, ...opts }); s.__name = "f";
  s.mode.balances = [["Marko Petrović", 214.4], ["Darko Ilić", 188], ["Jelena Radić", 142.7], ["Nikola Savić", 61.2]].map(([name, cash], i) => ({ courier_id: 7000 + i, name, phone: null, cash_owed_to_company: cash, wage_owed_to_courier: 0 }));
  return s;
};
const row = (k) => `[data-setting="${k}"]`;
const noOverflow = (s) => s.evalJs(`document.documentElement.scrollWidth <= innerWidth + 1`);

{
  const s = await mk();
  await s.load("/dispatcher/company", { wait: "[data-setting='limit']", extra: 800, timeout: 150000 }); await s.idle(800);
  console.log("\n== Postavke (telefon 390)");
  check("naslov je naziv firme", (await visibleText(s, ".page-title")) === "Ordera Dostava Banja Luka");
  check("nema panela pored liste, nema otvorenog lista", (await s.count(".cs-det")) === 0 && (await s.count(".as")) === 0);
  check("stranica nema vodoravni skrol", await noOverflow(s));
  check("sedam redova sa radnjom, svaki najmanje 64 px", await s.evalJs(`[...document.querySelectorAll('[data-setting]')].every(e => e.getBoundingClientRect().height >= 63.5)`));
  const sm = await smallTargets(s);
  check("nijedna meta ispod 44 px", sm.length === 0, JSON.stringify(sm));
  const cc = await scanContrast(s);
  check("kontrast svakog teksta ≥ 4.5", cc.bad.length === 0, `min ${cc.min} ${JSON.stringify(cc.bad)}`);
  check("polja i grupe imaju ime", (await unnamedFields(s)).length === 0);
  await snap(s, "p1-postavke-telefon", { x: 0, y: 0, w: 390, h: 844 });

  await s.click(row("limit")); await sleep(700);
  check("red otvara donji list", (await visibleText(s, ".as-title")) === "Limit gotovine");
  check("list: Sačuvaj je u podnožju i onemogućen bez izmjene", await s.evalJs(`(() => { const b = document.querySelector('.as-foot button[type=submit]'); const r = b.getBoundingClientRect(); return b.disabled && r.bottom <= innerHeight && r.height >= 52; })()`));
  await s.clearField('[data-field="limit"]'); await s.typeText("150"); await sleep(250);
  check("150: posljedica na telefonu", (await visibleText(s, "[data-company=impact]")).includes("2 kurira su odmah preko limita"));
  await snap(s, "p2-limit-list", { x: 0, y: 0, w: 390, h: 844 });
  s.mode.fails = [{ re: /PATCH .*finance-settings/, status: 422, times: 1, body: { message: "x", errors: { cash_limit_amount: ["Limit ne smije biti manji od dugovanja."] } } }];
  s.clearLog(); await s.click(SAVE); await s.idle(600); await sleep(300);
  check("422 u listu: poruka uz polje i tonirani blok, list ostaje otvoren", (await visibleText(s, ".sf-msg.is-bad"))?.includes("Limit ne smije") && (await s.count("[data-company=error]")) === 1 && (await s.count(".as")) === 1);
  check("422 u listu: poruka je vidljiva bez skrola do dna", await s.evalJs(`(() => { const r = document.querySelector('[data-company=error]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`));
  await s.click(SAVE); await s.idle(600); await sleep(900);
  check("snimanje zatvara list i osvježava red", (await s.count(".as")) === 0 && (await texts(s, row("limit")))[0].includes("150.00 KM"));
  check("fokus se vraća na red koji je otvorio list", (await s.evalJs(`document.activeElement.getAttribute('data-setting')`)) === "limit");

  await s.click(row("handover")); await sleep(600);
  await s.click(".sf-in input[type=time]"); await s.evalJs(`(() => { const i = document.querySelector('[data-field=handover]'); i.value = '09:30'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(200);
  await s.click(".as-ib"); await sleep(400);
  check("X sa izmjenom pita \"Imaš nesačuvane izmjene\"", (await visibleText(s, ".as-discard"))?.includes("Imaš nesačuvane izmjene"));
  await s.click("[data-discard=keep]"); await sleep(250);
  check("Nastavi uređivanje čuva unos (09:30)", (await s.evalJs(`document.querySelector('[data-field=handover]').value`)) === "09:30");
  await s.click(".as-ib"); await sleep(300); await s.click("[data-discard=drop]"); await sleep(700);
  check("Odbaci izmjene zatvara list bez snimanja", (await s.count(".as")) === 0 && (await texts(s, row("handover")))[0].includes("14:16"));

  await s.click(row("mode")); await sleep(600);
  await s.click('[data-choice="TOP_N"]'); await sleep(300);
  check("način dodjele: kartice su jedna kolona, polja se pojavljuju", (await s.count('[data-field="count"]')) === 1);
  check("list sa dugim sadržajem skroluje, Sačuvaj ostaje na vidiku", await s.evalJs(`(() => { const b = document.querySelector('.as-foot button[type=submit]').getBoundingClientRect(); return b.bottom <= innerHeight + 1; })()`));
  await snap(s, "p3-nacin-dodjele-list", { x: 0, y: 0, w: 390, h: 844 });
  await s.click(".as-ib"); await sleep(300); await s.click("[data-discard=drop]"); await sleep(600);

  console.log("\n== Restorani (telefon 390)");
  await s.click('.tab-pill[data-tab="restaurants"]'); await sleep(700);
  await s.waitFor(`document.querySelectorAll('[data-row^="row:"]').length > 0`, { timeout: 15000 });
  check("restorani: lista, pločice kližu vodoravno, nema vodoravnog skrola stranice", (await s.count('[data-row^="row:"]')) === 12 && (await noOverflow(s)));
  const sm2 = await smallTargets(s);
  check("restorani: nijedna meta ispod 44 px", sm2.length === 0, JSON.stringify(sm2));
  const cc2 = await scanContrast(s);
  check("restorani: kontrast ≥ 4.5", cc2.bad.length === 0, `min ${cc2.min} ${JSON.stringify(cc2.bad)}`);
  await snap(s, "p4-restorani-telefon", { x: 0, y: 0, w: 390, h: 844 });
  await s.click('[data-row^="row:"]', { nth: 3 }); await sleep(700);
  check("klik na restoran otvara detalj preko cijele stranice", (await s.count("[data-company=restaurant-detail]")) === 1 && (await s.count("[data-company=restaurant-list]")) === 0 && (await s.count(".tab-pill")) === 0);
  check("zaglavlje: naziv restorana i broj, strelica vodi na listu", (await visibleText(s, ".page-title")) === "Pizzeria Napoli" && (await visibleText(s, ".page-subtitle"))?.startsWith("Restoran #") && (await attr(s, ".back-btn", "aria-label")) === "Nazad na listu restorana");
  check("detalj: fokus je na naslovu", (await s.evalJs(`document.activeElement.id`)) === "restaurant-detail-title");
  check("detalj: adresa u URL-u (?r)", (await s.evalJs(`new URL(location.href).searchParams.get('r')`)) !== null);
  await snap(s, "p5-restoran-detalj-telefon", { x: 0, y: 0, w: 390, h: 844 });
  await s.click("[data-detail=activate]"); await sleep(700);
  check("Uključi: list sa potvrdom i upozorenjem o valuti", (await visibleText(s, ".as-title")) === "Uključi saradnju");
  await s.click(".as-ib"); await sleep(500);
  await s.evalJs(`history.back()`); await sleep(700);
  check("dugme Nazad (history.back) zatvara detalj i vraća listu", (await s.count("[data-company=restaurant-list]")) === 1 && (await s.count("[data-company=restaurant-detail]")) === 0 && (await visibleText(s, ".page-title")) === "Ordera Dostava Banja Luka");
  await s.click('[data-row^="row:"]', { nth: 0 }); await sleep(600);
  await s.click(".back-btn"); await sleep(600);
  check("strelica u zaglavlju zatvara detalj", (await s.count("[data-company=restaurant-list]")) === 1);
  check("bez izuzetaka", s.exceptions.length === 0, JSON.stringify(s.exceptions).slice(0, 300));
  await s.close();
}

console.log("\n== Uski ekran 320");
{
  const s = await mk({ width: 320, height: 640 });
  await s.load("/dispatcher/company", { wait: "[data-setting='limit']", extra: 800, timeout: 150000 }); await s.idle(800);
  check("320: postavke bez vodoravnog skrola", await noOverflow(s));
  await s.click(row("mode")); await sleep(600);
  check("320: list sa načinom dodjele bez vodoravnog skrola", await noOverflow(s));
  await s.click('[data-choice="TOP_N"]'); await sleep(300);
  check("320: kartice izbora staju", await s.evalJs(`[...document.querySelectorAll('.cg-opt')].every(e => e.getBoundingClientRect().right <= innerWidth + 1)`));
  await s.click(".as-ib"); await sleep(400); await s.click("[data-discard=drop]"); await sleep(600);
  await s.click('.tab-pill[data-tab="restaurants"]'); await s.waitFor(`document.querySelectorAll('[data-row^="row:"]').length > 0`, { timeout: 15000 }); await sleep(400);
  check("320: restorani bez vodoravnog skrola", await noOverflow(s));
  await s.click('[data-row^="row:"]', { nth: 6 }); await sleep(600);
  check("320: detalj restorana sa najdužim nazivom bez vodoravnog skrola", await noOverflow(s));
  await snap(s, "p6-detalj-320", { x: 0, y: 0, w: 320, h: 640 });
  await s.close();
}

console.log("\n== 150 restorana, procesor 4× sporiji");
{
  const s = await mk();
  s.mode.restaurants[24] = buildRestaurants(150);
  await s.load("/dispatcher/company?t=restorani", { wait: '[data-row^="row:"]', extra: 800, timeout: 150000 }); await s.idle(800);
  check("150 restorana: prvi prolaz iscrtava 12 redova", (await s.count('[data-row^="row:"]')) === 12);
  await s.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await s.click('[data-company=search]');
  const ms = await s.evalJs(`new Promise(res => { const i = document.querySelector('[data-company=search]'); const t0 = performance.now(); i.value = 'ko'; i.dispatchEvent(new Event('input', { bubbles: true })); requestAnimationFrame(() => requestAnimationFrame(() => res(Math.round(performance.now() - t0)))); })`);
  check("pretraga u listi od 150 pri 4× sporijem procesoru odgovara za manje od 200 ms", ms < 200, `${ms} ms`);
  await s.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await s.evalJs(`(() => { const i = document.querySelector('[data-company=search]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(500);
  await s.click('[data-company=more]'); await sleep(400);
  check("Prikaži još dodaje 12 redova", (await s.count('[data-row^="row:"]')) === 24);
  await s.close();
}
process.exit(summary() ? 1 : 0);
