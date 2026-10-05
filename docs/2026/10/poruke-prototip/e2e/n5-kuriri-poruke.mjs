// E2E: promjene na ekranu Kuriri (D13 "Zadnja poruka" bez ponude, D11 veza "Sve poruke").
//   CHROME_PATH=... node docs/2026/10/poruke-prototip/e2e/n5-kuriri-poruke.mjs
import { session, check, summary, sleep } from "./nh.mjs";

const s = await session("n5", { width: 1440, height: 900, world: { n: 28 } });
try {
  // inbox-summary vraća ponudu kao zadnju poruku (po dokumentu 21.09, R11): "polluted" je zadano u harnessu
  await s.load("/dispatcher/couriers?c=30189", { wait: "[data-detail='close']", timeout: 240000 });
  await s.waitFor(`!!document.querySelector('[data-row="poruka"]')`, { timeout: 30000 });
  await s.idle(1200);
  const row = await s.text('[data-row="poruka"]');
  check("D13: 'Zadnja poruka' nije ponuda", !/ponuda/i.test(row) && row.length > 0, row);
  check("D13: zadnja poruka je prava poruka dispečera", /Javi se dispečeru|Pada kiša|Provjeri vozilo|Predaj gotovinu|Nova zona|Vikend bonus|Dobrodošli/.test(row), row);
  const recent = await s.evalJs(`[...document.querySelectorAll('.ml .mi b')].map((e) => e.textContent)`);
  check("zadnje poruke u detalju nisu ponude", recent.length > 0 && !recent.some((x) => /ponuda/i.test(x)), recent.join(" | "));
  check("veza 'Sve poruke' u detalju", await s.q('[data-row="sve-poruke"]'));
  s.clearLog();
  await sleep(300);
  await s.click('[data-row="sve-poruke"]');
  await s.waitFor(`document.querySelectorAll('.cm-m').length > 0`, { timeout: 15000 });
  await s.idle(500);
  const titles = await s.evalJs(`[...document.querySelectorAll('.cm-m b')].map((e) => e.textContent)`);
  check("'Sve poruke' otvara list sa porukama kurira, bez ponuda", titles.length > 0 && !titles.some((x) => /ponuda/i.test(x)), `${titles.length} poruka`);
  const reads = s.logOf(/^GET \/couriers\/30189\/inbox$/);
  check("čita po kategoriji (3 zahtjeva), nikad bez ?category=", reads.length >= 3 && reads.every((r) => /category=(announcement|todo|promotion)/.test(r.q)), reads.map((r) => r.q).join(" "));
  await sleep(700);
  check("dugme 'Pošalji poruku <ime>'", /Pošalji poruku Amir/.test(await s.text(".v-overlay--active .as-foot")), await s.text(".v-overlay--active .as-foot"));
  await s.click('[data-messages="send-to-courier"]');
  await sleep(900);
  check("Pošalji poruku otvara list 'Poruka kuriru' za tog kurira", /Poruka kuriru/.test(await s.text(".v-overlay--active")) || (await s.evalJs(`document.body.innerText.includes('Poruka kuriru')`)));
  const errs = s.consoleMsgs.filter((m) => m.type === "error").map((m) => m.text).filter((x) => !/Failed to load resource|favicon|net::ERR|broadcasting|403/.test(x));
  check("nema grešaka u konzoli", errs.length === 0 && s.exceptions.length === 0, (errs[0] || s.exceptions[0]?.text || "").slice(0, 200));
} catch (e) {
  check("skripta je stigla do kraja", false, e.message);
} finally {
  await s.close();
}
process.exit(summary() ? 1 : 0);
