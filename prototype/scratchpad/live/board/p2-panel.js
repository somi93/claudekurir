/* Prototip "Kuriri uživo": desni panel (Kuriri | Narudžbe): pretraga, spisak, detalj izabranog kurira ili narudžbe, šta traži pažnju. */
(function () {
  "use strict";
  const reg = (window.LVParts = window.LVParts || {});

  reg.panel = function (ctx) {
    const { st, esc, ic, LV, LVW } = ctx;
    const P = ctx.panelEl;
    const icn = (mdi, s) => ic(String(mdi).replace(/^mdi-/, "").replace(/^moped$/, "moped-outline"), s);
    const money = (v) => LVW.formatAmount(v, ctx.V.currency);
    const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
    let lastHtml = "";

    /* ---------- pločice sa tekstom ---------- */
    const stPill = (c) => {
      if (c.suspended) return `<span class="lv-st" style="--tint:#fde8e6;--inkc:#b42318;--dc:#e5484d"><i></i>Suspendovan</span>`;
      const m = LVW.LIVE_META[c.live];
      return `<span class="lv-st" style="--tint:${m.tint};--inkc:${m.ink};--dc:${m.dot}"><i></i>${esc(m.label)}</span>`;
    };
    const avatar = (c, size) => {
      const veh = LVW.vehicleView(c.vehicle), m = LVW.LIVE_META[c.live];
      return `<span class="lv-av" style="--tint:${veh.tint};--inkc:${veh.ink};${size ? `width:${size}px;height:${size}px` : ""}" aria-hidden="true">${icn(veh.icon, size ? 26 : 22)}<span class="dot${c.ghost ? " lost" : ""}" style="--dc:${c.suspended ? "#e5484d" : m.dot}"></span></span>`;
    };
    const timingTag = (o) => {
      const t = LV.orderTiming(o);
      return `<span class="lv-tag ${t.tier === "late" ? "lv-tag--red" : t.tier === "critical" ? "lv-tag--red" : t.tier === "warn" ? "lv-tag--amber" : "lv-tag--blue"}">${esc(t.text)}</span>`;
    };

    /* ---------- red kurira ---------- */
    const courierRow = (c, tabbable) => {
      const veh = LVW.vehicleView(c.vehicle);
      const ord = c.delivery ? ctx.V.oById.get(c.delivery.id) : null;
      const tags = [];
      if (c.ghost) tags.push(`<span class="lv-tag lv-tag--red">${ic("signal-off", 14)}Bez signala ${esc(LV.shortAge(c.sigMs))}</span>`);
      if (ord) tags.push(`<span class="lv-tag ${LV.orderTier(ord) === "late" ? "lv-tag--red" : "lv-tag--blue"}">${ic("package-variant-closed", 14)}#${ord.id} · ${esc(LV.orderTiming(ord).text)}</span>`);
      if (c.cash != null && c.cash > 0 && (c.level === "near" || c.level === "over")) tags.push(`<span class="lv-tag ${c.level === "over" ? "lv-tag--red" : "lv-tag--amber"}">${ic("cash-multiple", 14)}${c.level === "over" ? "Preko limita " : "Duguje "}${esc(money(c.cash))}</span>`);
      const seen = c.ghost ? `<span class="seen bad">signal pre ${esc(LV.shortAge(c.sigMs))}</span>` : `<span class="seen">${esc(c.loc ? LV.signalText(c.loc, ctx.V.now) : "nema lokacije")}</span>`;
      const aria = [c.name, `kurir ${c.id}`, c.suspended ? "suspendovan" : LVW.LIVE_META[c.live].label.toLowerCase(), c.ghost ? `bez signala ${LV.shortAge(c.sigMs)}` : "", ord ? `narudžba ${ord.id}, ${LV.orderTiming(ord).text}` : ""].filter(Boolean).join(", ");
      return `<button type="button" role="option" class="lv-row" aria-selected="${st.selId === c.id}" tabindex="${tabbable ? 0 : -1}" data-act="pick-c" data-arg="${c.id}" data-fk="row:${c.id}" aria-label="${esc(aria)}. Otvori detalje">
        ${avatar(c)}<span class="tx"><span class="nm"><b>${esc(c.name)}</b><i>#${c.id}</i></span><span class="sb">${esc(c.phone ? LVW.fmtPhone(c.phone) : "bez telefona")} · ${esc(veh.label)}</span>${tags.length ? `<span class="tags">${tags.join("")}</span>` : ""}</span>
        <span class="en">${stPill(c)}${seen}</span></button>`;
    };

    /* ---------- red narudžbe ---------- */
    const orderRow = (o, tabbable) => {
      const t = LV.orderTiming(o);
      const icon = o.kind === "pending" ? "storefront-outline" : o.kind === "waiting" ? "clock-outline" : "package-variant-closed";
      const sub = [o.kind === "waiting" ? [o.zone, o.km != null ? LV.fmtDist(o.km * 1000) : null].filter(Boolean).join(" · ") : "", o.courier ? `Kurir ${LVW.toLatin(o.courier.name)}` : ""].filter(Boolean).join(" · ");
      const pill = `<span class="lv-ostate ${t.tier}">${t.tier === "late" ? "Kasni" : t.tier === "critical" ? "Hitno" : t.tier === "warn" ? "Čeka" : t.tier === "sched" ? "Zakazano" : t.tier === "stale" ? "Zaostalo" : LV.KIND_LABEL[o.kind]}</span>`;
      return `<button type="button" role="option" class="lv-orow" aria-selected="${st.selOrd === o.id}" tabindex="${tabbable ? 0 : -1}" data-act="pick-o" data-arg="${o.id}" data-fk="ord:${o.id}" aria-label="Narudžba ${o.id}, ${esc(o.restaurant)}, ${esc(LV.KIND_LABEL[o.kind])}, ${esc(t.text)}. Otvori detalje">
        <span class="lv-oi ${t.tier}" aria-hidden="true">${ic(icon, 22)}</span>
        <span class="tx"><span class="nm">${esc(o.restaurant)}<i>#${o.id}</i></span><span class="sb"><span class="${t.tier === "late" || t.tier === "critical" ? "late" : t.tier === "warn" ? "warn" : ""}">${esc(t.text)}</span>${sub ? ` · ${esc(sub)}` : ""}</span></span>
        <span>${pill}</span></button>`;
    };

    /* ---------- detalj kurira ---------- */
    const courierDetail = (c) => {
      const V = ctx.V, m = LVW.LIVE_META[c.live], veh = LVW.vehicleView(c.vehicle);
      const ord = c.delivery ? V.oById.get(c.delivery.id) : null;
      const zone = c.loc ? LV.zoneOfPoint(c.loc.latitude, c.loc.longitude, ctx.D.zones.v || []) : null;
      const pct = V.limit ? Math.round((Math.max(0, c.cash || 0) / V.limit) * 100) : 0;
      const sigLine = c.loc ? (c.ghost ? `<span class="bad">Bez signala ${esc(LV.shortAge(c.sigMs))}</span>` : `Signal ${esc(LV.signalText(c.loc, V.now))}`) : "Lokacija nije poznata";
      const alerts = [];
      if (c.ghost) alerts.push(`<div class="lv-tint lv-tint--bad" role="alert">${ic("signal-off", 22)}<div><b>Signal je izgubljen ${esc(LV.shortAge(c.sigMs))}</b>Server i dalje kaže „${esc(m.label.toLowerCase())}“, ali pozicija je stara. Pozovi kurira ili mu pošalji poruku.<div class="act"><button type="button" data-act="msg" data-arg="where" data-fk="msg-where">Pošalji „Gdje si?“</button></div></div></div>`);
      if (c.suspended) alerts.push(`<div class="lv-tint lv-tint--bad">${ic("account-off-outline", 22)}<div><b>Suspendovan</b>${esc(c.reason || "Razlog nije upisan.")} Ne prima nove narudžbe.</div></div>`);
      const del = ord
        ? `<div class="lv-box ${LV.orderTier(ord) === "late" ? "late" : "blue"}"><span class="lbl">Trenutna dostava</span><b>#${ord.id} · ${esc(ord.restaurant)}</b><div class="r"><span>${esc(ord.address || "Adresa nije poznata")}</span></div><div class="r"><span>${esc(LV.KIND_LABEL[ord.kind])} · <b style="display:inline">${esc(LV.orderTiming(ord).text)}</b></span>${ord.price != null ? `<span>${esc(money(ord.price))}</span>` : ""}</div>${c.loc && ord.pos ? `<div class="r"><span>Do odredišta ${esc(LV.fmtDist(LV.distanceM({ lat: c.loc.latitude, lng: c.loc.longitude }, ord.pos)))} (zračna linija)</span></div>` : ""}<div><button type="button" class="lv-link" data-act="pick-o" data-arg="${ord.id}" data-fk="to-order">Prikaži narudžbu ${ic("chevron-right", 16)}</button></div></div>`
        : c.live === "online" ? `<div class="lv-box"><span class="lbl">Trenutna dostava</span><b>Slobodan, bez narudžbe</b></div>`
        : c.live === "delivering" ? `<div class="lv-box"><span class="lbl">Trenutna dostava</span><b>Server kaže „u dostavi“</b><span>Narudžba se ne vidi u spisku aktivnih dostava${ctx.D.orders.v ? "" : " (narudžbe nisu učitane)"}.</span></div>`
        : `<div class="lv-box"><span class="lbl">Trenutna dostava</span><b>Nije na terenu</b></div>`;
      const cashKv = c.cash == null ? `<div><small>Gotovina</small><b>Nije dostupno</b></div>` : c.cash > 0 ? `<div><small>Duguje firmi</small><b class="${c.level === "over" ? "bad" : c.level === "near" ? "warn" : ""}">${esc(money(c.cash))}</b>${V.limit ? `<span class="lv-meter ${c.level}" role="img" aria-label="${pct}% limita gotovine"><i style="width:${Math.min(100, pct)}%"></i></span>` : ""}</div>` : `<div><small>Gotovina</small><b>${c.cash < 0 ? "Firma duguje " + esc(money(-c.cash)) : "Nema duga"}</b></div>`;
      return `<section class="lv-det" aria-label="Detalji kurira ${esc(c.name)}">
        <div class="lv-dh">${avatar(c, 52)}<div style="min-width:0"><h2 id="lv-dt" tabindex="-1" data-fk="dt">${esc(c.name)}</h2><div class="mt"><span>Kurir #${c.id}</span><span>·</span>${stPill(c)}<span>·</span>${sigLine}</div></div>
          <button type="button" class="lv-x" data-act="close-det" data-fk="det-x" aria-label="Zatvori detalje">${ic("close", 20)}</button></div>
        <div class="lv-qa">
          ${c.phone ? `<a class="lv-qb" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}" data-fk="qa-call" aria-label="Pozovi ${esc(c.name)}">${ic("phone-outline", 22)}Pozovi</a>` : `<span class="lv-qb" aria-disabled="true" title="Kurir nema upisan telefon">${ic("phone-outline", 22)}Pozovi</span>`}
          <button type="button" class="lv-qb" data-act="msg" data-arg="" data-fk="qa-msg" aria-label="Pošalji poruku ${esc(c.name)}">${ic("message-text-outline", 22)}Poruka</button>
          <a class="lv-qb" href="#" data-act="goto" data-arg="Kuriri (kurir ${c.id})" data-fk="qa-more" aria-label="Detalji kurira ${esc(c.name)} na stranici Kuriri">${ic("account-outline", 22)}Detalji</a>
          <a class="lv-qb" href="#" data-act="goto" data-arg="Finansije (kurir ${c.id})" data-fk="qa-money" aria-label="Pogledaj novac kurira ${esc(c.name)}">${ic("cash-register", 22)}Novac</a>
        </div>
        <div class="lv-ds">${alerts.join("")}${del}
          <div class="lv-box"><div class="lv-kv">
            <div><small>Brzina</small><b>${esc(LV.speedText(c.loc, c.live) || "-")}</b></div>
            <div><small>Vozilo</small><b>${esc(veh.label)}</b></div>
            <div><small>Zona</small><b>${esc(zone ? zone.name : c.loc ? "Van zona" : "-")}</b></div>
            ${cashKv}
          </div></div></div>
        <div class="lv-dfoot"><button type="button" class="lv-btn" data-act="locate" data-fk="det-loc" ${c.loc ? "" : "disabled"}>${ic("crosshairs-gps", 20)}Na mapi</button>
          <button type="button" class="lv-btn" data-act="follow" data-fk="det-follow" aria-pressed="${st.follow}" ${c.loc ? "" : "disabled"}>${ic(st.follow ? "eye-off-outline" : "eye-outline", 20)}${st.follow ? "Prestani pratiti" : "Prati na mapi"}</button></div>
      </section>`;
    };

    /* ---------- detalj narudžbe ---------- */
    const orderDetail = (o) => {
      const V = ctx.V, t = LV.orderTiming(o);
      const c = o.courier ? V.byId.get(o.courier.id) : null;
      const icon = o.kind === "pending" ? "storefront-outline" : o.kind === "waiting" ? "clock-outline" : "package-variant-closed";
      return `<section class="lv-det" aria-label="Detalji narudžbe ${o.id}">
        <div class="lv-dh" style="grid-template-columns:52px minmax(0,1fr) auto"><span class="lv-oi ${t.tier}" style="width:52px;height:52px" aria-hidden="true">${ic(icon, 26)}</span><div style="min-width:0"><h2 id="lv-dt" tabindex="-1" data-fk="dt">${esc(o.restaurant)}</h2><div class="mt"><span>Narudžba #${o.id}</span><span>·</span><span class="lv-ostate ${t.tier}">${esc(LV.KIND_LABEL[o.kind])}</span></div></div>
          <button type="button" class="lv-x" data-act="close-det" data-fk="det-x" aria-label="Zatvori detalje">${ic("close", 20)}</button></div>
        <div class="lv-qa" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          ${o.phone ? `<a class="lv-qb" href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ""))}" data-fk="qa-call" aria-label="Pozovi restoran ${esc(o.restaurant)}">${ic("phone-outline", 22)}Restoran</a>` : `<span class="lv-qb" aria-disabled="true" title="Broj restorana nije u ovom odgovoru">${ic("phone-outline", 22)}Restoran</span>`}
          ${c && c.phone ? `<a class="lv-qb" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}" data-fk="qa-callc" aria-label="Pozovi kurira ${esc(c.name)}">${ic("phone-outline", 22)}Kurir</a>` : `<span class="lv-qb" aria-disabled="true" title="${o.courier ? "Kurir nema telefon" : "Nema kurira"}">${ic("phone-outline", 22)}Kurir</span>`}
          <a class="lv-qb" href="#" data-act="goto" data-arg="Dodela narudžbi (narudžba ${o.id})" data-fk="qa-assign" aria-label="Otvori narudžbu ${o.id} u Dodeli narudžbi">${ic("account-search-outline", 22)}${o.kind === "waiting" ? "Dodijeli" : "Otvori"}</a>
        </div>
        <div class="lv-ds"><div class="lv-box ${t.tier === "late" || t.tier === "critical" ? "late" : "blue"}"><span class="lbl">Stanje</span><b>${esc(t.text)}</b>${o.kind === "waiting" ? `<span>Hrana ${o.status === "ready" ? "je gotova" : "se još sprema"}.</span>` : ""}${o.kind === "pending" ? `<span>Restoran nije prihvatio narudžbu. Prihvatanje i odbijanje su u Dodeli narudžbi.</span>` : ""}</div>
          <div class="lv-box"><span class="lbl">Isporuka</span><b>${esc(o.address || "Adresa nije poznata")}</b><div class="lv-kv" style="margin-top:4px">${o.zone ? `<div><small>Zona</small><b>${esc(o.zone)}</b></div>` : ""}${o.km != null ? `<div><small>Udaljenost</small><b>${esc(LV.fmtDist(o.km * 1000))}</b></div>` : ""}${o.price != null ? `<div><small>Cijena dostave</small><b>${esc(money(o.price))}</b></div>` : ""}</div>${o.pos ? "" : `<span>Odredište nema koordinate u odgovoru, pa nije na karti.</span>`}</div>
          ${c ? `<div class="lv-box blue"><span class="lbl">Kurir</span><b>${esc(c.name)}</b><div class="r">${stPill(c)}<span>${c.ghost ? `<b style="display:inline;color:#b42318">Bez signala ${esc(LV.shortAge(c.sigMs))}</b>` : esc(c.loc ? "Signal " + LV.signalText(c.loc, V.now) : "Lokacija nije poznata")}</span></div><div><button type="button" class="lv-link" data-act="pick-c" data-arg="${c.id}" data-fk="to-courier">Prikaži kurira ${ic("chevron-right", 16)}</button></div></div>` : ""}
        </div>
        <div class="lv-dfoot"><button type="button" class="lv-btn" data-act="locate" data-fk="det-loc" ${o.pos ? "" : "disabled"}>${ic("crosshairs-gps", 20)}Na mapi</button></div>
      </section>`;
    };

    /* ---------- šta traži pažnju (narudžbe) ---------- */
    const attentionBlock = () => {
      const items = ctx.V.att.items;
      if (!items.length) return "";
      const show = st.attAll ? items : items.slice(0, 4);
      const rows = show.map((it) => {
        const hot = it.sev >= 55;
        const icon = it.kind.startsWith("courier") ? "signal-off" : it.kind === "restaurant" ? "storefront-outline" : "clock-alert-outline";
        const call = it.tel ? `<a class="call" href="tel:${esc(String(it.tel).replace(/[^\d+]/g, ""))}" data-fk="att-call:${it.id}" aria-label="Pozovi: ${esc(it.title)}">${ic("phone-outline", 18)}Pozovi</a>` : "";
        return `<div class="it" role="group" aria-label="${esc(it.title)}"><span class="ai${hot ? " hot" : ""}" aria-hidden="true">${ic(icon, 20)}</span><button type="button" class="mn" data-act="att" data-arg="${esc(it.id)}" data-fk="att:${it.id}"><b>${esc(it.title)}</b><em>${esc(it.sub)}</em></button>${call}</div>`;
      }).join("");
      const more = items.length > 4 ? `<div style="padding:2px 10px 6px;border-top:1px solid var(--line);display:flex;justify-content:center"><button type="button" class="lv-link" data-act="att-all" data-fk="att-all">${st.attAll ? "Prikaži manje" : `Prikaži sve (${items.length})`}</button></div>` : "";
      return `<h3 class="lv-gt" id="lv-att-h">Traži pažnju<span class="lv-badge lv-badge--bad">${items.length}</span></h3><div class="lv-att" role="group" aria-labelledby="lv-att-h">${rows}${more}</div>`;
    };

    /* ---------- tijelo panela ---------- */
    const couriersBody = () => {
      const V = ctx.V;
      if (V.pageState === "loading") return `<div role="status" aria-label="Učitavam kurire">${[0, 1, 2, 3, 4].map(() => `<div class="lv-skr"><div class="lv-skel a"></div><div class="lv-skel b"></div><div class="lv-skel c"></div></div>`).join("")}</div>`;
      if (V.pageState === "error") return `<div class="lv-pt"><div class="lv-tint lv-tint--bad" role="alert">${ic("cloud-off-outline", 22)}<div><b>Ne mogu da učitam kurire</b>Server ne odgovara. Prazan spisak bi izgledao kao da firma nema kurira, zato ga ne pokazujem.<div class="act"><button type="button" data-act="retry" data-fk="retry-list">Pokušaj ponovo</button></div></div></div></div>`;
      if (V.pageState === "empty") return `<div class="lv-empty">${ic("account-group-outline", 34)}<b>Firma još nema kurira</b><span>Dodaj prvog kurira na stranici Kuriri.</span><a class="lv-btn lv-btn--pri" href="#" data-act="goto" data-arg="Kuriri" data-fk="add-list">Dodaj kurira</a></div>`;
      const list = LV.sortCouriers(LV.filterCouriers(V.cs, { q: st.q, live: st.live, flags: st.flags }, V.now), st.sort, V.now);
      const sel = st.selId != null ? V.byId.get(st.selId) : null;
      const shown = list.slice(0, st.shown);
      const tabIdx = shown.findIndex((c) => c.id === st.selId);
      const pre = [];
      if (!ctx.D.locs.v && ctx.D.locs.state !== "loading") pre.push(`<div class="lv-pt"><div class="lv-tint lv-tint--warn">${ic("map-marker-off-outline", 22)}<div><b>Pozicije kurira nisu stigle</b>Stanje uživo (u dostavi, slobodni, offline) nije pouzdano dok se ne vrate. Ostalo radi.</div></div></div>`);
      if (ctx.D.bal.failed && st.flags.includes("limit")) pre.push(`<div class="lv-pt"><div class="lv-tint lv-tint--warn">${ic("cash-multiple", 22)}<div><b>Gotovina nije osvježena</b>Oznake limita mogu biti zastarjele.</div></div></div>`);
      const head = `<p class="lv-sub" aria-live="polite">${list.length === V.cs.length ? `${list.length} ${LV.plural(list.length, "kurir", "kurira", "kurira")}` : `${list.length} od ${V.cs.length} kurira`}</p>`;
      if (!list.length) return `${pre.join("")}${sel ? courierDetail(sel) : ""}${head}<div class="lv-empty">${ic("magnify", 34)}<b>Nema kurira za ovaj filter</b><span>${st.q ? `Pretraga „${esc(st.q)}“ nije našla nikoga.` : "Promijeni stanje ili oznaku."}</span><button type="button" class="lv-btn" data-act="clear" data-fk="clear-list">Očisti filtere</button></div>`;
      return `${pre.join("")}${sel ? courierDetail(sel) : ""}${head}<div role="listbox" aria-label="Kuriri" data-list="k">${shown.map((c, i) => courierRow(c, tabIdx >= 0 ? i === tabIdx : i === 0)).join("")}</div>${list.length > shown.length ? `<div class="lv-more"><button type="button" class="lv-btn lv-btn--text" data-act="more" data-fk="more">Prikaži još (${list.length - shown.length})</button></div>` : ""}`;
    };

    const ordersBody = () => {
      const V = ctx.V, D = ctx.D;
      if (V.pageState === "loading" || (D.orders.state === "loading" && !D.orders.v)) return `<div role="status" aria-label="Učitavam narudžbe">${[0, 1, 2, 3].map(() => `<div class="lv-skr"><div class="lv-skel a"></div><div class="lv-skel b"></div><div class="lv-skel c"></div></div>`).join("")}</div>`;
      if (D.orders.state === "error" && !D.orders.v) return `<div class="lv-pt"><div class="lv-tint lv-tint--bad" role="alert">${ic("cloud-off-outline", 22)}<div><b>Ne mogu da učitam narudžbe</b>Prazan spisak bi izgledao kao da nema narudžbi, zato ga ne pokazujem. Kuriri i karta rade.<div class="act"><button type="button" data-act="retry" data-fk="retry-orders">Pokušaj ponovo</button></div></div></div></div>`;
      const all = V.orders || [];
      const stale = D.orders.failed ? `<div class="lv-pt"><div class="lv-tint lv-tint--warn" role="status">${ic("cloud-off-outline", 22)}<div><b>Narudžbe nisu osvježene</b>Prikazano je zadnje poznato stanje.<div class="act"><button type="button" data-act="retry" data-fk="retry-orders">Pokušaj ponovo</button></div></div></div></div>` : "";
      const sel = st.selOrd != null ? V.oById.get(st.selOrd) : null;
      const q = fold(st.oq).trim();
      const byQ = q ? all.filter((o) => fold(o.restaurant).includes(q) || String(o.id).includes(q.replace("#", ""))) : all;
      const list = LV.sortOrders(LV.filterOrders(byQ, { group: st.ogroup }));
      const cnt = (g) => LV.filterOrders(byQ, { group: g }).length;
      const fil = [["all", "Sve"], ["late", "Kasne"], ["wait", "Čeka kurira"], ["rest", "Čeka restoran"], ["run", "U toku"]].map(([g, l]) => `<button type="button" class="lv-ch2" aria-pressed="${st.ogroup === g}" data-act="ofil" data-arg="${g}" data-fk="ofil-${g}">${l}<em style="font-style:normal;color:#657083;font-weight:800">${cnt(g)}</em></button>`).join("");
      const groups = st.ogroup === "all"
        ? [["waiting", "Čeka kurira"], ["pending", "Čeka restoran"], ["run", "U toku"]].map(([k, label]) => {
            const g = list.filter((o) => (k === "run" ? o.kind === "booked" || o.kind === "picked" : o.kind === k));
            return g.length ? `<h3 class="lv-gt">${label}<span class="lv-badge">${g.length}</span></h3>${g.map((o, i) => orderRow(o, false)).join("")}` : "";
          }).join("")
        : list.map((o) => orderRow(o, false)).join("");
      const empty = !list.length ? `<div class="lv-empty">${ic("package-variant-closed", 34)}<b>${all.length ? "Nema narudžbi za ovaj filter" : "Trenutno nema narudžbi"}</b><span>${all.length ? "Promijeni grupu iznad." : "Nove narudžbe se pojave ovdje čim ih restoran prihvati."}</span></div>` : "";
      return `${stale}${sel ? orderDetail(sel) : ""}${st.ogroup === "all" && !q ? attentionBlock() : ""}<div class="lv-ofil" role="group" aria-label="Grupa narudžbi">${fil}</div><div role="listbox" aria-label="Narudžbe" data-list="n">${groups}${empty}</div><p class="lv-sub" style="padding:8px 16px">Karta pokazuje odredišta koja traže pažnju. Dodjela kurira i prihvatanje restorana ostaju u Dodeli narudžbi.</p>`;
    };

    /* ---------- crtanje ---------- */
    const render = () => {
      const V = ctx.V, c = V.counts, a = V.att ? V.att.counts : null;
      const tabs = [["k", "Kuriri", c ? c.all : null, false], ["n", "Narudžbe", V.orders && a ? a.waiting + a.restaurant + a.late : null, a ? a.late + a.waitingCritical + a.restaurantCritical > 0 : false]];
      const tabHtml = tabs.map(([k, label, n, hot]) => `<button type="button" role="tab" class="lv-tab" id="lv-t-${k}" aria-selected="${st.tab === k}" aria-controls="lv-pp" tabindex="${st.tab === k ? 0 : -1}" data-act="tab" data-arg="${k}" data-fk="tab-${k}">${label}${n != null && V.pageState === "ready" ? `<span class="lv-badge${hot ? " lv-badge--bad" : ""}">${n}</span>` : ""}</button>`).join("");
      const placeholder = st.tab === "k" ? "Ime, telefon ili ID" : "Restoran ili #ID";
      const val = st.tab === "k" ? st.q : st.oq;
      const sort = st.tab === "k" ? `<label class="lv-sel"><span class="sr">Redoslijed</span><select data-act-change="sort" data-fk="sort" aria-label="Redoslijed kurira">${Object.entries(LV.SORTS).map(([k, l]) => `<option value="${k}"${st.sort === k ? " selected" : ""}>${l}</option>`).join("")}</select>${ic("chevron-down", 18)}</label>` : "";
      const tool = `<div class="lv-tool"><label class="lv-srch"><span class="sr">${placeholder}</span>${ic("magnify", 20)}<input type="search" id="lv-q" data-fk="q" value="${esc(val)}" placeholder="${placeholder}" autocomplete="off" ${V.pageState !== "ready" ? "disabled" : ""}>${val ? `<button type="button" class="x" data-act="qclear" data-fk="qx" aria-label="Obriši pretragu">${ic("close", 18)}</button>` : `<kbd aria-hidden="true">/</kbd>`}</label>${sort}</div>`;
      const body = st.tab === "k" ? couriersBody() : ordersBody();
      const grip = `<button type="button" class="lv-psh" data-act="snap" data-arg="next" data-fk="grip" aria-label="${st.snap === "peek" ? "Prikaži spisak" : st.snap === "half" ? "Povećaj panel" : "Smanji panel"}" aria-expanded="${st.snap !== "peek"}"><i></i></button>`;
      // na telefonu, dok je kurir ili narudžba izabran, detalj dobija prostor umjesto pretrage
      const hideTool = !st.wide && (st.selId != null || st.selOrd != null);
      const html = `${grip}<div class="lv-ptabs" role="tablist" aria-label="Sadržaj panela">${tabHtml}</div>${hideTool ? "" : tool}<div class="lv-pbody" id="lv-pp" role="tabpanel" aria-labelledby="lv-t-${st.tab}" tabindex="-1">${body}</div>`;
      if (html === lastHtml) return;
      lastHtml = html;
      const oldBody = P.querySelector(".lv-pbody");
      const keep = oldBody ? oldBody.scrollTop : 0;
      const fk = ctx.focusKeyIn(P);
      P.innerHTML = html;
      const nb = P.querySelector(".lv-pbody"); if (nb) nb.scrollTop = keep;
      ctx.restoreFocus(P, fk);
      P.setAttribute("data-snap", st.snap);
    };

    /* ---------- radnje ---------- */
    const A = ctx.acts;
    A.tab = (k) => { st.tab = k; if (!st.wide && st.snap === "peek") st.snap = "half"; ctx.render(); const t = P.querySelector(`#lv-t-${k}`); if (t) t.focus({ preventScroll: true }); };
    A["pick-c"] = (id) => ctx.selectCourier(Number(id));
    A["pick-o"] = (id) => ctx.selectOrder(Number(id));
    A["close-det"] = () => { const id = st.selId != null ? `row:${st.selId}` : `ord:${st.selOrd}`; ctx.clearSelection(); const f = P.querySelector(`[data-fk="${CSS.escape(id)}"]`); if (f) f.focus({ preventScroll: true }); };
    A.more = () => { st.shown += 12; ctx.render(); };
    A.ofil = (g) => { st.ogroup = g; ctx.render(); };
    A.qclear = () => { if (st.tab === "k") st.q = ""; else st.oq = ""; st.shown = 12; ctx.render(); const i = P.querySelector("#lv-q"); if (i) i.focus(); };
    A.locate = () => { if (st.selId != null) ctx.parts.map.flyToCourier(st.selId); else if (st.selOrd != null) ctx.parts.map.flyToOrder(st.selOrd); if (!st.wide) { st.snap = "peek"; ctx.render(); } };
    A.follow = () => { st.follow = !st.follow; if (st.follow) { ctx.parts.map.flyToCourier(st.selId); if (!st.wide) { st.snap = "peek"; } } ctx.render(); };
    A["att-all"] = () => { st.attAll = !st.attAll; ctx.render(); };
    A.att = (id) => {
      const it = ctx.V.att.items.find((x) => x.id === id);
      if (!it) return;
      if (it.kind === "courier-lost" || it.kind === "courier-lost-free") ctx.selectCourier(it.courierId);
      else ctx.selectOrder(it.orderId);
    };
    A.msg = (arg) => { const c = ctx.V.byId.get(st.selId); if (c) ctx.openSheet(ctx.sheets.msg.make(c, arg || null)); };

    const onInput = (ev) => {
      if (ev.target.id === "lv-q") {
        if (st.tab === "k") { st.q = ev.target.value; st.shown = 12; } else st.oq = ev.target.value;
        ctx.render();
      }
    };
    const onChange = (ev) => {
      const t = ev.target;
      if (t.matches("select[data-act-change=sort]")) { st.sort = t.value; st.shown = 12; ctx.render(); }
    };

    // strelice po spisku (jedno zaustavljanje, roving tabindex), Enter otvara, Home/End
    const onKey = (ev) => {
      const row = ev.target.closest && ev.target.closest(".lv-row,.lv-orow");
      if (row && ["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) {
        const rows = [...row.parentElement.querySelectorAll(row.classList.contains("lv-row") ? ".lv-row" : ".lv-orow")];
        const i = rows.indexOf(row);
        const n = ev.key === "Home" ? 0 : ev.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)));
        ev.preventDefault();
        rows.forEach((r, k) => r.setAttribute("tabindex", k === n ? "0" : "-1"));
        rows[n].focus({ preventScroll: false });
        return;
      }
      const tab = ev.target.closest && ev.target.closest('[role="tab"]');
      if (tab && ["ArrowLeft", "ArrowRight"].includes(ev.key)) { ev.preventDefault(); A.tab(st.tab === "k" ? "n" : "k"); }
    };

    // donji list na telefonu: povuci ručku
    let gdrag = null;
    P.addEventListener("pointerdown", (ev) => { const g = ev.target.closest(".lv-psh"); if (!g) return; gdrag = { y: ev.clientY, moved: false }; g.setPointerCapture && g.setPointerCapture(ev.pointerId); });
    P.addEventListener("pointermove", (ev) => { if (gdrag && Math.abs(ev.clientY - gdrag.y) > 6) gdrag.moved = true; });
    P.addEventListener("pointerup", (ev) => {
      if (!gdrag) return;
      const dy = ev.clientY - gdrag.y, moved = gdrag.moved; gdrag = null;
      if (!moved) return;
      ev.preventDefault();
      const order = ["peek", "half", "full"], i = order.indexOf(st.snap);
      const n = dy < -30 ? Math.min(2, i + 1) : dy > 30 ? Math.max(0, i - 1) : i;
      st.snap = order[n]; ctx.render();
      // klik poslije povlačenja ne smije dodatno promijeniti visinu
      const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
      P.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => P.removeEventListener("click", swallow, true), 350);
    });

    return {
      render,
      onInput, onChange, onKey,
      focusSearch() { const i = P.querySelector("#lv-q"); if (i) { i.focus(); i.select && i.select(); } },
      revealSelected() { const b = P.querySelector(".lv-pbody"); if (b) b.scrollTop = 0; },
      start() { render(); },
      destroy() {},
    };
  };
})();
