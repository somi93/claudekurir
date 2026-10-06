/* Prototip "Finansije": tab Stanje (pločice, predaje na čekanju, spisak kurira sa novcem, detalj kurira) i čitanje izvora sa osvježavanjem. */
(function () {
  "use strict";
  window.FCParts = window.FCParts || {};
  window.FCParts.stanje = function (ctx) {
    const { FC, esc, ic, st, W } = ctx;
    const CO = "/dispatcher/delivery-companies/24";
    const PATHS = { settings: `${CO}/finance-settings`, status: `${CO}/couriers-status`, balances: `${CO}/couriers-balance`, pending: `${CO}/cash-handovers/pending` };
    const D = {};
    for (const k of Object.keys(PATHS)) D[k] = { state: "loading", v: null, failed: false, err: "", at: null, busy: null };
    let lastOk = null; // stvarno vrijeme zadnjeg uspješnog čitanja novca (za "osvježeno pre ...")
    let memo = { key: null, book: [] };
    const tl = new Map(); // courierId -> { state, items, at }
    const flash = new Set();
    let knownPending = null;
    const copied = { key: null };
    let qShown = 5;

    /* ---------- čitanje ---------- */
    const load = (k) => {
      const s = D[k];
      if (s.busy) return s.busy;
      s.busy = (async () => {
        try {
          const res = await ctx.api("GET", PATHS[k]);
          s.v = res.data; s.state = "ok"; s.failed = false; s.err = ""; s.at = Date.now();
          if (k === "balances" || k === "pending") lastOk = Date.now();
          if (k === "pending") noticeNew();
        } catch (e) {
          s.failed = true; s.err = e.message || "Server ne odgovara.";
          if (s.state !== "ok") s.state = "err";
        } finally { s.busy = null; ctx.render(); }
      })();
      return s.busy;
    };
    const noticeNew = () => {
      const ids = new Set((D.pending.v || []).map((p) => p.id));
      if (knownPending) {
        const fresh = (D.pending.v || []).filter((p) => !knownPending.has(p.id));
        if (fresh.length) {
          fresh.forEach((p) => flash.add(p.id));
          const p = fresh[0];
          const name = FC.toLatin(nameOf(p.courier_id));
          ctx.toast(`Nova predaja: ${name} prijavio ${ctx.money(Number(p.reported_amount))}`, { ms: 5000 });
          ctx.setTimeout(() => { fresh.forEach((x) => flash.delete(x.id)); }, 2200);
        }
      }
      knownPending = ids;
    };
    const nameOf = (id) => {
      const c = (D.status.v || []).find((x) => x.courier_id === id) || (D.balances.v || []).find((x) => x.courier_id === id);
      return (c && c.name) || `Kurir #${id}`;
    };
    ctx.nameOf = nameOf;
    ctx.D = D;
    const refreshAll = () => Promise.all([load("balances"), load("pending"), load("status"), load("settings")]);
    const book = () => {
      const key = [D.balances.v, D.status.v, D.pending.v, D.settings.v].map((x) => (x ? (x.__id || (x.__id = Math.random())) : 0)).join("|");
      if (memo.key !== key) {
        memo = { key, book: FC.buildBook({ balances: D.balances.v || [], couriers: D.status.v || [], pending: D.pending.v || [], limit: limit(), cur: ctx.cur }) };
        memo.byId = new Map(memo.book.map((r) => [r.id, r]));
      }
      return memo;
    };
    const limit = () => (D.settings.v && D.settings.v.cash_limit_amount != null ? Number(D.settings.v.cash_limit_amount) : null);
    ctx.limit = limit;
    ctx.bookRow = (id) => book().byId.get(id) || null;
    ctx.book = () => book().book;
    ctx.pendingCount = () => (D.pending.state === "ok" ? (D.pending.v || []).length : 0);
    ctx.updatedText = () => {
      if (lastOk == null) return "";
      return `osvježeno ${FC.ageText(lastOk, Date.now())}`;
    };
    // posljedica radnje: čita stanje iznova, poništava osvježen vremenski tok kurira i označava red
    ctx.afterAction = async (courierId) => {
      tl.delete(courierId);
      await Promise.all([load("balances"), load("pending")]);
      if (courierId != null) { flash.add("c" + courierId); ctx.setTimeout(() => flash.delete("c" + courierId), 2200); }
      if (st.sel === courierId) loadTimeline(courierId, true);
      ctx.render();
    };

    /* ---------- vremenski tok kurira: 2 zahtjeva (predaje i isplate za zadnjih 30 dana) ---------- */
    const loadTimeline = async (id, force) => {
      const cur = tl.get(id);
      if (!force && cur && (cur.state === "loading" || (cur.state === "ok" && Date.now() - cur.at < 60000))) return;
      tl.set(id, { state: "loading", items: cur ? cur.items : [], at: cur ? cur.at : 0 });
      ctx.render();
      const from = FC.addDaysKey(FC.dayKey(ctx.nowMs()), -30);
      try {
        const [h, p] = await Promise.all([
          ctx.api("GET", `${CO}/cash-handovers?courier_id=${id}&from=${from}`),
          ctx.api("GET", `${CO}/payouts?courier_id=${id}&from=${from}`),
        ]);
        tl.set(id, { state: "ok", items: FC.buildJournal({ handovers: h.data, payouts: p.data, nameOf }), at: Date.now() });
      } catch (e) {
        tl.set(id, { state: "err", items: [], at: 0 });
      }
      ctx.render();
    };

    /* ---------- prikaz ---------- */
    const CAP = (n) => FC.plural(n, "predaja", "predaje", "predaja");
    const kpiHtml = () => {
      const bOk = D.balances.state === "ok", pOk = D.pending.state === "ok";
      const c = FC.counts(book().book, ctx.nowMs());
      const lim = limit();
      const t1 = pOk
        ? (c.pendingN ? { v: `${FC.money(c.pendingSum, "").trim()} <i>${esc(ctx.cur)}</i>`, s: `${c.pendingN} ${CAP(c.pendingN)}<span class="x"> · najstarija <span class="${c.oldestOverdue ? "bad" : ""}">${esc(FC.ageText(c.oldestAt, ctx.nowMs()))}</span></span>` } : { v: "Nema", s: "Sve predaje su potvrđene" })
        : { v: "—", s: '<span class="warn">Nije učitano</span>' };
      const t2 = bOk
        ? { v: `${FC.money(c.sumCash, "").trim()} <i>${esc(ctx.cur)}</i>`, s: `${FC.couriersText(c.debt)}${lim != null && c.over ? ` · <span class="bad">${c.over} preko limita</span>` : ""}${lim != null && c.near ? `<span class="x"> · <span class="warn">${c.near} blizu</span></span>` : ""}` }
        : { v: "—", s: '<span class="warn">Nije učitano</span>' };
      const t3 = bOk ? { v: `${FC.money(c.sumWage, "").trim()} <i>${esc(ctx.cur)}</i>`, s: `${FC.couriersText(c.wage)}` } : { v: "—", s: '<span class="warn">Nije učitano</span>' };
      const tile = (key, label, t, extra = "") => `<div class="fc-kpi${st.filter === key ? " on" : ""}"><button type="button" data-act="kpi" data-arg="${key}" data-fk="kpi-${key}" aria-pressed="${st.filter === key}"><span class="l">${label}</span><span class="v">${t.v}</span><span class="s">${t.s}</span></button>${extra}</div>`;
      return `<div class="fc-kpis" aria-label="Pregled">${tile("pending", "Čeka potvrdu", t1)}${tile("debt", "Duguju firmi", t2)}${tile("wage", "Za isplatu", t3, bOk && c.wage > 0 ? `<button type="button" class="go" data-act="batch" data-fk="batch-kpi">Isplati sve<span class="x"> (${c.wage})</span>${ic("chevron-right", 16)}</button>` : "")}</div>`;
    };

    const errBox = (title, text, act, arg = "") => `<div class="fc-tint fc-tint--bad" role="alert">${ic("cloud-off-outline", 22)}<div><b>${esc(title)}</b>${esc(text)}<div class="act"><button type="button" data-act="${act}" data-arg="${arg}" data-fk="retry-${act}">Pokušaj ponovo</button></div></div></div>`;
    const skel = (n) => Array.from({ length: n }, () => '<div class="fc-sk-row" aria-hidden="true"><i class="fc-skel a"></i><i class="fc-skel b"></i><i class="fc-skel c"></i></div>').join("");

    // Računar: red predaja je u desnom oknu dok nijedan kurir nije izabran (spisak tako počinje odmah ispod pločica); telefon: iznad spiska.
    const queueHtml = (flat) => queueCard().replace('<section class="fc-card fc-q"', flat ? '<section class="fc-q fc-q--flat"' : '<section class="fc-card fc-q"');
    const queueCard = () => {
      const s = D.pending;
      if (s.state === "loading") return `<section class="fc-card fc-q" aria-label="Predaje koje čekaju potvrdu" aria-busy="true"><h2>Čeka potvrdu</h2>${skel(2)}</section>`;
      if (s.state === "err") return `<section class="fc-card fc-q" aria-label="Predaje koje čekaju potvrdu"><h2>Čeka potvrdu</h2><div style="padding:6px 14px 14px">${errBox("Ne mogu da učitam predaje koje čekaju potvrdu", "Ne znam da li ih ima. Pokušaj ponovo prije nego zaključiš da nema.", "retry", "pending")}</div></section>`;
      const items = [];
      for (const r of book().book) for (const p of r.pending) items.push({ p, r });
      items.sort((a, b) => FC.ms(a.p.at) - FC.ms(b.p.at));
      if (!items.length) return `<section class="fc-card fc-q" aria-label="Predaje koje čekaju potvrdu"><h2>Čeka potvrdu</h2><div class="fc-qok">${ic("check-circle-outline", 22)}<span>Nema predaja koje čekaju potvrdu.</span></div></section>`;
      const now = ctx.nowMs();
      const rows = items.slice(0, qShown).map(({ p, r }) => {
        const late = FC.overdue(p.at, now);
        const debt = r.cash > 0 ? `<span>Dug kurira ${esc(ctx.money(r.cash))}</span>` : "";
        return `<div class="fc-qr${flash.has(p.id) ? " flash" : ""}"><span class="fc-av${late ? " fc-av--bad" : ""}" aria-hidden="true">${esc(r.initials)}</span>
          <button type="button" class="tx" data-act="open" data-arg="${r.id}" data-fk="q-${p.id}" aria-label="Otvori kurira ${esc(r.name)}"><b>${esc(r.name)}</b><span>Prijavio <strong>${ctx.money(p.amount)}</strong> · <span class="${late ? "late" : ""}" style="white-space:nowrap">${esc(FC.ageText(p.at, now))}</span></span>${debt}</button>
          <button type="button" class="fc-btn fc-btn--pri fc-btn--sm" data-act="confirm" data-arg="${p.id}" data-fk="confirm-${p.id}" aria-label="Potvrdi predaju: ${esc(r.name)}, ${ctx.money(p.amount)}">Potvrdi</button></div>`;
      }).join("");
      const more = items.length > qShown ? `<div class="fc-qmore"><button type="button" class="fc-btn fc-btn--text fc-btn--sm" data-act="qmore" data-fk="qmore">Prikaži još (${items.length - qShown})</button></div>` : "";
      const stale = s.failed ? `<div style="padding:4px 14px 10px"><div class="fc-tint" role="status">${ic("alert-outline", 22)}<div><b>Osvježavanje nije uspjelo</b>Prikazano je zadnje poznato stanje.<div class="act"><button type="button" data-act="retry" data-arg="pending">Pokušaj ponovo</button></div></div></div></div>` : "";
      return `<section class="fc-card fc-q" aria-label="Predaje koje čekaju potvrdu"><h2>Čeka potvrdu <span class="fc-badge fc-badge--bad">${items.length}</span></h2><p class="sub">Najstarija prva. Potvrdi tek kad primiš novac.</p>${stale}${rows}${more}</section>`;
    };

    const FILTER_LABELS = [["all", "Svi"], ["pending", "Čeka potvrdu"], ["debt", "Duguju"], ["limit", "Limit"], ["wage", "Za isplatu"], ["zero", "Nulti"]];
    const pill = (tone, text) => `<span class="fc-pill fc-pill-${tone}">${esc(text)}</span>`;
    const rowHtml = (r, tabbable) => {
      const tags = [];
      if (r.level === "over") tags.push(pill("bad", "Preko limita")); else if (r.level === "near") tags.push(pill("warn", "Blizu limita"));
      if (r.pending.length) tags.push(pill("blue", `Čeka ${ctx.money(r.pendingSum)}`));
      if (r.suspended) tags.push(pill("idle", "Suspendovan"));
      if (!r.inFirm) tags.push(pill("idle", "Nije u firmi"));
      if (r.cash < 0) tags.push(pill("ok", "Firma duguje gotovinu"));
      const lim = limit();
      const meter = r.cash > 0 && lim != null ? `<span class="fc-m fc-m--${r.level}" role="img" aria-label="${r.pctRaw}% limita gotovine"><i style="width:${r.pct}%"></i></span><span class="t">${r.pctRaw}%</span>` : "";
      const cls = r.level === "over" ? "over" : r.level === "near" ? "near" : r.cash < 0 ? "cr" : r.cash === 0 ? "zero" : "";
      const label = `${r.name}. Gotovina ${ctx.money(r.cash)}, zarada ${ctx.money(r.wage)}.${r.level === "over" ? " Preko limita." : r.level === "near" ? " Blizu limita." : ""}${r.pending.length ? ` Čeka potvrdu ${ctx.money(r.pendingSum)}.` : ""}`;
      return `<li><button type="button" class="fc-row${st.sel === r.id ? " sel" : ""}${flash.has("c" + r.id) ? " flash" : ""}" data-act="open" data-arg="${r.id}" data-fk="row-${r.id}" data-row="${r.id}" tabindex="${tabbable ? 0 : -1}" aria-label="${esc(label)}" ${st.sel === r.id ? 'aria-current="true"' : ""}>
        <span class="fc-av ${r.level === "over" ? "fc-av--bad" : r.level === "near" ? "fc-av--warn" : ""}" aria-hidden="true">${esc(r.initials)}</span>
        <span class="tx"><span class="nm">${esc(r.name)}</span><span class="meta">${meter}${tags.join("")}</span></span>
        <span class="am" aria-hidden="true"><div><small>Gotovina</small><b class="${cls}">${esc(ctx.money(r.cash))}</b></div><div><small>Zarada</small><b class="${r.wage > 0 ? "" : "zero"}">${esc(ctx.money(r.wage))}</b></div></span></button></li>`;
    };
    let lastVisible = [];
    const listHtml = () => {
      const bs = D.balances;
      const c = FC.counts(book().book, ctx.nowMs());
      const pills = FILTER_LABELS.map(([k, t]) => {
        const n = c[k === "all" ? "all" : k];
        const bad = k === "limit" && c.over > 0 ? " fc-fp--bad" : "";
        return `<button type="button" class="fc-fp${bad}" data-act="filter" data-arg="${k}" data-fk="f-${k}" aria-pressed="${st.filter === k}">${esc(t)} <span class="n">${n}</span></button>`;
      }).join("");
      const sortSel = `<label class="fc-sel"><span class="sr">Redoslijed</span><select data-fk="sort" aria-label="Redoslijed">${Object.entries(FC.SORTS).map(([k, t]) => `<option value="${k}"${st.sort === k ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>${ic("chevron-down", 18)}</label>`;
      const toolbar = `<div style="display:grid;gap:10px;padding:0 14px 10px"><div class="fc-fbar fc-fbar--scroll" role="group" aria-label="Filteri">${pills}</div><label class="fc-srch">${ic("magnify", 22)}<input class="fc-q-input" data-fk="q" type="search" value="${esc(st.q)}" placeholder="Ime, telefon ili #ID" aria-label="Pretraži kurire" autocomplete="off" enterkeyhint="search">${st.wide ? "<kbd>/</kbd>" : ""}</label></div>`;
      if (bs.state === "loading") return `<section class="fc-card fc-list" aria-label="Kuriri" aria-busy="true"><div class="fc-lh"><h2>Kuriri</h2></div>${toolbar}${skel(5)}</section>`;
      if (bs.state === "err") return `<section class="fc-card fc-list" aria-label="Kuriri"><div class="fc-lh"><h2>Kuriri</h2></div><div style="padding:4px 14px 14px">${errBox("Ne mogu da učitam stanje kurira", "Server ne odgovara. Brojevi iznad nisu pouzdani dok se ovo ne učita.", "retry", "balances")}</div></section>`;
      const vis = FC.sortBook(FC.filterBook(book().book, { q: st.q, filter: st.filter }), st.sort);
      lastVisible = vis;
      const shown = vis.slice(0, st.shown);
      const tabbableId = shown.some((r) => r.id === st.sel) ? st.sel : shown[0] && shown[0].id;
      const stale = bs.failed ? `<div style="padding:0 14px 10px"><div class="fc-tint" role="status">${ic("alert-outline", 22)}<div><b>Stanje je staro ${esc(ctx.updatedText().replace("osvježeno ", ""))}</b>Osvježavanje nije uspjelo.<div class="act"><button type="button" data-act="retry" data-arg="balances">Pokušaj ponovo</button></div></div></div></div>` : "";
      const noLimit = D.settings.state === "err" ? `<div style="padding:0 14px 10px"><div class="fc-tint" role="status">${ic("information-outline", 22)}<div><b>Limit gotovine nije učitan</b>Oznake limita se ne prikazuju.<div class="act"><button type="button" data-act="retry" data-arg="settings">Pokušaj ponovo</button></div></div></div></div>` : "";
      const rowsHtml = shown.length
        ? `<ul aria-label="Kuriri sa novcem">${shown.map((r) => rowHtml(r, r.id === tabbableId)).join("")}</ul>`
        : `<div class="fc-empty">${ic("magnify", 32)}<b>${st.q ? "Nema kurira za pretragu" : st.filter === "all" ? "Svi kuriri su na nuli" : "Nema kurira u ovom filteru"}</b><span>${st.q ? "Provjeri ime ili broj, ili ukloni filter." : st.filter === "all" ? "Filter „Nulti“ pokazuje kurire bez duga i zarade." : "Izaberi drugi filter."}</span>${st.q || st.filter !== "all" ? `<button type="button" class="fc-btn fc-btn--sm" data-act="reset">Prikaži sve</button>` : ""}</div>`;
      const more = vis.length > st.shown ? `<div class="fc-more"><button type="button" class="fc-btn fc-btn--text fc-btn--sm" data-act="more" data-fk="more">Prikaži još (${Math.min(24, vis.length - st.shown)} od ${vis.length - st.shown})</button></div>` : "";
      const head = `<div class="fc-lh"><h2>Kuriri <small aria-live="polite" style="font-weight:600">${st.q || st.filter !== "all" ? `${vis.length} ${FC.plural(vis.length, "rezultat", "rezultata", "rezultata")}` : FC.couriersText(vis.length)}</small></h2>${st.filter === "wage" && c.wage > 0 ? `<button type="button" class="fc-btn fc-btn--sm" data-act="batch" data-fk="batch-list">${ic("cash-minus", 18)}Isplati sve (${c.wage})</button>` : ""}${sortSel}</div>`;
      return `<section class="fc-card fc-list" aria-label="Kuriri">${head}${toolbar}${stale}${noLimit}${rowsHtml}${more}</section>`;
    };

    /* ---------- detalj ---------- */
    const accHtml = (r) => {
      const lim = limit();
      const over = r.level === "over", near = r.level === "near";
      const cashCls = over ? "over" : near ? "near" : r.cash < 0 ? "cr" : "";
      const cashLab = r.cash > 0 ? "Duguje firmi" : r.cash < 0 ? "Firma duguje kuriru (gotovina)" : "Nema duga";
      const meter = r.cash > 0 && lim != null ? `<span class="fc-m fc-m--lg fc-m--${r.level}" role="img" aria-label="${r.pctRaw}% limita gotovine"><i style="width:${r.pct}%"></i></span><span class="mtxt">${r.pctRaw}% limita od ${esc(ctx.money(lim))}${over ? " · preko limita" : near ? " · blizu limita" : ""}</span>` : lim != null && r.cash <= 0 ? "" : "";
      const now = ctx.nowMs();
      const hands = r.pending.map((p) => { const late = FC.overdue(p.at, now); return `<div class="hand${late ? " late" : ""}"><span><b>Prijavio ${esc(ctx.money(p.amount))}</b><span>${esc(FC.ageText(p.at, now))}${late ? " · kasni" : ""}</span></span><button type="button" class="fc-btn fc-btn--sm" data-act="confirm" data-arg="${p.id}" data-fk="dconfirm-${p.id}" aria-label="Potvrdi predaju od ${esc(ctx.money(p.amount))}">Potvrdi</button></div>`; }).join("");
      const cashBtn = `<button type="button" class="fc-btn ${r.cash > 0 ? "fc-btn--pri" : ""} fc-btn--block" data-act="receipt" data-fk="d-receipt">${ic("cash-plus", 20)}Evidentiraj uplatu</button>`;
      const acct = [r.bank ? ["Žiro račun", r.bank, "bank"] : null, r.iban ? ["IBAN", r.iban, "iban"] : null].filter(Boolean);
      const banks = acct.map(([l, v, k]) => `<div class="fc-bank"><span><small>${l}</small><b>${esc(v)}</b></span><button type="button" class="fc-ib" data-act="copy" data-arg="${k}" data-fk="copy-${k}" aria-label="Kopiraj ${l.toLowerCase()}">${ic(copied.key === k + r.id ? "check" : "content-copy", 20)}</button></div>`).join("");
      const wageBtn = `<button type="button" class="fc-btn ${r.wage > 0 ? "fc-btn--pri" : ""} fc-btn--block" data-act="payout" data-fk="d-payout" ${r.wage > 0 ? "" : "disabled"}>${ic("cash-minus", 20)}Isplati zaradu</button>`;
      return `<div class="fc-accs">
        <section class="fc-acc" aria-label="Gotovina"><header><span class="ico ${over ? "bad" : near ? "warn" : r.cash < 0 ? "ok" : ""}">${ic("cash", 20)}</span><h3>Gotovina</h3></header>
          <div class="num ${cashCls}">${esc(FC.money(Math.abs(r.cash), "").trim())} <i>${esc(ctx.cur)}</i></div><div class="lab">${cashLab}</div>${meter}${hands}${cashBtn}</section>
        <section class="fc-acc" aria-label="Zarada"><header><span class="ico blue">${ic("wallet-outline", 20)}</span><h3>Zarada</h3></header>
          <div class="num">${esc(FC.money(r.wage, "").trim())} <i>${esc(ctx.cur)}</i></div><div class="lab">Firma duguje kuriru</div>
          <div class="note">${r.pay ? esc(r.pay) : r.inFirm ? "Ugovor nije podešen." : "Kurir nije više u firmi."}</div>${banks}${wageBtn}</section></div>`;
    };
    const tlHtml = (r) => {
      const t = tl.get(r.id);
      if (!t || t.state === "loading" && !t.items.length) return `<div class="fc-tl" aria-busy="true">${skel(2)}</div>`;
      if (t.state === "err") return `<div style="padding:0 8px 6px">${errBox("Ne mogu da učitam promet kurira", "Ostatak detalja radi.", "retry", "tl")}</div>`;
      const now = ctx.nowMs();
      const items = t.items.slice(0, 6);
      if (!items.length) return `<div class="fc-tl"><div class="fc-ti"><span class="ico wait">${ic("history", 18)}</span><div><b>Nema prometa u zadnjih 30 dana</b><small>Predaje i isplate se pojavljuju ovdje.</small></div><span></span></div></div>`;
      const li = items.map((x) => {
        if (x.kind === "payout") return `<div class="fc-ti"><span class="ico out">${ic("cash-minus", 18)}</span><div><b>Isplata zarade</b><small>${esc(FC.dateTimeShort(x.at))} · ${esc(x.method === "bankovni transfer" ? "bankovni transfer" : x.method === "gotovina" ? "gotovina" : "način nije upisan")}</small></div><div class="a">${esc(ctx.money(x.amount))}</div></div>`;
        if (x.status !== "confirmed") return `<div class="fc-ti"><span class="ico wait">${ic("timer-sand", 18)}</span><div><b>Predaja čeka potvrdu</b><small>${esc(FC.ageText(x.reportedAt, now))}</small></div><div class="a">${esc(ctx.money(x.reported))}</div></div>`;
        const d = x.diff !== 0 ? `<small class="d" style="color:var(--warn);font-weight:800">prijavljeno ${esc(FC.money(x.reported, "").trim())}</small>` : "";
        return `<div class="fc-ti"><span class="ico in">${ic("cash-plus", 18)}</span><div><b>Predaja potvrđena</b><small>${esc(FC.dateTimeShort(x.at))}${x.by ? " · " + esc(x.by) : ""}</small></div><div class="a">${esc(ctx.money(x.amount))}${d ? `<br>${d}` : ""}</div></div>`;
      }).join("");
      return `<div class="fc-tl">${li}<div class="fc-tlmore"><button type="button" class="fc-btn fc-btn--text fc-btn--sm" data-act="all-journal" data-fk="all-journal">Sve u Prometu</button></div></div>`;
    };
    const detailHtml = (r) => {
      const tags = [];
      if (r.suspended) tags.push(pill("idle", "Suspendovan"));
      if (!r.inFirm) tags.push(pill("idle", "Nije u firmi"));
      const phoneBtn = r.phone ? `<a class="fc-qb" href="tel:${esc(String(r.phone).replace(/[^\d+]/g, ""))}" data-fk="d-call" aria-label="Pozovi ${esc(r.name)}">${ic("phone-outline", 22)}Pozovi</a>` : `<span class="fc-qb" aria-disabled="true" title="Kurir nema upisan telefon">${ic("phone-outline", 22)}Pozovi</span>`;
      const profile = r.inFirm ? `<button type="button" class="fc-qb" data-act="profile" data-fk="d-profile">${ic("account-outline", 22)}Profil</button>` : `<span class="fc-qb" aria-disabled="true" title="Kurir nije više u firmi">${ic("account-outline", 22)}Profil</span>`;
      return `<article class="fc-dt" aria-label="Detalji kurira">
        <header class="fc-dh"><span class="fc-av fc-av--ink" aria-hidden="true">${esc(r.initials)}</span><div><h2 id="fc-dh2" tabindex="-1">${esc(r.name)}</h2><div class="mt"><button type="button" class="fc-id${copied.key === "id" + r.id ? " done" : ""}" data-act="copy" data-arg="id" data-fk="copy-id" aria-label="Kopiraj ID kurira ${r.id}">${copied.key === "id" + r.id ? ic("check", 16) + "Kopirano" : `Kurir #${r.id}${ic("content-copy", 16)}`}</button>${tags.join("")}</div></div>${st.wide ? `<button type="button" class="fc-ib fc-ib--soft" data-act="back" data-fk="d-close" aria-label="Zatvori detalje">${ic("close", 20)}</button>` : "<span></span>"}</header>
        <div class="fc-qa">${phoneBtn}${profile}<button type="button" class="fc-qb" data-act="one-journal" data-fk="d-journal">${ic("history", 22)}Promet</button></div>
        ${accHtml(r)}
        <h3 class="fc-gt">Zadnjih 30 dana</h3>${tlHtml(r)}
      </article>`;
    };
    const noneHtml = () => {
      const c = FC.counts(book().book, ctx.nowMs());
      const att = [];
      if (c.over) att.push(["limit", "", "alert-outline", `${c.over} ${FC.plural(c.over, "kurir je", "kurira su", "kurira je")} preko limita`, "Gotovina koju nose je iznad dozvoljene"]);
      if (c.wage) att.push(["wage", "", "wallet-outline", `${FC.couriersText(c.wage)} čeka isplatu`, `Ukupno ${ctx.money(c.sumWage)}`]);
      const ok = D.balances.state === "ok";
      const hint = `<div class="fc-dnone">${ic("account-cash-outline", 30)}<b>Izaberi kurira</b><p>Gotovina, zarada, uplata, isplata i zadnji promet jednog kurira. Strelice mijenjaju izbor, Enter otvara, <kbd>/</kbd> traži.</p></div>`;
      return `${queueHtml(true)}${ok && att.length ? `<h3 class="fc-gt">Šta još traži pažnju</h3><div class="fc-att">${att.map(([k, , icn, t, s]) => `<button type="button" data-act="filter" data-arg="${k}" data-fk="att-${k}"><span class="ai">${ic(icn, 20)}</span><span><b>${esc(t)}</b><em>${esc(s)}</em></span>${ic("chevron-right", 20)}</button>`).join("")}</div>` : ""}${hint}`;
    };

    /* ---------- tab ---------- */
    const view = () => {
      const detailPage = !st.wide && st.sel != null;
      const sel = st.sel != null ? ctx.bookRow(st.sel) : null;
      if (detailPage) return sel ? detailHtml(sel) : `<div class="fc-card"><div class="fc-empty">${ic("account-off-outline", 32)}<b>Kurir nije u listi</b><button type="button" class="fc-btn fc-btn--sm" data-act="back">Nazad na listu</button></div></div>`;
      const right = sel ? detailHtml(sel) : noneHtml();
      const detailCol = st.wide ? `<aside class="fc-det" aria-label="Detalji kurira">${right}</aside>` : "";
      return `${kpiHtml()}<div class="fc-grid"><div class="fc-left">${st.wide ? "" : queueHtml()}${listHtml()}</div>${detailCol}</div>`;
    };

    /* ---------- radnje ---------- */
    const A = ctx.acts;
    A.kpi = (k) => { st.filter = st.filter === k ? "all" : k; if (st.filter === "pending") { st.sort = "age"; if (st.wide) st.sel = null; } else if (st.sort === "age") st.sort = "debt"; st.shown = 12; ctx.focusKey("kpi-" + k); ctx.render(); };
    A.filter = (k) => { st.filter = k; st.shown = 12; if (k === "pending") st.sort = "age"; else if (st.sort === "age") st.sort = "debt"; ctx.focusKey("f-" + k); ctx.render(); };
    A.reset = () => { st.q = ""; st.filter = "all"; st.shown = 12; ctx.render(); };
    A.more = () => { st.shown += 24; ctx.focusKey("more"); ctx.render(); };
    A.qmore = () => { qShown += 20; ctx.render(); };
    A.open = (id) => {
      st.sel = Number(id);
      if (!st.wide) { ctx.focusKey(null); ctx.render(); const sc = ctx.el.querySelector(".fc-scroll"); if (sc) sc.scrollTop = 0; const h = ctx.el.querySelector("#fc-h1"); if (h) h.focus({ preventScroll: true }); }
      else ctx.render();
      loadTimeline(st.sel);
    };
    A.back = () => {
      const id = st.sel; st.sel = null;
      ctx.focusKey(id != null ? "row-" + id : null);
      ctx.render();
    };
    A.refresh = async () => { ctx.toast("Osvježavam…", { ms: 800 }); await refreshAll(); if (st.tab === "promet" && ctx.parts.promet) ctx.parts.promet.reload(); ctx.toast("Podaci su osvježeni.", { ms: 1400 }); };
    A.retry = (k) => { if (k === "tl") loadTimeline(st.sel, true); else load(k); };
    A.confirm = (id) => { const p = (D.pending.v || []).find((x) => x.id === Number(id)); if (p) ctx.openSheet({ type: "confirm", pendingId: p.id, courierId: p.courier_id, text: Number(p.reported_amount).toFixed(2), note: "", error: "", saving: false }); };
    A.receipt = () => { const r = ctx.bookRow(st.sel); if (r) ctx.openSheet({ type: "entry", mode: "receipt", courierId: r.id, text: r.cash > 0 ? r.cash.toFixed(2) : "", note: "", method: "gotovina", error: "", saving: false, key: ctx.uuid() }); };
    A.payout = () => { const r = ctx.bookRow(st.sel); if (r && r.wage > 0) ctx.openSheet({ type: "entry", mode: "payout", courierId: r.id, text: r.wage.toFixed(2), note: "", method: "gotovina", error: "", saving: false, key: ctx.uuid() }); };
    A.batch = () => ctx.openSheet({ type: "batch", ...ctx.parts.sheets.newBatch() });
    A.copy = async (kind) => {
      const r = ctx.bookRow(st.sel); if (!r) return;
      const text = kind === "id" ? String(r.id) : kind === "bank" ? r.bank : r.iban;
      try { await navigator.clipboard.writeText(text); } catch (e) { /* bez prava na međuspremnik: samo oznaka */ }
      copied.key = kind + r.id; ctx.focusKey("copy-" + kind); ctx.render();
      ctx.setTimeout(() => { if (copied.key === kind + r.id) { copied.key = null; ctx.render(); } }, 1600);
    };
    A.profile = () => ctx.toast("U aplikaciji: otvara Kuriri sa izabranim kurirom (adresa ?c=ID).");
    A["one-journal"] = () => { ctx.parts.promet.setCourier(st.sel); ctx.acts.tab("promet"); };
    A["all-journal"] = A["one-journal"];

    /* ---------- tastatura i unos ---------- */
    const typingIn = (t) => t && t.matches && (t.matches("input, textarea, select") || t.isContentEditable);
    const onKey = (ev) => {
      if (st.tab !== "stanje" || st.sheet) return;
      const t = ev.target;
      if (ev.key === "/" && !typingIn(t) && st.wide && !ev.ctrlKey && !ev.metaKey) { const q = ctx.el.querySelector(".fc-q-input"); if (q) { ev.preventDefault(); q.focus(); q.select(); } return; }
      if (ev.key === "Escape" && !typingIn(t) && st.wide && st.sel != null) { A.back(); return; }
      if (ev.key === "Escape" && t && t.matches && t.matches(".fc-q-input") && st.q) { st.q = ""; ctx.render(); return; }
      const row = t.closest && t.closest(".fc-row");
      if (row && ["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) {
        ev.preventDefault();
        const rows = [...ctx.el.querySelectorAll(".fc-row")];
        const i = rows.indexOf(row);
        const n = ev.key === "Home" ? 0 : ev.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)));
        rows.forEach((x) => x.setAttribute("tabindex", "-1"));
        rows[n].setAttribute("tabindex", "0"); rows[n].focus();
      }
    };
    const onInput = (ev) => { if (ev.target.matches && ev.target.matches(".fc-q-input")) { st.q = ev.target.value; st.shown = 12; ctx.render(); } };
    const onChange = (ev) => { if (ev.target.matches && ev.target.matches('select[data-fk="sort"]')) { st.sort = FC.parseSort(ev.target.value); ctx.focusKey("sort"); ctx.render(); } };

    // novi red predaje dok je stranica otvorena: simulator table
    const sim = {
      addPending() {
        const F = W.F;
        const id = F.nextId++;
        const row = { id, courier_id: W.couriers[3 + (id % 4)].courier_id, reported_amount: "58.30", reported_at: new Date(ctx.nowMs()).toISOString().replace(/\.\d{3}Z$/, ".000000Z") };
        F.pendingRows.push(row);
        F.history.unshift({ ...row, confirmed_amount: null, confirmed_at: null, status: "pending", note: null, confirmed_by: null, confirmed_by_name: null });
        return row;
      },
    };
    ctx.sim = sim;

    // osvježavanje dok je stranica vidljiva: predaje na čekanju često, ostalo rjeđe
    const loop = (key, ms, fn) => {
      const tick = () => { if (typeof document !== "undefined" && document.hidden) return ctx.setTimeout(tick, ms); fn(); ctx.setTimeout(tick, ms); };
      ctx.setTimeout(tick, ms);
    };
    const clockTick = () => { const s = ctx.el.querySelector("[data-upd]"); if (s) { s.textContent = ctx.updatedText(); } ctx.setTimeout(clockTick, 4000); };

    return {
      view, onKey, onInput, onChange,
      start() {
        refreshAll().then(() => { knownPending = new Set((D.pending.v || []).map((p) => p.id)); });
        loop("pending", st.pollMs, () => load("pending"));
        loop("slow", st.slowMs, () => { load("balances"); load("status"); });
        clockTick();
      },
      afterRender() {},
      load, refreshAll, loadTimeline, D,
    };
  };
})();
