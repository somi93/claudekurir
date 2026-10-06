/* Tab "Sada": plan smjena i stanje uživo po zonama, na jednom mjestu. Samo čitanje + dvije prečice (poruka, smjena). */
(function () {
  "use strict";
  const parts = (window.SCParts = window.SCParts || {});
  const K = { understaffed: "under", below_target: "below", target_reached: "ok", full: "full" };
  const COL = { understaffed: "#e5484d", below_target: "#e08a14", target_reached: "#1f9d6b", full: "#2f6fed" };
  const TONE = { bad: "bad", warn: "warn", ok: "ok", idle: "idle" };

  parts.now = function (ctx) {
    const { SC, esc, ic, world, now, st } = ctx;
    const S = (ctx.S.now = { refreshedAt: Date.now(), auto: true, busy: false, error: false, tick: 0, interval: ctx.opts.nowInterval || 30000, timer: null, agoTimer: null });
    const live0 = JSON.parse(JSON.stringify(world.live));
    const seconds = () => Math.max(0, (Date.now() - S.refreshedAt) / 1000);
    const pl = (n) => `${n} ${SC.plural(n, "smjena", "smjene", "smjena")}`;

    const stateOf = (z) => {
      const plan = SC.nowPlan({ shifts: world.shifts, zoneId: z.id, now });
      const l = world.live[z.id];
      return { z, plan, live: l, zn: SC.zoneNow(plan, l) };
    };
    const cards = () => world.zones.map(stateOf).filter((x) => x.live || x.plan.today.length).sort((a, b) => a.zn.rank - b.zn.rank || a.z.name.localeCompare(b.z.name));
    const quiet = () => world.zones.map(stateOf).filter((x) => !x.live && !x.plan.today.length);

    const pillOf = (zn) => {
      const icon = zn.tone === "bad" ? "alert-circle-outline" : zn.tone === "warn" ? "alert-outline" : zn.tone === "ok" ? "check-circle-outline" : "clock-outline";
      return `<span class="pill pill-${zn.tone === "idle" ? "idle" : zn.tone}">${ic(icon, 14)}${esc(zn.label)}</span>`;
    };
    const meter = (s) => {
      const scale = Math.max(s.target, s.booked, s.max || 0, 1);
      const ticks = [s.min, s.target].filter((v) => v > 0 && v < scale).map((v) => `<b style="left:${(v / scale) * 100}%"></b>`).join("");
      return `<div class="sx-m" style="--c:${COL[s.status]}" aria-hidden="true"><i style="width:${Math.min(100, (s.booked / scale) * 100)}%"></i>${ticks}</div>`;
    };
    const AX0 = 6 * 60, AX1 = 24 * 60;
    const timeline = (x) => {
      const segs = x.plan.today.map((s) => `<span class="seg" style="left:${((SC.mm(s.start) - AX0) / (AX1 - AX0)) * 100}%;width:${((SC.mm(s.end) - SC.mm(s.start)) / (AX1 - AX0)) * 100}%;--c:${s.phase === "past" ? "#9aa4b2" : COL[s.status]};${s.phase === "past" ? "opacity:.7" : ""}" title="${esc(SC.fmtWinFull(s.start, s.end))}, ${s.booked} od ${s.target}"></span>`).join("");
      const nw = ((now.min - AX0) / (AX1 - AX0)) * 100;
      return `<div><div class="sx-tl" role="img" aria-label="Smjene danas: ${esc(x.plan.today.map((s) => SC.fmtWin(s.start, s.end)).join(", ") || "nema")}; sada je ${esc(ctx.clock())}">${segs}<span class="nw" style="left:${nw}%"></span></div><div class="sx-tl-ax" aria-hidden="true"><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div></div>`;
    };
    const liveChips = (l) => {
      if (!l) return `<div class="sx-live"><span class="i">Nema podataka o kuririma u zoni</span></div>`;
      return `<div class="sx-live"><span class="d"><b>${l.delivering}</b> u dostavi</span><span class="f"><b>${l.online}</b> ${SC.plural(l.online, "slobodan", "slobodna", "slobodnih")}</span><span class="i"><b>${l.idle}</b> ${SC.plural(l.idle, "neaktivan", "neaktivna", "neaktivnih")}</span></div>`;
    };
    const planBlock = (x) => {
      if (x.plan.current.length) {
        return `<div class="pl"><span class="l">Smjena sada</span>${x.plan.current.map((s) => `<div class="v"><span>${SC.fmtWinFull(s.start, s.end)}</span><span class="mut" style="font-weight:600">još ${esc(SC.inText(SC.mm(s.end) - now.min))}</span><span class="ct">${s.booked}<i>/${s.target}</i></span></div>${meter(s)}<span class="sub">${esc(SC.need(s))}</span>`).join("")}</div>`;
      }
      if (x.plan.next) {
        const s = SC.decorate(x.plan.next, { date: x.plan.next.date, min: 0 });
        return `<div class="pl"><span class="l">Sljedeća smjena</span><div class="v"><span>${SC.fmtWinFull(s.start, s.end)}</span><span class="mut" style="font-weight:600">za ${esc(SC.inText(x.plan.minutesToNext))}</span><span class="ct">${s.booked}<i>/${s.target}</i></span></div>${meter(s)}<span class="sub">${esc(SC.need(s))}</span></div>`;
      }
      return `<div class="pl"><span class="l">Smjena</span><span class="sub">Danas nema smjena u ovoj zoni.</span></div>`;
    };
    const card = (x) => {
      const { z, plan, zn } = x;
      const target = plan.current.length ? plan.worst : plan.next;
      const needsAsk = target && SC.missing(target) > 0 && ["empty", "under", "next-under", "below"].includes(zn.code);
      return `<article class="sx-zc ${zn.tone === "bad" ? "bad" : zn.tone === "warn" ? "warn" : ""}" aria-label="${esc(z.name)}: ${esc(zn.label)}" data-zone="${z.id}" data-code="${zn.code}">
        <div class="h"><h3>${esc(z.name)}</h3>${pillOf(zn)}</div>
        ${planBlock(x)}
        <div class="pl"><span class="l">Na terenu</span>${liveChips(x.live)}</div>
        ${timeline(x)}
        ${target ? `<div class="acts">${needsAsk ? `<button type="button" class="sx-btn sx-btn--sm" data-act="ask" data-arg="${target.id}" data-fk="ask-${z.id}">${ic("bullhorn-outline", 18)}Traži kurire</button>` : ""}<button type="button" class="sx-btn sx-btn--sm" data-act="now-open" data-arg="${target.id}" data-fk="open-${z.id}">Otvori smjenu</button></div>` : ""}
      </article>`;
    };

    const view = () => {
      if (st.load.now === "loading") return `<div class="sx-now-top"><div class="t"><h2>Sada</h2><small>Učitavam…</small></div></div><div class="sx-zc-grid" aria-busy="true">${[0, 1, 2].map(() => '<div class="sx-zc"><div class="sx-skel" style="height:22px;width:50%"></div><div class="sx-skel" style="height:64px"></div><div class="sx-skel" style="height:30px"></div><div class="sx-skel" style="height:26px"></div></div>').join("")}</div>`;
      if (st.load.now === "firsterror") return `<div class="sx-tint sx-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>Ne mogu da učitam stanje uživo</b>Server ne odgovara. Prazan prikaz bi izgledao kao da u zonama nikoga nema, zato ga ne pokazujem.<div class="act"><button type="button" data-act="now-refresh" data-fk="now-retry">Pokušaj ponovo</button></div></div></div>`;
      const cs = cards();
      const tot = cs.reduce((a, x) => { const l = x.live || { delivering: 0, online: 0, idle: 0 }; a.d += l.delivering; a.f += l.online; a.i += l.idle; return a; }, { d: 0, f: 0, i: 0 });
      const attn = cs.filter((x) => ["empty", "under", "next-under"].includes(x.zn.code)).length;
      const stale = S.error ? `<div class="sx-tint sx-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>Nisam uspio da osvježim</b>Prikazani su podaci od ${esc(clock(S.refreshedAt))}.<div class="act"><button type="button" data-act="now-refresh" data-fk="now-retry">Pokušaj ponovo</button></div></div></div>` : "";
      const q = quiet();
      return `<div class="sx-now-top"><div class="t"><h2>Sada · ${esc(ctx.clock())}</h2><small>Osvježeno <span data-ago>${esc(SC.ago(seconds()))}</span></small></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="sx-fp" aria-pressed="${S.auto}" data-act="auto-toggle" data-fk="auto">${ic("refresh", 16)}Automatski svakih ${Math.round(S.interval / 1000)} s</button><button type="button" class="sx-btn" data-act="now-refresh" data-fk="now-refresh" ${S.busy ? 'disabled aria-busy="true"' : ""}>${ic("refresh", 18)}${S.busy ? "Osvježavam…" : "Osvježi"}</button></div></div>
        ${stale}
        <div class="sx-tot" role="group" aria-label="Ukupno na terenu"><div><b>${tot.d}</b><span>U dostavi</span></div><div><b>${tot.f}</b><span>Slobodni</span></div><div><b>${tot.i}</b><span>Neaktivni</span></div><div><b style="${attn ? "color:var(--bad)" : ""}">${attn}</b><span>Zone koje traže pažnju</span></div></div>
        <div class="sx-zc-grid">${cs.map(card).join("")}</div>
        ${q.length ? `<div class="sx-quiet"><span><b>Danas bez smjena i bez kurira:</b> ${esc(q.map((x) => x.z.name).join(", "))}</span></div>` : ""}`;
    };
    const clock = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`; };

    // stanje uživo se pomjera malo pri svakom osvježavanju (samo da se vidi da je osvježeno)
    const drift = () => {
      S.tick++;
      const d = S.tick % 2 ? 1 : -1;
      const L = world.live;
      if (L[11]) L[11].delivering = Math.max(0, live0[11].delivering + d);
      if (L[14]) L[14].online = Math.max(0, live0[14].online + (S.tick % 3 === 0 ? 1 : 0));
    };
    const refresh = async () => {
      if (S.busy) return;
      S.busy = true; ctx.render();
      try {
        await ctx.api("GET", `/dispatcher/zones/live-coverage?delivery_company_id=${world.company.id}`);
        drift(); S.refreshedAt = Date.now(); S.error = false;
        if (st.load.now === "firsterror") st.load.now = "ok";
      } catch (e) {
        S.error = true;
        if (st.load.now === "ok" && !Object.keys(world.live).length) st.load.now = "firsterror";
      }
      S.busy = false;
      ctx.focusKey("now-refresh");
      ctx.render();
    };
    ctx.acts["now-refresh"] = refresh;
    ctx.acts["auto-toggle"] = () => { S.auto = !S.auto; ctx.focusKey("auto"); ctx.render(); schedule(); };
    ctx.acts["now-open"] = (id) => ctx.acts.shift(id);

    // automatsko osvježavanje: samo dok je tab Sada otvoren i dok je stranica vidljiva
    const schedule = () => {
      if (S.timer) { clearTimeout(S.timer); ctx.timers.delete(S.timer); S.timer = null; }
      if (!S.auto || st.tab !== "now") return;
      S.timer = ctx.setTimeout(async () => { S.timer = null; if (st.tab === "now" && S.auto && !(typeof document !== "undefined" && document.hidden)) await refresh(); schedule(); }, S.interval);
    };
    const tickAgo = () => {
      S.agoTimer = ctx.setTimeout(() => { const e = ctx.el.querySelector("[data-ago]"); if (e) e.textContent = SC.ago(seconds()); tickAgo(); }, 1000);
    };
    tickAgo();
    let lastTab = st.tab;

    return { view, afterRender() { if (st.tab !== lastTab) { lastTab = st.tab; schedule(); } else if (st.tab === "now" && !S.timer && S.auto) schedule(); } };
  };
})();
