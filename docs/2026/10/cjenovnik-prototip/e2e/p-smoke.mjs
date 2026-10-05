// Dimni test integrisane stranice Cjenovnik (/dispatcher/pricing) u pravom Chrome-u nad lažnim API-jem (pr-fx.mjs).
// Za računar 1440x900, telefon 390x844 i uzak telefon 320x640: učita stranicu, obiđe tri taba, otvori po jedan editor
// i prijavi: greške u konzoli (console.error, neuhvaćeni izuzeci, Vue warn, hydration mismatch), data-atribute iz
// ugovora koji fale, vodoravni skrol, mete ispod 44 px, kontrast ispod 4.5:1 i polja bez imena.
// Pokretanje iz korijena aplikacije (dev server i Chrome kao u README.md):
//   REPO_ROOT=$PWD CHROME_PATH=/opt/pw-browsers/chromium CDP_PORT=9340 MDI_DIR=.../@mdi/font/ node docs/2026/10/cjenovnik-prototip/e2e/p-smoke.mjs
// Zamka: čekati klijentski sadržaj (input), ne SSR kostur.
import { session, sleep, check, summary } from "./nh.mjs";
import { scanContrast, smallTargets, unnamedFields } from "./flib.mjs";

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

// Buka koja nije iz ove stranice: Vuetify prevodi (sr), razvojni alati.
const NOISE = [/\[intlify\]/i, /nuxt-devtools/i, /Download the Vue Devtools/i, /\[vite\]/i, /favicon/i];

const loadPage = async (s, path = "/dispatcher/pricing") => {
  await s.load(path, { wait: "input[data-field=base]", extra: 500, timeout: 170000 });
  await s.idle(900);
  await sleep(300);
};

// Broj VIDLJIVIH elemenata (neka veličina i nije skriven): sakriveni sadržaj ne smije prolaziti kao "postoji".
const vis = (s, sel) =>
  s.evalJs(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return (r.width > 0 && r.height > 0 && c.visibility !== 'hidden') || e.closest('.sr-only') ; }).length`);

const need = async (s, state, sels) => {
  for (const sel of sels) check(`${state}: ${sel}`, (await vis(s, sel)) > 0);
};

const noHScroll = async (s, state) => {
  const m = await s.evalJs(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth })`);
  check(`${state}: nema vodoravnog skrola`, m.sw <= m.cw && m.bw <= m.cw, `scrollWidth ${m.sw}, clientWidth ${m.cw}`);
};

// Mete, kontrast i imena polja u okviru `root` (donji listovi su izvan .global-page, pa za njih ".v-overlay-container").
const audit = async (s, state, root = ".global-page") => {
  const small = await smallTargets(s, root);
  check(`${state}: mete najmanje 44 x 44`, small.length === 0, small.map((t) => `${t.t} ${t.w}x${t.h}`).join("; "));
  const names = await unnamedFields(s, root);
  check(`${state}: sva polja imaju ime`, names.length === 0, JSON.stringify(names));
  const con = await scanContrast(s, root);
  // Tekst samo za čitač ekrana (1 px, isječen) nije vidljiv, pa kontrast za njega ne važi.
  const bad = con.bad.filter((b) => !/(^|[ -])sr(-only)?[ "]|-sr /.test(b));
  check(`${state}: kontrast najmanje 4,5:1`, bad.length === 0, `min ${con.min}; ${bad.slice(0, 4).join(" | ")}`);
};

const pick = (s, sel, value) =>
  s.evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

const tab = async (s, value, ready) => {
  await s.click(`[data-tab=${value}]`);
  await s.waitFor(`!!document.querySelector(${JSON.stringify(ready)})`, { timeout: 20000, label: ready });
  await s.idle(700);
  await sleep(250);
};

// Zatvara donji list (telefon) tasterom X; na računaru nema šta da zatvori.
const closeSheet = async (s) => {
  if (!(await vis(s, ".v-overlay--active .as"))) return;
  await s.click(".v-overlay--active .as-ib");
  await sleep(500);
};

const scenario = async (name, o) => {
  const phone = o.width < 1000;
  const label = `${name}`;
  console.log(`\n=== ${label} (${o.width}x${o.height}) ===`);
  const s = await session(`smoke-${name}`, { ...o, dpr: 1 });
  s.__name = `smoke-${name}`;
  // Obavijesti (globalni toast, 10 s) se slažu uz vrh sredine ekrana i mogu prekriti dugme koje test pritišće
  // (npr. "Nova doplata"); pravi korisnik ih zatvori ili sačeka, pa ih test zatvara prije svakog klika.
  const rawClick = s.click;
  s.click = async (...a) => {
    await s.evalJs(`document.querySelectorAll('.global-alert-card .v-alert__close button, .global-alert-card button[aria-label]').forEach((b) => b.click())`);
    await sleep(120);
    return rawClick(...a);
  };
  try {
    await loadPage(s);

    // ---------- Cijena ----------
    await need(s, `${label} / Cijena`, [
      "[data-pricing=price-tab]", "[data-pricing=price-card]", "input[data-field=base]", "input[data-field=km]",
      "[data-pricing=ladder]", "[data-pricing=currency-row]",
    ]);
    check(`${label} / Cijena: tabela ima redove po udaljenosti`, (await s.count("[data-pricing=ladder] tbody tr")) >= 4);
    check(`${label} / Cijena: zaglavlje i oznaka stanja`, /Cjenovnik/.test((await s.text(".page-title")) ?? "") && (await s.q(".ssc[data-state=saved]")));
    check(`${label} / Cijena: tabovi imaju ime`, (await s.evalJs(`document.querySelector('[role=tablist]')?.getAttribute('aria-label')`)) === "Sekcije cjenovnika");
    await noHScroll(s, `${label} / Cijena`);
    await audit(s, `${label} / Cijena`);

    // Primjer narudžbe: računar (kolona) ili traka + list (telefon).
    if (phone) {
      await need(s, `${label} / Primjer (traka)`, ["[data-pricing=sim-bar]"]);
      check(`${label} / Primjer: kolone nema na telefonu`, (await vis(s, "aside[aria-label='Primjer narudžbe']")) === 0);
      await s.click("[data-pricing=sim-bar]");
      await s.waitFor(`!!document.querySelector('[data-pricing=sim-sheet] [data-sim=dist]')`, { timeout: 8000 });
      await sleep(500);
    } else {
      check(`${label} / Primjer: desna kolona`, (await vis(s, "aside[aria-label='Primjer narudžbe'] [data-pricing=sim]")) === 1);
      const grid = await s.evalJs(`(() => { const g = document.querySelector('.pr-grid'); const l = document.querySelector('.pr-l').getBoundingClientRect(); const r = document.querySelector('.pr-r').getBoundingClientRect(); return { l: Math.round(l.width), r: Math.round(r.width), gap: Math.round(r.left - l.right) }; })()`);
      check(`${label} / Primjer: rad ≥ 480 px, kolona 372 px, razmak 20 px`, grid.l >= 480 && grid.r === 372 && grid.gap === 20, JSON.stringify(grid));
    }
    await need(s, `${label} / Primjer`, [
      "[data-pricing=sim]", "[data-pricing=sim-total]", "[data-pricing=sim-lines]", "[data-pricing=sim-vehicle]",
      "[data-pricing=sim-rule]", "[data-pricing=sim-open-rule]", "[data-sim=dist]", "[data-sim=dist-minus]",
      "[data-sim=dist-plus]", "[data-sim=zone]", "[data-sim-sur='501']", "[data-sim-sur='503']",
    ]);
    const before = await s.text("[data-pricing=sim-total]");
    await s.click("[data-sim=dist-plus]");
    await sleep(300);
    const after = await s.text("[data-pricing=sim-total]");
    check(`${label} / Primjer: veća udaljenost mijenja ukupno`, before && after && before !== after, `${before} -> ${after}`);
    await s.click("[data-sim=dist-minus]");
    await s.click("[data-sim-sur='503']");
    await sleep(300);
    await need(s, `${label} / Primjer (šta ako)`, ["[data-pricing=sim-reset]"]);
    await s.click("[data-pricing=sim-reset]");
    await sleep(250);
    check(`${label} / Primjer: Vrati na stvarno skida oznaku`, (await vis(s, "[data-pricing=sim-reset]")) === 0);
    await noHScroll(s, `${label} / Primjer`);
    await audit(s, `${label} / Primjer`, phone ? ".v-overlay-container" : "aside[aria-label='Primjer narudžbe']");
    await closeSheet(s);

    // Nacrt cijene: traka, provjera iznosa, poništavanje.
    await s.clearField("input[data-field=base]");
    await s.typeText("50");
    await sleep(300);
    await need(s, `${label} / Nacrt`, ["[data-pricing=dirty-bar]", "[data-pricing=save-price]", "[data-pricing=reset-price]", "[data-pricing=sanity]"]);
    check(`${label} / Nacrt: tačka na tabu Cijena`, (await vis(s, "[data-tab=price] [data-tab-dot]")) > 0);
    check(`${label} / Nacrt: oznaka Nesačuvano`, (await vis(s, ".ssc[data-state=unsaved]")) === 1);
    await noHScroll(s, `${label} / Nacrt`);
    await audit(s, `${label} / Nacrt`);
    // Traka nesačuvanog ne smije prekriti traku Primjera (telefon) niti izaći iz prozora.
    const barBox = await s.evalJs(`(() => { const b = document.querySelector('[data-pricing=dirty-bar]'); const sb = document.querySelector('[data-pricing=sim-bar]'); const r = b.getBoundingClientRect(); const q = sb ? sb.getBoundingClientRect() : null; return { bottom: Math.round(r.bottom), simTop: q ? Math.round(q.top) : null, vh: innerHeight, top: Math.round(r.top) }; })()`);
    check(`${label} / Nacrt: traka je u prozoru i iznad trake Primjera`, barBox.bottom <= (barBox.simTop ?? barBox.vh) + 1 && barBox.top >= 0, JSON.stringify(barBox));

    // Pitanje pri prelasku: promjena taba sa nacrtom pita, "Nastavi uređivanje" ostaje.
    await s.click("[data-tab=surcharges]");
    await sleep(400);
    await need(s, `${label} / Pitanje`, ["[data-pricing=guard]", "[data-discard=keep]", "[data-discard=drop]"]);
    check(`${label} / Pitanje: fokus je na "Nastavi uređivanje"`, (await s.evalJs(`document.activeElement?.getAttribute('data-discard')`)) === "keep");
    await audit(s, `${label} / Pitanje`);
    await s.click("[data-discard=keep]");
    await sleep(300);
    check(`${label} / Pitanje: Nastavi uređivanje zadržava tab Cijena`, (await vis(s, "[data-pricing=price-card]")) === 1 && (await vis(s, "[data-pricing=guard]")) === 0);
    // Sačuvaj: validan iznos, PUT, poruka.
    await s.clearField("input[data-field=base]");
    await s.typeText("2,6");
    await sleep(250);
    s.clearLog();
    await s.click("[data-pricing=save-price]");
    await s.idle(700);
    const put = s.logOf(/PUT .*\/pricing$/);
    check(`${label} / Sačuvaj cijenu šalje brojeve`, put.length === 1 && put[0].body && put[0].body.base_price === 2.6 && typeof put[0].body.price_per_km === "number", JSON.stringify(put[0]?.body));
    await sleep(400);
    check(`${label} / Sačuvaj cijenu: traka nestaje`, (await vis(s, "[data-pricing=dirty-bar]")) === 0);
    // Poništi
    await s.clearField("input[data-field=km]");
    await s.typeText("0,9");
    await sleep(250);
    await s.click("[data-pricing=reset-price]");
    await sleep(300);
    check(`${label} / Poništi vraća sačuvano`, (await s.evalJs(`document.querySelector('input[data-field=km]').value`)) === "0,80");

    // ---------- Doplate ----------
    await tab(s, "surcharges", "[data-surcharge]");
    await need(s, `${label} / Doplate`, [
      "[data-pricing=surcharges-tab]", "[data-pricing=surcharge-list]", "[data-surcharge='501']",
      "input[data-surcharge-toggle='501']", "[data-surcharge-open='501']", "[data-pricing=surcharge-new]", "[data-catalog='tag:2']",
    ]);
    check(`${label} / Doplate: prekidači imaju ime`, /doplatu/i.test((await s.evalJs(`document.querySelector("input[data-surcharge-toggle='501']").getAttribute('aria-label')`)) ?? ""));
    await noHScroll(s, `${label} / Doplate`);
    await audit(s, `${label} / Doplate`);
    // Prekidač
    s.clearLog();
    await s.click("input[data-surcharge-toggle='503']");
    await s.idle(700);
    const tog = s.logOf(/PUT .*surcharges\/503/);
    check(`${label} / Doplate: prekidač šalje samo {active}`, tog.length === 1 && JSON.stringify(tog[0].body) === '{"active":true}', JSON.stringify(tog[0]?.body));
    await sleep(300);
    // Greška prekidača ide u red
    s.setFlags({ fails: [{ re: /PUT .*surcharges\/\d+/, status: 500, times: 1 }] });
    await s.click("input[data-surcharge-toggle='505']");
    await s.idle(700);
    await sleep(300);
    await need(s, `${label} / Doplate (greška prekidača)`, ["[data-surcharge='505'] [data-pricing=row-error]"]);
    await noHScroll(s, `${label} / Doplate greška`);
    // Editor postojeće doplate
    await s.click("[data-surcharge-open='502']");
    await s.waitFor(`!!document.querySelector('[data-pricing=surcharge-editor] input[data-field=name]')`, { timeout: 8000 });
    await sleep(500);
    await need(s, `${label} / Editor doplate`, [
      "[data-pricing=surcharge-editor]", "input[data-field=name]", "input[data-field=val]", "input[data-field=desc]",
      "[data-field=type]", "[data-field=sched]", "[data-field=type] [data-choice=fixed]", "[data-field=sched] [data-choice=auto]",
      "input[data-field=from]", "input[data-field=to]", "[data-pricing=surcharge-impact]", "[data-pricing=surcharge-save]",
      "[data-pricing=surcharge-cancel]", "[data-pricing=surcharge-delete]",
    ]);
    // Grupe izbora nose data-choice=type|sched, a svaka opcija (ChoiceGroup) data-choice=<vrijednost>.
    check(`${label} / Editor doplate: [data-choice=type] [data-choice=fixed]`, (await vis(s, "[data-choice=type] [data-choice=fixed]")) > 0);
    check(`${label} / Editor doplate: [data-choice=sched] [data-choice=auto]`, (await vis(s, "[data-choice=sched] [data-choice=auto]")) > 0);
    await noHScroll(s, `${label} / Editor doplate`);
    await audit(s, `${label} / Editor doplate`, phone ? ".v-overlay-container" : ".global-page");
    // izmjena -> tačka na tabu, server šalje puno tijelo bez active
    await s.clearField("[data-pricing=surcharge-editor] input[data-field=val]");
    await s.typeText("1,7");
    await sleep(250);
    check(`${label} / Editor doplate: tačka na tabu Doplate`, (await vis(s, "[data-tab=surcharges] [data-tab-dot]")) > 0);
    s.clearLog();
    await s.click("[data-pricing=surcharge-save]");
    await s.idle(800);
    const upd = s.logOf(/PUT .*surcharges\/502/);
    check(`${label} / Editor doplate: čuvanje šalje puno tijelo bez active`, upd.length === 1 && upd[0].body && upd[0].body.value === 1.7 && !("active" in upd[0].body), JSON.stringify(upd[0]?.body));
    await sleep(700);
    check(`${label} / Editor doplate: zatvoren poslije čuvanja`, (await vis(s, "[data-pricing=surcharge-editor] input[data-field=name]")) === 0);
    check(`${label} / Editor doplate: izmjena ne dira activated_at`, s.mode.pr.surcharges[24].find((x) => x.id === 502).activated_at === null);
    // Nova doplata
    await s.click("[data-pricing=surcharge-new]");
    await s.waitFor(`!!document.querySelector('[data-pricing=surcharge-editor] input[data-field=name]')`, { timeout: 8000 });
    await sleep(400);
    await need(s, `${label} / Nova doplata`, ["input[data-field=on]", "[data-pricing=surcharge-save]", "[data-pricing=surcharge-cancel]"]);
    check(`${label} / Nova doplata: nema dugmeta Obriši`, (await vis(s, "[data-pricing=surcharge-delete]")) === 0);
    await audit(s, `${label} / Nova doplata`, phone ? ".v-overlay-container" : ".global-page");
    await s.click("[data-pricing=surcharge-cancel]");
    await sleep(700);
    check(`${label} / Nova doplata: Otkaži zatvara`, (await vis(s, "[data-pricing=surcharge-editor] input[data-field=name]")) === 0);
    // Katalog
    await s.click("[data-catalog='tag:2']");
    await s.waitFor(`!!document.querySelector('[data-pricing=surcharge-editor] input[data-field=name]')`, { timeout: 8000 });
    await sleep(400);
    check(`${label} / Katalog: naziv je popunjen`, (await s.evalJs(`document.querySelector('[data-pricing=surcharge-editor] input[data-field=name]').value`)) === "Snijeg");
    await s.click("[data-pricing=surcharge-cancel]");
    await sleep(700);

    // ---------- Vozila i pravila ----------
    await tab(s, "rules", "[data-rule]");
    await need(s, `${label} / Pravila`, [
      "[data-pricing=rules-tab]", "[data-rule='701']", "[data-rule='705'][data-rule-fallback]", "[data-rule-open='701']",
      "[data-rule-move='702:up']", "[data-rule-move='702:down']", "[data-pricing=rule-new]", "[data-pricing=rule-matched]",
    ]);
    await noHScroll(s, `${label} / Pravila`);
    await audit(s, `${label} / Pravila`);
    // Pomjeranje
    s.clearLog();
    await s.click("[data-rule-move='702:up']");
    await s.idle(900);
    const moves = s.logOf(/PUT .*vehicle-rules\/\d+/);
    check(`${label} / Pravila: pomjeranje šalje priority za dva pravila`, moves.length === 2 && moves.every((m) => m.body && "priority" in m.body), JSON.stringify(moves.map((m) => m.body)));
    await sleep(500);
    const order = await s.evalJs(`[...document.querySelectorAll('[data-rule]')].map((e) => e.getAttribute('data-rule')).join(',')`);
    check(`${label} / Pravila: redoslijed poslije pomjeranja`, order === "702,701,703,704,705", order);
    // Editor postojećeg pravila
    await s.click("[data-rule-open='703']");
    await s.waitFor(`!!document.querySelector('[data-pricing=rule-editor]')`, { timeout: 8000 });
    await sleep(600);
    await need(s, `${label} / Editor pravila`, [
      "[data-pricing=rule-editor]", "[data-field=type]", "select[data-field=zone]", "input[data-field=maxT]", "input[data-field=note]",
      "[data-veh-add=car]", "[data-veh-add=motorbike]", "[data-veh-add=bicycle]", "[data-veh-add=walk]", "[data-veh-remove='0']",
      "[data-pricing=rule-save]", "[data-pricing=rule-cancel]", "[data-pricing=rule-delete]",
    ]);
    await noHScroll(s, `${label} / Editor pravila`);
    await audit(s, `${label} / Editor pravila`, phone ? ".v-overlay-container" : ".global-page");
    await s.click("[data-field=type] [data-choice=distance]");
    await sleep(250);
    await need(s, `${label} / Editor pravila (udaljenost)`, ["input[data-field=min]", "input[data-field=max]"]);
    await s.click("[data-field=type] [data-choice=surcharge]");
    await sleep(250);
    await need(s, `${label} / Editor pravila (doplata)`, ["select[data-field=sur]"]);
    await s.click("[data-pricing=rule-cancel]");
    await sleep(700);
    // Novo pravilo + isti uslov
    await s.click("[data-pricing=rule-new]");
    await s.waitFor(`!!document.querySelector('[data-pricing=rule-editor]')`, { timeout: 8000 });
    await sleep(500);
    await s.click("[data-field=type] [data-choice=zone]");
    await sleep(250);
    await pick(s, "select[data-field=zone]", "11");
    await sleep(300);
    await need(s, `${label} / Novo pravilo (isti uslov)`, ["[data-pricing=rule-dup]"]);
    check(`${label} / Novo pravilo: nema dugmeta Obriši`, (await vis(s, "[data-pricing=rule-delete]")) === 0);
    await audit(s, `${label} / Novo pravilo`, phone ? ".v-overlay-container" : ".global-page");
    // Otkaži zatvara; "Otvori pravilo" iz Primjera vodi na tab Vozila (već jesmo na njemu): provjera na Cijeni
    await s.click("[data-pricing=rule-cancel]");
    await sleep(700);
    // Isticanje: Otvori pravilo iz Primjera sa taba Doplate
    await tab(s, "surcharges", "[data-surcharge]");
    if (phone) {
      await s.click("[data-pricing=sim-bar]");
      await s.waitFor(`!!document.querySelector('[data-pricing=sim-sheet] [data-pricing=sim-open-rule]')`, { timeout: 8000 });
      await sleep(400);
    }
    await s.click("[data-pricing=sim-open-rule]");
    await sleep(900);
    check(`${label} / Otvori pravilo: tab Vozila`, (await vis(s, "[data-pricing=rules-tab]")) === 1 && /t=vozila/.test(await s.evalJs(`location.search`)));
    await closeSheet(s);

    // ---------- Stanja: učitavanje i pad učitavanja ----------
    s.setFlags({ delays: [{ re: /GET .*\/pricing$/, ms: 2500 }], fails: [] });
    await s.goto(`http://localhost:3100/dispatcher/pricing`);
    await s.waitFor(`!!document.querySelector('[data-pricing=price-loading]')`, { timeout: 60000 });
    check(`${label} / Učitavanje: skeleton sa aria-busy`, (await s.evalJs(`document.querySelector('[data-pricing=price-loading]')?.getAttribute('aria-busy')`)) === "true");
    await s.waitFor(`!!document.querySelector('input[data-field=base]')`, { timeout: 30000 });
    s.setFlags({ delays: [], fails: [{ re: /GET .*\/pricing$/, status: 500, times: 99 }] });
    await s.goto(`http://localhost:3100/dispatcher/pricing`);
    await s.waitFor(`!!document.querySelector('[data-pricing=price-error]')`, { timeout: 60000 });
    await need(s, `${label} / Pad učitavanja`, ["[data-pricing=price-error]", "[data-pricing=retry]"]);
    await noHScroll(s, `${label} / Pad učitavanja`);
    await audit(s, `${label} / Pad učitavanja`);
    s.setFlags({ fails: [] });
    await s.click("[data-pricing=retry]");
    await s.waitFor(`!!document.querySelector('input[data-field=base]')`, { timeout: 30000 });
    check(`${label} / Pad učitavanja: Pokušaj ponovo vraća formu`, true);
    await sleep(300);
  } catch (e) {
    check(`${label}: scenarij je prekinut`, false, String(e.message).slice(0, 300));
    // Snimak i stanje u trenutku prekida, da se vidi šta je stranica pokazivala.
    try {
      await s.shot(`prekid-${name}`);
      const st = await s.evalJs(`({ url: location.href, alerts: [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120)), editors: document.querySelectorAll('[data-pricing$=editor]').length, active: document.activeElement?.outerHTML.slice(0, 160), sy: scrollY, newBtn: (() => { const b = document.querySelector('[data-pricing=surcharge-new]'); if (!b) return null; const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { y: Math.round(r.top), hit: t ? t.outerHTML.slice(0, 120) : null }; })() })`);
      console.log("  stanje pri prekidu:", JSON.stringify(st));
    } catch {}
  }

  // ---------- Konzola ----------
  const bad = (m) => !NOISE.some((re) => re.test(m.text));
  const errs = s.consoleMsgs.filter((m) => m.type === "error" && bad(m));
  const warns = s.consoleMsgs.filter((m) => m.type === "warning" && bad(m));
  const vueWarn = s.consoleMsgs.filter((m) => /\[Vue warn\]|Hydration/i.test(m.text));
  const exc = s.exceptions.filter((x) => !NOISE.some((re) => re.test(String(x.text))));
  // 500 iz lažnog API-ja koje scenarij sam izaziva (pad učitavanja, greška prekidača) nisu greška stranice.
  const logErr = s.logEntries.filter((l) => l.level === "error" && !/status of 500|net::ERR_FAILED/.test(l.text) && !NOISE.some((re) => re.test(l.text + l.url)));
  check(`${label} / konzola: nema console.error`, errs.length === 0, errs.map((m) => m.text.slice(0, 200)).join(" | "));
  check(`${label} / konzola: nema neuhvaćenih izuzetaka`, exc.length === 0, exc.map((x) => String(x.text).slice(0, 200)).join(" | "));
  check(`${label} / konzola: nema Vue warn i hydration mismatch`, vueWarn.length === 0, vueWarn.map((m) => m.text.slice(0, 240)).join(" | "));
  check(`${label} / konzola: nema upozorenja`, warns.length === 0, warns.map((m) => m.text.slice(0, 200)).join(" | "));
  check(`${label} / konzola: nema grešaka učitavanja resursa`, logErr.length === 0, logErr.map((l) => `${l.text.slice(0, 120)} ${l.url}`).join(" | "));
  await s.close();
};

const SCENARIOS = [
  ["desktop", { width: 1440, height: 900, mobile: false }],
  ["phone", { width: 390, height: 844, mobile: true }],
  ["tiny", { width: 320, height: 640, mobile: true }],
];

for (const [name, o] of SCENARIOS) {
  if (ONLY && !ONLY.includes(name)) continue;
  await scenario(name, o);
}
process.exitCode = summary() ? 1 : 0;
