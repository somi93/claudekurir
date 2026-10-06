/* Pokretanje: svaki element [data-fx] na tabli dobija svoju instancu prototipa; stanje se bira atributima
   (data-tab, data-sel, data-sheet, data-type, data-fail, data-filter, data-script...). */
(function () {
  "use strict";
  const FAILS = {
    pending: "GET .*cash-handovers/pending",
    balances: "GET .*couriers-balance",
    settings: "GET .*finance-settings",
    journal: "GET .*(cash-handovers|payouts)\\?",
  };
  const waitReady = (app, cb) => {
    const c = app.ctx;
    const t = () => { if (c.D && ["balances", "pending", "status", "settings"].every((k) => c.D[k].state === "ok")) cb(); else setTimeout(t, 40); };
    setTimeout(t, 60);
  };
  const SCRIPTS = {
    // isplata svima: jedan kurir pada, ostali prošli
    "batch-partial": (app, done) => {
      const c = app.ctx;
      c.acts.batch();
      const items = c.st.sheet.items;
      app.failNext(new RegExp(`POST /dispatcher/couriers/${items[2].id}/payout`), 1, "Kurir je suspendovan.", 422);
      c.sheets.batch.submit(c.st.sheet);
      const t = () => { if (c.st.sheet && c.st.sheet.phase === "done") done(); else setTimeout(t, 60); };
      setTimeout(t, 200);
    },
    // osvježavanje palo, a podaci postoje
    stale: (app, done) => {
      app.failNext(new RegExp(FAILS.balances), 999);
      app.failNext(new RegExp(FAILS.pending), 999);
      app.ctx.parts.stanje.load("balances").then(() => app.ctx.parts.stanje.load("pending")).then(() => setTimeout(done, 100));
    },
    // isplata bankovnim transferom (prikaže račun)
    bank: (app, done) => {
      const c = app.ctx;
      c.acts.payout();
      setTimeout(() => { c.acts["entry-method"]("bankovni transfer"); done(); }, 80);
    },
    // detalj stavke prometa: stvarni slučaj 97.79 -> 92.79
    jentry: (app, done) => {
      const c = app.ctx;
      c.parts.promet.reload().then(() => { c.acts.jopen("h699"); done(); });
    },
    // uplata iznad duga
    over: (app, done) => {
      const c = app.ctx;
      c.acts.receipt();
      setTimeout(() => { const i = app.el.querySelector("#fc-amt"); if (i) { i.value = "20"; i.dispatchEvent(new Event("input", { bubbles: true })); } done(); }, 80);
    },
  };
  window.FCBoot = function () {
    const out = [];
    document.querySelectorAll("[data-fx]").forEach((root) => {
      if (root.__fx) return;
      const o = {
        wide: root.getAttribute("data-fx") !== "phone",
        tab: root.getAttribute("data-tab") || "stanje",
        filter: root.getAttribute("data-filter") || undefined,
        sort: root.getAttribute("data-sort") || undefined,
        pollMs: Number(root.getAttribute("data-poll")) || undefined,
        slowMs: Number(root.getAttribute("data-slow")) || undefined,
        delay: root.hasAttribute("data-delay") ? Number(root.getAttribute("data-delay")) : undefined,
      };
      const app = window.FCApp.create(root, o);
      root.__fx = app;
      const fail = root.getAttribute("data-fail");
      if (fail) fail.split(",").forEach((k) => app.failNext(new RegExp(FAILS[k] || k), 999));
      // prazan svijet: nijedna predaja ne čeka (pošto je server lažan, dovoljno je isprazniti ga prije prvog odgovora)
      if (root.getAttribute("data-empty") === "pending") { const F = app.world.F; F.pendingRows.length = 0; F.history = F.history.filter((h) => h.status !== "pending"); }
      const sel = root.getAttribute("data-sel");
      const sheet = root.getAttribute("data-sheet");
      const script = root.getAttribute("data-script");
      const typed = root.getAttribute("data-type");
      if (!sel && !sheet && !script) { out.push(app); return; }
      const run = () => {
        const ctx = app.ctx;
        if (sel) ctx.acts.open(sel);
        const finish = () => {
          if (typed && app.st.sheet) { const i = root.querySelector("#fc-amt"); if (i) { i.value = typed; i.dispatchEvent(new Event("input", { bubbles: true })); } }
        };
        if (sheet) {
          const [kind, arg] = sheet.split(":");
          if (kind === "confirm") ctx.acts.confirm(arg || (ctx.D.pending.v[ctx.D.pending.v.length - 1] || {}).id);
          else if (kind === "receipt") ctx.acts.receipt();
          else if (kind === "payout") ctx.acts.payout();
          else if (kind === "batch") ctx.acts.batch();
          else if (kind === "jentry") ctx.acts.jopen(arg);
        }
        if (script && SCRIPTS[script]) SCRIPTS[script](app, finish);
        else setTimeout(finish, 120);
      };
      if (fail && /pending|balances/.test(fail)) setTimeout(run, 700);
      else waitReady(app, run);
      out.push(app);
    });
    return out;
  };
})();
