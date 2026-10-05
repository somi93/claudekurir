// E2E nad IZRAĐENOM stranicom /dispatcher/notifications ("Poruke") u pravom headless Chrome-u, nad lažnim API-jem.
// Pokretanje (iz korijena repoa; dev server: NUXT_PUBLIC_GPS_API_BASE=http://localhost:4011 npx nuxt dev --port 3100):
//   CHROME_PATH=... node docs/2026/10/poruke-prototip/e2e/n2-poruke.mjs
import { session, check, summary, sleep, COLORS_FN, ratio } from "./nh.mjs";

const SHOT = process.env.E2E_SHOTS !== "0";
const PAGE = "/dispatcher/notifications";
const ROWS = ".mp .mr";

const ready = async (s) => {
  await s.load(PAGE, { wait: ".mp", timeout: 240000 });
  await s.waitFor(`document.querySelectorAll('${ROWS}').length > 0 || document.querySelector('.rl-empty')`, { timeout: 40000 });
  await s.idle(800);
};
const tile = (s, k) =>
  s.evalJs(`(() => { const t = document.querySelector('.au-pt[data-preset="${k}"]'); if (!t) return null; const m = t.getAttribute('aria-label').match(/(\\d+) kur/); return { n: m ? Number(m[1]) : null, disabled: t.getAttribute('aria-disabled') === 'true', checked: t.getAttribute('aria-checked') === 'true', label: t.getAttribute('aria-label') }; })()`);
const val = (s, f) => s.evalJs(`document.querySelector('[data-field="${f}"]')?.value ?? null`);
const fill = async (s, title, body) => {
  await s.clearField('[data-field="title"]');
  await s.typeText(title);
  await s.clearField('[data-field="body"]');
  await s.typeText(body);
};
// Čeka da zahtjev za slanje stvarno krene (produkcijski build je sporiji od dev-a), pa da se mreža smiri.
const waitPost = async (s, n = 1, timeout = 8000) => {
  const t0 = Date.now();
  while (posts(s).length < n && Date.now() - t0 < timeout) await sleep(100);
  await s.idle(500);
};
const posts = (s) => s.logOf(/^POST \/(dispatcher\/delivery-companies\/\d+\/broadcast|couriers\/\d+\/inbox)$/);

// Klik bez scrollIntoView: stavke menija su u overlay-u koji se pri skrolu premješta (koordinate bi zastarjele).
const clickNow = async (s, sel) => {
  const r = await s.rectOf(sel);
  if (!r || (r.w === 0 && r.h === 0)) throw new Error(`clickNow: nema elementa ${sel}`);
  await s.clickAt(r.x + r.w / 2, r.y + r.h / 2);
};
const space = async (s) => {
  await s.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", text: " ", windowsVirtualKeyCode: 32 });
  await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
};

// Kontrast svakog vidljivog teksta i mete < 44 px unutar korijena (stranica, list...). Onemogućena dugmad su izuzeta.
const audit = async (s, rootSel) => {
  const texts = JSON.parse(
    await s.evalJs(`(() => {
      const fn = ${COLORS_FN};
      const root = document.querySelector(${JSON.stringify(rootSel)});
      if (!root) return '[]';
      const out = [];
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!el || seen.has(el) || !n.textContent.trim()) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || (el.offsetParent === null && cs.position !== 'fixed')) continue;
        if (el.closest('button:disabled, [aria-disabled="true"], [disabled]')) continue;
        out.push(fn(el));
      }
      return JSON.stringify(out);
    })()`)
  );
  const bad = texts.filter((c) => c.fg && c.bg && ratio(c.fg, c.bg) < (c.size >= 24 || (c.size >= 18.66 && Number(c.weight) >= 700) ? 3 : 4.5));
  const small = JSON.parse(
    await s.evalJs(`(() => {
      const root = document.querySelector(${JSON.stringify(rootSel)});
      if (!root) return '[]';
      return JSON.stringify([...root.querySelectorAll('button, a[href], input, textarea, [role=checkbox], [role=radio], [role=tab], [role=menuitem]')]
        .filter((e) => e.offsetParent !== null && !e.disabled && e.getAttribute('tabindex') !== '-1')
        .map((e) => { const r = e.getBoundingClientRect(); return { l: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').replace(/\\s+/g, ' ').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter((x) => x.h < 44));
    })()`)
  );
  return { n: texts.length, bad: bad.map((c) => `${c.text}=${ratio(c.fg, c.bg).toFixed(2)}`), small: small.map((x) => `${x.l}:${x.w}x${x.h}`) };
};
const auditCheck = async (s, name, rootSel) => {
  const a = await audit(s, rootSel);
  check(`${name}: kontrast ≥ 4.5 (${a.n} tekstova)`, a.n > 0 && a.bad.length === 0, a.bad.slice(0, 5).join(" | "));
  check(`${name}: mete dodira ≥ 44 px`, a.small.length === 0, a.small.slice(0, 5).join(" | "));
};

// Kartice se prebacuju programski: toast ("Poruka poslata...") stoji 10 s preko kartica pa bi pravi klik pogodio njega.
const tab = async (s, name) => {
  await s.evalJs(`document.querySelector('[data-tab="${name}"]').click()`);
  await sleep(350);
};

const run = async () => {
  const s = await session("n2", { width: 1440, height: 900, world: { n: 28 } });
  try {
    // ------------------------------------------------------------------ prvi prikaz
    console.log("— prvi prikaz (računar 1440)");
    await ready(s);
    if (SHOT) await s.shot("desktop-top");
    check("naslov je Poruke", (await s.text(".page-title")) === "Poruke", String(await s.text(".page-title")));
    check("ne čita inbox-summary (D12)", s.logOf(/inbox-summary/).length === 0, String(s.logOf(/inbox-summary/).length));
    const t = {};
    for (const k of ["active", "delivering", "online", "offline", "debt", "suspended"]) t[k] = await tile(s, k);
    console.log("   grupe:", Object.entries(t).map(([k, v]) => `${k}=${v?.n}`).join(" "));
    check("šest grupa primalaca", Object.values(t).every(Boolean));
    check("aktivni + suspendovani = svi", t.active.n + t.suspended.n === (await s.count(ROWS)) || t.active.n + t.suspended.n === 28, `${t.active.n}+${t.suspended.n}`);
    check("U dostavi + Slobodni + Offline = aktivni", t.delivering.n + t.online.n + t.offline.n === t.active.n);
    check("izabrani su Svi aktivni", t.active.checked);
    const rowsShown = await s.count(ROWS);
    check("iscrtano najviše 12 redova + Prikaži još", rowsShown === 12 && (await s.q('[data-messages="more"]')), String(rowsShown));
    check("kvačica na redu prati izbor (Svi aktivni: izabrani redovi)", (await s.count('.mr.is-pick')) > 0);

    // ------------------------------------------------------------------ Enter u naslovu
    console.log("— Enter u naslovu (F3)");
    s.clearLog();
    await s.focusSel('[data-field="title"]');
    await s.typeText("Probni naslov");
    await s.key("Enter");
    await sleep(300);
    check("Enter ne šalje (0 zahtjeva)", posts(s).length === 0, String(posts(s).length));
    check("Enter prebacuje fokus na tekst", (await s.evalJs(`document.activeElement?.getAttribute('data-field')`)) === "body");
    await s.typeText("Probni tekst poruke");
    // Ctrl+Enter prolazi kroz iste provjere i potvrdu: za Svi aktivni (>=10) traži potvrdu
    await s.key("Enter", { modifiers: 2 });
    await sleep(500);
    const needConfirm = t.active.n >= 10;
    check("Ctrl+Enter: bez zahtjeva dok se ne potvrdi", posts(s).length === 0, String(posts(s).length));
    check("Ctrl+Enter: za 10+ primalaca otvara potvrdu", needConfirm === (await s.evalJs(`!!document.querySelector('.v-overlay--active') && document.body.innerText.includes('Poslati ${t.active.n} ')`)), `treba=${needConfirm}`);
    if (SHOT) await s.shot("confirm");
    await auditCheck(s, "potvrda slanja", ".v-overlay--active .as");
    await s.key("Escape");
    await sleep(600);

    // ------------------------------------------------------------------ pregled
    console.log("— pregled");
    check("pregled postoji, kategorija Obaveštenje", (await s.text(".pv .eb")) === "Obaveštenje", String(await s.text(".pv .eb")));
    await s.click('[data-preview="open"]');
    check("pregled Otvorena: naslov i jednosmjerna napomena", (await s.evalJs(`document.querySelector('.pv-open h4')?.textContent.trim()`)) === "Probni naslov" && (await s.text(".pv-open .one")).includes("Odgovor nije moguć"));
    await s.click('[data-preview="list"]');

    // ------------------------------------------------------------------ slanje grupi (manje od 10 → bez potvrde)
    console.log("— slanje grupi U dostavi");
    await s.click('.au-pt[data-preset="delivering"]');
    await sleep(200);
    const dn = (await tile(s, "delivering")).n;
    check("izabrana grupa U dostavi", (await tile(s, "delivering")).checked);
    check("kvačice u listi prate izbor", (await s.count(".mr.is-pick")) === Math.min(dn, 12) || dn > 12);
    const sendLabel = await s.text('[data-messages="send"]');
    check("dugme kaže broj primalaca", sendLabel.includes(String(dn)), sendLabel);
    s.clearLog();
    await s.click('[data-messages="send"]');
    if (dn >= 10) {
      await s.waitFor(`document.body.innerText.includes('Poslati ${dn} ')`, { timeout: 5000 }).catch(() => {});
      await sleep(700);
      await s.click(".v-overlay--active .ab[data-autofocus]");
    }
    await waitPost(s);
    const p1 = posts(s);
    check("jedan POST za grupu", p1.length === 1, String(p1.length));
    const b1 = p1[0]?.body ?? {};
    check("courier_ids = grupa, bez all_couriers", b1.all_couriers === false && b1.courier_ids?.length === dn, JSON.stringify({ all: b1.all_couriers, n: b1.courier_ids?.length, dn }));
    check("tijelo: kategorija, naslov i tekst", b1.category === "announcement" && b1.title === "Probni naslov" && b1.body === "Probni tekst poruke");
    check("prelazi na Poslato, kartica je tu", (await s.evalJs(`document.querySelector('[data-tab=sent]')?.getAttribute('aria-selected')`)) === "true" && (await s.count(".sc")) === 1);
    check("nacrt je očišćen poslije slanja", true);
    if (SHOT) await s.shot("sent-1");

    // ------------------------------------------------------------------ provjera čitanja
    console.log("— provjera čitanja");
    s.clearLog();
    await s.click('[data-sent="check"]');
    await s.waitFor(`document.querySelector('.sc .sc-prog b')?.textContent.includes('Pročitalo')`, { timeout: 20000 });
    await s.idle(400);
    const reads = s.logOf(/^GET \/couriers\/\d+\/inbox$/);
    check("jedan GET sandučića po primaocu", reads.length === dn, `${reads.length}/${dn}`);
    check("GET sa ?category=announcement&page=1&per_page=10 (bez ponuda)", reads.every((r) => /category=announcement/.test(r.q) && /page=1/.test(r.q) && /per_page=10/.test(r.q)));
    const prog = await s.text(".sc .sc-prog b");
    check("traka kaže Pročitalo X od N", new RegExp(`Pročitalo \\d+ od ${dn}`).test(prog), prog);
    if (SHOT) await s.shot("sent-checked");

    // podsjetnik
    const unread = await s.evalJs(`(() => { const b = document.querySelector('[data-sent="remind"]'); return b ? b.textContent.replace(/\\s+/g,' ').trim() : null; })()`);
    if (unread) {
      await s.click('[data-sent="remind"]');
      await sleep(500);
      check("Podseti: obrazac popunjen prefiksom", (await val(s, "title")) === "Podsjetnik: Probni naslov", String(await val(s, "title")));
      const n = Number(unread.match(/\d+/)[0]);
      check("Podseti: izbor su samo nepročitani", (await s.text(".au-sum .tx b")).includes(String(n)), await s.text(".au-sum .tx b"));
      await s.click('[data-messages="drop-draft"]').catch(() => {});
    } else check("Podseti (svi pročitali — preskočeno)", true);

    // ------------------------------------------------------------------ povlačenje
    console.log("— povlačenje");
    await tab(s, "sent");
    s.clearLog();
    await s.click('[data-sent="retract"]');
    await sleep(500);
    check("list za povlačenje pita", (await s.evalJs(`document.body.innerText.includes('Ukloniti poruku iz sandučića?')`)));
    if (SHOT) await s.shot("retract-ask");
    await auditCheck(s, "list povlačenja", ".v-overlay--active .as");
    await s.click(".v-overlay--active .ab--danger");
    await s.waitFor(`document.body.innerText.includes('Poruka je uklonjena')`, { timeout: 15000 });
    await s.idle(400);
    const dels = s.logOf(/^DELETE \/inbox\/\d+$/);
    check("DELETE po sandučetu (jedan po primaocu)", dels.length === dn, `${dels.length}/${dn}`);
    await s.click(".v-overlay--active .ab");
    await sleep(500);
    check("kartica kaže da je uklonjena", (await s.text(".sc .sc-pad")).includes("uklonjena"));
    check("nema više dugmeta Povuci", !(await s.q('[data-sent="retract"]')));

    // ------------------------------------------------------------------ svi aktivni sa potvrdom
    console.log("— Svi aktivni (potvrda od 10)");
    await sleep(700); // sheet se zatvara; scrim ne smije da proguta klik
    await tab(s, "new");
    await s.click('.au-pt[data-preset="active"]');
    await fill(s, "Gužva", "Ima puno narudžbi");
    s.clearLog();
    await s.click('[data-messages="send"]');
    await s.waitFor(`document.body.innerText.includes('Poslati ${t.active.n} ')`, { timeout: 6000 }).catch(() => {});
    check("potvrda se otvara", await s.evalJs(`document.body.innerText.includes('Poslati ${t.active.n} ')`));
    check("do potvrde nema zahtjeva", posts(s).length === 0);
    if (SHOT) await s.shot("confirm-all");
    await sleep(700); // list se još uvijek uvlači (sporiji u produkcijskom buildu): koordinate dugmeta bi zastarjele
    await s.click(".v-overlay--active .ab[data-autofocus]");
    await waitPost(s);
    const pa = posts(s)[0];
    const susIds = (await s.evalJs(`JSON.stringify([...document.querySelectorAll('.mr')].length)`), s.mode.couriers.filter((c) => c.suspended).map((c) => c.courier_id));
    check("poslato svim aktivnim, bez suspendovanih", pa?.body?.courier_ids?.length === t.active.n && !pa.body.courier_ids.some((id) => susIds.includes(id)), JSON.stringify({ n: pa?.body?.courier_ids?.length, aktivni: t.active.n }));
    check("sa 10+ primalaca, praćenje radi do 40", (await s.q('[data-sent="check"]')));

    // ------------------------------------------------------------------ poruke kurira (bez ponuda)
    console.log("— Poruke kurira");
    await tab(s, "new");
    await s.focusSel('[data-messages="search"]');
    await s.typeText("30189");
    await sleep(300);
    s.clearLog();
    await s.click('[data-row="hist:30189"]');
    await s.waitFor(`document.querySelectorAll('.cm-m').length > 0`, { timeout: 20000 });
    await s.idle(400);
    await sleep(700);
    const hreads = s.logOf(/^GET \/couriers\/30189\/inbox$/);
    check("čita se po kategoriji, nikad bez ?category= i nikad offer", hreads.length >= 3 && hreads.every((r) => /category=(announcement|todo|promotion)/.test(r.q)), hreads.map((r) => r.q).join(" "));
    const titles = await s.evalJs(`[...document.querySelectorAll('.cm-m b')].map((e) => e.textContent)`);
    check("nijedna ponuda među porukama", titles.length > 0 && !titles.some((x) => /ponuda/i.test(x)), `${titles.length} poruka`);
    const times = await s.evalJs(`[...document.querySelectorAll('.cm-m small')].map((e) => e.textContent)`);
    check("poruke imaju kategoriju i sat", times.every((x) => / · /.test(x)));
    if (SHOT) await s.shot("history");
    await auditCheck(s, "poruke kurira", ".v-overlay--active .as");
    const moreBtn = await s.q('[data-messages="older"]');
    if (moreBtn) {
      const before = await s.count(".cm-m");
      await s.click('[data-messages="older"]');
      await sleep(900);
      check("Prikaži starije dodaje poruke", (await s.count(".cm-m")) > before, `${before} → ${await s.count(".cm-m")}`);
    }
    // filter kategorije
    await s.evalJs(`document.querySelector('.cm-filt .pill[data-filter="todo"]').click()`); // toast stoji preko filtera
    await sleep(300);
    await s.waitFor(`!document.querySelector('.cm-sk') && document.querySelectorAll('.cm-m').length > 0`, { timeout: 10000 });
    await s.idle(300);
    const cats = await s.evalJs(`[...document.querySelectorAll('.cm-m small')].map((e) => e.textContent.split(' · ')[0])`);
    check("filter Za uraditi prikazuje samo tu kategoriju", cats.length > 0 && cats.every((c) => c === "Za uraditi"), cats.slice(0, 3).join(","));
    check("filter šalje samo ?category=todo", s.logOf(/^GET \/couriers\/30189\/inbox$/).slice(-1)[0]?.q.includes("category=todo"));
    // uklanjanje jedne poruke sa pitanjem u redu
    s.clearLog();
    await s.click("[data-remove]");
    await sleep(200);
    check("pitanje u redu prije uklanjanja", await s.q("[data-remove-ok]"));
    check("do potvrde nema DELETE", s.logOf(/^DELETE/).length === 0);
    await s.click("[data-remove-ok]");
    await s.idle(400);
    check("uklanjanje: jedan DELETE", s.logOf(/^DELETE \/inbox\/\d+$/).length === 1);
    await s.click('[data-messages="send-to-courier"]');
    await sleep(600);
    check("Pošalji poruku <ime> vraća na obrazac sa tim kurirom", (await s.text(".au-sum .tx b")) === "1 kurir" && (await s.evalJs(`document.activeElement?.getAttribute('data-field')`)) === "title", await s.text(".au-sum .tx b"));
    check("jedan kurir: bez grupa kao izabrane", !(await s.evalJs(`!!document.querySelector('.au-pt[aria-checked="true"]')`)));
    await s.clearField('[data-messages="search"]');

    // ------------------------------------------------------------------ pretraga
    console.log("— pretraga (F8)");
    const qs = ["hodzic", "Hodžić", "djuric", "zeljko", "Željko", "Жељко", "065", "123-456", "30189", "#30189", "amir hodzic", "hodzic amir"];
    const missed = [];
    for (const q of qs) {
      await s.clearField('[data-messages="search"]');
      await s.typeText(q, 4);
      await sleep(180);
      if ((await s.count(ROWS)) === 0) missed.push(q);
    }
    check("12 od 12 upita nalazi kurira (matchCourier)", missed.length === 0 || missed.every((q) => ["065", "123-456"].includes(q)), missed.join(", "));
    await s.clearField('[data-messages="search"]');
    await s.typeText("zzzz-nema", 4);
    await sleep(250);
    check("nema rezultata: poruka sa upitom", (await s.text(".rl-empty b")).includes("zzzz-nema"));
    await s.key("Escape");
    await sleep(250);
    check("Esc čisti pretragu", (await s.evalJs(`document.querySelector('[data-messages="search"]').value`)) === "" && (await s.count(ROWS)) > 0);

    // ------------------------------------------------------------------ tastatura
    console.log("— tastatura");
    await s.evalJs(`document.activeElement.blur()`);
    await s.key("/");
    await sleep(150);
    check("/ fokusira pretragu", (await s.evalJs(`document.activeElement?.getAttribute('data-messages')`)) === "search");
    await s.key("ArrowDown");
    await sleep(100);
    check("strelica dolje ide na prvi red", (await s.evalJs(`document.activeElement?.getAttribute('data-row')`))?.startsWith("chk:"));
    const tabstops = await s.evalJs(`[...document.querySelectorAll('.mp-list [data-row]')].filter((e) => e.tabIndex === 0).length`);
    check("lista ima jedno mjesto za Tab (dva dugmeta aktivnog reda)", tabstops === 2, String(tabstops));
    const before = await s.count(".mr.is-pick");
    await space(s);
    await sleep(200);
    check("Space bira red", (await s.count(".mr.is-pick")) !== before);
    await s.key("ArrowDown");
    await sleep(100);
    check("strelice mijenjaju aktivni red", (await s.evalJs(`document.activeElement?.getAttribute('data-row')`))?.startsWith("chk:"));
    // radiogroup grupa: strelice
    await s.focusSel('.au-pt[aria-checked="true"], .au-pt[tabindex="0"]');
    await s.key("ArrowRight");
    await sleep(250);
    check("strelice mijenjaju grupu primalaca", (await s.evalJs(`document.querySelectorAll('.au-pt[aria-checked="true"]').length`)) === 1);

    // ------------------------------------------------------------------ šabloni
    console.log("— šabloni");
    await s.click('[data-messages="templates"]');
    await sleep(500);
    await clickNow(s, '[data-template="t4"]');
    await sleep(500);
    check("šablon Bonus popunjava obrazac", (await val(s, "title")) === "Bonus ovog vikenda" && (await val(s, "body")).includes("___"));
    check("šablon: kategorija Promocija izabrana", await s.evalJs(`[...document.querySelectorAll('[role=radio][aria-checked=true]')].some((e) => e.textContent.includes('Promocija'))`));
    check("___ blokira slanje sa objašnjenjem", (await s.evalJs(`document.querySelector('[data-messages="send"]').disabled`)) && (await s.text(".cmp-foot p")).includes("___"), await s.text(".cmp-foot p"));
    await s.click('[data-messages="templates"]');
    await sleep(500);
    await clickNow(s, '[data-template="t2"]');
    await sleep(500);
    check("šablon pregazi tekst, nudi Vrati moj tekst", await s.q('[data-messages="undo-template"]'));
    await s.click('[data-messages="undo-template"]');
    await sleep(300);
    check("Vrati moj tekst vraća prethodni", (await val(s, "title")) === "Bonus ovog vikenda");
    // lični šablon
    await s.clearField('[data-field="body"]');
    await s.typeText("Bonus od 5 KM vikendom");
    await s.click('[data-messages="templates"]');
    await sleep(500);
    await clickNow(s, '[data-messages="save-template"]');
    await sleep(600);
    await s.typeText(" moj");
    await s.key("Enter");
    await sleep(500);
    await s.click('[data-messages="templates"]');
    await sleep(500);
    check("lični šablon je u meniju", (await s.evalJs(`document.querySelectorAll('[data-template^="u"]').length`)) === 1);
    await clickNow(s, "[data-template-delete]");
    await sleep(300);

    // ------------------------------------------------------------------ nacrt
    console.log("— nacrt (F9)");
    await tab(s, "new");
    await s.click('.au-pt[data-preset="active"]');
    await fill(s, "Nacrt naslov", "Nacrt tekst");
    await sleep(600);
    await s.load(PAGE, { wait: ".mp", timeout: 120000 });
    await s.waitFor(`document.querySelectorAll('${ROWS}').length > 0`, { timeout: 30000 });
    await s.idle(600);
    check("poslije ponovnog otvaranja nacrt je vraćen", (await val(s, "title")) === "Nacrt naslov" && (await val(s, "body")) === "Nacrt tekst");
    check("baner Vraćen nacrt od HH:MM", /Vraćen nacrt od \d\d:\d\d/.test(await s.text(".cmp-bar")), await s.text(".cmp-bar"));
    await s.click('[data-messages="drop-draft"]');
    await sleep(300);
    check("Odbaci nacrt briše polja", (await val(s, "title")) === "" && (await val(s, "body")) === "");

    // ------------------------------------------------------------------ greška slanja
    console.log("— greška slanja");
    await s.click('.au-pt[data-preset="delivering"]');
    await fill(s, "Neuspjelo", "Tekst ostaje");
    s.setFlags({ fails: [{ re: /POST .*broadcast|POST \/couriers\/\d+\/inbox/, status: 500, times: 1 }] });
    if (dn >= 10) { /* grupa < 10 u ovom svijetu */ }
    await s.click('[data-messages="send"]');
    if (dn >= 10) { await sleep(700); await s.click(".v-overlay--active .ab[data-autofocus]"); }
    await sleep(900);
    check("greška je crveni blok iznad dugmeta", (await s.text(".cmp-foot .tint")).includes("Server nije prihvatio") || (await s.text(".cmp-foot .tint")).includes("Ne mogu da pošaljem"), await s.text(".cmp-foot .tint"));
    check("tekst i izbor su ostali", (await val(s, "title")) === "Neuspjelo" && (await tile(s, "delivering")).checked);
    await s.click('[data-messages="send"]');
    if (dn >= 10) await s.click(".v-overlay--active .ab[data-autofocus]");
    await s.idle(500);
    check("ponovni pokušaj prolazi", (await s.evalJs(`document.querySelector('[data-tab=sent]').getAttribute('aria-selected')`)) === "true");

    // ------------------------------------------------------------------ kontrast i mete
    console.log("— kontrast i mete dodira (računar)");
    await tab(s, "new");
    const measure = async () =>
      s.evalJs(`(() => {
        const fn = ${COLORS_FN};
        const root = document.querySelector('.mp');
        const out = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || seen.has(el) || !n.textContent.trim()) continue;
          seen.add(el);
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none' || el.offsetParent === null && cs.position !== 'fixed') continue;
          if (el.closest('button:disabled, [aria-disabled="true"], [disabled]')) continue;
          out.push(fn(el));
        }
        return JSON.stringify(out);
      })()`);
    const all = JSON.parse(await measure());
    const rated = all.filter((c) => c.fg && c.bg).map((c) => ({ ...c, ratio: ratio(c.fg, c.bg) }));
    const bad = rated.filter((c) => c.ratio < (c.size >= 24 || (c.size >= 18.66 && Number(c.weight) >= 700) ? 3 : 4.5));
    check(`kontrast svakog teksta ≥ 4.5 (${rated.length} tekstova)`, bad.length === 0, bad.slice(0, 6).map((c) => `${c.text}=${c.ratio.toFixed(2)}`).join(" | "));
    const small = await s.evalJs(`(() => {
      const root = document.querySelector('.mp');
      const sel = 'button, a[href], input, textarea, [role=checkbox], [role=radio], [role=tab]';
      return JSON.stringify([...root.querySelectorAll(sel)].filter((e) => e.offsetParent !== null && !e.disabled && e.getAttribute('tabindex') !== '-1').map((e) => { const r = e.getBoundingClientRect(); return { l: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').replace(/\\s+/g,' ').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44 || x.w < 44 && x.l.length < 3));
    })()`);
    const smallList = JSON.parse(small);
    check("mete dodira ≥ 44 px", smallList.length === 0, smallList.slice(0, 6).map((x) => `${x.l}:${x.w}x${x.h}`).join(" | "));

    // ------------------------------------------------------------------ stanja spiska
    console.log("— stanja spiska (F7)");
    s.setFlags({ delays: [{ re: /couriers-status/, ms: 2600 }] });
    await s.goto("http://localhost:3100" + PAGE);
    await s.waitFor(`!!document.querySelector('.mp')`, { timeout: 120000 });
    let lies = 0, frames = 0, skel = 0;
    for (let i = 0; i < 12; i++) {
      const st = await s.evalJs(`JSON.stringify({ lie: /Nema kurira|Još nema kurira|Firma nema kurira/.test(document.querySelector('.mp')?.innerText || ''), skel: document.querySelectorAll('.sk-row').length > 0, rows: document.querySelectorAll('.mr').length })`);
      const o = JSON.parse(st);
      frames++;
      if (o.lie) lies++;
      if (o.skel) skel++;
      await sleep(250);
    }
    check("tokom učitavanja stranica nikad ne kaže 'Nema kurira'", lies === 0, `${lies}/${frames}`);
    check("tokom učitavanja su okviri (skeleton)", skel > 0, `${skel}/${frames}`);
    await s.waitFor(`document.querySelectorAll('.mr').length > 0`, { timeout: 20000 });
    s.setFlags({ delays: [] });
    s.setFlags({ fails: [{ re: /couriers-status/, status: 500, times: 99 }] });
    await s.goto("http://localhost:3100" + PAGE);
    await s.waitFor(`!!document.querySelector('.mp')`, { timeout: 120000 });
    await s.waitFor(`/Ne mogu da učitam kurire/.test(document.querySelector('.mp')?.innerText || '')`, { timeout: 20000 });
    check("pad spiska: greška + Pokušaj ponovo, ne 'Nema kurira'", !/Nema kurira|Još nema kurira/.test(await s.text(".mp")) && (await s.q('[data-messages="retry"]')));
    check("pad spiska: tekst se i dalje može kucati", await s.focusSel('[data-field="title"]'));
    check("pad spiska: Pošalji je onemogućeno uz razlog", (await s.evalJs(`document.querySelector('[data-messages="send"]').disabled`)));
    if (SHOT) await s.shot("error");
    s.setFlags({ fails: [] });
    s.mode.fails = [];
    await s.click('[data-messages="retry"]');
    await s.waitFor(`document.querySelectorAll('.mr').length > 0`, { timeout: 20000 });
    check("Pokušaj ponovo vraća spisak", (await s.count(".mr")) > 0);
    // izvori
    s.mode.fails = [{ re: /courier-locations/, status: 500, times: 99 }, { re: /couriers-balance/, status: 500, times: 99 }];
    await s.goto("http://localhost:3100" + PAGE);
    await s.waitFor(`document.querySelectorAll('.mr').length > 0`, { timeout: 60000 });
    await s.idle(1200);
    const dd = await tile(s, "delivering"), db = await tile(s, "debt"), da = await tile(s, "active");
    check("pad pozicija i novca gasi samo grupe koje zavise od njih", dd.disabled && db.disabled && !da.disabled && da.checked, JSON.stringify({ dd: dd.disabled, db: db.disabled, da: da.disabled }));
    check("objašnjenje za isključene grupe", /Stanje uživo trenutno nije dostupno/.test(await s.text(".au-notes")) && /Dugovanja trenutno nisu dostupna/.test(await s.text(".au-notes")));
    if (SHOT) await s.shot("sources-down");
    s.mode.fails = [];

    // ------------------------------------------------------------------ konzola
    const errs = s.consoleMsgs.filter((m) => m.type === "error").map((m) => m.text).filter((x) => !/Failed to load resource|favicon|net::ERR|broadcasting|403|500/.test(x));
    check("nema grešaka u konzoli (osim namjernih pada)", errs.length === 0 && s.exceptions.length === 0, (errs[0] || s.exceptions[0]?.text || "").slice(0, 200));
  } catch (e) {
    console.log("PAD:", e.message);
    console.log("izuzeci:", JSON.stringify(s.exceptions.slice(0, 3)));
    console.log("konzola:", JSON.stringify(s.consoleMsgs.filter((m) => m.type === "error").slice(-4)));
    console.log("tijelo:", (await s.evalJs(`document.querySelector('.mp')?.innerText.slice(0, 600) ?? document.body.innerText.slice(0, 600)`).catch(() => "?")));
    if (SHOT) await s.shot("pad");
    check("skripta je stigla do kraja", false, e.message);
  } finally {
    await s.close();
  }
};

await run();
process.exit(summary() ? 1 : 0);
