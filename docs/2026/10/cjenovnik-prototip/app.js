/* Prototip stranice Cjenovnik (/dispatcher/pricing). Nije Vue kod: ponašanje, tekstovi i izgled služe kao izvor za portovanje.
   Tokeni i obrasci (PageHeader, GlobalTabBar kao pilule, SettingRow, ChoiceGroup, AppSheet, TintAlert, AppButton) su iz aplikacije.
   Podaci su izmišljeni (primjer). Obračun i izbor vozila u prototipu su ISTA logika kakvu pretpostavljamo na serveru
   (prvo pravilo koje se poklopi, odozgo prema dolje); to nije potvrđeno backendom (vidi dokument, pitanje B1). Jedna instanca = jedan createApp(). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  var ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>', chev: '<path d="m9 6 6 6-6 6"/>', up: '<path d="m6 14 6-6 6 6"/>', down: '<path d="m6 10 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>', bad: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16v.01"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a3 3 0 0 0-5 1.5c0 3 5 1.5 5 4.5a3 3 0 0 1-5 1.5M12 6.5v2M12 15.5v2"/>',
    cloud: '<path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5a3.5 3.5 0 0 1 .5 6.5"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    snow: '<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/>', moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    traffic: '<rect x="8" y="3" width="8" height="18" rx="2"/><circle cx="12" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="16" r="1"/>',
    city: '<path d="M4 20V9l6-3v14M10 20V4l9 4v12M3 20h18M13 10h3M13 14h3"/>', cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    hill: '<path d="M3 19l6-10 4 6 3-4 5 8z"/>', tune: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 5v4h4M4 13a8 8 0 0 0 14.5 3.5L20 15M20 19v-4h-4"/>',
    car: '<path d="M5 16v-5l1.7-4.5A2 2 0 0 1 8.6 5h6.8a2 2 0 0 1 1.9 1.5L19 11v5M3 16h18v2.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V16H7v2.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M5.5 11h13"/>',
    moto: '<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M6 16l3-6h5l4 6M12 10l-1-3h3"/>', bike: '<circle cx="6" cy="16" r="3.2"/><circle cx="18" cy="16" r="3.2"/><path d="M6 16l4-7h5l3 7M10 9l5 7M13 6h3"/>',
    walk: '<circle cx="13" cy="5" r="1.6"/><path d="M11 21l2-6-2-2 1-5 3 2 2 1M9 12l2-3M13 15l3 3"/>',
    pin: '<path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>',
    ruler: '<path d="M4 15 15 4l5 5L9 20z"/><path d="M8 11l2 2M11 8l2 2M6 13l1 1"/>', inf: '<path d="M8 9a3 3 0 1 0 0 6c4 0 4-6 8-6a3 3 0 1 1 0 6c-4 0-4-6-8-6z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6.5 6.5 0 0 0-3-5.5"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.5-4.5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    store: '<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 12v8h14v-8"/>', bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h1M12 12h1M16 12h0M8 16h1M12 16h4"/>'
  };
  var ic = function (n, s) { s = s || 20; return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || "") + "</svg>"; };

  var VEH = {
    car: { n: "Automobil", i: "car", t: "#eef4ff", k: "#2459c7" },
    motorbike: { n: "Motor", i: "moto", t: "#fff2df", k: "#9a4a07" },
    bicycle: { n: "Bicikl", i: "bike", t: "#e3f8ef", k: "#00734f" },
    walk: { n: "Pješice", i: "walk", t: "#f1f3f6", k: "#46505f" }
  };
  var CUR = "KM";
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var fm = function (n) { return r2(n).toFixed(2).replace(".", ","); };
  var fk = function (n) { return (Math.round(n * 10) / 10).toFixed(1).replace(".", ","); };
  var money = function (n) { return fm(n) + " " + CUR; };
  var pn = function (s) { var t = String(s == null ? "" : s).trim().replace(",", "."); if (t === "") return null; var n = Number(t); return isFinite(n) ? n : NaN; };
  var dur = function (m) { return m < 60 ? m + " min" : m < 1440 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : Math.floor(m / 1440) + " d"; };

  var CATALOG = [
    { key: "rain", name: "Kiša", tag: "cloud", type: "km", val: 0.3, desc: "Dodatak po kilometru dok pada kiša." },
    { key: "snow", name: "Snijeg", tag: "snow", type: "km", val: 0.4, desc: "Dodatak po kilometru po snijegu." },
    { key: "traffic", name: "Gužva", tag: "traffic", type: "fix", val: 1, desc: "Fiksna doplata u vrijeme saobraćajne gužve." },
    { key: "night", name: "Noćna dostava", tag: "moon", type: "fix", val: 1.5, auto: true, from: "22:00", to: "06:00", desc: "Fiksna doplata za dostave između 22:00 i 06:00." },
    { key: "city", name: "Centar grada", tag: "city", type: "note", val: 0, desc: "Poseban obračun, prednost biciklistima zbog gužve i parkinga." },
    { key: "hill", name: "Brdovit teren", tag: "hill", type: "note", val: 0, desc: "Faktor visinske razlike, motor i automobil imaju prednost nad biciklom." }
  ];
  var ZONES = [{ id: 11, n: "Centar", t: 1.0 }, { id: 12, n: "Starčevica", t: 1.4 }, { id: 13, n: "Lauš", t: 1.1 }, { id: 14, n: "Obilićevo", t: 1.0 }];
  var seed = function () {
    return {
      P: { base: 2.5, km: 0.8 },
      SUR: [
        { id: 501, name: "Kiša", desc: "Dodatak po kilometru dok pada kiša.", type: "km", val: 0.3, on: true, since: 72, auto: false, tag: "cloud" },
        { id: 502, name: "Noćna dostava", desc: "Fiksna doplata za dostave između 22:00 i 06:00.", type: "fix", val: 1.5, on: false, auto: true, from: "22:00", to: "06:00", tag: "moon" },
        { id: 503, name: "Gužva", desc: "Fiksna doplata u vrijeme saobraćajne gužve.", type: "fix", val: 1, on: false, tag: "traffic" },
        { id: 504, name: "Centar grada", desc: "Poseban obračun, prednost biciklistima zbog gužve i parkinga.", type: "note", val: 0, on: true, since: 2600, tag: "city" },
        { id: 505, name: "Praznik", desc: "Državni praznici.", type: "fix", val: 2, on: false, tag: "cal" }
      ],
      LIST: [
        { id: 701, type: "sur", sur: 501, veh: ["car", "motorbike"], note: "Kiša: biciklisti ne voze." },
        { id: 702, type: "zone", zone: 12, maxT: 1.6, veh: ["motorbike", "car"], note: "Brdovit teren." },
        { id: 703, type: "zone", zone: 11, veh: ["bicycle", "walk", "motorbike"], note: "" },
        { id: 704, type: "dist", min: 4, max: null, veh: ["car", "motorbike"], note: "" }
      ],
      DEF: { id: 705, type: "default", veh: ["motorbike", "bicycle", "car"], note: "Zadano pravilo." }
    };
  };

  var createApp = function (root, opts) {
    opts = opts || {};
    var D = seed(), P = D.P, SUR = D.SUR, R = { list: D.LIST, def: D.DEF }, nextId = 900;
    if (opts.mode === "empty") { SUR.length = 0; R.list = []; R.def = null; }
    var st = {
      tab: opts.tab || "price", wide: false, mode: opts.mode === "empty" ? "ok" : (opts.mode || "ok"),
      draft: { base: fm(P.base), km: fm(P.km) }, saving: false, flash: null, ask: null,
      sim: { dist: opts.dist || 4.5, zone: null, over: {} }, es: null, er: null, del: null, simSheet: false
    };
    if (opts.draft) { st.draft.base = opts.draft.base || st.draft.base; st.draft.km = opts.draft.km || st.draft.km; }
    if (opts.simOver) st.sim.over = opts.simOver;
    if (opts.simZone) st.sim.zone = opts.simZone;
    var mount = document.createElement("div"); mount.className = "ap-mount";
    var toastEl = document.createElement("div"); toastEl.className = "ap-toast"; toastEl.setAttribute("role", "status"); toastEl.hidden = true;
    root.innerHTML = ""; root.appendChild(mount); root.appendChild(toastEl);
    var toastT, undoFn = null;
    var toast = function (m, undo) {
      undoFn = undo || null;
      toastEl.innerHTML = esc(m) + (undo ? ' <button type="button" data-undo="1">Poništi</button>' : ""); toastEl.hidden = false;
      clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; undoFn = null; }, undo ? 6000 : 2800);
    };
    toastEl.addEventListener("click", function (ev) { if (ev.target.getAttribute("data-undo") && undoFn) { var f = undoFn; undoFn = null; toastEl.hidden = true; f(); } });

    /* ---------- obračun i izbor vozila ---------- */
    var liveAct = function () { var o = {}; SUR.forEach(function (s) { o[s.id] = s.on; }); return o; };
    var simAct = function () { var o = {}; SUR.forEach(function (s) { o[s.id] = st.sim.over.hasOwnProperty(s.id) ? st.sim.over[s.id] : s.on; }); return o; };
    var hasOver = function () { return Object.keys(st.sim.over).length > 0; };
    var vPrice = function () {
      var e = {}, b = pn(st.draft.base), k = pn(st.draft.km);
      if (b === null) e.base = "Unesi iznos, npr. 2,50."; else if (isNaN(b)) e.base = "Unesi broj, npr. 2,50."; else if (b < 0) e.base = "Iznos ne može biti manji od 0.";
      if (k === null) e.km = "Unesi iznos, npr. 0,80."; else if (isNaN(k)) e.km = "Unesi broj, npr. 0,80."; else if (k < 0) e.km = "Iznos ne može biti manji od 0.";
      return e;
    };
    var nums = function () { var e = vPrice(); return { base: e.base ? P.base : pn(st.draft.base), km: e.km ? P.km : pn(st.draft.km) }; };
    var priceDirty = function () { return st.draft.base !== fm(P.base) || st.draft.km !== fm(P.km); };
    var calc = function (dist, cfg, act) {
      var per = r2(cfg.km * dist), lines = [];
      SUR.forEach(function (s) { if (s.type === "note" || !act[s.id]) return; lines.push({ n: s.name, a: r2(s.type === "km" ? s.val * dist : s.val) }); });
      var sx = r2(lines.reduce(function (a, l) { return a + l.a; }, 0));
      return { base: cfg.base, per: per, lines: lines, sur: sx, total: r2(cfg.base + per + sx) };
    };
    var matchRule = function (r, zoneId, dist, act) {
      var z = ZONES.filter(function (x) { return x.id === zoneId; })[0];
      if (r.maxT != null && z && z.t > r.maxT) return false;
      if (r.type === "default") return true;
      if (r.type === "zone") return r.zone === zoneId;
      if (r.type === "sur") return !!act[r.sur];
      if (r.type === "dist") return (r.min == null || dist >= r.min) && (r.max == null || dist <= r.max);
      return false;
    };
    var recommend = function (zoneId, dist, act) {
      for (var i = 0; i < R.list.length; i++) if (matchRule(R.list[i], zoneId, dist, act)) return { rule: R.list[i], idx: i };
      if (R.def) return { rule: R.def, idx: -1 };
      return null;
    };
    var zoneName = function (id) { var z = ZONES.filter(function (x) { return x.id === id; })[0]; return z ? z.n : "?"; };
    var surName = function (id) { var s = SUR.filter(function (x) { return x.id === id; })[0]; return s ? s.name : "(obrisana doplata)"; };
    var ruleTitle = function (r) {
      if (r.type === "zone") return "Zona: " + zoneName(r.zone);
      if (r.type === "sur") return "Doplata: " + surName(r.sur);
      if (r.type === "dist") return r.min != null && r.max != null ? "Udaljenost " + r.min + "–" + r.max + " km" : r.min != null ? "Udaljenost preko " + r.min + " km" : "Udaljenost do " + r.max + " km";
      return "Sve ostalo";
    };
    var sumS = function (s) { return s.type === "km" ? "+" + fm(s.val) + " " + CUR + "/km" : s.type === "fix" ? "+" + fm(s.val) + " " + CUR : "Samo napomena"; };

    /* ---------- gradivni dijelovi ---------- */
    var tint = function (tone, icon, title, body, action) {
      return '<div class="ap-tint ap-tint--' + tone + '" role="' + (tone === "bad" ? "alert" : "status") + '">' + ic(icon, 22) + '<div class="ap-tint-b">' + (title ? '<b class="tt">' + title + "</b>" : "") + body + (action || "") + "</div></div>";
    };
    var field = function (o) {
      var err = o.err;
      return '<div class="ap-sf"><label class="ap-sf-l" for="' + o.id + '">' + o.label + (o.opt ? "<i> opciono</i>" : "") + '</label><div class="ap-sf-in' + (err ? " is-bad" : "") + '"><input id="' + o.id + '" data-ed="' + o.ed + '" data-k="' + o.k + '" type="' + (o.type || "text") + '" inputmode="' + (o.mode || "text") + '" value="' + esc(o.v) + '" aria-invalid="' + (err ? "true" : "false") + '" aria-describedby="' + o.id + '-m" autocomplete="off"></div><div class="ap-sf-m' + (err ? " is-bad" : "") + '" id="' + o.id + '-m" aria-live="polite">' + (err ? ic("bad", 16) + "<span>" + esc(err) + "</span>" : (o.hint ? "<span>" + o.hint + "</span>" : "")) + "</div></div>";
    };
    var choice = function (ed, k, value, options, o) {
      o = o || {};
      return '<div class="ap-cg ap-cg--' + (o.variant || "cards") + ' c' + (o.cols || 2) + '" role="radiogroup" aria-label="' + esc(o.label || "") + '">' + options.map(function (op) {
        var on = String(value) === String(op.v);
        return '<button type="button" role="radio" class="ap-cg-o" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-act="choice" data-ed="' + ed + '" data-k="' + k + '" data-v="' + esc(op.v) + '">' +
          (o.variant === "pills" ? "<span>" + op.t + "</span>" : '<span class="ap-cg-t"><b>' + op.t + "</b>" + (op.h ? "<small>" + op.h + "</small>" : "") + '</span><span class="ap-cg-ck">' + ic("check", 15) + "</span>") + "</button>";
      }).join("") + "</div>";
    };
    var swRow = function (id, ed, k, on, title, hint) {
      return '<div class="ap-sw"><div class="ap-sw-t"><label for="' + id + '"><b>' + title + "</b></label>" + (hint ? "<small>" + hint + "</small>" : "") + '</div><label class="ap-switch"><input id="' + id + '" type="checkbox" role="switch" data-act="etoggle" data-ed="' + ed + '" data-k="' + k + '"' + (on ? " checked" : "") + '><i></i></label></div>';
    };
    var rankHTML = function (veh) {
      return '<span class="rank">' + veh.map(function (v, i) { var m = VEH[v]; return "<span>" + (i ? "<em>›</em>" : "") + ic(m.i, 15) + (i + 1) + ". " + m.n + "</span>"; }).join("") + "</span>";
    };
    var mf = function (k, label, unit, v, err, hint, id) {
      return '<div class="mf"><label class="mf-l" for="' + id + '">' + label + '</label><div class="mf-in' + (err ? " is-bad" : "") + '"><input id="' + id + '" data-k="' + k + '" inputmode="decimal" autocomplete="off" value="' + esc(v) + '" aria-invalid="' + (err ? "true" : "false") + '" aria-describedby="' + id + '-m"><span class="mf-u">' + unit + '</span>' +
        '<button type="button" class="mf-b" data-act="step" data-k="' + k + '" data-d="-1" aria-label="Smanji: ' + label + '">' + ic("minus", 18) + '</button><button type="button" class="mf-b" data-act="step" data-k="' + k + '" data-d="1" aria-label="Povećaj: ' + label + '">' + ic("plus", 18) + "</button></div>" +
        '<div class="mf-m' + (err ? " is-bad" : "") + '" id="' + id + '-m" aria-live="polite">' + (err ? ic("bad", 16) + "<span>" + esc(err) + "</span>" : "<span>" + hint + "</span>") + "</div></div>";
    };

    /* ---------- tab: cijena ---------- */
    var sanity = function () {
      var e = vPrice(); if (e.base || e.km) return "";
      var b = pn(st.draft.base), k = pn(st.draft.km), m = [];
      var rel = function (a, o, what) { if (o > 0 && a !== o && Math.abs(a - o) / o >= 0.5) m.push(what + (a > o ? " raste" : " pada") + " za " + Math.round(Math.abs(a - o) / o * 100) + " %."); };
      rel(k, P.km, "Cijena po kilometru"); rel(b, P.base, "Startna cijena");
      if (k >= 3) m.push("Za 10 km to je " + money(b + k * 10) + ".");
      return m.length ? tint("warn", "alert", "Provjeri iznos", m.join(" ") + " Ako si mislio na manji iznos, provjeri zarez.") : "";
    };
    var dirtyBar = function () {
      var e = vPrice(), bad = e.base || e.km, d = [], n = nums(), dist = st.sim.dist;
      if (st.draft.base !== fm(P.base)) d.push("<span>Startna cijena <s>" + fm(P.base) + "</s> <strong>" + (e.base ? "?" : fm(n.base) + " " + CUR) + "</strong></span>");
      if (st.draft.km !== fm(P.km)) d.push("<span>Po kilometru <s>" + fm(P.km) + "</s> <strong>" + (e.km ? "?" : fm(n.km) + " " + CUR + "/km") + "</strong></span>");
      if (!bad) d.push("<span>Za " + fk(dist) + " km: <s>" + fm(calc(dist, P, liveAct()).total) + "</s> <strong>" + money(calc(dist, n, liveAct()).total) + "</strong></span>");
      return '<div class="dirty" role="group" aria-label="Nesačuvane izmjene cijene"><div class="dirty-t"><b>Nesačuvane izmjene</b><div class="d">' + d.join("") + '</div><span class="ap-note">Čim sačuvaš, važi za nove narudžbe.</span></div><div class="dirty-r"><button type="button" class="ap-btn ghost" data-act="reset">Poništi</button><button type="button" class="ap-btn" data-act="saveprice"' + (bad || st.saving ? " disabled" : "") + (st.saving ? ' aria-busy="true"' : "") + ">" + (st.saving ? "Čuvam…" : "Sačuvaj cijenu") + "</button></div></div>";
    };
    var ladder = function () {
      var cfg = nums(), act = liveAct();
      var rows = [1, 2, 3, 5, 8, 12].map(function (d) {
        var a = calc(d, P, act).total, b = calc(d, cfg, act).total, ch = r2(a) !== r2(b), up = b > a;
        return "<tr" + (Math.abs(d - st.sim.dist) < 0.5 ? ' class="cur"' : "") + "><td>" + d + " km</td><td>" + fm(cfg.base + cfg.km * d) + '</td><td class="t' + (ch ? (up ? " up" : " dn") : "") + '">' + (ch ? "<s>" + fm(a) + "</s>" : "") + fm(b) + " " + CUR + "</td></tr>";
      }).join("");
      return '<section class="ap-card pc" aria-labelledby="lt"><div class="pc-h"><div><h2 id="lt">Šta kupac plaća po udaljenosti</h2><p>Sa doplatama koje su sada na snazi' + (priceDirty() ? ", po nesačuvanim iznosima" : "") + ".</p></div></div>" +
        '<div class="lad-w" style="margin-top:10px"><table class="lad"><thead><tr><th scope="col">Udaljenost</th><th scope="col">Startna + km</th><th scope="col">Sa doplatama</th></tr></thead><tbody>' + rows + "</tbody></table></div></section>";
    };
    var priceTab = function () {
      var e = vPrice();
      return '<section class="ap-card pc" aria-labelledby="pt"><div class="pc-h"><div><h2 id="pt">Cijena dostave</h2><p>Šta kupac plaća prije doplata. Važi za nove narudžbe čim sačuvaš.</p></div></div><div class="pc-body"><div class="pc-two">' +
        mf("base", "Startna cijena", CUR, st.draft.base, e.base, "Plaća se uvijek.", "pf-base") + mf("km", "Cijena po kilometru", CUR + "/km", st.draft.km, e.km, "Množi se pređenim kilometrima.", "pf-km") + "</div>" + sanity() +
        '<div class="cur-row"><span class="ap-ric">' + ic("coin", 20) + '</span><span><small>Valuta firme</small><b>' + CUR + '</b></span><a href="#" data-act="tofirma">Mijenja se u Firmi</a></div></div></section>' + ladder() + (priceDirty() ? '<div data-live="dirty">' + dirtyBar() + "</div>" : "");
    };

    /* ---------- tab: doplate ---------- */
    var sDraftOf = function (s) { return { name: s.name, desc: s.desc || "", type: s.type, val: s.type === "note" ? "" : fm(s.val), sched: s.auto ? "auto" : "manual", from: s.from || "22:00", to: s.to || "06:00", on: s.on, tag: s.tag || "tune" }; };
    var sNew = function (cat) {
      var d = { name: "", desc: "", type: "km", val: "", sched: "manual", from: "22:00", to: "06:00", on: false, tag: "tune" };
      if (cat) d = { name: cat.name, desc: cat.desc, type: cat.type, val: cat.type === "note" ? "" : fm(cat.val), sched: cat.auto ? "auto" : "manual", from: cat.from || "22:00", to: cat.to || "06:00", on: false, tag: cat.tag };
      return d;
    };
    var sValid = function (d, id) {
      var e = {};
      if (!d.name.trim()) e.name = "Upiši naziv, npr. Kiša.";
      else if (SUR.some(function (s) { return s.id !== id && s.name.toLowerCase() === d.name.trim().toLowerCase(); })) e.name = "Doplata sa tim nazivom već postoji.";
      if (d.type !== "note") { var v = pn(d.val); if (v === null) e.val = "Unesi iznos, npr. 0,30."; else if (isNaN(v)) e.val = "Unesi broj, npr. 0,30."; else if (v < 0) e.val = "Iznos ne može biti manji od 0."; }
      if (d.sched === "auto") { if (!d.from || !d.to) e.time = "Izaberi vrijeme od i do."; else if (d.from === d.to) e.time = "Početak i kraj ne mogu biti isti."; }
      return e;
    };
    var vis = function (e, er) { var o = {}; Object.keys(er).forEach(function (k) { if (e.touch && e.touch[k]) o[k] = er[k]; }); return o; };
    var sImpact = function (d) {
      if (d.type === "note") return tint("info", "info", "", "Napomena ne mijenja iznos. Služi pravilima za vozila i dispečeru.");
      var v = pn(d.val); if (v === null || isNaN(v) || v < 0) return "";
      var dist = st.sim.dist, amt = r2(d.type === "km" ? v * dist : v);
      return '<div class="imp">' + ic("info", 18) + "<span>Za <b>" + fk(dist) + " km</b>: <b>+" + fm(amt) + " " + CUR + "</b> na cijenu dostave. " + (d.on ? "Uključena je odmah." : "Ulazi u cijenu tek kad je uključiš.") + "</span></div>";
    };
    var sFields = function (e) {
      var d = e.d, er = vis(e, sValid(d, e.id)), isNew = e.id == null;
      var unit = d.type === "km" ? CUR + "/km" : CUR;
      return field({ ed: "s", id: "se-name", k: "name", label: "Naziv", v: d.name, err: er.name }) +
        '<div class="ap-f"><span class="ap-fl">Kako se obračunava</span>' + choice("s", "type", d.type, [{ v: "km", t: "Po kilometru" }, { v: "fix", t: "Fiksno" }, { v: "note", t: "Napomena" }], { variant: "pills", label: "Tip doplate" }) + "</div>" +
        (d.type !== "note" ? '<div class="mf"><label class="mf-l" for="se-val">Iznos</label><div class="mf-in' + (er.val ? " is-bad" : "") + '"><input id="se-val" data-ed="s" data-k="val" inputmode="decimal" autocomplete="off" value="' + esc(d.val) + '" aria-invalid="' + (er.val ? "true" : "false") + '" aria-describedby="se-val-m"><span class="mf-u">' + unit + '</span></div><div class="mf-m' + (er.val ? " is-bad" : "") + '" id="se-val-m" aria-live="polite">' + (er.val ? ic("bad", 16) + "<span>" + esc(er.val) + "</span>" : "<span>Jedinica prati tip i valutu firme.</span>") + "</div></div>" : "") +
        field({ ed: "s", id: "se-desc", k: "desc", label: "Opis", opt: true, v: d.desc, hint: "Vidi ga dispečer, kupac ne." }) +
        '<div class="ap-f"><span class="ap-fl">Kad važi</span>' + choice("s", "sched", d.sched, [{ v: "manual", t: "Ručno" }, { v: "auto", t: "Po vremenu" }], { variant: "pills", label: "Kad važi" }) + "</div>" +
        (d.sched === "auto" ? '<div class="ed-two"><div class="ap-sf"><label class="ap-sf-l" for="se-from">Od</label><div class="ap-sf-in"><input id="se-from" data-ed="s" data-k="from" type="time" value="' + esc(d.from) + '"></div></div><div class="ap-sf"><label class="ap-sf-l" for="se-to">Do</label><div class="ap-sf-in"><input id="se-to" data-ed="s" data-k="to" type="time" value="' + esc(d.to) + '"></div></div></div>' + (er.time ? '<div class="ap-sf-m is-bad">' + ic("bad", 16) + "<span>" + esc(er.time) + "</span></div>" : '<p class="ap-note">Server je uključuje i isključuje u zadanom vremenu.</p>') : "") +
        (isNew ? swRow("se-on", "s", "on", d.on, "Odmah uključi", "Kad je uključena, kupci odmah plaćaju ovu doplatu.") : "") +
        '<div data-live="simp">' + sImpact(d) + "</div>";
    };
    var edFoot = function (kind, e, sheet) {
      var er = kind === "s" ? sValid(e.d, e.id) : rValid(e.d, e.id), ok = !Object.keys(er).length, dirty = JSON.stringify(e.d) !== e.orig || e.id == null;
      var isNew = e.id == null;
      var del = !isNew && !(kind === "r" && e.d.type === "default") ? '<button type="button" class="ap-btn ghost" data-act="' + (kind === "s" ? "sdel" : "rdel") + '">' + ic("trash", 18) + "Obriši</button>" : "";
      var label = kind === "s" ? (isNew ? "Dodaj doplatu" : "Sačuvaj") : (isNew ? "Dodaj pravilo" : "Sačuvaj");
      return '<div class="' + (sheet ? "ap-foot-b" : "ed-r") + '">' + (sheet ? "" : del + '<span class="sp"></span>') + '<button type="button" class="ap-btn ghost" data-act="' + (kind === "s" ? "sclose" : "rclose") + '">Otkaži</button><button type="submit" class="ap-btn" data-act="' + (kind === "s" ? "ssave" : "rsave") + '"' + (ok && dirty ? "" : " disabled") + ">" + label + "</button></div>" + (sheet && del ? '<div class="ap-foot-b" style="padding-top:0;border:0">' + del + "</div>" : "");
    };
    var sEditorInline = function () {
      var e = st.es; if (e.id == null) return '<section class="ap-card ed-new" aria-label="Nova doplata"><h3>Nova doplata</h3><form novalidate data-form="s" class="ap-form" style="display:grid;gap:14px">' + sFields(e) + edFoot("s", e, false) + "</form></section>";
      return '<div class="ed-in"><form novalidate data-form="s" style="display:grid;gap:14px"><h3>Uredi doplatu</h3>' + sFields(e) + edFoot("s", e, false) + "</form></div>";
    };
    var stat = function (s) {
      if (s.on) return '<span class="ap-tag ap-tag--green">Na snazi' + (s.since ? " " + dur(s.since) : "") + "</span>";
      if (s.auto) return '<span class="ap-tag ap-tag--blue">Uključuje se u ' + s.from + "</span>";
      return '<span class="ap-tag ap-tag--grey">Isključena</span>';
    };
    var sRow = function (s) {
      var open = st.es && st.es.id === s.id && st.wide;
      return '<div class="sr' + (s.on ? "" : " off") + (st.flash === "s" + s.id ? " is-flash" : "") + '"><button type="button" class="sr-main" data-act="sedit" data-id="' + s.id + '" aria-expanded="' + !!open + '" aria-label="' + esc("Uredi doplatu " + s.name + ". " + sumS(s) + ". " + (s.on ? "Na snazi" : "Isključena")) + '"><span class="ap-ric">' + ic(s.tag || "tune", 20) + '</span><span class="ap-rt"><b>' + esc(s.name) + "</b><em>" + sumS(s) + " · " + (s.auto ? "Automatski " + s.from + "–" + s.to : "Ručno") + '</em><span class="ap-tags">' + stat(s) + '</span></span><span class="ap-end">' + ic(open ? "up" : "chev", 20) + '</span></button><label class="ap-switch"><input type="checkbox" role="switch" data-act="stoggle" data-id="' + s.id + '" aria-label="' + esc((s.on ? "Isključi" : "Uključi") + " doplatu " + s.name) + '"' + (s.on ? " checked" : "") + "><i></i></label></div>" + (open ? sEditorInline() : "");
    };
    var surTab = function () {
      var n = SUR.filter(function (s) { return s.on; }).length;
      var quick = CATALOG.filter(function (c) { return !SUR.some(function (s) { return s.name === c.name; }); });
      var h = '<div class="sec-h"><div class="l"><h2>Doplate</h2><p>' + (SUR.length ? n + " od " + SUR.length + " je na snazi. Uključena doplata odmah ulazi u cijenu za kupca." : "Dodatak cijeni kad su uslovi teški: kiša, gužva, noć.") + '</p></div><button type="button" class="ap-btn soft" data-act="snew">' + ic("plus", 18) + "Nova doplata</button></div>";
      if (quick.length) h += '<div class="qa" role="group" aria-label="Brzo dodavanje iz kataloga"><span class="lb">Iz kataloga:</span>' + quick.map(function (c) { return '<button type="button" class="ap-chip" data-act="qadd" data-key="' + c.key + '"><i></i>' + c.name + "</button>"; }).join("") + "</div>";
      if (st.es && st.es.id == null && st.wide) h += sEditorInline();
      if (!SUR.length) return h + '<div class="ap-card"><div class="ap-empty"><span class="ap-tile-ic">' + ic("tune", 30) + "</span><h3>Još nema doplata</h3><p>Doplata je dodatak cijeni kad su uslovi teški. Počni od jedne iz kataloga iznad, pa je uključi kad zatreba.</p></div></div>";
      var sorted = SUR.filter(function (s) { return s.on; }).concat(SUR.filter(function (s) { return !s.on; }));
      return h + '<div class="ap-card">' + sorted.map(sRow).join("") + "</div>";
    };

    /* ---------- tab: vozila ---------- */
    var rDraftOf = function (r) { return { type: r.type, zone: r.zone || null, sur: r.sur || null, min: r.min == null ? "" : String(r.min).replace(".", ","), max: r.max == null ? "" : String(r.max).replace(".", ","), veh: r.veh.slice(), maxT: r.maxT == null ? "" : fm(r.maxT).replace(/0$/, ""), note: r.note || "" }; };
    var rNew = function () { return { type: R.def ? "zone" : "default", zone: null, sur: null, min: "", max: "", veh: [], maxT: "", note: "" }; };
    var dupOf = function (d, id) {
      var p = function (s) { var n = pn(s); return n === null || isNaN(n) ? null : n; };
      for (var i = 0; i < R.list.length; i++) {
        var r = R.list[i]; if (r.id === id || r.type !== d.type) continue;
        if (d.type === "zone" && r.zone === d.zone && d.zone) return i + 1;
        if (d.type === "sur" && r.sur === d.sur && d.sur) return i + 1;
        if (d.type === "dist" && (r.min == null ? null : r.min) === p(d.min) && (r.max == null ? null : r.max) === p(d.max)) return i + 1;
      }
      return 0;
    };
    var rValid = function (d, id) {
      var e = {}, p = function (s) { return pn(s); };
      if (!d.veh.length) e.veh = "Izaberi bar jedno vozilo.";
      if (d.type === "zone" && !d.zone) e.zone = "Izaberi zonu.";
      if (d.type === "sur" && !d.sur) e.sur = "Izaberi doplatu.";
      if (d.type === "dist") {
        var a = p(d.min), b = p(d.max);
        if ((a === null && b === null) || isNaN(a) || isNaN(b)) e.dist = "Upiši bar jedno: od ili do (km), npr. 4.";
        else if ((a !== null && a < 0) || (b !== null && b < 0)) e.dist = "Udaljenost ne može biti manja od 0.";
        else if (a !== null && b !== null && a >= b) e.dist = "„Do“ mora biti veće od „od“.";
      }
      if (d.maxT !== "") { var t = p(d.maxT); if (isNaN(t) || t < 1) e.maxT = "Faktor terena je najmanje 1,0."; }
      return e;
    };
    var rFields = function (e) {
      var d = e.d, er = vis(e, rValid(d, e.id)), isDef = d.type === "default", dup = dupOf(d, e.id);
      var conds = [{ v: "zone", t: "Zona", h: "Po dijelu grada." }, { v: "sur", t: "Doplata", h: "Dok je doplata na snazi." }, { v: "dist", t: "Udaljenost", h: "Od ili do kilometara." }];
      if (!R.def) conds.push({ v: "default", t: "Sve ostalo", h: "Kad se ništa ne poklopi." });
      var h = "";
      if (isDef && e.id != null) h += tint("info", "info", "Zadano pravilo", "Važi kad se nijedno pravilo iznad ne poklopi. Uvijek je posljednje i ne briše se.");
      else if (isDef) h += tint("info", "info", "Zadano pravilo", "Važi kad se nijedno drugo ne poklopi. Počni od njega.");
      else h += '<div class="ap-f"><span class="ap-fl">Kad se primjenjuje</span>' + choice("r", "type", d.type, conds, { label: "Uslov pravila", cols: 3 }) + "</div>";
      if (d.type === "zone") h += '<div class="ap-sf"><label class="ap-sf-l" for="re-zone">Zona</label><select id="re-zone" class="ap-sel" data-ed="r" data-k="zone" aria-invalid="' + !!er.zone + '"><option value="">Izaberi zonu</option>' + ZONES.map(function (z) { return '<option value="' + z.id + '"' + (d.zone === z.id ? " selected" : "") + ">" + z.n + " (teren " + fk(z.t) + ")</option>"; }).join("") + "</select></div>";
      if (d.type === "sur") h += '<div class="ap-sf"><label class="ap-sf-l" for="re-sur">Doplata</label><select id="re-sur" class="ap-sel" data-ed="r" data-k="sur" aria-invalid="' + !!er.sur + '"><option value="">Izaberi doplatu</option>' + SUR.map(function (s) { return '<option value="' + s.id + '"' + (d.sur === s.id ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("") + "</select></div>";
      if (d.type === "dist") h += '<div class="ed-two">' + field({ ed: "r", id: "re-min", k: "min", label: "Od (km)", opt: true, v: d.min, mode: "decimal", err: er.dist ? " " : "" }) + field({ ed: "r", id: "re-max", k: "max", label: "Do (km)", opt: true, v: d.max, mode: "decimal", err: er.dist ? " " : "" }) + "</div>" + (er.dist ? '<div class="ap-sf-m is-bad">' + ic("bad", 16) + "<span>" + esc(er.dist) + "</span></div>" : "");
      if (dup) h += tint("warn", "alert", "Ovo pravilo se nikad ne primjenjuje", "Pravilo " + dup + " ima isti uslov i na redu je prije njega.");
      h += '<div class="ap-f"><span class="ap-fl" id="re-vl">Preporučena vozila, redom preferencije</span><div class="vp" role="group" aria-labelledby="re-vl">' + Object.keys(VEH).map(function (v) { var on = d.veh.indexOf(v) > -1; return '<button type="button" class="ap-chip" data-act="vadd" data-v="' + v + '"' + (on ? " disabled" : "") + ">" + ic(VEH[v].i, 18) + VEH[v].n + "</button>"; }).join("") + '</div><div class="vo" aria-live="polite">' + (d.veh.length ? d.veh.map(function (v, i) { return '<span class="ap-tag ap-tag--blue">' + (i + 1) + ". " + VEH[v].n + '<button type="button" data-act="vrem" data-i="' + i + '" aria-label="Ukloni ' + VEH[v].n + '">' + ic("x", 14) + "</button></span>"; }).join("") : '<span class="ph">Dodirni vozila iznad, redom kojim ih želiš.</span>') + "</div>" + (er.veh ? '<div class="ap-sf-m is-bad">' + ic("bad", 16) + "<span>" + esc(er.veh) + "</span></div>" : "") + "</div>";
      h += field({ ed: "r", id: "re-t", k: "maxT", label: "Najveći faktor terena", opt: true, v: d.maxT, mode: "decimal", err: er.maxT, hint: "1,0 je ravnica, veći broj je brdovitije. Prazno znači bez ograničenja." });
      h += field({ ed: "r", id: "re-note", k: "note", label: "Napomena", opt: true, v: d.note, hint: "Vidi je dispečer pri dodjeli." });
      return h;
    };
    var rEditorInline = function () {
      var e = st.er;
      if (e.id == null) return '<section class="ap-card ed-new" aria-label="Novo pravilo"><h3>Novo pravilo</h3><p class="ap-note">Dodaje se iznad „Sve ostalo“.</p><form novalidate data-form="r" style="display:grid;gap:14px">' + rFields(e) + edFoot("r", e, false) + "</form></section>";
      return '<div class="ed-in" style="padding-left:80px"><form novalidate data-form="r" style="display:grid;gap:14px"><h3>Uredi pravilo</h3>' + rFields(e) + edFoot("r", e, false) + "</form></div>";
    };
    var rRow = function (r, i, total, hitRule) {
      var isDef = r.type === "default", v0 = VEH[r.veh[0]], open = st.er && st.er.id === r.id && st.wide, hit = hitRule === r;
      var tag = r.type === "zone" ? '<span class="ap-tag ap-tag--grey">Zona</span>' : r.type === "sur" ? '<span class="ap-tag ap-tag--amber">Doplata</span>' : r.type === "dist" ? '<span class="ap-tag ap-tag--grey">Udaljenost</span>' : "";
      return '<div class="rr2' + (isDef ? " def" : "") + (hit ? " hit" : "") + (st.flash === "r" + r.id ? " is-flash" : "") + '" data-id="' + r.id + '"><span class="rr2-n">' + (isDef ? ic("inf", 15) : i + 1) + '</span><span class="rr2-v" style="--t:' + v0.t + ";--k:" + v0.k + '">' + ic(v0.i, 22) + '</span><button type="button" class="rr2-m" data-act="redit" data-id="' + r.id + '" aria-expanded="' + !!open + '" aria-label="' + esc((isDef ? "Uredi zadano pravilo" : "Uredi pravilo " + (i + 1) + ": " + ruleTitle(r)) + (hit ? ". Poklapa se u primjeru" : "")) + '"><b>' + esc(ruleTitle(r)) + tag + (hit ? '<span class="ap-tag ap-tag--blue">Poklapa se</span>' : "") + "</b>" + (r.note ? '<span class="s">' + esc(r.note) + "</span>" : "") + rankHTML(r.veh) + "</button>" +
        (isDef ? "" : '<button type="button" class="mv" data-act="rmove" data-id="' + r.id + '" data-d="-1" aria-label="Pomjeri pravilo ' + (i + 1) + ' gore"' + (i === 0 ? " disabled" : "") + ">" + ic("up", 20) + '</button><button type="button" class="mv" data-act="rmove" data-id="' + r.id + '" data-d="1" aria-label="Pomjeri pravilo ' + (i + 1) + ' dolje"' + (i === total - 1 ? " disabled" : "") + ">" + ic("down", 20) + "</button>") + "</div>" + (open ? rEditorInline() : "");
    };
    var ruleTab = function () {
      var rec = recommend(st.sim.zone, st.sim.dist, simAct()), hitRule = rec && rec.rule;
      var h = '<div class="sec-h"><div class="l"><h2>Pravila za vozila</h2><p>Odozgo prema dolje: prvo pravilo koje se poklopi bira vozila. „Sve ostalo“ važi kad se nijedno ne poklopi.</p></div><button type="button" class="ap-btn soft" data-act="rnew">' + ic("plus", 18) + (R.def ? "Novo pravilo" : "Dodaj zadano pravilo") + "</button></div>";
      if (st.er && st.er.id == null && st.wide) h += rEditorInline();
      if (!R.list.length && !R.def) return h + '<div class="ap-card"><div class="ap-empty"><span class="ap-tile-ic">' + ic("moto", 30) + "</span><h3>Još nema pravila za vozila</h3><p>Bez pravila dispečer ne dobija predlog vozila za narudžbu. Počni od zadanog pravila, pa dodaj izuzetke po zoni, doplati ili udaljenosti.</p></div></div>";
      if (R.list.length) h += '<div class="ap-card">' + R.list.map(function (r, i) { return rRow(r, i, R.list.length, hitRule); }).join("") + "</div>";
      if (R.def) h += '<div class="def-h">Ako se nijedno ne poklopi</div><div class="ap-card">' + rRow(R.def, -1, 0, hitRule) + "</div>";
      else h += tint("warn", "alert", "Nema zadanog pravila", "Narudžba koju nijedno pravilo ne pokrije ostaje bez predloga vozila.");
      return h;
    };

    /* ---------- primjer narudžbe ---------- */
    var totHTML = function () {
      var n = nums(), act = simAct(), dist = st.sim.dist, c = calc(dist, n, act), sv = calc(dist, P, act), dirty = priceDirty() && r2(c.total) !== r2(sv.total);
      var lines = '<div><dt>Startna cijena</dt><dd>' + fm(c.base) + "</dd></div><div><dt>" + fk(dist) + " km × " + fm(n.km) + "</dt><dd>" + fm(c.per) + "</dd></div>" + c.lines.map(function (l) { return '<div class="sx"><dt>+ ' + esc(l.n) + "</dt><dd>" + fm(l.a) + "</dd></div>"; }).join("");
      return '<div class="tot"><div class="tot-h"><span>Kupac plaća</span><b>' + fm(c.total) + "<small>" + CUR + "</small></b></div><dl>" + lines + "</dl>" + (dirty ? '<div class="dl">' + ic("alert", 16) + "Nacrt: sačuvano je " + money(sv.total) + " (" + (c.total > sv.total ? "+" : "−") + fm(Math.abs(c.total - sv.total)) + ")</div>" : "") + "</div>";
    };
    var vehHTML = function () {
      var rec = recommend(st.sim.zone, st.sim.dist, simAct());
      if (!rec) return '<div class="veh"><span class="sm-eb">Preporučeno vozilo</span>' + tint("warn", "alert", "Nijedno pravilo se ne poklapa", "Dodaj zadano pravilo u tabu Vozila.") + "</div>";
      var r = rec.rule;
      return '<div class="veh"><span class="sm-eb">Preporučeno vozilo</span>' + rankHTML(r.veh) + '<div class="veh-r"><span class="t">' + (rec.idx >= 0 ? "Pravilo " + (rec.idx + 1) + " · " : "") + esc(ruleTitle(r)) + '</span><button type="button" data-act="gorule" data-id="' + r.id + '">Otvori pravilo</button></div></div>';
    };
    var simBody = function () {
      var act = simAct(), toggles = SUR.filter(function (s) { return s.type !== "note"; });
      return '<div class="sm-in"><div class="mf"><div class="sm-dv"><label class="mf-l" for="sm-dist">Udaljenost</label><output for="sm-dist" data-live="dv">' + fk(st.sim.dist) + ' km</output></div><div class="sm-dr"><button type="button" class="mf-b" data-act="dstep" data-d="-1" aria-label="Manje za 0,5 km">' + ic("minus", 18) + '</button><input id="sm-dist" class="rg" type="range" min="0.5" max="15" step="0.5" value="' + st.sim.dist + '" data-k="dist"><button type="button" class="mf-b" data-act="dstep" data-d="1" aria-label="Više za 0,5 km">' + ic("plus", 18) + "</button></div></div>" +
        '<div class="ap-sf"><label class="ap-sf-l" for="sm-zone">Zona</label><select id="sm-zone" class="ap-sel" data-k="zone"><option value="">Svejedno</option>' + ZONES.map(function (z) { return '<option value="' + z.id + '"' + (st.sim.zone === z.id ? " selected" : "") + ">" + z.n + "</option>"; }).join("") + "</select></div>" +
        (toggles.length ? '<fieldset class="chs"><legend>Doplate u primjeru</legend>' + toggles.map(function (s) { var diff = st.sim.over.hasOwnProperty(s.id); return '<button type="button" class="ch' + (diff ? " diff" : "") + '" aria-pressed="' + !!act[s.id] + '" data-act="simsur" data-id="' + s.id + '">' + ic("check", 16).replace('class="ic"', 'class="ic ck"') + esc(s.name) + "</button>"; }).join("") + "</fieldset>" + (hasOver() ? '<p class="sm-f">Primjer se razlikuje od stvarnog stanja. <button type="button" class="sm-reset" data-act="simreset">Vrati na stvarno</button></p>' : '<p class="sm-f">Prikazano je stvarno stanje. Dodirni doplatu da vidiš „šta ako“. Ne mijenja cjenovnik.</p>') : "") + "</div>" +
        '<div data-live="tot">' + totHTML() + '</div><div data-live="veh">' + vehHTML() + '</div><p class="sm-f">Pregled za odabrani primjer. Cijenu za narudžbu računa server.</p>';
    };
    var simCard = function () {
      if (st.mode === "error") return '<section class="ap-card sm"><div class="sm-na">Primjer je dostupan kad se podaci učitaju.</div></section>';
      return '<section class="ap-card sm" aria-labelledby="smt"><div class="sm-h"><h2 id="smt">Primjer narudžbe</h2>' + (priceDirty() ? '<span class="pr-st"><i></i>Nacrt</span>' : "") + "</div>" + simBody() + "</section>";
    };
    var simbar = function () {
      var n = nums(), act = simAct(), c = calc(st.sim.dist, n, act), rec = recommend(st.sim.zone, st.sim.dist, act);
      return '<button type="button" class="simbar" data-act="simopen" aria-haspopup="dialog"><span class="a"><small>Primjer ' + fk(st.sim.dist) + ' km</small><b>' + money(c.total) + (rec ? " · <em>" + VEH[rec.rule.veh[0]].n + "</em>" : "") + '</b></span><span class="go">Otvori' + ic("up", 16) + "</span></button>";
    };

    /* ---------- okvir stranice ---------- */
    var anyDirty = function () { return priceDirty() || (st.es && (JSON.stringify(st.es.d) !== st.es.orig)) || (st.er && (JSON.stringify(st.er.d) !== st.er.orig)); };
    var sideHTML = function () {
      var items = [["pin", "Kuriri uživo", "Pregled i mapa"], ["users", "Kuriri", "Lista kurira firme"], ["search", "Dodjela narudžbi", "Predlog i slanje ponude"], ["receipt", "Finansije", "Kase kurira, balansi"], ["cal", "Raspored i zone", "Zone, smjene i popunjenost"], ["calc", "Cjenovnik", "Cijene, doplate, pravila"], ["store", "Firma", "Finansijske postavke"], ["bell", "Poruke", "Kuriru, grupi ili svima"]];
      return '<aside class="ap-side" aria-label="Glavni meni"><div class="brand"><b>Ordera</b><i>Dispečer</i></div><div class="co"><small>Dostavna firma</small><b>Ordera Dostava Banja Luka</b></div><nav class="ap-nav">' + items.map(function (i) { return '<span class="ap-ni' + (i[1] === "Cjenovnik" ? " on" : "") + '"' + (i[1] === "Cjenovnik" ? ' aria-current="page"' : "") + ">" + ic(i[0], 22) + '<span class="t"><b>' + i[1] + "</b><small>" + i[2] + "</small></span></span>"; }).join("") + '</nav><div class="foot">Test Dispečer</div></aside>';
    };
    var headHTML = function () {
      var chip = st.mode !== "ok" ? "" : (anyDirty() ? '<span class="pr-st"><i></i>Nesačuvano</span>' : '<span class="pr-st ok"><i></i>Sve je sačuvano</span>');
      return '<header class="ap-head"><button type="button" class="ap-ib" data-act="back" aria-label="Nazad na početnu">' + ic("back", 22) + '</button><span class="ap-heading"><span class="ap-title" role="heading" aria-level="1">Cjenovnik</span><span class="ap-subt">Ordera Dostava Banja Luka · valuta ' + CUR + '</span></span><span class="grow"></span>' + chip + "</header>";
    };
    var tabsHTML = function () {
      var on = SUR.filter(function (s) { return s.on; }).length, nr = R.list.length + (R.def ? 1 : 0);
      var o = [["price", "Cijena", priceDirty() ? "dot" : ""], ["sur", "Doplate", on], ["rules", "Vozila", nr]];
      return '<div class="ap-tabs" role="tablist" aria-label="Sekcije cjenovnika">' + o.map(function (t) {
        return '<button type="button" role="tab" class="ap-tab" id="tab-' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '" aria-controls="panel" tabindex="' + (st.tab === t[0] ? 0 : -1) + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + (t[2] === "dot" ? '<span class="n" style="background:#e08a14;min-width:10px;width:10px;height:10px;padding:0" title="Nesačuvano"></span>' : (t[2] !== "" ? '<span class="n">' + t[2] + "</span>" : "")) + "</button>";
      }).join("") + "</div>";
    };
    var guard = function () {
      if (!st.ask) return "";
      return '<div class="ap-guard">' + tint("warn", "alert", "Imaš nesačuvane izmjene", "Ako pređeš na drugi tab, izmjene se gube.") + '<div class="ap-guard-r"><button type="button" class="ap-btn ghost" data-act="keep">Nastavi uređivanje</button><button type="button" class="ap-btn ghost" data-act="drop">Odbaci izmjene</button></div></div>';
    };
    var skelBody = function () {
      var line = function (w, h) { return '<span class="sk" style="width:' + w + ";height:" + h + 'px"></span>'; };
      var left = st.tab === "price" ?
        '<div class="ap-card pc" aria-busy="true" aria-label="Učitavanje"><div class="ap-skl">' + line("40%", 18) + line("62%", 12) + '<div class="pc-two" style="margin-top:8px">' + line("100%", 56) + line("100%", 56) + "</div>" + line("100%", 56) + '</div></div><div class="ap-card pc"><div class="ap-skl">' + line("50%", 18) + line("100%", 14) + line("100%", 14) + line("100%", 14) + line("100%", 14) + "</div></div>" :
        '<div class="ap-card" aria-busy="true" aria-label="Učitavanje">' + [1, 2, 3, 4].map(function () { return '<div class="ap-sk-row"><span class="sk" style="width:44px;height:44px;border-radius:14px"></span><span class="ap-sk-l">' + line("58%", 14) + line("36%", 11) + "</span>" + line("52px", 28) + "</div>"; }).join("") + "</div>";
      var right = '<div class="ap-card sm" aria-busy="true"><div class="ap-skl">' + line("50%", 18) + line("100%", 44) + line("100%", 52) + line("100%", 150) + line("70%", 44) + "</div></div>";
      return st.wide ? '<div class="pr-grid"><div class="pr-l">' + left + '</div><aside class="pr-r">' + right + "</aside></div>" : left;
    };
    var errBody = function () {
      var blk = '<div class="ap-card"><div class="ap-empty"><span class="ap-tile-ic bad">' + ic("bad", 30) + "</span><h3>Ne mogu da učitam cjenovnik</h3><p>Provjeri vezu i pokušaj ponovo. Ništa nije izgubljeno.</p><button type=\"button\" class=\"ap-btn ghost\" data-act=\"retry\">" + ic("refresh", 18) + "Pokušaj ponovo</button></div></div>";
      return st.wide ? '<div class="pr-grid"><div class="pr-l">' + blk + '</div><aside class="pr-r">' + simCard() + "</aside></div>" : blk;
    };
    var bodyHTML = function () {
      if (st.mode === "loading") return skelBody();
      if (st.mode === "error") return errBody();
      var left = st.tab === "price" ? priceTab() : st.tab === "sur" ? surTab() : ruleTab();
      return st.wide ? '<div class="pr-grid"><div class="pr-l">' + guard() + left + '</div><aside class="pr-r" aria-label="Primjer narudžbe">' + simCard() + "</aside></div>" : guard() + left;
    };
    var sheetWrap = function (id, title, sub, body, foot, close) {
      return '<div class="ap-scrim on" data-act="' + close + '"></div><div class="ap-sheet tall on" role="dialog" aria-modal="true" aria-labelledby="' + id + '"><div class="ap-grip"><i></i></div><header class="ap-sh-h"><div class="t"><h2 id="' + id + '">' + title + "</h2>" + (sub ? "<p>" + sub + "</p>" : "") + '</div><button type="button" class="ap-ib" data-act="' + close + '" aria-label="Zatvori">' + ic("x", 20) + '</button></header><div class="ap-sh-body">' + body + "</div>" + (foot || "") + "</div>";
    };
    var overlays = function () {
      var h = "";
      if (st.del) {
        var d = st.del, msg, name;
        if (d.kind === "sur") {
          var s = SUR.filter(function (x) { return x.id === d.id; })[0], deps = R.list.filter(function (r) { return r.type === "sur" && r.sur === d.id; });
          name = s ? s.name : ""; msg = "<p class=\"ap-p\">Obrisati doplatu <b>" + esc(name) + "</b>?" + (s && s.on ? " Trenutno je na snazi, pa kupci odmah prestaju da je plaćaju." : "") + "</p>" + (deps.length ? tint("warn", "alert", "Koristi je " + (deps.length === 1 ? "jedno pravilo za vozila" : deps.length + " pravila za vozila"), deps.map(function (r) { return "„" + esc(ruleTitle(r)) + "“"; }).join(", ") + " se briše zajedno sa doplatom.") : "");
        } else {
          var r2_ = R.list.filter(function (x) { return x.id === d.id; })[0]; name = r2_ ? ruleTitle(r2_) : "";
          msg = "<p class=\"ap-p\">Obrisati pravilo <b>" + esc(name) + "</b>? Narudžbe koje je koristilo padaju na sljedeće pravilo koje se poklopi.</p>";
        }
        var foot = '<button type="button" class="ap-btn ghost" data-act="dlgno">Otkaži</button><button type="button" class="ap-btn danger" data-act="dlgyes">Obriši</button>';
        if (st.wide) h += '<div class="dlg-sc" data-act="dlgno"></div><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dl-t"><h2 id="dl-t">' + (d.kind === "sur" ? "Obriši doplatu" : "Obriši pravilo") + "</h2>" + msg + '<div class="ap-foot-b">' + foot + "</div></div>";
        else h += sheetWrap("dl-t", d.kind === "sur" ? "Obriši doplatu" : "Obriši pravilo", "", msg, '<div class="ap-foot-b">' + foot + "</div>", "dlgno");
      } else if (!st.wide && st.es) {
        h += sheetWrap("se-t", st.es.id == null ? "Nova doplata" : "Uredi doplatu", st.es.id == null ? "" : esc(st.es.d.name), '<form novalidate data-form="s" style="display:grid;gap:14px">' + sFields(st.es) + "</form>", '<form data-form="s">' + edFoot("s", st.es, true) + "</form>", "sclose");
      } else if (!st.wide && st.er) {
        h += sheetWrap("re-t2", st.er.id == null ? "Novo pravilo" : "Uredi pravilo", st.er.id == null ? "Dodaje se iznad „Sve ostalo“" : esc(ruleTitle(R.list.concat(R.def ? [R.def] : []).filter(function (x) { return x.id === st.er.id; })[0] || {})), '<form novalidate data-form="r" style="display:grid;gap:14px">' + rFields(st.er) + "</form>", '<form data-form="r">' + edFoot("r", st.er, true) + "</form>", "rclose");
      } else if (!st.wide && st.simSheet) {
        h += sheetWrap("sm-t", "Primjer narudžbe", priceDirty() ? "Nacrt, nesačuvane izmjene" : "", simBody(), "", "simclose");
      }
      return h;
    };
    var view = function () {
      var h = '<div class="ap' + (st.wide ? " wide shell" : "") + '">';
      if (st.wide) h += sideHTML();
      h += '<div class="ap-main">';
      if (!st.wide) h += '<div class="ap-bar"><span class="m">' + ic("menu", 24) + "</span><b>Ordera</b><i>Dispečer</i></div>";
      h += headHTML() + '<div class="ap-scroll" id="panel" role="tabpanel" aria-labelledby="tab-' + st.tab + '">' + tabsHTML() + '<div class="ap-body">' + bodyHTML() + "</div></div>";
      if (!st.wide && st.mode === "ok") h += simbar();
      h += overlays() + "</div></div>";
      return h;
    };
    var render = function (focus) {
      var sc = $(".ap-scroll", mount), shb = $(".ap-sh-body", mount), sy = sc ? sc.scrollTop : 0, sby = shb ? shb.scrollTop : 0;
      mount.innerHTML = view();
      var sc2 = $(".ap-scroll", mount); if (sc2) sc2.scrollTop = sy;
      var sb2 = $(".ap-sh-body", mount); if (sb2) sb2.scrollTop = sby;
      if (focus) { var f = $(focus, mount); if (f) f.focus({ preventScroll: true }); }
    };
    var renderKeep = function (el) {
      var id = el.id, pos = el.selectionStart; render("#" + id);
      var n = $("#" + id, mount); if (n && pos != null) try { n.setSelectionRange(pos, pos); } catch (e) {}
    };
    var edOf = function (el) { var k = el.getAttribute("data-ed"); return k === "s" ? st.es : k === "r" ? st.er : null; };

    /* ---------- radnje ---------- */
    var goTab = function (t) { st.tab = t; st.es = null; st.er = null; st.ask = null; render(); };
    var openS = function (s, cat) { st.es = { id: s ? s.id : null, d: s ? sDraftOf(s) : sNew(cat), orig: "", touch: {} }; st.es.orig = JSON.stringify(st.es.d); st.er = null; render(s ? null : "#se-name"); };
    var openR = function (r) { st.er = { id: r ? r.id : null, d: r ? rDraftOf(r) : rNew(), orig: "", touch: {} }; st.er.orig = JSON.stringify(st.er.d); st.es = null; render(); };
    var flash = function (k) { st.flash = k; setTimeout(function () { st.flash = null; var f = $(".is-flash", mount); if (f) f.classList.remove("is-flash"); }, 1700); };
    var savePrice = function () {
      if (Object.keys(vPrice()).length) return;
      st.saving = true; render();
      setTimeout(function () {
        var n = nums(); P.base = n.base; P.km = n.km; st.draft = { base: fm(P.base), km: fm(P.km) }; st.saving = false;
        render(); toast("Cijena je sačuvana. Važi za nove narudžbe.");
      }, 450);
    };
    var saveS = function () {
      var e = st.es; if (!e) return; var er = sValid(e.d, e.id); if (Object.keys(er).length) { render(); return; }
      var d = e.d, v = d.type === "note" ? 0 : pn(d.val);
      if (e.id == null) {
        var s = { id: nextId++, name: d.name.trim(), desc: d.desc.trim(), type: d.type, val: v, on: !!d.on, since: d.on ? 0 : undefined, auto: d.sched === "auto", from: d.from, to: d.to, tag: d.tag };
        SUR.push(s); flash("s" + s.id); st.es = null; render();
        toast("Doplata „" + s.name + "“ je dodata" + (s.on ? " i važi odmah." : ". Isključena je dok je ne uključiš."));
      } else {
        var s2 = SUR.filter(function (x) { return x.id === e.id; })[0];
        s2.name = d.name.trim(); s2.desc = d.desc.trim(); s2.type = d.type; s2.val = v; s2.auto = d.sched === "auto"; s2.from = d.from; s2.to = d.to;
        flash("s" + s2.id); st.es = null; render(); toast("Doplata je sačuvana.");
      }
    };
    var saveR = function () {
      var e = st.er; if (!e) return; var er = rValid(e.d, e.id); if (Object.keys(er).length) { render(); return; }
      var d = e.d, num = function (s) { var n = pn(s); return n === null || isNaN(n) ? null : n; };
      var rule = { id: e.id == null ? nextId++ : e.id, type: d.type, veh: d.veh.slice(), note: d.note.trim(), maxT: num(d.maxT) };
      if (d.type === "zone") rule.zone = d.zone; if (d.type === "sur") rule.sur = d.sur; if (d.type === "dist") { rule.min = num(d.min); rule.max = num(d.max); }
      if (e.id == null) { if (d.type === "default") R.def = rule; else R.list.push(rule); toast(d.type === "default" ? "Zadano pravilo je dodato." : "Pravilo je dodato iznad „Sve ostalo“."); }
      else { if (R.def && R.def.id === e.id) R.def = rule; else R.list = R.list.map(function (x) { return x.id === e.id ? rule : x; }); toast("Pravilo je sačuvano."); }
      flash("r" + rule.id); st.er = null; render();
    };
    var doDelete = function () {
      var d = st.del; if (!d) return;
      if (d.kind === "sur") {
        var s = SUR.filter(function (x) { return x.id === d.id; })[0], deps = R.list.filter(function (r) { return r.type === "sur" && r.sur === d.id; }).length;
        SUR.splice(SUR.indexOf(s), 1); R.list = R.list.filter(function (r) { return !(r.type === "sur" && r.sur === d.id); });
        delete st.sim.over[d.id]; st.es = null; st.del = null; render(); toast("Doplata „" + s.name + "“ je obrisana" + (deps ? " zajedno sa " + deps + (deps === 1 ? " pravilom." : " pravila.") : "."));
      } else {
        if (R.def && R.def.id === d.id) R.def = null; else R.list = R.list.filter(function (r) { return r.id !== d.id; });
        st.er = null; st.del = null; render(); toast("Pravilo je obrisano.");
      }
    };

    /* ---------- događaji ---------- */
    mount.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-act]"); if (!el || !mount.contains(el)) return;
      var a = el.getAttribute("data-act"), id = Number(el.getAttribute("data-id"));
      if (a === "stoggle" || a === "etoggle") return;
      if (a === "choice") {
        var e = edOf(el), k = el.getAttribute("data-k"), v = el.getAttribute("data-v");
        if (e) { e.d[k] = v; e.touch[k] = true; if (k === "type" && e.d.type === "default") { e.d.zone = null; } render('[data-ed="' + el.getAttribute("data-ed") + '"][data-k="' + k + '"][data-v="' + v + '"]'); }
        return;
      }
      if (a === "tab") { var nv = el.getAttribute("data-v"); if (nv === st.tab) return; if (anyDirty()) { st.ask = { after: nv }; render('[data-act="keep"]'); return; } goTab(nv); return; }
      if (a === "keep") { st.ask = null; render(); return; }
      if (a === "drop") { var af = st.ask && st.ask.after; st.draft = { base: fm(P.base), km: fm(P.km) }; goTab(af || st.tab); return; }
      if (a === "step") {
        var kk = el.getAttribute("data-k"), dd = Number(el.getAttribute("data-d")), cur = pn(st.draft[kk]); if (cur === null || isNaN(cur)) cur = kk === "base" ? P.base : P.km;
        var stp = kk === "base" ? 0.1 : 0.05; st.draft[kk] = fm(Math.max(0, r2(cur + dd * stp))); render('[data-act="step"][data-k="' + kk + '"][data-d="' + dd + '"]'); return;
      }
      if (a === "reset") { st.draft = { base: fm(P.base), km: fm(P.km) }; render(); return; }
      if (a === "saveprice") { savePrice(); return; }
      if (a === "tofirma") { ev.preventDefault(); toast("Otvara se stranica Firma, Valuta firme"); return; }
      if (a === "snew") { openS(null); return; }
      if (a === "qadd") { var cat = CATALOG.filter(function (c) { return c.key === el.getAttribute("data-key"); })[0]; openS(null, cat); return; }
      if (a === "sedit") { var s = SUR.filter(function (x) { return x.id === id; })[0]; if (st.es && st.es.id === id && st.wide) { st.es = null; render(); return; } if (st.es && JSON.stringify(st.es.d) !== st.es.orig) { toast("Prvo sačuvaj ili otkaži izmjenu koja je otvorena."); return; } openS(s); return; }
      if (a === "sclose") { st.es = null; render(); return; }
      if (a === "ssave") { ev.preventDefault(); saveS(); return; }
      if (a === "sdel") { st.del = { kind: "sur", id: st.es.id }; render('[data-act="dlgyes"]'); return; }
      if (a === "rnew") { openR(null); return; }
      if (a === "redit") { var r = R.list.concat(R.def ? [R.def] : []).filter(function (x) { return x.id === id; })[0]; if (st.er && st.er.id === id && st.wide) { st.er = null; render(); return; } openR(r); return; }
      if (a === "rclose") { st.er = null; render(); return; }
      if (a === "rsave") { ev.preventDefault(); saveR(); return; }
      if (a === "rdel") { st.del = { kind: "rule", id: st.er.id }; render('[data-act="dlgyes"]'); return; }
      if (a === "rmove") {
        var dir = Number(el.getAttribute("data-d")), i = R.list.map(function (x) { return x.id; }).indexOf(id), j = i + dir;
        if (j < 0 || j >= R.list.length) return; var t = R.list[i]; R.list[i] = R.list[j]; R.list[j] = t; flash("r" + id); render('[data-act="rmove"][data-id="' + id + '"][data-d="' + dir + '"]:not(:disabled)');
        toast("Pravilo je pomjereno.", function () { var i2 = R.list.map(function (x) { return x.id; }).indexOf(id), j2 = i2 - dir; var t2 = R.list[i2]; R.list[i2] = R.list[j2]; R.list[j2] = t2; render(); }); return;
      }
      if (a === "vadd") { var vv = el.getAttribute("data-v"); if (st.er && st.er.d.veh.indexOf(vv) < 0) { st.er.d.veh.push(vv); st.er.touch.veh = true; render('[data-act="vadd"]:not(:disabled)'); } return; }
      if (a === "vrem") { st.er.d.veh.splice(Number(el.getAttribute("data-i")), 1); st.er.touch.veh = true; render(); return; }
      if (a === "dlgno") { st.del = null; render(); return; }
      if (a === "dlgyes") { doDelete(); return; }
      if (a === "simsur") { var cur2 = simAct()[id]; if (st.sim.over.hasOwnProperty(id)) delete st.sim.over[id]; else st.sim.over[id] = !cur2; render('[data-act="simsur"][data-id="' + id + '"]'); return; }
      if (a === "simreset") { st.sim.over = {}; render(); return; }
      if (a === "dstep") { var nd = Math.min(15, Math.max(0.5, st.sim.dist + Number(el.getAttribute("data-d")) * 0.5)); st.sim.dist = nd; render('[data-act="dstep"][data-d="' + el.getAttribute("data-d") + '"]'); return; }
      if (a === "gorule") { if (!st.wide) st.simSheet = false; st.tab = "rules"; st.es = null; st.er = null; flash("r" + id); render(); var rr = $('.rr2[data-id="' + id + '"]', mount); if (rr) rr.scrollIntoView({ block: "nearest" }); return; }
      if (a === "simopen") { st.simSheet = true; render(); return; }
      if (a === "simclose") { st.simSheet = false; render(); return; }
      if (a === "retry") { st.mode = "loading"; render(); setTimeout(function () { st.mode = "ok"; render(); }, 800); return; }
      if (a === "back") { toast("Nazad na početnu"); return; }
    });
    mount.addEventListener("change", function (ev) {
      var el = ev.target, a = el.getAttribute("data-act"), id = Number(el.getAttribute("data-id"));
      if (a === "stoggle") {
        var s = SUR.filter(function (x) { return x.id === id; })[0], was = s.on; s.on = el.checked; s.since = s.on ? 0 : undefined; flash("s" + id); render('[data-act="stoggle"][data-id="' + id + '"]');
        var tot = calc(st.sim.dist, P, liveAct()).total;
        toast(s.on ? "„" + s.name + "“ je uključena. Za " + fk(st.sim.dist) + " km kupac plaća " + money(tot) + "." : "„" + s.name + "“ je isključena. Za " + fk(st.sim.dist) + " km kupac plaća " + money(tot) + ".", function () { s.on = was; s.since = was ? 5 : undefined; render(); }); return;
      }
      if (a === "etoggle") { var e = edOf(el); if (e) { e.d[el.getAttribute("data-k")] = el.checked; render('[data-k="' + el.getAttribute("data-k") + '"][data-act="etoggle"]'); } return; }
      if (el.getAttribute("data-k") === "dist" && el.type === "range") { render("#sm-dist"); return; }
      if (el.id === "sm-zone") { st.sim.zone = el.value ? Number(el.value) : null; render("#sm-zone"); return; }
      var ed = el.getAttribute("data-ed");
      if (ed === "r" && (el.id === "re-zone" || el.id === "re-sur")) { st.er.d[el.getAttribute("data-k")] = el.value ? Number(el.value) : null; st.er.touch[el.getAttribute("data-k")] = true; render("#" + el.id); return; }
    });
    mount.addEventListener("input", function (ev) {
      var el = ev.target, k = el.getAttribute && el.getAttribute("data-k"); if (!k) return;
      if (el.type === "range") { st.sim.dist = Number(el.value); var dv = $('[data-live="dv"]', mount); if (dv) dv.textContent = fk(st.sim.dist) + " km"; var t = $('[data-live="tot"]', mount); if (t) t.innerHTML = totHTML(); var vh = $('[data-live="veh"]', mount); if (vh) vh.innerHTML = vehHTML(); var di = $('[data-live="dirty"]', mount); if (di) di.innerHTML = dirtyBar(); return; }
      var ed = el.getAttribute("data-ed");
      if (ed === "s" || ed === "r") { var e = edOf(el); if (e && el.tagName !== "SELECT") { e.d[k] = el.value; e.touch[k] = true; if (k === "min" || k === "max") e.touch.dist = true; if (k === "from" || k === "to") e.touch.time = true; renderKeep(el); } return; }
      if (el.tagName === "SELECT") return;
      if (k === "base" || k === "km") { st.draft[k] = el.value; renderKeep(el); }
    });
    mount.addEventListener("submit", function (ev) { ev.preventDefault(); var b = $('[data-act="ssave"]:not(:disabled), [data-act="rsave"]:not(:disabled)', mount); if (b) b.click(); });
    mount.addEventListener("keydown", function (ev) {
      var rg = ev.target.closest && ev.target.closest('[role="radiogroup"]');
      if (rg && ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].indexOf(ev.key) > -1) {
        ev.preventDefault(); var os = $$('[role="radio"]', rg), i = Math.max(0, os.indexOf(ev.target.closest('[role="radio"]')));
        var n = ev.key === "Home" ? 0 : ev.key === "End" ? os.length - 1 : (i + (ev.key === "ArrowDown" || ev.key === "ArrowRight" ? 1 : -1) + os.length) % os.length; os[n].click(); return;
      }
      var tab = ev.target.closest && ev.target.closest('[role="tab"]');
      if (tab && ["ArrowRight", "ArrowLeft", "Home", "End"].indexOf(ev.key) > -1) {
        ev.preventDefault(); var ts = $$('[role="tab"]', mount), j = ts.indexOf(tab), m = ev.key === "Home" ? 0 : ev.key === "End" ? ts.length - 1 : (j + (ev.key === "ArrowRight" ? 1 : -1) + ts.length) % ts.length;
        ts[m].click(); var nt = $('[role="tab"][aria-selected="true"]', mount); if (nt) nt.focus(); return;
      }
      if (ev.key === "Escape") { if (st.del) { st.del = null; render(); } else if (st.simSheet) { st.simSheet = false; render(); } else if (!st.wide && (st.es || st.er)) { st.es = null; st.er = null; render(); } }
    });

    /* ---------- razmjera: telefon ili računar ---------- */
    var apply = function () {
      var w = root.clientWidth, wide = w >= 900;
      if (wide !== st.wide || !mount.firstChild) { st.wide = wide; render(); if (opts.es !== undefined && !st.es && !opts.__done) { opts.__done = true; } }
    };
    apply();
    if (opts.es !== undefined) { var sx = opts.es === "new" ? null : SUR.filter(function (x) { return x.id === opts.es; })[0]; openS(sx, opts.cat ? CATALOG.filter(function (c) { return c.key === opts.cat; })[0] : null); if (opts.esDraft) { Object.keys(opts.esDraft).forEach(function (k) { st.es.d[k] = opts.esDraft[k]; st.es.touch[k] = true; }); render(); } }
    if (opts.er !== undefined) { var rx = opts.er === "new" ? null : R.list.concat(R.def ? [R.def] : []).filter(function (x) { return x.id === opts.er; })[0]; openR(rx); if (opts.erDraft) { Object.keys(opts.erDraft).forEach(function (k) { st.er.d[k] = opts.erDraft[k]; st.er.touch[k] = true; if (k === "min" || k === "max") st.er.touch.dist = true; }); render(); } }
    if (opts.del) { st.del = opts.del; render(); }
    if (opts.simSheet && !st.wide) { st.simSheet = true; render(); }
    if (opts.ask) { st.ask = { after: "sur" }; render(); }
    if (window.ResizeObserver && !opts.fixed) new ResizeObserver(function () { apply(); }).observe(root);
    return { st: st, render: render, reset: function () { createApp(root, opts); } };
  };

  window.PricingProto = { create: createApp };
})();
