/* Prototip stranice Firma (/dispatcher/company). Nije Vue kod: ponašanje, tekstovi i izgled služe kao izvor za
   portovanje. Tokeni i obrasci (ProfileSection/ProfileRow, AppSheet, ChoiceGroup, TintAlert, AppButton, RosterFilters,
   RosterRow/RosterDetail) su iz aplikacije. Podaci su izmišljeni (primjer). Jedna instanca = jedan createApp(). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  var ICONS = {
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6.5 6.5 0 0 0-3-5.5"/>',
    pin: '<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6M10 7v6M7 10h6"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a3 3 0 0 0-5 1.5c0 3 5 1.5 5 4.5a3 3 0 0 1-5 1.5M12 6.5v2M12 15.5v2"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    bad: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16v.01"/>',
    store: '<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 12v8h14v-8"/>',
    phone: '<path d="M6 3h4l1.5 4.5-2.3 1.4a11 11 0 0 0 5.9 5.9l1.4-2.3L21 14v4a2 2 0 0 1-2.2 2A16 16 0 0 1 4 5.2 2 2 0 0 1 6 3z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    map: '<path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.5-4.5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 5v4h4M4 13a8 8 0 0 0 14.5 3.5L20 15M20 19v-4h-4"/>',
    off: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'
  };
  var ic = function (n, s) { s = s || 20; return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || "") + "</svg>"; };

  /* ---------- podaci (izmišljeni) ---------- */
  var COURIERS = [
    { n: "Marko Petrović", cash: 214.4 }, { n: "Darko Ilić", cash: 188 }, { n: "Jelena Radić", cash: 142.7 },
    { n: "Nikola Savić", cash: 61.2 }, { n: "Milica Jović", cash: 35 }, { n: "Amra Hadžić", cash: 0 },
    { n: "Stefan Kovač", cash: -19.2 }, { n: "Vladimir Lukić", cash: 0 }
  ];
  var seedRest = function () {
    return [
      { id: 106, n: "Roštiljnica Laguna", ar: true, ac: true, cur: "KM", since: "jul 2026", person: "Milan Lukić", phone: "051 312 445", mail: "info@laguna.ba", addr: "Branka Ćopića 12, Banja Luka", jib: "4400112230007", pib: "440011223" },
      { id: 109, n: "Krčma kod Ace", ar: true, ac: true, cur: "KM", since: "nov 2023", person: "Aca Petrović", phone: "051 330 100", mail: "", addr: "Vase Pelagića 24, Banja Luka", jib: "", pib: "" },
      { id: 112, n: "Urban Food Bordo Plus", ar: true, ac: true, cur: "EUR", since: "jul 2026", person: "", phone: "", mail: "bordo@urban.ba", addr: "Kralja Petra I Karađorđevića 90", jib: "", pib: "" },
      { id: 115, n: "Pizzeria Napoli", ar: false, ac: true, cur: "KM", since: "feb 2024", reason: "Dug za proviziju od avgusta", person: "Marko Ilić", phone: "065 411 220", mail: "napoli@pizza.ba", addr: "Jevrejska 3, Banja Luka", jib: "4400556670001", pib: "" },
      { id: 118, n: "Pekara Zlatni klas", ar: true, ac: false, cur: "KM", since: "nov 2024", person: "Jovana Kos", phone: "051 220 330", mail: "", addr: "Gundulićeva 8, Banja Luka", jib: "", pib: "" },
      { id: 121, n: "Ordera Burger Centar", ar: true, ac: true, internal: true, cur: "KM", since: "jan 2025", person: "Ordera", phone: "051 999 000", mail: "burger@ordera.app", addr: "Veselina Masleše 5", jib: "", pib: "" },
      { id: 124, n: "Restoran Kod Starog Mosta i Veliko Domaće Pečenje Sa Roštilja Banja Luka Centar", ar: true, ac: true, cur: "KM", since: "mar 2025", person: "Dragan Vuković", phone: "051 777 123", mail: "stari.most@primjer.ba", addr: "Trg Krajine 1", jib: "", pib: "" },
      { id: 127, n: "Sushi Bar Kyoto", ar: false, ac: false, cur: "KM", since: "maj 2025", reason: "Restoran je zatvoren zbog renoviranja do kraja oktobra", person: "Ana Savić", phone: "066 100 200", mail: "kyoto@sushi.ba", addr: "Zmaj Jovina 14", jib: "", pib: "" },
      { id: 130, n: "Burek i Jogurt Hodžić", ar: true, ac: true, cur: "KM", since: "jun 2024", person: "", phone: "051 111 222", mail: "", addr: "Ferhadija 30", jib: "", pib: "" },
      { id: 133, n: "Slastičarna Medena", ar: true, ac: true, cur: "KM", since: "", person: "", phone: "", mail: "", addr: "", jib: "", pib: "" },
      { id: 136, n: "Gyros Express", ar: true, ac: true, cur: "BAM", since: "sep 2025", person: "Nenad Gajić", phone: "065 222 333", mail: "gyros@express.ba", addr: "Jovana Dučića 7", jib: "", pib: "" },
      { id: 139, n: "Ćevabdžinica Sarajevo 84", ar: true, ac: true, cur: "KM", since: "sep 2023", person: "Haris Delić", phone: "051 456 789", mail: "cevabi@primjer.ba", addr: "Kneza Miloša 40", jib: "", pib: "" }
    ];
  };
  var seedSettings = function () {
    return { limitOn: true, limit: 200, enf: "BLOCK", handover: "14:16", payout: 1, mode: "ALL", count: 3, timeout: 20, tAction: "NEXT_NEAREST", pool: "ALL_ACTIVE", brk: true, cur: "KM", comm: 12 };
  };
  var CURRENCIES = ["KM", "BAM", "EUR", "RSD"];
  var coopOf = function (r) { return r.internal ? "internal" : !r.ar ? "ours" : !r.ac ? "theirs" : "active"; };
  var COOP = {
    active: { label: "Aktivna saradnja", tint: "#e3f8ef", ink: "#00734f", dot: "#00b37e" },
    ours: { label: "Suspendovali ste", tint: "#fde8e6", ink: "#b42318", dot: "#e5484d" },
    theirs: { label: "Isključio vas je restoran", tint: "#fff2df", ink: "#9a4a07", dot: "#e08a14" },
    internal: { label: "Sopstvena dostava", tint: "#f1f3f6", ink: "#46505f", dot: "#8a94a3" }
  };
  var money = function (n, cur) { return n.toFixed(2).replace(".", ",") + " " + (cur || "KM"); };
  var fold = function (s) { return String(s || "").toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var initials = function (n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); };

  /* ---------- gotovina naspram limita (ista pravila kao utils/cashLimit.ts) ---------- */
  var level = function (cash, limit) {
    var c = Math.max(0, cash);
    var over = limit === 0 ? c > 0 : c >= limit;
    var ratio = limit === 0 ? (c > 0 ? 1 : 0) : c / limit;
    return over ? "over" : ratio >= 0.8 ? "near" : "ok";
  };

  /* ---------- editori ---------- */
  var EDITORS = {
    limit: { title: "Limit gotovine", sub: "Koliko novca kurir smije držati prije predaje", keys: ["limitOn", "limit", "enf"] },
    handover: { title: "Predaja gotovine", sub: "Dnevno vrijeme predaje", keys: ["handover"] },
    payout: { title: "Isplata zarade", sub: "Koliko često se kuriru isplaćuje", keys: ["payout", "payoutOther"] },
    mode: { title: "Način dodjele", sub: "Ko dobija ponudu kad stigne nova narudžba", keys: ["mode", "count", "timeout", "tAction"] },
    pool: { title: "Koje kurire uzimam u obzir", sub: "Skup kurira za dodjelu", keys: ["pool"] },
    price: { title: "Cijena dostave za kupca", sub: "Šta kupac vidi prije potvrde narudžbe", keys: ["brk"] },
    currency: { title: "Valuta firme", sub: "Prikazuje se uz sve iznose", keys: ["cur"] },
    commission: { title: "Provizija", sub: "Samo za pregled", keys: [] }
  };

  var createApp = function (root, opts) {
    opts = opts || {};
    var S = seedSettings();
    var R = seedRest();
    var st = {
      tab: opts.tab || "postavke", wide: false, edit: null, ask: null, saving: false, saved: null,
      rf: opts.rf || "all", q: opts.q || "", page: 1, sel: opts.sel || null, sheet: null,
      loading: !!opts.loading, error: opts.error || null
    };
    if (opts.rest === "none") R = [];
    st.sheet = opts.sheet || null;
    var mount = document.createElement("div"); mount.className = "ap-mount";
    var toastEl = document.createElement("div"); toastEl.className = "ap-toast"; toastEl.setAttribute("role", "status"); toastEl.hidden = true;
    root.innerHTML = ""; root.appendChild(mount); root.appendChild(toastEl);
    var toastT;
    var toast = function (m) { toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, 2600); };

    /* ---- izvedeni podaci ---- */
    var overCount = function (limit) { return COURIERS.filter(function (c) { return c.cash > 0 && level(c.cash, limit) === "over"; }); };
    var mismatch = function (cur) { return R.filter(function (r) { return !r.internal && r.cur && r.cur !== cur; }); };
    var payoutText = function (d) { return d === 1 ? "Svaki dan" : d === 7 ? "Svake sedmice" : d === 15 ? "Svakih 15 dana" : "Svakih " + d + " dana"; };
    var modeText = function (s) {
      return s.mode === "ALL" ? "Svi kuriri istovremeno" : s.mode === "NEAREST" ? "Najbliži kurir prvi · " + s.timeout + " s" : "Prvih " + s.count + " najbližih · " + s.timeout + " s";
    };
    var poolText = { ALL_ACTIVE: "Svi aktivni kuriri", AVAILABLE_NOW: "Samo dostupni za rad", SCHEDULED_SHIFT: "Samo sa prijavljenom smjenom" };

    /* ---- validacija editora ---- */
    var validate = function (kind, d) {
      var e = {};
      if (kind === "limit" && d.limitOn) {
        var t = String(d.limit).trim().replace(",", ".");
        if (t === "") e.limit = "Unesi iznos. 0 znači da kurir ne smije držati nikakvu gotovinu.";
        else if (!isFinite(Number(t)) || Number(t) < 0) e.limit = "Unesi iznos veći ili jednak 0.";
      }
      if (kind === "payout" && d.payout === "other") {
        var p = Number(d.payoutOther);
        if (String(d.payoutOther).trim() === "" || !isFinite(p) || p < 1 || Math.floor(p) !== p) e.payoutOther = "Unesi cijeli broj dana, najmanje 1.";
      }
      if (kind === "mode") {
        if (d.mode === "TOP_N") { var c = Number(d.count); if (!isFinite(c) || c < 1 || c > 50 || Math.floor(c) !== c || String(d.count).trim() === "") e.count = "Unesi cijeli broj od 1 do 50."; }
        if (d.mode !== "ALL") { var tm = Number(d.timeout); if (String(d.timeout).trim() === "" || !isFinite(tm) || tm < 5 || tm > 120) e.timeout = "Unesi vrijeme od 5 do 120 sekundi."; }
      }
      return e;
    };
    var openDraft = function (kind) {
      var d = {};
      if (kind === "limit") d = { limitOn: S.limitOn, limit: S.limitOn ? String(S.limit) : "", enf: S.enf };
      else if (kind === "handover") d = { handover: S.handover || "" };
      else if (kind === "payout") d = { payout: [1, 7, 15].indexOf(S.payout) > -1 ? S.payout : "other", payoutOther: [1, 7, 15].indexOf(S.payout) > -1 ? "" : String(S.payout) };
      else if (kind === "mode") d = { mode: S.mode, count: String(S.count), timeout: String(S.timeout), tAction: S.tAction };
      else if (kind === "pool") d = { pool: S.pool };
      else if (kind === "price") d = { brk: S.brk };
      else if (kind === "currency") d = { cur: S.cur };
      return d;
    };
    var beginEdit = function (kind) {
      st.edit = { kind: kind, draft: openDraft(kind), orig: null, server: {}, alert: "", touched: {} };
      st.edit.orig = JSON.stringify(st.edit.draft);
      if (opts.draft) { Object.keys(opts.draft).forEach(function (k) { st.edit.draft[k] = opts.draft[k]; }); }
      if (opts.server) st.edit.server = opts.server;
      if (opts.alert) st.edit.alert = opts.alert;
      if (opts.ask) st.ask = { type: "close" };
    };
    var isDirty = function () { return !!st.edit && JSON.stringify(st.edit.draft) !== st.edit.orig; };

    /* ---- gradivni dijelovi ---- */
    var tint = function (tone, icon, title, body, action) {
      return '<div class="ap-tint ap-tint--' + tone + '" role="' + (tone === "bad" ? "alert" : "status") + '">' + ic(icon, 22) + '<div class="ap-tint-b">' + (title ? '<b class="tt">' + title + "</b>" : "") + body + (action || "") + "</div></div>";
    };
    var field = function (o) {
      var err = o.err;
      return '<div class="ap-sf"><label class="ap-sf-l" for="' + o.id + '">' + o.label + (o.opt ? "<i> opciono</i>" : "") + '</label>' +
        '<div class="ap-sf-in' + (err ? " is-bad" : "") + '"><input id="' + o.id + '" data-k="' + o.k + '" type="' + (o.type || "text") + '" inputmode="' + (o.mode || "text") + '" value="' + esc(o.v) + '" aria-invalid="' + (err ? "true" : "false") + '" aria-describedby="' + o.id + '-m" autocomplete="off">' + (o.tail || "") + "</div>" +
        '<div class="ap-sf-m' + (err ? " is-bad" : "") + '" id="' + o.id + '-m" data-msg="' + o.k + '" data-hint="' + esc(o.hint || "") + '" aria-live="polite">' + (err ? ic("bad", 16) + "<span>" + esc(err) + "</span>" : (o.hint ? "<span>" + o.hint + "</span>" : "")) + "</div></div>";
    };
    var choice = function (k, value, options, o) {
      o = o || {};
      return '<div class="ap-cg ap-cg--' + (o.variant || "cards") + ' c' + (o.cols || 2) + '" role="radiogroup" aria-label="' + esc(o.label || "") + '">' + options.map(function (op) {
        var on = String(value) === String(op.v);
        var first = value == null ? options[0] === op : on;
        return '<button type="button" role="radio" class="ap-cg-o' + (op.wide ? " wide" : "") + '" aria-checked="' + on + '" tabindex="' + (first ? 0 : -1) + '" data-k="' + k + '" data-v="' + esc(op.v) + '" data-act="choice">' +
          (o.variant === "pills" ? "<span>" + op.t + "</span>" : '<span class="ap-cg-t"><b>' + op.t + "</b>" + (op.h ? "<small>" + op.h + "</small>" : "") + '</span><span class="ap-cg-ck">' + ic("check", 15) + "</span>") + "</button>";
      }).join("") + "</div>";
    };
    var swRow = function (id, k, on, title, hint) {
      return '<div class="ap-sw"><div class="ap-sw-t"><label for="' + id + '"><b>' + title + "</b></label>" + (hint ? "<small>" + hint + "</small>" : "") + '</div><label class="ap-switch"><input id="' + id + '" type="checkbox" role="switch" data-k="' + k + '" data-act="toggle"' + (on ? " checked" : "") + '><i></i></label></div>';
    };

    /* ---- editori: tijelo ---- */
    var impactHTML = function (d) {
      var cur = S.cur;
      if (!d.limitOn) {
        var total = COURIERS.reduce(function (a, c) { return a + Math.max(0, c.cash); }, 0);
        var top = COURIERS.slice().sort(function (a, b) { return b.cash - a.cash; })[0];
        return tint("info", "info", "Bez limita", "Kuriri sada drže ukupno " + money(total, cur) + ", najviše " + top.n + " (" + money(top.cash, cur) + "). Ništa ih ne zaustavlja da drže i više.");
      }
      var t = String(d.limit).trim().replace(",", ".");
      if (t === "" || !isFinite(Number(t)) || Number(t) < 0) return "";
      var L = Number(t);
      var holders = COURIERS.filter(function (c) { return c.cash > 0; }).sort(function (a, b) { return b.cash - a.cash; });
      var over = holders.filter(function (c) { return level(c.cash, L) === "over"; });
      var near = holders.filter(function (c) { return level(c.cash, L) === "near"; });
      var rows = over.concat(near).slice(0, 4).map(function (c) {
        var lv = level(c.cash, L), pct = L === 0 ? 100 : Math.min(100, Math.round(c.cash / L * 100));
        return '<li><span class="n">' + esc(c.n) + '</span><span class="m ' + lv + '">' + money(c.cash, cur) + '</span><span class="bar ' + lv + '"><i style="width:' + pct + '%"></i></span></li>';
      }).join("");
      var effect = d.enf === "BLOCK" ? "Preko limita ne mogu da prihvate novu narudžbu dok ne predaju gotovinu." : "Preko limita i dalje primaju narudžbe.";
      if (L === 0) return tint("bad", "bad", "0 " + cur + " blokira svakoga ko drži ijedan iznos", (d.enf === "BLOCK" ? "Sada bi " + holders.length + " od " + COURIERS.length + " kurira odmah ostalo bez novih narudžbi." : "Sada bi " + holders.length + " od " + COURIERS.length + " kurira bilo preko limita.") + " Ako želiš da kurir ne drži gotovinu, to je u redu; ako nisi sigurno, uzmi veći iznos.") + '<ul class="ap-imp">' + rows + "</ul>";
      var head = over.length ? "Sa " + money(L, cur) + ": " + over.length + (over.length === 1 ? " kurir je" : " kurira su") + " odmah preko limita" + (near.length ? ", " + near.length + " blizu" : "") : "Sa " + money(L, cur) + " niko nije preko limita" + (near.length ? ", " + near.length + (near.length === 1 ? " je blizu" : " su blizu") : "");
      return tint(over.length && d.enf === "BLOCK" ? "warn" : "info", over.length ? "alert" : "check", head, effect) + (rows ? '<ul class="ap-imp">' + rows + "</ul>" : "");
    };
    var editorBody = function (e) {
      var d = e.draft, k = e.kind, er = validate(k, d), sv = e.server || {};
      var msg = function (key) { return er[key] || sv[key] || ""; };
      if (k === "limit") {
        return swRow("e-limiton", "limitOn", d.limitOn, "Ograniči gotovinu", "Kurir mora da preda gotovinu kad pređe iznos.") +
          (d.limitOn ?
            field({ id: "e-limit", k: "limit", label: "Limit (" + S.cur + ")", v: d.limit, type: "text", mode: "decimal", err: msg("limit"), hint: "0 znači da kurir ne smije držati nikakvu gotovinu." }) +
            '<div class="ap-f"><span class="ap-fl">Kad kurir pređe limit</span>' + choice("enf", d.enf, [
              { v: "NOTIFY_ONLY", t: "Samo obavijesti", h: "Kurir i dalje prima narudžbe." },
              { v: "BLOCK", t: "Blokiraj nove narudžbe", h: "Ne može da prihvati ponudu dok ne preda gotovinu." }
            ], { label: "Kad kurir pređe limit" }) + "</div>" : "") +
          '<div class="ap-live" data-live="impact">' + impactHTML(d) + "</div>";
      }
      if (k === "handover") {
        return field({ id: "e-hand", k: "handover", label: "Vrijeme dnevne predaje", opt: true, v: d.handover, type: "time", hint: "Prazno znači da vrijeme nije određeno.", tail: d.handover ? '<button type="button" class="ap-clr" data-act="clearhand" aria-label="Obriši vrijeme">' + ic("x", 18) + "</button>" : "" });
      }
      if (k === "payout") {
        return '<div class="ap-f"><span class="ap-fl">Koliko često se isplaćuje</span>' + choice("payout", d.payout, [
          { v: 1, t: "Svaki dan" }, { v: 7, t: "Svake sedmice" }, { v: 15, t: "Svakih 15 dana" }, { v: "other", t: "Drugo" }
        ], { variant: "pills", label: "Period isplate" }) + "</div>" +
          (d.payout === "other" ? field({ id: "e-pay", k: "payoutOther", label: "Broj dana", v: d.payoutOther, mode: "numeric", err: msg("payoutOther"), hint: "Cijeli broj, najmanje 1." }) : "");
      }
      if (k === "mode") {
        var body = '<div class="ap-f">' + choice("mode", d.mode, [
          { v: "ALL", t: "Svi kuriri istovremeno", h: "Prvi koji prihvati dobija narudžbu." },
          { v: "NEAREST", t: "Najbliži kurir prvi", h: "Ako ne odgovori, ponuda ide dalje." },
          { v: "TOP_N", t: "Prvih N najbližih istovremeno", h: "Prvi koji prihvati dobija narudžbu." }
        ], { label: "Način dodjele", cols: 1 }) + "</div>";
        if (d.mode === "TOP_N") body += field({ id: "e-count", k: "count", label: "Broj kurira koji dobijaju ponudu", v: d.count, mode: "numeric", err: msg("count"), hint: "Od 1 do 50." });
        if (d.mode !== "ALL") {
          body += field({ id: "e-timeout", k: "timeout", label: "Vrijeme čekanja odgovora (sekunde)", v: d.timeout, mode: "numeric", err: msg("timeout"), hint: "Od 5 do 120 sekundi." }) +
            '<div class="ap-f"><span class="ap-fl">Ako niko ne odgovori na vrijeme</span>' + choice("tAction", d.tAction, [
              { v: "NEXT_NEAREST", t: "Šalji sljedećem najbližem" }, { v: "OPEN_TO_ALL", t: "Otvori svim kuririma" }
            ], { label: "Ako niko ne odgovori", variant: "pills" }) + "</div>";
        }
        var t = d.mode === "ALL" ? "Nova narudžba odmah ide svim kuririma iz skupa. Dobija je prvi koji prihvati." :
          (d.mode === "NEAREST" ? "Nova narudžba ide najbližem kuriru." : "Nova narudžba ide " + (er.count ? "N" : d.count) + " najbližih kurira istovremeno.") +
          " Ako niko ne odgovori za " + (er.timeout ? "…" : d.timeout) + " s, " + (d.tAction === "OPEN_TO_ALL" ? "otvara se svim kuririma." : "ide sljedećem najbližem.");
        return body + '<div class="ap-live" data-live="explain">' + tint("info", "info", "Šta će se desiti", t) + "</div>";
      }
      if (k === "pool") {
        return '<div class="ap-f">' + choice("pool", d.pool, [
          { v: "ALL_ACTIVE", t: "Svi aktivni kuriri firme", h: "Bez provjere da su označili „dostupan za rad“." },
          { v: "AVAILABLE_NOW", t: "Samo dostupni za rad", h: "Kuriri koji su se označili kao dostupni." },
          { v: "SCHEDULED_SHIFT", t: "Samo sa prijavljenom smjenom", h: "Prema planu angažovanja za ovo vrijeme." }
        ], { label: "Koje kurire uzimam u obzir", cols: 1 }) + "</div>";
      }
      if (k === "price") {
        return swRow("e-brk", "brk", d.brk, "Prikaži kupcu detaljan raspis", "Kupac prije potvrde vidi iz čega se sastoji cijena dostave.") +
          '<div class="ap-prev"><div class="ap-rc' + (d.brk ? "" : " dim") + '"><div class="cap">Kupac vidi</div><div><span>Osnovna cijena</span><span>2,00</span></div><div><span>Po kilometru (3,2 km)</span><span>1,60</span></div><div><span>Gužva</span><span>0,50</span></div><div class="tot"><span>Dostava</span><span>4,10 ' + S.cur + '</span></div></div>' +
          '<div class="ap-rc' + (d.brk ? " dim" : "") + '"><div class="cap">Kupac vidi</div><div class="tot nb"><span>Dostava</span><span>4,10 ' + S.cur + "</span></div></div></div>" +
          '<p class="ap-note">Izmjena odmah važi za svaku narudžbu koju kupac sljedeću pregleda.</p>';
      }
      if (k === "currency") {
        var mm = mismatch(d.cur);
        return '<div class="ap-f"><span class="ap-fl">Valuta</span>' + choice("cur", d.cur, CURRENCIES.map(function (c) { return { v: c, t: c }; }), { variant: "pills", label: "Valuta firme" }) + "</div>" +
          '<div class="ap-live" data-live="cur">' + currencyAlert(d.cur) + "</div>";
      }
      if (k === "commission") {
        return tint("info", "lock", "Provizija " + S.comm + " %", "Postavlja Ordera administrator. Ovdje se ne može mijenjati.");
      }
      return "";
    };
    var currencyAlert = function (cur) {
      if (cur === S.cur) return "";
      var mm = mismatch(cur), lim = S.limitOn ? " Limit gotovine od " + S.limit + " " + S.cur + " postaje " + S.limit + " " + cur + "." : "";
      return tint("warn", "alert", "Iznosi se ne preračunavaju", "Cijene i limit ostaju isti brojevi." + lim + (mm.length ? " " + mm.length + " od " + R.filter(function (r) { return !r.internal; }).length + " restorana koristi drugu valutu." : ""));
    };

    /* ---- redovi ---- */
    var row = function (o) {
      var tag = o.tag ? '<span class="ap-tag ap-tag--' + o.tag[0] + '">' + o.tag[1] + "</span>" : "";
      var end = o.locked ? '<span class="ap-end">' + ic("lock", 18) + "</span>" : '<span class="ap-end">' + ic("chev", 20) + "</span>";
      var inner = '<span class="ap-ric">' + ic(o.icon, 20) + '</span><span class="ap-rt"><small>' + o.label + "</small><b>" + o.value + "</b>" + (o.hint ? "<em>" + o.hint + "</em>" : "") + (tag ? "<span class=\"ap-tags\">" + tag + "</span>" : "") + "</span>" + end;
      if (o.locked) return '<div class="ap-row ap-row--lock">' + inner + "</div>";
      var sel = st.wide && st.edit && st.edit.kind === o.kind;
      return '<button type="button" class="ap-row' + (sel ? " is-sel" : "") + (st.saved === o.kind ? " is-flash" : "") + '" data-act="row" data-kind="' + o.kind + '" aria-label="' + esc(o.label + ": " + o.value.replace(/<[^>]+>/g, "")) + '. Izmijeni">' + inner + "</button>";
    };
    var section = function (title, rows, foot) {
      return '<section class="ap-sec"><h2 class="ap-eb">' + title + '</h2><div class="ap-card ap-rows">' + rows.join("") + "</div>" + (foot ? '<p class="ap-foot">' + foot + "</p>" : "") + "</section>";
    };
    var settingsList = function () {
      var over = S.limitOn ? overCount(Number(S.limit)).length : 0;
      var mm = mismatch(S.cur).length;
      return '<div class="ap-secs">' +
        section("Gotovina", [
          row({ kind: "limit", icon: "cash", label: "Limit gotovine", value: S.limitOn ? money(Number(S.limit), S.cur) + " · " + (S.enf === "BLOCK" ? "blokira nove narudžbe" : "samo obavještava") : "Bez limita", tag: over ? ["red", over + (over === 1 ? " kurir preko limita" : " kurira preko limita")] : null }),
          row({ kind: "handover", icon: "clock", label: "Predaja gotovine", value: S.handover ? "Svaki dan u " + S.handover : "Vrijeme nije određeno" }),
          row({ kind: "payout", icon: "cal", label: "Isplata zarade", value: payoutText(S.payout) })
        ]) +
        section("Dodjela narudžbi", [
          row({ kind: "mode", icon: "pin", label: "Način dodjele", value: modeText(S) }),
          row({ kind: "pool", icon: "users", label: "Koje kurire uzimam u obzir", value: poolText[S.pool] })
        ]) +
        section("Kupac vidi", [
          row({ kind: "price", icon: "receipt", label: "Cijena dostave", value: S.brk ? "Detaljan raspis" : "Samo ukupan iznos" })
        ]) +
        section("Firma", [
          row({ kind: "currency", icon: "coin", label: "Valuta firme", value: S.cur, tag: mm ? ["amber", mm + (mm === 1 ? " restoran u drugoj valuti" : " restorana u drugoj valuti")] : null }),
          row({ icon: "percent", label: "Provizija", value: S.comm + " %", hint: "Postavlja Ordera administrator", locked: true })
        ]) + "</div>";
    };
    var editorHead = function (e, inSheet) {
      var m = EDITORS[e.kind];
      return '<header class="' + (inSheet ? "ap-sh-h" : "ap-ed-h") + '"><div class="t"><h2 id="ed-title">' + m.title + "</h2><p>" + m.sub + "</p></div>" + (inSheet || e.kind !== "x" ? '<button type="button" class="ap-ib" data-act="close" aria-label="Zatvori">' + ic("x", 20) + "</button>" : "") + "</header>";
    };
    var guard = function () {
      return '<div class="ap-guard">' + tint("warn", "alert", "Imaš nesačuvane izmjene", "Ako zatvoriš, izmjene se gube.") +
        '<div class="ap-guard-r"><button type="button" class="ap-btn ghost" data-act="keep">Nastavi uređivanje</button><button type="button" class="ap-btn ghost" data-act="drop">Odbaci izmjene</button></div></div>';
    };
    var editorFooter = function (e) {
      if (e.kind === "commission") return "";
      var er = validate(e.kind, e.draft), ok = !Object.keys(er).length, dirty = isDirty();
      return '<div class="ap-foot-b"><button type="submit" class="ap-btn primary" data-act="save"' + (!dirty || !ok || st.saving ? " disabled" : "") + (st.saving ? ' aria-busy="true"' : "") + ">" + (st.saving ? "Čuvam…" : "Sačuvaj") + "</button></div>";
    };
    var editorContent = function (e, inSheet) {
      return editorHead(e, inSheet) + '<form class="ap-form" novalidate data-form="1"><div class="' + (inSheet ? "ap-sh-body" : "ap-ed-body") + '">' +
        (st.ask ? guard() : "") + (e.alert ? tint("bad", "bad", "Ne mogu da sačuvam", e.alert) : "") + editorBody(e) + "</div>" + editorFooter(e) + "</form>";
    };

    /* ---- restorani ---- */
    var counts = function () {
      var c = { all: R.length, active: 0, ours: 0, theirs: 0, internal: 0, cur: 0 };
      R.forEach(function (r) { c[coopOf(r)]++; if (!r.internal && r.cur !== S.cur) c.cur++; });
      return c;
    };
    var visible = function () {
      var q = fold(st.q).replace(/^\s*#/, "").trim();
      return R.filter(function (r) {
        var k = coopOf(r);
        if (st.rf === "cur") { if (r.internal || r.cur === S.cur) return false; }
        else if (st.rf !== "all" && st.rf !== k) return false;
        return !q || fold(r.n).indexOf(q) > -1 || String(r.id).indexOf(q) > -1;
      });
    };
    var filters = function () {
      var c = counts();
      var tiles = [["all", "Svi", "#0b1220"], ["active", "Aktivna", "#00b37e"], ["ours", "Suspendovali ste", "#e5484d"], ["theirs", "Isključio vas", "#e08a14"], ["internal", "Sopstvena dostava", "#8a94a3"]];
      var h = '<div class="ap-tiles" role="group" aria-label="Stanje saradnje">' + tiles.filter(function (t) { return t[0] === "all" || c[t[0]] > 0; }).map(function (t) {
        return '<button type="button" class="ap-tile" aria-pressed="' + (st.rf === t[0]) + '" data-act="filter" data-v="' + t[0] + '" style="--dot:' + t[2] + '"><i></i><span>' + t[1] + "</span><b>" + c[t[0]] + "</b></button>";
      }).join("") + "</div>";
      if (c.cur > 0 || st.rf === "cur") h += '<div class="ap-chips" role="group" aria-label="Šta traži pažnju"><button type="button" class="ap-chip" aria-pressed="' + (st.rf === "cur") + '" data-act="filter" data-v="' + (st.rf === "cur" ? "all" : "cur") + '"><i></i>Druga valuta<em>' + c.cur + "</em></button></div>";
      return h;
    };
    var restRow = function (r) {
      var k = coopOf(r), m = COOP[k];
      var tags = "";
      if (!r.internal && r.cur !== S.cur) tags += '<span class="ap-tag ap-tag--amber">' + ic("alert", 14) + "Valuta " + r.cur + "</span>";
      if (k === "ours" && !r.ac) tags += '<span class="ap-tag ap-tag--amber">Isključio i restoran</span>';
      var sub = k === "ours" && r.reason ? "Razlog: " + esc(r.reason) : r.since ? "Saradnja od " + r.since : "Datum početka nije upisan";
      return '<li><button type="button" class="ap-rr' + (st.sel === r.id ? " is-sel" : "") + '" data-act="rest" data-id="' + r.id + '" aria-label="' + esc(r.n + ", " + m.label.toLowerCase() + ". Otvori detalje") + '">' +
        '<span class="ap-av" style="--tint:' + m.tint + ";--ink:" + m.ink + '">' + ic("store", 22) + '<span class="dot" style="background:' + m.dot + '"></span></span>' +
        '<span class="ap-rr-m"><b>' + esc(r.n) + '</b><span class="s">' + sub + "</span>" + (tags ? '<span class="ap-tags">' + tags + "</span>" : "") + "</span>" +
        '<span class="ap-st" style="--tint:' + m.tint + ";--ink:" + m.ink + ";--dot:" + m.dot + '"><i></i>' + m.label + "</span></button></li>";
    };
    var restList = function () {
      var rows = visible(), per = 12, shown = rows.slice(0, st.page * per);
      var h = '<div class="ap-search"><label class="ap-sr-only" for="rq">Pretraži restorane</label>' + ic("search", 20) + '<input id="rq" data-k="q" type="search" placeholder="Naziv restorana ili broj" value="' + esc(st.q) + '" autocomplete="off">' + (st.q ? '<button type="button" class="ap-x" data-act="clearq" aria-label="Obriši pretragu">' + ic("x", 18) + "</button>" : "") + "</div>";
      if (!R.length) return h + '<div class="ap-empty">' + '<span class="ap-tile-ic">' + ic("store", 30) + "</span><h3>Nema povezanih restorana</h3><p>Restorani koji rade sa ovom firmom pojaviće se ovdje. Poziv za saradnju šalje restoran iz svoje aplikacije.</p></div>";
      if (!rows.length) return h + '<div class="ap-empty"><span class="ap-tile-ic">' + ic("search", 30) + '</span><h3>Nijedan restoran ne odgovara</h3><p>Probaj drugi naziv ili ukloni filter.</p><button type="button" class="ap-btn ghost" data-act="resetf">Očisti filtere</button></div>';
      return h + '<div class="ap-res" aria-live="polite">' + rows.length + (rows.length === 1 ? " restoran" : " restorana") + '</div><ul class="ap-card ap-rlist">' + shown.map(restRow).join("") + "</ul>" +
        (shown.length < rows.length ? '<div class="ap-more"><button type="button" class="ap-btn soft" data-act="more">Prikaži još ' + Math.min(per, rows.length - shown.length) + "</button></div>" : "");
    };
    var kv = function (icn, label, value, href) {
      var empty = !value;
      return '<div class="ap-kv"><span class="ap-ric">' + ic(icn, 20) + '</span><span class="ap-rt"><small>' + label + "</small><b" + (empty ? ' class="empty"' : "") + ">" + (empty ? "Nije upisano" : esc(value)) + "</b></span></div>";
    };
    var restDetail = function (r) {
      var k = coopOf(r), m = COOP[k], mm = !r.internal && r.cur !== S.cur;
      var alert = "";
      if (k === "ours") alert = tint("bad", "off", "Suspendovali ste saradnju", esc(r.reason || "Razlog nije upisan.") + " Narudžbe ovog restorana ne stižu kuririma.", '<div class="ap-act-l"><button type="button" data-act="activate">Uključi saradnju</button></div>');
      else if (k === "theirs") alert = tint("warn", "alert", "Restoran je isključio saradnju", "Njihova odluka, ne vaša. Narudžbe ne stižu dok ga restoran ponovo ne uključi. Možete ga i vi suspendovati.");
      else if (k === "internal") alert = tint("info", "info", "Restoran koristi sopstvenu dostavu", "Nema saradnje koja se može uključiti ili isključiti.");
      var qb = function (icn, label, on, act) { return on ? '<a class="ap-qb" href="#" data-act="' + act + '">' + ic(icn, 22) + label + "</a>" : '<button type="button" class="ap-qb" disabled title="Nije upisano">' + ic(icn, 22) + label + "</button>"; };
      var action = k === "ours" ? '<button type="button" class="ap-qb" data-act="activate">' + ic("check", 22) + "Uključi</button>" : (k === "internal" ? "" : '<button type="button" class="ap-qb" data-act="suspend">' + ic("off", 22) + "Suspenduj</button>");
      return '<article class="ap-dt" aria-label="Detalji restorana"><header class="ap-dt-h"><span class="ap-av big" style="--tint:' + m.tint + ";--ink:" + m.ink + '">' + ic("store", 26) + '<span class="dot" style="background:' + m.dot + '"></span></span><div class="t"><h2>' + esc(r.n) + '</h2><div class="meta"><button type="button" class="ap-id" data-act="copy">Restoran #' + r.id + ic("copy", 14) + '</button><span class="ap-st" style="--tint:' + m.tint + ";--ink:" + m.ink + ";--dot:" + m.dot + '"><i></i>' + m.label + "</span></div></div>" + (st.wide ? '<button type="button" class="ap-ib" data-act="closedt" aria-label="Zatvori detalje">' + ic("x", 20) + "</button>" : "") + "</header>" +
        '<div class="ap-qa">' + qb("phone", "Pozovi", !!r.phone, "call") + qb("mail", "E-pošta", !!r.mail, "mailto") + qb("map", "Mapa", !!r.addr, "map") + action + "</div>" +
        (alert ? '<div class="ap-dt-a">' + alert + "</div>" : "") +
        '<h3 class="ap-gt">Saradnja</h3><div class="ap-card ap-rows">' + kv("check", "Stanje", m.label) + kv("cal", "Saradnja od", r.since) + (k === "ours" ? kv("off", "Razlog suspenzije", r.reason) : "") + kv("coin", "Valuta restorana", r.cur + (mm ? " · firma koristi " + S.cur : "")) + "</div>" +
        (mm ? '<div class="ap-dt-a">' + tint("warn", "alert", "Valuta se razlikuje", "Restoran koristi " + r.cur + ", firma " + S.cur + ". Cijene se ne preračunavaju.") + "</div>" : "") +
        '<h3 class="ap-gt">Kontakt</h3><div class="ap-card ap-rows">' + kv("users", "Kontakt osoba", r.person) + kv("phone", "Telefon", r.phone) + kv("mail", "E-pošta", r.mail) + kv("map", "Adresa", r.addr) + "</div>" +
        '<h3 class="ap-gt">Podaci</h3><div class="ap-card ap-rows">' + kv("receipt", "JIB", r.jib) + kv("receipt", "PIB", r.pib) + "</div></article>";
    };
    var QUICK = ["Dug za proviziju", "Restoran zatvoren", "Na zahtjev restorana", "Kasne isplate"];
    var sheetHTML = function () {
      var sh = st.sheet; if (!sh) return "";
      var r = R.filter(function (x) { return x.id === sh.id; })[0];
      var body, title, footer;
      if (sh.type === "suspend") {
        title = "Suspenduj saradnju";
        body = tint("info", "info", "", "Narudžbe restorana <b>" + esc(r.n) + "</b> neće biti vidljive kuririma dok saradnju ponovo ne uključiš.") +
          '<div class="ap-qr" role="group" aria-label="Brz izbor razloga">' + QUICK.map(function (q) { return '<button type="button" class="ap-qchip" aria-pressed="' + (sh.reason === q) + '" data-act="qreason" data-v="' + esc(q) + '">' + q + "</button>"; }).join("") + "</div>" +
          '<div class="ap-sf"><label class="ap-sf-l" for="s-reason">Razlog<i> opciono</i></label><div class="ap-sf-in ta"><textarea id="s-reason" data-k="reason" rows="3" placeholder="Vidi ga svako ko otvori ovog restorana.">' + esc(sh.reason || "") + "</textarea></div></div>";
        footer = '<button type="submit" class="ap-btn danger" data-act="dosuspend">Suspenduj saradnju</button>';
      } else {
        title = "Uključi saradnju";
        var mm = !r.internal && r.cur !== S.cur;
        body = '<p class="ap-p">Ponovo uključiti saradnju sa restoranom <b>' + esc(r.n) + "</b>? Njegove narudžbe opet stižu kuririma.</p>" + (r.reason ? tint("info", "info", "Razlog suspenzije", esc(r.reason)) : "") + (mm ? tint("warn", "alert", "Valuta se razlikuje", "Restoran koristi " + r.cur + ", a firma " + S.cur + ". Cijene se ne preračunavaju.") : "");
        footer = '<button type="submit" class="ap-btn primary" data-act="doactivate">Uključi saradnju</button>';
      }
      return '<div class="ap-scrim on" data-act="sheetclose"></div><div class="ap-sheet on" role="dialog" aria-modal="true" aria-labelledby="sh-t"><div class="ap-grip"><i></i></div><header class="ap-sh-h"><div class="t"><h2 id="sh-t">' + title + "</h2><p>" + esc(r.n) + "</p></div>" + '<button type="button" class="ap-ib" data-act="sheetclose" aria-label="Zatvori">' + ic("x", 20) + '</button></header><form class="ap-form" novalidate data-sheetform="1"><div class="ap-sh-body">' + body + '</div><div class="ap-foot-b">' + footer + "</div></form></div>";
    };

    /* ---- stranica ---- */
    var skeleton = function () {
      var r = '<div class="ap-sk-row"><span class="sk" style="width:44px;height:44px;border-radius:14px"></span><span class="ap-sk-l"><span class="sk" style="width:62%;height:14px"></span><span class="sk" style="width:38%;height:11px"></span></span><span class="sk" style="width:64px;height:11px"></span></div>';
      return '<div class="ap-card" aria-busy="true" aria-label="Učitavanje">' + r + r + r + r + r + "</div>";
    };
    var errorBlock = function (what) {
      return '<div class="ap-empty"><span class="ap-tile-ic bad">' + ic("bad", 30) + '</span><h3>Ne mogu da učitam ' + what + '</h3><p>Provjeri vezu i pokušaj ponovo. Ništa nije izgubljeno.</p><button type="button" class="ap-btn ghost" data-act="retry">' + ic("refresh", 18) + "Pokušaj ponovo</button></div>";
    };
    var tabsHTML = function () {
      var c = counts(), o = [["postavke", "Postavke", ""], ["restorani", "Restorani", c.all]];
      return '<div class="ap-tabs" role="tablist" aria-label="Sekcije firme">' + o.map(function (t) {
        return '<button type="button" role="tab" class="ap-tab" id="tab-' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '" aria-controls="panel" tabindex="' + (st.tab === t[0] ? 0 : -1) + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + (t[2] !== "" ? '<span class="n">' + t[2] + "</span>" : "") + "</button>";
      }).join("") + "</div>";
    };
    var view = function () {
      var detailPhone = !st.wide && st.tab === "restorani" && st.sel;
      var selR = st.sel ? R.filter(function (r) { return r.id === st.sel; })[0] : null;
      var title = detailPhone && selR ? esc(selR.n) : "Ordera Dostava Banja Luka";
      var sub = detailPhone ? "Restoran #" + selR.id : "Banja Luka · valuta " + S.cur;
      var h = '<div class="ap' + (st.wide ? " wide" : "") + '">';
      if (!st.wide) h += '<div class="ap-bar"><span class="m">' + ic("menu", 24) + '</span><b>Ordera</b><i>Dispečer</i></div>';
      h += '<header class="ap-head"><button type="button" class="ap-ib" data-act="back" aria-label="' + (detailPhone ? "Nazad na listu restorana" : "Nazad na početnu") + '">' + ic("back", 22) + '</button><span class="ap-heading"><span class="ap-title" role="heading" aria-level="1">' + title + '</span><span class="ap-subt">' + sub + "</span></span></header>";
      h += '<div class="ap-scroll" id="panel" role="tabpanel" aria-labelledby="tab-' + st.tab + '">';
      if (!detailPhone) h += tabsHTML();
      h += '<div class="ap-body">';
      if (st.tab === "postavke") {
        if (st.error === "settings") h += errorBlock("postavke");
        else if (st.loading) h += skeleton();
        else if (st.wide) h += '<div class="ap-grid"><div class="ap-col-l">' + settingsList() + '</div><aside class="ap-col-r" aria-label="Uređivanje">' + (st.edit ? '<div class="ap-card ap-ed">' + editorContent(st.edit, false) + "</div>" : '<div class="ap-card ap-ed-none">' + ic("cash", 34) + "<b>Izaberi postavku</b><p>Izmjene se pojavljuju ovdje. Svaka se čuva posebno, odmah pored polja.</p></div>") + "</aside></div>";
        else h += settingsList();
      } else {
        if (st.error === "rest") h += errorBlock("restorane");
        else if (st.loading) h += skeleton();
        else if (detailPhone && selR) h += restDetail(selR);
        else if (st.wide) h += filters() + '<div class="ap-grid"><div class="ap-col-l">' + restList() + '</div><aside class="ap-col-r" aria-label="Detalji restorana">' + (selR ? restDetail(selR) : '<div class="ap-card ap-ed-none">' + ic("store", 34) + "<b>Izaberi restoran</b><p>Kontakt, stanje saradnje i radnje pojavljuju se ovdje.</p></div>") + "</aside></div>";
        else h += filters() + restList();
      }
      h += "</div></div>";
      if (!st.wide && st.edit && st.tab === "postavke") h += '<div class="ap-scrim on" data-act="close"></div><div class="ap-sheet on" role="dialog" aria-modal="true" aria-labelledby="ed-title"><div class="ap-grip"><i></i></div>' + editorContent(st.edit, true) + "</div>";
      h += sheetHTML();
      return h + "</div>";
    };

    /* ---- crtanje ---- */
    var render = function (focus) {
      var sc = $(".ap-scroll", mount), shb = $(".ap-sh-body", mount), sy = sc ? sc.scrollTop : 0, sby = shb ? shb.scrollTop : 0;
      mount.innerHTML = view();
      var sc2 = $(".ap-scroll", mount); if (sc2) sc2.scrollTop = sy;
      var sb2 = $(".ap-sh-body", mount); if (sb2) sb2.scrollTop = sby;
      if (focus) { var f = $(focus, mount); if (f) f.focus({ preventScroll: true }); }
    };
    var live = function () {
      if (!st.edit) return;
      var e = st.edit, er = validate(e.kind, e.draft);
      var imp = $('[data-live="impact"]', mount); if (imp) imp.innerHTML = impactHTML(e.draft);
      var cu = $('[data-live="cur"]', mount); if (cu) cu.innerHTML = currencyAlert(e.draft.cur);
      var ex = $('[data-live="explain"]', mount); if (ex) { var tmp = document.createElement("div"); tmp.innerHTML = editorBody(e); var n = $('[data-live="explain"]', tmp); if (n) ex.innerHTML = n.innerHTML; }
      $$("[data-msg]", mount).forEach(function (m) {
        var k = m.getAttribute("data-msg"), t = er[k] || (e.server || {})[k] || "", hint = m.getAttribute("data-hint") || "";
        var input = $('input[data-k="' + k + '"]', mount);
        m.className = "ap-sf-m" + (t ? " is-bad" : "");
        m.innerHTML = t ? ic("bad", 16) + "<span>" + esc(t) + "</span>" : (hint ? "<span>" + esc(hint) + "</span>" : "");
        if (input) { input.setAttribute("aria-invalid", t ? "true" : "false"); input.parentNode.className = "ap-sf-in" + (t ? " is-bad" : ""); }
      });
      var btn = $('[data-act="save"]', mount); if (btn) btn.disabled = !isDirty() || !!Object.keys(er).length || st.saving;
    };
    var attemptClose = function (after) {
      if (st.edit && isDirty()) { st.ask = { after: after }; render('[data-act="keep"]'); return false; }
      return true;
    };
    var closeEdit = function () { st.edit = null; st.ask = null; };
    var doSave = function () {
      var e = st.edit; if (!e) return;
      var er = validate(e.kind, e.draft); if (Object.keys(er).length) { live(); return; }
      st.saving = true; e.alert = ""; render();
      setTimeout(function () {
        var d = e.draft;
        if (opts.failSave) { st.saving = false; e.alert = "Server nije prihvatio izmjenu. Provjeri označeno polje."; e.server = opts.failSave; render(); return; }
        if (e.kind === "limit") { S.limitOn = d.limitOn; if (d.limitOn) { S.limit = Number(String(d.limit).replace(",", ".")); S.enf = d.enf; } }
        else if (e.kind === "handover") S.handover = d.handover || "";
        else if (e.kind === "payout") S.payout = d.payout === "other" ? Number(d.payoutOther) : d.payout;
        else if (e.kind === "mode") { S.mode = d.mode; if (d.mode === "TOP_N") S.count = Number(d.count); if (d.mode !== "ALL") { S.timeout = Number(d.timeout); S.tAction = d.tAction; } }
        else if (e.kind === "pool") S.pool = d.pool;
        else if (e.kind === "price") S.brk = d.brk;
        else if (e.kind === "currency") S.cur = d.cur;
        st.saving = false; st.saved = e.kind;
        var kind = e.kind;
        if (st.wide) { st.edit = { kind: kind, draft: openDraft(kind), orig: null, server: {}, alert: "", touched: {} }; st.edit.orig = JSON.stringify(st.edit.draft); }
        else st.edit = null;
        render(); toast("Postavka je sačuvana."); setTimeout(function () { st.saved = null; var f = $(".is-flash", mount); if (f) f.classList.remove("is-flash"); }, 1600);
      }, 450);
    };

    /* ---- događaji ---- */
    mount.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-act]"); if (!el || !mount.contains(el)) return;
      var a = el.getAttribute("data-act");
      if (a === "choice") {
        var k = el.getAttribute("data-k"), v = el.getAttribute("data-v"), e = st.edit;
        if (e && k in e.draft) { e.draft[k] = (k === "payout" && v !== "other") ? Number(v) : v; if (k === "payout" && v === "other" && !e.draft.payoutOther) e.draft.payoutOther = ""; if (k === "mode" && v !== "ALL" && !e.draft.timeout) e.draft.timeout = "20"; e.server = {}; render('[data-k="' + k + '"][data-v="' + v + '"]'); }
        return;
      }
      if (a === "toggle") return; // obrađuje change
      if (a === "tab") { if (!attemptClose("tab:" + el.getAttribute("data-v"))) return; st.tab = el.getAttribute("data-v"); closeEdit(); st.sel = st.tab === "restorani" ? st.sel : null; if (st.tab === "postavke" && st.wide && !st.edit) beginEdit("limit"); render(); return; }
      if (a === "row") {
        var kind = el.getAttribute("data-kind");
        if (st.edit && st.edit.kind !== kind && isDirty()) { st.ask = { after: "row:" + kind }; render('[data-act="keep"]'); return; }
        beginEdit(kind); render(); var t = $("#ed-title", mount); if (t) { t.setAttribute("tabindex", "-1"); t.focus({ preventScroll: true }); } return;
      }
      if (a === "close") { if (!attemptClose()) return; closeEdit(); render(); return; }
      if (a === "keep") { st.ask = null; render(); return; }
      if (a === "drop") {
        var after = st.ask && st.ask.after; st.ask = null; st.edit = null;
        if (after && String(after).indexOf("row:") === 0) beginEdit(String(after).slice(4));
        else if (after && String(after).indexOf("tab:") === 0) { st.tab = String(after).slice(4); if (st.tab === "postavke" && st.wide) beginEdit("limit"); }
        render(); return;
      }
      if (a === "save") { ev.preventDefault(); doSave(); return; }
      if (a === "clearhand") { st.edit.draft.handover = ""; render("#e-hand"); return; }
      if (a === "filter") { st.rf = el.getAttribute("data-v"); st.page = 1; render(); return; }
      if (a === "resetf") { st.rf = "all"; st.q = ""; st.page = 1; render(); return; }
      if (a === "clearq") { st.q = ""; st.page = 1; render("#rq"); return; }
      if (a === "more") { st.page++; render(); return; }
      if (a === "rest") { st.sel = Number(el.getAttribute("data-id")); render(); return; }
      if (a === "closedt") { st.sel = null; render(); return; }
      if (a === "back") { if (!st.wide && st.tab === "restorani" && st.sel) { st.sel = null; render(); } else toast("Nazad na početnu"); return; }
      if (a === "suspend") { st.sheet = { type: "suspend", id: st.sel, reason: "" }; render(); var ta = $("#s-reason", mount); if (ta) ta.focus(); return; }
      if (a === "activate") { st.sheet = { type: "activate", id: st.sel }; render(); return; }
      if (a === "sheetclose") { st.sheet = null; render(); return; }
      if (a === "qreason") { var v2 = el.getAttribute("data-v"); st.sheet.reason = st.sheet.reason === v2 ? "" : v2; render(); return; }
      if (a === "dosuspend" || a === "doactivate") {
        ev.preventDefault();
        var r = R.filter(function (x) { return x.id === st.sheet.id; })[0];
        if (a === "dosuspend") { r.ar = false; r.reason = (st.sheet.reason || "").trim() || ""; toast("Saradnja je suspendovana."); } else { r.ar = true; r.reason = ""; toast("Saradnja je uključena."); }
        st.sheet = null; render(); return;
      }
      if (a === "retry") { st.error = null; st.loading = true; render(); setTimeout(function () { st.loading = false; render(); }, 700); return; }
      if (a === "copy") { toast("ID kopiran"); return; }
      if (a === "call" || a === "mailto" || a === "map") { ev.preventDefault(); toast(a === "call" ? "Poziv bi se ovdje pokrenuo" : a === "map" ? "Otvara se mapa" : "Otvara se e-pošta"); return; }
    });
    mount.addEventListener("change", function (ev) {
      var el = ev.target; if (el.getAttribute("data-act") === "toggle" && st.edit) { var k = el.getAttribute("data-k"); st.edit.draft[k] = el.checked; if (k === "limitOn" && el.checked && st.edit.draft.limit === "") st.edit.draft.limit = ""; st.edit.server = {}; render('[data-k="' + k + '"]'); }
    });
    mount.addEventListener("input", function (ev) {
      var el = ev.target, k = el.getAttribute && el.getAttribute("data-k"); if (!k) return;
      if (k === "q") { st.q = el.value; st.page = 1; var pos = el.selectionStart; render("#rq"); var i2 = $("#rq", mount); if (i2) try { i2.setSelectionRange(pos, pos); } catch (e) {} return; }
      if (k === "reason" && st.sheet) { st.sheet.reason = el.value; $$(".ap-qchip", mount).forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-v") === st.sheet.reason)); }); return; }
      if (st.edit && k in st.edit.draft) { st.edit.draft[k] = el.value; st.edit.server = {}; live(); }
    });
    mount.addEventListener("submit", function (ev) { ev.preventDefault(); var b = $('[data-act="save"]', mount); if (b && !b.disabled) doSave(); var s = $('[data-act="dosuspend"], [data-act="doactivate"]', mount); if (s) s.click(); });
    mount.addEventListener("keydown", function (ev) {
      var rg = ev.target.closest && ev.target.closest('[role="radiogroup"]');
      if (rg && ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].indexOf(ev.key) > -1) {
        ev.preventDefault();
        var opts2 = $$('[role="radio"]', rg), i = Math.max(0, opts2.indexOf(ev.target.closest('[role="radio"]')));
        var n = ev.key === "Home" ? 0 : ev.key === "End" ? opts2.length - 1 : (i + (ev.key === "ArrowDown" || ev.key === "ArrowRight" ? 1 : -1) + opts2.length) % opts2.length;
        opts2[n].click(); return;
      }
      var tab = ev.target.closest && ev.target.closest('[role="tab"]');
      if (tab && ["ArrowRight", "ArrowLeft", "Home", "End"].indexOf(ev.key) > -1) {
        ev.preventDefault(); var ts = $$('[role="tab"]', mount), j = ts.indexOf(tab), m = ev.key === "Home" ? 0 : ev.key === "End" ? ts.length - 1 : (j + (ev.key === "ArrowRight" ? 1 : -1) + ts.length) % ts.length;
        ts[m].click(); var nt = $('[role="tab"][aria-selected="true"]', mount); if (nt) nt.focus(); return;
      }
      if (ev.key === "Escape") { if (st.sheet) { st.sheet = null; render(); } else if (st.edit && !st.wide) { if (attemptClose()) { closeEdit(); render(); } } }
    });

    /* ---- razmjera: telefon ili računar ---- */
    var apply = function () {
      var w = root.clientWidth, wide = w >= 720;
      if (wide !== st.wide || !mount.firstChild) { st.wide = wide; if (wide && st.tab === "postavke" && !st.edit && !opts.nodefault) beginEdit("limit"); if (!wide && st.edit && !opts.keepedit) st.edit = null; render(); }
    };
    apply();
    if (opts.edit && !st.wide) { beginEdit(opts.edit); render(); }
    if (opts.loading && opts.loadingMs) setTimeout(function () { st.loading = false; render(); }, opts.loadingMs);
    if (window.ResizeObserver && !opts.fixed) new ResizeObserver(function () { apply(); }).observe(root);
    return { st: st, render: render, S: S, R: R, reset: function () { createApp(root, opts); } };
  };

  window.FirmaProto = { create: createApp };
})();
