// T1: prototip "Finansije", računar 1480x960, pravi događaji: pločice, predaje na čekanju, spisak, pretraga, detalj, potvrda, uplata, isplata, isplata svima.
import { openProto, check, summary, sleep } from "./plib.mjs";

const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const on = (k) => !ONLY.length || ONLY.includes(k);
const P = await openProto({ name: "t1", width: 1480, height: 960 });
const A = "A('d')";
const M = {};
try {
  await P.ev(`(A('p') && A('p').destroy(), document.getElementById('p').style.display='none', 1)`);
  const ready = async () => P.waitFor(`(() => { const D = ${A}.ctx.D; return D.balances.state === 'ok' && D.pending.state === 'ok' && D.status.state === 'ok' && D.settings.state === 'ok'; })()`);
  await ready(); await sleep(300);

  /* ---------- S1 početno stanje ---------- */
  if (on("s1")) {
    console.log("\n# S1 početno stanje");
    check("tab Stanje je izabran", (await P.attr("#fc-tab-stanje", "aria-selected")) === "true");
    check("značka na tabu: 4 predaje", (await P.text("#fc-tab-stanje .fc-badge")) === "4");
    check("bočna traka: značka 4", (await P.text(".fc-side .nb")) === "4");
    const kv = await P.texts(".fc-kpi .v");
    check("pločica 1: 429.74 KM", kv[0] === "429.74 KM", kv[0]);
    check("pločica 2: 1332.32 KM", kv[1] === "1332.32 KM", kv[1]);
    check("pločica 3: 633.68 KM", kv[2] === "633.68 KM", kv[2]);
    const ks = await P.texts(".fc-kpi .s");
    check("pločica 1: 4 predaje, najstarija pre 3 dana", /4 predaje.*pre 3 dana/.test(ks[0]), ks[0]);
    check("pločica 2: 12 kurira, 2 preko limita, 2 blizu", /12 kurira.*2 preko limita.*2 blizu/.test(ks[1]), ks[1]);
    check("pločica 3: 10 kurira", /10 kurira/.test(ks[2]), ks[2]);
    check("pločica 3: dugme Isplati sve (10)", /Isplati sve \(10\)/.test(await P.text(".fc-kpi .go")));
    const q = await P.texts(".fc-qr .tx");
    check("red predaja: 4", q.length === 4);
    check("najstarija prva", /Jasmin Simić.*pre 3 dana/.test(q[0]), q[0]);
    check("najmlađa zadnja", /Amir Hodžić.*pre 12 min/.test(q[3]), q[3]);
    check("kasni (preko dana) je označeno crveno", (await P.count(".fc-qr .late")) === 2);
    check("predaja pokazuje dug kurira", /Dug kurira 180\.70 KM/.test(q[3]), q[3]);
    check("spisak: 12 redova od 17", (await P.count(".fc-row")) === 12);
    check("naslov spiska: 17 kurira", /17 kurira/.test(await P.text(".fc-lh h2")));
    check("prikaži još", /Prikaži još/.test(await P.text('[data-act="more"]')));
    check("podnaslov zaglavlja: firma i valuta", (await P.text(".fc-head h1 small")) === "Ordera Dostava Banja Luka · KM");
    check("osvježeno je napisano", /osvježeno/.test(await P.text(".fc-upd")));
    const lg = await P.log();
    const gets = lg.filter((e) => e.method === "GET").map((e) => e.path.replace("/dispatcher/delivery-companies/24/", ""));
    check("pri otvaranju tačno 4 čitanja", gets.length === 4 && ["finance-settings", "couriers-status", "couriers-balance", "cash-handovers/pending"].every((p) => gets.includes(p)), gets.join(", "));
    check("pri otvaranju nema upisa", lg.every((e) => e.method === "GET"));
    check("prvi red spiska: najveći dug", (await P.attr(".fc-row", "data-row")) === "30195");
    check("limit: crveni nivo na redu preko limita", /preko limita/i.test(await P.text('.fc-row[data-row="30195"] .meta')));
    check("meter ima ime za čitač", /% limita gotovine/.test((await P.attr('.fc-row[data-row="30189"] .fc-m', "aria-label")) || ""));
  }

  /* ---------- S2 pločice kao filteri ---------- */
  if (on("s2")) {
    console.log("\n# S2 pločice i filteri");
    await P.click('[data-act="kpi"][data-arg="debt"]');
    check("pločica Duguju firmi je pritisnuta", (await P.attr('[data-act="kpi"][data-arg="debt"]', "aria-pressed")) === "true");
    check("spisak: 12 rezultata", /12 rezultata/.test(await P.text(".fc-lh h2")));
    check("svi redovi imaju dug", (await P.ev(`[...document.querySelectorAll('.fc-row')].every((r) => /Gotovina\\s*[1-9]/.test(r.textContent))`)));
    await P.click('[data-act="kpi"][data-arg="debt"]');
    check("drugi dodir gasi filter", (await P.attr('[data-act="kpi"][data-arg="debt"]', "aria-pressed")) === "false" && /17 kurira/.test(await P.text(".fc-lh h2")));
    await P.click('[data-act="kpi"][data-arg="pending"]');
    check("filter Čeka potvrdu: 4 reda", (await P.count(".fc-row")) === 4);
    check("redoslijed prelazi na 'Najstarija predaja'", (await P.val('select[data-fk="sort"]')) === "age");
    check("prvi je najstariji", (await P.attr(".fc-row", "data-row")) === "30210");
    await P.click('[data-act="filter"][data-arg="limit"]');
    check("filter Limit: 4 reda", (await P.count(".fc-row")) === 4);
    await P.click('[data-act="filter"][data-arg="wage"]');
    check("filter Za isplatu: 10", /10 rezultata/.test(await P.text(".fc-lh h2")));
    check("uz filter Za isplatu stoji 'Isplati sve (10)' u spisku", /Isplati sve \(10\)/.test(await P.text('[data-act="batch"][data-fk="batch-list"]')));
    await P.click('[data-act="filter"][data-arg="zero"]');
    check("filter Nulti: 9", (await P.count(".fc-row")) === 9);
    await P.click('[data-act="filter"][data-arg="all"]');
    check("Svi: 17", /17 kurira/.test(await P.text(".fc-lh h2")));
    // pretraga bez rezultata
    await P.focusSel(".fc-q-input"); await P.typeText("nepostojeci");
    await sleep(150);
    check("prazna pretraga: poruka i dugme", (await P.q(".fc-empty")) && (await P.q('[data-act="reset"]')));
    await P.click('[data-act="reset"]');
    check("Prikaži sve vraća spisak", (await P.count(".fc-row")) === 12);
  }

  /* ---------- S3 pretraga: 12 upita (stara stranica 5 od 12) ---------- */
  if (on("s3")) {
    console.log("\n# S3 pretraga");
    const Q = [["hodzic", [30189]], ["Hodžić", [30189]], ["zeljko", [30234, 30239]], ["željko", [30234, 30239]], ["djuric", [30234, 30255]], ["đurić", [30234, 30255]], ["марковић", [30239, 30242, 30253]], ["Zeljko Djuric", [30234]], ["065/123-456", [30234]], ["065123456", [30234]], ["+387 65 123 456", [30234]], ["30189", [30189]]];
    let found = 0;
    for (const [qq, exp] of Q) {
      await P.clearField(".fc-q-input");
      await P.typeText(qq, 3);
      await sleep(120);
      const got = (await P.ev(`[...document.querySelectorAll('.fc-row')].map((r) => Number(r.getAttribute('data-row')))`)).sort((a, b) => a - b);
      const ok = JSON.stringify(got) === JSON.stringify(exp);
      if (ok) found++;
      check(`pretraga "${qq}"`, ok, ok ? "" : `${got} != ${exp}`);
    }
    M.search = { found, total: Q.length };
    check("pretraga: 12 od 12", found === 12);
    await P.clearField(".fc-q-input"); await sleep(120);
    check("pretraga drži fokus i tekst", (await P.active()).fk === "q");
    check("pretraga nultog kurira (nije u 'Svi')", await (async () => { await P.typeText("30207"); await sleep(120); return (await P.count(".fc-row")) === 1; })());
    await P.clearField(".fc-q-input"); await sleep(100);
    // sortiranje
    await P.ev(`(() => { const s = document.querySelector('select[data-fk="sort"]'); s.value = 'wage'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(120);
    check("sortiranje: najviše zarade prvo", (await P.attr(".fc-row", "data-row")) === "30204");
    await P.ev(`(() => { const s = document.querySelector('select[data-fk="sort"]'); s.value = 'name'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(120);
    const names = await P.texts(".fc-row .nm");
    check("sortiranje: ime A–Z", names.slice().sort((a, b) => a.normalize("NFD").replace(/[̀-ͯ]/g, "").localeCompare(b.normalize("NFD").replace(/[̀-ͯ]/g, ""), "sr")).join("|") === names.join("|"), names.slice(0, 3).join(", "));
    await P.ev(`(() => { const s = document.querySelector('select[data-fk="sort"]'); s.value = 'debt'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await sleep(100);
    // prikaži još
    await P.click('[data-act="more"]');
    check("prikaži još: svi (17)", (await P.count(".fc-row")) === 17 && !(await P.q('[data-act="more"]')));
    await P.ev(`${A}.st.shown = 12; ${A}.render(); 1`);
  }

  /* ---------- S4 tastatura u spisku i detalj ---------- */
  if (on("s4")) {
    console.log("\n# S4 tastatura, detalj");
    check("tačno jedan red je u Tab redoslijedu", (await P.count('.fc-row[tabindex="0"]')) === 1);
    await P.focusSel('.fc-row[tabindex="0"]');
    await P.key("ArrowDown");
    check("strelica dolje pomjera fokus", (await P.active()).fk === `row-${(await P.attr(".fc-row", "data-row", 1))}`);
    await P.key("End");
    check("End ide na zadnji red", (await P.active()).fk === `row-${(await P.ev(`[...document.querySelectorAll('.fc-row')].pop().getAttribute('data-row')`))}`);
    await P.key("Home");
    await P.key("Enter");
    await sleep(500);
    check("Enter otvara detalj", await P.q(".fc-det .fc-dt"));
    check("izabran red ima aria-current", (await P.count('.fc-row[aria-current="true"]')) === 1);
    check("fokus ostaje na redu", /^row-/.test((await P.active()).fk || ""));
    await P.key("Escape");
    await sleep(200);
    check("Esc zatvara detalj", !(await P.q(".fc-det .fc-dt")));
    check("Esc vraća fokus na red", /^row-/.test((await P.active()).fk || ""));
    await P.ev(`document.activeElement.blur(); 1`);
    await P.typeText("/");
    check("'/' fokusira pretragu", (await P.active()).fk === "q");
    await P.ev(`document.activeElement.blur(); 1`);

    // detalj: Amir Hodžić 30189
    await P.click('.fc-row[data-row="30189"]');
    await P.waitFor(`document.querySelectorAll('.fc-ti').length > 0`);
    const nums = await P.texts(".fc-acc .num");
    check("detalj: gotovina 180.70 KM", nums[0] === "180.70 KM", nums[0]);
    check("detalj: zarada 6.00 KM", nums[1] === "6.00 KM", nums[1]);
    check("detalj: meter tekst", (await P.text(".fc-acc .mtxt")) === "90% limita od 200.00 KM · blizu limita");
    check("detalj: predaja na čekanju sa dugmetom", /Prijavio 95\.24 KM/.test(await P.text(".fc-acc .hand")) && (await P.q('.fc-acc .hand button[data-act="confirm"]')));
    check("detalj: ugovor", /Po dostavi · 2\.00 KM/.test(await P.text(".fc-acc .note")));
    check("detalj: žiro račun i IBAN", (await P.count(".fc-bank")) === 2);
    check("detalj: vremenski tok ima najviše 6 stavki", (await P.count(".fc-ti")) >= 1 && (await P.count(".fc-ti")) <= 6);
    check("detalj: prva stavka je predaja koja čeka", /Predaja čeka potvrdu/.test(await P.text(".fc-ti")));
    const lg = await P.log();
    const tl = lg.filter((e) => /courier_id=30189/.test(e.path));
    check("vremenski tok: 2 čitanja (predaje i isplate)", tl.length === 2 && tl.some((e) => /cash-handovers\?courier_id=30189&from=2026-09-06/.test(e.path)) && tl.some((e) => /payouts\?courier_id=30189&from=2026-09-06/.test(e.path)), tl.map((e) => e.path).join(" | "));
    check("detalj: pozovi je veza tel:", (await P.attr(".fc-qa a", "href")).startsWith("tel:"));
    await P.click('[data-act="copy"][data-arg="id"]');
    check("kopiranje ID-a daje potvrdu na dugmetu", /Kopirano/.test(await P.text(".fc-id")));
    // drugi kurir: oznaka kopirano ne prelazi
    await P.click('.fc-row[data-row="30192"]');
    await P.waitFor(`document.querySelector('.fc-dh h2') && document.querySelector('.fc-dh h2').textContent.includes('Kenan')`);
    check("drugi kurir: nema oznake 'Kopirano'", !/Kopirano/.test(await P.text(".fc-id")));
    // siroče
    await P.click('.fc-row[data-row="29980"]');
    await sleep(300);
    check("siroče: oznaka u detalju i bez 'Profil'", /Nije u firmi/.test(await P.text(".fc-dh .mt")) && (await P.attr(".fc-qa .fc-qb:nth-child(2)", "aria-disabled")) === "true");
    check("siroče: dugme Isplati je onemogućeno (nema zarade)", await P.ev(`document.querySelector('[data-act="payout"]').disabled`));
    check("siroče: Evidentiraj uplatu radi", !(await P.ev(`document.querySelector('[data-act="receipt"]').disabled`)));
    await P.click('[data-act="back"]');
  }

  /* ---------- S5 potvrda predaje ---------- */
  if (on("s5")) {
    console.log("\n# S5 potvrda predaje");
    await P.clearLog();
    await P.click('.fc-qr [data-act="confirm"]', { nth: 3 }); // Amir Hodžić 95.24
    await P.waitFor(`!!document.querySelector('#fc-sheet')`);
    await sleep(250);
    check("list: naslov i podnaslov", (await P.text("#fc-sheet h2")) === "Potvrdi predaju" && /Amir Hodžić · prijavio 95\.24 KM pre 12 min/.test(await P.text("#fc-sheet .fc-sh-head p")));
    check("list je dijalog sa imenom", (await P.attr("#fc-sheet", "role")) === "dialog" && (await P.attr("#fc-sheet", "aria-modal")) === "true" && !!(await P.attr("#fc-sheet", "aria-label")));
    check("fokus je u polju iznosa", (await P.active()).id === "fc-amt");
    check("iznos je unaprijed popunjen prijavljenim", (await P.val("#fc-amt")) === "95.24");
    check("iznos je označen (prepisuje se kucanjem)", await P.ev(`(() => { const i = document.getElementById('fc-amt'); return i.selectionStart === 0 && i.selectionEnd === i.value.length; })()`));
    check("poruka: Isto kao prijava", /Isto kao prijava/.test(await P.text("#fc-msg")));
    check("pregled duga: sada 180.70, poslije 85.46", /180\.70 KM/.test(await P.text(".fc-sum")) && /85\.46 KM/.test(await P.text(".fc-sum")), await P.text(".fc-sum"));
    check("dugme nosi iznos", (await P.text('[data-act="sheet-submit"]')) === "Potvrdi 95.24 KM");
    check("bez bilješke dok nema razlike", !(await P.q("#fc-note")));
    // Tab ostaje u listu
    const seen = new Set();
    for (let i = 0; i < 8; i++) { await P.key("Tab"); seen.add(await P.ev(`document.activeElement.closest('#fc-sheet') ? 'in' : 'out'`)); }
    check("Tab ostaje u listu (zamka fokusa)", seen.size === 1 && seen.has("in"));
    await P.focusSel("#fc-amt");
    await P.key("Enter");
    await P.waitFor(`!document.querySelector('#fc-sheet')`);
    await sleep(500);
    const lg = await P.log();
    const post = lg.filter((e) => e.method === "POST");
    check("jedan POST potvrde sa iznosom 95.24", post.length === 1 && /cash-handovers\/\d+\/confirm$/.test(post[0].path) && post[0].body.confirmed_amount === 95.24 && !("note" in post[0].body), JSON.stringify(post.map((p) => p.body)));
    check("poslije potvrde ponovo se čitaju balans i predaje", lg.some((e) => /couriers-balance/.test(e.path)) && lg.some((e) => /cash-handovers\/pending/.test(e.path)));
    check("red predaje je nestao (3)", (await P.count(".fc-qr")) === 3);
    check("značka na tabu pala na 3", (await P.text("#fc-tab-stanje .fc-badge")) === "3");
    check("bočna traka: 3", (await P.text(".fc-side .nb")) === "3");
    check("pločica 1 se osvježila", (await P.texts(".fc-kpi .v"))[0] === "334.50 KM", (await P.texts(".fc-kpi .v"))[0]);
    check("dug kurira pao na 85.46", /85\.46 KM/.test(await P.text('.fc-row[data-row="30189"] .am div')), await P.text('.fc-row[data-row="30189"] .am div'));
    check("obavještenje o potvrdi", /Predaja potvrđena: Amir Hodžić · 95\.24 KM/.test((await P.toast()) || ""), await P.toast());
    check("fokus ide na sljedeće 'Potvrdi'", /^confirm-/.test((await P.active()).fk || ""), JSON.stringify(await P.active()));

    // razlika + napomena: Kenan Mujić 214.50
    await P.clearLog();
    await P.click('.fc-qr [data-act="confirm"]', { nth: 2 });
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    await P.clearField("#fc-amt"); await P.typeText("200");
    await sleep(150);
    check("razlika: tekst sa predznakom", /Razlika od prijave: −14\.50 KM/.test(await P.text("#fc-msg")), await P.text("#fc-msg"));
    check("razlika: pojavi se polje napomene", await P.q("#fc-note"));
    check("razlika: chip 'Isto kao prijava'", /Isto kao prijava 214\.50 KM/.test(await P.text(".fc-chip")));
    check("razlika: dug poslije potvrde 14.50", /14\.50 KM/.test(await P.text(".fc-sum")), await P.text(".fc-sum"));
    check("fokus ostaje u polju iznosa dok se kuca", (await P.active()).id === "fc-amt");
    await P.click("#fc-note"); await P.typeText("Fali 14.50, vraća sutra");
    await P.click('[data-act="sheet-submit"]');
    await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(400);
    const p2 = (await P.log()).filter((e) => e.method === "POST");
    check("POST nosi iznos i napomenu", p2.length === 1 && p2[0].body.confirmed_amount === 200 && p2[0].body.note === "Fali 14.50, vraća sutra", JSON.stringify(p2.map((p) => p.body)));

    // iznad duga + zaštita nesačuvanog unosa: Amir Kurtović 50.00 (dug 64.30)
    await P.click('.fc-qr [data-act="confirm"]', { nth: 1 });
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    await P.clearField("#fc-amt"); await P.typeText("100");
    await sleep(150);
    check("iznad duga: upozorenje prije slanja", /Veće je od duga \(64\.30 KM\) za 35\.70 KM/.test(await P.text("#fc-msg")), await P.text("#fc-msg"));
    check("iznad duga: dugme je aktivno", !(await P.ev(`document.querySelector('[data-act="sheet-submit"]').disabled`)));
    check("dug poslije potvrde postaje 'firma će dugovati'", /Firma će dugovati kuriru/.test(await P.text(".fc-sum")), await P.text(".fc-sum"));
    await P.key("Escape");
    await sleep(150);
    check("Esc sa nesačuvanim unosom pita", /Imaš nesačuvan unos/.test(await P.text("#fc-sheet")));
    await P.click('[data-act="sheet-keep"]');
    check("Nastavi unos vraća polje", (await P.val("#fc-amt")) === "100");
    await P.key("Escape"); await sleep(150);
    await P.click('[data-act="sheet-drop"]');
    check("Odbaci unos zatvara list", !(await P.q("#fc-sheet")));
    check("nesačuvan unos nije poslat", (await P.log()).filter((e) => e.method === "POST").length === 1);

    // neispravan unos
    await P.click('.fc-qr [data-act="confirm"]', { nth: 0 });
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    await P.clearField("#fc-amt");
    check("prazan iznos: dugme onemogućeno i objašnjeno", (await P.ev(`document.querySelector('[data-act="sheet-submit"]').disabled`)) && /veći od 0/.test(await P.text(".fc-sh-foot p")));
    await P.typeText("12.345");
    await sleep(100);
    check("tri decimale: poruka", /dvije decimale/.test(await P.text("#fc-msg")), await P.text("#fc-msg"));
    await P.clearField("#fc-amt"); await P.typeText("abc70,5");
    await sleep(100);
    check("slova se ne upisuju, zarez prolazi", (await P.val("#fc-amt")) === "70,5");

    // greška servera: list ostaje, poruka u listu, ponovni pokušaj radi
    await P.ev(`${A}.failNext(new RegExp('POST .*confirm'), 1, 'Server ne odgovara.', 500); 1`);
    await P.clearField("#fc-amt"); await P.typeText("70");
    await P.clearLog();
    await P.click('[data-act="sheet-submit"]');
    await sleep(500);
    check("greška: list ostaje otvoren", await P.q("#fc-sheet"));
    check("greška: poruka u listu sa ulogom alert", (await P.attr("#fc-err", "role")) === "alert" && /Server ne odgovara/.test(await P.text("#fc-err")));
    check("greška: unos je sačuvan", (await P.val("#fc-amt")) === "70");
    check("greška: dugme je opet aktivno", !(await P.ev(`document.querySelector('[data-act="sheet-submit"]').disabled`)));
    await P.click('[data-act="sheet-submit"]');
    await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(400);
    const p3 = (await P.log()).filter((e) => e.method === "POST");
    check("ponovni pokušaj: 2 POST-a, drugi uspije", p3.length === 2 && p3[0].failed && !p3[1].failed, JSON.stringify(p3.map((p) => p.failed)));
    check("red predaja: preostala jedna, bez poruke o praznom", (await P.count(".fc-qr")) === 1 && !/Nema predaja koje čekaju potvrdu/.test(await P.text(".fc-q")));
    await P.click(".fc-qr [data-act=confirm]");
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    await P.focusSel("#fc-amt"); await P.key("Enter");
    await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(500);
    check("red predaja prazan: poruka tek poslije učitavanja", /Nema predaja koje čekaju potvrdu/.test(await P.text(".fc-q")) && (await P.count(".fc-qr")) === 0 && (await P.count(".fc-side .nb")) === 0);
    check("prazan red: fokus ide na naslov stranice", (await P.active()).id === "fc-h1", JSON.stringify(await P.active()));
  }

  /* ---------- S6 uplata ---------- */
  if (on("s6")) {
    console.log("\n# S6 uplata");
    await P.click('.fc-row[data-row="30239"]'); await sleep(300);
    await P.clearLog();
    await P.click('[data-act="receipt"]');
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    check("uplata: naslov i podnaslov", (await P.text("#fc-sheet h2")) === "Evidentiraj uplatu" && /duguje 12\.40 KM/.test(await P.text(".fc-sh-head p")));
    check("uplata: cijeli dug je unaprijed popunjen", (await P.val("#fc-amt")) === "12.40");
    check("uplata: poruka 'Dug se zatvara'", /Dug se zatvara/.test(await P.text("#fc-msg")));
    check("uplata: nema 'Cijeli iznos' dok je popunjen cijeli", !(await P.q('[data-act="entry-full"]')));
    await P.clearField("#fc-amt"); await P.typeText("20");
    await sleep(120);
    check("uplata: upozorenje iznad duga PRIJE slanja", /Veće je od duga za 7\.60 KM/.test(await P.text("#fc-msg")), await P.text("#fc-msg"));
    check("uplata: chip 'Cijeli iznos 12.40 KM'", /Cijeli iznos 12\.40 KM/.test(await P.text('[data-act="entry-full"]')));
    await P.click('[data-act="entry-full"]');
    check("uplata: chip vraća cijeli iznos", (await P.val("#fc-amt")) === "12.40");
    await P.clearField("#fc-amt"); await P.typeText("5");
    check("uplata: poruka 'Ostaje dug 7.40 KM'", /Ostaje dug 7\.40 KM/.test(await P.text("#fc-msg")), await P.text("#fc-msg"));
    await P.click("#fc-note"); await P.typeText("Predao lično");
    await P.click('[data-act="sheet-submit"]');
    await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(500);
    const lg = await P.log();
    const post = lg.filter((e) => e.method === "POST");
    check("uplata: POST sa firmom, iznosom i napomenom", post.length === 1 && /couriers\/30239\/cash-receipt$/.test(post[0].path) && post[0].body.delivery_company_id === 24 && post[0].body.amount === 5 && post[0].body.note === "Predao lično", JSON.stringify(post.map((p) => p.body)));
    check("uplata: dug pao na 7.40 KM", /7\.40 KM/.test(await P.text('.fc-row[data-row="30239"] .am div')) && /7\.40 KM/.test(await P.text(".fc-acc .num")), await P.text(".fc-acc .num"));
    check("uplata: obavještenje", /Uplata evidentirana: .* · 5\.00 KM/.test((await P.toast()) || ""), await P.toast());
    // uplata iznad duga: dozvoljena, dobija se negativan saldo
    await P.click('[data-act="receipt"]'); await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    await P.clearField("#fc-amt"); await P.typeText("20"); await sleep(100);
    await P.click('[data-act="sheet-submit"]');
    await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(500);
    check("uplata iznad duga: saldo je minus (−12.60) i detalj to kaže", /Firma duguje kuriru \(gotovina\)/.test(await P.text(".fc-acc .lab")) && (await P.ev(`${A}.ctx.bookRow(30239).cash`)) === -12.6, await P.text(".fc-acc .lab"));
    check("kurir sa minusom pada na dno spiska (nije među prvih 12)", !(await P.q('.fc-row[data-row="30239"]')));
    check("obavještenje nosi i upozorenje servera", /veći od duga/.test((await P.toast()) || ""), await P.toast());
    await P.click('[data-act="back"]');
  }

  /* ---------- S7 isplata ---------- */
  if (on("s7")) {
    console.log("\n# S7 isplata");
    // kurir sa računom (30189) i kurir bez računa
    const noBank = await P.ev(`(() => { const r = ${A}.ctx.book().find((x) => x.wage > 0 && !x.bank && !x.iban && x.inFirm); return r ? r.id : null; })()`);
    check("postoji kurir sa zaradom bez računa (fixture)", noBank != null, String(noBank));
    await P.click('.fc-row[data-row="30189"]'); await sleep(300);
    await P.clearLog();
    await P.click('[data-act="payout"]');
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    check("isplata: naslov i cijela zarada popunjena", (await P.text("#fc-sheet h2")) === "Isplati zaradu" && (await P.val("#fc-amt")) === "6.00");
    check("isplata: način je Gotovina", (await P.attr('[data-act="entry-method"][aria-checked="true"]', "data-arg")) === "gotovina");
    check("isplata: gotovina ne pokazuje račun", !(await P.q(".fc-kv")));
    await P.click('[data-act="entry-method"][data-arg="bankovni transfer"]');
    check("isplata: transfer pokazuje žiro račun i IBAN sa kopiranjem", (await P.count(".fc-kv .cp")) === 2);
    check("isplata: grupa je radiogroup sa imenom", (await P.attr('[role="radiogroup"]', "aria-labelledby")) === "fc-ml");
    // greška pa ponovni pokušaj: isti ključ
    await P.ev(`${A}.failNext(new RegExp('POST .*payout'), 1, 'Veza je prekinuta.', 500); 1`);
    await P.clearLog();
    await P.click('[data-act="sheet-submit"]'); await sleep(500);
    check("isplata: greška u listu", /Veza je prekinuta/.test(await P.text("#fc-err")));
    await P.click('[data-act="sheet-submit"]');
    await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(500);
    const pays = (await P.log()).filter((e) => /payout$/.test(e.path));
    check("isplata: dva pokušaja sa ISTIM ključem", pays.length === 2 && pays[0].body.idempotency_key === pays[1].body.idempotency_key && !!pays[0].body.idempotency_key, JSON.stringify(pays.map((p) => p.body.idempotency_key)));
    check("isplata: tijelo (firma, iznos, način)", pays[1].body.delivery_company_id === 24 && pays[1].body.amount === 6 && pays[1].body.method === "bankovni transfer", JSON.stringify(pays[1].body));
    check("isplata: zarada pala na 0", /0\.00 KM/.test(await P.text(".fc-acc:nth-child(2) .num")), await P.text(".fc-acc:nth-child(2) .num"));
    check("isplata: dugme je sada onemogućeno", await P.ev(`document.querySelector('[data-act="payout"]').disabled`));
    // novo otvaranje = novi ključ
    await P.click('.fc-row[data-row="30204"]'); await sleep(300);
    await P.clearLog();
    await P.click('[data-act="payout"]'); await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    await P.clearField("#fc-amt"); await P.typeText("50");
    check("isplata: poruka 'Ostaje 70.00 KM'", /Ostaje 70\.00 KM/.test(await P.text("#fc-msg")), await P.text("#fc-msg"));
    await P.click('[data-act="sheet-submit"]'); await P.waitFor(`!document.querySelector('#fc-sheet')`); await sleep(400);
    const pay2 = (await P.log()).filter((e) => /payout$/.test(e.path));
    check("isplata: novo otvaranje ima novi ključ", pay2.length === 1 && pay2[0].body.idempotency_key !== pays[0].body.idempotency_key);
    // kurir bez računa: upozorenje, ali se može isplatiti
    await P.click(`.fc-row[data-row="${noBank}"]`); await sleep(300);
    await P.click('[data-act="payout"]'); await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(250);
    await P.click('[data-act="entry-method"][data-arg="bankovni transfer"]');
    check("isplata: kurir bez računa dobija upozorenje", /Račun kurira nije upisan/.test(await P.text("#fc-sheet .fc-tint")), await P.text("#fc-sheet"));
    check("isplata: dugme ostaje aktivno", !(await P.ev(`document.querySelector('[data-act="sheet-submit"]').disabled`)));
    await P.key("Escape"); await sleep(200);
    await P.click('[data-act="sheet-drop"]').catch(() => {});
    await P.ev(`${A}.ctx.closeSheet(true); 1`);
    await P.click('[data-act="back"]').catch(() => {});
  }

  /* ---------- S8 isplata svima ---------- */
  if (on("s8")) {
    console.log("\n# S8 isplata svima");
    await P.ev(`${A}.setDelay(220); 1`);
    await P.ev(`${A}.st.filter = 'all'; ${A}.st.sel = null; ${A}.render(); 1`);
    const n0 = await P.ev(`${A}.ctx.book().filter((r) => r.wage > 0).length`);
    const t0 = await P.ev(`Math.round(${A}.ctx.book().reduce((s, r) => s + Math.max(0, r.wage), 0) * 100) / 100`);
    await P.click('[data-act="batch"]');
    await P.waitFor(`!!document.querySelector('#fc-sheet')`); await sleep(300);
    check("serija: naslov i podnaslov", (await P.text("#fc-sheet h2")) === "Isplati zarade" && new RegExp(`${n0} kurira čeka isplatu`).test(await P.text(".fc-sh-head p")), await P.text(".fc-sh-head p"));
    check("serija: svi označeni", (await P.count(".fc-bi input:checked")) === n0 && (await P.count(".fc-bi input")) === n0);
    check("serija: dugme nosi broj i ukupno", (await P.text('[data-act="sheet-submit"]')) === `Isplati ${n0} zarada (${t0.toFixed(2)} KM)`, await P.text('[data-act="sheet-submit"]'));
    check("serija: kućice su 44 px", await P.ev(`[...document.querySelectorAll('.fc-bi label')].every((l) => { const r = l.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })`));
    // isključi jednog
    await P.click(".fc-bi label", { nth: 0 });
    check("serija: isključen jedan", (await P.count(".fc-bi input:checked")) === n0 - 1 && new RegExp(`Označeno\\s*${n0 - 1} od ${n0}`).test(await P.text(".fc-sum")), await P.text(".fc-sum"));
    check("serija: dugme se prilagodilo", new RegExp(`^Isplati ${n0 - 1} zarad`).test(await P.text('[data-act="sheet-submit"]')), await P.text('[data-act="sheet-submit"]'));
    await P.click('[data-act="batch-all"]');
    check("serija: Označi sve vraća sve", (await P.count(".fc-bi input:checked")) === n0);
    await P.click('[data-act="batch-all"]'); // poništi sve
    check("serija: Poništi sve onemogućava dugme", (await P.ev(`document.querySelector('[data-act="sheet-submit"]').disabled`)) && /Označi bar jednog/.test(await P.text('[data-act="sheet-submit"]')));
    await P.click('[data-act="batch-all"]');
    // jedan će pasti
    const failId = await P.ev(`${A}.ctx.book().filter((r) => r.wage > 0)[3].id`);
    await P.ev(`${A}.failNext(new RegExp('POST /dispatcher/couriers/${failId}/payout'), 1, 'Kurir je suspendovan.', 422); 1`);
    await P.clearLog();
    await P.click('[data-act="sheet-submit"]');
    await sleep(120);
    check("serija: u toku se dugme zaključa", /Isplata je u toku/.test(await P.text("#fc-sheet .fc-sh-foot")));
    check("serija: napredak je napisan", new RegExp(`Obrađeno \\d+ od ${n0}`).test(await P.text("#fc-sheet")) && (await P.q('[role="progressbar"]')));
    await P.key("Escape"); await sleep(120);
    check("serija: zatvaranje u toku je blokirano", (await P.q("#fc-sheet")) && /Isplata je u toku/.test((await P.toast()) || ""), await P.toast());
    await P.waitFor(`document.querySelector('#fc-sheet [data-act="batch-retry"]') || document.querySelector('#fc-sheet [data-act="sheet-close"][data-fk="close2"]')`, { timeout: 12000 });
    await sleep(300);
    const posts = (await P.log()).filter((e) => /payout$/.test(e.path));
    check("serija: po jedan poziv za svakog kurira", posts.length === n0, `${posts.length} / ${n0}`);
    const tt = posts.map((p) => p.t).sort((a, b) => a - b);
    check("serija: prva tri kreću istovremeno, četvrti tek poslije 200 ms", tt[2] - tt[0] < 120 && tt[3] - tt[0] >= 180, `${tt[2] - tt[0]} / ${tt[3] - tt[0]}`);
    check("serija: svaki poziv ima svoj ključ", new Set(posts.map((p) => p.body.idempotency_key)).size === n0);
    check("serija: sažetak (svi osim jednog isplaćeni)", new RegExp(`Isplaćeno ${n0 - 1}, nije uspjelo 1`).test(await P.text("#fc-sheet .fc-tint")), await P.text("#fc-sheet .fc-tint"));
    check("serija: neuspjeli red nosi poruku servera", /Kurir je suspendovan/.test(await P.text("#fc-sheet .fc-bi small.err")), await P.text("#fc-sheet .fc-bl"));
    check("serija: ponudi 'Pokušaj ponovo (1)'", /Pokušaj ponovo \(1\)/.test(await P.text('[data-act="batch-retry"]')));
    await P.ev(`${A}.setDelay(40); 1`);
    await P.clearLog();
    await P.click('[data-act="batch-retry"]');
    await P.waitFor(`document.querySelector('#fc-sheet [data-act="sheet-close"][data-fk="close2"]') && !document.querySelector('#fc-sheet [data-act="batch-retry"]')`, { timeout: 8000 });
    await sleep(300);
    const rp = (await P.log()).filter((e) => /payout$/.test(e.path));
    check("ponovni pokušaj: samo neuspjeli red, ISTI ključ", rp.length === 1 && rp[0].path.includes(`/${failId}/`) && rp[0].body.idempotency_key === posts.find((p) => p.path.includes(`/${failId}/`)).body.idempotency_key);
    check("poslije ponavljanja: sve isplaćeno", new RegExp(`Isplaćeno ${n0} zarad`).test(await P.text("#fc-sheet .fc-tint")), await P.text("#fc-sheet .fc-tint"));
    await P.click('[data-act="sheet-close"][data-fk="close2"]');
    await sleep(500);
    check("zatvaranje vraća stranicu", !(await P.q("#fc-sheet")));
    const kv = await P.texts(".fc-kpi .v");
    check("pločica 3: zarada na nuli", kv[2] === "0.00 KM", kv[2]);
    check("pločica 3: nema više 'Isplati sve'", !(await P.q(".fc-kpi .go")));
    check("zbir isplata u prometu se poklapa sa serijom", await (async () => {
      const total = await P.ev(`Math.round(${A}.world.F.payouts.filter((p) => p.created_at.slice(0,10) === '2026-10-06').reduce((s, p) => s + Number(p.amount), 0) * 100) / 100`);
      return total >= t0;
    })());
  }
  M.consoleErrors = (await P.ev(`1`)) && P.b.consoleMsgs.filter((m) => /error/.test(m.type)).map((m) => m.text.slice(0, 160));
  check("konzola: nema grešaka", M.consoleErrors.length === 0, JSON.stringify(M.consoleErrors));
  check("izuzeci: nema", P.b.exceptions.length === 0, JSON.stringify(P.b.exceptions.map((e) => e.text)));
} catch (e) {
  console.log("PAD:", e.stack || e);
  check("test nije pao", false, String(e.message));
  try { await P.shot("pad"); } catch {}
} finally {
  await P.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
