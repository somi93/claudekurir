// Dimni test table (board.preview.html): (A) telefon 390 px, (B) računar 1440 px sa komandama table, (C) svi okviri stanja, (D) slike i brojevi.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openProto, sleep, here, check, summary, results } from "./lib.mjs";

const boardUrl = pathToFileURL(path.join(here, "board.preview.html")).href;
const out = {};

// ---------- A: telefon 390 ----------
{
  const P = await openProto({ name: "board-smoke", width: 390, height: 844, mobile: true, dpr: 1, url: boardUrl });
  try {
    await sleep(4000);
    const ov = await P.ev(`(() => {
      const iw = innerWidth; const bad = [];
      for (const e of document.body.querySelectorAll('*')) {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.right <= iw + 1) continue;
        let p = e, clipped = false;
        while ((p = p.parentElement)) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; } }
        if (!clipped) bad.push(e.tagName.toLowerCase() + '.' + String(e.className && e.className.baseVal === undefined ? e.className : '').slice(0, 30) + ' r=' + Math.round(r.right));
      }
      return { sw: document.documentElement.scrollWidth, iw, bad: bad.slice(0, 12), n: bad.length };
    })()`);
    out.phoneOverflow = ov;
    check("telefon 390: bez vodoravnog klizanja stranice", ov.sw <= ov.iw, `scrollWidth ${ov.sw}, prozor ${ov.iw}`);
    check("telefon 390: nijedan element ne viri iz prozora (osim u svom pomičnom okviru)", ov.n === 0, ov.bad.join("; "));
    check("telefon 390: tabla odmah pokazuje okvir telefona", (await P.attr('[data-mode="phone"]', "aria-pressed")) === "true" && (await P.ev(`document.querySelector('#deskwrap').hidden && !document.querySelector('#p').hidden`)) === true);
    const pr = await P.rectOf("#p"), st1 = await P.rectOf(".stage");
    check("telefon 390: okvir telefona staje u pozornicu", pr && pr.x >= st1.x - 0.5 && pr.r <= st1.r + 0.5, `okvir ${Math.round(pr.x)}–${Math.round(pr.r)}, pozornica ${Math.round(st1.x)}–${Math.round(st1.r)}`);
    await P.shot("phone-stage-phone", { sel: ".stage" });
    const c = await P.scanContrast("#p .lv");
    check("telefon 390: kontrast teksta u okviru telefona ≥ 4.5", c.min >= 4.5, `najslabiji ${c.min}`);
    await P.tap('[data-mode="desk"]', { wait: 500 });
    const dk = await P.rectOf("#deskwrap");
    check("telefon 390: „Računar“ i dalje radi (okvir smanjen da stane)", dk && dk.w > 100 && dk.r <= 390, `okvir ${Math.round(dk.w)} px širok`);
    await P.shot("phone-stage-desk", { sel: ".stage" });
    await P.tap('[data-mode="phone"]', { wait: 400 });
    await P.ev(`document.querySelector('#odluke').scrollIntoView(); 1`);
    await P.shot("phone-odluke", { sel: "#odluke" });
    check("telefon 390: bez izuzetaka", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => String(e.text).slice(0, 120))));
    const errs = P.b.consoleMsgs.filter((m) => /error/.test(m.type));
    check("telefon 390: bez grešaka konzole", errs.length === 0, JSON.stringify(errs.map((m) => m.text.slice(0, 120))));
  } finally { await P.close(); }
}

// ---------- B: računar 1440, komande table ----------
{
  const P = await openProto({ name: "board-smoke", width: 1440, height: 900, mobile: false, dpr: 1, url: boardUrl });
  try {
    await sleep(4000);
    const chipN = (key) => P.ev(`(() => { const e = document.querySelector('#d .lv-chip[data-arg="${key}"] em'); return e ? e.textContent.trim() : null; })()`);
    const tiles = () => P.ev(`[...document.querySelectorAll('#d .lv-tile b')].map((e) => e.textContent.trim())`);
    check("računar: početne pločice 26 / 6 / 8 / 12", JSON.stringify(await tiles()) === JSON.stringify(["26", "6", "8", "12"]), JSON.stringify(await tiles()));
    check("računar: 'Bez signala' 3, 'Kasne' 3, 'Čeka kurira' 5, 'Čeka restoran' 3", (await chipN("lost")) === "3" && (await chipN("o:late")) === "3" && (await chipN("o:wait")) === "5" && (await chipN("o:rest")) === "3", `${await chipN("lost")} ${await chipN("o:late")} ${await chipN("o:wait")} ${await chipN("o:rest")}`);
    await P.click('[data-mode="phone"]', { wait: 400 });
    check("računar→telefon: okvir računara sakriven, telefon vidljiv", (await P.ev(`document.querySelector('#deskwrap').hidden && !document.querySelector('#p').hidden`)) === true);
    await P.waitFor(`!!document.querySelector('#p .lv-mk')`, { timeout: 8000 });
    check("telefon: okvir ima markere i traku odmah poslije prikaza", (await P.ev(`document.querySelectorAll('#p .lv-mk').length`)) >= 5);
    await P.click('[data-mode="desk"]', { wait: 400 });
    check("telefon→računar: vraćen okvir računara", (await P.ev(`!document.querySelector('#deskwrap').hidden && document.querySelector('#p').hidden`)) === true);
    // pomjeri kurire
    const pos0 = await P.ev(`(() => { const e = document.querySelector('#d .lv-mk--delivering:not(.is-lost)'); return e ? e.getAttribute('data-arg') + '|' + e.style.transform : null; })()`);
    await P.click('[data-sim="move"]', { wait: 300 });
    await sleep(1200);
    const pos1 = await P.ev(`(() => { const id = ${JSON.stringify(String(pos0).split("|")[0])}; const e = document.querySelector('#d .lv-mk[data-arg="' + id + '"]'); return e ? e.getAttribute('data-arg') + '|' + e.style.transform : null; })()`);
    check("Pomjeri kurire: marker kurira u dostavi je na novom mjestu", pos0 && pos1 && pos0 !== pos1, `${pos0} -> ${pos1}`);
    check("Pomjeri kurire: dugme potvrđuje", /pomjerili/.test(await P.text('[data-sim="move"]')), await P.text('[data-sim="move"]'));
    // ugasi aplikaciju
    await P.click('[data-sim="lose"]', { wait: 300 });
    await sleep(1500);
    check("Kuriru se ugasi aplikacija: oznaka 'Bez signala' raste sa 3 na 4", (await chipN("lost")) === "4", await chipN("lost"));
    check("Kuriru se ugasi aplikacija: na karti je još jedan isprekidan marker", (await P.ev(`document.querySelectorAll('#d .lv-mk.is-lost').length`)) === 4);
    // nova narudžba
    await P.click('[data-sim="order"]', { wait: 300 });
    await sleep(1500);
    check("Nova narudžba: 'Čeka kurira' raste sa 5 na 6", (await chipN("o:wait")) === "6", await chipN("o:wait"));
    check("Nova narudžba: dugme kaže koja je", /Nova narudžba #4290/.test(await P.text('[data-sim="order"]')), await P.text('[data-sim="order"]'));
    // pad servera
    await P.click('[data-sim="fail"]', { wait: 300 });
    await sleep(1600);
    check("Simuliraj pad servera: pojavi se upozorenje 'Pozicije nisu osvježene'", /Pozicije nisu osvježene/.test(await P.text("#d .lv-notes")), await P.text("#d .lv-notes"));
    await P.click("#d .lv-notes [data-act=retry]", { wait: 1200 });
    check("Pokušaj ponovo: upozorenje nestaje", (await P.count("#d .lv-notes .lv-tint")) === 0);
    // sat
    await P.click("#d .lv-row[data-arg='30234']", { wait: 600 });
    const before = await P.text("#d .lv-det .mt");
    await P.click('[data-sim="clock"]', { wait: 300 });
    await sleep(500);
    const after = await P.text("#d .lv-det .mt");
    check("Sat +10 min: starost signala duha raste (14 → 24 min)", /14 min/.test(before) && /24 min/.test(after), `${before} -> ${after}`);
    // vrati početno
    await P.click('[data-sim="reset"]', { wait: 1500 });
    await sleep(1500);
    check("Vrati početno stanje: opet 3 bez signala, 5 čeka kurira, nema izbora", (await chipN("lost")) === "3" && (await chipN("o:wait")) === "5" && (await P.count("#d .lv-det")) === 0, `${await chipN("lost")} ${await chipN("o:wait")}`);
    check("računar: bez izuzetaka", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => String(e.text).slice(0, 120))));
    const errs = P.b.consoleMsgs.filter((m) => /error/.test(m.type));
    check("računar: bez grešaka konzole", errs.length === 0, JSON.stringify(errs.map((m) => m.text.slice(0, 120))));
  } finally { await P.close(); }
}

// ---------- C: okviri stanja ----------
{
  const P = await openProto({ name: "board-smoke", width: 1440, height: 900, mobile: false, dpr: 1, url: boardUrl });
  try {
    await sleep(2500);
    // pomakni stranicu do poglavlja Stanja da okviri (lazy) krenu
    await P.ev(`document.querySelector('#stanja').scrollIntoView(); 1`);
    await sleep(4500);
    const frames = await P.ev(`[...document.querySelectorAll('#stanja .phone')].map((e) => ({ lv: !!e.querySelector('.lv'), text: e.innerText.replace(/\\s+/g, ' ').slice(0, 30000), rows: e.querySelectorAll('.lv-row').length, orows: e.querySelectorAll('.lv-orow').length, sheet: !!e.querySelector('.lv-sheet') }))`);
    out.frames = frames.map((f) => ({ lv: f.lv, rows: f.rows, orows: f.orows, sheet: f.sheet }));
    check("stanja: deset okvira, svi imaju prototip", frames.length === 10 && frames.every((f) => f.lv), `${frames.length} okvira`);
    const want = [/Ne mogu da učitam kurire/, /Ne mogu da učitam pozicije kurira/, /Pozicije nisu osvježene/, /Ne mogu da učitam narudžbe/, /Firma još nema kurira/, /Nijedan kurir ne šalje poziciju/, /Signal je izgubljen 14 min/, /Poruka kuriru Željko Đurić/, null, null];
    for (let i = 0; i < want.length; i++) {
      if (!want[i]) continue;
      check(`stanja[${i + 1}]: tekst ${want[i]}`, want[i].test(frames[i].text), frames[i].text.slice(0, 140));
    }
    check("stanja[9]: kasne narudžbe (3 reda)", frames[8].orows === 3, `${frames[8].orows}`);
    check("stanja[10]: filter 'Bez signala' (3 reda)", frames[9].rows === 3, `${frames[9].rows}`);
    check("stanja[8]: list za poruku je otvoren", frames[7].sheet === true);
    check("stanja: bez izuzetaka", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => String(e.text).slice(0, 120))));
  } finally { await P.close(); }
}

// ---------- D: slike, nalijepljeni brojevi, sidra ----------
{
  const P = await openProto({ name: "board-smoke", width: 1440, height: 900, mobile: false, dpr: 1, url: boardUrl });
  try {
    await sleep(2500);
    const info = await P.ev(`({ imgs: [...document.images].map((i) => i.complete && i.naturalWidth > 0), raw: /__M_|__IMG_/.test(document.body.innerHTML), anchors: [...document.querySelectorAll('nav.nav a')].map((a) => !!document.querySelector(a.getAttribute('href'))), nan: /NaN|undefined|\\[object/.test(document.body.innerText.replace(/„pre NaN dana“/g, '')) })`);
    check("tabla: sve slike su učitane", info.imgs.length >= 7 && info.imgs.every(Boolean), `${info.imgs.filter(Boolean).length}/${info.imgs.length}`);
    check("tabla: nijedan neispunjen __M_/__IMG_ u tekstu", info.raw === false);
    check("tabla: sva sidra u sadržaju vode na postojeći odjeljak", info.anchors.every(Boolean), JSON.stringify(info.anchors));
    check("tabla: u tekstu nema NaN, undefined ni [object", info.nan === false);
  } finally { await P.close(); }
}

out.checks = results.length;
fs.writeFileSync(path.join(here, "..", "out", "board-smoke.json"), JSON.stringify(out, null, 1));
const failed = summary();
process.exit(failed ? 1 : 0);
