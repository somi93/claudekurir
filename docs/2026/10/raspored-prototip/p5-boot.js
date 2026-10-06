/* Pokretanje: dijelovi se registruju redom, a svaki element [data-sx] na tabli dobija svoju instancu prototipa. */
(function () {
  "use strict";
  window.SCBoot = function () {
    const out = [];
    document.querySelectorAll("[data-sx]").forEach((root) => {
      if (root.__sx) return;
      const o = {
        wide: root.getAttribute("data-sx") !== "phone",
        tab: root.getAttribute("data-tab") || "schedule",
        load: {},
        noCity: root.hasAttribute("data-nocity"),
        farCity: root.hasAttribute("data-farcity"),
        nowInterval: Number(root.getAttribute("data-now-interval")) || undefined,
      };
      ["schedule", "now", "zones", "rules"].forEach((k) => { const v = root.getAttribute("data-load-" + k); if (v) o.load[k] = v; });
      const app = window.SCApp.create(root, o);
      root.__sx = app;
      const sheet = root.getAttribute("data-sheet");
      if (sheet) {
        const sep = sheet.indexOf(":");
        const kind = sep < 0 ? sheet : sheet.slice(0, sep), arg = sep < 0 ? "" : sheet.slice(sep + 1);
        const ctx = app.ctx;
        if (kind === "shift") ctx.sheetOpenShift(Number(arg) || findShift(app, arg));
        else if (kind === "create") ctx.sheetOpenCreate({});
        else if (kind === "copy") ctx.sheetOpenCopy({ mode: arg || "week" });
        else if (kind === "enforce") { ctx.openSheet({ type: "enforce" }, null); }
        else if (kind === "city") ctx.acts["city-open"]();
      }
      out.push(app);
    });
    return out;
  };
  const findShift = (app, key) => {
    const [zone, date, start] = String(key).split("|");
    const s = app.world.shifts.find((x) => String(x.zoneId) === zone && x.date === date && x.start === start);
    return s ? s.id : null;
  };
  window.SCFind = findShift;
})();
