/* Prototip "Finansije": tab Promet (predaje + isplate u jednom vremenskom toku, period, filteri, zbirovi, CSV) i list za izbor kurira. */
(function () {
  "use strict";
  window.FCParts = window.FCParts || {};
  window.FCParts.promet = function (ctx) {
    const { FC, esc, ic, st } = ctx;
    const CO = "/dispatcher/delivery-companies/24";
    const J = { state: "idle", h: [], p: [], failed: false, err: "", at: null };
    const jf = (st.j = { period: "7d", from: "", to: "", type: "all", courier: null, diffOnly: false, shown: 40 });
    let seq = 0;
    const range = () => (jf.period === "custom" ? { from: jf.from, to: jf.to } : FC.periodRange(jf.period, ctx.nowMs()));
    const rowsAll = () => FC.buildJournal({ handovers: J.h, payouts: J.p, nameOf: ctx.nameOf || ((id) => `Kurir #${id}`) });
    const visible = () => FC.filterJournal(rowsAll(), { type: jf.type, courier: jf.courier, diffOnly: jf.diffOnly });

    const load = async () => {
      const my = ++seq;
      if (!J.at) J.state = "loading";
      ctx.render();
      const r = range();
      const q = `from=${r.from}&to=${r.to}${jf.courier ? `&courier_id=${jf.courier}` : ""}`;
      try {
        const [h, p] = await Promise.all([ctx.api("GET", `${CO}/cash-handovers?${q}`), ctx.api("GET", `${CO}/payouts?${q}`)]);
        if (my !== seq) return;
        J.h = h.data; J.p = p.data; J.state = "ok"; J.failed = false; J.at = Date.now();
      } catch (e) {
        if (my !== seq) return;
        J.failed = true; J.err = e.message || "Server ne odgovara.";
        if (!J.at) J.state = "err";
      }
      ctx.render();
    };

    const PL = [["today", "Danas"], ["7d", "7 dana"], ["month", "Ovaj mjesec"], ["prev", "Prošli mjesec"], ["custom", "Od–do"]];
    const TY = [["all", "Sve"], ["handover", "Predaje"], ["payout", "Isplate"]];
    const skel = (n) => Array.from({ length: n }, () => '<div class="fc-sk-row" aria-hidden="true"><i class="fc-skel a"></i><i class="fc-skel b"></i><i class="fc-skel c"></i></div>').join("");
    const pill = (tone, text) => `<span class="fc-pill fc-pill-${tone}">${esc(text)}</span>`;
    const METHOD = { gotovina: "Gotovina", "bankovni transfer": "Bankovni transfer" };

    const rowHtml = (x, tabbable, now) => {
      const wait = x.kind === "handover" && x.status !== "confirmed";
      const icon = x.kind === "payout" ? ["out", "cash-minus"] : wait ? ["wait", "timer-sand"] : ["in", "cash-plus"];
      const kindText = x.kind === "payout" ? "Isplata zarade" : wait ? "Predaja čeka potvrdu" : "Predaja gotovine";
      let c2 = `<b>${esc(ctx.money(x.amount))}</b>`;
      if (x.kind === "handover" && x.status === "confirmed" && x.diff !== 0) c2 += `<small class="d">prijavljeno ${esc(FC.money(x.reported, "").trim())} · razlika ${esc(FC.signed(x.diff, ctx.cur))}</small>`;
      else if (wait) c2 += `<small>prijavljeno</small>`;
      else if (x.kind === "payout" && x.method) c2 += `<small>${esc(METHOD[x.method])}</small>`;
      let c3;
      if (x.kind === "payout") c3 = pill("blue", "Isplaćeno") + (x.method ? pill("idle", METHOD[x.method]) : "");
      else if (wait) c3 = pill("warn", "Na čekanju") + `<span>${esc(FC.ageText(x.reportedAt, now))}</span>`;
      else c3 = pill("ok", "Potvrđeno") + (x.by ? `<span>Potvrdio ${esc(x.by)}</span>` : "");
      const label = `${kindText}: ${x.name}, ${ctx.money(x.amount)}, ${FC.dateTimeShort(x.at)}${x.diff ? `, razlika ${FC.signed(x.diff, ctx.cur)}` : ""}`;
      return `<li><button type="button" class="fc-jr" data-act="jopen" data-arg="${esc(x.key)}" data-fk="j-${esc(x.key)}" tabindex="${tabbable ? 0 : -1}" aria-label="${esc(label)}"><span class="ji ${icon[0]}" aria-hidden="true">${ic(icon[1], 20)}</span>
        <span class="c1"><b>${esc(x.name)}</b><small>${esc(kindText)} · ${esc(FC.hm(x.at))}</small></span><span class="c2">${c2}</span><span class="c3">${c3}</span><span class="ch" aria-hidden="true">${ic("chevron-right", 20)}</span></button></li>`;
    };

    const view = () => {
      const r = range();
      const now = ctx.nowMs();
      const periodPills = PL.map(([k, t]) => `<button type="button" class="fc-fp" data-act="period" data-arg="${k}" data-fk="p-${k}" aria-pressed="${jf.period === k}">${esc(t)}</button>`).join("");
      const dates = jf.period === "custom" ? `<div class="fc-dates"><label>Od<input type="date" data-fk="d-from" data-date="from" value="${esc(jf.from)}" max="${esc(FC.dayKey(now))}"></label><label>Do<input type="date" data-fk="d-to" data-date="to" value="${esc(jf.to)}" max="${esc(FC.dayKey(now))}"></label></div>` : "";
      const base = rowsAll().filter((x) => (jf.courier == null || x.courierId === jf.courier));
      const diffN = base.filter((x) => x.kind === "handover" && x.status === "confirmed" && x.diff !== 0).length;
      const typePills = TY.map(([k, t]) => `<button type="button" class="fc-fp" data-act="jtype" data-arg="${k}" data-fk="t-${k}" aria-pressed="${jf.type === k}">${esc(t)}</button>`).join("") +
        `<button type="button" class="fc-fp" data-act="jdiff" data-fk="t-diff" aria-pressed="${jf.diffOnly}">Samo razlike <span class="n">${diffN}</span></button>`;
      const cname = jf.courier != null ? ctx.nameOf(jf.courier) : null;
      const courierBtn = `<button type="button" class="fc-fp" data-act="jcourier" data-fk="j-courier" aria-haspopup="dialog">${ic("account-outline", 18)}${cname ? esc(FC.toLatin(cname)) : "Svi kuriri"}${ic("chevron-down", 16)}</button>${cname ? `<button type="button" class="fc-ib fc-ib--soft" data-act="jcourier-clear" data-fk="j-courier-x" aria-label="Ukloni filter kurira">${ic("close", 18)}</button>` : ""}`;
      const vis = visible();
      const csvBtn = `<button type="button" class="fc-btn fc-btn--sm" data-act="csv" data-fk="csv" ${vis.length ? "" : "disabled"}>${ic("download-outline", 18)}Izvezi CSV</button>`;
      const toolbar = `<div class="fc-jbar"><div class="fc-jrow"><div class="fc-fbar fc-fbar--scroll" role="group" aria-label="Period">${periodPills}</div><div class="fc-fbar fc-fbar--scroll" role="group" aria-label="Vrsta">${typePills}</div></div>${dates}<div class="r">${courierBtn}<span class="sp"></span>${csvBtn}</div></div>`;
      let body;
      if (J.state === "loading" || J.state === "idle") body = `<section class="fc-card fc-jl" aria-busy="true">${skel(5)}</section>`;
      else if (J.state === "err") body = `<div class="fc-tint fc-tint--bad" role="alert">${ic("cloud-off-outline", 22)}<div><b>Ne mogu da učitam promet</b>Server ne odgovara. Zbirovi i spisak nisu pouzdani dok se ne učitaju.<div class="act"><button type="button" data-act="jretry" data-fk="jretry">Pokušaj ponovo</button></div></div></div>`;
      else {
        const t = FC.journalTotals(vis);
        const diffTxt = t.diffN ? { v: `${FC.signed(t.diffSum, "").trim()} <i>${esc(ctx.cur)}</i>`, s: `${t.diffN} ${FC.plural(t.diffN, "predaja", "predaje", "predaja")} sa razlikom` } : { v: "Nema razlika", s: "Prijavljeno i potvrđeno se poklapa" };
        const tiles = `<div class="fc-tot" aria-label="Zbirovi za izabrani period"><div><span class="l">Potvrđene predaje</span><span class="v">${esc(FC.money(t.inSum, "").trim())} <i>${esc(ctx.cur)}</i></span><span class="s">${t.inN} ${FC.plural(t.inN, "predaja", "predaje", "predaja")}${t.pendingN ? ` · ${t.pendingN} na čekanju` : ""}</span></div><div><span class="l">Isplate zarade</span><span class="v">${esc(FC.money(t.outSum, "").trim())} <i>${esc(ctx.cur)}</i></span><span class="s">${t.outN} ${FC.plural(t.outN, "isplata", "isplate", "isplata")}</span></div><div><span class="l">Razlika prijava i potvrda</span><span class="v">${diffTxt.v}</span><span class="s">${diffTxt.s}</span></div></div>`;
        const note = `<p class="sr-note" style="font-size:.78rem;color:var(--ink-soft);margin-top:-6px">Zbir je za predaje i isplate koje server vraća za ${esc(FC.dateShort(r.from + "T12:00:00Z"))} – ${esc(FC.dateShort(r.to + "T12:00:00Z"))}. Direktno evidentirane uplate su u njemu samo ako ih server vraća kao predaje.</p>`;
        const stale = J.failed ? `<div class="fc-tint" role="status">${ic("alert-outline", 22)}<div><b>Osvježavanje nije uspjelo</b>Prikazan je zadnji učitan promet.<div class="act"><button type="button" data-act="jretry">Pokušaj ponovo</button></div></div></div>` : "";
        let list;
        if (!vis.length) list = `<section class="fc-card"><div class="fc-empty">${ic("history", 32)}<b>Nema prometa</b><span>Nema predaja ni isplata za izabrani period i filtere.</span><button type="button" class="fc-btn fc-btn--sm" data-act="jreset">Poništi filtere</button></div></section>`;
        else {
          const shown = vis.slice(0, jf.shown);
          const days = FC.groupDays(shown, now);
          let first = true;
          list = days.map((g) => `<div><div class="fc-day"><span style="font-weight:800;letter-spacing:.08em;text-transform:uppercase">${esc(g.label)}</span><span>${g.inSum ? `predaje ${esc(ctx.money(g.inSum))}` : ""}${g.inSum && g.outSum ? " · " : ""}${g.outSum ? `isplate ${esc(ctx.money(g.outSum))}` : ""}${!g.inSum && !g.outSum ? `${g.rows.length} ${FC.plural(g.rows.length, "stavka", "stavke", "stavki")}` : ""}</span></div><section class="fc-card fc-jl"><ul aria-label="${esc(g.label)}">${g.rows.map((x) => { const tb = first; first = false; return rowHtml(x, tb, now); }).join("")}</ul></section></div>`).join("");
          if (vis.length > jf.shown) list += `<div class="fc-more"><button type="button" class="fc-btn fc-btn--text fc-btn--sm" data-act="jmore" data-fk="jmore">Prikaži još (${vis.length - jf.shown})</button></div>`;
        }
        body = `${stale}${tiles}${note}${list}`;
      }
      return `${toolbar}${body}`;
    };

    const A = ctx.acts;
    const reset = () => { jf.shown = 40; };
    A.period = (k) => {
      jf.period = k; reset();
      if (k === "custom") { const d = FC.periodRange("7d", ctx.nowMs()); jf.from = jf.from || d.from; jf.to = jf.to || d.to; }
      ctx.focusKey("p-" + k); load();
    };
    A.jtype = (k) => { jf.type = k; reset(); ctx.focusKey("t-" + k); ctx.render(); };
    A.jdiff = () => { jf.diffOnly = !jf.diffOnly; reset(); ctx.focusKey("t-diff"); ctx.render(); };
    A.jmore = () => { jf.shown += 40; ctx.focusKey("jmore"); ctx.render(); };
    A.jretry = () => load();
    A.jreset = () => { jf.type = "all"; jf.diffOnly = false; jf.courier = null; jf.period = "7d"; reset(); load(); };
    A.jcourier = () => ctx.openSheet({ type: "courierpick", q: "" });
    A["jcourier-clear"] = () => { jf.courier = null; reset(); ctx.focusKey("j-courier"); load(); };
    A.jopen = (key) => { const x = rowsAll().find((r) => r.key === key); if (x) ctx.openSheet({ type: "jentry", key }); };
    A.csv = () => {
      const rows = visible();
      const csv = FC.toCsv(rows);
      ctx.lastCsv = csv;
      const name = FC.csvName(ctx.nowMs());
      const count = `${rows.length} ${FC.plural(rows.length, "red", "reda", "redova")}`;
      const host = window.FCHost && window.FCHost.saveFile;
      if (host) {
        // domaćin (tabla u pregledniku Artifacta) nudi datoteku sam i traži potvrdu gledaoca; <a download> tamo ne radi
        host(name, "﻿" + csv).then((r) => {
          if (r.ok) ctx.toast(`Izvezeno ${count}: ${name}`);
          else if (r.why === "declined") ctx.toast(`Preuzimanje je odbijeno: ${name} nije sačuvan.`);
          else ctx.toast(`CSV je spreman (${count}), ali se u ovom prikazu ne može preuzeti.`, { err: true });
        });
        return;
      }
      try {
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = FC.csvName(ctx.nowMs());
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch (e) { /* bez preuzimanja u ovom okruženju: provjera ide preko ctx.lastCsv */ }
      ctx.toast(`Izvezeno ${rows.length} ${FC.plural(rows.length, "red", "reda", "redova")}: ${FC.csvName(ctx.nowMs())}`);
    };

    const onChange = (ev) => {
      const t = ev.target;
      if (t.matches && t.matches("input[data-date]")) {
        jf[t.getAttribute("data-date")] = t.value;
        if (jf.from && jf.to && jf.from > jf.to) { const s = jf.from; jf.from = jf.to; jf.to = s; }
        reset(); ctx.focusKey("d-" + t.getAttribute("data-date")); load();
      }
    };
    const onKey = (ev) => {
      if (st.tab !== "promet" || st.sheet) return;
      const row = ev.target.closest && ev.target.closest(".fc-jr");
      if (row && ["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) {
        ev.preventDefault();
        const rows = [...ctx.el.querySelectorAll(".fc-jr")];
        const i = rows.indexOf(row);
        const n = ev.key === "Home" ? 0 : ev.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)));
        rows.forEach((x) => x.setAttribute("tabindex", "-1"));
        rows[n].setAttribute("tabindex", "0"); rows[n].focus();
      }
    };

    return {
      view, onKey, onChange,
      start() { if (st.tab === "promet") load(); },
      onShow() { if (!J.at || J.state === "idle") load(); },
      reload: load,
      setCourier(id) { jf.courier = id; jf.shown = 40; J.at = null; J.state = "idle"; },
      rows: rowsAll, visible, J, jf,
    };
  };
})();
