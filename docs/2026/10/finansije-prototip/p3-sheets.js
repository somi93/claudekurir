/* Prototip "Finansije": listovi (AppSheet): potvrda predaje, uplata i isplata, isplata svima, detalj stavke prometa, izbor kurira. */
(function () {
  "use strict";
  window.FCParts = window.FCParts || {};
  window.FCParts.sheets = function (ctx) {
    const { FC, esc, ic, st } = ctx;
    const CO_ID = 24;
    const METHODS = [["gotovina", "Gotovina"], ["bankovni transfer", "Bankovni transfer"]];
    const msgOf = (e) => {
      const errs = e && e.data && e.data.errors;
      if (errs) { const k = Object.keys(errs)[0]; if (k && errs[k][0]) return errs[k][0]; }
      return (e && e.message) || "Server ne odgovara.";
    };
    const msg = (m) => (m ? `<div class="fc-msg ${m.tone}" role="status">${m.tone === "warn" ? ic("alert-outline", 16) : m.tone === "ok" ? ic("check-circle-outline", 16) : ""}<span>${esc(m.text)}</span></div>` : "");
    const errBox = (sh, title) => (sh.error ? `<div class="fc-tint fc-tint--bad" role="alert" id="fc-err">${ic("alert-circle-outline", 22)}<div><b>${esc(title)}</b>${esc(sh.error)}</div></div>` : "");
    const focusAfterRemoval = () => { if (!ctx.el.contains(document.activeElement)) { const f = ctx.el.querySelector('[data-fk^="confirm-"]') || ctx.el.querySelector("#fc-h1"); if (f) f.focus({ preventScroll: true }); } };
    const maskAmount = (el) => { const raw = el.value; const clean = raw.replace(/[^\d.,]/g, ""); if (clean !== raw) { const pos = (el.selectionStart || 0) - (raw.length - clean.length); el.value = clean; try { el.setSelectionRange(Math.max(0, pos), Math.max(0, pos)); } catch (e) {} } return clean; };
    const field = (label, id, value, { suffix = "", fk = id, optional = false, ph = "" } = {}) =>
      `<div class="fc-f"><label for="${id}">${esc(label)}${optional ? " <i>(opciono)</i>" : ""}</label><div class="fc-in"><input id="${id}" data-fk="${fk}" data-autofocus data-select inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${esc(value)}" placeholder="${esc(ph)}" aria-describedby="fc-msg">${suffix ? `<span class="sfx">${esc(suffix)}</span>` : ""}</div></div>`;
    const noteField = (sh, label = "Napomena") => `<div class="fc-f"><label for="fc-note">${label} <i>(opciono)</i></label><div class="fc-in"><textarea id="fc-note" data-fk="note" rows="2">${esc(sh.note)}</textarea></div></div>`;

    /* ---------- potvrda predaje ---------- */
    const pendingOf = (sh) => (ctx.D.pending.v || []).find((p) => p.id === sh.pendingId) || null;
    const cChk = (sh) => {
      const r = ctx.bookRow(sh.courierId), p = pendingOf(sh);
      return FC.confirmCheck({ text: sh.text, reported: p ? Number(p.reported_amount) : 0, owed: r ? r.cash : null, cur: ctx.cur });
    };
    const confirmDyn = (sh) => {
      const r = ctx.bookRow(sh.courierId), p = pendingOf(sh), c = cChk(sh);
      const reportedText = p ? Number(p.reported_amount).toFixed(2) : "";
      const chip = c.valid && sh.text !== reportedText && p ? `<div class="fc-chips"><button type="button" class="fc-chip" data-act="confirm-same" data-fk="chip-same">Isto kao prijava ${esc(ctx.money(Number(p.reported_amount)))}</button></div>` : "";
      const after = c.valid && c.after != null && r
        ? `<div class="fc-sum"><div class="r"><span>Dug kurira sada</span><b>${esc(ctx.money(r.cash))}</b></div><div class="r"><span>${c.after < 0 ? "Firma će dugovati kuriru (gotovina)" : "Dug poslije potvrde"}</span><b>${esc(c.after < 0 ? ctx.money(-c.after) : ctx.money(c.after))}</b></div></div>`
        : "";
      const note = c.valid && c.diff !== 0 ? noteField(sh, "Napomena o razlici") : "";
      const m = c.valid ? c.msgs.map(msg).join("") : (sh.text ? msg({ tone: "bad", text: c.hint }) : "");
      return `${chip}<div id="fc-msg">${m}</div>${after}${note}${errBox(sh, "Ne mogu da potvrdim predaju")}`;
    };
    ctx.sheets.confirm = {
      title: () => "Potvrdi predaju",
      sub: (sh) => { const r = ctx.bookRow(sh.courierId), p = pendingOf(sh); return r && p ? `${r.name} · prijavio ${ctx.money(Number(p.reported_amount))} ${FC.ageText(p.reported_at, ctx.nowMs())}` : ""; },
      label: () => "Potvrdi predaju gotovine",
      dirty: (sh) => { const p = pendingOf(sh); return !!sh.note.trim() || (p ? sh.text !== Number(p.reported_amount).toFixed(2) : false); },
      body: (sh) => `${field("Primljeni iznos", "fc-amt", sh.text, { suffix: ctx.cur, fk: "amt" })}<div id="fc-dyn">${confirmDyn(sh)}</div>`,
      foot: (sh) => { const c = cChk(sh); return `<button type="button" class="fc-btn fc-btn--pri fc-btn--block" data-act="sheet-submit" data-fk="submit" ${c.valid && !sh.saving ? "" : "disabled"} ${sh.saving ? 'aria-busy="true"' : ""}>${sh.saving ? "Potvrđujem…" : c.valid ? `Potvrdi ${esc(ctx.money(c.amount))}` : "Potvrdi predaju"}</button><p>${!sh.saving && !c.valid ? esc(c.hint) : ""}</p>`; },
      input(sh, ev) {
        if (ev.target.id === "fc-amt") { sh.text = maskAmount(ev.target); ctx.refreshSheet(); }
        else if (ev.target.id === "fc-note") sh.note = ev.target.value;
      },
      update(sh, layer) { const d = layer.querySelector("#fc-dyn"); if (d) d.innerHTML = confirmDyn(sh); },
      async submit(sh) {
        if (sh.saving) return;
        const c = cChk(sh);
        if (!c.valid) { const i = ctx.el.querySelector("#fc-amt"); if (i) i.focus(); return; }
        const r = ctx.bookRow(sh.courierId);
        sh.saving = true; sh.error = ""; ctx.refreshSheet();
        try {
          await ctx.api("POST", `/dispatcher/cash-handovers/${sh.pendingId}/confirm`, { confirmed_amount: c.amount, ...(sh.note.trim() && c.diff !== 0 ? { note: sh.note.trim() } : {}) });
        } catch (e) { sh.saving = false; sh.error = msgOf(e); ctx.renderSheet(); const er = ctx.el.querySelector("#fc-err"); if (er) er.scrollIntoView({ block: "nearest" }); return; }
        ctx.closeSheet(true);
        ctx.toast(`Predaja potvrđena: ${r ? r.name : ""} · ${ctx.money(c.amount)}`);
        await ctx.afterAction(sh.courierId);
        focusAfterRemoval();
      },
    };
    ctx.acts["confirm-same"] = () => { const sh = st.sheet; const p = pendingOf(sh); if (!p) return; sh.text = Number(p.reported_amount).toFixed(2); ctx.renderSheet(); const i = ctx.el.querySelector("#fc-amt"); if (i) i.focus(); };
    ctx.acts["sheet-submit"] = () => { const sh = st.sheet; if (sh) ctx.sheets[sh.type].submit(sh); };

    /* ---------- uplata i isplata jednom kuriru ---------- */
    const owedOf = (sh) => { const r = ctx.bookRow(sh.courierId); return r ? (sh.mode === "receipt" ? r.cash : r.wage) : null; };
    const eChk = (sh) => FC.entryCheck({ mode: sh.mode, text: sh.text, owed: owedOf(sh), cur: ctx.cur });
    const entryDyn = (sh) => {
      const r = ctx.bookRow(sh.courierId), owed = owedOf(sh), c = eChk(sh);
      const full = owed != null && owed > 0 ? owed.toFixed(2) : "";
      const chip = full && sh.text !== full ? `<div class="fc-chips"><button type="button" class="fc-chip" data-act="entry-full" data-fk="chip-full">Cijeli iznos ${esc(ctx.money(owed))}</button></div>` : "";
      let bank = "";
      if (sh.mode === "payout" && sh.method === "bankovni transfer" && r) {
        const rows = [r.bank ? ["Žiro račun", r.bank] : null, r.iban ? ["IBAN", r.iban] : null].filter(Boolean);
        bank = rows.length
          ? `<div class="fc-kv">${rows.map(([l, v], i) => `<div><small>${l}</small><b>${esc(v)}</b><button type="button" class="cp" data-act="entry-copy" data-arg="${i}" data-fk="cp-${i}" aria-label="Kopiraj ${l.toLowerCase()}">${ic("content-copy", 20)}</button></div>`).join("")}</div>`
          : `<div class="fc-tint" role="status">${ic("alert-outline", 22)}<div><b>Račun kurira nije upisan</b>Upiši ga u Kuriri (Ugovor i isplata) ili izaberi gotovinu. Isplata se može evidentirati i bez računa.</div></div>`;
      }
      const m = c.valid ? msg(c.msg) : sh.text ? msg({ tone: "bad", text: c.hint }) : "";
      return `${chip}<div id="fc-msg">${m}</div>${bank}${errBox(sh, sh.mode === "receipt" ? "Ne mogu da evidentiram uplatu" : "Ne mogu da isplatim zaradu")}`;
    };
    ctx.sheets.entry = {
      title: (sh) => (sh.mode === "receipt" ? "Evidentiraj uplatu" : "Isplati zaradu"),
      sub: (sh) => { const r = ctx.bookRow(sh.courierId); if (!r) return ""; return sh.mode === "receipt" ? `${r.name} · ${r.cash >= 0 ? "duguje" : "firma duguje"} ${ctx.money(Math.abs(r.cash))}` : `${r.name} · firma duguje ${ctx.money(r.wage)}`; },
      dirty: (sh) => !!sh.note.trim() || sh.dirtyAmount === true,
      body(sh) {
        const methods = sh.mode === "payout" ? `<div class="fc-f"><span class="lb" id="fc-ml">Način isplate</span><div class="fc-chips" role="radiogroup" aria-labelledby="fc-ml">${METHODS.map(([v, t]) => `<button type="button" class="fc-chip" role="radio" aria-checked="${sh.method === v}" data-act="entry-method" data-arg="${v}" data-fk="m-${v === "gotovina" ? "cash" : "bank"}">${t}</button>`).join("")}</div></div>` : "";
        return `${field(sh.mode === "receipt" ? "Primljeni iznos" : "Isplaćeni iznos", "fc-amt", sh.text, { suffix: ctx.cur, fk: "amt" })}<div id="fc-dyn">${entryDyn(sh)}</div>${methods}${noteField(sh)}`;
      },
      foot: (sh) => { const c = eChk(sh); return `<button type="button" class="fc-btn fc-btn--pri fc-btn--block" data-act="sheet-submit" data-fk="submit" ${c.valid && !sh.saving ? "" : "disabled"} ${sh.saving ? 'aria-busy="true"' : ""}>${sh.saving ? "Čuvam…" : sh.mode === "receipt" ? "Evidentiraj uplatu" : "Isplati zaradu"}</button><p>${!sh.saving && !c.valid ? esc(c.hint) : ""}</p>`; },
      input(sh, ev) {
        if (ev.target.id === "fc-amt") { sh.text = maskAmount(ev.target); const full = owedOf(sh); sh.dirtyAmount = !(full != null && full > 0 && sh.text === full.toFixed(2)); ctx.refreshSheet(); }
        else if (ev.target.id === "fc-note") sh.note = ev.target.value;
      },
      update(sh, layer) { const d = layer.querySelector("#fc-dyn"); if (d) d.innerHTML = entryDyn(sh); },
      async submit(sh) {
        if (sh.saving) return;
        const c = eChk(sh);
        if (!c.valid) { const i = ctx.el.querySelector("#fc-amt"); if (i) i.focus(); return; }
        const r = ctx.bookRow(sh.courierId);
        sh.saving = true; sh.error = ""; ctx.refreshSheet();
        let res;
        try {
          const note = sh.note.trim();
          res = sh.mode === "receipt"
            ? await ctx.api("POST", `/dispatcher/couriers/${sh.courierId}/cash-receipt`, { delivery_company_id: CO_ID, amount: c.amount, ...(note ? { note } : {}) })
            : await ctx.api("POST", `/dispatcher/couriers/${sh.courierId}/payout`, { delivery_company_id: CO_ID, amount: c.amount, method: sh.method, idempotency_key: sh.key, ...(note ? { note } : {}) });
        } catch (e) { sh.saving = false; sh.error = e.status === 404 ? msgOf(e) : msgOf(e); ctx.renderSheet(); return; }
        ctx.closeSheet(true);
        const base = sh.mode === "receipt" ? `Uplata evidentirana: ${r ? r.name : ""} · ${ctx.money(c.amount)}` : `Zarada isplaćena: ${r ? r.name : ""} · ${ctx.money(c.amount)}`;
        ctx.toast(res && res.warning ? `${base}. ${res.warning}` : base, { ms: res && res.warning ? 7000 : 3600 });
        await ctx.afterAction(sh.courierId);
        focusAfterRemoval();
      },
    };
    ctx.acts["entry-full"] = () => { const sh = st.sheet; const o = owedOf(sh); if (o == null) return; sh.text = o.toFixed(2); sh.dirtyAmount = false; ctx.renderSheet(); const i = ctx.el.querySelector("#fc-amt"); if (i) i.focus(); };
    ctx.acts["entry-method"] = (m) => { const sh = st.sheet; sh.method = m; ctx.renderSheet(); const b = ctx.el.querySelector(`[data-act="entry-method"][aria-checked="true"]`); if (b) b.focus(); };
    ctx.acts["entry-copy"] = async (i) => {
      const sh = st.sheet; const r = ctx.bookRow(sh.courierId); if (!r) return;
      const v = [r.bank, r.iban].filter(Boolean)[Number(i)];
      try { await navigator.clipboard.writeText(v); } catch (e) { /* bez prava na međuspremnik */ }
      ctx.toast("Račun je kopiran.", { ms: 1400 });
    };

    /* ---------- isplata svima ---------- */
    const bChk = (sh) => { const on = sh.items.filter((i) => i.checked); return { n: on.length, total: FC.r2(on.reduce((s, i) => s + i.amount, 0)) }; };
    const biRow = (it, sh) => {
      const dis = sh.phase !== "form";
      const res = sh.res[it.id];
      const noBank = sh.method === "bankovni transfer" && !it.bank && it.checked && sh.phase === "form";
      const sub = res && res.state === "err" ? `<small class="err">${esc(res.message)}</small>` : res && res.state === "ok" ? `<small>${res.warning ? esc(res.warning) : "Isplaćeno"}</small>` : res && res.state === "run" ? "<small>Šaljem…</small>" : noBank ? '<small style="color:var(--warn);font-weight:700">Račun nije upisan</small>' : it.suspended ? "<small>Suspendovan</small>" : !it.inFirm ? "<small>Nije u firmi</small>" : "";
      const st2 = res && res.state === "run" ? '<span class="fc-spin" role="status" aria-label="Šaljem"></span>' : res && res.state === "ok" ? `<span class="st ok">${ic("check", 16)}</span>` : res && res.state === "err" ? `<span class="st err">${ic("alert-outline", 16)}</span>` : "";
      return `<div class="fc-bi"><label><input type="checkbox" data-bi="${it.id}" data-fk="bi-${it.id}" ${it.checked ? "checked" : ""} ${dis ? "disabled" : ""} aria-label="Isplati ${esc(it.name)}, ${esc(ctx.money(it.amount))}"><span class="bx">${ic("check", 16)}</span></label><span class="nm"><b>${esc(it.name)}</b>${sub}</span><span class="am">${esc(ctx.money(it.amount))}${st2}</span></div>`;
    };
    const batchDyn = (sh) => {
      const c = bChk(sh);
      const done = sh.phase !== "form";
      const sumry = FC.batchSummary(Object.fromEntries(Object.entries(sh.res).filter(([, v]) => v.state === "ok" || v.state === "err").map(([k, v]) => [k, { ok: v.state === "ok", warning: v.warning }])));
      const prog = sh.phase === "run" ? `<div class="fc-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${c.n}" aria-valuenow="${sumry.ok + sumry.failed}" aria-label="Napredak isplate"><i style="width:${c.n ? Math.round(((sumry.ok + sumry.failed) / c.n) * 100) : 0}%"></i></div><p style="font-size:.84rem;color:var(--ink-soft);font-weight:700">Obrađeno ${sumry.ok + sumry.failed} od ${c.n}</p>` : "";
      let tint = "";
      if (sh.phase === "done") {
        tint = sumry.failed
          ? `<div class="fc-tint fc-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>Isplaćeno ${sumry.ok}, nije uspjelo ${sumry.failed}</b>Neuspjele možeš ponoviti: isti ključ sprječava dvostruku isplatu.</div></div>`
          : `<div class="fc-tint fc-tint--ok" role="status">${ic("check-circle-outline", 22)}<div><b>Isplaćeno ${sumry.ok} ${FC.plural(sumry.ok, "zarada", "zarade", "zarada")}</b>Ukupno ${esc(ctx.money(c.total))}.${sumry.warnings ? ` Server je javio upozorenje za ${sumry.warnings}.` : ""}</div></div>`;
      }
      return `${tint}${prog}<div class="fc-bl" id="fc-bl" role="group" aria-label="Kuriri za isplatu">${sh.items.map((it) => biRow(it, sh)).join("")}</div>${done ? "" : `<div class="fc-sum"><div class="r"><span>Označeno</span><b>${c.n} od ${sh.items.length}</b></div><div class="r"><span>Ukupno za isplatu</span><b>${esc(ctx.money(c.total))}</b></div></div>`}`;
    };
    ctx.sheets.batch = {
      title: () => "Isplati zarade",
      sub: (sh) => `${FC.couriersText(sh.items.length)} čeka isplatu · ${ctx.money(FC.r2(sh.items.reduce((s, i) => s + i.amount, 0)))}`,
      label: () => "Isplati zarade svim kuririma",
      locked: (sh) => sh.phase === "run",
      dirty: (sh) => sh.phase === "form" && (sh.items.some((i) => !i.checked) || sh.method !== "gotovina"),
      body(sh) {
        const methods = sh.phase === "form" ? `<div class="fc-f"><span class="lb" id="fc-ml">Način isplate (za sve označene)</span><div class="fc-chips" role="radiogroup" aria-labelledby="fc-ml">${METHODS.map(([v, t]) => `<button type="button" class="fc-chip" role="radio" aria-checked="${sh.method === v}" data-act="batch-method" data-arg="${v}" data-fk="bm-${v === "gotovina" ? "cash" : "bank"}">${t}</button>`).join("")}</div></div>` : "";
        const info = sh.phase === "form" ? `<div class="fc-tint fc-tint--info">${ic("information-outline", 22)}<div><b>Cijela zarada svakog označenog kurira</b>Svaka isplata je zasebna i ima svoj ključ, pa ponovni pokušaj ne isplaćuje dvaput.</div></div>` : "";
        const all = sh.phase === "form" ? `<div><button type="button" class="fc-btn fc-btn--text fc-btn--sm" data-act="batch-all" data-fk="batch-all">${sh.items.every((i) => i.checked) ? "Poništi sve" : "Označi sve"}</button></div>` : "";
        return `${info}${methods}${all}<div id="fc-bdyn">${batchDyn(sh)}</div>`;
      },
      foot(sh) {
        const c = bChk(sh);
        if (sh.phase === "run") return `<button type="button" class="fc-btn fc-btn--pri fc-btn--block" disabled aria-busy="true">Isplata je u toku…</button><p>Ne zatvaraj dok se ne završi.</p>`;
        if (sh.phase === "done") {
          const failed = sh.items.filter((i) => i.checked && sh.res[i.id] && sh.res[i.id].state === "err").length;
          return failed ? `<div class="two"><button type="button" class="fc-btn" data-act="sheet-close" data-fk="close2">Zatvori</button><button type="button" class="fc-btn fc-btn--pri" data-act="batch-retry" data-fk="retry">Pokušaj ponovo (${failed})</button></div>` : `<button type="button" class="fc-btn fc-btn--pri fc-btn--block" data-act="sheet-close" data-fk="close2">Zatvori</button>`;
        }
        return `<button type="button" class="fc-btn fc-btn--pri fc-btn--block" data-act="sheet-submit" data-fk="submit" ${c.n ? "" : "disabled"}>${c.n ? `Isplati ${c.n} ${FC.plural(c.n, "zaradu", "zarade", "zarada")} (${esc(ctx.money(c.total))})` : "Označi bar jednog kurira"}</button><p>${c.n ? "Provjeri ukupan iznos prije potvrde." : ""}</p>`;
      },
      update(sh, layer) {
        const d = layer.querySelector("#fc-bdyn");
        const ae = document.activeElement;
        const fk = ae && layer.contains(ae) && ae.getAttribute ? ae.getAttribute("data-fk") : null;
        if (d) d.innerHTML = batchDyn(sh);
        if (fk) { const f = layer.querySelector(`[data-fk="${CSS.escape(fk)}"]`); if (f) f.focus({ preventScroll: true }); }
      },
      change(sh, ev) {
        const id = ev.target.getAttribute && ev.target.getAttribute("data-bi");
        if (id == null) return;
        const it = sh.items.find((i) => String(i.id) === id); if (it) it.checked = ev.target.checked;
        ctx.refreshSheet();
        const b = ctx.el.querySelector('[data-act="batch-all"]'); if (b) b.textContent = sh.items.every((i) => i.checked) ? "Poništi sve" : "Označi sve";
      },
      submit: (sh) => runBatch(sh, false),
    };
    const runBatch = async (sh, retry) => {
      if (sh.phase === "run") return;
      const items = sh.items.filter((i) => i.checked && (!retry || (sh.res[i.id] && sh.res[i.id].state === "err")));
      if (!items.length) return;
      sh.phase = "run";
      if (!retry) sh.res = {};
      for (const it of items) delete sh.res[it.id];
      ctx.renderSheet();
      await FC.runBatch(items, async (it) => {
        try {
          const r = await ctx.api("POST", `/dispatcher/couriers/${it.id}/payout`, { delivery_company_id: CO_ID, amount: it.amount, method: sh.method, idempotency_key: sh.keys[it.id] });
          return { ok: true, warning: r.warning };
        } catch (e) { return { ok: false, message: msgOf(e) }; }
      }, { concurrency: 3, onUpdate: (id, s) => { sh.res[id] = s; ctx.refreshSheet(); } });
      sh.phase = "done";
      ctx.renderSheet();
      const f = ctx.el.querySelector('[data-fk="retry"], [data-fk="close2"]'); if (f) f.focus();
      const ok = Object.values(sh.res).filter((r) => r.state === "ok").length;
      if (ok) ctx.toast(`Isplaćeno ${ok} ${FC.plural(ok, "zarada", "zarade", "zarada")}.`, { ms: 3000 });
      await ctx.afterAction(null);
    };
    ctx.acts["batch-method"] = (m) => { const sh = st.sheet; sh.method = m; ctx.renderSheet(); const b = ctx.el.querySelector('[data-act="batch-method"][aria-checked="true"]'); if (b) b.focus(); };
    ctx.acts["batch-all"] = () => { const sh = st.sheet; const all = sh.items.every((i) => i.checked); sh.items.forEach((i) => { i.checked = !all; }); ctx.renderSheet(); const b = ctx.el.querySelector('[data-act="batch-all"]'); if (b) b.focus(); };
    ctx.acts["batch-retry"] = () => runBatch(st.sheet, true);

    /* ---------- detalj stavke prometa ---------- */
    const entryRow = (sh) => ctx.parts.promet.rows().find((r) => r.key === sh.key) || null;
    ctx.sheets.jentry = {
      title: (sh) => { const x = entryRow(sh); return x ? (x.kind === "payout" ? "Isplata zarade" : x.status === "confirmed" ? "Predaja gotovine" : "Predaja čeka potvrdu") : "Stavka"; },
      sub: (sh) => { const x = entryRow(sh); return x ? `${x.name} · ${FC.dateTimeShort(x.at)}` : ""; },
      body(sh) {
        const x = entryRow(sh); if (!x) return '<div class="fc-empty"><b>Stavka nije u listi</b></div>';
        const kv = (l, v, copy) => `<div><small>${esc(l)}</small><b>${esc(v)}</b>${copy ? `<button type="button" class="cp" data-act="jcopy" data-arg="${esc(copy)}" data-fk="jcp" aria-label="Kopiraj ${esc(l.toLowerCase())}">${ic("content-copy", 20)}</button>` : "<span></span>"}</div>`;
        const rows = [kv("Kurir", `${x.name} (#${x.courierId})`)];
        if (x.kind === "handover") {
          rows.push(kv("Prijavljeno", ctx.money(x.reported)));
          if (x.status === "confirmed") { rows.push(kv("Potvrđeno", ctx.money(x.confirmed))); rows.push(kv("Razlika", x.diff === 0 ? "Nema" : FC.signed(x.diff, ctx.cur))); }
          rows.push(kv("Prijavljeno u", FC.dateTimeShort(x.reportedAt)));
          if (x.status === "confirmed") { rows.push(kv("Potvrđeno u", FC.dateTimeShort(x.confirmedAt))); rows.push(kv("Potvrdio", x.by || "Nije poznato")); }
        } else {
          rows.push(kv("Iznos", ctx.money(x.amount)));
          rows.push(kv("Način isplate", x.method ? ({ gotovina: "Gotovina", "bankovni transfer": "Bankovni transfer" })[x.method] : "Nije upisan u napomeni"));
          rows.push(kv("Ko je isplatio", "Server to ne vraća"));
        }
        if (x.note) rows.push(kv("Napomena", x.note));
        rows.push(kv("Referenca", x.ref, x.ref));
        return `<div class="fc-kv">${rows.join("")}</div><p style="font-size:.78rem;color:var(--ink-soft)">Referenca je broj za razgovor sa kurirom kad se iznos ne slaže.</p>`;
      },
      foot: (sh) => { const x = entryRow(sh); return x ? `<button type="button" class="fc-btn fc-btn--pri fc-btn--block" data-act="jgo" data-arg="${x.courierId}" data-fk="jgo">Otvori kurira</button>` : ""; },
    };
    ctx.acts.jcopy = async (v) => { try { await navigator.clipboard.writeText(v); } catch (e) { /* bez prava */ } ctx.toast("Kopirano.", { ms: 1400 }); };
    ctx.acts.jgo = (id) => { ctx.closeSheet(true); st.tab = "stanje"; st.filter = "all"; st.q = ""; ctx.render(); ctx.acts.open(id); };

    /* ---------- izbor kurira za filter prometa ---------- */
    const pickList = (sh) => {
      const all = ctx.book();
      const list = (sh.q ? all.filter((r) => FC.matchCourier(r, sh.q)) : all.slice().sort((a, b) => FC.fold(a.name).localeCompare(FC.fold(b.name), "sr"))).slice(0, 40);
      const cur = ctx.parts.promet.jf.courier;
      return `<button type="button" class="fc-row" data-act="pick" data-arg="" data-fk="pick-all" ${cur == null ? 'aria-current="true"' : ""} style="grid-template-columns:40px minmax(0,1fr);min-height:56px;border-radius:12px"><span class="fc-av fc-av--ink" aria-hidden="true">${ic("account-group-outline", 20)}</span><span class="tx"><span class="nm">Svi kuriri</span></span></button>` +
        list.map((r) => `<button type="button" class="fc-row" data-act="pick" data-arg="${r.id}" data-fk="pick-${r.id}" ${cur === r.id ? 'aria-current="true"' : ""} style="grid-template-columns:40px minmax(0,1fr);min-height:56px;border-radius:12px"><span class="fc-av" aria-hidden="true">${esc(r.initials)}</span><span class="tx"><span class="nm">${esc(r.name)}</span><span class="meta"><span class="t">#${r.id}</span></span></span></button>`).join("") +
        (list.length === 0 ? '<div class="fc-empty"><b>Nema kurira za pretragu</b></div>' : "");
    };
    ctx.sheets.courierpick = {
      title: () => "Izaberi kurira",
      sub: () => "Promet se prikazuje samo za njega",
      body: (sh) => `<label class="fc-srch" style="min-height:52px">${ic("magnify", 22)}<input id="fc-pq" data-fk="pq" data-autofocus type="search" value="${esc(sh.q)}" placeholder="Ime, telefon ili #ID" aria-label="Pretraži kurire" autocomplete="off"></label><div id="fc-pick" style="display:grid;gap:2px">${pickList(sh)}</div>`,
      input(sh, ev) { if (ev.target.id === "fc-pq") { sh.q = ev.target.value; const d = ctx.el.querySelector("#fc-pick"); if (d) d.innerHTML = pickList(sh); } },
    };
    ctx.acts.pick = (id) => {
      const pm = ctx.parts.promet;
      ctx.closeSheet(true);
      pm.jf.courier = id === "" ? null : Number(id); pm.jf.shown = 40;
      pm.reload();
    };

    return {
      newBatch() {
        const plan = FC.payoutPlan(ctx.book());
        const keys = {};
        plan.items.forEach((i) => { keys[i.id] = ctx.uuid(); });
        return { items: plan.items.map((i) => ({ ...i, checked: true })), method: "gotovina", phase: "form", keys, res: {}, error: "" };
      },
    };
  };
})();
