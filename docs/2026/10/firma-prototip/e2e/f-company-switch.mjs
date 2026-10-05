// Promjena firme u ladici (računar): bez izmjene prelazi odmah i učitava drugu firmu; sa nesačuvanim unosom pita.
import { session, sleep, check, summary } from "./nh.mjs";
import { visibleText, texts, snap } from "./flib.mjs";

const s = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "f";
await s.load("/dispatcher/company", { wait: "[data-setting='limit']", extra: 800, timeout: 150000 }); await s.idle(800);
const pick = async (name) => {
  await s.click(".sidebar-company .v-field"); await sleep(500);
  await s.click(".v-overlay-container .v-list-item", { textIncludes: name }); await sleep(700);
};
const title = () => visibleText(s, ".page-title");

check("počinje sa firmom 24", (await title()) === "Ordera Dostava Banja Luka");
await pick("Glovo BL"); await s.idle(600); await sleep(400);
check("bez izmjene: odmah druga firma", (await title()) === "Glovo BL");
check("postavke druge firme su učitane (provizija nije postavljena)", (await texts(s, "[data-setting=commission]"))[0].includes("Nije postavljena"));
check("tab Restorani pokazuje 3", (await visibleText(s, '.tab-pill[data-tab="restaurants"]')) === "Restorani3");
check("editor je opet otvoren na prvoj postavci (nova firma, nov pogled)", (await visibleText(s, ".se-ht h2")) === "Limit gotovine");

await s.clearField('[data-field="limit"]'); await s.typeText("77"); await sleep(250);
await pick("Ordera Dostava");
check("sa nesačuvanim unosom: firma se vraća i stranica pita", (await title()) === "Glovo BL" && (await s.count("[data-company=guard]")) === 1);
check("izbor u ladici je vraćen na prvobitnu firmu", (await s.evalJs(`document.querySelector('.sidebar-company .v-select__selection-text')?.textContent.trim()`)) === "Glovo BL");
await snap(s, "f12-promjena-firme-pita", { x: 264, y: 0, w: 1176, h: 900 });
await s.click("[data-discard=keep]"); await sleep(300);
check("Nastavi uređivanje: unos (77) ostaje, firma se ne mijenja", (await s.evalJs(`document.querySelector('[data-field=limit]').value`)) === "77" && (await title()) === "Glovo BL");
await pick("Ordera Dostava"); await s.click("[data-discard=drop]"); await s.idle(600); await sleep(500);
check("Odbaci izmjene: firma se mijenja", (await title()) === "Ordera Dostava Banja Luka");
check("nema izmjena preneseno na drugu firmu (limit je sačuvani)", (await texts(s, "[data-setting=limit]"))[0].includes("200.00 KM"));
check("bez izuzetaka", s.exceptions.length === 0, JSON.stringify(s.exceptions).slice(0, 300));
await s.close();
process.exit(summary() ? 1 : 0);
