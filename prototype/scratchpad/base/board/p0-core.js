/* Prototip "Finansije": jezgro (ljuska stranice, pilule, listovi, obavještenja, zamjenski API, osvježavanje). Nije Vue kod: ponašanje i tekstovi su izvor za portovanje.
   Svaki dio (p1..p3) je fabrika (ctx) => {...} registrovana u window.FCParts. Jedna instanca = jedan createApp(). */
(function () {
  "use strict";
  const FC = window.FC, FCW = window.FCW, ICONS = window.FC_ICONS;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ""}"/></svg>`;
  const parts = (window.FCParts = window.FCParts || {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));
  const TABS = [
    { key: "stanje", label: "Stanje" },
    { key: "promet", label: "Promet" },
  ];
  // isto kao dispatcherNavItems u aplikaciji (app/utils/navigation.ts)
  const NAV = [
    ["map-marker-radius-outline", "Kuriri uživo", "Pregled i mapa"], ["account-group-outline", "Kuriri", "Lista kurira firme - dodaj, izmeni, suspenduj"], ["account-search-outline", "Dodela narudžbi", "Predlog i slanje ponude kuriru"],
    ["cash-register", "Finansije", "Predaje, stanje kurira, isplate i promet"], ["calendar-clock-outline", "Raspored i zone", "Zone, smjene i popunjenost"], ["cash-multiple", "Cjenovnik", "Cijene, doplate, pravila za vozila"],
    ["domain", "Firma", "Finansijske postavke i saradnja sa restoranima"], ["bell-outline", "Poruke", "Poruka kuriru, grupi ili svima, i ko ju je pročitao"],
  ];

  function createApp(root, opts = {}) {
    const W = FCW.build(opts.world || {});
    const st = {
      tab: opts.tab || "stanje", wide: opts.wide !== false, sheet: null, opener: null, clockShift: 0,
      sel: null, q: "", filter: FC.parseFilter(opts.filter), sort: FC.parseSort(opts.sort), shown: 12,
      pollMs: opts.pollMs || 30000, slowMs: opts.slowMs || 60000,
    };
    const log = [];
    const fails = [];
    let delay = opts.delay == null ? 35 : opts.delay;
    let destroyed = false;
    const timers = new Set();

    root.innerHTML = "";
    const el = document.createElement("div");
    el.className = "fc" + (st.wide ? " fc-wide" : "");
    el.innerHTML = '<div class="fc-main"></div><div class="fc-layer"></div><div class="fc-toast" role="status" hidden></div>';
    root.appendChild(el);
    const main = el.querySelector(".fc-main"), layer = el.querySelector(".fc-layer"), toastEl = el.querySelector(".fc-toast");

    /* ---------- zamjenski server: svaki poziv se broji, neuspjeh se može namjestiti ---------- */
    W.F.clock = () => new Date(FCW.NOW + st.clockShift);
    const nowMs = () => FCW.NOW + st.clockShift;
    const api = async (method, path, body) => {
      const entry = { method, path, body: body == null ? null : JSON.parse(JSON.stringify(body)), t: Date.now() };
      log.push(entry);
      await sleep(delay);
      const i = fails.findIndex((f) => f.re.test(`${method} ${path}`) && f.times !== 0);
      if (i >= 0) { if (fails[i].times > 0) fails[i].times--; entry.failed = true; throw Object.assign(new Error(fails[i].message || "Server ne odgovara."), { status: fails[i].status || 500 }); }
      const [pth, search = ""] = path.split("?");
      let out;
      if (/\/finance-settings$/.test(pth)) out = [200, { success: true, data: W.settings }];
      else if (/\/couriers-status$/.test(pth)) out = [200, { success: true, data: W.couriers }];
      else out = FCW.serveFinance(W.F, { pth, method, body, q: new URLSearchParams(search) });
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
      toastEl.className = "fc-toast" + (o.err ? " fc-toast--err" : "");
      toastEl.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button type="button" data-act="toast-act">${esc(o.action.label)}</button>` : ""}`;
      toastEl.hidden = false;
      toastEl._act = o.action ? o.action.run : null;
      clearTimeout(toastT);
      toastT = setTimeout(() => { toastEl.hidden = true; }, o.ms || 3600);
    };

    const ctx = { FC, FCW, esc, ic, W, st, log, api, failNext, clearFails, toast, el, sleep, uuid, nowMs, acts: {}, sheets: {}, timers, opts, cur: W.company.currency };
    ctx.setTimeout = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms); timers.add(t); return t; };
    ctx.money = (v) => FC.money(v, ctx.cur);

    /* ---------- ljuska ---------- */
    const shellHtml = () => {
      const w = st.wide;
      const pend = ctx.pendingCount ? ctx.pendingCount() : 0;
      const side = w
        ? `<aside class="fc-side" aria-hidden="true"><div class="brand">Ordera<small>Dispečer</small></div><div class="co"><span>Dostavna firma</span><b>${esc(W.company.name)}</b></div><div class="nv">${NAV.map(([i, t, s]) => `<div class="${t === "Finansije" ? "on" : ""}">${ic(i, 22)}<span>${esc(t)}<small>${esc(s)}</small></span>${t === "Finansije" && pend > 0 ? `<span class="nb">${pend}</span>` : ""}</div>`).join("")}</div></aside>`
        : `<header class="fc-bar"><button type="button" class="fc-ib" aria-label="Otvori meni">${ic("menu", 24)}</button><b>Ordera</b><small>Dispečer</small></header>`;
      const detailPage = !w && st.tab === "stanje" && st.sel != null;
      const sel = detailPage ? (ctx.bookRow ? ctx.bookRow(st.sel) : null) : null;
      const pendTab = pend > 0 ? `<span class="fc-badge fc-badge--bad" aria-hidden="true">${pend}</span><span class="sr">${pend} ${FC.plural(pend, "predaja čeka", "predaje čekaju", "predaja čeka")} potvrdu</span>` : "";
      const tabs = TABS.map((t) => `<button type="button" role="tab" class="fc-tab" id="fc-tab-${t.key}" aria-selected="${st.tab === t.key}" aria-controls="fc-panel" tabindex="${st.tab === t.key ? 0 : -1}" data-act="tab" data-arg="${t.key}" data-fk="tab-${t.key}">${esc(t.label)}${t.key === "stanje" ? pendTab : ""}</button>`).join("");
      const part = parts_[st.tab];
      const upd = ctx.updatedText ? ctx.updatedText() : "";
      const sub = detailPage ? (sel ? `#${sel.id}` : "") : `${esc(W.company.name)} · ${esc(ctx.cur)}`;
      const title = detailPage ? (sel ? esc(sel.name) : "Kurir") : "Finansije";
      const acts = detailPage ? "" : `<div class="acts"><button type="button" class="fc-ib ${w ? "fc-ib--soft" : "fc-ib--soft"}" data-act="refresh" data-fk="refresh" aria-label="Osvježi podatke" title="Osvježi">${ic("refresh", 22)}</button></div>`;
      return `${side}<div class="fc-scroll" id="fc-sc"><div class="fc-page">
        <header class="fc-head"><button type="button" class="fc-ib fc-ib--card bk" data-act="${detailPage ? "back" : "home"}" data-fk="back" aria-label="${detailPage ? "Nazad na listu kurira" : "Nazad na početnu"}">${ic("arrow-left", 22)}</button><h1 id="fc-h1" tabindex="-1" data-fk="h1">${title}<small>${sub}</small></h1><span class="sp"></span>${acts}</header>
        <div class="fc-body">
          ${detailPage ? "" : `<div class="fc-tabrow"><div class="fc-tabs" role="tablist" aria-label="Sekcije finansija" data-fk="tabs">${tabs}</div><span class="fc-upd" data-upd>${upd ? esc(upd) : ""}</span></div>`}
          <div id="fc-panel" role="tabpanel" aria-labelledby="fc-tab-${st.tab}" style="display:grid;gap:16px;min-width:0">${part ? part.view() : ""}</div>
        </div></div></div>`;
    };

    let scrollEl = null, focusAfter = null;
    const render = () => {
      if (destroyed) return;
      const keep = scrollEl ? scrollEl.scrollTop : 0;
      const oldDet = main.querySelector(".fc-det");
      const keepDet = oldDet ? oldDet.scrollTop : 0;
      const ae = document.activeElement;
      const fkEl = ae && el.contains(ae) && ae.closest ? ae.closest("[data-fk]") : null;
      const fk = fkEl ? fkEl.getAttribute("data-fk") : null;
      const caret = ae && ae.matches && ae.matches("input.fc-q-input") ? ae.selectionStart : null;
      main.innerHTML = shellHtml();
      el.style.setProperty("--fc-h", (root.clientHeight || 900) + "px");
      scrollEl = main.querySelector(".fc-scroll");
      if (scrollEl) scrollEl.scrollTop = keep;
      const nd = main.querySelector(".fc-det");
      if (nd) nd.scrollTop = keepDet;
      const target = focusAfter || fk;
      focusAfter = null;
      if (target && !st.sheet) {
        const f = el.querySelector(`[data-fk="${CSS.escape(target)}"]`);
        if (f) { f.focus({ preventScroll: true }); if (caret != null && f.setSelectionRange) try { f.setSelectionRange(caret, caret); } catch (e) {} }
      }
      Object.values(parts_).forEach((p) => p.afterRender && p.afterRender());
    };
    ctx.render = render;
    ctx.focusKey = (k) => { focusAfter = k; };

    /* ---------- listovi (AppSheet) ---------- */
    const sheetHtml = () => {
      const sh = st.sheet;
      if (!sh) return "";
      const def = ctx.sheets[sh.type];
      const dirty = def.dirty ? def.dirty(sh) : false;
      const discard = sh.discard
        ? `<div class="fc-tint" role="alert">${ic("alert-outline", 22)}<div><b>Imaš nesačuvan unos</b>Ako zatvoriš, unos se gubi.</div></div><div class="fc-sh-foot" style="border:0;padding:0"><div class="two"><button type="button" class="fc-btn" data-act="sheet-keep" data-discard="keep">Nastavi unos</button><button type="button" class="fc-btn" data-act="sheet-drop" data-discard="drop">Odbaci unos</button></div></div>`
        : "";
      const foot = def.foot ? def.foot(sh) : "";
      return `<div class="fc-scrim" data-act="scrim"><div class="fc-sheet" role="dialog" aria-modal="true" aria-label="${esc(def.label ? def.label(sh) : def.title(sh))}" tabindex="-1" id="fc-sheet" data-dirty="${dirty}">
        <div class="fc-grip" aria-hidden="true"><i></i></div>
        <header class="fc-sh-head"><div><h2>${esc(def.title(sh))}</h2>${def.sub ? `<p>${esc(def.sub(sh))}</p>` : ""}</div><button type="button" class="fc-ib fc-ib--soft fc-sh-x" aria-label="Zatvori" data-act="sheet-close">${ic("close", 20)}</button></header>
        <div class="fc-sh-body" id="fc-sh-body">${discard}${def.body(sh)}</div>
        ${foot ? `<div class="fc-sh-foot" id="fc-sh-foot">${foot}</div>` : ""}
      </div></div>`;
    };
    const renderSheet = () => {
      const oldBody = layer.querySelector("#fc-sh-body");
      const keep = oldBody ? oldBody.scrollTop : 0;
      const ae = document.activeElement;
      const fkEl = ae && layer.contains(ae) && ae.closest ? ae.closest("[data-fk]") : null;
      const fk = fkEl ? fkEl.getAttribute("data-fk") : null;
      layer.innerHTML = sheetHtml();
      const sh = st.sheet;
      if (sh) {
        const def = ctx.sheets[sh.type];
        const nb = layer.querySelector("#fc-sh-body"); if (nb) nb.scrollTop = keep;
        if (def.bind) def.bind(sh, layer);
        if (fk) { const f = layer.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (f) f.focus({ preventScroll: true }); }
      }
    };
    ctx.renderSheet = renderSheet;
    // Samo podnožje i dijelovi sa data-bind (da se ne gubi fokus u polju koje se kuca).
    ctx.refreshSheet = () => {
      const sh = st.sheet; if (!sh) return;
      const def = ctx.sheets[sh.type];
      const foot = layer.querySelector("#fc-sh-foot");
      const ae = document.activeElement;
      const fkEl = ae && foot && foot.contains(ae) && ae.closest ? ae.closest("[data-fk]") : null;
      const fk = fkEl ? fkEl.getAttribute("data-fk") : null;
      if (foot && def.foot) foot.innerHTML = def.foot(sh);
      if (fk) { const f = foot.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (f) f.focus({ preventScroll: true }); }
      if (def.update) def.update(sh, layer);
      if (!layer.contains(document.activeElement)) { const box0 = layer.querySelector("#fc-sheet"); if (box0) box0.focus({ preventScroll: true }); }
      const box = layer.querySelector("#fc-sheet"); if (box) box.setAttribute("data-dirty", String(def.dirty ? def.dirty(sh) : false));
    };
    ctx.openSheet = (sh, opener) => {
      st.opener = opener || (document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute("data-fk") || document.activeElement : null);
      st.sheet = Object.assign({ discard: false }, sh);
      renderSheet();
      const box = layer.querySelector("#fc-sheet");
      const first = layer.querySelector("[data-autofocus]") || layer.querySelector("#fc-sh-body input:not([type=hidden]):not([disabled]):not([readonly]):not([type=checkbox])") || layer.querySelector(".fc-sh-x");
      if (first) { first.focus({ preventScroll: true }); if (first.select && first.hasAttribute("data-select")) first.select(); }
      else if (box) box.focus({ preventScroll: true });
    };
    ctx.closeSheet = (force) => {
      const sh = st.sheet; if (!sh) return;
      const def = ctx.sheets[sh.type];
      if (def.locked && def.locked(sh)) { toast("Isplata je u toku. Sačekaj da se završi."); return; }
      if (!force && def.dirty && def.dirty(sh) && !sh.discard) { sh.discard = true; renderSheet(); const k = layer.querySelector('[data-discard="keep"]'); if (k) k.focus(); return; }
      const op = st.opener; st.sheet = null; st.opener = null; layer.innerHTML = "";
      if (sh.onClose) sh.onClose();
      // opener može nestati poslije radnje (npr. red predaje): fokus tada ide na prvi bliski element
      let f = op ? (typeof op === "string" ? el.querySelector(`[data-fk="${CSS.escape(op)}"]`) : op) : null;
      if (!f || !el.contains(f)) f = el.querySelector("#fc-h1") || el.querySelector(".fc-scroll");
      if (f && f.focus) f.focus({ preventScroll: true });
    };

    /* ---------- događaji ---------- */
    ctx.acts.tab = (key) => { st.tab = key; ctx.focusKey("tab-" + key); render(); if (parts_[key] && parts_[key].onShow) parts_[key].onShow(); };
    ctx.acts["sheet-close"] = () => ctx.closeSheet();
    ctx.acts["sheet-keep"] = () => { st.sheet.discard = false; renderSheet(); const i = layer.querySelector("#fc-sh-body input"); if (i) i.focus(); };
    ctx.acts["sheet-drop"] = () => ctx.closeSheet(true);
    ctx.acts.scrim = (arg, ev) => { if (ev.target.classList.contains("fc-scrim")) ctx.closeSheet(); };
    ctx.acts["toast-act"] = () => { const f = toastEl._act; toastEl.hidden = true; if (f) f(); };
    ctx.acts.home = () => toast("U aplikaciji: nazad na početnu stranicu.");

    const onClick = (ev) => {
      const t = ev.target.closest("[data-act]");
      if (!t || !el.contains(t)) return;
      const act = ctx.acts[t.getAttribute("data-act")];
      if (act) { ev.stopPropagation(); act(t.getAttribute("data-arg"), ev, t); }
    };
    el.addEventListener("click", onClick);

    const onKey = (ev) => {
      const sh = st.sheet;
      if (sh) {
        if (ev.key === "Escape") { ev.preventDefault(); ctx.closeSheet(); return; }
        if (ev.key === "Tab") {
          const box = layer.querySelector("#fc-sheet"); if (!box) return;
          const f = [...box.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x.getClientRects().length);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && (document.activeElement === first || document.activeElement === box)) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
        if (ev.key === "Enter" && ev.target.matches("input:not([type=checkbox]):not([type=range])") && ev.target.closest("#fc-sheet")) {
          const def = ctx.sheets[sh.type];
          if (def.submit) { ev.preventDefault(); def.submit(sh); }
        }
        return;
      }
      const tab = ev.target.closest('[role="tab"]');
      if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) {
        ev.preventDefault();
        const i = TABS.findIndex((x) => x.key === st.tab);
        const n = ev.key === "Home" ? 0 : ev.key === "End" ? TABS.length - 1 : (i + (ev.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
        ctx.acts.tab(TABS[n].key);
        const t2 = main.querySelector(`#fc-tab-${TABS[n].key}`); if (t2) t2.focus({ preventScroll: true });
        return;
      }
      Object.values(parts_).forEach((p) => p.onKey && p.onKey(ev));
    };
    el.addEventListener("keydown", onKey);
    const markActive = () => { window.__fcActive = el; };
    el.addEventListener("pointerdown", markActive); el.addEventListener("focusin", markActive);
    // Tipke dok fokus nije u stranici (npr. dugme je upravo nestalo): Esc zatvara list, "/" i Esc rade kao na stranici Kuriri.
    const onDocKey = (ev) => {
      if (window.__fcActive !== el || el.contains(document.activeElement)) return;
      if (st.sheet) { if (ev.key === "Escape") { ev.preventDefault(); ctx.closeSheet(); } return; }
      Object.values(parts_).forEach((p) => p.onKey && p.onKey(ev));
    };
    document.addEventListener("keydown", onDocKey);
    el.addEventListener("input", (ev) => {
      const sh = st.sheet;
      if (sh && ev.target.closest("#fc-sheet")) { const def = ctx.sheets[sh.type]; if (def.input) def.input(sh, ev); if (sh.discard) { sh.discard = false; renderSheet(); } return; }
      Object.values(parts_).forEach((p) => p.onInput && p.onInput(ev));
    });
    el.addEventListener("change", (ev) => {
      const sh = st.sheet;
      if (sh && ev.target.closest("#fc-sheet")) { const def = ctx.sheets[sh.type]; if (def.change) def.change(sh, ev); return; }
      Object.values(parts_).forEach((p) => p.onChange && p.onChange(ev));
    });

    /* ---------- dijelovi ---------- */
    const parts_ = {};
    for (const name of Object.keys(parts)) parts_[name] = parts[name](ctx);
    ctx.parts = parts_;
    ctx.render();
    Object.values(parts_).forEach((p) => p.start && p.start());

    const api2 = {
      el, root, st, world: W, log, ctx, nowMs,
      render, failNext, clearFails,
      setDelay: (ms) => { delay = ms; },
      setWide(w) { st.wide = w; el.classList.toggle("fc-wide", w); render(); renderSheet(); },
      go(tab) { st.tab = tab; render(); if (parts_[tab] && parts_[tab].onShow) parts_[tab].onShow(); },
      destroy() { destroyed = true; timers.forEach(clearTimeout); el.removeEventListener("click", onClick); document.removeEventListener("keydown", onDocKey); root.innerHTML = ""; },
    };
    return api2;
  }

  window.FCApp = { create: createApp, esc, ic, sleep, uuid };
})();
