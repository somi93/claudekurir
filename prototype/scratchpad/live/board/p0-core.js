/* Prototip "Kuriri uživo": jezgro (ljuska stranice, podaci i osvježavanje, zamjenski API, izbor, tastatura, listovi, obavještenja). Nije Vue kod: ponašanje i
   tekstovi su izvor za portovanje. Svaki dio (p1 karta, p2 panel, p3 listovi) je fabrika (ctx) => {...} registrovana u window.LVParts. */
(function () {
  "use strict";
  const LV = window.LV, LVW = window.LVW, ICONS = window.LV_ICONS;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ""}"/></svg>`;
  const parts = (window.LVParts = window.LVParts || {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Utorak 6. oktobar 2026, 14:20 (+02:00): sat je zaključan da brojke u tekstu table ostanu iste pri svakom otvaranju
  const NOW = Date.parse("2026-10-06T12:20:00.000Z");
  const CID = 24;
  // isto kao dispatcherNavItems u aplikaciji (app/utils/navigation.ts)
  const NAV = [
    ["map-marker-radius-outline", "Kuriri uživo", "Pregled i mapa"], ["account-group-outline", "Kuriri", "Lista kurira firme - dodaj, izmeni, suspenduj"], ["account-search-outline", "Dodela narudžbi", "Predlog i slanje ponude kuriru"],
    ["cash-register", "Finansije", "Predaje, stanje kurira, isplate i promet"], ["calendar-clock-outline", "Raspored i zone", "Zone, smjene i popunjenost"], ["cash-multiple", "Cjenovnik", "Cijene, doplate, pravila za vozila"],
    ["domain", "Firma", "Finansijske postavke i saradnja sa restoranima"], ["bell-outline", "Poruke", "Poruka kuriru, grupi ili svima, i ko ju je pročitao"],
  ];

  function createApp(root, opts = {}) {
    const W = LVW.buildLiveWorld({ now: new Date(NOW), n: opts.n || 26 });
    const st = {
      wide: opts.wide !== false,
      tab: opts.tab || "k", q: opts.q || "", live: "all", flags: [], sort: "live", shown: 12,
      selId: opts.sel ? Number(opts.sel) : null, selOrd: opts.ord ? Number(opts.ord) : null, ogroup: opts.ogroup || "all", oq: "",
      layers: { zones: true, orders: true, labels: true }, follow: false, full: false, legend: false, menu: false, snap: opts.snap || "peek",
      sheet: null, opener: null, clockShift: 0, attAll: false, pollMs: opts.pollMs || 15000, ordersMs: opts.ordersMs || 30000, slowMs: opts.slowMs || 60000,
    };
    if (opts.filter) { const p = LV.parseQuery("?f=" + opts.filter); st.live = p.live; st.flags = p.flags; }
    if (opts.layers) { st.layers = { zones: opts.layers.includes("z"), orders: opts.layers.includes("n"), labels: opts.layers.includes("i") }; }
    W.clock = () => NOW + st.clockShift;
    const nowMs = () => NOW + st.clockShift;

    const log = [], fails = [];
    let delay = opts.delay == null ? 40 : opts.delay;
    let destroyed = false;
    const timers = new Set();

    root.innerHTML = "";
    const el = document.createElement("div");
    el.className = "lv" + (st.wide ? " lv-wide" : "");
    el.innerHTML = `<aside class="lv-side" aria-hidden="true"></aside>
      <header class="lv-bar"><button type="button" class="lv-ib" aria-label="Otvori meni">${ic("menu", 24)}</button><b>Ordera</b><small>Dispečer</small></header>
      <div class="lv-page"><header class="lv-head" id="lv-head"></header><section class="lv-strip" id="lv-strip" aria-label="Stanje kurira i šta traži pažnju"></section>
        <div class="lv-work" id="lv-work"><div class="lv-mapwrap" id="lv-mapwrap"></div><aside class="lv-panel lv-card" id="lv-panel" aria-label="Kuriri i narudžbe"></aside></div></div>
      <div class="lv-layer" id="lv-layer"></div><div class="lv-toast" role="status" hidden></div>`;
    root.appendChild(el);
    const $ = (s) => el.querySelector(s);
    const headEl = $("#lv-head"), stripEl = $("#lv-strip"), panelEl = $("#lv-panel"), workEl = $("#lv-work"), mapwrap = $("#lv-mapwrap"), layer = $("#lv-layer"), toastEl = $(".lv-toast");

    /* ---------- zamjenski server: svaki poziv se broji, neuspjeh se može namjestiti ---------- */
    const api = async (method, path, body) => {
      const entry = { method, path, body: body == null ? null : JSON.parse(JSON.stringify(body)), t: Date.now(), hidden: document.hidden };
      log.push(entry);
      await sleep(delay);
      const i = fails.findIndex((f) => f.re.test(`${method} ${path}`) && f.times !== 0);
      if (i >= 0) { if (fails[i].times > 0) fails[i].times--; entry.failed = true; throw Object.assign(new Error(fails[i].message || "Server ne odgovara."), { status: fails[i].status || 500 }); }
      const [pth, search = ""] = path.split("?");
      let out;
      let m;
      if (method === "POST" && (m = pth.match(/^\/couriers\/(\d+)\/inbox$/))) out = [200, { success: true, data: { id: 1, courier_id: Number(m[1]), ...body, sent_at: new Date(nowMs()).toISOString(), read: false } }];
      else out = LVW.serveLive(W, { pth, method, body, q: new URLSearchParams(search) });
      if (!out) throw Object.assign(new Error("Nepoznata ruta."), { status: 404 });
      const [code, data] = out;
      if (code >= 400) { entry.failed = true; throw Object.assign(new Error((data && data.message) || "Greška."), { status: code, data }); }
      return JSON.parse(JSON.stringify(data));
    };
    const failNext = (re, times = 1, message, status) => fails.push({ re, times, message, status });
    const clearFails = () => { fails.length = 0; };

    /* ---------- obavještenje ---------- */
    let toastT = null;
    const toast = (msg, o = {}) => {
      toastEl.className = "lv-toast" + (o.err ? " lv-toast--err" : "");
      toastEl.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button type="button" data-act="toast-act">${esc(o.action.label)}</button>` : ""}`;
      toastEl.hidden = false;
      toastEl._act = o.action ? o.action.run : null;
      clearTimeout(toastT);
      toastT = setTimeout(() => { toastEl.hidden = true; }, o.ms || 3600);
    };

    const ctx = { LV, LVW, esc, ic, W, st, log, api, failNext, clearFails, toast, el, sleep, nowMs, acts: {}, sheets: {}, timers, opts, root: el, mapwrap, panelEl };
    ctx.setTimeout = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms); timers.add(t); return t; };

    /* ---------- podaci: svaki izvor posebno, pad jednog ne ruši ostale ---------- */
    const src = () => ({ v: null, state: "idle", failed: false, at: null, err: "", busy: false });
    const D = { rows: src(), locs: src(), bal: src(), orders: src(), zones: src(), hand: src(), settings: src() };
    ctx.D = D;
    const base = `/dispatcher/delivery-companies/${CID}`;
    const FETCH = {
      rows: async () => (await api("GET", `${base}/couriers-status`)).data,
      locs: async () => (await api("GET", `${base}/courier-locations`)).data,
      bal: async () => (await api("GET", `${base}/couriers-balance`)).data,
      settings: async () => (await api("GET", `${base}/finance-settings`)).data,
      zones: async () => (await api("GET", "/dispatcher/zones")).data,
      hand: async () => (await api("GET", `${base}/cash-handovers/pending`)).data,
      orders: async () => {
        const q = `?delivery_company_id=${CID}`;
        const [w, a, p] = await Promise.all([api("GET", "/dispatcher/orders/waiting" + q), api("GET", "/dispatcher/orders/active-deliveries" + q), api("GET", "/dispatcher/orders/pending-restaurant-confirmation" + q + "&days_back=7&days_forward=7")]);
        return { w: w.data.map(LVW.mapWaitingOrderDto), a: a.data.map(LVW.mapActiveDeliveryDto), p: p.data.map(LVW.mapPendingRestaurantOrderDto) };
      },
    };
    const load = async (name) => {
      const s = D[name];
      if (s.busy || destroyed) return;
      s.busy = true;
      if (s.v == null) s.state = "loading";
      if (name === "locs" || name === "rows" || name === "orders") ctx.busyChanged && ctx.busyChanged();
      try {
        const v = await FETCH[name]();
        if (destroyed) return;
        s.v = v; s.state = "ok"; s.failed = false; s.err = ""; s.at = Date.now();
        if (name === "locs" && ctx.onLocs) ctx.onLocs();
      } catch (e) {
        if (destroyed) return;
        s.failed = true; s.err = e.message;
        if (s.v == null) s.state = "error";
      } finally {
        s.busy = false;
      }
      if (!destroyed) ctx.dataChanged();
    };
    ctx.load = load;

    /* ---------- izvedeno: sve se računa iz izvora ---------- */
    let V = { cs: [], counts: null, orders: null, att: null, byId: new Map(), liveKnown: false, state: "loading", pageState: "loading", limit: null, currency: "KM" };
    const derive = () => {
      const now = nowMs();
      const limit = D.settings.v ? D.settings.v.cash_limit_amount : null;
      const roster = LVW.buildRoster(D.rows.v || [], { locations: D.locs.v, balances: D.bal.v });
      const cs = LV.decorate(roster, { now, active: D.orders.v ? D.orders.v.a : [], cashLimit: limit });
      const counts = LV.courierCounts(cs, now);
      const orders = D.orders.v ? LV.normalizeOrders({ waiting: D.orders.v.w, active: D.orders.v.a, pending: D.orders.v.p }) : null;
      const att = LV.buildAttention({ couriers: cs, orders, handovers: D.hand.v ? D.hand.v.length : null, now });
      const pageState = D.rows.v == null ? (D.rows.state === "error" ? "error" : "loading") : D.rows.v.length === 0 ? "empty" : "ready";
      V = { cs, counts, orders, att, byId: new Map(cs.map((c) => [c.id, c])), oById: new Map((orders || []).map((o) => [o.id, o])), liveKnown: D.locs.v != null, pageState, limit, currency: (D.settings.v && D.settings.v.currency) || "KM", now };
      ctx.V = V;
    };
    ctx.derive = derive;
    derive();

    /* ---------- osvježavanje: samo dok je tab vidljiv, odmah po povratku ---------- */
    const stamp = { locs: 0, orders: 0, slow: 0 };
    const tick = () => {
      if (destroyed) return;
      if (document.hidden) return;
      // okviri stanja na tabli rade samo dok su blizu ekrana (opts.lazy); glavni prototip uvijek
      if (opts.lazy) { const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < -innerHeight || r.top > innerHeight * 2) return; }
      const t = Date.now();
      if (D.rows.v != null) {
        if (t - stamp.locs >= st.pollMs) { stamp.locs = t; W.move(st.pollMs / 1000); void load("locs"); }
        if (t - stamp.orders >= st.ordersMs) { stamp.orders = t; void load("orders"); }
        if (t - stamp.slow >= st.slowMs) { stamp.slow = t; void load("bal"); void load("hand"); }
      }
      derive();
      ctx.renderLight();
    };
    const onVisible = () => { if (!document.hidden) { stamp.locs = stamp.orders = stamp.slow = 0; tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    let tk = null;

    ctx.refreshAll = async () => {
      stamp.locs = stamp.orders = stamp.slow = Date.now();
      ctx.refreshing = true; ctx.renderHead();
      await Promise.all([load("rows"), load("locs"), load("orders"), load("bal"), load("hand"), load("zones"), load("settings")]);
      ctx.refreshing = false; ctx.renderHead();
    };
    ctx.updatedText = () => {
      const a = D.locs.at;
      if (a == null) return "";
      const s = Math.max(0, Math.round((Date.now() - a) / 1000));
      return s < 5 ? "upravo sad" : `pre ${LV.shortAge(s * 1000)}`;
    };

    /* ---------- zaglavlje ---------- */
    let lastHead = "";
    const renderHead = () => {
      const w = st.wide;
      const ready = V.pageState === "ready";
      const upd = ctx.updatedText();
      const sub = ready ? `${LV.subtitle(V.counts, V.liveKnown)}${upd ? ` · osvježeno ${upd}` : ""}` : "";
      const html = `<button type="button" class="lv-ib lv-ib--card bk" data-act="home" data-fk="back" aria-label="Nazad na početnu">${ic("arrow-left", 22)}</button>
        <h1 id="lv-h1" tabindex="-1" data-fk="h1">Kuriri uživo<small aria-live="polite">${esc(sub) || "&nbsp;"}</small></h1><span class="sp"></span>
        <div class="acts"><a class="lv-btn" href="#" data-act="goto" data-arg="Kuriri" data-fk="list">${ic("account-group-outline", 20)}<span class="t">Lista kurira</span></a>
        <button type="button" class="lv-btn lv-btn--pri" data-act="refresh" data-fk="refresh" ${ctx.refreshing ? 'aria-busy="true"' : ""} aria-label="Osvježi podatke">${ic("refresh", 20)}<span class="t">${ctx.refreshing ? "Osvježavam…" : "Osvježi"}</span></button></div>`;
      if (html === lastHead) return;
      lastHead = html;
      const fk = focusKeyIn(headEl);
      headEl.innerHTML = html;
      restoreFocus(headEl, fk);
    };
    ctx.renderHead = renderHead;

    const focusKeyIn = (box) => { const ae = document.activeElement; const f = ae && box.contains(ae) && ae.closest ? ae.closest("[data-fk]") : null; return f ? { k: f.getAttribute("data-fk"), caret: ae.matches && ae.matches("input") ? ae.selectionStart : null } : null; };
    const restoreFocus = (box, fk) => { if (!fk) return; const f = box.querySelector(`[data-fk="${CSS.escape(fk.k)}"]`); if (f) { f.focus({ preventScroll: true }); if (fk.caret != null && f.setSelectionRange) try { f.setSelectionRange(fk.caret, fk.caret); } catch (e) {} } };
    ctx.focusKeyIn = focusKeyIn; ctx.restoreFocus = restoreFocus;

    /* ---------- traka: pločice stanja + oznake pažnje ---------- */
    let lastStrip = "";
    const renderStrip = () => {
      if (V.pageState !== "ready") { const h = ""; if (h !== lastStrip) { lastStrip = h; stripEl.innerHTML = h; } return; }
      const c = V.counts, a = V.att.counts, known = V.liveKnown;
      const tiles = [["all", "Svi", "#0b1220", "#f5f6f8", "#0b1220"], ["delivering", "U dostavi", "#2f6fed", "#eef4ff", "#2459c7"], ["online", "Slobodni", "#00b37e", "#e3f8ef", "#00734f"], ["offline", "Offline", "#9aa4b2", "#eceff3", "#5b6676"]];
      const tileHtml = tiles.map(([k, label, dot, tint, ink]) => {
        const unk = !known && k !== "all";
        return `<button type="button" class="lv-tile${unk ? " is-unk" : ""}" aria-pressed="${st.live === k || (k === "all" && st.live === "all")}" data-act="tile" data-arg="${k}" data-fk="tile-${k}" style="--dot:${dot};--tint:${tint};--ink2:${ink}"><i></i><span>${label}</span><b>${unk ? "—" : c[k]}</b></button>`;
      }).join("");
      const ago = ctx.updatedText();
      const stale = D.locs.failed;
      const upd = `<span class="lv-upd${stale ? " is-stale" : ""}" data-upd><i></i>${stale ? (ago ? `Pozicije nisu osvježene od ${esc(LV.clock(D.locs.at ? nowMs() - (Date.now() - D.locs.at) : nowMs()))}` : "Pozicije nisu stigle") : `Pozicije ${esc(ago || "…")} · automatski svakih ${Math.round(st.pollMs / 1000)} s`}</span>`;
      const chip = (key, label, n, o = {}) => {
        const unk = n == null;
        if (!unk && n === 0 && !o.on) return "";
        return `<button type="button" class="lv-chip${o.hot ? " is-hot" : ""}" aria-pressed="${Boolean(o.on)}" ${unk || o.disabled ? "disabled" : ""} data-act="chip" data-arg="${key}" data-fk="chip-${key}" style="--dot:${o.dot || "#9aa4b2"}"><i></i>${esc(label)} <em>${unk ? "—" : n}</em></button>`;
      };
      const cchips = LV.FLAG_ORDER.map((k) => chip(k, LV.FLAG_LABELS[k], k === "limit" && D.bal.v == null ? null : c[k], { on: st.flags.includes(k), dot: k === "suspended" ? "#e5484d" : "#e08a14", hot: k === "lost" && c.lost > 0, disabled: !known && k === "lost" })).join("");
      const og = (key, label, n, hot) => chip("o:" + key, label, orders() ? n : null, { on: st.tab === "n" && st.ogroup === key, dot: hot ? "#e5484d" : "#2f6fed", hot });
      const orders = () => V.orders;
      const ochips = [og("late", "Kasne", a.late, a.late > 0), og("wait", "Čeka kurira", a.waiting, a.waitingCritical > 0), og("rest", "Čeka restoran", a.restaurant, a.restaurantCritical > 0)].join("");
      const hand = a.handovers == null ? "" : a.handovers > 0 ? `<a class="lv-chip is-hot" href="#" data-act="goto" data-arg="Finansije" data-fk="chip-hand" style="--dot:#e5484d"><i></i>Predaje čekaju <em>${a.handovers}</em>${ic("chevron-right", 16)}</a>` : "";
      const clear = st.live !== "all" || st.flags.length || st.q ? `<button type="button" class="lv-clear" data-act="clear" data-fk="clear">Očisti filtere</button>` : "";
      const html = `<div class="lv-trow"><div class="lv-tiles" role="group" aria-label="Stanje kurira">${tileHtml}</div>${upd}</div>
        <div class="lv-chips" role="group" aria-label="Šta traži pažnju">${cchips}${cchips && ochips.trim() ? `<span class="lv-sep" aria-hidden="true"></span>` : ""}${ochips}${(cchips || ochips.trim()) && hand ? `<span class="lv-sep" aria-hidden="true"></span>` : ""}${hand}${clear}</div>`;
      if (html === lastStrip) return;
      lastStrip = html;
      const fk = focusKeyIn(stripEl);
      stripEl.innerHTML = html;
      restoreFocus(stripEl, fk);
    };
    ctx.renderStrip = renderStrip;

    /* ---------- crtanje: panel i karta; "light" samo osvježava tekstove koji stare ---------- */
    ctx.renderPanel = () => parts_.panel && parts_.panel.render();
    const renderAll = () => {
      if (destroyed) return;
      derive();
      renderHead(); renderStrip(); ctx.renderPanel();
      if (parts_.map) parts_.map.update();
      el.classList.toggle("lv-full", st.full);
      panelEl.setAttribute("data-snap", st.snap); workEl.setAttribute("data-snap", st.snap);
    };
    ctx.render = renderAll;
    ctx.renderLight = () => { renderHead(); renderStrip(); ctx.renderPanel(); if (parts_.map) parts_.map.update(); };
    ctx.dataChanged = () => { renderAll(); };

    /* ---------- izbor ---------- */
    ctx.selectCourier = (id, o = {}) => {
      st.selId = id; st.selOrd = null; st.follow = false; st.tab = "k";
      if (!st.wide) st.snap = "half";
      if (st.full) st.full = false;
      renderAll();
      if (parts_.map && !o.noFly) parts_.map.flyToCourier(id);
      if (parts_.panel) parts_.panel.revealSelected();
    };
    ctx.selectOrder = (id, o = {}) => {
      st.selOrd = id; st.selId = null; st.tab = "n"; st.follow = false;
      if (!st.wide) st.snap = "half";
      if (st.full) st.full = false;
      renderAll();
      if (parts_.map && !o.noFly) parts_.map.flyToOrder(id);
      if (parts_.panel) parts_.panel.revealSelected();
    };
    ctx.clearSelection = () => { st.selId = null; st.selOrd = null; st.follow = false; renderAll(); };

    /* ---------- listovi (AppSheet) ---------- */
    const sheetHtml = () => {
      const sh = st.sheet;
      if (!sh) return "";
      const def = ctx.sheets[sh.type];
      const dirty = def.dirty ? def.dirty(sh) : false;
      const discard = sh.discard ? `<div class="lv-tint" role="alert">${ic("alert-outline", 22)}<div><b>Imaš nesačuvan unos</b>Ako zatvoriš, unos se gubi.</div></div><div class="lv-sh-foot" style="border:0;padding:0"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button type="button" class="lv-btn" data-act="sheet-keep" data-discard="keep">Nastavi unos</button><button type="button" class="lv-btn" data-act="sheet-drop" data-discard="drop">Odbaci unos</button></div></div>` : "";
      const foot = def.foot ? def.foot(sh) : "";
      return `<div class="lv-scrim" data-act="scrim"><div class="lv-sheet" role="dialog" aria-modal="true" aria-label="${esc(def.title(sh))}" tabindex="-1" id="lv-sheet" data-dirty="${dirty}">
        <div class="lv-grip" aria-hidden="true"><i></i></div>
        <header class="lv-sh-head"><div><h2>${esc(def.title(sh))}</h2>${def.sub ? `<p>${esc(def.sub(sh))}</p>` : ""}</div><button type="button" class="lv-ib lv-ib--soft lv-sh-x" aria-label="Zatvori" data-act="sheet-close">${ic("close", 20)}</button></header>
        <div class="lv-sh-body" id="lv-sh-body">${discard}${def.body(sh)}</div>
        ${foot ? `<div class="lv-sh-foot" id="lv-sh-foot">${foot}</div>` : ""}</div></div>`;
    };
    const renderSheet = () => {
      const oldBody = layer.querySelector("#lv-sh-body");
      const keep = oldBody ? oldBody.scrollTop : 0;
      const fk = focusKeyIn(layer);
      layer.innerHTML = sheetHtml();
      const sh = st.sheet;
      if (sh) {
        const nb = layer.querySelector("#lv-sh-body"); if (nb) nb.scrollTop = keep;
        const def = ctx.sheets[sh.type]; if (def.bind) def.bind(sh, layer);
        restoreFocus(layer, fk);
      }
    };
    ctx.renderSheet = renderSheet;
    ctx.refreshSheet = () => {
      const sh = st.sheet; if (!sh) return;
      const def = ctx.sheets[sh.type];
      const foot = layer.querySelector("#lv-sh-foot");
      const fk = foot ? focusKeyIn(foot) : null;
      if (foot && def.foot) foot.innerHTML = def.foot(sh);
      if (fk && foot) restoreFocus(foot, fk);
      const box = layer.querySelector("#lv-sheet"); if (box) box.setAttribute("data-dirty", String(def.dirty ? def.dirty(sh) : false));
    };
    ctx.openSheet = (sh, opener) => {
      st.opener = opener || (document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute("data-fk") || document.activeElement : null);
      st.sheet = Object.assign({ discard: false }, sh);
      renderSheet();
      const first = layer.querySelector("[data-autofocus]") || layer.querySelector("#lv-sh-body input:not([type=hidden])") || layer.querySelector(".lv-sh-x");
      if (first) first.focus({ preventScroll: true });
    };
    ctx.closeSheet = (force) => {
      const sh = st.sheet; if (!sh) return;
      const def = ctx.sheets[sh.type];
      if (def.locked && def.locked(sh)) return;
      if (!force && def.dirty && def.dirty(sh) && !sh.discard) { sh.discard = true; renderSheet(); const k = layer.querySelector('[data-discard="keep"]'); if (k) k.focus(); return; }
      const op = st.opener; st.sheet = null; st.opener = null; layer.innerHTML = "";
      let f = op ? (typeof op === "string" ? el.querySelector(`[data-fk="${CSS.escape(op)}"]`) : op) : null;
      if (!f || !el.contains(f)) f = el.querySelector("#lv-h1");
      if (f && f.focus) f.focus({ preventScroll: true });
    };

    /* ---------- radnje ---------- */
    const A = ctx.acts;
    A["sheet-close"] = () => ctx.closeSheet();
    A["sheet-keep"] = () => { st.sheet.discard = false; renderSheet(); const i = layer.querySelector("#lv-sh-body input,#lv-sh-body textarea"); if (i) i.focus(); };
    A["sheet-drop"] = () => ctx.closeSheet(true);
    A.scrim = (arg, ev) => { if (ev.target.classList.contains("lv-scrim")) ctx.closeSheet(); };
    A["toast-act"] = () => { const f = toastEl._act; toastEl.hidden = true; if (f) f(); };
    A.home = () => toast("U aplikaciji: nazad na početnu stranicu.");
    A.goto = (arg, ev) => { if (ev) ev.preventDefault(); toast(`U aplikaciji: otvara se stranica „${arg}“.`); };
    A.refresh = () => { if (!ctx.refreshing) void ctx.refreshAll(); };
    A.retry = () => { void ctx.refreshAll(); };
    A.tile = (k) => { st.live = k === "all" || st.live === k ? "all" : k; st.shown = 12; st.tab = "k"; if (!st.wide && st.snap === "peek") st.snap = "half"; renderAll(); };
    A.chip = (k) => {
      if (k.startsWith("o:")) { const g = k.slice(2); const same = st.tab === "n" && st.ogroup === g; st.tab = "n"; st.ogroup = same ? "all" : g; if (!st.wide && st.snap === "peek") st.snap = "half"; renderAll(); return; }
      st.tab = "k"; st.shown = 12;
      st.flags = st.flags.includes(k) ? st.flags.filter((x) => x !== k) : [...st.flags, k];
      if (!st.wide && st.snap === "peek") st.snap = "half";
      renderAll();
    };
    A.clear = () => { st.live = "all"; st.flags = []; st.q = ""; st.oq = ""; st.ogroup = "all"; st.shown = 12; renderAll(); };
    A.snap = (arg) => { st.snap = arg === "next" ? (st.snap === "peek" ? "half" : st.snap === "half" ? "full" : "peek") : arg; renderAll(); };

    const onClick = (ev) => {
      const tel = ev.target.closest && ev.target.closest('a[href^="tel:"]');
      if (tel && el.contains(tel)) { ev.preventDefault(); toast(`U aplikaciji se otvara poziv: ${decodeURIComponent(tel.getAttribute("href").slice(4))}`); return; }
      const t = ev.target.closest("[data-act]");
      if (!t || !el.contains(t)) return;
      const act = ctx.acts[t.getAttribute("data-act")];
      if (act) { if (t.tagName !== "A" || t.getAttribute("href") === "#") ev.stopPropagation(); act(t.getAttribute("data-arg"), ev, t); }
    };
    el.addEventListener("click", onClick);

    const typingIn = (t) => t instanceof HTMLElement && (t.matches("input,textarea,select") || t.isContentEditable);
    const onKey = (ev) => {
      if (ev.defaultPrevented) return;
      const sh = st.sheet;
      if (sh) {
        if (ev.key === "Escape") { ev.preventDefault(); ctx.closeSheet(); return; }
        if (ev.key === "Tab") {
          const box = layer.querySelector("#lv-sheet"); if (!box) return;
          const f = [...box.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type=hidden]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x.getClientRects().length);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && (document.activeElement === first || document.activeElement === box)) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
        if (ev.key === "Enter" && ev.target.matches("input") && ev.target.closest("#lv-sheet")) { const def = ctx.sheets[sh.type]; if (def.submit) { ev.preventDefault(); def.submit(sh); } }
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "/" && !typingIn(ev.target)) { ev.preventDefault(); if (!st.wide && st.snap === "peek") { st.snap = "half"; renderAll(); } parts_.panel && parts_.panel.focusSearch(); return; }
      if (ev.key === "Escape" && !typingIn(ev.target)) {
        if (st.menu || st.legend) { st.menu = false; st.legend = false; parts_.map && parts_.map.update(); return; }
        if (st.selId != null || st.selOrd != null) { const id = st.selId != null ? `row:${st.selId}` : `ord:${st.selOrd}`; ctx.clearSelection(); const f = el.querySelector(`[data-fk="${CSS.escape(id)}"]`); if (f) f.focus({ preventScroll: true }); return; }
      }
      Object.values(parts_).forEach((p) => p.onKey && p.onKey(ev));
    };
    el.addEventListener("keydown", onKey);
    const markActive = () => { window.__lvActive = el; };
    el.addEventListener("pointerdown", markActive); el.addEventListener("focusin", markActive);
    const onDocKey = (ev) => {
      if (window.__lvActive !== el || el.contains(document.activeElement)) return;
      if (st.sheet) { if (ev.key === "Escape") { ev.preventDefault(); ctx.closeSheet(); } return; }
      if (ev.key === "/" && !typingIn(ev.target)) { ev.preventDefault(); parts_.panel && parts_.panel.focusSearch(); }
      else if (ev.key === "Escape" && (st.selId != null || st.selOrd != null)) ctx.clearSelection();
    };
    document.addEventListener("keydown", onDocKey);
    el.addEventListener("input", (ev) => {
      const sh = st.sheet;
      if (sh && ev.target.closest("#lv-sheet")) { const def = ctx.sheets[sh.type]; if (def.input) def.input(sh, ev); if (sh.discard) { sh.discard = false; renderSheet(); } return; }
      Object.values(parts_).forEach((p) => p.onInput && p.onInput(ev));
    });
    el.addEventListener("change", (ev) => {
      const sh = st.sheet;
      if (sh && ev.target.closest("#lv-sheet")) return;
      Object.values(parts_).forEach((p) => p.onChange && p.onChange(ev));
    });

    /* ---------- ljuska: meni na računaru ---------- */
    const side = $(".lv-side");
    if (st.wide) {
      const pend = () => (V.att && V.att.counts.handovers) || 0;
      ctx.renderSide = () => {
        const p = pend();
        side.innerHTML = `<div class="brand">Ordera<small>Dispečer</small></div><div class="co"><span>Dostavna firma</span><b>${esc(W.company.name)}</b></div><div class="nv">${NAV.map(([i, t, s]) => `<div class="${t === "Kuriri uživo" ? "on" : ""}">${ic(i, 22)}<span>${esc(t)}<small>${esc(s)}</small></span>${t === "Finansije" && p > 0 ? `<span class="nb">${p}</span>` : ""}</div>`).join("")}</div>`;
      };
      ctx.renderSide();
    }

    /* ---------- dijelovi ---------- */
    const parts_ = {};
    for (const name of Object.keys(parts)) parts_[name] = parts[name](ctx);
    ctx.parts = parts_;
    renderAll();
    Object.values(parts_).forEach((p) => p.start && p.start());

    // prvo učitavanje: firma, pa svaki izvor posebno; namješteni padovi za prikaz stanja
    const boot = async () => {
      if (opts.fail) opts.fail.split(",").forEach((k) => ({ locs: /courier-locations/, rows: /couriers-status/, orders: /orders\//, bal: /couriers-balance/, hand: /cash-handovers/ }[k]) && failNext(({ locs: /courier-locations/, rows: /couriers-status/, orders: /orders\//, bal: /couriers-balance/, hand: /cash-handovers/ })[k], 999));
      if (opts.empty === "fleet") W.couriers.length = 0;
      if (opts.empty === "nopos") W.locations = () => [];
      stamp.locs = stamp.orders = stamp.slow = Date.now();
      await Promise.all([load("rows"), load("locs"), load("orders"), load("bal"), load("hand"), load("zones"), load("settings")]);
      if (destroyed) return;
      ctx.booted = true;
      if (ctx.onBooted) ctx.onBooted();
      tk = setInterval(tick, opts.tickMs || (opts.lazy ? 3000 : 1000));
      if (opts.sel || opts.ord) {
        if (opts.sel) ctx.selectCourier(Number(opts.sel));
        else ctx.selectOrder(Number(opts.ord));
      }
      ctx.ready = true;
    };
    void boot();

    const api2 = {
      el, root, st, world: W, log, ctx, nowMs,
      render: renderAll, failNext, clearFails, load,
      setDelay: (ms) => { delay = ms; },
      shiftClock(ms) { st.clockShift += ms; renderAll(); },
      destroy() { destroyed = true; clearInterval(tk); timers.forEach(clearTimeout); document.removeEventListener("visibilitychange", onVisible); document.removeEventListener("keydown", onDocKey); el.removeEventListener("click", onClick); Object.values(parts_).forEach((p) => p.destroy && p.destroy()); root.innerHTML = ""; },
    };
    return api2;
  }

  window.LVApp = { create: createApp, esc, ic, sleep, NOW };
})();
