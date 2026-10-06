/* Listovi taba "Raspored": ćelija, smjena, nova smjena, kopiranje, brisanje, poruka kuririma. */
(function () {
  "use strict";
  const parts = (window.SCParts = window.SCParts || {});

  parts.scheduleSheets = function (ctx) {
    const { SC, esc, ic, world, now, st } = ctx;
    const S = ctx.S.schedule;
    const COMPANY = 24;
    const ZN = (id) => ctx.zone(id).name;
    const K = { understaffed: "bad", below_target: "warn", target_reached: "ok", full: "blue" };
    const pill = (s) => `<span class="pill pill-${K[s.status]}">${esc(s.phase === "past" ? "Završeno" : SC.STATUS[s.status].label)}</span>`;
    const msgHtml = (tone, text) => (text ? (tone === "bad" ? ic("alert-circle-outline", 16) : tone === "warn" ? ic("alert-outline", 16) : "") + `<span>${esc(text)}</span>` : "");
    const field = (f, label, value, o = {}) => `<div class="sx-f"><div class="lb"><label for="sxf-${f}">${esc(label)}</label>${o.optional ? "<i> opciono</i>" : ""}</div>
      <div class="sx-st"><button type="button" aria-label="Smanji: ${esc(label)}" data-act="step" data-arg="${f}|-1" data-fk="st-${f}-m">${ic("minus", 22)}</button>
      <div class="sx-in" data-in="${f}"><input id="sxf-${f}" data-f="${f}" data-autofocus-${f} inputmode="${o.time ? "numeric" : "numeric"}" autocomplete="off" value="${esc(value)}" ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ""} aria-describedby="sxm-${f}"></div>
      <button type="button" aria-label="Povećaj: ${esc(label)}" data-act="step" data-arg="${f}|1" data-fk="st-${f}-p">${ic("plus", 22)}</button></div>
      <div class="sx-msg" id="sxm-${f}" data-msg="${f}" aria-live="polite"></div></div>`;
    const setMsg = (root, f, tone, text) => {
      const m = root.querySelector(`[data-msg="${f}"]`); if (!m) return;
      m.className = "sx-msg" + (tone ? " " + tone : ""); m.innerHTML = msgHtml(tone, text);
      const box = root.querySelector(`[data-in="${f}"]`); if (box) box.classList.toggle("bad", tone === "bad");
    };
    const sw = (key, label, hint, checked) => `<div class="sx-ss"><div class="tx"><b><label for="sxs-${key}">${esc(label)}</label></b><small>${esc(hint)}</small></div><span class="sx-sw"><input id="sxs-${key}" data-f="${key}" type="checkbox" role="switch" ${checked ? "checked" : ""}><i aria-hidden="true"></i></span></div>`;
    const row = (icon, title, sub, act, arg, o = {}) => `<button type="button" class="sx-pr" data-act="${act}" data-arg="${esc(arg || "")}" data-fk="${o.fk || act}"><span class="pi ${o.tone || ""}">${ic(icon, 22)}</span><span class="pt"><b${o.danger ? ' style="color:var(--bad)"' : ""}>${esc(title)}</b>${sub ? `<em>${esc(sub)}</em>` : ""}</span><span class="pe">${ic("chevron-right", 20)}</span></button>`;

    /* ---------- zajednički izvršilac: N poziva, do 4 istovremeno ---------- */
    const payload = (it) => ({ zone_id: it.zoneId, delivery_company_id: COMPANY, date: it.date, start_time: it.start, end_time: it.end, min_couriers: it.min, target_couriers: it.target, max_couriers: it.max, high_demand: !!it.hot });
    const runBatch = async (sh, items) => {
      sh.running = true; sh.done = 0; sh.total = items.length; sh.failed = [];
      const created = [];
      let idx = 0;
      const worker = async () => {
        while (idx < items.length) {
          const it = items[idx++];
          try {
            await ctx.api("POST", "/dispatcher/shift-templates", payload(it));
            const row = { id: world.nextShiftId++, zoneId: it.zoneId, date: it.date, start: it.start, end: it.end, min: it.min, target: it.target, max: it.max, booked: 0, hot: !!it.hot };
            world.shifts.push(row); created.push(row);
          } catch (e) { sh.failed.push({ it, msg: e.message }); }
          sh.done++;
          ctx.refreshSheet();
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
      sh.running = false;
      return created;
    };
    const finishCreated = (sh, created, dupCount) => {
      const wk = created.length ? S.weekOf(created[0].date) : S.week;
      if (created.length && !sh.failed.length) {
        ctx.closeSheet(true);
        if (S.weekOf(created[0].date) !== S.week && !created.some((c) => S.dates().includes(c.date))) S.week = wk;
        S.flashShifts(created.map((c) => c.id));
        ctx.render();
        ctx.toast(`Napravljeno ${S.pl(created.length)}${dupCount ? `, preskočeno ${dupCount} (već postoje)` : ""}.`);
      } else {
        sh.result = { created: created.length, failed: sh.failed.length, dup: dupCount };
        if (created.length) { S.flashShifts(created.map((c) => c.id)); ctx.render(); }
        ctx.renderSheet();
      }
    };
    const resultHtml = (sh) => {
      const r = sh.result; if (!r) return "";
      return `<div class="sx-tint ${r.failed ? "sx-tint--bad" : "sx-tint--ok"}" role="alert">${ic(r.failed ? "alert-circle-outline" : "check-circle-outline", 22)}<div><b>${r.failed ? `Napravljeno ${r.created}, neuspjelo ${r.failed}` : `Napravljeno ${r.created}`}</b>${r.failed ? sh.failed.slice(0, 4).map((f) => `${esc(ZN(f.it.zoneId))}, ${esc(SC.dayLong(f.it.date))}: ${esc(f.msg)}`).join("<br>") + (sh.failed.length > 4 ? `<br>… i još ${sh.failed.length - 4}` : "") : "Sve smjene su napravljene."}${r.dup ? `<br>Preskočeno ${r.dup} jer već postoje.` : ""}</div></div>`;
    };
    const progressNote = (sh) => (sh.running ? `Pravim ${sh.done} od ${sh.total}…` : "");

    /* ---------- ćelija: spisak smjena jedne zone u jednom danu ---------- */
    ctx.sheets.cell = {
      title: (sh) => `${ZN(sh.zoneId)} · ${SC.cap1(SC.dayLong(sh.date))}`,
      sub: (sh) => S.pl(S.shiftsAt(sh.zoneId, sh.date).length),
      body: (sh) => {
        const list = S.shiftsAt(sh.zoneId, sh.date);
        const gaps = SC.gaps(list);
        return `<div class="sx-rows">${list.map((s) => `<button type="button" data-act="shift" data-arg="${s.id}" data-fk="cs-${s.id}"><span class="a">${SC.fmtWinFull(s.start, s.end)}<small>${s.booked} od ${s.target} kurira${s.hot ? " · hitna" : ""}</small></span>${pill(s)}${ic("chevron-right", 20)}</button>`).join("")}</div>
        ${gaps.length ? `<div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div><b>Rupa u pokrivenosti</b>${gaps.map((g) => `Od ${g.from} do ${g.to} u ovoj zoni nema nijedne smjene.`).join("<br>")}</div></div>` : ""}`;
      },
      foot: (sh) => `<button type="button" class="sx-btn sx-btn--pri sx-btn--block" data-act="cell-add" data-fk="cell-add">${ic("plus", 20)}Dodaj smjenu</button>`,
    };
    ctx.acts["cell-add"] = () => { const sh = st.sheet; ctx.closeSheet(true); ctx.sheetOpenCreate({ zones: [sh.zoneId], days: [sh.date] }); };

    /* ---------- smjena: kapacitet, radnje ---------- */
    const shiftOf = (id) => world.shifts.find((s) => s.id === id);
    ctx.sheetOpenShift = (id) => {
      const s = shiftOf(id); if (!s) return;
      const v = { min: String(s.min), target: String(s.target), max: s.max == null ? "" : String(s.max), hot: s.hot };
      ctx.openSheet({ type: "shift", id, v, orig: { ...v } });
    };
    const errsOf = (sh) => {
      const s = shiftOf(sh.id);
      const e = SC.validateShift({ start: s.start, end: s.end, min: sh.v.min, target: sh.v.target, max: sh.v.max === "" ? null : sh.v.max });
      delete e.start; delete e.end;
      return e;
    };
    const dirtyShift = (sh) => ["min", "target", "max", "hot"].some((k) => sh.v[k] !== sh.orig[k]);
    const coverBlock = (s) => {
      const d = SC.decorate(s, now);
      const scale = Math.max(s.target, s.booked, s.max || 0, 1);
      const pct = Math.min(100, (s.booked / scale) * 100);
      const col = { understaffed: "#e5484d", below_target: "#e08a14", target_reached: "#1f9d6b", full: "#2f6fed" }[d.status];
      const tick = (v, l) => (v > 0 && v < scale ? `<b style="left:${(v / scale) * 100}%"></b>` : "");
      return `<div class="sx-big" style="--c:${col}"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px"><span class="num">${s.booked}<i> od ${s.target} kurira</i></span>${pill(d)}</div>
        <div class="sx-m" aria-hidden="true"><i style="width:${pct}%"></i>${tick(s.min)}${tick(s.target)}</div>
        <div class="leg"><span><i></i>Min ${s.min}</span><span><i></i>Cilj ${s.target}</span>${s.max != null ? `<span>Maks ${s.max}</span>` : ""}</div>
        <div class="ned">${esc(d.phase === "past" ? "Smjena je završena." : SC.need(s))}</div></div>`;
    };
    ctx.sheets.shift = {
      title: (sh) => { const s = shiftOf(sh.id); return `${ZN(s.zoneId)} · ${SC.fmtWinFull(s.start, s.end)}`; },
      sub: (sh) => { const s = shiftOf(sh.id); return SC.cap1(SC.dayLong(s.date)) + (s.hot ? " · hitna smjena" : ""); },
      dirty: dirtyShift,
      body: (sh) => {
        const s = shiftOf(sh.id); const d = SC.decorate(s, now);
        const note = d.phase === "live" ? `<div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div>Smjena je u toku, još ${esc(SC.inText(SC.mm(s.end) - now.min))}.</div></div>` : "";
        const canAsk = d.phase !== "past" && SC.missing(s) > 0;
        return `${coverBlock(s)}${note}
          <div class="sx-cap">${field("min", "Najmanje kurira", sh.v.min)}${field("target", "Cilj", sh.v.target)}${field("max", "Najviše", sh.v.max, { optional: true, placeholder: "Bez ograničenja" })}</div>
          <div class="sx-msg" data-bind="preview" aria-live="polite"></div>
          ${sw("hot", "Hitna smjena", "Označava smjenu u kojoj je gužva ili je kuriri teško pokrivaju.", sh.v.hot)}
          <div class="sx-list">${canAsk ? row("bullhorn-outline", "Traži kurire", "Priprema poruku sa potrebnim brojem; šalješ je na ekranu Poruke", "ask", sh.id, { tone: "blue", fk: "r-ask" }) : ""}${row("content-copy", "Kopiraj na druge dane", "Isto vrijeme i kapacitet u istoj zoni", "copyshift", sh.id, { fk: "r-copy" })}${row("delete-outline", "Obriši smjenu", s.booked ? `Ima ${s.booked} potvrđenih kurira` : "Nema potvrđenih kurira", "delete", sh.id, { tone: "bad", danger: true, fk: "r-del" })}</div>`;
      },
      update: (sh, root) => {
        const e = errsOf(sh);
        ["min", "target", "max"].forEach((f) => setMsg(root, f, e[f] ? "bad" : "", e[f] || ""));
        const pv = root.querySelector('[data-bind="preview"]');
        if (pv) {
          if (!Object.keys(e).length && dirtyShift(sh)) {
            const s = shiftOf(sh.id);
            const status = SC.statusOf(Number(sh.v.min), Number(sh.v.target), sh.v.max === "" ? null : Number(sh.v.max), s.booked);
            pv.className = "sx-msg"; pv.innerHTML = `<span>Sa ovim kapacitetom smjena bi bila: <b>${esc(SC.STATUS[status].label)}</b> (${s.booked} od ${sh.v.target}).</span>`;
          } else { pv.className = "sx-msg"; pv.innerHTML = ""; }
        }
      },
      input: (sh, ev) => {
        const t = ev.target;
        const f = t.getAttribute("data-f"); if (!f) return;
        if (t.type === "checkbox") sh.v[f] = t.checked; else sh.v[f] = t.value.replace(/[^\d]/g, "");
        if (t.type !== "checkbox" && t.value !== sh.v[f]) t.value = sh.v[f];
        ctx.refreshSheet();
      },
      foot: (sh) => {
        const e = errsOf(sh), bad = Object.keys(e).length > 0, dirty = dirtyShift(sh);
        return `<button type="button" class="sx-btn sx-btn--pri sx-btn--block" data-act="shift-save" data-fk="shift-save" ${!dirty || bad || sh.saving ? "disabled" : ""}>${sh.saving ? "Čuvam…" : "Sačuvaj"}</button><p>${sh.saving ? "" : bad ? "Provjeri polja iznad." : dirty ? "" : "Nema izmjena."}</p>`;
      },
      bind: (sh, root) => ctx.sheets.shift.update(sh, root),
      submit: (sh) => ctx.acts["shift-save"](),
    };
    ctx.acts["shift-save"] = async () => {
      const sh = st.sheet; if (!sh || sh.saving) return;
      if (Object.keys(errsOf(sh)).length || !dirtyShift(sh)) return;
      sh.saving = true; ctx.refreshSheet();
      const s = shiftOf(sh.id);
      const body = { min_couriers: Number(sh.v.min), target_couriers: Number(sh.v.target), max_couriers: sh.v.max === "" ? null : Number(sh.v.max), high_demand: !!sh.v.hot };
      try {
        await ctx.api("PUT", `/dispatcher/shift-templates/${s.id}`, body);
        Object.assign(s, { min: body.min_couriers, target: body.target_couriers, max: body.max_couriers, hot: body.high_demand });
        ctx.closeSheet(true); S.flashShifts([s.id]); ctx.render(); ctx.toast("Kapacitet smjene je sačuvan.");
      } catch (e) {
        sh.saving = false; ctx.refreshSheet(); ctx.toast(e.message || "Ne mogu da sačuvam kapacitet.", { err: true });
      }
    };
    ctx.acts.step = (arg) => {
      const sh = st.sheet; if (!sh) return;
      const [f, d] = arg.split("|"); const delta = Number(d);
      const input = ctx.el.querySelector(`#sx-sheet [data-f="${f}"]`); if (!input) return;
      if (f === "start" || f === "end") {
        const base = SC.parseTime(sh.v[f]) == null ? (f === "start" ? "09:00" : "17:00") : sh.v[f];
        const nv = SC.stepTime(base, delta * 15); sh.v[f] = nv; input.value = nv; sh.v.preset = "custom";
      } else {
        const cur = sh.v[f] === "" ? (f === "max" ? Number(sh.v.target) || 1 : 1) : Number(sh.v[f]);
        const lo = f === "max" ? 1 : 1;
        let nv = Math.max(lo, (Number.isFinite(cur) ? cur : 1) + delta);
        if (f === "max" && sh.v.max === "" && delta < 0) nv = Number(sh.v.target) || 1;
        sh.v[f] = String(nv); input.value = String(nv);
      }
      sh.touched = true;
      ctx.refreshSheet();
      input.focus({ preventScroll: true });
    };

    /* ---------- brisanje ---------- */
    ctx.acts.delete = (arg) => ctx.openSheet({ type: "delete", id: Number(arg), from: "shift" }, st.opener);
    ctx.sheets.delete = {
      title: () => "Obrisati smjenu?",
      sub: (sh) => { const s = shiftOf(sh.id); return `${ZN(s.zoneId)} · ${SC.fmtWinFull(s.start, s.end)} · ${SC.dayLong(s.date)}`; },
      body: (sh) => {
        const s = shiftOf(sh.id);
        return s.booked
          ? `<div class="sx-tint sx-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>U smjeni ${s.booked === 1 ? "je 1 potvrđen kurir" : `je ${s.booked} potvrđenih kurira`}</b>Obriši samo ako je smjena otkazana. Kurire obavijesti sam; šta se sa njihovim terminima desi na serveru, aplikacija ne zna.</div></div>`
          : `<div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div>U smjeni nema potvrđenih kurira. Brisanje se ne može poništiti.</div></div>`;
      },
      foot: (sh) => `<div class="two"><button type="button" class="sx-btn" data-act="sheet-close" data-fk="del-cancel" data-autofocus>Odustani</button><button type="button" class="sx-btn sx-btn--danger" data-act="delete-do" data-fk="del-do" ${sh.saving ? "disabled" : ""}>Obriši smjenu</button></div>`,
    };
    ctx.acts["delete-do"] = async () => {
      const sh = st.sheet; if (!sh || sh.saving) return;
      sh.saving = true; ctx.refreshSheet();
      const s = shiftOf(sh.id);
      try {
        await ctx.api("DELETE", `/dispatcher/shift-templates/${s.id}`);
        world.shifts.splice(world.shifts.indexOf(s), 1);
        S.selShift = null; st.opener = null;
        ctx.closeSheet(true); ctx.render(); ctx.toast("Smjena je obrisana.");
      } catch (e) { sh.saving = false; ctx.refreshSheet(); ctx.toast(e.message || "Ne mogu da obrišem smjenu.", { err: true }); }
    };

    /* ---------- poruka kuririma ---------- */
    ctx.acts.ask = (arg) => ctx.openSheet({ type: "ask", id: Number(arg) }, st.opener);
    ctx.sheets.ask = {
      title: () => "Traži kurire",
      sub: (sh) => { const s = shiftOf(sh.id); return `${ZN(s.zoneId)} · ${SC.fmtWinFull(s.start, s.end)} · ${SC.dayLong(s.date)}`; },
      body: (sh) => {
        const s = shiftOf(sh.id); const d = SC.askDraft(s, ZN(s.zoneId), now);
        return `<div class="sx-big"><div class="lb" style="font-size:.74rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft)">Nacrt poruke</div><b data-draft="title" style="font-size:1rem">${esc(d.title)}</b><p data-draft="body" style="font-size:.9rem;color:var(--ink-soft)">${esc(d.body)}</p><div style="font-size:.8rem;color:var(--ink-soft)">Kome: <b style="color:var(--ink)">Svi aktivni kuriri</b> (promijeni na ekranu Poruke)</div></div>
          <div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div>Poruka se ne šalje odavde. Otvara se ekran Poruke sa ovim nacrtom: tamo vidiš pregled i potvrđuješ slanje.</div></div>`;
      },
      foot: () => `<button type="button" class="sx-btn sx-btn--pri sx-btn--block" data-act="ask-go" data-fk="ask-go" data-autofocus>${ic("send-outline", 20)}Otvori u Porukama</button>`,
    };
    ctx.acts["ask-go"] = () => {
      const sh = st.sheet; const s = shiftOf(sh.id);
      ctx.S.askDraft = SC.askDraft(s, ZN(s.zoneId), now);
      ctx.log.push({ method: "NAV", path: "/dispatcher/notifications", body: { draft: ctx.S.askDraft.title } });
      ctx.closeSheet(true); st.opener = null;
      ctx.toast("Otvoren je ekran Poruke sa nacrtom. Ništa nije poslato.");
    };

    /* ---------- nova smjena ---------- */
    const presetsFor = (zones) => {
      const inZones = world.shifts.filter((s) => zones.includes(s.zoneId));
      const base = zones.length === 1 && inZones.length ? inZones : world.shifts;
      return SC.presetWindows(base, 4);
    };
    ctx.sheetOpenCreate = (pre = {}) => {
      const zones = pre.zones || [];
      const days = pre.days && pre.days.length ? pre.days : [S.week === 0 ? now.date : S.dates()[0]];
      const pr = presetsFor(zones);
      const p0 = pr[0];
      const v = { days: days.slice(), zones: zones.slice(), preset: p0 ? 0 : "custom", start: p0 ? p0.start : "09:00", end: p0 ? p0.end : "17:00", min: String(p0 ? p0.min : 1), target: String(p0 ? p0.target : 1), max: p0 && p0.max != null ? String(p0.max) : "", hot: false };
      ctx.openSheet({ type: "create", v, touched: false, result: null }, st.opener);
    };
    const specOf = (sh) => ({ days: sh.v.days, zones: sh.v.zones, start: sh.v.start, end: sh.v.end, min: Number(sh.v.min), target: Number(sh.v.target), max: sh.v.max === "" ? null : Number(sh.v.max), hot: sh.v.hot });
    const errsCreate = (sh) => {
      const e = SC.validateShift({ start: sh.v.start, end: sh.v.end, min: sh.v.min, target: sh.v.target, max: sh.v.max === "" ? null : sh.v.max });
      return e;
    };
    const planOf = (sh) => SC.expandCreate(specOf(sh), world.shifts);
    const dayChip = (iso, i, on) => `<button type="button" class="sx-chip sx-chip--day" aria-pressed="${on}" data-act="tog-day" data-arg="${iso}" data-fk="cd-${iso}"><small>${SC.WD_SHORT[i]}</small><b>${SC.parseIso(iso).getDate()}</b></button>`;
    ctx.sheets.create = {
      title: () => "Nova smjena",
      sub: () => `Sedmica ${SC.weekLabel(S.monday())}`,
      dirty: (sh) => sh.touched && !sh.result,
      body: (sh) => {
        if (sh.result) return resultHtml(sh);
        const dts = S.dates();
        const pr = presetsFor(sh.v.zones);
        return `<div class="sx-f"><div class="lb">Dani <button type="button" class="sx-btn sx-btn--text sx-btn--sm" style="padding:0 8px" data-act="days-set" data-arg="work" data-fk="dw">Radni dani</button><button type="button" class="sx-btn sx-btn--text sx-btn--sm" style="padding:0 8px" data-act="days-set" data-arg="all" data-fk="da">Cijela sedmica</button></div><div class="sx-chips sx-chips--days" role="group" aria-label="Dani">${dts.map((d, i) => dayChip(d, i, sh.v.days.includes(d))).join("")}</div><div class="sx-msg" data-msg="days" aria-live="polite"></div></div>
          <div class="sx-f"><div class="lb">Zone <button type="button" class="sx-btn sx-btn--text sx-btn--sm" style="padding:0 8px" data-act="zones-set" data-arg="all" data-fk="za">Sve zone</button></div><div class="sx-chips" role="group" aria-label="Zone">${world.zones.map((z) => `<button type="button" class="sx-chip" aria-pressed="${sh.v.zones.includes(z.id)}" data-act="tog-zone" data-arg="${z.id}" data-fk="cz-${z.id}">${esc(z.name)}</button>`).join("")}</div><div class="sx-msg" data-msg="zones" aria-live="polite"></div></div>
          <div class="sx-f"><div class="lb">Vrijeme</div><div class="sx-chips" role="radiogroup" aria-label="Uobičajena vremena">${pr.map((p, i) => `<button type="button" role="radio" class="sx-chip" aria-checked="${sh.v.preset === i}" data-act="preset" data-arg="${i}" data-fk="cp-${i}">${SC.fmtWin(p.start, p.end)} <small>${p.count}×</small></button>`).join("")}<button type="button" role="radio" class="sx-chip" aria-checked="${sh.v.preset === "custom"}" data-act="preset" data-arg="custom" data-fk="cp-c">Drugo</button></div></div>
          <div class="sx-two">${field("start", "Početak", sh.v.start, { time: true })}${field("end", "Kraj", sh.v.end, { time: true })}</div>
          <div class="sx-cap">${field("min", "Najmanje kurira", sh.v.min)}${field("target", "Cilj", sh.v.target)}${field("max", "Najviše", sh.v.max, { optional: true, placeholder: "Bez ograničenja" })}</div>
          ${sw("hot", "Hitna smjena", "Gužva ili smjena koju je teško pokriti.", sh.v.hot)}
          <div class="sx-sum" data-bind="summary" aria-live="polite"></div>`;
      },
      update: (sh, root) => {
        if (sh.result) return;
        const e = errsCreate(sh);
        ["start", "end", "min", "target", "max"].forEach((f) => setMsg(root, f, e[f] ? "bad" : "", e[f] || ""));
        setMsg(root, "days", "", ""); setMsg(root, "zones", "", "");
        const sum = root.querySelector('[data-bind="summary"]');
        if (!sum) return;
        const p = planOf(sh);
        const nd = sh.v.days.length, nz = sh.v.zones.length;
        if (!nd || !nz) { sum.innerHTML = `<span>${!nz ? "Izaberi bar jednu zonu." : "Izaberi bar jedan dan."}</span>`; return; }
        const lines = [`<b>${nd} ${SC.plural(nd, "dan", "dana", "dana")} × ${nz} ${SC.plural(nz, "zona", "zone", "zona")} = ${S.pl(p.items.length)}</b>`];
        if (p.dup) lines.push(`${p.dup} već ${p.dup === 1 ? "postoji" : "postoje"} i preskače se.`);
        if (p.overlaps) lines.push(`${p.overlaps} ${p.overlaps === 1 ? "se preklapa" : "se preklapa"} sa postojećom smjenom u istoj zoni (dozvoljeno, ali provjeri).`);
        if (p.tooMany) lines.push(`<span style="color:var(--bad);font-weight:700">Najviše ${SC.MAX_BATCH} smjena odjednom. Smanji broj dana ili zona.</span>`);
        sum.innerHTML = lines.map((l) => `<span>${l}</span>`).join("");
      },
      input: (sh, ev) => {
        const t = ev.target; const f = t.getAttribute("data-f"); if (!f) return;
        sh.touched = true;
        if (t.type === "checkbox") sh.v[f] = t.checked;
        else if (f === "start" || f === "end") { sh.v[f] = t.value; sh.v.preset = "custom"; }
        else { sh.v[f] = t.value.replace(/[^\d]/g, ""); if (t.value !== sh.v[f]) t.value = sh.v[f]; }
        ctx.refreshSheet();
      },
      foot: (sh) => {
        if (sh.result) return `<div class="two">${sh.result.failed ? `<button type="button" class="sx-btn sx-btn--pri" data-act="create-retry" data-fk="create-retry">Pokušaj ponovo (${sh.result.failed})</button>` : ""}<button type="button" class="sx-btn ${sh.result.failed ? "" : "sx-btn--pri"}" ${sh.result.failed ? "" : 'style="grid-column:1/-1"'} data-act="sheet-close" data-fk="create-done" data-autofocus>Zatvori</button></div>`;
        const e = errsCreate(sh), p = planOf(sh);
        const bad = Object.keys(e).length > 0 || !sh.v.days.length || !sh.v.zones.length || p.tooMany || p.create.length === 0;
        const label = sh.running ? `Pravim ${sh.done} od ${sh.total}…` : p.create.length > 1 ? `Napravi ${S.pl(p.create.length)}` : "Napravi smjenu";
        const note = sh.running ? "" : p.create.length === 0 && sh.v.days.length && sh.v.zones.length ? "Sve izabrane smjene već postoje." : bad ? "Provjeri polja iznad." : "";
        return `<button type="button" class="sx-btn sx-btn--pri sx-btn--block" data-act="create-do" data-fk="create-do" ${bad || sh.running ? "disabled" : ""} ${sh.running ? 'aria-busy="true"' : ""}>${esc(label)}</button><p>${esc(note)}</p>`;
      },
      bind: (sh, root) => ctx.sheets.create.update(sh, root),
      submit: () => ctx.acts["create-do"](),
    };
    ctx.acts["tog-day"] = (d) => { const sh = st.sheet; const i = sh.v.days.indexOf(d); if (i >= 0) sh.v.days.splice(i, 1); else sh.v.days.push(d); sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="cd-${d}"]`); if (f) f.focus(); };
    ctx.acts["days-set"] = (k) => { const sh = st.sheet; const dts = S.dates(); sh.v.days = k === "work" ? dts.slice(0, 5) : dts.slice(); sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="${k === "work" ? "dw" : "da"}"]`); if (f) f.focus(); };
    ctx.acts["tog-zone"] = (id) => {
      const sh = st.sheet; const n = Number(id); const i = sh.v.zones.indexOf(n);
      if (i >= 0) sh.v.zones.splice(i, 1); else sh.v.zones.push(n);
      sh.touched = true;
      if (sh.v.preset !== "custom") { const pr = presetsFor(sh.v.zones); const p = pr[Number(sh.v.preset)] || pr[0]; if (p) { sh.v.preset = pr.indexOf(p); sh.v.start = p.start; sh.v.end = p.end; sh.v.min = String(p.min); sh.v.target = String(p.target); sh.v.max = p.max == null ? "" : String(p.max); } }
      ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="cz-${id}"]`); if (f) f.focus();
    };
    ctx.acts["zones-set"] = () => { const sh = st.sheet; sh.v.zones = world.zones.map((z) => z.id); sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector('[data-fk="za"]'); if (f) f.focus(); };
    ctx.acts.preset = (arg) => {
      const sh = st.sheet; sh.touched = true;
      if (arg === "custom") sh.v.preset = "custom";
      else { const p = presetsFor(sh.v.zones)[Number(arg)]; if (p) { sh.v.preset = Number(arg); sh.v.start = p.start; sh.v.end = p.end; sh.v.min = String(p.min); sh.v.target = String(p.target); sh.v.max = p.max == null ? "" : String(p.max); } }
      ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="${arg === "custom" ? "cp-c" : "cp-" + arg}"]`); if (f) f.focus();
    };
    ctx.acts["create-do"] = async () => {
      const sh = st.sheet; if (!sh || sh.running) return;
      const p = planOf(sh);
      if (Object.keys(errsCreate(sh)).length || !p.create.length || p.tooMany) return;
      const created = await runBatch(sh, p.create);
      finishCreated(sh, created, p.dup);
    };
    ctx.acts["create-retry"] = async () => {
      const sh = st.sheet; if (!sh || sh.running) return;
      const items = sh.failed.map((f) => f.it); sh.result = null; ctx.renderSheet();
      const created = await runBatch(sh, items);
      finishCreated(sh, created, 0);
    };

    /* ---------- kopiranje: sedmica, dan ---------- */
    ctx.sheetOpenCopy = (pre = {}) => {
      const mon = S.monday();
      const mode = pre.mode || "week";
      const v = { mode, from: pre.from || (mode === "week" ? SC.iso(mon) : S.day), to: pre.to || SC.iso(SC.addDays(mon, 7)), toDays: [], zoneId: null };
      if (mode === "day") v.toDays = S.dates().filter((d) => d !== v.from).slice(0, 4);
      ctx.openSheet({ type: "copy", v, touched: false, result: null }, st.opener);
    };
    const planCopy = (sh) => {
      const v = sh.v;
      if (v.mode === "week") return SC.copyWeekPlan({ src: world.shifts, tgt: world.shifts, srcMon: SC.parseIso(v.from), tgtMon: SC.parseIso(v.to), zoneId: v.zoneId });
      return SC.copyDayPlan({ src: world.shifts, fromIso: v.from, toIsos: v.toDays, zoneId: v.zoneId, existing: world.shifts });
    };
    const wkChip = (label, key, iso, count) => `<div class="sx-f"><div class="lb">${esc(label)}</div><div class="sx-st"><button type="button" class="sx-ib" style="background:#f1f3f6;min-height:52px;width:44px" aria-label="Prethodna sedmica: ${esc(label)}" data-act="cp-wk" data-arg="${key}|-1" data-fk="cw-${key}-m">${ic("chevron-left", 22)}</button><div class="sx-in" style="padding:0 6px;justify-content:center;flex-direction:column;gap:0;align-items:center"><b data-bind="wk-${key}" style="font-size:1rem">${esc(SC.weekLabel(SC.parseIso(iso)))}</b><span class="mut" data-bind="wkn-${key}" style="font-size:.78rem">${S.pl(count)}</span></div><button type="button" class="sx-ib" style="background:#f1f3f6;min-height:52px;width:44px" aria-label="Sljedeća sedmica: ${esc(label)}" data-act="cp-wk" data-arg="${key}|1" data-fk="cw-${key}-p">${ic("chevron-right", 22)}</button></div></div>`;
    const countWeek = (isoMon) => { const d = SC.weekIsos(SC.parseIso(isoMon)); return world.shifts.filter((s) => d.includes(s.date)).length; };
    ctx.sheets.copy = {
      title: () => "Kopiraj raspored",
      sub: (sh) => (sh.v.mode === "week" ? "Cijela sedmica ili jedna zona" : "Jedan dan na druge dane"),
      dirty: (sh) => sh.touched && !sh.result,
      body: (sh) => {
        if (sh.result) return resultHtml(sh).replace("Sve smjene su napravljene.", "Sve smjene su napravljene.");
        const v = sh.v;
        const mode = `<div class="sx-chips" role="radiogroup" aria-label="Šta se kopira"><button type="button" role="radio" class="sx-chip" aria-checked="${v.mode === "week"}" data-act="cp-mode" data-arg="week" data-fk="cm-w">Sedmicu</button><button type="button" role="radio" class="sx-chip" aria-checked="${v.mode === "day"}" data-act="cp-mode" data-arg="day" data-fk="cm-d">Dan</button></div>`;
        const zsel = `<div class="sx-f"><div class="lb"><label for="sxf-copyzone">Zona</label></div><div class="sx-in" style="padding:0 14px"><select id="sxf-copyzone" data-f="zoneId" style="flex:1;height:50px;border:0;background:none;font:inherit;font-weight:600;appearance:auto"><option value="">Sve zone</option>${world.zones.map((z) => `<option value="${z.id}" ${v.zoneId === z.id ? "selected" : ""}>${esc(z.name)}</option>`).join("")}</select></div></div>`;
        const inner = v.mode === "week"
          ? `${wkChip("Iz sedmice", "from", v.from, countWeek(v.from))}${wkChip("U sedmicu", "to", v.to, countWeek(v.to))}${zsel}`
          : `<div class="sx-f"><div class="lb">Iz dana</div><div class="sx-chips sx-chips--days" role="radiogroup" aria-label="Izvorni dan">${S.dates().map((d, i) => `<button type="button" role="radio" class="sx-chip sx-chip--day" aria-checked="${v.from === d}" data-act="cp-from" data-arg="${d}" data-fk="cf-${d}"><small>${SC.WD_SHORT[i]}</small><b>${SC.parseIso(d).getDate()}</b></button>`).join("")}</div></div>
             <div class="sx-f"><div class="lb">Na dane</div><div class="sx-chips sx-chips--days" role="group" aria-label="Ciljni dani">${S.dates().map((d, i) => (d === v.from ? "" : `<button type="button" class="sx-chip sx-chip--day" aria-pressed="${v.toDays.includes(d)}" data-act="cp-to" data-arg="${d}" data-fk="ct-${d}"><small>${SC.WD_SHORT[i]}</small><b>${SC.parseIso(d).getDate()}</b></button>`)).join("")}</div></div>${zsel}`;
        return `${mode}${inner}<div class="sx-sum" data-bind="summary" aria-live="polite"></div>`;
      },
      update: (sh, root) => {
        if (sh.result) return;
        const sum = root.querySelector('[data-bind="summary"]'); if (!sum) return;
        const p = planCopy(sh), v = sh.v;
        const lines = [];
        if (v.mode === "week") {
          if (v.from === v.to) lines.push(`<b style="color:var(--bad)">Izvorna i ciljna sedmica su iste.</b>`);
          else { lines.push(`<b>Kopira se ${S.pl(p.source)}.</b>`); lines.push(`Procjena: ${p.create.length} ${SC.plural(p.create.length, "se pravi", "se prave", "se pravi")}, ${p.dup} već ${p.dup === 1 ? "postoji" : "postoje"} u ciljnoj sedmici i preskače se.`); lines.push(`<span style="font-size:.76rem">Server preskače smjenu koja već postoji; tačno pravilo preskakanja nije dokumentovano.</span>`); }
        } else {
          if (!p.source) lines.push(`<b>${esc(SC.cap1(SC.dayLong(v.from)))} nema smjena.</b>`);
          else if (!v.toDays.length) lines.push("Izaberi bar jedan ciljni dan.");
          else { lines.push(`<b>Napravit će se ${S.pl(p.create.length)}.</b>`); if (p.dup) lines.push(`${p.dup} već ${p.dup === 1 ? "postoji" : "postoje"} i preskače se.`); if (p.tooMany) lines.push(`<span style="color:var(--bad);font-weight:700">Najviše ${SC.MAX_BATCH} smjena odjednom.</span>`); }
        }
        sum.innerHTML = lines.map((l) => `<span>${l}</span>`).join("");
      },
      foot: (sh) => {
        if (sh.result) return `<div class="two">${sh.result.failed ? `<button type="button" class="sx-btn sx-btn--pri" data-act="create-retry" data-fk="create-retry">Pokušaj ponovo (${sh.result.failed})</button>` : `<button type="button" class="sx-btn sx-btn--pri" data-act="cp-open" data-fk="cp-open" data-autofocus>Otvori sedmicu</button>`}<button type="button" class="sx-btn" data-act="sheet-close" data-fk="cp-done">Zatvori</button></div>`;
        const p = planCopy(sh), v = sh.v;
        const bad = (v.mode === "week" && v.from === v.to) || p.create.length === 0 || (v.mode === "day" && (!v.toDays.length || p.tooMany));
        const label = sh.running ? `Kopiram ${sh.done} od ${sh.total}…` : p.create.length ? `Kopiraj ${S.pl(p.create.length)}` : "Kopiraj";
        const note = sh.running ? "" : v.mode === "week" && v.from === v.to ? "Izaberi dvije različite sedmice." : p.create.length === 0 ? (p.source ? "Sve već postoji u cilju." : "Nema šta da se kopira.") : "";
        return `<button type="button" class="sx-btn sx-btn--pri sx-btn--block" data-act="copy-do" data-fk="copy-do" ${bad || sh.running ? "disabled" : ""}>${esc(label)}</button><p>${esc(note)}</p>`;
      },
      input: (sh, ev) => {
        const t = ev.target; if (t.getAttribute("data-f") === "zoneId") { sh.v.zoneId = t.value ? Number(t.value) : null; sh.touched = true; ctx.refreshSheet(); }
      },
      bind: (sh, root) => {
        ctx.sheets.copy.update(sh, root);
        const z = root.querySelector('[data-f="zoneId"]'); if (z) z.addEventListener("change", () => { sh.v.zoneId = z.value ? Number(z.value) : null; sh.touched = true; ctx.refreshSheet(); });
      },
      submit: () => ctx.acts["copy-do"](),
    };
    ctx.acts["cp-mode"] = (m) => { const sh = st.sheet; sh.v.mode = m; if (m === "day") { sh.v.from = S.day; sh.v.toDays = S.dates().filter((d) => d !== sh.v.from).slice(0, 4); } else { sh.v.from = SC.iso(S.monday()); sh.v.to = SC.iso(SC.addDays(S.monday(), 7)); } sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="${m === "week" ? "cm-w" : "cm-d"}"]`); if (f) f.focus(); };
    ctx.acts["cp-wk"] = (arg) => { const sh = st.sheet; const [k, d] = arg.split("|"); sh.v[k] = SC.iso(SC.addDays(SC.parseIso(sh.v[k]), Number(d) * 7)); sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="cw-${k}-${Number(d) < 0 ? "m" : "p"}"]`); if (f) f.focus(); };
    ctx.acts["cp-from"] = (d) => { const sh = st.sheet; sh.v.from = d; sh.v.toDays = sh.v.toDays.filter((x) => x !== d); sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="cf-${d}"]`); if (f) f.focus(); };
    ctx.acts["cp-to"] = (d) => { const sh = st.sheet; const i = sh.v.toDays.indexOf(d); if (i >= 0) sh.v.toDays.splice(i, 1); else sh.v.toDays.push(d); sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="ct-${d}"]`); if (f) f.focus(); };
    ctx.acts["copy-do"] = async () => {
      const sh = st.sheet; if (!sh || sh.running) return;
      const p = planCopy(sh), v = sh.v;
      if (!p.create.length) return;
      if (v.mode === "week") {
        sh.running = true; sh.done = 0; sh.total = 1; ctx.refreshSheet();
        try {
          await ctx.api("POST", "/dispatcher/shift-templates/duplicate-week", { delivery_company_id: COMPANY, source_week_start: v.from, target_week_start: v.to, zone_id: v.zoneId });
          const created = p.create.map((it) => { const row = { id: world.nextShiftId++, zoneId: it.zoneId, date: it.date, start: it.start, end: it.end, min: it.min, target: it.target, max: it.max, booked: 0, hot: it.hot }; world.shifts.push(row); return row; });
          sh.running = false; sh.failed = [];
          sh.result = { created: created.length, failed: 0, dup: p.dup, to: v.to };
          ctx.renderSheet(); ctx.render();
        } catch (e) { sh.running = false; ctx.refreshSheet(); ctx.toast(e.message || "Ne mogu da kopiram sedmicu.", { err: true }); }
      } else {
        const created = await runBatch(sh, p.create);
        sh.result = { created: created.length, failed: sh.failed.length, dup: p.dup, to: null };
        if (created.length && !sh.failed.length) { ctx.closeSheet(true); S.flashShifts(created.map((c) => c.id)); ctx.render(); ctx.toast(`Napravljeno ${S.pl(created.length)}.`); } else { ctx.renderSheet(); if (created.length) ctx.render(); }
      }
    };
    ctx.acts["cp-open"] = () => { const sh = st.sheet; const to = sh.result && sh.result.to; ctx.closeSheet(true); if (to) { S.week = S.weekOf(to); S.day = to; ctx.render(); } };

    /* ---------- kopiranje jedne smjene na druge dane ---------- */
    ctx.acts.copyshift = (arg) => {
      const s = shiftOf(Number(arg));
      const days = S.dates().filter((d) => d !== s.date).slice(0, 4);
      ctx.openSheet({ type: "copyshift", id: s.id, days, touched: false, result: null }, st.opener);
    };
    const csSpec = (sh) => { const s = shiftOf(sh.id); return { days: sh.days, zones: [s.zoneId], start: s.start, end: s.end, min: s.min, target: s.target, max: s.max, hot: s.hot }; };
    ctx.sheets.copyshift = {
      title: () => "Kopiraj smjenu",
      sub: (sh) => { const s = shiftOf(sh.id); return `${ZN(s.zoneId)} · ${SC.fmtWinFull(s.start, s.end)} · kapacitet ${s.min}/${s.target}${s.max != null ? "/" + s.max : ""}`; },
      dirty: (sh) => sh.touched && !sh.result,
      body: (sh) => {
        if (sh.result) return resultHtml(sh);
        const s = shiftOf(sh.id);
        const chips = S.dates().filter((d) => d !== s.date).map((d) => `<button type="button" class="sx-chip sx-chip--day" aria-pressed="${sh.days.includes(d)}" data-act="cs-day" data-arg="${d}" data-fk="cs-${d}"><small>${SC.WD_SHORT[SC.wdIndex(SC.parseIso(d))]}</small><b>${SC.parseIso(d).getDate()}</b></button>`).join("");
        const nextWeek = SC.iso(SC.addDays(SC.parseIso(s.date), 7));
        return `<div class="sx-f"><div class="lb">Na dane</div><div class="sx-chips" role="group" aria-label="Ciljni dani">${chips}<button type="button" class="sx-chip" aria-pressed="${sh.days.includes(nextWeek)}" data-act="cs-day" data-arg="${nextWeek}" data-fk="cs-next">Isti dan sljedeće sedmice</button></div></div><div class="sx-sum" data-bind="summary" aria-live="polite"></div>`;
      },
      update: (sh, root) => {
        if (sh.result) return;
        const sum = root.querySelector('[data-bind="summary"]'); if (!sum) return;
        if (!sh.days.length) { sum.innerHTML = "<span>Izaberi bar jedan dan.</span>"; return; }
        const p = SC.expandCreate(csSpec(sh), world.shifts);
        sum.innerHTML = `<span><b>Napravit će se ${S.pl(p.create.length)}.</b></span>${p.dup ? `<span>${p.dup} već ${p.dup === 1 ? "postoji" : "postoje"} i preskače se.</span>` : ""}`;
      },
      foot: (sh) => {
        if (sh.result) return `<div class="two">${sh.result.failed ? `<button type="button" class="sx-btn sx-btn--pri" data-act="create-retry" data-fk="create-retry">Pokušaj ponovo (${sh.result.failed})</button>` : ""}<button type="button" class="sx-btn" ${sh.result.failed ? "" : 'style="grid-column:1/-1"'} data-act="sheet-close" data-fk="cs-done" data-autofocus>Zatvori</button></div>`;
        const p = SC.expandCreate(csSpec(sh), world.shifts);
        const bad = !sh.days.length || !p.create.length;
        return `<button type="button" class="sx-btn sx-btn--pri sx-btn--block" data-act="cs-do" data-fk="cs-do" ${bad || sh.running ? "disabled" : ""}>${sh.running ? `Kopiram ${sh.done} od ${sh.total}…` : p.create.length ? `Kopiraj ${S.pl(p.create.length)}` : "Kopiraj"}</button><p>${!sh.days.length ? "" : !p.create.length ? "Sve već postoji." : ""}</p>`;
      },
      bind: (sh, root) => ctx.sheets.copyshift.update(sh, root),
    };
    ctx.acts["cs-day"] = (d) => { const sh = st.sheet; const i = sh.days.indexOf(d); if (i >= 0) sh.days.splice(i, 1); else sh.days.push(d); sh.touched = true; ctx.renderSheet(); const f = ctx.el.querySelector(`[data-fk="cs-${S.dates().includes(d) ? d : "next"}"]`); if (f) f.focus(); };
    ctx.acts["cs-do"] = async () => {
      const sh = st.sheet; if (!sh || sh.running) return;
      const p = SC.expandCreate(csSpec(sh), world.shifts);
      if (!p.create.length) return;
      const created = await runBatch(sh, p.create);
      finishCreated(sh, created, p.dup);
    };
    // ponovni pokušaj za neuspjele (nova smjena, kopiranje dana, kopiranje smjene) koristi isti izvršilac
    ctx.acts["create-retry"] = async () => {
      const sh = st.sheet; if (!sh || sh.running) return;
      const items = sh.failed.map((f) => f.it); sh.result = null; ctx.renderSheet();
      const created = await runBatch(sh, items);
      if (sh.type === "copy") { sh.result = { created: created.length + (sh.prevCreated || 0), failed: sh.failed.length, dup: 0, to: null }; ctx.renderSheet(); ctx.render(); }
      else finishCreated(sh, created, 0);
    };

    return {};
  };
})();
