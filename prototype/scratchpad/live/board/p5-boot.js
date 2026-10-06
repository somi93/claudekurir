/* Pokretanje: svaki element [data-fx] na tabli dobija svoju instancu prototipa; stanje se bira atributima
   (data-sel, data-ord, data-tab, data-filter, data-q, data-layers, data-snap, data-fail, data-empty, data-sheet, data-script...). */
(function () {
  "use strict";
  const SCRIPTS = {
    // osvježavanje padne poslije uspješnog učitavanja: stari podaci ostaju uz upozorenje
    stale: (app, done) => {
      app.failNext(/GET .*courier-locations/, 999);
      app.failNext(/GET .*orders\//, 999);
      app.load("locs").then(() => app.load("orders")).then(() => setTimeout(done, 120));
    },
    // prvi izabrani kurir bez signala: pošalji "Gdje si?"
    where: (app, done) => {
      const lost = app.ctx.V.cs.find((c) => c.ghost && c.live === "delivering");
      if (lost) { app.ctx.selectCourier(lost.id); setTimeout(() => { app.ctx.acts.msg("where"); done(); }, 600); } else done();
    },
  };
  const waitReady = (app, cb) => {
    const t = () => { if (app.ctx.ready) cb(); else setTimeout(t, 40); };
    setTimeout(t, 60);
  };
  window.LVBoot = function () {
    const out = [];
    document.querySelectorAll("[data-fx]").forEach((root) => {
      if (root.__fx) return;
      const num = (n) => (root.hasAttribute(n) ? Number(root.getAttribute(n)) : undefined);
      const o = {
        wide: root.getAttribute("data-fx") !== "phone",
        tab: root.getAttribute("data-tab") || "k",
        sel: root.getAttribute("data-sel") || undefined,
        ord: root.getAttribute("data-ord") || undefined,
        ogroup: root.getAttribute("data-ogroup") || undefined,
        filter: root.getAttribute("data-filter") || undefined,
        q: root.getAttribute("data-q") || undefined,
        layers: root.getAttribute("data-layers") || undefined,
        snap: root.getAttribute("data-snap") || undefined,
        fail: root.getAttribute("data-fail") || undefined,
        empty: root.getAttribute("data-empty") || undefined,
        n: num("data-n"), lazy: root.hasAttribute("data-lazy"), pollMs: num("data-poll"), ordersMs: num("data-orders"), slowMs: num("data-slow"), delay: num("data-delay"),
      };
      const app = window.LVApp.create(root, o);
      root.__fx = app;
      const sheet = root.getAttribute("data-sheet");
      const script = root.getAttribute("data-script");
      if (sheet || script) {
        waitReady(app, () => {
          if (sheet === "msg" && app.st.selId != null) app.ctx.acts.msg("");
          if (script && SCRIPTS[script]) SCRIPTS[script](app, () => {});
        });
      }
      out.push(app);
    });
    return out;
  };
})();
