/* Tab "Pravila": provjera dostupnosti pri dodjeli narudžbi (sa procjenom posljedice i potvrdom pri uključivanju) i grad firme. */
(function () {
  "use strict";
  const parts = (window.SCParts = window.SCParts || {});

  parts.rules = function (ctx) {
    const { SC, esc, ic, world, now, st } = ctx;
    const R = (ctx.S.rules = { busy: false });
    const impact = () => SC.enforceImpact({ shifts: world.shifts, now, zones: world.zones });
    const impactBox = (imp, forConfirm) => {
      const lines = imp.lines.length ? `<br><span style="font-size:.82rem">${imp.lines.map((l) => `${esc(l.zone)} ${esc(l.win)}: ${l.booked} od ${l.target}`).join(" · ")}</span>` : "";
      if (imp.level === "none") return `<div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div><b>Procjena iz smjena</b>Sada nijedna smjena ne traje, pa se posljedica ne može procijeniti.</div></div>`;
      if (imp.level === "zero") return `<div class="sx-tint sx-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>Nijedan kurir nije potvrđen</b>U smjenama koje sada traju nema nijednog potvrđenog kurira. Ako uključiš provjeru, firma neće moći da dodijeli nijednu narudžbu.${lines}</div></div>`;
      if (imp.level === "partial") return `<div class="sx-tint">${ic("alert-outline", 22)}<div><b>Procjena iz smjena: ${imp.booked} ${SC.plural(imp.booked, "potvrđen kurir", "potvrđena kurira", "potvrđenih kurira")}</b>${imp.zeroShifts} od ${imp.inProgress} ${SC.plural(imp.inProgress, "smjene", "smjene", "smjena")} koje sada traju nema nijednog potvrđenog kurira.${lines}</div></div>`;
      return `<div class="sx-tint sx-tint--ok">${ic("check-circle-outline", 22)}<div><b>Procjena iz smjena: ${imp.booked} ${SC.plural(imp.booked, "potvrđen kurir", "potvrđena kurira", "potvrđenih kurira")}</b>Svaka smjena koja sada traje ima potvrđenih kurira.${lines}</div></div>`;
    };

    const view = () => {
      const ld = st.load.rules;
      if (ld === "loading") return `<div class="sx-card" style="padding:20px;display:grid;gap:12px" aria-busy="true"><div class="sx-skel" style="height:24px;width:60%"></div><div class="sx-skel" style="height:54px"></div><div class="sx-skel" style="height:80px"></div></div>`;
      const known = ld === "ok";
      const on = world.enforcement;
      const imp = impact();
      const sw = `<div class="sx-ss"><div class="tx"><b><label for="sx-enf">Provjera dostupnosti</label></b><small id="sx-enf-h">${known ? (on ? "Uključeno: narudžbe dobijaju samo kuriri potvrđeni po rasporedu." : "Isključeno: dodjela radi kao do sada.") : "Stanje se ne zna dok se ne učita."}</small></div><span class="sx-sw"><input id="sx-enf" type="checkbox" role="switch" data-enf="1" ${on && known ? "checked" : ""} ${!known || R.busy ? "disabled" : ""} aria-describedby="sx-enf-h" data-fk="enf"><i aria-hidden="true"></i></span></div>`;
      const err = known ? "" : `<div class="sx-tint sx-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>Ne mogu da pročitam stanje</b>Prekidač je zaključan dok se stanje ne učita, da ne bi pokazivao stanje druge firme.<div class="act"><button type="button" data-act="rules-retry" data-fk="rretry">Pokušaj ponovo</button></div></div></div>`;
      const cityRow = world.company.cityId == null
        ? `<button type="button" class="sx-pr" data-act="city-open" data-fk="city"><span class="pi warn">${ic("home-city-outline", 22)}</span><span class="pt"><small>Grad firme</small><b style="color:var(--ink-soft)">Nije postavljen</b><span class="tag">${ic("alert-outline", 14)}Zone i smjene čekaju</span></span><span class="pe"><span style="font-size:.84rem;font-weight:800;color:var(--blue-ink)">Postavi</span></span></button>`
        : `<div class="sx-pr" style="cursor:default"><span class="pi">${ic("home-city-outline", 22)}</span><span class="pt"><small>Grad firme</small><b>${esc(world.company.city)}</b><em>Zone se vezuju za grad firme.</em></span><span class="pe">${ic("lock-outline", 18)}</span></div>`;
      return `<section class="sx-card" style="padding:18px 20px;display:grid;gap:14px"><div><h2 style="font-size:1.05rem;font-weight:800">Dodjela narudžbi samo potvrđenim kuririma</h2><p style="font-size:.9rem;color:var(--ink-soft);margin-top:4px">Kad je uključeno, sistem dodjeljuje narudžbe samo kuririma koji su trenutno <b>potvrđeni</b> po ovom rasporedu. Dok je isključeno, dodjela radi kao i do sada.</p></div>${err}${sw}${known && !on ? impactBox(imp, false) : ""}</section>
        <div class="sx-list">${cityRow}</div>`;
    };

    ctx.acts["rules-retry"] = () => { st.load.rules = "loading"; ctx.render(); ctx.setTimeout(() => { st.load.rules = "ok"; ctx.render(); }, 500); };
    const apply = async (next) => {
      R.busy = true; ctx.render();
      try {
        await ctx.api("PATCH", `/dispatcher/delivery-companies/${world.company.id}/availability-enforcement`, { enabled: next });
        world.enforcement = next;
        ctx.toast(next ? "Provjera dostupnosti je uključena za ovu firmu." : "Provjera dostupnosti je isključena.");
      } catch (e) { ctx.toast(e.message || "Ne mogu da sačuvam podešavanje.", { err: true }); }
      R.busy = false; ctx.focusKey("enf"); ctx.render();
    };
    ctx.sheets.enforce = {
      title: () => "Uključiti provjeru dostupnosti?",
      sub: () => "Dodjela samo potvrđenim kuririma",
      body: () => `<p style="font-size:.9rem;color:var(--ink-soft)">Od sada sistem dodjeljuje narudžbe samo kuririma koji su trenutno potvrđeni po rasporedu.</p>${impactBox(impact(), true)}`,
      foot: (sh) => { const lvl = impact().level; const zero = lvl === "zero"; return `<div class="two"><button type="button" class="sx-btn" data-act="sheet-close" data-fk="enf-cancel" ${zero ? "data-autofocus" : ""}>Ne uključuj</button><button type="button" class="sx-btn ${zero ? "sx-btn--danger" : "sx-btn--pri"}" data-act="enf-do" data-fk="enf-do" ${sh.saving ? "disabled" : ""} ${!zero ? "data-autofocus" : ""}>${zero ? "Ipak uključi" : "Uključi"}</button></div>`; },
    };
    ctx.acts["enf-do"] = async () => { ctx.closeSheet(true); await apply(true); };

    // City sheet + page alert
    ctx.cityAlert = () => (world.company.cityId == null ? `<div class="sx-tint" role="status">${ic("alert-outline", 22)}<div><b>Firma nema grad</b>Zone i smjene čekaju dok se grad ne postavi.<div class="act"><button type="button" data-act="city-open" data-fk="city-top">Postavi grad</button></div></div></div>` : "");
    ctx.acts["city-open"] = () => ctx.openSheet({ type: "city", v: "" }, st.opener);
    ctx.sheets.city = {
      title: () => "Grad firme",
      sub: () => world.company.name,
      dirty: (sh) => sh.v !== "",
      body: (sh) => `<p style="font-size:.9rem;color:var(--ink-soft)">Unesi ID grada firme da bi zone i smjene mogle da se prave.</p><div class="sx-f"><div class="lb"><label for="sx-city">ID grada</label></div><div class="sx-in" data-in="city"><input id="sx-city" data-f="city" inputmode="numeric" value="${esc(sh.v)}" autocomplete="off" aria-describedby="sxm-city"></div><div class="sx-msg" id="sxm-city" data-msg="city"></div></div>`,
      foot: (sh) => `<button type="button" class="sx-btn sx-btn--pri sx-btn--block" data-act="city-save" data-fk="city-save" ${!sh.v || sh.saving ? "disabled" : ""}>Sačuvaj grad</button><p>${sh.v ? "" : "Upiši ID grada."}</p>`,
      input: (sh, ev) => { sh.v = ev.target.value.replace(/[^\d]/g, ""); if (ev.target.value !== sh.v) ev.target.value = sh.v; ctx.refreshSheet(); },
      submit: () => ctx.acts["city-save"](),
    };
    ctx.acts["city-save"] = async () => {
      const sh = st.sheet; if (!sh || !sh.v || sh.saving) return;
      sh.saving = true; ctx.refreshSheet();
      try {
        await ctx.api("PATCH", `/dispatcher/delivery-companies/${world.company.id}/city`, { city_id: Number(sh.v) });
        world.company.cityId = Number(sh.v); world.company.city = "Banja Luka";
        ctx.closeSheet(true); st.opener = null; ctx.render(); ctx.toast("Grad firme je sačuvan.");
      } catch (e) { sh.saving = false; ctx.refreshSheet(); ctx.toast(e.message || "Ne mogu da sačuvam grad.", { err: true }); }
    };

    return {
      view,
      onChange(ev) {
        const t = ev.target.closest("[data-enf]"); if (!t) return;
        if (R.busy || st.load.rules !== "ok") { t.checked = world.enforcement; return; }
        if (t.checked) { t.checked = false; ctx.openSheet({ type: "enforce" }, "enf"); }
        else { apply(false); }
      },
    };
  };
})();
