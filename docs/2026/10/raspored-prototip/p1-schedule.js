/* Tab "Raspored": sedmična mreža (računar) i pregled po danu (telefon). Listovi (smjena, ćelija, nova smjena, kopiranje, brisanje, poruka) su u p1b-sheets.js. */
(function () {
  "use strict";
  const parts = (window.SCParts = window.SCParts || {});
  const K = { understaffed: "under", below_target: "below", target_reached: "ok", full: "full" };

  parts.schedule = function (ctx) {
    const { SC, esc, ic, world, now, st } = ctx;
    const S = (ctx.S.schedule = { week: 0, filter: "all", zoneId: null, day: now.date, cell: null, selShift: null, flash: new Set(), emptyOpen: false, probN: 0 });
    const todayDate = () => SC.parseIso(now.date);
    const monday = () => SC.addDays(SC.mondayOf(todayDate()), S.week * 7);
    const dates = () => SC.weekIsos(monday());
    const model = () => SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: dates(), now, zoneId: S.zoneId, filter: S.filter });
    const plain = () => SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: dates(), now });
    const allDecorated = () => world.shifts.map((s) => SC.decorate(s, now));
    const allProblems = () => allDecorated().filter((s) => s.phase !== "past" && s.status === "understaffed").sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : SC.mm(a.start) - SC.mm(b.start) || a.id - b.id));
    ctx.problemBadge = () => (st.load.schedule === "ok" ? SC.problemList(plain()).length : 0);
    S.model = model; S.dates = dates; S.monday = monday; S.allProblems = allProblems;
    const shiftsAt = (zoneId, date) => world.shifts.filter((s) => s.zoneId === zoneId && s.date === date).map((s) => SC.decorate(s, now)).sort((a, b) => SC.mm(a.start) - SC.mm(b.start));
    S.shiftsAt = shiftsAt;
    const weekOf = (date) => Math.round(SC.diffDays(SC.iso(SC.mondayOf(todayDate())), SC.iso(SC.mondayOf(SC.parseIso(date)))) / 7);
    S.weekOf = weekOf;
    const pl = (n) => `${n} ${SC.plural(n, "smjena", "smjene", "smjena")}`;
    S.pl = pl;

    /* ---------- pločica ---------- */
    const tile = (s, phone) => {
      const cls = ["sx-t", "sx-t--" + K[s.status]];
      if (s.phase === "past") cls.push("past");
      if (!s.match) cls.push("dim");
      if (S.selShift === s.id) cls.push("sel");
      if (S.flash.has(s.id)) cls.push("flash");
      const scale = Math.max(s.target, s.booked, s.max || 0, 1);
      const pct = Math.min(100, Math.round((s.booked / scale) * 100));
      const ticks = [s.min, s.target].filter((v) => v > 0 && v < scale).map((v) => `<b style="left:${(v / scale) * 100}%"></b>`).join("");
      const label = s.phase === "past" ? "Završeno" : SC.STATUS[s.status].label;
      const icon = s.phase === "past" ? "check" : s.status === "understaffed" ? "alert-outline" : s.status === "below_target" ? "alert-circle-outline" : "check-circle-outline";
      if (phone) {
        return `<button type="button" class="sx-sc ${cls.slice(1).join(" ")}" data-act="shift" data-arg="${s.id}" data-sid="${s.id}" data-fk="s-${s.id}">
          <span class="r1"><span class="tm">${SC.fmtWinFull(s.start, s.end)}</span>${s.hot ? `<span class="hot" title="Hitna smjena" style="color:#9a4a07;display:grid">${ic("fire", 18)}</span>` : ""}<span class="ct">${s.booked}<i>/${s.target}</i></span></span>
          <span class="sx-m" aria-hidden="true"><i style="width:${pct}%"></i>${ticks}</span>
          <span class="st">${ic(icon, 16)}${esc(label)}</span>
          ${s.phase !== "past" && s.status !== "target_reached" && s.status !== "full" ? `<span class="nd">${esc(SC.need(s))}</span>` : ""}
        </button>`;
      }
      return `<span class="${cls.join(" ")}" data-act="shift" data-arg="${s.id}" data-sid="${s.id}">
        <span class="r1"><span class="tm">${SC.fmtWin(s.start, s.end)}</span>${s.hot ? `<span class="hot" title="Hitna smjena">${ic("fire", 14)}</span>` : ""}<span class="ct">${s.booked}<i>/${s.target}</i></span></span>
        <span class="sx-m" aria-hidden="true"><i style="width:${pct}%"></i>${ticks}</span>
        <span class="st">${ic(icon, 14)}${esc(label)}</span></span>`;
    };
    S.tile = tile;

    const cellLabel = (z, date, list) => {
      const d = SC.dayLong(date);
      if (!list.length) return `${z.name}, ${d}: nema smjena. Enter dodaje smjenu.`;
      return `${z.name}, ${d}: ${pl(list.length)}. ` + list.map((s) => `${SC.fmtWin(s.start, s.end)}, ${s.booked} od ${s.target}, ${s.phase === "past" ? "završeno" : SC.STATUS[s.status].label.toLowerCase()}`).join("; ") + ". Enter otvara.";
    };

    /* ---------- alatna traka ---------- */
    const toolbar = (m, phone) => {
      const label = SC.weekLabel(monday());
      const wk = `<div class="sx-wk" role="group" aria-label="Sedmica">
        <button type="button" class="sx-ib sx-ib--soft" aria-label="Prethodna sedmica" data-act="week" data-arg="-1" data-fk="wk-prev">${ic("chevron-left", 24)}</button>
        <span class="lab" aria-live="polite" data-fk="wk-label">${esc(label)}</span>
        <button type="button" class="sx-ib sx-ib--soft" aria-label="Sljedeća sedmica" data-act="week" data-arg="1" data-fk="wk-next">${ic("chevron-right", 24)}</button>
        ${S.week !== 0 ? `<button type="button" class="sx-btn sx-btn--sm" data-act="week" data-arg="0" data-fk="wk-today">Ova sedmica</button>` : ""}
      </div>`;
      const acts = `<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="sx-btn" data-act="copy" data-fk="copy">${ic("content-copy", 18)}Kopiraj…</button><button type="button" class="sx-btn sx-btn--pri" data-act="new" data-fk="new">${ic("plus", 20)}Nova smjena</button></div>`;
      return phone ? `<div style="display:grid;gap:10px">${wk}</div>` : `<div class="sx-tool">${wk}${acts}</div>`;
    };

    const filters = (m) => {
      const c = m.counts;
      const P = [["all", "Sve", c.all, null], ["understaffed", "Ispod minimuma", c.understaffed, "#e5484d"], ["below_target", "Ispod cilja", c.below_target, "#e08a14"], ["target_reached", "Cilj", c.target_reached, "#1f9d6b"], ["full", "Popunjeno", c.full, "#2f6fed"]];
      const pb = SC.problemList({ shifts: allDecorated() });
      const zsel = `<label class="sx-sel"><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Zona</span><select data-bind="zone-filter" aria-label="Zona" data-fk="zone-filter"><option value="">Sve zone</option>${world.zones.map((z) => `<option value="${z.id}" ${S.zoneId === z.id ? "selected" : ""}>${esc(z.name)}</option>`).join("")}</select>${ic("chevron-down", 18)}</label>`;
      const n = allProblems().length;
      const pills = P.map(([k, l, num, col]) => `<button type="button" class="sx-fp ${k === "understaffed" ? "sx-fp--bad" : ""}" aria-pressed="${S.filter === k}" data-act="filter" data-arg="${k}" data-fk="f-${k}">${col ? `<span class="dot" style="background:${col}"></span>` : ""}${esc(l)} <span class="n">${num}</span></button>`).join("");
      const nextBtn = `<button type="button" class="sx-btn sx-btn--sm" data-act="next-problem" data-fk="next-problem" ${n ? "" : "disabled"}>${ic("arrow-right", 18)}Sljedeći problem${n ? ` · ${n}` : ""}</button>`;
      const live = `<p class="sr" aria-live="polite" id="sx-live"></p>`;
      return st.wide
        ? `<div class="sx-fbar" role="group" aria-label="Filter smjena">${pills}${zsel}${nextBtn}</div>${live}`
        : `<div class="sx-fbar sx-fbar--scroll" role="group" aria-label="Filter smjena">${pills}</div><div class="sx-fbar">${zsel}${nextBtn}</div>${live}`;
    };

    /* ---------- računar: mreža ---------- */
    const dayHead = (d, i) => {
      const dt = SC.parseIso(d.date);
      const tot = d.slots ? `<div class="tot" title="Potvrđeno / cilj, zbir po smjenama">${d.booked}/${d.target}${d.under ? `<i></i><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${d.under} ispod minimuma</span>` : ""}</div>` : `<div class="tot">–</div>`;
      return `<div role="columnheader" class="${d.today ? "today" : ""} ${d.past ? "past" : ""}"><div class="wd">${SC.WD_SHORT[i]}</div><div class="dn">${dt.getDate()}</div>${d.today ? '<span class="tg">danas</span>' : ""}${tot}</div>`;
    };
    const gapNote = (row) => {
      const gs = row.cells.map((c) => SC.gaps(c.shifts)).filter((g) => g.length);
      if (!gs.length) return "";
      const first = gs[0].map((g) => `${SC.short(g.from)}–${SC.short(g.to)}`).join(", ");
      const same = gs.every((g) => g.map((x) => `${x.from}-${x.to}`).join() === gs[0].map((x) => `${x.from}-${x.to}`).join());
      return same ? `<span class="gap" style="color:var(--ink-soft)">Rupa ${first}</span>` : `<span class="gap" style="color:var(--ink-soft)">Rupe u ${gs.length} ${SC.plural(gs.length, "dan", "dana", "dana")}</span>`;
    };
    const rowHtml = (row, rowIdx, m) => {
      const z = row.zone;
      const cells = row.cells.map((c, ci) => {
        const key = `${z.id}|${c.date}`;
        const empty = c.shifts.length === 0;
        const tabi = key === (S.cell || `${m.rows[0].zone.id}|${m.days[0].date}`) ? 0 : -1;
        const today = c.date === now.date;
        return `<div role="gridcell" class="sx-gc ${today ? "today" : ""} ${empty ? "empty" : ""} ${ctx.S.schedule.selCell === key ? "sel" : ""}" tabindex="${tabi}" data-act="cell" data-arg="${key}" data-fk="c-${z.id}-${c.date}" data-r="${rowIdx}" data-c="${ci}" aria-label="${esc(cellLabel(z, c.date, c.shifts))}">${c.shifts.map((s) => tile(s, false)).join("")}${empty ? `<span class="addhint">${ic("plus", 14)}Dodaj</span>` : ""}</div>`;
      }).join("");
      return `<div class="sx-gr ${row.empty ? "sx-gr--empty" : ""}" role="row"><div class="sx-gz" role="rowheader">${esc(z.name)}${row.empty ? "<small>Nema smjena</small>" : gapNote(row)}</div>${cells}</div>`;
    };
    const gridWide = (m) => {
      const withShifts = m.rows.filter((r) => !r.empty);
      const empties = m.rows.filter((r) => r.empty);
      const showEmpty = S.zoneId != null || S.emptyOpen;
      const shown = showEmpty ? m.rows : withShifts.length ? withShifts : m.rows;
      const head = `<div class="sx-gh" role="row"><div role="columnheader" class="sx-gz" style="justify-content:flex-end;font-size:.72rem;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em">Zona</div>${m.days.map(dayHead).join("")}</div>`;
      const more = !showEmpty && withShifts.length && empties.length ? `<div class="sx-more"><span>Zone bez smjena ove sedmice (${empties.length}): ${esc(empties.map((r) => r.zone.name).join(", "))}</span><button type="button" class="sx-btn sx-btn--sm" data-act="empty-toggle" data-fk="empty-toggle">Prikaži</button></div>` : showEmpty && S.emptyOpen && empties.length ? `<div class="sx-more"><span>Prikazane su i zone bez smjena.</span><button type="button" class="sx-btn sx-btn--sm" data-act="empty-toggle" data-fk="empty-toggle">Sakrij</button></div>` : "";
      return `<div class="sx-grid" role="grid" aria-label="Raspored smjena po zonama i danima" aria-rowcount="${shown.length + 1}">${head}${shown.map((r, i) => rowHtml(r, i, { ...m, rows: shown })).join("")}${more}</div>`;
    };

    /* ---------- telefon: dan ---------- */
    const phoneBody = (m) => {
      if (!m.days.some((d) => d.date === S.day)) S.day = m.days[0].date;
      const strip = m.days.map((d, i) => {
        const dt = SC.parseIso(d.date);
        const pb = d.under ? `<span class="pb" aria-label="${d.under} ispod minimuma">${d.under}</span>` : d.below ? `<span class="pb pb--w" aria-label="${d.below} ispod cilja">${d.below}</span>` : d.slots ? `<span class="pb pb--n" aria-label="${d.slots} smjena">${d.slots}</span>` : `<span class="pb" style="visibility:hidden">0</span>`;
        return `<button type="button" class="sx-dc ${d.today ? "today" : ""} ${d.past ? "past" : ""}" aria-pressed="${S.day === d.date}" data-act="day" data-arg="${d.date}" data-fk="d-${d.date}" aria-label="${esc(SC.cap1(SC.dayLong(d.date)))}${d.under ? ", " + d.under + " ispod minimuma" : ""}"><span class="wd">${SC.WD_SHORT[i]}</span><span class="dn">${dt.getDate()}</span>${pb}</button>`;
      }).join("");
      const d = m.days.find((x) => x.date === S.day);
      const rows = m.rows.filter((r) => r.cells.find((c) => c.date === S.day).shifts.length);
      const list = rows.length
        ? rows.map((r) => `<section class="sx-zg" aria-label="${esc(r.zone.name)}"><h3>${esc(r.zone.name)}${(() => { const g = SC.gaps(r.cells.find((c) => c.date === S.day).shifts); return g.length ? `<em>rupa ${g.map((x) => SC.short(x.from) + "–" + SC.short(x.to)).join(", ")}</em>` : ""; })()}</h3>${r.cells.find((c) => c.date === S.day).shifts.map((s) => tile(s, true)).join("")}</section>`).join("")
        : `<div class="sx-card sx-empty"><b>Nema smjena za ${esc(SC.dayLong(S.day))}.</b><span>Dodaj smjenu ili kopiraj plan sa drugog dana.</span><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="sx-btn sx-btn--pri" data-act="new">${ic("plus", 18)}Nova smjena</button><button type="button" class="sx-btn" data-act="copy-day">Kopiraj dan…</button></div></div>`;
      return `<div class="sx-days" role="group" aria-label="Dani sedmice">${strip}</div>
        <p style="font-size:.74rem;color:var(--ink-soft);margin-top:-6px">Broj na danu: <b style="color:#b42318">crveno</b> ispod minimuma, <b style="color:#8f4406">žuto</b> ispod cilja, sivo ukupno smjena.</p>
        <div class="sx-dh"><h2>${esc(SC.cap1(SC.dayLong(S.day)))}</h2><span>${pl(d.slots)} · ${d.booked}/${d.target}</span></div>
        ${list}
        <div class="sx-bottombar"><button type="button" class="sx-btn sx-btn--pri" style="flex:1;min-height:52px" data-act="new" data-fk="new">${ic("plus", 20)}Nova smjena</button><button type="button" class="sx-btn" style="min-height:52px" data-act="copy" data-fk="copy" aria-label="Kopiraj">${ic("content-copy", 20)}</button></div>`;
    };

    /* ---------- stanja ---------- */
    const skeleton = () => st.wide
      ? `<div class="sx-grid" aria-busy="true" aria-label="Učitavam smjene">${'<div class="sx-gh"><div style="padding:14px"><div class="sx-skel" style="height:44px"></div></div></div>'}${[0, 1, 2, 3].map(() => `<div class="sx-gr">${'<div class="sx-gz"><div class="sx-skel" style="height:18px;width:70%"></div></div>'}${[0, 1, 2, 3, 4, 5, 6].map(() => '<div class="sx-gc" style="min-height:76px"><div class="sx-skel" style="height:54px"></div></div>').join("")}</div>`).join("")}</div>`
      : `<div aria-busy="true" aria-label="Učitavam smjene" style="display:grid;gap:10px"><div class="sx-skel" style="height:64px"></div>${[0, 1, 2].map(() => '<div class="sx-skel" style="height:96px;border-radius:16px"></div>').join("")}</div>`;
    const errorBox = () => `<div class="sx-tint sx-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>Ne mogu da učitam smjene</b>Server ne odgovara. Sedmica ${esc(SC.weekLabel(monday()))} nije prikazana, jer bi prazna mreža izgledala kao da nema smjena.<div class="act"><button type="button" data-act="retry" data-fk="retry">Pokušaj ponovo</button></div></div></div>`;

    const view = () => {
      const phone = !st.wide;
      if (st.load.schedule === "loading") return `${toolbar(null, phone)}${skeleton()}`;
      if (st.load.schedule === "error") return `${toolbar(null, phone)}${errorBox()}`;
      const m = model();
      const none = m.total === 0 && S.zoneId == null;
      let banner = "";
      if (none) {
        const prev = SC.weekModel({ shifts: world.shifts, zones: world.zones, dates: SC.weekIsos(SC.addDays(monday(), -7)), now });
        banner = `<div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div><b>Ova sedmica nema nijednu smjenu</b>${prev.total ? `Prethodna sedmica ima ${pl(prev.total)}. Možeš je kopirati i zatim izmijeniti ono što treba.` : "Dodaj prvu smjenu ili kopiraj plan sa druge sedmice."}<div class="act">${prev.total ? `<button type="button" data-act="copy-prev" data-fk="copy-prev">Kopiraj sedmicu ${esc(SC.weekLabel(SC.addDays(monday(), -7)))}</button>` : ""}</div></div></div>`;
      }
      return `${toolbar(m, phone)}${banner}${filters(m)}${phone ? phoneBody(m) : gridWide(m)}`;
    };

    /* ---------- radnje ---------- */
    const go = (n) => { S.week = n; S.selShift = null; S.selCell = null; S.cell = null; ctx.focusKey(null); ctx.render(); };
    ctx.acts.week = (arg) => { const a = Number(arg); S.week = a === 0 ? 0 : S.week + a; S.selShift = null; S.selCell = null; S.cell = null; S.day = a === 0 && S.week === 0 ? now.date : SC.weekIsos(monday())[0]; if (S.week === 0) S.day = now.date; ctx.focusKey(a === 0 ? "wk-next" : a > 0 ? "wk-next" : "wk-prev"); ctx.render(); };
    ctx.acts.filter = (arg) => { S.filter = arg; ctx.focusKey("f-" + arg); ctx.render(); };
    ctx.acts.day = (arg) => { S.day = arg; ctx.focusKey("d-" + arg); ctx.render(); };
    ctx.acts["empty-toggle"] = () => { S.emptyOpen = !S.emptyOpen; ctx.focusKey("empty-toggle"); ctx.render(); };
    ctx.acts.retry = () => { st.load.schedule = "loading"; ctx.render(); ctx.setTimeout(() => { st.load.schedule = "ok"; ctx.render(); }, 500); };
    ctx.acts.cell = (arg) => {
      const [zid, date] = arg.split("|");
      S.cell = arg; S.selCell = arg;
      const list = shiftsAt(Number(zid), date);
      if (!list.length) ctx.sheetOpenCreate({ zones: [Number(zid)], days: [date] });
      else ctx.openSheet({ type: "cell", zoneId: Number(zid), date });
    };
    ctx.acts.shift = (arg) => { S.selShift = Number(arg); const s = world.shifts.find((x) => x.id === Number(arg)); if (s) { S.cell = `${s.zoneId}|${s.date}`; S.selCell = null; } ctx.sheetOpenShift(Number(arg)); };
    ctx.acts.new = () => ctx.sheetOpenCreate({ zones: S.zoneId ? [S.zoneId] : [], days: [st.wide ? (S.week === 0 ? now.date : dates()[0]) : S.day] });
    ctx.acts.copy = () => ctx.sheetOpenCopy({ mode: "week" });
    ctx.acts["copy-day"] = () => ctx.sheetOpenCopy({ mode: "day", from: S.day });
    ctx.acts["copy-prev"] = () => ctx.sheetOpenCopy({ mode: "week", from: SC.iso(SC.addDays(monday(), -7)), to: SC.iso(monday()) });
    ctx.acts["next-problem"] = () => {
      const list = allProblems();
      if (!list.length) return;
      const cur = S.selShift;
      const i = list.findIndex((s) => s.id === cur);
      const s = list[(i + 1) % list.length];
      S.week = weekOf(s.date); S.selShift = s.id; S.cell = `${s.zoneId}|${s.date}`; S.day = s.date; S.filter = S.filter === "all" ? "all" : S.filter;
      ctx.focusKey("next-problem");
      ctx.render();
      const z = ctx.zone(s.zoneId);
      const live = ctx.el.querySelector("#sx-live");
      const when = s.date === now.date ? "danas" : SC.dayLong(s.date);
      if (live) live.textContent = `Problem ${(i + 1 + list.length) % list.length + 1} od ${list.length}: ${z.name}, ${when} ${SC.fmtWin(s.start, s.end)}, ${s.booked} od ${s.target}, ispod minimuma.`;
      const tileEl = ctx.el.querySelector(`[data-sid="${s.id}"]`);
      if (tileEl) { tileEl.scrollIntoView({ block: "center", inline: "nearest" }); }
    };
    S.flashShifts = (ids) => { ids.forEach((id) => S.flash.add(id)); ctx.setTimeout(() => { ids.forEach((id) => S.flash.delete(id)); ctx.render(); }, 1600); };

    return {
      view,
      onChange(ev) {
        const t = ev.target.closest('[data-bind="zone-filter"]');
        if (t) { S.zoneId = t.value ? Number(t.value) : null; ctx.focusKey("zone-filter"); ctx.render(); }
      },
      onKey(ev) {
        const cell = ev.target.closest && ev.target.closest(".sx-gc");
        if (!cell || st.sheet) return;
        const k = ev.key;
        if (k === "Enter" || k === " ") { ev.preventDefault(); ctx.acts.cell(cell.getAttribute("data-arg")); return; }
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(k)) return;
        ev.preventDefault();
        const r = Number(cell.getAttribute("data-r")), c = Number(cell.getAttribute("data-c"));
        const rows = ctx.el.querySelectorAll(".sx-gr").length;
        const nr = k === "ArrowUp" ? Math.max(0, r - 1) : k === "ArrowDown" ? Math.min(rows - 1, r + 1) : r;
        const nc = k === "ArrowLeft" ? Math.max(0, c - 1) : k === "ArrowRight" ? Math.min(6, c + 1) : k === "Home" ? 0 : k === "End" ? 6 : c;
        const next = ctx.el.querySelector(`.sx-gc[data-r="${nr}"][data-c="${nc}"]`);
        if (!next) return;
        ctx.el.querySelectorAll(".sx-gc[tabindex='0']").forEach((x) => x.setAttribute("tabindex", "-1"));
        next.setAttribute("tabindex", "0");
        S.cell = next.getAttribute("data-arg");
        next.focus();
      },
    };
  };
})();
