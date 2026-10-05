// E2E nad izrađenom stranicom Poruke: telefon 390 i 320 (dodir), 500 kurira.
//   CHROME_PATH=... node docs/2026/10/poruke-prototip/e2e/n3-poruke-telefon.mjs
import { session, check, summary, sleep, COLORS_FN, ratio } from "./nh.mjs";

const SHOT = process.env.E2E_SHOTS !== "0";
const PAGE = "/dispatcher/notifications";

// Pravi dodir (touchStart/touchEnd) na sredinu elementa.
const tap = async (s, sel, { nth = 0, scroll = true } = {}) => {
  const r = await s.evalJs(`(() => {
    const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}];
    if (!el) return null;
    ${scroll ? "el.scrollIntoView({ block: 'center' });" : ""}
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);
  if (!r || (r.w === 0 && r.h === 0)) throw new Error(`tap: nema vidljivog elementa ${sel}`);
  await sleep(60);
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y }] });
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(160);
  return r;
};
const val = (s, f) => s.evalJs(`document.querySelector('[data-field="${f}"]')?.value ?? null`);
const posts = (s) => s.logOf(/^POST \/(dispatcher\/delivery-companies\/\d+\/broadcast|couriers\/\d+\/inbox)$/);
const overflow = (s) => s.evalJs(`JSON.stringify({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth })`).then(JSON.parse);

const typeInto = async (s, sel, text) => {
  await s.clearField(sel);
  await s.typeText(text);
};

const phone = async (width) => {
  console.log(`— telefon ${width}`);
  const s = await session(`n3-${width}`, { width, height: 844, dpr: 2, mobile: true, world: { n: 28 } });
  try {
    await s.load(PAGE, { wait: ".mp", timeout: 240000 });
    await s.waitFor(`document.querySelectorAll('.au-pt').length > 0`, { timeout: 40000 });
    await s.idle(800);
    if (SHOT) await s.shot("top");
    let o = await overflow(s);
    check(`${width}: nema vodoravnog skrola (vrh)`, o.sw <= o.cw && o.bw <= o.cw, JSON.stringify(o));
    check(`${width}: lista kurira nije na stranici (jedna kolona)`, (await s.count(".mp-list")) === 0);
    check(`${width}: dvije grupe u redu`, await s.evalJs(`(() => { const t = [...document.querySelectorAll('.au-pt')].map((e) => Math.round(e.getBoundingClientRect().top)); return new Set(t).size === 3; })()`));

    // dugme Pošalji zalijepljeno uz dno
    const sendRect = await s.rectOf('[data-messages="send"]');
    check(`${width}: Pošalji je vidljivo bez skrola i uz dno ekrana`, sendRect && sendRect.b <= 844 && sendRect.y > 600, JSON.stringify(sendRect));
    check(`${width}: Pošalji je visoko ≥ 44`, sendRect.h >= 44, String(sendRect.h));

    // ručni izbor je list
    await tap(s, '[data-messages="pick"]');
    await s.waitFor(`document.querySelectorAll('.v-overlay--active .mr').length > 0`, { timeout: 8000 });
    await sleep(500);
    if (SHOT) await s.shot("pick");
    check(`${width}: list Izaberi kurire se otvara sa redovima`, (await s.count(".v-overlay--active .mr")) > 0);
    o = await overflow(s);
    check(`${width}: list bez vodoravnog skrola`, o.sw <= o.cw, JSON.stringify(o));
    const before = await s.text(".v-overlay--active .rl-sub b");
    await tap(s, '.v-overlay--active [data-messages="select-none"]');
    check(`${width}: Poništi briše izbor`, (await s.text(".v-overlay--active .rl-sub b")) === "0", `${before} → ${await s.text(".v-overlay--active .rl-sub b")}`);
    await tap(s, ".v-overlay--active .mr-chk", { nth: 0 });
    await tap(s, ".v-overlay--active .mr-chk", { nth: 1 });
    await sleep(200);
    const after = await s.text(".v-overlay--active .rl-sub b");
    check(`${width}: dodir na kvačicu bira kurira`, after === "2", `${before} → ${after}`);
    // pretraga u listu
    await s.focusSel(".v-overlay--active [data-messages=search]");
    await s.typeText("zeljko", 6);
    await sleep(250);
    check(`${width}: pretraga u listu`, (await s.count(".v-overlay--active .mr")) > 0);
    await s.clearField(".v-overlay--active [data-messages=search]");
    const done = await s.text(".v-overlay--active .ab");
    check(`${width}: Gotovo kaže koliko je izabrano`, /Gotovo · \d+ izabrano/.test(done), done);
    await tap(s, ".v-overlay--active .ab");
    await sleep(700);
    check(`${width}: list se zatvorio`, (await s.count(".v-overlay--active")) === 0);
    check(`${width}: zbir kaže 2 kurira`, (await s.text(".au-sum .tx b")) === "2 kurira", await s.text(".au-sum .tx b"));
    check(`${width}: nijedna grupa nije izabrana (ručni izbor)`, (await s.evalJs(`document.querySelectorAll('.au-pt[aria-checked="true"]').length`)) === 0);

    // pisanje i slanje dodirom
    await tap(s, "[data-field=title]");
    await typeInto(s, "[data-field=title]", "Telefon naslov");
    await typeInto(s, "[data-field=body]", "Telefon tekst poruke");
    await sleep(300);
    s.clearLog();
    await tap(s, '[data-messages="send"]');
    await s.idle(700);
    check(`${width}: dodir na Pošalji šalje jedan zahtjev`, posts(s).length === 1, String(posts(s).length));
    check(`${width}: prelazi na Poslato`, (await s.evalJs(`document.querySelector('[data-tab=sent]').getAttribute('aria-selected')`)) === "true");
    o = await overflow(s);
    check(`${width}: Poslato bez vodoravnog skrola`, o.sw <= o.cw, JSON.stringify(o));
    await tap(s, '[data-sent="check"]');
    await s.waitFor(`document.querySelector('.sc .sc-prog b')?.textContent.includes('Pročitalo')`, { timeout: 20000 });
    await tap(s, '[data-sent="recipients"]');
    await sleep(300);
    o = await overflow(s);
    check(`${width}: lista primalaca bez vodoravnog skrola`, o.sw <= o.cw, JSON.stringify(o));
    if (SHOT) await s.shot("sent");
    await tap(s, '[data-sent="retract"]');
    await sleep(600);
    if (SHOT) await s.shot("retract");
    check(`${width}: list za povlačenje pita`, await s.evalJs(`document.body.innerText.includes('Ukloniti poruku iz sandučića?')`));
    o = await overflow(s);
    check(`${width}: list za povlačenje bez vodoravnog skrola`, o.sw <= o.cw, JSON.stringify(o));
    await tap(s, ".v-overlay--active .ab--ghost");
    await sleep(600);

    // nova poruka: grupe dodirom, 10+ traži potvrdu
    await s.evalJs(`document.querySelector('[data-tab="new"]').click()`);
    await sleep(400);
    await tap(s, '.au-pt[data-preset="active"]');
    await typeInto(s, "[data-field=title]", "Svima");
    await typeInto(s, "[data-field=body]", "Poruka svima");
    s.clearLog();
    await tap(s, '[data-messages="send"]');
    await sleep(700);
    check(`${width}: 10+ primalaca traži potvrdu dodirom`, posts(s).length === 0 && (await s.evalJs(`document.body.innerText.includes('Poslati ')`)));
    if (SHOT) await s.shot("confirm");
    o = await overflow(s);
    check(`${width}: potvrda bez vodoravnog skrola`, o.sw <= o.cw, JSON.stringify(o));
    await tap(s, ".v-overlay--active .ab[data-autofocus]");
    await s.idle(600);
    check(`${width}: potvrda → jedan zahtjev`, posts(s).length === 1, String(posts(s).length));

    // kontrast + mete (donji listovi su zatvoreni; kartice Poslato)
    const texts = JSON.parse(
      await s.evalJs(`(() => {
        const fn = ${COLORS_FN};
        const root = document.querySelector('.mp');
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
    const bad = texts.filter((c) => c.fg && c.bg && ratio(c.fg, c.bg) < (c.size >= 24 ? 3 : 4.5));
    check(`${width}: kontrast ≥ 4.5 (${texts.length} tekstova, Poslato)`, bad.length === 0, bad.slice(0, 5).map((c) => `${c.text}=${ratio(c.fg, c.bg).toFixed(2)}`).join(" | "));
    await s.evalJs(`document.querySelector('[data-tab="new"]').click()`);
    await sleep(400);
    const small = JSON.parse(
      await s.evalJs(`(() => {
        const root = document.querySelector('.mp');
        return JSON.stringify([...root.querySelectorAll('button, a[href], input, textarea, [role=checkbox], [role=radio], [role=tab]')]
          .filter((e) => e.offsetParent !== null && !e.disabled && e.getAttribute('tabindex') !== '-1')
          .map((e) => { const r = e.getBoundingClientRect(); return { l: (e.getAttribute('aria-label') || e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
          .filter((x) => x.h < 44));
      })()`)
    );
    check(`${width}: mete dodira ≥ 44 px (nova poruka)`, small.length === 0, small.slice(0, 5).map((x) => `${x.l}:${x.w}x${x.h}`).join(" | "));
    if (SHOT) await s.shot("full", { full: true });
    const errs = s.consoleMsgs.filter((m) => m.type === "error").map((m) => m.text).filter((x) => !/Failed to load resource|favicon|net::ERR|broadcasting|403/.test(x));
    check(`${width}: nema grešaka u konzoli`, errs.length === 0 && s.exceptions.length === 0, (errs[0] || s.exceptions[0]?.text || "").slice(0, 200));
  } catch (e) {
    check(`${width}: skripta je stigla do kraja`, false, e.message);
    if (SHOT) await s.shot("pad").catch(() => {});
  } finally {
    await s.close();
  }
};

const big = async () => {
  console.log("— 500 kurira (računar)");
  const s = await session("n3-500", { width: 1440, height: 900, world: { n: 500 } });
  try {
    await s.load(PAGE, { wait: ".mp", timeout: 240000 });
    await s.waitFor(`document.querySelectorAll('.mp .mr').length > 0`, { timeout: 60000 });
    await s.idle(1200);
    const rows = await s.count(".mp .mr");
    const nodes = await s.evalJs(`document.querySelectorAll('*').length`);
    check("500 kurira: iscrtano 12 redova", rows === 12, String(rows));
    check("500 kurira: DOM ostaje mali", nodes < 2500, `${nodes} elemenata`);
    const sub = await s.text(".rl-sub");
    check("500 kurira: zbir kaže od 500", /od 500 izabrano/.test(sub), sub);
    await s.focusSel("[data-messages=search]");
    const t0 = Date.now();
    await s.typeText("ha", 8);
    await sleep(300);
    const filtered = await s.count(".mp .mr");
    check("500 kurira: pretraga 'ha' radi", filtered > 0 && filtered <= 12, `${filtered} redova, ${Date.now() - t0} ms`);
    await s.clearField("[data-messages=search]");
    await sleep(250);
    await s.click('[data-messages="more"]');
    await sleep(250);
    check("500 kurira: Prikaži još dodaje 12", (await s.count(".mp .mr")) === 24);
    await s.click('[data-messages="select-shown"]');
    await sleep(300);
    const sum = await s.text(".au-sum .tx b");
    check("500 kurira: Izaberi prikazane (ručni izbor, jedan skup id-jeva)", /\d+ kurira/.test(sum), sum);
    // slanje većem broju kurira: potvrda; više od 40 ne prati čitanje
    await s.click('.au-pt[data-preset="active"]');
    await s.clearField('[data-field="title"]');
    await s.typeText("Svih 500");
    await s.clearField('[data-field="body"]');
    await s.typeText("Poruka za sve");
    s.clearLog();
    await s.click('[data-messages="send"]');
    await sleep(600);
    check("500 kurira: potvrda se traži", await s.evalJs(`document.body.innerText.includes('Poslati ')`));
    await s.click(".v-overlay--active .ab[data-autofocus]");
    await s.idle(800);
    const p = posts(s);
    check("500 kurira: jedan POST sa courier_ids", p.length === 1 && p[0].body.all_couriers === false && p[0].body.courier_ids.length > 400, p[0] ? String(p[0].body.courier_ids?.length) : "0");
    await sleep(400);
    check("500 kurira: čitanje se ne prati (više od 40), a Povuci ostaje", /Čitanje se ne prati/.test(await s.text(".sc")) && (await s.q('[data-sent="retract"]')) && !(await s.q('[data-sent="check"]')));
    if (SHOT) await s.shot("sent-big");
    await sleep(21000); // nema automatske provjere za > 40
    check("500 kurira: nema automatske provjere sandučića", s.logOf(/^GET \/couriers\/\d+\/inbox$/).length === 0, String(s.logOf(/^GET \/couriers\/\d+\/inbox$/).length));
  } catch (e) {
    check("500 kurira: skripta je stigla do kraja", false, e.message);
  } finally {
    await s.close();
  }
};

const only = process.argv[2];
if (!only || only === "phone") {
  await phone(390);
  await phone(320);
}
if (!only || only === "big") await big();
process.exit(summary() ? 1 : 0);
