// A2: tokovi stranice Finansije "prije": potvrda predaje, uplata, isplata, pretraga, sortiranje, filteri, ponovno čitanje po tabu.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { session, sleep, dir, check, summary } from "./fh.mjs";
import { texts } from "./ff.mjs";

const out = {};
const s = await session("a2", { width: 1440, height: 900, dpr: 1, mobile: false });
s.__name = "a2";
const F = s.mode.fin;

const tab = async (key) => { await s.click(`[role=tab][data-tab="${key}"]`); await s.idle(500); await sleep(400); };
const posts = () => s.mode.log.filter((e) => e.method !== "GET").map((e) => `${e.method} ${e.path} ${JSON.stringify(e.body)}`);
const toast = () => s.evalJs(`[...document.querySelectorAll('.v-snackbar, .v-alert, [role=alert], .global-alerts *')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0, 6)`);
const dlg = () => s.evalJs(`!!document.querySelector('.v-overlay--active .v-card')`);
const rowIds = () => s.evalJs(`[...document.querySelectorAll('.global-table tbody tr .balance-id')].map((e) => Number(e.textContent.replace('#','')))`);

try {
  await s.load("/dispatcher/finance", { wait: ".global-tab-bar", extra: 800 });
  await s.idle(600);

  // ---------- S1a: potvrda - fokus i Enter
  s.clearLog();
  await s.click(".handover-row button");
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`);
  await sleep(600);
  out.confirmFocus = await s.evalJs(`(() => { const e = document.activeElement; return { tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 50), insideForm: !!e.closest('form') }; })()`);
  await s.key("Enter");
  await sleep(900);
  out.enterOnOpenDialog = { stillOpen: await dlg(), posts: posts() };
  // pravi klik na Potvrdi (dvaput brzo, da se vidi dupli POST)
  if (await dlg()) {
    const r = await s.rectOf(".v-overlay--active button[type=submit]");
    await s.clickAt(r.x + r.w / 2, r.y + r.h / 2, 5);
    await s.clickAt(r.x + r.w / 2, r.y + r.h / 2, 5);
    await sleep(1200);
  }
  out.afterConfirm = {
    posts: posts(),
    requests: s.mode.log.map((e) => `${e.method} ${e.path}`),
    badge: await s.evalJs(`document.querySelector('.tab-pill-badge')?.textContent.trim() ?? null`),
    rowsLeft: (await texts(s, ".handover-row")).length,
    toast: await toast(),
    dialogOpen: await dlg(),
  };
  await s.shot("a2-1-after-confirm");

  // ---------- S2: pretraga balansa (12 realnih upita)
  await tab("balances");
  const bal = F.balances;
  const FOLD = (t) => String(t ?? "").toLowerCase().replace(/đ/g, "dj").replace(/[ćč]/g, "c").replace(/š/g, "s").replace(/ž/g, "z")
    .replace(/љ/g, "lj").replace(/њ/g, "nj").replace(/џ/g, "dz").replace(/ђ/g, "dj").replace(/ћ/g, "c").replace(/ч/g, "c").replace(/ш/g, "s").replace(/ж/g, "z")
    .replace(/./g, (c) => ({ а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", з: "z", и: "i", ј: "j", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c" }[c] ?? c))
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  const digits = (t) => String(t ?? "").replace(/\D/g, "");
  const phoneKey = (t) => { let d = digits(t); if (String(t).trim().startsWith("+")) d = d.slice(3); else if (d.startsWith("00")) d = d.slice(5); else if (d.startsWith("0")) d = d.slice(1); return d; };
  const expected = (q) => {
    const n = FOLD(q.replace(/^#/, "")).trim();
    const qd = digits(q);
    return bal.filter((b) => {
      const idOk = String(b.courier_id).includes(qd) && qd.length >= 3;
      const nameOk = n && !/^[\d\s+()\/.-]+$/.test(n) && n.split(/\s+/).every((t) => FOLD(b.name).includes(t));
      const phoneOk = qd.length >= 3 && b.phone && (phoneKey(b.phone).includes(phoneKey(q)) || digits(b.phone).includes(qd));
      return idOk || nameOk || phoneOk;
    }).map((b) => b.courier_id).sort((a, b) => a - b);
  };
  const queries = ["hodzic", "Hodžić", "zeljko", "željko", "djuric", "đurić", "марковић", "Zeljko Djuric", "065/123-456", "065123456", "+387 65 123 456", "30189"];
  out.search = [];
  for (const q of queries) {
    await s.clearField(".balance-search input");
    await s.typeText(q, 4);
    await sleep(350);
    const got = (await rowIds()).sort((a, b) => a - b);
    const exp = expected(q);
    const hit = exp.filter((id) => got.includes(id));
    out.search.push({ q, expected: exp, got, found: hit.length, of: exp.length, ok: exp.length > 0 && hit.length === exp.length });
  }
  await s.clearField(".balance-search input");
  await sleep(200);
  out.searchSummary = { queries: queries.length, queriesFullyFound: out.search.filter((x) => x.ok).length, queriesWithExpected: out.search.filter((x) => x.of > 0).length };

  // ---------- S3: sortiranje po koloni "Kurir"
  await s.click(".global-table th.sortable");
  await sleep(300);
  out.sortByKurir = (await texts(s, ".global-table tbody tr")).slice(0, 4).map((t) => t.slice(0, 40));

  // ---------- S1c: uplata punog duga (koraci) - Amir Hodžić 30189
  s.clearLog();
  await s.evalJs(`document.querySelector('.global-table th.sortable')?.click(); document.querySelector('.global-table th.sortable')?.click();`); // vrati bez sortiranja
  await sleep(200);
  await s.clearField(".balance-search input");
  await s.typeText("30189", 4);
  await sleep(300);
  let steps = 0;
  await s.click(".row-actions button", { textIncludes: "Uplata" }); steps++;
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`);
  await sleep(600);
  out.receiptPrefill = await s.evalJs(`document.querySelector('.v-overlay--active input[type=number]').value`);
  await s.click(".v-overlay--active input[type=number]"); steps++;
  await s.typeText("180.70", 4);
  await s.click(".v-overlay--active button[type=submit]"); steps++;
  await sleep(1200);
  out.receiptFull = { steps, charsTyped: 6, posts: posts(), toast: await toast(), dialogOpen: await dlg() };
  await s.shot("a2-2-after-receipt");

  // ---------- S13: uplata iznad duga (Enis Čolić 29980, dug 45.50) - upozorenje tek poslije
  await s.clearField(".balance-search input");
  await s.typeText("29980", 4);
  await sleep(300);
  s.clearLog();
  await s.click(".row-actions button", { textIncludes: "Uplata" });
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`);
  await sleep(600);
  await s.click(".v-overlay--active input[type=number]");
  await s.typeText("999", 4);
  await sleep(300);
  out.overDebtBeforeSubmit = { texts: await texts(s, ".v-overlay--active .v-messages__message, .v-overlay--active .confirm-diff"), submitDisabled: await s.evalJs(`document.querySelector('.v-overlay--active button[type=submit]').disabled`) };
  await s.click(".v-overlay--active button[type=submit]");
  await sleep(1300);
  out.overDebtAfter = { posts: posts(), toast: await toast(), row: (await texts(s, ".global-table tbody tr"))[0] };
  await s.shot("a2-3-over-debt-after");

  // ---------- S14: isplata, ponovni pokušaj: isti ključ?
  await s.clearField(".balance-search input");
  await s.typeText("30201", 4); // Lazar Zec, zarada 86.40
  await sleep(300);
  s.clearLog();
  s.setFlags({ fails: [{ re: /POST \/dispatcher\/couriers\/\d+\/payout/, status: 500, times: 1 }] });
  await s.click(".row-actions button", { textIncludes: "Isplata" });
  await s.waitFor(`!!document.querySelector('.v-overlay--active .v-card')`);
  await sleep(600);
  await s.click(".v-overlay--active input[type=number]");
  await s.typeText("86.40", 4);
  await s.click(".v-overlay--active button[type=submit]");
  await sleep(1200);
  out.payoutFail = { dialogOpen: await dlg(), alertTexts: await s.evalJs(`[...document.querySelectorAll('.page-alert, .v-alert')].map((e) => ({ t: e.textContent.replace(/\\s+/g,' ').trim(), z: getComputedStyle(e.closest('.v-overlay') || e).zIndex }))`) };
  await s.shot("a2-4-payout-fail-dialog-open");
  await s.click(".v-overlay--active button[type=submit]");
  await sleep(1300);
  const pays = s.mode.log.filter((e) => /payout$/.test(e.path)).map((e) => e.body);
  out.payoutRetry = { bodies: pays, sameKey: pays.length === 2 && pays[0].idempotency_key === pays[1].idempotency_key, toast: await toast(), dialogOpen: await dlg() };
  s.setFlags({ fails: [] });

  // ---------- S4/S5: filteri istorije i ponovno čitanje
  await s.clearField(".balance-search input");
  await tab("history");
  s.clearLog();
  // izaberi Status = Potvrđeno
  await s.click(".history-field:nth-child(2) .v-field");
  await s.waitFor(`document.querySelectorAll('.v-overlay--active .v-list-item').length > 0`);
  await sleep(300);
  await s.click(".v-overlay--active .v-list-item", { textIncludes: "Potvrđeno" });
  await sleep(700);
  out.historyFilterSet = { requests: s.mode.log.map((e) => `${e.method} ${e.path}${e.q}`), rows: (await s.evalJs(`document.querySelectorAll('.global-table tbody tr').length`)) };
  s.clearLog();
  await tab("payouts");
  await tab("history");
  out.historyAfterTabRoundTrip = {
    requests: s.mode.log.map((e) => `${e.method} ${e.path}${e.q}`),
    statusFieldValue: await s.evalJs(`document.querySelector('.history-field:nth-child(2) .v-select__selection-text, .history-field:nth-child(2) .v-select__selection')?.textContent.trim() ?? ''`),
    rows: await s.evalJs(`document.querySelectorAll('.global-table tbody tr').length`),
  };
  s.clearLog();
  await tab("balances"); await tab("handovers"); await tab("balances");
  out.balancesRoundTrip = { requests: s.mode.log.map((e) => `${e.method} ${e.path}${e.q}`) };

  // ---------- S6: dijalog detalja - dugme u dijalogu
  out.consoleWarn = [...new Set(s.consoleMsgs.filter((m) => /warn|error/i.test(m.type)).map((m) => `${m.type}: ${m.text.slice(0, 120)}`))];
  out.exceptions = s.exceptions;
} catch (e) {
  out.error = String(e.stack || e);
  console.error(out.error);
} finally {
  writeFileSync(path.join(dir, "a2-flows.json"), JSON.stringify(out, null, 1));
  await s.close();
}
console.log("gotovo -> a2-flows.json");
