// "Prije", dio 1: stanja stranice /dispatcher/notifications na računaru (1440x900).
import { session, sleep } from "./nh.mjs";
import { tagFields, waitCouriers, visibleTexts, openRecipients, menuItems, saveJson } from "./nlib.mjs";

const OUT = {};
const log = (k, v) => {
  OUT[k] = v;
  console.log(k, JSON.stringify(v));
};

// ---------- A: učitavanje dok spisak kurira kasni ----------
{
  const s = await session("n1a", { world: { n: 28 } });
  try {
    s.setFlags({ delays: [{ re: /couriers-status/, ms: 2600 }] });
    await s.load("/dispatcher/notifications", { wait: ".composer", timeout: 240000 });
    const t0 = Date.now();
    const frames = [];
    for (let i = 0; i < 26; i++) {
      frames.push({
        t: Date.now() - t0,
        empty: (await visibleTexts(s, ".history-empty"))[0] ?? null,
        rows: await s.count(".history-courier-row"),
        busy: await s.count(".v-progress-circular, .v-progress-linear, .v-skeleton-loader, [role=progressbar]"),
        sendDisabled: await s.evalJs(`document.querySelector('.composer button[type=submit]')?.disabled ?? null`),
      });
      if (i === 4) await s.shot("loading");
      await sleep(130);
    }
    const wrong = frames.filter((f) => f.empty && f.rows === 0);
    log("A_loading", {
      framesTotal: frames.length,
      framesWithEmptyClaim: wrong.length,
      firstEmptyAt: wrong[0]?.t ?? null,
      lastEmptyAt: wrong.at(-1)?.t ?? null,
      text: wrong[0]?.empty ?? null,
      busyIndicators: Math.max(...frames.map((f) => f.busy)),
      rowsAtEnd: frames.at(-1).rows,
    });
  } finally {
    await s.close();
  }
}

// ---------- B..G: učitano stanje, validacija, primaoci, slanje ----------
{
  const s = await session("n1b", { world: { n: 28 } });
  try {
    await s.load("/dispatcher/notifications", { wait: ".composer", timeout: 240000 });
    await waitCouriers(s);
    await s.idle(700);
    await tagFields(s);
    const rows0 = await s.count(".history-courier-row");
    const m = await s.evalJs(`({ nodes: document.querySelectorAll('*').length, h: document.documentElement.scrollHeight, vh: innerHeight, sendY: Math.round(document.querySelector('.composer button[type=submit]').getBoundingClientRect().bottom + scrollY), pageW: Math.round(document.querySelector('.global-page').getBoundingClientRect().width), composerW: Math.round(document.querySelector('.composer').getBoundingClientRect().width) })`);
    log("B_loaded", { ...m, rows: rows0, counts: { ...s.mode.counts } });
    await s.shot("loaded", { full: true });

    // C: slanje bez ičega
    await s.click(".composer button[type=submit]");
    await sleep(500);
    const errs = await visibleTexts(s, ".composer .v-messages__message");
    log("C_validation", { messages: errs });
    await s.shot("validation");

    // D: meni primalaca
    await openRecipients(s);
    const items = await menuItems(s);
    log("D_menu", { count: items.length, first: items.slice(0, 3), suspendedInLabel: items.filter((t) => /suspendovan/.test(t)).length, liveInfo: items.some((t) => /dostav|online|offline|uživo/i.test(t)) });
    await s.shot("menu");
    const queries = ["hodzic", "Hodžić", "djuric", "zeljko", "Željko", "Жељко", "065", "30189", "#30189", "amir hodzic", "hodzic amir"];
    const searchRes = {};
    for (const q of queries) {
      await s.clearField("[data-t=rcpt]");
      await s.typeText(q);
      await sleep(350);
      const its = (await menuItems(s)).filter((t) => !/Izaberi sve/.test(t));
      const nodata = its.length === 1 && /Nema kurira/.test(its[0]);
      searchRes[q] = nodata ? 0 : its.length;
    }
    log("D_menuSearch", searchRes);
    await s.clearField("[data-t=rcpt]");
    await sleep(250);

    // E: ručni izbor 8 kurira pa svi
    const clicks = [];
    for (let i = 1; i <= 8; i++) {
      await s.click(".v-overlay--active .v-list-item", { nth: i, wait: 60 });
    }
    await sleep(250);
    const chips8 = await s.evalJs(`({ chips: document.querySelectorAll('.composer .v-autocomplete .v-chip').length, h: Math.round(document.querySelector('.composer .v-autocomplete').getBoundingClientRect().height), count: document.querySelector('.composer-count')?.textContent.trim() })`);
    log("E_manual8", chips8);
    await s.click(".v-overlay--active .v-list-item", { nth: 0, wait: 120 }); // Izaberi sve (prvo čekira ostale)
    await sleep(250);
    await s.key("Escape");
    await sleep(300);
    const chipsAll = await s.evalJs(`({ chips: document.querySelectorAll('.composer .v-autocomplete .v-chip').length, h: Math.round(document.querySelector('.composer .v-autocomplete').getBoundingClientRect().height), count: document.querySelector('.composer-count')?.textContent.trim(), cardH: Math.round(document.querySelector('.composer').closest('.global-card').getBoundingClientRect().height) })`);
    log("E_all", chipsAll);
    await s.shot("all-selected", { full: true });

    // F: slanje svima
    await s.clearField("[data-t=title]");
    await s.typeText("Pada kiša, pazite na put");
    await s.focusSel("[data-t=body]");
    await s.typeText("Kiša cijeli dan. Vozite oprezno.");
    await s.clearLog();
    await s.click(".composer button[type=submit]");
    await sleep(900);
    const posts = s.logOf(/POST .*broadcast/);
    const toast = (await visibleTexts(s, ".global-alert-card"))[0] ?? null;
    const after = await s.evalJs(`({ title: document.querySelector('[data-t=title]')?.value, body: document.querySelector('[data-t=body]')?.value, chips: document.querySelectorAll('.composer .v-autocomplete .v-chip').length, count: document.querySelector('.composer-count')?.textContent.trim() })`);
    await s.idle(600);
    log("F_send", { posts: posts.length, body: posts[0]?.body ? { ...posts[0].body, courier_ids: posts[0].body.courier_ids?.length } : null, toast, after, summaryCallsAfterSend: s.logOf(/GET .*inbox-summary/).length });
    await s.shot("after-send");
  } finally {
    await s.close();
  }
}

// ---------- J: backend javi manji broj nego što je ekran obećao ----------
{
  const s = await session("n1j", { world: { n: 28 } });
  try {
    s.mode.broadcastOverride = 25;
    await s.load("/dispatcher/notifications", { wait: ".composer", timeout: 240000 });
    await waitCouriers(s);
    await s.idle(500);
    await tagFields(s);
    await openRecipients(s);
    await s.click(".v-overlay--active .v-list-item", { nth: 0, wait: 150 });
    await s.key("Escape");
    await sleep(200);
    const promised = await s.evalJs(`document.querySelector('.composer-count')?.textContent.trim()`);
    await s.clearField("[data-t=title]");
    await s.typeText("Test C");
    await s.focusSel("[data-t=body]");
    await s.typeText("Tekst C");
    await s.click(".composer button[type=submit]");
    await sleep(900);
    const toast = (await visibleTexts(s, ".global-alert-card"))[0] ?? null;
    log("J_countMismatch", { screenSaid: promised, toast, toastTone: await s.evalJs(`document.querySelector('.global-alert-card')?.className.match(/v-alert--variant-\\w+|text-\\w+/g)?.join(' ')`) });
    await s.shot("count-mismatch");
  } finally {
    await s.close();
  }
}

// ---------- G: Enter u polju Naslov šalje poruku svima ----------
{
  const s = await session("n1g", { world: { n: 28 } });
  try {
    await s.load("/dispatcher/notifications", { wait: ".composer", timeout: 240000 });
    await waitCouriers(s);
    await s.idle(500);
    await tagFields(s);
    await openRecipients(s);
    await s.click(".v-overlay--active .v-list-item", { nth: 0, wait: 150 });
    await s.key("Escape");
    await sleep(200);
    await s.clearField("[data-t=title]");
    await s.typeText("Test A");
    await s.focusSel("[data-t=body]");
    await s.typeText("Tekst poruke");
    await s.clearLog();
    // dispečer ispravlja naslov i pritisne Enter
    await s.focusSel("[data-t=title]");
    await s.key("Enter");
    await sleep(900);
    log("G_enterSends", { broadcastPosts: s.logOf(/POST .*broadcast/).length, allCouriers: s.logOf(/POST .*broadcast/)[0]?.body?.all_couriers ?? null });

    // dvostruki klik na Pošalji
    await s.clearField("[data-t=title]");
    await s.typeText("Test B");
    await openRecipients(s);
    await s.click(".v-overlay--active .v-list-item", { nth: 0, wait: 150 });
    await s.key("Escape");
    await s.focusSel("[data-t=body]");
    await s.typeText("Tekst B");
    s.setFlags({ delays: [{ re: /POST .*broadcast/, ms: 700 }] });
    s.clearLog();
    const r = await s.rectOf(".composer button[type=submit]");
    await s.clickAt(r.x + r.w / 2, r.y + r.h / 2, 20);
    await s.clickAt(r.x + r.w / 2, r.y + r.h / 2, 20);
    await sleep(1600);
    log("G_doubleClick", { broadcastPosts: s.logOf(/POST .*broadcast/).length });
  } finally {
    await s.close();
  }
}

// ---------- H: padovi izvora ----------
{
  const s = await session("n1h", { world: { n: 28 } });
  try {
    s.setFlags({ fails: [{ re: /couriers-status/, status: 500, times: 99 }] });
    await s.load("/dispatcher/notifications", { wait: ".composer", timeout: 240000 });
    await sleep(1800);
    const alert = (await visibleTexts(s, ".v-alert"))[0] ?? null;
    const empty = (await visibleTexts(s, ".history-empty"))[0] ?? null;
    const sendDisabled = await s.evalJs(`document.querySelector('.composer button[type=submit]')?.disabled ?? null`);
    const retry = await s.evalJs(`!![...document.querySelectorAll('.global-page button')].find((b) => /pokušaj ponovo|osvježi/i.test(b.textContent))`);
    log("H_statusFails", { alert, empty, sendDisabled, hasRetryButton: retry });
    await s.shot("status-fails");
  } finally {
    await s.close();
  }
}
{
  const s = await session("n1i", { world: { n: 28 } });
  try {
    s.setFlags({ fails: [{ re: /inbox-summary/, status: 500, times: 99 }] });
    await s.load("/dispatcher/notifications", { wait: ".composer", timeout: 240000 });
    await waitCouriers(s);
    await s.idle(800);
    const rows = await s.count(".history-courier-row");
    const previews = await s.count(".history-courier-preview");
    const chips = await s.count(".history-courier-unread");
    const explains = await s.evalJs(`/preview|sažet|pregled nije|ne mogu/i.test(document.querySelector('.global-page').innerText)`);
    log("I_summaryFails", { rows, previews, chips, anyExplanation: explains });
    await s.shot("summary-fails");
  } finally {
    await s.close();
  }
}

saveJson("before-n1.json", OUT);
console.log("GOTOVO n1");
