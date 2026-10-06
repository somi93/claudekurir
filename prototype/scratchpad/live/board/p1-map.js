/* Prototip "Kuriri uživo": karta. Shematska (SVG, bez pločica jer tabla ne smije zvati vanjske adrese); u aplikaciji je OpenStreetMap + Leaflet, a ponašanje
   (početni pogled, markeri po courierId, klasteri koji ne kriju probleme, slojevi, praćenje) je izvor za portovanje. */
(function () {
  "use strict";
  const reg = (window.LVParts = window.LVParts || {});
  let uid = 0;

  // Šematska Banja Luka: rijeka, parkovi, glavne ulice (metri od ishodišta, y prema sjeveru)
  const RIVER = [[1500, -6200], [1380, -4600], [1620, -3400], [1200, -2300], [820, -1400], [700, -500], [900, 300], [1260, 1300], [1300, 2300], [1000, 3400], [700, 4600], [820, 6200]];
  const band = (pts, w) => {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
      const nx = -dy / n, ny = dx / n;
      const ww = w * (0.8 + 0.4 * Math.sin(i * 1.3));
      L.push([pts[i][0] + nx * ww, pts[i][1] + ny * ww]); R.push([pts[i][0] - nx * ww, pts[i][1] - ny * ww]);
    }
    return [...L, ...R.reverse()];
  };
  const ROADS = [
    [[-4800, -180], [-2400, -90], [0, 40], [1400, 140], [2600, 320], [4800, 430]],
    [[-380, -4800], [-330, -1800], [-210, 0], [-260, 1800], [-100, 4800]],
    [[-120, 0], [900, 1700], [2000, 2900], [3400, 3300], [4600, 3400]],
    [[-3800, -1500], [-1700, -2200], [500, -2400], [2600, -1900], [4200, -700]],
    [[1100, -200], [2100, -800], [3300, -1000], [4600, -900]],
    [[-2600, 1800], [-1200, 1500], [-250, 1500], [1250, 1600]],
    [[-3000, -600], [-1600, -700], [-300, -650], [900, -900]],
  ];
  const PARKS = [
    { c: [700, -200], r: 260 }, { c: [-720, 360], r: 220 }, { c: [1500, -2500], r: 700 }, { c: [-1600, 3400], r: 950 }, { c: [-2600, -1200], r: 520 }, { c: [3400, 2000], r: 640 },
  ];
  const poly = (pts) => pts.map((p) => `${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(" ");
  const blob = (c, r, n = 14, seed = 1) => { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = 0.82 + 0.28 * Math.abs(Math.sin(i * 2.1 + seed)); o.push([c[0] + Math.cos(a) * r * k, c[1] + Math.sin(a) * r * k]); } return o; };
  const URBAN = [[-3600, -2000], [-1800, -2600], [1200, -2700], [3400, -1800], [4300, 600], [4500, 3200], [3000, 4000], [200, 4200], [-2200, 3400], [-3900, 1200]];
  const gridLines = () => {
    const out = [];
    for (let x = -4200; x <= 4600; x += 170) out.push(`<line x1="${x}" y1="-2700" x2="${x + 140 * Math.sin(x / 700)}" y2="4300"/>`);
    for (let y = -2700; y <= 4300; y += 190) out.push(`<line x1="-4000" y1="${y}" x2="4700" y2="${y + 130 * Math.cos(y / 600)}"/>`);
    return out.join("");
  };

  reg.map = function (ctx) {
    const { st, esc, ic, LV, mapwrap } = ctx;
    const id = ++uid;
    mapwrap.innerHTML = `<div class="lv-map" id="lv-map-${id}" data-fk="map" tabindex="0" role="application" aria-label="Mapa kurira. Strelice pomjeraju mapu, plus i minus mijenjaju razmjeru, nula prikazuje sve."></div>
      <div class="lv-notes" data-m="notes"></div><div class="lv-mc" data-m="mc"></div><div class="lv-leg" data-m="leg"></div><div class="lv-scale" data-m="scale" aria-hidden="true"></div><div class="lv-mnote" data-m="mnote" hidden></div>`;
    const mapEl = mapwrap.querySelector(".lv-map");
    const q = (s) => mapwrap.querySelector(`[data-m="${s}"]`);
    mapEl.innerHTML = `<svg class="lv-base" aria-hidden="true"><defs><clipPath id="lv-urb-${id}"><polygon points="${poly(URBAN)}"/></clipPath></defs>
      <g data-g="w"><rect x="-30000" y="-30000" width="60000" height="60000" fill="var(--land)"/>
      <polygon points="${poly(URBAN)}" fill="var(--block)"/>
      <g clip-path="url(#lv-urb-${id})" stroke="#fff" stroke-width="1" opacity=".55" fill="none">${gridLines()}</g>
      ${PARKS.map((p, i) => `<polygon points="${poly(blob(p.c, p.r, 14, i + 1))}" fill="var(--park)"/>`).join("")}
      ${ROADS.map((r) => `<polyline points="${poly(r)}" fill="none" stroke="var(--road-edge)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}
      ${ROADS.map((r) => `<polyline points="${poly(r)}" fill="none" stroke="var(--road)" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}
      <polygon points="${poly(band(RIVER, 110))}" fill="var(--water)"/>
      <g data-g="zones"></g></g></svg>
      <svg class="lv-lines" data-l="lines" aria-hidden="true"></svg><div class="lv-ovl" data-o="ovl"></div>`;
    const gW = mapEl.querySelector('[data-g="w"]'), gZ = mapEl.querySelector('[data-g="zones"]'), lines = mapEl.querySelector('[data-l="lines"]'), ovl = mapEl.querySelector('[data-o="ovl"]');

    let size = { w: 0, h: 0 };
    let view = LV.view(0, 0, 13);
    let viewSet = false;
    const els = new Map(); // key -> { el, m:{x,y}, sig }
    let anim = null;
    const trails = new Map();
    ctx.mapView = () => ({ ...view });

    const measure = () => { size = { w: mapEl.clientWidth, h: mapEl.clientHeight }; return size.w > 0 && size.h > 0; };
    const applyView = () => {
      const k = LV.ppm(view.z);
      gW.setAttribute("transform", `translate(${(size.w / 2 - view.cx * k).toFixed(2)} ${(size.h / 2 + view.cy * k).toFixed(2)}) scale(${k} ${-k})`);
      mapEl.classList.toggle("show-lb", view.z >= 14.5 && st.layers.labels);
      mapEl.classList.toggle("hide-lb", !st.layers.labels);
    };
    const place = (e) => {
      const s = LV.toScreen(e.m, view, size);
      e.el.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px)`;
    };
    const reposition = () => { applyView(); for (const e of els.values()) place(e); drawLines(); drawZones(); drawScale(); };

    /* ---------- pogled ---------- */
    const setView = (v) => { view = { cx: v.cx, cy: v.cy, z: LV.clamp(v.z, LV.ZMIN, LV.ZMAX) }; };
    const flyTo = (target, ms = 450) => {
      if (anim) cancelAnimationFrame(anim.raf);
      const from = { ...view }, t0 = performance.now();
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || ms === 0) { setView(target); update(); return; }
      const step = (t) => {
        const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
        view = { cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e, z: LV.clamp(from.z + (target.z - from.z) * e, LV.ZMIN, LV.ZMAX) };
        if (p < 1) { reposition(); anim.raf = requestAnimationFrame(step); } else { anim = null; update(); }
      };
      anim = { raf: requestAnimationFrame(step) };
    };
    const zoomAt = (dz, px, py) => {
      const z2 = LV.clamp(view.z + dz, LV.ZMIN, LV.ZMAX);
      if (z2 === view.z) return;
      const m = LV.fromScreen({ x: px, y: py }, view, size);
      const k2 = LV.ppm(z2);
      view = { z: z2, cx: m.x - (px - size.w / 2) / k2, cy: m.y + (py - size.h / 2) / k2 };
      st.follow = false;
      update();
    };
    const userMoved = () => { st.userMoved = true; if (st.follow) { st.follow = false; ctx.renderPanel(); } };

    const courierPoints = (recentOnly = true) => {
      const V = ctx.V;
      const list = V.cs.filter((c) => c.loc && (!recentOnly || c.live !== "offline" || (c.sigMs != null && c.sigMs <= LV.RECENT_MS)));
      return list.length ? list : V.cs.filter((c) => c.loc);
    };
    const fitAll = (ms = 450) => {
      if (!measure()) return;
      const V = ctx.V;
      const pts = courierPoints().map((c) => LV.toMeters(c.loc.latitude, c.loc.longitude));
      if (st.layers.orders && V.orders) for (const o of V.orders) if (o.pos && (o.kind === "waiting" || LV.orderTier(o) === "late")) pts.push(LV.toMeters(o.pos.lat, o.pos.lng));
      const bottom = st.wide ? 0 : 110;
      const v = pts.length ? LV.fitView(pts, size, { bottom }) : LV.initialView({ couriers: V.cs, zones: ctx.D.zones.v || [], size, now: V.now, bottom }).view;
      st.follow = false; st.userMoved = false;
      flyTo(v, ms);
    };
    const ensureInitial = () => {
      if (viewSet || !ctx.booted || !measure()) return;
      const V = ctx.V;
      const iv = LV.initialView({ couriers: V.cs, zones: ctx.D.zones.v || [], size, now: V.now, bottom: st.wide ? 0 : 110 });
      setView(iv.view); viewSet = true; ctx.initialReason = iv.reason;
      update();
    };
    ctx.onBooted = ensureInitial;

    /* ---------- crtanje ---------- */
    const html = (key, sig, make) => {
      let e = els.get(key);
      if (!e) {
        const node = document.createElement("div"); node.innerHTML = make(); const elx = node.firstElementChild;
        e = { el: elx, m: { x: 0, y: 0 }, sig: null, seen: true };
        ovl.appendChild(elx); els.set(key, e);
      }
      if (e.sig !== sig) {
        const node = document.createElement("div"); node.innerHTML = make(); const fresh = node.firstElementChild;
        const had = document.activeElement === e.el;
        e.el.replaceWith(fresh); e.el = fresh; e.sig = sig;
        if (had) fresh.focus({ preventScroll: true });
      }
      e.seen = true;
      return e;
    };

    const markerState = (c) => (c.suspended ? "susp" : c.live);
    const lbl = (c) => `${c.name}, ${LVW_LIVE(c)}${c.ghost ? `, bez signala ${LV.shortAge(c.sigMs)}` : ""}${c.suspended ? ", suspendovan" : ""}`;
    const LVW_LIVE = (c) => window.LVW.LIVE_META[c.live].label.toLowerCase();

    // bez aktivnog filtera niko se ne sklanja (zum i pomjeranje ne smiju svaki put filtrirati cijeli spisak)
    let vsKey = "", vsSet = null;
    const visibleSet = () => {
      const V = ctx.V;
      if (st.live === "all" && !st.flags.length && !st.q) return null;
      const key = `${st.live}|${st.flags.join()}|${st.q}`;
      if (vsSet && vsKey === key && vsSet.v === V) return vsSet.s;
      const s = new Set(LV.filterCouriers(V.cs, { q: st.q, live: st.live, flags: st.flags }, V.now).map((c) => c.id));
      vsKey = key; vsSet = { v: V, s };
      return s;
    };

    let shownCouriers = 0;
    const update = () => {
      if (!measure()) return;
      shownCouriers = 0;
      const V = ctx.V;
      if (!viewSet) ensureInitial();
      applyView();
      for (const e of els.values()) e.seen = false;
      const ready = V.pageState === "ready";
      const items = [];
      if (ready) {
        const vis = visibleSet();
        for (const c of V.cs) {
          if (!c.loc) continue;
          if (vis && !vis.has(c.id) && c.id !== st.selId) continue;
          const m = LV.toMeters(c.loc.latitude, c.loc.longitude);
          const s = LV.toScreen(m, view, size);
          if (s.x < -60 || s.y < -60 || s.x > size.w + 60 || s.y > size.h + 60) continue;
          const linked = st.selOrd != null && c.delivery && c.delivery.id === st.selOrd;
          const late = c.delivery && c.delivery.minutesUntilDelivery < 0;
          items.push({ id: c.id, x: s.x, y: s.y, m, live: c.live, c, pinned: c.ghost || c.id === st.selId || linked || late || view.z >= 15 });
        }
      }
      // klasteri: samo ispod zuma 15; problemi i izabrani se nikad ne sklanjaju
      const groups = LV.clusterMarkers(items, 40);
      shownCouriers = groups.length;
      for (const g of groups) {
        if (g.cluster) {
          const cl = g.cluster, tot = cl.count;
          const a = (cl.delivering / tot) * 100, b = a + (cl.online / tot) * 100;
          const key = "cl:" + cl.ids.slice().sort((x, y) => x - y).join(",");
          const e = html(key, `${tot}|${a.toFixed(0)}|${b.toFixed(0)}`, () => `<button type="button" class="lv-cl" style="--a:${a}%;--b:${b}%" data-act="cluster" data-arg="${cl.ids.join(",")}" data-fk="cl-${tot}" tabindex="-1" aria-label="${tot} kurira na ovom mjestu, ${cl.delivering} u dostavi, ${cl.online} slobodnih. Približi."><span>${tot}</span></button>`);
          e.m = LV.fromScreen({ x: cl.x, y: cl.y }, view, size); place(e);
        } else {
          const it = g.one, c = it.c;
          const sel = c.id === st.selId;
          const mv = c.loc.speed != null && Number(c.loc.speed) >= 1 && c.loc.heading != null && (c.live === "delivering" || c.live === "online") && c.sig !== "lost";
          const ini = window.LVW.initials(window.LVW.toLatin(c.first), window.LVW.toLatin(c.last), c.email);
          const sig = `${c.live}|${c.ghost}|${c.suspended}|${sel}|${mv ? Math.round(c.loc.heading / 5) : "x"}|${ini}|${(c.name || "").length}`;
          const first = window.LVW.toLatin(c.first || "").split(" ")[0] || "";
          const lastI = window.LVW.toLatin(c.last || "").charAt(0);
          const e = html("c:" + c.id, sig, () => `<button type="button" class="lv-mk lv-mk--${c.live}${c.ghost ? " is-lost" : ""}${c.suspended ? " is-susp" : ""}${sel ? " is-sel" : ""}${c.live === "offline" ? " is-dim" : ""}" data-act="pick-m" data-arg="${c.id}" data-fk="mk-${c.id}" tabindex="-1" aria-label="${esc(lbl(c))}">${mv ? `<span class="lv-mk-ar" style="--hd:${c.loc.heading}deg"></span>` : ""}<span class="lv-mk-pulse"></span><span class="lv-mk-in">${esc(ini)}</span><span class="lv-mk-lb">${esc(first)}${lastI ? " " + esc(lastI) + "." : ""}</span></button>`);
          e.m = it.m; place(e); e.el.style.zIndex = sel ? 9 : c.ghost ? 6 : c.live === "delivering" ? 4 : c.live === "online" ? 3 : 2;
        }
      }
      // narudžbe: odredišta koja traže pažnju (ako red nosi koordinate)
      const pins = [];
      if (ready && st.layers.orders && V.orders) {
        const selC = st.selId != null ? V.byId.get(st.selId) : null;
        for (const o of V.orders) {
          if (!o.pos) continue;
          const tier = LV.orderTier(o);
          const isSel = o.id === st.selOrd;
          const rel = selC && selC.delivery && selC.delivery.id === o.id;
          const show = isSel || rel || o.kind === "waiting" || (o.kind === "pending" && tier !== "stale") || ((o.kind === "picked" || o.kind === "booked") && tier === "late");
          if (!show) continue;
          if (o.kind === "waiting" && tier === "sched" && !isSel) continue;
          pins.push({ o, tier, isSel, rel });
        }
      }
      for (const p of pins) {
        const o = p.o;
        const m = LV.toMeters(o.pos.lat, o.pos.lng);
        const s = LV.toScreen(m, view, size);
        if (s.x < -80 || s.y < -80 || s.x > size.w + 80 || s.y > size.h + 80) continue;
        const icon = o.kind === "pending" ? "storefront-outline" : o.kind === "waiting" ? "clock-outline" : "package-variant-closed";
        const cls = `lv-op lv-op--${p.rel && !p.isSel ? "target" : p.tier}${p.isSel ? " is-sel" : ""}`;
        const e = html("o:" + o.id, `${p.tier}|${p.isSel}|${p.rel}|${o.kind}`, () => `<button type="button" class="${cls}" data-act="pick-op" data-arg="${o.id}" data-fk="op-${o.id}" tabindex="-1" aria-label="Narudžba ${o.id}, ${esc(o.restaurant)}, ${esc(LV.orderTiming(o).text)}">${ic(icon, 16)}#${o.id}</button>`);
        e.m = m; place(e); e.el.style.zIndex = p.isSel ? 7 : 1;
      }
      for (const [k, e] of els) if (!e.seen) { e.el.remove(); els.delete(k); }
      drawLines(); drawZones(); drawScale(); drawControls(); drawNotes();
    };

    const drawZones = () => {
      if (!viewSet) return;
      const V = ctx.V;
      const zones = (ctx.D.zones.v || []).filter(LV.hasGeo);
      if (!st.layers.zones || V.pageState !== "ready") { gZ.innerHTML = ""; ovl.querySelectorAll(".lv-zl").forEach((n) => n.remove()); return; }
      const k = LV.ppm(view.z);
      gZ.innerHTML = zones.map((z) => { const m = LV.toMeters(z.center_lat, z.center_lng); return `<circle cx="${m.x.toFixed(0)}" cy="${m.y.toFixed(0)}" r="${z.radius_meters}" fill="#2f6fed" fill-opacity=".035" stroke="#2f6fed" stroke-opacity=".5" stroke-width="1.3" stroke-dasharray="6 5"/>`; }).join("");
      const counts = V._zc || (V._zc = LV.zoneCounts(V.cs, zones));
      const have = new Set();
      for (const z of zones) {
        const m = LV.toMeters(z.center_lat, z.center_lng);
        const s = LV.toScreen(m, view, size);
        const key = "z:" + z.id; have.add(key);
        const c = counts.get(z.id) || { delivering: 0, online: 0, lost: 0 };
        const bits = [`<b>${c.delivering}</b> u dostavi`, `${c.online} slobodnih`, ...(c.lost ? [`<span class="lz">${c.lost} bez signala</span>`] : [])];
        let n = ovl.querySelector(`.lv-zl[data-z="${z.id}"]`);
        if (!n) { n = document.createElement("div"); n.className = "lv-zl"; n.setAttribute("data-z", z.id); ovl.appendChild(n); }
        const h = `${esc(z.name)}<small>${bits.join(" · ")}</small>`;
        if (n.innerHTML !== h) n.innerHTML = h;
        n.style.transform = `translate(${s.x.toFixed(1)}px,${(s.y - z.radius_meters * k + 8).toFixed(1)}px) translate(-50%,0)`;
        n.style.left = "0"; n.style.top = "0";
      }
      ovl.querySelectorAll(".lv-zl").forEach((n) => { if (!have.has("z:" + n.getAttribute("data-z"))) n.remove(); });
    };

    const drawLines = () => {
      if (!viewSet) return;
      const V = ctx.V;
      const out = [];
      const sc = (lat, lng) => LV.toScreen(LV.toMeters(lat, lng), view, size);
      let c = st.selId != null ? V.byId.get(st.selId) : null;
      let o = null;
      if (c && c.delivery) o = V.oById.get(c.delivery.id) || null;
      if (st.selOrd != null) { o = V.oById.get(st.selOrd) || null; c = o && o.courier ? V.byId.get(o.courier.id) : null; }
      if (st.layers.orders && c && c.loc && o && o.pos) {
        const a = sc(c.loc.latitude, c.loc.longitude), b = sc(o.pos.lat, o.pos.lng);
        out.push(`<line class="lv-route-bg" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><line class="lv-route" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
      }
      const sel = st.selId != null ? st.selId : (c ? c.id : null);
      const tr = sel != null ? trails.get(sel) : null;
      if (tr && tr.length > 1) out.push(`<polyline class="lv-trail" points="${tr.map((p) => { const s = LV.toScreen(p, view, size); return `${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join(" ")}"/>`);
      const h = out.join("");
      if (lines.innerHTML !== h) lines.innerHTML = h;
    };
    ctx.onLocs = () => {
      for (const c of ctx.V ? ctx.V.cs : []) {}
      const locs = ctx.D.locs.v || [];
      for (const l of locs) {
        if (!l.location) continue;
        const m = LV.toMeters(l.location.latitude, l.location.longitude);
        const t = trails.get(l.courier_id) || [];
        const last = t[t.length - 1];
        if (!last || Math.hypot(last.x - m.x, last.y - m.y) > 8) { t.push(m); if (t.length > 40) t.shift(); trails.set(l.courier_id, t); }
      }
      if (st.follow && st.selId != null) {
        const l = locs.find((x) => x.courier_id === st.selId);
        if (l && l.location) { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } const m = LV.toMeters(l.location.latitude, l.location.longitude); view = { ...view, cx: m.x, cy: m.y }; }
      }
    };

    const drawScale = () => {
      const sc = q("scale");
      if (!viewSet) { sc.hidden = true; return; }
      sc.hidden = false;
      const k = LV.ppm(view.z);
      const cands = [50, 100, 200, 500, 1000, 2000, 5000];
      const target = size.w < 400 ? 60 : 84;
      const m = cands.reduce((a, b) => (Math.abs(b * k - target) < Math.abs(a * k - target) ? b : a));
      const h = `<i style="width:${Math.round(m * k)}px"></i><span>${m >= 1000 ? m / 1000 + " km" : m + " m"}</span><span>· shematska karta</span>`;
      if (sc.innerHTML !== h) sc.innerHTML = h;
    };

    let lastMc = "", lastLeg = "", lastNotes = "", lastMnote = "";
    const drawControls = () => {
      const mc = q("mc"), leg = q("leg");
      const lay = (key, label) => `<button type="button" role="menuitemcheckbox" aria-checked="${st.layers[key]}" data-act="layer" data-arg="${key}" data-fk="lay-${key}"><span>${label}</span><span class="sw"></span></button>`;
      const menu = st.menu ? `<div class="lv-menu" role="menu" aria-label="Slojevi na karti">${lay("zones", "Zone i broj kurira")}${lay("orders", "Narudžbe na karti")}${lay("labels", "Imena kurira")}</div>` : "";
      const h = `<div class="lv-mrel"><button type="button" class="lv-mb" data-act="menu" data-fk="mb-layers" aria-haspopup="menu" aria-expanded="${st.menu}">${ic("layers-outline", 20)}<span class="t">Slojevi</span></button>${menu}</div>
        <button type="button" class="lv-mb" data-act="fit" data-fk="mb-fit">${ic("fit-to-page-outline", 20)}<span class="t">Prikaži sve</span></button>
        ${st.wide ? `<button type="button" class="lv-mb lv-mb--sq" data-act="full" data-fk="mb-full" aria-pressed="${st.full}" aria-label="${st.full ? "Vrati panel" : "Proširi mapu"}" title="${st.full ? "Vrati panel" : "Proširi mapu"}">${ic(st.full ? "fullscreen-exit" : "fullscreen", 20)}</button>` : ""}
        <div class="lv-zoom" role="group" aria-label="Razmjera"><button type="button" data-act="zoom-in" data-fk="mb-zin" aria-label="Približi">${ic("plus", 22)}</button><button type="button" data-act="zoom-out" data-fk="mb-zout" aria-label="Udalji">${ic("minus", 22)}</button></div>`;
      if (h !== lastMc) { lastMc = h; const fk = ctx.focusKeyIn(mc); mc.innerHTML = h; ctx.restoreFocus(mc, fk); }
      const lh = `<button type="button" data-act="legend" data-fk="lg" aria-expanded="${st.legend}">${ic("information-outline", 20)}Legenda</button>${st.legend ? `<div class="lv-legc" role="region" aria-label="Legenda karte">
        <h3>Kuriri</h3><div><span class="s" style="--rc:#2f6fed"></span>U dostavi (strelica = smjer vožnje)</div><div><span class="s" style="--rc:#00a06f"></span>Slobodan</div><div><span class="s" style="--rc:#7b8594"></span>Offline</div><div><span class="s d"></span>Bez signala: server kaže online ili u dostavi, a signal je stariji od 5 min</div>
        <h3>Narudžbe</h3><div><span class="q" style="--oc:#e5484d"></span>Kasni ili čeka dugo</div><div><span class="q" style="--oc:#d97a06"></span>Čeka</div><div><span class="q" style="--oc:#5b6676"></span>Novo, u toku</div></div>` : ""}`;
      if (lh !== lastLeg) { lastLeg = lh; const fk = ctx.focusKeyIn(leg); leg.innerHTML = lh; ctx.restoreFocus(leg, fk); }
    };

    const drawNotes = () => {
      const D = ctx.D, V = ctx.V, notes = q("notes"), mn = q("mnote");
      const tint = (tone, icn, title, body, act) => `<div class="lv-tint lv-tint--${tone}" role="${tone === "bad" ? "alert" : "status"}">${ic(icn, 22)}<div><b>${title}</b>${body}${act || ""}</div></div>`;
      const n = [];
      if (V.pageState === "ready") {
        if (D.locs.failed) n.push(D.locs.v ? tint("warn", "cloud-off-outline", "Pozicije nisu osvježene", `Prikazan je zadnji poznati položaj (${esc(LV.clock(V.now - (Date.now() - (D.locs.at || Date.now()))))}). Stanje uživo može biti zastarjelo.`, `<div class="act"><button type="button" data-act="retry" data-fk="retry-locs">Pokušaj ponovo</button></div>`)
          : tint("bad", "map-marker-off-outline", "Ne mogu da učitam pozicije kurira", "Spisak kurira radi, ali pozicije i stanje uživo ne stižu.", `<div class="act"><button type="button" data-act="retry" data-fk="retry-locs">Pokušaj ponovo</button></div>`));
        else if (D.locs.v && D.locs.v.length === 0) n.push(tint("info", "information-outline", "Nijedan kurir ne šalje poziciju", "Kuriri su na spisku, ali nijedan nema poznatu poziciju. Kad se prijave, pojaviće se na karti."));
      }
      const nh = n.join("");
      if (nh !== lastNotes) { lastNotes = nh; notes.innerHTML = nh; }
      let mh = "";
      if (V.pageState === "loading") mh = `<div role="status"><svg class="ic" width="34" height="34" viewBox="0 0 24 24"><path d="${window.LV_ICONS["map-marker-radius-outline"]}"/></svg><b>Učitavam kurire i pozicije…</b></div>`;
      else if (V.pageState === "error") mh = `<div role="alert">${ic("cloud-off-outline", 34)}<b>Ne mogu da učitam kurire</b><span>Server ne odgovara. Prazna karta bi izgledala kao da nikoga nema, zato je ne pokazujem.</span><button type="button" class="lv-btn lv-btn--pri" data-act="retry" data-fk="retry-main">Pokušaj ponovo</button></div>`;
      else if (V.pageState === "empty") mh = `<div>${ic("account-group-outline", 34)}<b>Firma još nema kurira</b><span>Kad dodaš kurira, vidjećeš ga ovdje čim pošalje poziciju.</span><a class="lv-btn lv-btn--pri" href="#" data-act="goto" data-arg="Kuriri" data-fk="add-courier">Dodaj kurira</a></div>`;
      else if (viewSet && !shownCouriers && (st.live !== "all" || st.flags.length || st.q)) mh = `<div>${ic("magnify", 34)}<b>Nijedan kurir ne odgovara filteru</b><button type="button" class="lv-btn" data-act="clear" data-fk="clear-map">Očisti filtere</button></div>`;
      if (mh !== lastMnote) { lastMnote = mh; mn.innerHTML = mh; mn.hidden = !mh; }
    };

    /* ---------- dodir i miš ---------- */
    const ptrs = new Map();
    let drag = null, pinch = null;
    const interactive = (t) => t.closest(".lv-mk,.lv-cl,.lv-op,.lv-mc,.lv-leg,.lv-notes,.lv-mnote > div,.lv-scale");
    const onDown = (ev) => {
      if (interactive(ev.target)) return;
      mapEl.setPointerCapture && mapEl.setPointerCapture(ev.pointerId);
      ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
      if (ptrs.size === 1) { drag = { x: ev.clientX, y: ev.clientY, moved: false }; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z }; drag = null; }
    };
    const onMove = (ev) => {
      if (!ptrs.has(ev.pointerId)) return;
      ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const box = mapEl.getBoundingClientRect();
        const z2 = LV.clamp(pinch.z + Math.log2(d / pinch.d), LV.ZMIN, LV.ZMAX);
        const px = (a.x + b.x) / 2 - box.left, py = (a.y + b.y) / 2 - box.top;
        const m = LV.fromScreen({ x: px, y: py }, view, size);
        const k2 = LV.ppm(z2);
        view = { z: z2, cx: m.x - (px - size.w / 2) / k2, cy: m.y + (py - size.h / 2) / k2 };
        userMoved(); reposition();
        return;
      }
      if (!drag) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) { drag.moved = true; mapEl.classList.add("is-drag"); userMoved(); }
      const k = LV.ppm(view.z);
      view = { ...view, cx: view.cx - dx / k, cy: view.cy + dy / k };
      drag.x = ev.clientX; drag.y = ev.clientY;
      reposition();
    };
    const onUp = (ev) => {
      ptrs.delete(ev.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (!ptrs.size) { const moved = drag && drag.moved; drag = null; mapEl.classList.remove("is-drag"); if (moved) update(); }
    };
    mapEl.addEventListener("pointerdown", onDown);
    mapEl.addEventListener("pointermove", onMove);
    mapEl.addEventListener("pointerup", onUp);
    mapEl.addEventListener("pointercancel", onUp);
    mapEl.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const box = mapEl.getBoundingClientRect();
      userMoved();
      zoomAt(ev.deltaY < 0 ? 0.5 : -0.5, ev.clientX - box.left, ev.clientY - box.top);
    }, { passive: false });
    mapEl.addEventListener("keydown", (ev) => {
      if (ev.target !== mapEl) return;
      const k = LV.ppm(view.z), step = 90 / k;
      const pan = (dx, dy) => { ev.preventDefault(); userMoved(); view = { ...view, cx: view.cx + dx, cy: view.cy + dy }; update(); };
      if (ev.key === "ArrowLeft") pan(-step, 0);
      else if (ev.key === "ArrowRight") pan(step, 0);
      else if (ev.key === "ArrowUp") pan(0, step);
      else if (ev.key === "ArrowDown") pan(0, -step);
      else if (ev.key === "+" || ev.key === "=") { ev.preventDefault(); userMoved(); zoomAt(0.5, size.w / 2, size.h / 2); }
      else if (ev.key === "-") { ev.preventDefault(); userMoved(); zoomAt(-0.5, size.w / 2, size.h / 2); }
      else if (ev.key === "0") { ev.preventDefault(); fitAll(); }
    });

    /* ---------- radnje ---------- */
    const A = ctx.acts;
    A["pick-m"] = (id) => ctx.selectCourier(Number(id), { fromMap: true, noFly: true });
    A["pick-op"] = (id) => ctx.selectOrder(Number(id), { noFly: true });
    A.cluster = (ids) => {
      const list = ids.split(",").map(Number).map((i) => ctx.V.byId.get(i)).filter((c) => c && c.loc);
      const pts = list.map((c) => LV.toMeters(c.loc.latitude, c.loc.longitude));
      const v = LV.fitView(pts, size, { pad: 90, zmax: 17 });
      userMoved(); flyTo({ ...v, z: Math.max(v.z, view.z + 1) });
    };
    A.fit = () => fitAll();
    A["zoom-in"] = () => { userMoved(); zoomAt(0.5, size.w / 2, size.h / 2); };
    A["zoom-out"] = () => { userMoved(); zoomAt(-0.5, size.w / 2, size.h / 2); };
    A.menu = () => { st.menu = !st.menu; if (st.menu) st.legend = false; update(); };
    A.legend = () => { st.legend = !st.legend; if (st.legend) st.menu = false; update(); };
    A.layer = (k) => { st.layers[k] = !st.layers[k]; update(); ctx.renderPanel(); };
    A.full = () => { st.full = !st.full; ctx.el.classList.toggle("lv-full", st.full); ctx.render(); requestAnimationFrame(() => { measure(); update(); }); };
    document.addEventListener("pointerdown", (ev) => { if (!ctx.root.contains(ev.target)) return; if (st.menu && !ev.target.closest(".lv-mrel")) { st.menu = false; update(); } if (st.legend && !ev.target.closest(".lv-leg")) { st.legend = false; update(); } });

    let ro = null;
    const api = {
      start() {
        if (window.ResizeObserver) { ro = new ResizeObserver(() => { const had = size.w; if (measure()) { if (!viewSet && ctx.booted) ensureInitial(); else if (size.w !== had) update(); } }); ro.observe(mapEl); }
        measure();
      },
      update,
      destroy() { if (ro) ro.disconnect(); if (anim) cancelAnimationFrame(anim.raf); },
      flyToCourier(idc) {
        const c = ctx.V.byId.get(idc);
        if (!c || !c.loc) return;
        measure();
        const m = LV.toMeters(c.loc.latitude, c.loc.longitude);
        const panelPad = st.wide ? 0 : -size.h * 0.18; // na telefonu list zaklanja donji dio
        const k = LV.ppm(Math.max(view.z, 14.5));
        flyTo({ cx: m.x, cy: m.y + panelPad / k, z: Math.max(view.z, 14.5) });
      },
      flyToOrder(oid) {
        const o = ctx.V.oById.get(oid);
        if (!o || !o.pos) return;
        measure();
        const m = LV.toMeters(o.pos.lat, o.pos.lng);
        const c = o.courier ? ctx.V.byId.get(o.courier.id) : null;
        if (c && c.loc) { const pts = [m, LV.toMeters(c.loc.latitude, c.loc.longitude)]; flyTo(LV.fitView(pts, size, { pad: 110, zmax: 16 })); }
        else flyTo({ cx: m.x, cy: m.y, z: Math.max(view.z, 14.5) });
      },
      fit: fitAll,
      onKey(ev) {},
      get view() { return view; },
      get size() { return size; },
      get count() { return els.size; },
      setView(v) { setView(v); viewSet = true; update(); },
    };
    return api;
  };
})();
