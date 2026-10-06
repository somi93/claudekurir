// Dimni test table: (A) telefon 390 px, (B) računar 1440 px sa komandama table. Curenje stilova je u board-leak.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openProto, sleep, here, check, summary, results } from "./plib.mjs";

const boardUrl = pathToFileURL(path.join(here, "board.preview.html")).href;
const out = {};

// ---------- A: telefon 390 ----------
{
  const P = await openProto({ name: "board-smoke", width: 390, height: 844, mobile: true, dpr: 1, url: boardUrl });
  try {
    await sleep(3500);
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
    check("telefon 390: tabla odmah pokazuje okvir telefona", (await P.attr('[data-mode="phone"]', "aria-pressed")) === "true" && (await P.ev(`document.querySelector('#deskwrap').hidden && !document.querySelector('#proto-p').hidden`)) === true);
    const pr = await P.rectOf("#proto-p"), st1 = await P.rectOf(".stage");
    out.stagePhone = { stage: st1, frame: pr };
    check("telefon 390: okvir telefona staje u pozornicu", pr && pr.x >= st1.x - 0.5 && pr.r <= st1.r + 0.5, `okvir ${Math.round(pr.x)}–${Math.round(pr.r)}, pozornica ${Math.round(st1.x)}–${Math.round(st1.r)}`);
    await P.shot("phone-stage-phone", { sel: ".stage" });
    const c = await P.scanContrast("#proto-p .fc");
    out.phoneFrameContrast = { min: c.min, bad: c.bad.slice(0, 5) };
    check("telefon 390: kontrast teksta u okviru telefona ≥ 4.5", c.min >= 4.5, `najslabiji ${c.min}`);
    await P.tap('[data-mode="desk"]', { wait: 400 });
    const dk = await P.rectOf("#deskwrap");
    check("telefon 390: „Računar“ i dalje radi (okvir smanjen da stane)", dk && dk.w > 100 && dk.r <= 390, `okvir ${Math.round(dk.w)} px širok`);
    out.deskScale = { transform: await P.ev(`getComputedStyle(document.querySelector('#proto-d')).transform`), rect: dk };
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
    await sleep(3500);
    const badge = () => P.ev(`(() => { const e = document.querySelector('#proto-d [data-fk="tab-stanje"] .fc-badge'); return e ? e.textContent.trim() : null; })()`);
    const tabs = await P.texts("#proto-d [role=tab]");
    out.tabs = tabs;
    check("računar: dva taba (Stanje, Promet)", tabs.length === 2 && /Stanje/.test(tabs[0]) && /Promet/.test(tabs[1]), JSON.stringify(tabs));
    await P.click('[data-mode="phone"]', { wait: 300 });
    check("računar→telefon: okvir računara sakriven, telefon vidljiv", (await P.ev(`document.querySelector('#deskwrap').hidden && !document.querySelector('#proto-p').hidden`)) === true);
    check("telefon: aria-pressed prati izbor", (await P.attr('[data-mode="phone"]', "aria-pressed")) === "true" && (await P.attr('[data-mode="desk"]', "aria-pressed")) === "false");
    await P.click('[data-mode="desk"]', { wait: 300 });
    check("telefon→računar: vraćen okvir računara", (await P.ev(`!document.querySelector('#deskwrap').hidden && document.querySelector('#proto-p').hidden`)) === true);
    // nova predaja
    const before = await badge();
    check("računar: na početku značka na tabu Stanje pokazuje 4", before === "4", `značka ${before}`);
    await P.click('[data-sim="pending"]', { wait: 200 });
    const lbl = await P.text('[data-sim="pending"]');
    check("Simuliraj novu predaju: dugme potvrđuje slanje", /poslata/.test(lbl), lbl);
    const ok = await P.waitFor(`(() => { const e = document.querySelector('#proto-d [data-fk="tab-stanje"] .fc-badge'); return !!e && e.textContent.trim() === '5'; })()`, { timeout: 14000 }).then(() => true, () => false);
    out.afterPending = { before, badge: await badge() };
    check("Simuliraj novu predaju: stranica je u roku od 8 s pokupila novu predaju (značka 4 → 5)", ok, `značka ${out.afterPending.badge}`);
    const menuBadge = await P.ev(`(() => { const e = document.querySelector('#proto-d .fc-side .nb'); return e ? e.textContent.trim() : null; })()`);
    check("Simuliraj novu predaju: značka u meniju je ista (5)", menuBadge === "5", `meni ${menuBadge}`);
    // pad servera
    await P.click('[data-sim="fail"]', { wait: 200 });
    check("Simuliraj pad servera: dugme potvrđuje", /pasti|pad/.test(await P.text('[data-sim="fail"]')), await P.text('[data-sim="fail"]'));
    // vraćanje
    await P.click('[data-sim="reset"]', { wait: 1200 });
    const after = await badge();
    check("Vrati početno stanje: prototip je ponovo postavljen (značka opet 4)", after === "4", `značka ${after}`);
    check("računar: bez izuzetaka", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => String(e.text).slice(0, 120))));
    const errs = P.b.consoleMsgs.filter((m) => /error/.test(m.type));
    check("računar: bez grešaka konzole", errs.length === 0, JSON.stringify(errs.map((m) => m.text.slice(0, 120))));
  } finally { await P.close(); }
}

// ---------- D: „Izvezi CSV“ u tabli (lažna zamjena za mogućnost `downloads` Artifacta) ----------
{
  const P = await openProto({ name: "board-smoke", width: 1440, height: 900, mobile: false, dpr: 1, url: boardUrl });
  try {
    await sleep(3500);
    await P.click('#proto-d [data-act="tab"][data-arg="promet"]', { wait: 400 });
    await P.waitFor(`!!document.querySelector('#proto-d [data-act="csv"]:not([disabled])')`, { timeout: 8000 });
    const toastText = () => P.ev(`(() => { const t = document.querySelector('#proto-d .fc-toast'); return t && !t.hidden ? { text: t.textContent.replace(/\\s+/g, ' ').trim(), err: t.classList.contains('fc-toast--err') } : null; })()`);
    const press = async (stub, re) => {
      await P.ev(`(() => { window.__saved = null; const t = document.querySelector('#proto-d .fc-toast'); if (t) { t.hidden = true; t.textContent = ''; } ${stub}; return 1; })()`);
      await P.click('#proto-d [data-act="csv"]', { wait: 50 });
      await P.waitFor(`(() => { const t = document.querySelector('#proto-d .fc-toast'); return !!t && !t.hidden && ${re}.test(t.textContent); })()`, { timeout: 4000 }).catch(() => null);
      return { toast: await toastText(), saved: await P.ev(`window.__saved ? { filename: window.__saved.filename, bom: window.__saved.data.charCodeAt(0) === 0xFEFF, header: window.__saved.data.slice(1, 40), lines: window.__saved.data.split('\\r\\n').length } : null`) };
    };
    const accepted = await press(`window.claude = { use: (n) => Promise.resolve(n === 'downloads' ? { save: (r) => { window.__saved = { filename: r.filename, data: r.data }; return Promise.resolve({ status: 'saved' }); } } : null) }`, "/Izvezeno/");
    out.csvAccepted = accepted;
    check("CSV u tabli: prihvaćeno čuvanje → obavještenje sa imenom datoteke", accepted.toast && /^Izvezeno \d+ (red|reda|redova): finansije-2026-10-06\.csv$/.test(accepted.toast.text) && !accepted.toast.err, JSON.stringify(accepted.toast));
    check("CSV u tabli: datoteka ide u downloads.save sa pravim imenom, BOM-om i zaglavljem", accepted.saved && accepted.saved.filename === "finansije-2026-10-06.csv" && accepted.saved.bom && accepted.saved.header.startsWith("Datum;Vrijeme;Vrsta;Kurir;ID kurira"), JSON.stringify(accepted.saved));
    const declined = await press(`window.claude = { use: (n) => Promise.resolve(n === 'downloads' ? { save: () => Promise.reject({ code: 'declined', message: 'x' }) } : null) }`, "/odbijeno/");
    check("CSV u tabli: odbijeno čuvanje → piše da datoteka nije sačuvana", declined.toast && /Preuzimanje je odbijeno: finansije-2026-10-06\.csv nije sačuvan\./.test(declined.toast.text) && !declined.toast.err, JSON.stringify(declined.toast));
    const none = await press(`window.claude = { use: () => Promise.resolve(null) }`, "/ne može/");
    check("CSV u tabli: mogućnost nedostupna → greška kaže da se ne može preuzeti", none.toast && /ne može preuzeti/.test(none.toast.text) && none.toast.err === true, JSON.stringify(none.toast));
    const bare = await press(`delete window.claude`, "/ne može/");
    check("CSV u tabli: bez window.claude → ista poruka, bez lažnog „Izvezeno“", bare.toast && /ne može preuzeti/.test(bare.toast.text) && !/Izvezeno/.test(bare.toast.text), JSON.stringify(bare.toast));
    check("CSV u tabli: bez izuzetaka", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => String(e.text).slice(0, 120))));
  } finally { await P.close(); }
}

out.checks = results.length;
fs.writeFileSync(path.join(here, "board-smoke.json"), JSON.stringify(out, null, 1));
const failed = summary();
process.exit(failed ? 1 : 0);
