// Provjera table cjenovnik-dizajn.html: greške u konzoli i tokovi glavnog prototipa (računar). Pokretanje: BOARD=/putanja/do/board.html node board-test.mjs
import { launch } from "./cdp.mjs";
import fs from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await launch({ shotsDir: process.env.OUT, width: 1440, height: 900, dpr: 1, mobile: false });
await b.goto("file://" + process.env.BOARD); await sleep(1200);
let pass = 0, fail = 0;
const ck = (n, ok, d = "") => { (ok ? pass++ : fail++); console.log((ok ? "  ✔ " : "  ✘ ") + n + (d ? " — " + d : "")); };
const ev = (e) => b.evalJs(e);
const P = "#proto ";
const q = (s) => ev(`!!document.querySelector(${JSON.stringify(P + s)})`);
const txt = (s) => ev(`(document.querySelector(${JSON.stringify(P + s)})||{}).textContent`).then((t) => (t || "").replace(/\s+/g, " ").trim());
const click = (s, text) => ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(P + s)})]; const e = ${text ? `els.find(x => x.textContent.includes(${JSON.stringify(text)}))` : "els[0]"}; if (!e) return false; e.click(); return true; })()`);
const setVal = (s, v) => ev(`(() => { const e = document.querySelector(${JSON.stringify(P + s)}); if (!e) return false; e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
const shot = async (n, sel) => { const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({block:"start"}); const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`); await sleep(250); const s = await b.send("Page.captureScreenshot", { format: "png", clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.w, height: Math.min(r.h, 1000), scale: 1 } }); fs.writeFileSync(process.env.OUT + "/" + n + ".png", Buffer.from(s.data, "base64")); };

await ev(`document.querySelector("#predlog").scrollIntoView()`); await sleep(400);
ck("prototip montiran, nema konzolnih grešaka", (await q(".ap-main")) && b.exceptions.length === 0 && !b.consoleMsgs.some((m) => m.type === "error"), JSON.stringify(b.exceptions.slice(0, 2).map((e) => e.text)));
ck("računar: bočna traka i dvije kolone", (await q(".ap-side")) && (await q(".pr-grid")));
ck("primjer narudžbe 7,45 KM", (await txt(".tot-h b")).startsWith("7,45"));
// nacrt cijene
await setVal("#pf-km", "8,00");
ck("nacrt: traka nesačuvanog", await q('[data-live="dirty"] .dirty'));
ck("nacrt: upozorenje o zarezu", (await txt(".ap-tint--warn")).includes("zarez"));
ck("nacrt: primjer piše Nacrt i ukupno 39,85", (await txt(".sm-h")).includes("Nacrt") && (await txt(".tot-h b")).startsWith("39,85"));
ck("nacrt: oznaka Nesačuvano u zaglavlju", (await txt(".ap-head .pr-st")).includes("Nesačuvano"));
await setVal("#pf-base", "");
ck("prazno polje: poruka uz polje, Sačuvaj onemogućen", (await txt("#pf-base-m")).includes("Unesi iznos") && (await ev(`document.querySelector('#proto [data-act="saveprice"]').disabled`)));
ck("prazno polje: obračun ne pada (ostaje broj)", /\d/.test(await txt(".tot-h b")));
await setVal("#pf-base", "2,50");
// pitanje pri prelasku
await click('[data-act="tab"][data-v="sur"]');
ck("prelazak sa nesačuvanim: pitanje", (await txt(".ap-guard")).includes("nesačuvane izmjene") && (await txt(".ap-tab[aria-selected=true]")).startsWith("Cijena"));
await click('[data-act="keep"]'); ck("Nastavi uređivanje ostaje na tabu", (await txt(".ap-tab[aria-selected=true]")).startsWith("Cijena"));
await click('[data-act="reset"]'); ck("Poništi vraća sačuvano", !(await q('[data-live="dirty"]')) && (await ev(`document.querySelector('#proto #pf-km').value`)) === "0,80");
await setVal("#pf-km", "0,90"); await click('[data-act="saveprice"]'); await sleep(700);
ck("Sačuvaj cijenu: poruka i nova cijena u primjeru", (await txt(".ap-toast")).includes("Cijena je sačuvana") && (await txt(".tot-h b")).startsWith("7,90"));
// šta ako
await click('[data-act="simsur"][data-id="502"]');
ck("šta ako: Noćna dostava u primjeru, ukupno 9,40, rub isprekidan", (await txt(".tot-h b")).startsWith("9,40") && (await q('.ch.diff')));
await click('[data-act="simreset"]'); ck("Vrati na stvarno", (await txt(".tot-h b")).startsWith("7,90"));
// doplate
await click('[data-act="tab"][data-v="sur"]');
ck("tab Doplate: 5 redova, katalog Snijeg i Brdovit teren (bez postojećih)", (await ev(`document.querySelectorAll('#proto .sr').length`)) === 5 && (await ev(`[...document.querySelectorAll('#proto .qa .ap-chip')].map(c=>c.textContent.trim()).join(',')`)) === "Snijeg,Brdovit teren");
await click('[data-act="stoggle"][data-id="503"]'); await sleep(200);
ck("uključi Gužvu: poruka sa posljedicom i Poništi, ukupno 8,90", (await txt(".ap-toast")).includes("Gužva") && (await txt(".ap-toast")).includes("8,90") && (await txt(".ap-toast")).includes("Poništi") && (await txt(".tot-h b")).startsWith("8,90"));
// otvori editor Kiša
await click('[data-act="sedit"][data-id="501"]'); await sleep(200);
ck("editor Kiša otvoren u redu", await q('.ed-in form[data-form="s"]'));
await setVal("#se-val", "0,50"); ck("uticaj: Za 4,5 km +2,25 KM", (await txt('[data-live="simp"]')).includes("+2,25"));
await setVal("#se-val", "abc"); ck("iznos abc: poruka uz polje, Sačuvaj onemogućen", (await txt("#se-val-m")).includes("Unesi broj") && (await ev(`document.querySelector('#proto [data-act="ssave"]').disabled`)));
await setVal("#se-val", "0,50"); await click('[data-act="ssave"]'); await sleep(200);
ck("izmjena sačuvana: Kiša +0,50 KM/km", (await ev(`[...document.querySelectorAll('#proto .sr')].find(r=>r.textContent.includes('Kiša')).textContent`)).includes("0,50"));
// nova doplata iz kataloga
await click('[data-act="qadd"][data-key="snow"]'); await sleep(200);
ck("Snijeg iz kataloga popunjava formu", (await ev(`document.querySelector('#proto #se-name').value`)) === "Snijeg");
await setVal("#se-name", "Gužva"); ck("isto ime: poruka uz polje", (await txt("#se-name-m")).includes("već postoji"));
await setVal("#se-name", "Snijeg"); await click('[data-act="ssave"]'); await sleep(200);
ck("Snijeg dodan isključen, nestaje iz kataloga", (await ev(`document.querySelectorAll('#proto .sr').length`)) === 6 && !(await ev(`[...document.querySelectorAll('#proto .qa .ap-chip')].some(c=>c.textContent.includes('Snijeg'))`)) && (await ev(`[...document.querySelectorAll('#proto .sr')].find(r=>r.textContent.includes('Snijeg')).textContent`)).includes("Isključena"));
// brisanje Kiše sa pravilom
await click('[data-act="sedit"][data-id="501"]'); await click('[data-act="sdel"]'); await sleep(200);
ck("brisanje: dijalog navodi pravilo", (await txt(".dlg")).includes("Doplata: Kiša") && (await txt(".dlg")).includes("jedno pravilo"));
await shot("b-dialog", "#stage");
await click('[data-act="dlgyes"]'); await sleep(200);
ck("poslije brisanja: 5 doplata i pravilo nestalo", (await ev(`document.querySelectorAll('#proto .sr').length`)) === 5);
// pravila
await click('[data-act="tab"][data-v="rules"]'); await sleep(200);
ck("pravila: 3 pravila + Sve ostalo (pravilo Kiša je obrisano sa doplatom)", (await ev(`document.querySelectorAll('#proto .rr2').length`)) === 4 && !(await txt(".rr2")).includes("Kiša"));
await click('[data-act="rnew"]'); await sleep(200);
ck("novo pravilo: uslovi Zona/Doplata/Udaljenost, bez Sve ostalo", (await ev(`[...document.querySelectorAll('#proto [data-act=choice][data-k=type]')].map(c=>c.querySelector('b').textContent.trim()).join(',')`)) === "Zona,Doplata,Udaljenost");
ck("novo pravilo: bez greške prije dodira", !(await txt(".ed-new")).includes("Izaberi bar jedno vozilo."));
await click('[data-act="choice"][data-v="dist"]'); await setVal("#re-min", "2"); await click('[data-act="vadd"][data-v="car"]');
await click('[data-act="rsave"]'); await sleep(200);
ck("novo pravilo ide iznad Sve ostalo", (await ev(`[...document.querySelectorAll('#proto .rr2')].map(r=>r.className.includes('def')?'D':'r').join('')`)).endsWith("rD"));
await click('[data-act="rnew"]'); await click('[data-act="choice"][data-v="dist"]'); await setVal("#re-min", "2"); await click('[data-act="vadd"][data-v="walk"]');
ck("isti uslov: upozorenje", (await txt(".ed-new")).includes("nikad ne primjenjuje"));
await click('[data-act="rclose"]');
await click('[data-act="rmove"][data-id="702"][data-d="1"]'); await sleep(150);
ck("pomjeranje pravila dolje", (await ev(`[...document.querySelectorAll('#proto .rr2')].map(r=>r.getAttribute('data-id')).join(',')`)).startsWith("703,702"));
// primjer: zona Centar poklapa pravilo
await ev(`(() => { const s = document.querySelector('#proto #sm-zone'); s.value = '11'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(150);
ck("zona Centar: poklapa se pravilo Zona: Centar", (await txt(".rr2.hit")).includes("Zona: Centar"));
await shot("b-rules", "#stage");
// telefon
await ev(`document.getElementById("dev-phone").click()`); await sleep(500);
ck("telefon: bez bočne trake, traka primjera na dnu", !(await q(".ap-side")) && (await q(".simbar")));
await click('.simbar'); await sleep(200);
ck("telefon: otvara se donji list Primjer narudžbe", (await txt(".ap-sheet")).includes("Primjer narudžbe"));
await shot("b-phone", "#stage");
console.log(`\nUkupno: ${pass}/${pass + fail} prošlo`);
console.log("konzola:", JSON.stringify(b.consoleMsgs.filter((m) => m.type === "error").map((m) => m.text.slice(0, 160))), JSON.stringify(b.exceptions.map((e) => String(e.text).slice(0, 160))));
await b.close();
