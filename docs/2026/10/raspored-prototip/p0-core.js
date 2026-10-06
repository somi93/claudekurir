/* Prototip "Raspored i zone": jezgro (ljuska stranice, pilule, listovi, obavještenja, zamjenski API). Nije Vue kod: ponašanje i tekstovi su izvor za portovanje.
   Svaki dio (p1..p4) je fabrika (ctx) => {...} registrovana u window.SCParts. Jedna instanca = jedan createApp(). */
(function () {
  "use strict";
  const SC = window.SC, SCW = window.SCW, ICONS = window.SC_ICONS;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ic = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ""}"/></svg>`;
  const parts = (window.SCParts = window.SCParts || {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const TABS = [
    { key: "schedule", label: "Raspored", q: null },
    { key: "now", label: "Sada", q: "sada" },
    { key: "zones", label: "Zone", q: "zone" },
    { key: "rules", label: "Pravila", q: "pravila" },
  ];

  function createApp(root, opts = {}) {
    const world = SCW.build();
    if (opts.farCity) {
      // zone firme iz drugog grada (Sarajevo): mapa mora da pokaže zone, ne Banju Luku
      const dLat = 43.8563 - 44.7725, dLng = 18.4131 - 17.1925;
      world.zones.forEach((z) => { if (z.lat != null) { z.lat += dLat; z.lng += dLng; } });
      world.company.city = "Sarajevo";
    }
    if (opts.noCity) { world.company.cityId = null; world.company.city = null; }
    const now = SC.nowOf(SCW.NOW);
    const st = {
      tab: opts.tab || "schedule", wide: opts.wide !== false, sheet: null, toast: null, opener: null,
      load: Object.assign({ schedule: "ok", now: "ok", zones: "ok", rules: "ok" }, opts.load || {}),
    };
    const log = [];
    const fails = [];
    let delay = opts.delay == null ? 35 : opts.delay;
    let destroyed = false;
    const timers = new Set();

    root.innerHTML = "";
    const el = document.createElement("div");
    el.className = "sx" + (st.wide ? " sx-wide" : "");
    el.innerHTML = '<div class="sx-main"></div><div class="sx-layer"></div><div class="sx-toast" role="status" hidden></div>';
    root.appendChild(el);
    const main = el.querySelector(".sx-main"), layer = el.querySelector(".sx-layer"), toastEl = el.querySelector(".sx-toast");

    /* ---------- zamjenski server: svaki poziv se broji, neuspjeh se može namjestiti ---------- */
    const api = async (method, path, body) => {
      const entry = { method, path, body: body == null ? null : JSON.parse(JSON.stringify(body)), t: Date.now() };
      log.push(entry);
      await sleep(delay);
      const i = fails.findIndex((f) => f.re.test(`${method} ${path}`) && f.times !== 0);
      if (i >= 0) { if (fails[i].times > 0) fails[i].times--; entry.failed = true; throw Object.assign(new Error(fails[i].message || "Server ne odgovara."), { status: fails[i].status || 500 }); }
      return { ok: true };
    };
    const failNext = (re, times = 1, message, status) => fails.push({ re, times, message, status });
    const clearFails = () => { fails.length = 0; };

    /* ---------- obavještenje ---------- */
    let toastT = null;
    const toast = (msg, o = {}) => {
      toastEl.className = "sx-toast" + (o.err ? " sx-toast--err" : "");
      toastEl.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button type="button" data-act="toast-act">${esc(o.action.label)}</button>` : ""}`;
      toastEl.hidden = false;
      toastEl._act = o.action ? o.action.run : null;
      clearTimeout(toastT);
      toastT = setTimeout(() => { toastEl.hidden = true; }, o.ms || 3400);
    };

    /* ---------- ctx koji dijele dijelovi ---------- */
    const ctx = { SC, esc, ic, world, now, st, log, api, failNext, clearFails, toast, el, sleep, acts: {}, sheets: {}, S: {}, timers, opts };
    ctx.zone = (id) => world.zones.find((z) => z.id === id) || { id, name: `Zona #${id}` };
    ctx.clock = () => SC.fmtTime(now.min);
    ctx.setTimeout = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms); timers.add(t); return t; };

    /* ---------- ljuska ---------- */
    // isto kao dispatcherNavItems u aplikaciji (app/utils/navigation.ts)
    const NAV = [
      ["map-marker-radius-outline", "Kuriri uživo", "Pregled i mapa"], ["account-group-outline", "Kuriri", "Lista kurira firme - dodaj, izmeni, suspenduj"], ["account-search-outline", "Dodela narudžbi", "Predlog i slanje ponude kuriru"],
      ["cash-register", "Finansije", "Kase kurira - predaje, balansi, isplate"], ["calendar-clock-outline", "Raspored i zone", "Zone, smjene i popunjenost"], ["cash-multiple", "Cjenovnik", "Cijene, doplate, pravila za vozila"],
      ["domain", "Firma", "Finansijske postavke i saradnja sa restoranima"], ["bell-outline", "Poruke", "Poruka kuriru, grupi ili svima, i ko ju je pročitao"],
    ];
    const shellHtml = () => {
      const w = st.wide;
      const side = w
        ? `<aside class="sx-side" aria-hidden="true"><div class="brand">Ordera<small>Dispečer</small></div><div class="co"><span>Dostavna firma</span><b>${esc(world.company.name)}</b></div><div class="nv">${NAV.map(([i, t, s]) => `<div class="${t === "Raspored i zone" ? "on" : ""}">${ic(i, 22)}<span>${esc(t)}<small>${esc(s)}</small></span></div>`).join("")}</div></aside>`
        : `<header class="sx-bar"><button type="button" class="sx-ib" aria-label="Otvori meni">${ic("menu", 24)}</button><b>Ordera</b><small>Dispečer</small></header>`;
      const prob = ctx.problemBadge ? ctx.problemBadge() : 0;
      const tabs = TABS.map((t) => {
        const badge = t.key === "schedule" ? (prob > 0 ? `<span class="sx-badge sx-badge--bad" aria-hidden="true">${prob}</span><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${prob} smjena ispod minimuma</span>` : "") : t.key === "zones" ? `<span class="sx-badge" aria-hidden="true">${world.zones.length}</span>` : "";
        return `<button type="button" role="tab" class="sx-tab" id="sx-tab-${t.key}" aria-selected="${st.tab === t.key}" aria-controls="sx-panel" tabindex="${st.tab === t.key ? 0 : -1}" data-act="tab" data-arg="${t.key}">${esc(t.label)}${badge}</button>`;
      }).join("");
      const city = world.company.cityId == null ? "" : world.company.city;
      const part = parts_[st.tab];
      return `${side}<div class="sx-scroll" id="sx-sc"><div class="sx-page">
        <header class="sx-head"><span class="bk" aria-hidden="true">${ic("arrow-left", 22)}</span><h1>Raspored i zone<small>${esc(world.company.name)}${city ? " · " + esc(city) : ""}</small></h1></header>
        <div class="sx-body">
          ${ctx.cityAlert ? ctx.cityAlert() : ""}
          <div class="sx-tabs" role="tablist" aria-label="Sekcije rasporeda" data-fk="tabs">${tabs}</div>
          <div id="sx-panel" role="tabpanel" aria-labelledby="sx-tab-${st.tab}" style="display:grid;gap:16px;min-width:0">${part ? part.view() : ""}</div>
        </div></div></div>`;
    };

    let scrollEl = null, focusAfter = null;
    const render = () => {
      if (destroyed) return;
      const keep = scrollEl ? scrollEl.scrollTop : 0;
      const ae = document.activeElement;
      const fkEl = ae && el.contains(ae) && ae.closest ? ae.closest("[data-fk]") : null;
      const fk = fkEl ? fkEl.getAttribute("data-fk") : null;
      main.innerHTML = shellHtml();
      scrollEl = main.querySelector(".sx-scroll");
      if (scrollEl) scrollEl.scrollTop = keep;
      const target = focusAfter || fk;
      focusAfter = null;
      if (target && !st.sheet) { const f = el.querySelector(`[data-fk="${CSS.escape(target)}"]`); if (f) f.focus({ preventScroll: true }); }
      Object.values(parts_).forEach((p) => p.afterRender && p.afterRender());
    };
    ctx.render = render;
    ctx.focusKey = (k) => { focusAfter = k; };
    ctx.scrollTo = (sel) => { const t = el.querySelector(sel); if (t && scrollEl) { const r = t.getBoundingClientRect(), s = scrollEl.getBoundingClientRect(); scrollEl.scrollTop += r.top - s.top - 140; } };

    /* ---------- listovi (AppSheet) ---------- */
    // st.sheet = { type, ...stanje lista }. Dio koji vlasništvo nad listom daje: ctx.sheets[type] = { title, sub, body, foot, dirty, bind, label }.
    const sheetHtml = () => {
      const sh = st.sheet;
      if (!sh) return "";
      const def = ctx.sheets[sh.type];
      const dirty = def.dirty ? def.dirty(sh) : false;
      const discard = sh.discard
        ? `<div class="sx-tint" role="alert"><svg class="ic" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS["alert-outline"]}"/></svg><div><b>Imaš nesačuvane izmjene</b>Ako zatvoriš, izmjene se gube.</div></div><div class="sx-sh-foot" style="border:0;padding:0"><button type="button" class="sx-btn" data-act="sheet-keep" data-discard="keep">Nastavi uređivanje</button><button type="button" class="sx-btn" data-act="sheet-drop" data-discard="drop">Odbaci izmjene</button></div>`
        : "";
      const foot = def.foot ? def.foot(sh) : "";
      return `<div class="sx-scrim" data-act="scrim"><div class="sx-sheet" role="dialog" aria-modal="true" aria-label="${esc(def.label ? def.label(sh) : def.title(sh))}" tabindex="-1" id="sx-sheet" data-dirty="${dirty}">
        <div class="sx-grip" aria-hidden="true"><i></i></div>
        <header class="sx-sh-head"><div><h2>${esc(def.title(sh))}</h2>${def.sub ? `<p>${esc(def.sub(sh))}</p>` : ""}</div><button type="button" class="sx-ib sx-ib--soft sx-sh-x" aria-label="Zatvori" data-act="sheet-close">${ic("close", 20)}</button></header>
        <div class="sx-sh-body" id="sx-sh-body">${discard}${def.body(sh)}</div>
        ${foot ? `<div class="sx-sh-foot" id="sx-sh-foot">${foot}</div>` : ""}
      </div></div>`;
    };
    const renderSheet = () => {
      const oldBody = layer.querySelector("#sx-sh-body");
      const keep = oldBody ? oldBody.scrollTop : 0;
      const ae = document.activeElement;
      const fkEl = ae && layer.contains(ae) && ae.closest ? ae.closest("[data-fk]") : null;
      const fk = fkEl ? fkEl.getAttribute("data-fk") : null;
      layer.innerHTML = sheetHtml();
      const sh = st.sheet;
      if (sh) {
        const def = ctx.sheets[sh.type];
        const nb = layer.querySelector("#sx-sh-body"); if (nb) nb.scrollTop = keep;
        if (def.bind) def.bind(sh, layer);
        if (fk) { const f = layer.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (f) f.focus({ preventScroll: true }); }
      }
    };
    ctx.renderSheet = renderSheet;
    // Samo podnožje i dijelovi sa data-bind (da se ne gubi fokus u polju koje se kuca).
    ctx.refreshSheet = () => {
      const sh = st.sheet; if (!sh) return;
      const def = ctx.sheets[sh.type];
      const foot = layer.querySelector("#sx-sh-foot");
      const ae = document.activeElement;
      const fkEl = ae && foot && foot.contains(ae) && ae.closest ? ae.closest("[data-fk]") : null;
      const fk = fkEl ? fkEl.getAttribute("data-fk") : null;
      if (foot && def.foot) foot.innerHTML = def.foot(sh);
      if (fk) { const f = foot.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (f) f.focus({ preventScroll: true }); }
      if (def.update) def.update(sh, layer);
      // fokus ne smije da ostane na tijelu stranice: tada Esc i Tab ne stižu do lista
      if (!layer.contains(document.activeElement)) { const box0 = layer.querySelector("#sx-sheet"); if (box0) box0.focus({ preventScroll: true }); }
      const box = layer.querySelector("#sx-sheet"); if (box) box.setAttribute("data-dirty", String(def.dirty ? def.dirty(sh) : false));
    };
    ctx.openSheet = (sh, opener) => {
      st.opener = opener || (document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute("data-fk") || document.activeElement : null);
      st.sheet = Object.assign({ discard: false }, sh);
      renderSheet();
      const box = layer.querySelector("#sx-sheet");
      const first = layer.querySelector("[data-autofocus]") || layer.querySelector("#sx-sh-body input:not([type=hidden]):not([disabled]):not([readonly])") || layer.querySelector(".sx-sh-x");
      if (first) first.focus({ preventScroll: true });
      else if (box) box.focus({ preventScroll: true });
    };
    ctx.closeSheet = (force) => {
      const sh = st.sheet; if (!sh) return;
      const def = ctx.sheets[sh.type];
      if (!force && def.dirty && def.dirty(sh) && !sh.discard) { sh.discard = true; renderSheet(); const k = layer.querySelector('[data-discard="keep"]'); if (k) k.focus(); return; }
      const op = st.opener; st.sheet = null; st.opener = null; layer.innerHTML = "";
      if (op) { const f = typeof op === "string" ? el.querySelector(`[data-fk="${CSS.escape(op)}"]`) : op; if (f && f.focus) f.focus({ preventScroll: true }); }
    };

    /* ---------- događaji ---------- */
    ctx.acts.tab = (key) => { st.tab = key; ctx.focusKey("tab-" + key); render(); const t = main.querySelector(`#sx-tab-${key}`); if (t) t.focus({ preventScroll: true }); };
    ctx.acts["sheet-close"] = () => ctx.closeSheet();
    ctx.acts["sheet-keep"] = () => { st.sheet.discard = false; renderSheet(); const i = layer.querySelector("#sx-sh-body input"); if (i) i.focus(); };
    ctx.acts["sheet-drop"] = () => ctx.closeSheet(true);
    ctx.acts.scrim = (arg, ev) => { if (ev.target.classList.contains("sx-scrim")) ctx.closeSheet(); };
    ctx.acts["toast-act"] = () => { const f = toastEl._act; toastEl.hidden = true; if (f) f(); };

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
          const box = layer.querySelector("#sx-sheet"); if (!box) return;
          const f = [...box.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && (document.activeElement === first || document.activeElement === box)) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
        if (ev.key === "Enter" && ev.target.matches("input:not([type=range])") && ev.target.closest("#sx-sheet")) {
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
        return;
      }
      Object.values(parts_).forEach((p) => p.onKey && p.onKey(ev));
    };
    el.addEventListener("keydown", onKey);
    // Esc i Tab u listu moraju da rade i kad je fokus pao na tijelo stranice (npr. dugme koje je upravo nestalo)
    const markActive = () => { window.__sxActive = el; };
    el.addEventListener("pointerdown", markActive); el.addEventListener("focusin", markActive);
    const onDocKey = (ev) => { if (st.sheet && document.activeElement && !el.contains(document.activeElement) && window.__sxActive === el && (ev.key === "Escape")) { ev.preventDefault(); ctx.closeSheet(); } };
    document.addEventListener("keydown", onDocKey);
    el.addEventListener("input", (ev) => { const sh = st.sheet; if (sh && ev.target.closest("#sx-sheet")) { const def = ctx.sheets[sh.type]; if (def.input) def.input(sh, ev); } if (sh && sh.discard) { sh.discard = false; renderSheet(); } else Object.values(parts_).forEach((p) => p.onInput && p.onInput(ev)); });
    el.addEventListener("change", (ev) => { Object.values(parts_).forEach((p) => p.onChange && p.onChange(ev)); });

    /* ---------- dijelovi ---------- */
    const parts_ = {};
    for (const name of Object.keys(parts)) parts_[name] = parts[name](ctx);
    ctx.parts = parts_;

    render();

    const api2 = {
      el, root, st, world, log, ctx, now,
      render, failNext, clearFails,
      setDelay: (ms) => { delay = ms; },
      setWide(w) { st.wide = w; el.classList.toggle("sx-wide", w); render(); renderSheet(); },
      go(tab) { st.tab = tab; render(); },
      destroy() { destroyed = true; timers.forEach(clearTimeout); el.removeEventListener("click", onClick); document.removeEventListener("keydown", onDocKey); root.innerHTML = ""; },
    };
    return api2;
  }

  window.SCApp = { create: createApp, esc, ic, sleep };
})();
