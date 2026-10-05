// E2E nad izrađenom stranicom Poruke: kad nešto pođe naopako (server javi manje, provjera pada, povlačenje djelimično),
// dvije iste poruke, "Poslato" poslije ponovnog učitavanja.
//   CHROME_PATH=... node docs/2026/10/poruke-prototip/e2e/n4-poruke-greske.mjs
import { session, check, summary, sleep } from "./nh.mjs";

const PAGE = "/dispatcher/notifications";
const posts = (s) => s.logOf(/^POST \/(dispatcher\/delivery-companies\/\d+\/broadcast|couriers\/\d+\/inbox)$/);
const val = (s, f) => s.evalJs(`document.querySelector('[data-field="${f}"]')?.value ?? null`);
const tab = async (s, name) => {
  await s.evalJs(`document.querySelector('[data-tab="${name}"]').click()`);
  await sleep(350);
};
const fill = async (s, title, body) => {
  await s.clearField('[data-field="title"]');
  await s.typeText(title);
  await s.clearField('[data-field="body"]');
  await s.typeText(body);
};
const clickJs = async (s, sel, nth = 0) => {
  await s.evalJs(`document.querySelectorAll(${JSON.stringify(sel)})[${nth}].click()`);
  await sleep(250);
};
// Pošalji grupi "U dostavi" (3 kurira u ovom svijetu, bez potvrde).
const sendDelivering = async (s, title, body) => {
  await tab(s, "new");
  await s.click('.au-pt[data-preset="delivering"]');
  await fill(s, title, body);
  s.clearLog();
  await s.click('[data-messages="send"]');
  await s.idle(700);
  return posts(s)[0]?.body?.courier_ids ?? [];
};

const s = await session("n4", { width: 1440, height: 900, world: { n: 28 } });
try {
  await s.load(PAGE, { wait: ".mp", timeout: 240000 });
  await s.waitFor(`document.querySelectorAll('.mp .mr').length > 0`, { timeout: 40000 });
  await s.idle(800);

  // ---------------------------------------------------------------- server javi manje
  console.log("— server javi manje (F6)");
  s.mode.broadcastOverride = 2;
  const ids1 = await sendDelivering(s, "Manje stiglo", "Tekst jedan");
  s.mode.broadcastOverride = undefined;
  check("poslato je trojici", ids1.length === 3, String(ids1.length));
  check("kartica kaže da je server javio manje", /Server je javio manje/.test(await s.text(".sc")) && /2 od 3/.test(await s.text(".sc")), (await s.text(".sc")).slice(0, 160));
  check("toast kaže 2 od 3 (ne 'poslata 3')", /Poruka poslata 2 od 3 kurira/.test(await s.text("body")), "");

  // ---------------------------------------------------------------- provjera pada za jednog
  console.log("— provjera pada za jednog kurira");
  const failId = ids1[0];
  s.mode.fails = [{ re: new RegExp(`^GET /couriers/${failId}/inbox$`), status: 500, times: 99 }];
  s.clearLog();
  await s.click('[data-sent="check"]');
  await s.waitFor(`document.querySelector('.sc .sc-prog b')?.textContent.includes('Pročitalo')`, { timeout: 20000 });
  await s.idle(400);
  const leg = await s.text(".sc .leg");
  check("zbir kaže 'Provjera nije uspjela 1'", /Provjera nije uspjela 1/.test(leg), leg);
  await clickJs(s, '[data-sent="recipients"]');
  await clickJs(s, '.sc [data-filter="missing"]');
  const failRow = await s.text(".sc .sc-rr");
  check("kurir bez provjere ima svoj natpis u filteru", /Provjera nije uspjela/.test(failRow), failRow);
  check("greška provjere nije 'nije pročitano'", !/Nije pročitano/.test(failRow));
  check("provjera nije stala (pale 1 od 3, ne više od trećine)", !(await s.q(".sc .tint--warn[role=alert]")));
  s.mode.fails = [];

  // ---------------------------------------------------------------- provjera staje kad padne više od trećine
  console.log("— provjera staje kad padne više od trećine");
  s.mode.fails = [{ re: /^GET \/couriers\/\d+\/inbox$/, status: 500, times: 99 }];
  await clickJs(s, '[data-sent="check"]');
  await s.idle(800);
  await sleep(300);
  check("kartica kaže 'Server je zauzet'", /Server je zauzet/.test(await s.text(".sc")), (await s.text(".sc")).slice(0, 200));
  s.mode.fails = [];

  // ---------------------------------------------------------------- dvije iste poruke: svaka dobija svoju
  console.log("— dvije iste poruke");
  await sleep(1100);
  const idsA = await sendDelivering(s, "Isti tekst", "Isti tekst poruke");
  await sleep(1500);
  const idsB = await sendDelivering(s, "Isti tekst", "Isti tekst poruke");
  check("dvije kartice istog teksta", (await s.count(".sc")) === 3, String(await s.count(".sc")));
  // provjeri obje (poredak: najnovija prva)
  s.clearLog();
  await clickJs(s, '[data-sent="check"]', 0);
  await s.waitFor(`document.querySelectorAll('.sc')[0].querySelector('.sc-prog b')?.textContent.includes('Pročitalo')`, { timeout: 20000 });
  await clickJs(s, '[data-sent="check"]', 1);
  await s.waitFor(`document.querySelectorAll('.sc')[1].querySelector('.sc-prog b')?.textContent.includes('Pročitalo')`, { timeout: 20000 });
  await s.idle(400);
  const sb = s.mode.world;
  const msgsOf = (id, title) => sb.inbox.get(id).filter((m) => m.title === title && m.sender === "dispatcher");
  const both = ids1.every((id) => msgsOf(id, "Isti tekst").length === 2) || idsA.every((id) => msgsOf(id, "Isti tekst").length === 2);
  check("u sandučićima su dvije poruke istog teksta", both);
  const ci = (n) => s.evalJs(`document.querySelectorAll('.sc')[${n}].querySelector('.sc-prog b')?.textContent`);
  check("obje kartice su provjerene sa 'od 3'", /od 3/.test(await ci(0)) && /od 3/.test(await ci(1)), `${await ci(0)} | ${await ci(1)}`);
  // povlačenje starije ne smije dirnuti novu
  const idsIsti = idsA;
  const newestBefore = idsIsti.map((id) => msgsOf(id, "Isti tekst").length);
  s.clearLog();
  await clickJs(s, '[data-sent="retract"]', 1); // starija kartica
  await sleep(500);
  await s.click(".v-overlay--active .ab--danger");
  await s.waitFor(`document.body.innerText.includes('Poruka je uklonjena')`, { timeout: 15000 });
  await s.idle(400);
  const afterOld = idsIsti.map((id) => msgsOf(id, "Isti tekst").length);
  check("povlačenje starije uklanja po jednu poruku, nova ostaje", newestBefore.every((n) => n === 2) && afterOld.every((n) => n === 1), JSON.stringify({ newestBefore, afterOld }));
  const survivors = idsIsti.map((id) => msgsOf(id, "Isti tekst")[0]);
  const newerWins = survivors.every((m) => Date.parse(m.sent_at) > Date.now() - 4 * 60_000);
  check("preostala poruka je ona novija", newerWins);
  await s.click(".v-overlay--active .ab");
  await sleep(700);

  // ---------------------------------------------------------------- povlačenje bez prethodne provjere i djelimično
  console.log("— povlačenje bez provjere, djelimično, ponovo");
  const idsC = await sendDelivering(s, "Povuci me", "Tekst za povlačenje");
  const failIdx = idsC[1];
  const target = sb.inbox.get(failIdx).find((m) => m.title === "Povuci me");
  s.mode.fails = [{ re: new RegExp(`^DELETE /inbox/${target.id}$`), status: 500, times: 99 }];
  s.clearLog();
  await clickJs(s, '[data-sent="retract"]', 0);
  await sleep(500);
  await s.click(".v-overlay--active .ab--danger");
  await s.waitFor(`document.body.innerText.includes('Uklonjeno djelimično')`, { timeout: 15000 });
  await s.idle(400);
  const order = s.log ? [] : s.mode.log.map((e) => e.method);
  const firstDelete = s.mode.log.findIndex((e) => e.method === "DELETE");
  const lastGetBeforeDelete = s.mode.log.slice(0, firstDelete).filter((e) => e.method === "GET" && /inbox/.test(e.path)).length;
  check("bez prethodne provjere najprije traži poruku u sandučićima", lastGetBeforeDelete === 3, String(lastGetBeforeDelete));
  const dtext = await s.text(".v-overlay--active .tint");
  check("list kaže djelimično: 2 uklonjeno, 1 nije", /Uklonjena iz 2 sandučića, 1 nije uspjelo/.test(dtext), dtext);
  check("nudi Pokušaj ponovo", /Pokušaj ponovo/.test(await s.text(".v-overlay--active .as-foot")));
  s.mode.fails = [];
  s.clearLog();
  await s.click(".v-overlay--active .ab[data-autofocus]");
  await s.waitFor(`document.body.innerText.includes('Poruka je uklonjena')`, { timeout: 15000 });
  await s.idle(400);
  const retryDeletes = s.logOf(/^DELETE \/inbox\/\d+$/);
  check("ponovni pokušaj briše samo preostalu poruku (1 DELETE, bez novog čitanja)", retryDeletes.length === 1 && s.logOf(/^GET \/couriers\/\d+\/inbox$/).length === 0, `${retryDeletes.length} DELETE, ${s.logOf(/^GET \/couriers\/\d+\/inbox$/).length} GET`);
  await s.click(".v-overlay--active .ab");
  await sleep(700);
  check("kartica: uklonjena iz 3 od 3", /Uklonjena iz 3 od 3/.test(await s.text(".sc")), (await s.text(".sc")).slice(0, 160));
  check("sve tri poruke su stvarno nestale iz sandučića", idsC.every((id) => !sb.inbox.get(id).some((m) => m.title === "Povuci me")));

  // ---------------------------------------------------------------- Poslato poslije ponovnog učitavanja (sessionStorage)
  console.log("— Poslato poslije ponovnog učitavanja");
  const cards = await s.count(".sc");
  await s.load(PAGE, { wait: ".mp", timeout: 120000 });
  await s.waitFor(`document.querySelectorAll('.mp .mr').length > 0`, { timeout: 30000 });
  await s.idle(600);
  await tab(s, "sent");
  check("kartice Poslato su i dalje tu (ova sesija)", (await s.count(".sc")) === cards, `${cards} → ${await s.count(".sc")}`);
  check("nacrt nije vraćen (poslato je poslato)", (await val(s, "title")) === "" && !(await s.q(".cmp-bar")));
  check("uklonjena poruka je i dalje označena kao uklonjena", /uklonjena/.test(await s.text(".sc")));

  const errs = s.consoleMsgs.filter((m) => m.type === "error").map((m) => m.text).filter((x) => !/Failed to load resource|favicon|net::ERR|broadcasting|403|500/.test(x));
  check("nema grešaka u konzoli", errs.length === 0 && s.exceptions.length === 0, (errs[0] || s.exceptions[0]?.text || "").slice(0, 200));
} catch (e) {
  check("skripta je stigla do kraja", false, e.message);
  await s.shot("pad").catch(() => {});
} finally {
  await s.close();
}
process.exit(summary() ? 1 : 0);
