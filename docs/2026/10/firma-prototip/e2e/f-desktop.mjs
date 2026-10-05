// Provjera implementirane stranice Firma na RAČUNARU (1440 × 900): postavke, editori, nesačuvano,
// greške servera, restorani, tastatura, kontrast, mete, imena polja. Dev server 3100 + mock API u nh.mjs.
import { session, sleep, check, summary } from "./nh.mjs";
import { scanContrast, smallTargets, unnamedFields, visibleText, texts, attr, active, lastPatch, FINANCE_KEYS, SAVE, snap as cap } from "./flib.mjs";

const s = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); s.__name = "f";
// Stanje gotovine kurira: tačno poznati iznosi (8 kurira, 5 ih drži gotovinu).
s.mode.balances = [
  ["Marko Petrović", 214.4], ["Darko Ilić", 188], ["Jelena Radić", 142.7], ["Nikola Savić", 61.2], ["Milica Jović", 35],
  ["Amra Hadžić", 0], ["Stefan Kovač", -19.2], ["Vladimir Lukić", 0],
].map(([name, cash], i) => ({ courier_id: 7000 + i, name, phone: null, cash_owed_to_company: cash, wage_owed_to_courier: 0 }));

const row = (k) => `[data-setting="${k}"]`;
const open = async (k) => { await s.click(row(k)); await sleep(350); };
const field = (n) => `[data-field="${n}"]`;
const type = async (sel, text) => { await s.clearField(sel); if (text) await s.typeText(text); await sleep(120); };
const saveBtn = () => s.evalJs(`(() => { const b = document.querySelector('.se-foot button[type=submit]'); return b ? { disabled: b.disabled, text: b.textContent.trim() } : null; })()`);
const editorTitle = () => visibleText(s, ".se-ht h2");
const patchOf = (re) => lastPatch(s, re);
const clickSave = async () => { s.clearLog(); await s.click(SAVE); await s.idle(500); await sleep(300); };

await s.load("/dispatcher/company", { wait: "[data-setting='limit'], [data-company='settings-error']", extra: 800, timeout: 150000 });
await s.idle(800);

console.log("\n== Zaglavlje i raspored");
check("naslov je naziv firme, ne \"Firma #24\"", (await visibleText(s, ".page-title")) === "Ordera Dostava Banja Luka");
check("podnaslov: grad · valuta", (await visibleText(s, ".page-subtitle")) === "Banja Luka · valuta KM");
check("sedam redova sa radnjom + provizija bez radnje", (await s.count("[data-setting]")) === 8 && (await s.evalJs(`document.querySelector('[data-setting=commission]').tagName`)) === "DIV");
check("računar: editor je odmah otvoren (Limit gotovine)", (await editorTitle()) === "Limit gotovine");
check("izabrani red ima aria-current", (await attr(s, row("limit"), "aria-current")) === "true");
const grid = await s.evalJs(`(() => { const l = document.querySelector('.cs-secs').getBoundingClientRect(), r = document.querySelector('.cs-det').getBoundingClientRect(); return { lw: Math.round(l.width), rx: Math.round(r.left), gap: Math.round(r.left - l.right), top: Math.round(r.top) }; })()`);
check("kolone 400 px | ostatak, razmak 20 px", grid.lw === 400 && grid.gap === 20, JSON.stringify(grid));
const docH = await s.evalJs(`document.documentElement.scrollHeight`);
check("stranica je niska (ne duža od jednog ekrana i po)", docH <= 1100, `visina ${docH}`);
check("red limita: iznos i ponašanje", (await texts(s, row("limit")))[0].includes("200.00 KM · blokira nove narudžbe"));
check("red limita: oznaka sa brojem kurira preko limita", (await texts(s, row("limit")))[0].includes("1 kurir je preko limita"), (await texts(s, row("limit")))[0]);
check("red valute: oznaka restorana u drugoj valuti", /\d+ restorana u drugoj valuti/.test((await texts(s, row("currency")))[0]));
check("tab Restorani ima broj", (await visibleText(s, '.tab-pill[data-tab="restaurants"]')) === "Restorani12");
await cap(s, "f1-postavke-racunar", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });

console.log("\n== Dostupnost");
const un = await unnamedFields(s);
check("sva polja i grupe imaju ime", un.length === 0, JSON.stringify(un));
const sm = await smallTargets(s);
check("nijedna meta nije manja od 44 px", sm.length === 0, JSON.stringify(sm));
const cc = await scanContrast(s);
check("kontrast svakog teksta ≥ 4.5 (krupan 3)", cc.bad.length === 0, `min ${cc.min}, ${cc.count} tekstova, ${JSON.stringify(cc.bad)}`);

console.log("\n== Limit gotovine");
await sleep(100);
check("Sačuvaj je onemogućen dok nema izmjene", (await saveBtn()).disabled === true);
await s.click(field("limitOn")); await sleep(300);
check("isključen limit: nema polja za iznos", (await s.count(field("limit"))) === 0);
check("isključen limit: kaže ukupnu gotovinu kod kurira", (await visibleText(s, "[data-company=impact]")).includes("Kuriri sada drže ukupno 641.30 KM"), await visibleText(s, "[data-company=impact]"));
check("isključen limit: Sačuvaj je omogućen (izmjena)", (await saveBtn()).disabled === false);
await s.click(field("limitOn")); await sleep(300);
check("ponovo uključen: vratio se iznos 200 (nije 0), nema izmjene", (await s.evalJs(`document.querySelector('[data-field=limit]').value`)) === "200" && (await saveBtn()).disabled === true);
await type(field("limit"), "150");
const imp150 = await visibleText(s, "[data-company=impact]");
check("150: dva kurira su odmah preko limita, jedan blizu", imp150.includes("Sa 150.00 KM: 2 kurira su odmah preko limita, 1 blizu"), imp150);
check("150: lista kurira sa trakom (3)", (await s.count(".ci-list li")) === 3);
check("150: Sačuvaj je omogućen", (await saveBtn()).disabled === false);
await cap(s, "f2-limit-150", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
await clickSave();
const p1 = patchOf(/PATCH .*finance-settings/);
check("PATCH nosi svih 11 polja", p1 && FINANCE_KEYS.every((k) => k in p1) && Object.keys(p1).length === 11, p1 && JSON.stringify(Object.keys(p1)));
check("PATCH: limit 150, ponašanje BLOCK, ostalo iz sačuvanog", p1.cash_limit_amount === 150 && p1.cash_limit_enforcement === "BLOCK" && p1.payout_period_days === 1 && p1.daily_handover_time === "14:16", JSON.stringify(p1));
check("red se osvježio: 150.00 KM", (await texts(s, row("limit")))[0].includes("150.00 KM"));
check("panel ostaje otvoren poslije snimanja", (await editorTitle()) === "Limit gotovine");
check("potvrda: Postavka je sačuvana.", (await texts(s, ".global-alert-card")).some((t) => t.includes("Postavka je sačuvana")), JSON.stringify(await texts(s, ".global-alert-card")));
check("poslije snimanja nema izmjena", (await saveBtn()).disabled === true && (await visibleText(s, ".se-foot p")) === "Nema izmjena.");

await type(field("limit"), "0");
const imp0 = await visibleText(s, "[data-company=impact]");
check("0 + blokada: crveno upozorenje sa brojem pogođenih", imp0.includes("0 KM blokira svakoga ko drži ijedan iznos") && imp0.includes("5 od 8"), imp0);
check("0: ton je crven (tint--bad)", (await s.count(".ci .tint--bad")) === 1);
await s.click('[data-choice="NOTIFY_ONLY"]'); await sleep(200);
const imp0n = await visibleText(s, "[data-company=impact]");
check("0 + samo obavijesti: ne tvrdi da blokira", !imp0n.includes("blokira") && !imp0n.includes("bez novih narudžbi"), imp0n);
check("0 je važeći iznos (Sačuvaj omogućen)", (await saveBtn()).disabled === false);
await s.click('[data-choice="BLOCK"]'); await sleep(150);

await type(field("limit"), "");
check("prazno polje: Sačuvaj onemogućen, još nema crvene greške", (await saveBtn()).disabled === true && (await attr(s, field("limit"), "aria-invalid")) === "false");
await s.evalJs(`document.querySelector('[data-field=limit]').blur()`); await sleep(250);
const emptyMsg = await visibleText(s, ".sf-msg.is-bad");
check("prazno polje poslije napuštanja: greška uz polje, aria-invalid", emptyMsg && emptyMsg.includes("0 znači") && (await attr(s, field("limit"), "aria-invalid")) === "true", emptyMsg);
check("prazan limit: nema uticaja (iznos nije ispravan)", (await s.count(".ci .tint")) === 0);

console.log("\n== Greška servera (422) uz polje");
await type(field("limit"), "120");
s.mode.fails = [{ re: /PATCH .*finance-settings/, status: 422, times: 1, body: { message: "The given data was invalid.", errors: { cash_limit_amount: ["Limit ne smije biti manji od dugovanja."] } } }];
await clickSave();
check("422: tonirana poruka \"Ne mogu da sačuvam\"", (await visibleText(s, "[data-company=error]"))?.includes("Ne mogu da sačuvam"), await visibleText(s, "[data-company=error]"));
check("422: poruka servera stoji uz polje", (await visibleText(s, ".sf-msg.is-bad"))?.includes("Limit ne smije biti manji od dugovanja."));
check("422: polje je aria-invalid", (await attr(s, field("limit"), "aria-invalid")) === "true");
check("422: uneseno ostaje (120)", (await s.evalJs(`document.querySelector('[data-field=limit]').value`)) === "120");
check("422: poruka je u vidokrugu (ne 196 px ispod ekrana)", await s.evalJs(`(() => { const r = document.querySelector('[data-company=error]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`));
check("422: Sačuvaj ostaje omogućen", (await saveBtn()).disabled === false);
await cap(s, "f3-greska-servera", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
await s.click(field("limit")); await s.typeText("5"); await sleep(200);
check("kucanje briše staru poruku servera", (await s.count("[data-company=error]")) === 0);
s.mode.fails = [{ re: /PATCH .*finance-settings/, status: 500, times: 1, body: { message: "Server Error" } }];
await clickSave();
check("500: opšta poruka, bez teksta servera", (await visibleText(s, "[data-company=error]"))?.includes("Server nije prihvatio izmjenu") && !(await visibleText(s, "[data-company=error]")).includes("Server Error"), await visibleText(s, "[data-company=error]"));
await clickSave();
check("ponovni pokušaj prolazi (1205 KM)", (await texts(s, row("limit")))[0].includes("1205.00 KM"), (await texts(s, row("limit")))[0]);
await type(field("limit"), "150"); await clickSave();

console.log("\n== Nesačuvano");
await type(field("limit"), "99");
await s.click(row("handover")); await sleep(350);
check("promjena reda sa izmjenom pita", (await s.count("[data-company=guard]")) === 1 && (await editorTitle()) === "Limit gotovine");
check("pitanje: fokus je na \"Nastavi uređivanje\"", (await attr(s, "[data-discard=keep]", "data-discard")) === "keep" && (await s.evalJs(`document.activeElement.getAttribute('data-discard')`)) === "keep");
await cap(s, "f4-nesacuvano", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
await s.click("[data-discard=keep]"); await sleep(250);
check("Nastavi uređivanje: pitanje nestaje, unos ostaje", (await s.count("[data-company=guard]")) === 0 && (await s.evalJs(`document.querySelector('[data-field=limit]').value`)) === "99");
await s.click('.tab-pill[data-tab="restaurants"]'); await sleep(350);
check("promjena taba sa izmjenom pita", (await s.count("[data-company=guard]")) === 1 && (await s.evalJs(`new URL(location.href).searchParams.get('t')`)) === null);
await s.click("[data-discard=keep]"); await sleep(200);
await s.click(row("handover")); await sleep(300);
await s.click("[data-discard=drop]"); await sleep(400);
check("Odbaci izmjene: otvara se red koji je dispečer izabrao", (await editorTitle()) === "Predaja gotovine");
check("odbačeni limit nije snimljen", (await texts(s, row("limit")))[0].includes("150.00 KM"));
await s.click(row("limit")); await sleep(300);
check("ponovo otvoren limit počinje od sačuvanog (150)", (await s.evalJs(`document.querySelector('[data-field=limit]').value`)) === "150");
await s.click("[data-company=editor-close]"); await sleep(300);
check("X na editoru bez izmjene zatvara panel", (await s.count("[data-company=editor]")) === 0 && (await visibleText(s, ".cs-none"))?.includes("Izaberi postavku"));

console.log("\n== Predaja, isplata, dodjela, skup, cijena");
await open("handover");
check("predaja: polje vrijeme sa labelom i opcionalno", (await visibleText(s, ".sf-label")).includes("Vrijeme dnevne predaje opciono"));
await s.click(".sfd-clr"); await sleep(250);
check("brisanje vremena: polje prazno, Sačuvaj omogućen", (await s.evalJs(`document.querySelector('[data-field=handover]').value`)) === "" && (await saveBtn()).disabled === false);
await clickSave();
check("PATCH: daily_handover_time null", patchOf(/PATCH .*finance-settings/).daily_handover_time === null);
check("red: Vrijeme nije određeno", (await texts(s, row("handover")))[0].includes("Vrijeme nije određeno"));

await open("payout");
await s.click('[data-choice="other"]'); await sleep(250);
check("isplata Drugo: polje Broj dana je dobilo fokus", (await active(s))?.field === "payoutOther");
await type(field("payoutOther"), "0"); await s.evalJs(`document.querySelector('[data-field=payoutOther]').blur()`); await sleep(200);
check("isplata 0 dana: greška uz polje, Sačuvaj onemogućen", (await visibleText(s, ".sf-msg.is-bad"))?.includes("najmanje 1") && (await saveBtn()).disabled === true);
await type(field("payoutOther"), "30"); await clickSave();
check("PATCH: payout_period_days 30", patchOf(/PATCH .*finance-settings/).payout_period_days === 30);
check("red: Svakih 30 dana", (await texts(s, row("payout")))[0].includes("Svakih 30 dana"));

await open("mode");
await s.click('[data-choice="TOP_N"]'); await sleep(300);
check("Prvih N: pojavljuju se broj kurira, čekanje i akcija", (await s.count(field("count"))) === 1 && (await s.count(field("timeout"))) === 1 && (await s.count('[data-choice="OPEN_TO_ALL"]')) === 1);
check("objašnjenje kaže šta će se desiti", (await visibleText(s, "[data-company=explain]")).includes("Nova narudžba ide 3 najbližih kurira istovremeno. Ako niko ne odgovori za 30 s, ide sljedećem najbližem."), await visibleText(s, "[data-company=explain]"));
await type(field("count"), "51"); await s.evalJs(`document.querySelector('[data-field=count]').blur()`); await sleep(200);
check("broj kurira 51: greška, Sačuvaj onemogućen", (await visibleText(s, ".sf-msg.is-bad"))?.includes("1 do 50") && (await saveBtn()).disabled === true);
await type(field("count"), "5"); await s.click('[data-choice="OPEN_TO_ALL"]'); await sleep(200);
check("objašnjenje prati izbor", (await visibleText(s, "[data-company=explain]")).includes("otvara se svim kuririma"));
await cap(s, "f5-nacin-dodjele", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
await clickSave();
const pm = patchOf(/PATCH .*finance-settings/);
check("PATCH: TOP_N, 5 kurira, 30 s, OPEN_TO_ALL", pm.assignment_mode === "TOP_N" && pm.assignment_courier_count === 5 && pm.offer_timeout_seconds === 30 && pm.assignment_timeout_action === "OPEN_TO_ALL", JSON.stringify(pm));
check("red: Prvih 5 najbližih · 30 s", (await texts(s, row("mode")))[0].includes("Prvih 5 najbližih · 30 s"));
await s.click('[data-choice="ALL"]'); await sleep(200);
check("Svi istovremeno: skrivaju se zavisna polja", (await s.count(field("count"))) === 0 && (await s.count(field("timeout"))) === 0);
await clickSave();
const pa = patchOf(/PATCH .*finance-settings/);
check("PATCH: ALL šalje broj kurira null, čekanje ostaje 30", pa.assignment_mode === "ALL" && pa.assignment_courier_count === null && pa.offer_timeout_seconds === 30, JSON.stringify(pa));

await open("pool");
await s.click('[data-choice="AVAILABLE_NOW"]'); await clickSave();
check("skup kurira: PATCH AVAILABLE_NOW, red se osvježio", patchOf(/PATCH .*finance-settings/).assignment_courier_pool === "AVAILABLE_NOW" && (await texts(s, row("pool")))[0].includes("Samo dostupni za rad"));

await open("price");
check("cijena: prekidač ima ime i stanje", (await attr(s, field("breakdown"), "role")) === "switch" && (await s.evalJs(`document.querySelector('[data-field=breakdown]').checked`)) === true);
await s.click(field("breakdown")); await clickSave();
check("cijena: PATCH show_price_breakdown false, red Samo ukupan iznos", patchOf(/PATCH .*finance-settings/).show_price_breakdown === false && (await texts(s, row("price")))[0].includes("Samo ukupan iznos"));

console.log("\n== Valuta");
await open("currency");
await s.click('[data-choice="EUR"]'); await sleep(300);
const cw = await visibleText(s, "[data-company=currency-warning]");
check("EUR: iznosi se ne preračunavaju + limit + broj restorana", cw && cw.includes("Iznosi se ne preračunavaju") && cw.includes("150 KM postaje 150 EUR") && /\d+ od \d+ restorana koristi drugu valutu/.test(cw), cw);
const hdrBefore = await visibleText(s, ".page-subtitle");
check("izabrana (nesačuvana) valuta ne mijenja zaglavlje", hdrBefore === "Banja Luka · valuta KM");
await cap(s, "f6-valuta", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
await clickSave();
check("PATCH: currency EUR", patchOf(/PATCH .*finance-settings/).currency === "EUR");
check("zaglavlje i red prate sačuvanu valutu", (await visibleText(s, ".page-subtitle")) === "Banja Luka · valuta EUR" && (await texts(s, row("limit")))[0].includes("150.00 EUR"));

console.log("\n== Tastatura");
await s.click(".page-title"); await s.focusSel(row("limit"));
check("red se fokusira (button)", (await s.evalJs(`document.activeElement.getAttribute('data-setting')`)) === "limit");
await s.key("Enter"); await sleep(300);
check("Enter na redu otvara editor i fokus ide na naslov", (await editorTitle()) === "Limit gotovine" && (await active(s))?.tag === "h2");
await s.focusSel('.tab-pill[data-tab="settings"]'); await s.key("ArrowDown", {}).catch(() => {});
await s.evalJs(`document.querySelector('.tab-pill[data-tab="settings"]').focus()`);
await s.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await sleep(500);
check("strelica desno na tabu prebacuje na Restorani i fokus ide za njim", (await s.evalJs(`new URL(location.href).searchParams.get('t')`)) === "restorani" && (await active(s))?.text.startsWith("Restorani"), JSON.stringify(await active(s)));
check("role=tabpanel je povezan sa tabom", (await attr(s, "#co-panel", "aria-labelledby")) === "co-tab-restaurants" && (await attr(s, '.tab-pill[data-tab="restaurants"]', "tabindex")) === "0" && (await attr(s, '.tab-pill[data-tab="settings"]', "tabindex")) === "-1");

console.log("\n== Restorani (računar)");
await s.waitFor(`document.querySelectorAll('[data-row^="row:"]').length > 0`, { timeout: 15000 });
await s.idle(500); await sleep(300);
const tiles = await s.evalJs(`[...document.querySelectorAll('[data-company=filters] .tile')].map(t => t.textContent.replace(/\\s+/g,' ').trim())`);
check("pločice stanja sa brojevima", tiles.length >= 4 && tiles[0].includes("12") && tiles.some((t) => t.includes("Suspendovali ste")) && tiles.some((t) => t.includes("Isključio vas")), JSON.stringify(tiles));
check("lista: 12 redova, bez prekidača u redu", (await s.count('[data-row^="row:"]')) === 12 && (await s.count("[data-company=restaurant-list] input[type=checkbox]")) === 0);
check("računar: desno stoji \"Izaberi restoran\"", (await visibleText(s, ".cr-none"))?.includes("Izaberi restoran"));
const sm2 = await smallTargets(s);
check("restorani: nijedna meta ispod 44 px", sm2.length === 0, JSON.stringify(sm2));
const cc2 = await scanContrast(s);
check("restorani: kontrast svakog teksta ≥ 4.5", cc2.bad.length === 0, `min ${cc2.min} ${JSON.stringify(cc2.bad)}`);
const un2 = await unnamedFields(s);
check("restorani: polja i grupe imaju ime", un2.length === 0, JSON.stringify(un2));
await cap(s, "f7-restorani-racunar", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
await s.click('[data-filter="ours"]'); await sleep(300);
const oursRows = await texts(s, '[data-row^="row:"]');
check("filter Suspendovali ste: samo takvi redovi", oursRows.length > 0 && (await s.evalJs(`[...document.querySelectorAll('.rr-st')].every(e => e.textContent.includes('Suspendovali ste'))`)), `${oursRows.length}`);
check("filter je u adresi (?f=ours)", (await s.evalJs(`new URL(location.href).searchParams.get('f')`)) === "ours");
await s.click('[data-row^="row:"]'); await sleep(400);
check("klik na red otvara detalj pored liste", (await s.count("[data-company=restaurant-detail]")) === 1 && (await s.evalJs(`document.querySelector('.cr-det h2').textContent`)).length > 0);
check("detalj: restoran koji je suspendovan ima crveno upozorenje i dugme Uključi", (await s.count('[data-detail=alert]')) === 1 && (await s.count('[data-detail=activate]')) === 1 && (await s.count('[data-detail=suspend]')) === 0);
check("detalj: prazna polja su \"Nije upisano\", ne \"-\"", !(await visibleText(s, "[data-company=restaurant-detail]")).includes(" - "));
await cap(s, "f8-restoran-detalj", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
// uključi saradnju iz detalja
s.clearLog();
await s.click('[data-detail=activate]'); await sleep(500);
check("Uključi: otvara se list sa potvrdom", (await visibleText(s, ".as-title")) === "Uključi saradnju");
await s.click(".as-foot button[type=submit]"); await s.idle(600); await sleep(400);
const pr = s.logOf(/PATCH .*restaurant-delivery-company/);
check("PATCH uključivanja: active_restoran true bez razloga", pr.length === 1 && pr[0].body.active_restoran === true && !("suspension_reason" in pr[0].body), JSON.stringify(pr[0]?.body));
check("poslije uključivanja filter pokazuje jednog suspendovanog manje", (await texts(s, ".rr-st")).filter((t) => t.includes("Suspendovali")).length === oursRows.length - 1, `${oursRows.length} -> ${(await texts(s, ".rr-st")).length}`);
await s.click('[data-filter="reset"]'); await sleep(300);
// suspenzija
await type('[data-company=search]', "kr"); await sleep(300);
check("pretraga \"kr\": Krčma kod Ace i Pekara", (await texts(s, ".rr-name")).some((t) => t.includes("Krčma")), JSON.stringify(await texts(s, ".rr-name")));
await s.click('[data-row^="row:"]'); await sleep(400);
await s.click('[data-detail=suspend]'); await sleep(500);
check("Suspenduj: list sa razlogom i rečenicom o posljedici", (await visibleText(s, ".as-title")) === "Suspenduj saradnju" && (await visibleText(s, ".as")).includes("neće biti vidljive kuririma"));
await cap(s, "f9-suspenzija-list", { x: 264, y: 0, w: 1176, h: 900 }, { quality: 84 });
await s.click(".cs-chip"); await sleep(150);
check("brzi razlog popunjava polje", (await s.evalJs(`document.querySelector('.as textarea').value`)) === "Dug za proviziju");
s.mode.fails = [{ re: /PATCH .*restaurant-delivery-company/, status: 403, times: 1, body: { message: "Niste vezani za ovu firmu." } }];
s.clearLog();
await s.click(".as-foot button[type=submit]"); await s.idle(600); await sleep(300);
check("403: poruka ostaje u listu, razlog se ne gubi", (await visibleText(s, ".as [role=alert]"))?.includes("Nemaš pristup ovoj vezi") && (await s.evalJs(`document.querySelector('.as textarea').value`)) === "Dug za proviziju");
await s.click(".as-foot button[type=submit]"); await s.idle(600); await sleep(500);
const ps = s.logOf(/PATCH .*restaurant-delivery-company/).pop();
check("PATCH suspenzije: active_restoran false + razlog", ps && ps.body.active_restoran === false && ps.body.suspension_reason === "Dug za proviziju", JSON.stringify(ps?.body));
check("detalj pokazuje Suspendovali ste i razlog", (await visibleText(s, "[data-company=restaurant-detail]")).includes("Suspendovali ste") && (await visibleText(s, "[data-company=restaurant-detail]")).includes("Dug za proviziju"));
check("brojač Suspendovali ste je porastao", (await s.evalJs(`[...document.querySelectorAll('[data-company=filters] .tile')].find(t => t.textContent.includes('Suspendovali')).textContent`)).match(/\d+/)[0] !== "0");
await type('[data-company=search]', "zzzz"); await sleep(300);
check("nema rezultata: poruka i Očisti filtere", (await s.count("[data-company=restaurants-noresult]")) === 1 && (await visibleText(s, "[data-company=restaurants-noresult]")).includes("Nema restorana za „zzzz“"));
await s.click('[data-company=reset]'); await sleep(300);
check("Očisti filtere vraća listu", (await s.count('[data-row^="row:"]')) >= 12);
// strelice
await s.focusSel('[data-row^="row:"]');
await s.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
await sleep(400);
check("strelica dolje: fokus na sljedeći red i izbor ga prati", (await s.evalJs(`document.activeElement.getAttribute('aria-current')`)) === "true" && (await s.evalJs(`new URL(location.href).searchParams.get('r')`)) !== null);

console.log("\n== Greške učitavanja");
await s.close();
{
  const e = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); e.__name = "f";
  e.mode.fails = [{ re: /GET .*finance-settings/, status: 500, times: 2, body: { message: "Server Error" } }, { re: /GET \/dispatcher\/24\/restaurants/, status: 500, times: 2, body: { message: "Server Error" } }];
  await e.load("/dispatcher/company", { wait: "[data-company=settings-error]", extra: 600, timeout: 150000 }); await e.idle(600);
  check("pad učitavanja postavki: poruka u mjestu liste sa \"Pokušaj ponovo\"", (await visibleText(e, "[data-company=settings-error]"))?.includes("Ne mogu da učitam postavke") && (await e.count("[data-company=settings-error] button")) === 1);
  check("pad ne postavlja zajedničku poruku na vrh", (await e.count(".page-alert")) === 0);
  await cap(e, "f10-pad-ucitavanja", { x: 264, y: 0, w: 1176, h: 520 }, { quality: 84 });
  await e.click("[data-company=settings-error] button"); await e.idle(600); await sleep(400);
  check("Pokušaj ponovo učitava postavke", (await e.count("[data-setting=limit]")) === 1);
  await e.click('.tab-pill[data-tab="restaurants"]'); await sleep(600);
  check("pad učitavanja restorana: poruka sa Pokušaj ponovo", (await e.count("[data-company=restaurants-error]")) === 1);
  await e.click("[data-company=restaurants-error] button"); await e.idle(600); await sleep(500);
  check("Pokušaj ponovo učitava restorane", (await e.count('[data-row^="row:"]')) === 12);
  check("bez grešaka u konzoli (exception)", e.exceptions.length === 0, JSON.stringify(e.exceptions).slice(0, 300));
  await e.close();
}
{
  const e = await session("f", { width: 1440, height: 900, dpr: 1, mobile: false }); e.__name = "f";
  e.mode.restaurants[24] = [];
  await e.load("/dispatcher/company?t=restorani", { wait: "[data-company=restaurants-empty]", extra: 500, timeout: 150000 });
  check("nema restorana: kaže šta će se pojaviti", (await visibleText(e, "[data-company=restaurants-empty]"))?.includes("Poziv za saradnju šalje restoran"));
  check("nema restorana: nema pločica filtera", (await e.count("[data-company=filters]")) === 0);
  await cap(e, "f11-nema-restorana", { x: 264, y: 0, w: 1176, h: 520 }, { quality: 84 });
  await e.close();
}
console.log("\nkonzola/izuzeci glavne sesije:", JSON.stringify(s.exceptions).slice(0, 300));
process.exit(summary() ? 1 : 0);
