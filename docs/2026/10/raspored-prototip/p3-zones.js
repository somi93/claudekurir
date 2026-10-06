/* Tab "Zone": spisak + karta sa nazivima, izbor pomjera kartu, uređivanje sa živim pregledom na karti. Karta u prototipu je shematska (SVG). */
(function () {
  "use strict";
  const parts = (window.SCParts = window.SCParts || {});

  parts.zones = function (ctx) {
    const { SC, esc, ic, world, now, st } = ctx;
    const Z = (ctx.S.zones = { sel: null, q: "", edit: null, vb: null, focus: null, saving: false });
    const geo = (z) => z.lat != null && z.lng != null && z.r != null;
    const withGeo = () => world.zones.filter(geo);
    // Referentna tačka projekcije: težište zona (stalna za cijelu sesiju, da se nacrt ne pomjera).
    const base = withGeo();
    const C = base.length ? { lat: base.reduce((a, z) => a + z.lat, 0) / base.length, lng: base.reduce((a, z) => a + z.lng, 0) / base.length } : { lat: 44.7725, lng: 17.1925 };
    const MPP = 14, KLAT = 110574, KLNG = 111320 * Math.cos((C.lat * Math.PI) / 180);
    const proj = (lat, lng) => ({ x: ((lng - C.lng) * KLNG) / MPP, y: (-(lat - C.lat) * KLAT) / MPP });
    const unproj = (x, y) => ({ lat: C.lat - (y * MPP) / KLAT, lng: C.lng + (x * MPP) / KLNG });
    Z.proj = proj; Z.unproj = unproj;
    const pl = (n) => `${n} ${SC.plural(n, "smjena", "smjene", "smjena")}`;
    const f1 = (n) => SC.fmtNum(Math.round(n * 10) / 10);

    const boundsOf = (circles, pad = 0.1) => {
      if (!circles.length) return { x: -300, y: -170, w: 600, h: 340 };
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      circles.forEach((c) => { const p = proj(c.lat, c.lng), r = c.r / MPP; x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r); x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r); });
      const w = x1 - x0, h = y1 - y0;
      return { x: x0 - w * pad, y: y0 - h * pad, w: w * (1 + 2 * pad), h: h * (1 + 2 * pad) };
    };
    const vbStr = (b) => `${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}`;
    const fitAll = () => boundsOf(withGeo());
    const fitZone = (z) => boundsOf([{ lat: z.lat, lng: z.lng, r: z.r * 1.7 }], 0.05);
    const currentBounds = () => {
      if (Z.edit && Z.edit.vb) return Z.edit.vb;
      if (Z.focus) { const z = world.zones.find((x) => x.id === Z.focus); if (z && geo(z)) return fitZone(z); }
      return fitAll();
    };
    Z.currentBounds = currentBounds;

    /* ---------- shematska karta ---------- */
    const bg = () => {
      const lines = [];
      for (let i = -9; i <= 9; i++) { const o = i * 140 + (((i * 37) % 11) - 5) * 6; lines.push(`<path d="M-1400 ${o} C -600 ${o + 40 * ((i % 3) - 1)} 600 ${o - 40 * ((i % 3) - 1)} 1400 ${o + 20}" />`); lines.push(`<path d="M${o} -1000 C ${o + 50 * ((i % 4) - 1.5)} -300 ${o - 50 * ((i % 4) - 1.5)} 300 ${o + 10} 1000" />`); }
      return `<rect x="-1500" y="-1100" width="3000" height="2200" fill="#e8eee3"/><g stroke="#fff" stroke-width="3" fill="none" opacity=".85" vector-effect="non-scaling-stroke">${lines.join("")}</g><path d="M-1500 -120 C -800 -260 -500 120 -100 20 C 300 -70 700 260 1500 120" fill="none" stroke="#b9d6ea" stroke-width="16" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="M-1500 -120 C -800 -260 -500 120 -100 20 C 300 -70 700 260 1500 120" fill="none" stroke="#d3e6f2" stroke-width="6" stroke-linecap="round" vector-effect="non-scaling-stroke"/><g stroke="#f7d9a8" stroke-width="5" fill="none" vector-effect="non-scaling-stroke"><path d="M-1400 -380 L1400 420"/><path d="M-1400 300 L1400 -340"/></g>`;
    };
    const zoneShapes = (K) => {
      const out = [];
      world.zones.filter(geo).forEach((z) => {
        if (Z.edit && Z.edit.id === z.id) return;
        const p = proj(z.lat, z.lng), r = z.r / MPP, sel = Z.sel === z.id && !Z.edit;
        out.push(`<g data-act="zone-pick" data-arg="${z.id}" class="zg"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${sel ? "rgba(47,111,237,.18)" : "rgba(11,18,32,.06)"}" stroke="${sel ? "#2f6fed" : "#46505f"}" stroke-width="${sel ? 3.5 : 1.8}" vector-effect="non-scaling-stroke" style="cursor:pointer"/></g>`);
      });
      world.zones.filter(geo).forEach((z) => {
        if (Z.edit && Z.edit.id === z.id) return;
        const p = proj(z.lat, z.lng), sel = Z.sel === z.id && !Z.edit;
        out.push(`<text x="${p.x.toFixed(1)}" y="${(p.y + 4.5 * K).toFixed(1)}" text-anchor="middle" font-size="${((sel ? 15 : 13) * K).toFixed(1)}" font-weight="800" fill="${sel ? "#17408f" : "#0b1220"}" stroke="#fff" stroke-width="${(4 * K).toFixed(1)}" paint-order="stroke" style="pointer-events:none;font-family:inherit">${esc(z.name)}</text>`);
      });
      if (Z.edit) {
        const d = Z.edit, p = proj(d.lat, d.lng), r = d.r / MPP;
        out.push(`<circle data-draft="c" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(224,138,20,.16)" stroke="#b86e00" stroke-width="3" stroke-dasharray="9 6" vector-effect="non-scaling-stroke"/><g data-draft="x" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${K.toFixed(3)})"><circle r="9" fill="#fff" stroke="#b86e00" stroke-width="3"/><circle r="3" fill="#b86e00"/></g><text data-draft="t" x="${p.x.toFixed(1)}" y="${(p.y - r - 8 * K).toFixed(1)}" text-anchor="middle" font-size="${(13 * K).toFixed(1)}" font-weight="800" fill="#6b3b00" stroke="#fff" stroke-width="${(4 * K).toFixed(1)}" paint-order="stroke" style="pointer-events:none;font-family:inherit">${esc(d.name || "Nova zona")}</text>`);
      }
      return out.join("");
    };
    const mapHtml = (h) => {
      const b = currentBounds();
      const n = withGeo().length;
      Z.K = 1 / Math.min((st.wide ? 756 : 342) / b.w, h / b.h);
      return `<div class="sx-map" style="height:${h}px"><svg viewBox="${vbStr(b)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Karta zona (shematska). Zona na karti: ${n}" data-map="1"><g data-act="map-click">${bg()}</g>${zoneShapes(Z.K)}</svg>
        <span class="chip">Zona na karti: ${n}</span>
        <div class="mt"><button type="button" class="sx-btn" data-act="zone-fit" data-fk="zfit">${ic("map-outline", 18)}Prikaži sve</button></div>
        <span class="att">Shematska karta (prototip)</span></div>`;
    };

    /* ---------- spisak ---------- */
    const rowHtml = (z, i, first) => {
      const sel = Z.sel === z.id;
      return `<button type="button" class="sx-pr ${sel ? "sel" : ""}" data-act="zone-pick" data-arg="${z.id}" data-zid="${z.id}" data-fk="zr-${z.id}" tabindex="${sel || (Z.sel == null && i === 0) ? 0 : -1}" aria-current="${sel ? "true" : "false"}">
        <span class="pi ${geo(z) ? "blue" : "warn"}">${ic("map-marker-radius-outline", 22)}</span>
        <span class="pt"><small>Faktor terena ${SC.fmtNum(z.tf)}${geo(z) ? " · r " + esc(SC.fmtKm(z.r)) : ""}</small><b>${esc(z.name)}</b>${geo(z) ? "" : `<span class="tag">${ic("alert-outline", 14)}Nema položaj na karti</span>`}</span>
        <span class="pe">${ic("chevron-right", 20)}</span></button>`;
    };
    const listHtml = (zs) => {
      const q = Z.q;
      const shown = SC.searchZones(zs, q);
      const hasSearch = zs.length > 6;
      const search = hasSearch || q ? `<label class="srch">${ic("magnify", 20)}<input type="search" data-zf="q" placeholder="Traži zonu" value="${esc(q)}" aria-label="Traži zonu" autocomplete="off"></label>` : "";
      const newBtn = `<button type="button" class="sx-btn sx-btn--pri" data-act="zone-new" data-fk="znew" ${Z.edit ? "disabled" : ""}>${ic("plus", 20)}Nova zona</button>`;
      let body;
      if (!zs.length) body = `<div class="sx-card sx-empty"><b>${esc(world.company.city || "Grad")} nema nijednu zonu</b><span>Zona je krug na karti (centar i radijus). Napravi prvu, pa onda planiraj smjene.</span></div>`;
      else if (!shown.length) body = `<div class="sx-card sx-empty"><b>Nema zone „${esc(q)}“</b><button type="button" class="sx-btn" data-act="zone-q-clear" data-fk="zqc">Obriši pretragu</button></div>`;
      else body = `<div class="sx-list" role="list" aria-label="Zone">${shown.map((z, i) => rowHtml(z, i)).join("")}</div>`;
      return `<div class="sx-zl">${newBtn}${search}${body}<p style="font-size:.78rem;color:var(--ink-soft);padding:0 4px">${zs.length} ${SC.plural(zs.length, "zona", "zone", "zona")} u gradu ${esc(world.company.city || "")}</p></div>`;
    };

    /* ---------- detalj i uređivanje ---------- */
    const usageOf = (z) => SC.usage(z.id, world.shifts, now, 28);
    const rulesOf = (z) => world.rules.filter((r) => r.zoneId === z.id).length;
    const detail = (z) => {
      const ov = geo(z) ? SC.overlaps(z, world.zones) : [];
      const n = usageOf(z);
      return `<section class="sx-det" aria-label="Zona ${esc(z.name)}"><div class="dh"><h2>${esc(z.name)}</h2><span class="sp"></span><button type="button" class="sx-btn sx-btn--sm" data-act="zone-edit" data-fk="zedit">${ic("pencil-outline", 18)}Izmijeni</button><button type="button" class="sx-btn sx-btn--sm" data-act="zone-del" data-fk="zdel" style="color:var(--bad)">${ic("delete-outline", 18)}Obriši</button></div>
        ${geo(z) ? "" : `<div style="padding:0 16px 12px"><div class="sx-tint">${ic("alert-outline", 22)}<div><b>Zona nema položaj na karti</b>Bez centra i radijusa se ne vidi na karti.<div class="act"><button type="button" data-act="zone-edit" data-fk="zplace">Postavi na karti</button></div></div></div></div>`}
        <div class="sx-kv"><div><small>Faktor terena</small><b>${SC.fmtNum(z.tf)}${z.tf === 1 ? " · ravno" : z.tf >= 2 ? " · strmo" : z.tf >= 1.5 ? " · brdovito" : ""}</b></div><div><small>Radijus</small><b>${geo(z) ? esc(SC.fmtKm(z.r)) + " · ≈ " + f1(SC.areaKm2(z.r)) + " km²" : "–"}</b></div><div><small>Smjene u narednih 28 dana</small><b>${pl(n)}</b></div><div><small>Preklapa se sa</small><b>${ov.length ? ov.slice(0, 3).map((o) => esc(o.zone.name) + " " + o.pct + "%").join(", ") : "nijednom zonom"}</b></div></div></section>`;
    };
    const TFV = [1, 1.5, 2];
    const tfIsPreset = (v) => TFV.includes(Number(v));
    const editor = (d) => {
      const custom = d.tfMode === "custom" || !tfIsPreset(d.tf);
      const ov = SC.overlaps({ id: d.id, lat: d.lat, lng: d.lng, r: d.r }, world.zones);
      return `<section class="sx-card sx-ed" aria-label="${d.id ? "Izmijeni zonu" : "Nova zona"}"><h2>${d.id ? "Izmijeni zonu" : "Nova zona"}</h2>
        <div class="sx-f"><div class="lb"><label for="zf-name">Naziv zone</label></div><div class="sx-in" data-in="name"><input id="zf-name" data-zf="name" value="${esc(d.name)}" autocomplete="off" aria-describedby="zm-name" placeholder="npr. Centar"></div><div class="sx-msg" id="zm-name" data-msg="name" aria-live="polite"></div></div>
        <div class="sx-f"><div class="lb">Grad</div><div style="font-weight:700;padding:2px 2px 0">${esc(world.company.city || "")} <span class="mut" style="font-weight:600;font-size:.8rem">· grad firme</span></div></div>
        <div class="sx-f"><div class="lb" id="zf-tf-l">Faktor terena</div><div class="sx-chips" role="radiogroup" aria-labelledby="zf-tf-l">${TFV.map((v, i) => `<button type="button" role="radio" class="sx-chip" aria-checked="${!custom && Number(d.tf) === v}" data-act="zf-tf" data-arg="${v}" data-fk="ztf-${i}">${["Ravno", "Brdovito", "Strmo"][i]} <small>${SC.fmtNum(v)}</small></button>`).join("")}<button type="button" role="radio" class="sx-chip" aria-checked="${custom}" data-act="zf-tf" data-arg="custom" data-fk="ztf-c">Drugo</button></div>
          ${custom ? `<div class="sx-in" style="max-width:160px" data-in="tf"><input data-zf="tf" inputmode="decimal" value="${esc(SC.fmtNum(d.tf))}" aria-label="Faktor terena" autocomplete="off"></div>` : ""}
          <div class="sx-msg" data-msg="tf" aria-live="polite"></div><div class="sx-msg">Utiče na to koja vozila smiju u zonu (pravila u Cjenovniku, Vozila i pravila).</div></div>
        <div class="sx-f"><div class="lb"><label for="zf-r">Radijus</label></div><div class="sx-st"><button type="button" aria-label="Smanji radijus" data-act="zf-r" data-arg="-100" data-fk="zr-m">${ic("minus", 22)}</button><div class="sx-in" style="padding:0 10px"><input id="zf-r" data-zf="r" type="range" min="100" max="5000" step="50" value="${d.r}" aria-valuetext="${esc(SC.fmtKm(d.r))}" style="width:100%"></div><button type="button" aria-label="Povećaj radijus" data-act="zf-r" data-arg="100" data-fk="zr-p">${ic("plus", 22)}</button></div><div class="sx-msg" data-bind="r-read" style="font-weight:700;color:var(--ink)"></div></div>
        <div class="sx-msg" style="font-size:.84rem">${ic("crosshairs-gps", 16)}<span>Klikni na kartu da pomjeriš centar zone.</span></div>
        <details><summary style="cursor:pointer;font-weight:700;font-size:.84rem;min-height:32px">Koordinate centra</summary><div class="sx-two" style="margin-top:8px"><div class="sx-f"><div class="lb"><label for="zf-lat">Geografska širina</label></div><div class="sx-in" data-in="lat"><input id="zf-lat" data-zf="lat" inputmode="decimal" value="${d.lat.toFixed(5).replace(".", ",")}" autocomplete="off"></div></div><div class="sx-f"><div class="lb"><label for="zf-lng">Geografska dužina</label></div><div class="sx-in" data-in="lng"><input id="zf-lng" data-zf="lng" inputmode="decimal" value="${d.lng.toFixed(5).replace(".", ",")}" autocomplete="off"></div></div></div></details>
        <div data-bind="ov"></div>
        <div class="acts"><button type="button" class="sx-btn" data-act="zone-cancel" data-fk="zcancel">Odustani</button><button type="button" class="sx-btn sx-btn--pri" data-act="zone-save" data-fk="zsave" data-bind="save">Sačuvaj</button></div>
        <p class="sx-msg" data-bind="note" style="justify-content:flex-end;margin-top:-6px"></p></section>`;
    };
    const dnum = (s) => { const t = String(s).trim().replace(",", "."); const n = Number(t); return t !== "" && Number.isFinite(n) ? n : NaN; };
    const dErrs = (d) => {
      const e = {};
      if (!d.name.trim()) e.name = "Upiši naziv zone.";
      else if (world.zones.some((z) => z.id !== d.id && SC.fold(z.name) === SC.fold(d.name.trim()))) e.name = "Zona sa tim nazivom već postoji u ovom gradu.";
      if (!(d.tf > 0) || !Number.isFinite(d.tf)) e.tf = "Faktor terena je broj veći od 0, npr. 1,5.";
      if (!(d.r >= 100 && d.r <= 5000)) e.r = "Radijus je od 100 do 5000 m.";
      if (!(d.lat >= -90 && d.lat <= 90)) e.lat = "Širina je od −90 do 90.";
      if (!(d.lng >= -180 && d.lng <= 180)) e.lng = "Dužina je od −180 do 180.";
      return e;
    };
    const dirtyEdit = () => {
      const d = Z.edit; if (!d) return false;
      const o = d.orig;
      return d.name !== o.name || Number(d.tf) !== Number(o.tf) || d.r !== o.r || Math.abs(d.lat - o.lat) > 1e-7 || Math.abs(d.lng - o.lng) > 1e-7;
    };
    // sitni dijelovi uređivača koji se osvježavaju bez ponovnog crtanja (da kucanje ne gubi fokus)
    const updateEditor = () => {
      const d = Z.edit; if (!d) return;
      const root = ctx.el;
      const e = dErrs(d);
      const set = (f, text) => { const m = root.querySelector(`[data-msg="${f}"]`); if (m) { m.className = "sx-msg" + (text ? " bad" : ""); m.innerHTML = text ? ic("alert-circle-outline", 16) + `<span>${esc(text)}</span>` : (f === "tf" ? "" : ""); } const b = root.querySelector(`[data-in="${f}"]`); if (b) b.classList.toggle("bad", !!text); };
      set("name", e.name); set("tf", e.tf); set("lat", e.lat); set("lng", e.lng);
      const rr = root.querySelector('[data-bind="r-read"]'); if (rr) rr.textContent = `${SC.fmtKm(d.r)} · ≈ ${f1(SC.areaKm2(d.r))} km²`;
      const range = root.querySelector('[data-zf="r"]'); if (range) { if (Number(range.value) !== d.r) range.value = d.r; range.setAttribute("aria-valuetext", SC.fmtKm(d.r)); }
      const ovBox = root.querySelector('[data-bind="ov"]');
      if (ovBox) { const ov = SC.overlaps({ id: d.id, lat: d.lat, lng: d.lng, r: d.r }, world.zones); ovBox.innerHTML = ov.length ? `<div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div><b>Preklapa se sa drugim zonama</b>${ov.slice(0, 3).map((o) => `${esc(o.zone.name)} (${o.pct}% manjeg kruga)`).join(", ")}. Koja zona važi za adresu u presjeku, odlučuje server.</div></div>` : ""; }
      const sv = root.querySelector('[data-bind="save"]'), note = root.querySelector('[data-bind="note"]');
      const bad = Object.keys(e).length > 0, dirty = dirtyEdit() || !d.id;
      if (sv) sv.disabled = bad || Z.saving || (!dirty && !!d.id);
      if (note) note.textContent = Z.saving ? "" : bad ? "Provjeri polja iznad." : !dirty && d.id ? "Nema izmjena." : "";
      // krug i oznaka na karti
      const svg = root.querySelector("svg[data-map]");
      if (svg) {
        const p = proj(d.lat, d.lng), r = d.r / MPP;
        const c = svg.querySelector('[data-draft="c"]'); if (c) { c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", r); }
        const K = Z.K || 1; const x = svg.querySelector('[data-draft="x"]'); if (x) x.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${K})`);
        const t = svg.querySelector('[data-draft="t"]'); if (t) { t.setAttribute("x", p.x); t.setAttribute("y", p.y - r - 8 * K); t.textContent = d.name || "Nova zona"; }
      }
    };
    const setCoordInputs = () => { const d = Z.edit; const la = ctx.el.querySelector('[data-zf="lat"]'), ln = ctx.el.querySelector('[data-zf="lng"]'); if (la && document.activeElement !== la) la.value = d.lat.toFixed(5).replace(".", ","); if (ln && document.activeElement !== ln) ln.value = d.lng.toFixed(5).replace(".", ","); };

    /* ---------- pogled ---------- */
    const view = () => {
      const zs = world.zones;
      if (st.load.zones === "loading") return `<div class="sx-zsplit" aria-busy="true"><div class="sx-zl">${[0, 1, 2, 3].map(() => '<div class="sx-skel" style="height:64px"></div>').join("")}</div><div class="sx-skel" style="height:380px;border-radius:20px"></div></div>`;
      if (st.load.zones === "error") return `<div class="sx-tint sx-tint--bad" role="alert">${ic("alert-circle-outline", 22)}<div><b>Ne mogu da učitam zone</b>Server ne odgovara. Spisak nije prikazan, jer bi prazan spisak izgledao kao da zona nema.<div class="act"><button type="button" data-act="zones-retry" data-fk="zretry">Pokušaj ponovo</button></div></div></div>`;
      if (Z.sel == null && zs.length) Z.sel = (zs.find(geo) || zs[0]).id;
      const selZ = zs.find((z) => z.id === Z.sel);
      const side = Z.edit ? editor(Z.edit) : selZ ? detail(selZ) : "";
      const mapH = st.wide ? 400 : 260;
      return st.wide
        ? `<div class="sx-zsplit">${listHtml(zs)}<div style="display:grid;gap:14px;min-width:0">${mapHtml(mapH)}${side}</div></div>`
        : `<div class="sx-zsplit">${mapHtml(mapH)}${side}${listHtml(zs)}</div>`;
    };

    /* ---------- radnje ---------- */
    ctx.acts["zone-pick"] = (arg, ev) => {
      if (Z.edit) { if (ev && ev.target.closest("svg")) return ctx.acts["map-click"](null, ev); ctx.toast("Prvo sačuvaj izmjenu ili odustani."); return; }
      Z.sel = Number(arg); Z.focus = Z.sel; ctx.focusKey("zr-" + arg); ctx.render();
    };
    ctx.acts["zone-fit"] = () => { Z.focus = null; ctx.focusKey("zfit"); ctx.render(); };
    ctx.acts["zone-q-clear"] = () => { Z.q = ""; ctx.focusKey("znew"); ctx.render(); };
    ctx.acts["zones-retry"] = () => { st.load.zones = "loading"; ctx.render(); ctx.setTimeout(() => { st.load.zones = "ok"; ctx.render(); }, 500); };
    ctx.acts["map-click"] = (arg, ev) => {
      if (!Z.edit || !ev) return;
      const svg = ev.target.closest("svg"); if (!svg) return;
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const g = unproj(p.x, p.y);
      Z.edit.lat = g.lat; Z.edit.lng = g.lng;
      setCoordInputs(); updateEditor();
    };
    const startEdit = (z) => {
      const b = fitAll();
      const bb = z && geo(z) ? boundsOf([...withGeo()]) : b;
      const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
      const c = unproj(cx, cy);
      const d = z ? { id: z.id, name: z.name, tf: z.tf, r: geo(z) ? z.r : 1000, lat: geo(z) ? z.lat : c.lat, lng: geo(z) ? z.lng : c.lng } : { id: null, name: "", tf: 1, r: 1000, lat: c.lat, lng: c.lng };
      d.orig = { name: d.name, tf: d.tf, r: d.r, lat: d.lat, lng: d.lng };
      d.vb = z && geo(z) ? boundsOf([...withGeo(), { lat: d.lat, lng: d.lng, r: d.r }]) : boundsOf([...withGeo(), { lat: d.lat, lng: d.lng, r: d.r }]);
      Z.edit = d; Z.focus = null;
      ctx.focusKey(null); ctx.render();
      const f = ctx.el.querySelector("#zf-name"); if (f) f.focus({ preventScroll: true });
      updateEditor();
    };
    ctx.acts["zone-new"] = () => startEdit(null);
    ctx.acts["zone-edit"] = () => startEdit(world.zones.find((z) => z.id === Z.sel));
    ctx.acts["zone-cancel"] = () => {
      if (dirtyEdit() && !Z.edit.askedDiscard) { Z.edit.askedDiscard = true; ctx.toast("Imaš nesačuvane izmjene. Pritisni Odustani još jednom da ih odbaciš."); return; }
      Z.edit = null; ctx.focusKey("zedit"); ctx.render();
    };
    ctx.acts["zf-tf"] = (arg) => {
      const d = Z.edit; if (arg === "custom") d.tfMode = "custom"; else { d.tfMode = null; d.tf = Number(arg); }
      ctx.focusKey(arg === "custom" ? "ztf-c" : "ztf-" + TFV.indexOf(Number(arg))); ctx.render(); updateEditor();
      if (arg === "custom") { const i = ctx.el.querySelector('[data-zf="tf"]'); if (i) i.focus(); }
    };
    ctx.acts["zf-r"] = (arg) => { const d = Z.edit; d.r = Math.max(100, Math.min(5000, d.r + Number(arg))); updateEditor(); };
    ctx.acts["zone-save"] = async () => {
      const d = Z.edit; if (!d || Z.saving) return;
      if (Object.keys(dErrs(d)).length) return;
      Z.saving = true; updateEditor();
      const body = { city_id: world.company.cityId, name: d.name.trim(), center_lat: Number(d.lat.toFixed(6)), center_lng: Number(d.lng.toFixed(6)), radius_meters: d.r, terrain_factor: d.tf };
      try {
        if (d.id) {
          await ctx.api("PUT", `/dispatcher/zones/${d.id}`, body);
          const z = world.zones.find((x) => x.id === d.id); Object.assign(z, { name: body.name, tf: body.terrain_factor, lat: body.center_lat, lng: body.center_lng, r: body.radius_meters });
          Z.sel = z.id; ctx.toast("Izmjene zone su sačuvane.");
        } else {
          await ctx.api("POST", "/dispatcher/zones", body);
          const z = { id: world.nextZoneId++, name: body.name, tf: body.terrain_factor, lat: body.center_lat, lng: body.center_lng, r: body.radius_meters };
          world.zones.push(z); Z.sel = z.id; ctx.toast("Zona je kreirana.");
        }
        Z.edit = null; Z.saving = false; Z.focus = Z.sel; ctx.focusKey("zedit"); ctx.render();
      } catch (e) { Z.saving = false; updateEditor(); ctx.toast(e.message || "Ne mogu da sačuvam zonu.", { err: true }); }
    };

    /* ---------- brisanje ---------- */
    ctx.acts["zone-del"] = () => { const z = world.zones.find((x) => x.id === Z.sel); if (z) ctx.openSheet({ type: "zdelete", id: z.id }, "zdel"); };
    ctx.sheets.zdelete = {
      title: (sh) => `Obrisati zonu ${world.zones.find((x) => x.id === sh.id).name}?`,
      sub: () => `Grad ${world.company.city}`,
      body: (sh) => {
        const z = world.zones.find((x) => x.id === sh.id);
        const n = usageOf(z), k = rulesOf(z);
        return `<div class="sx-rows" style="pointer-events:none"><button type="button" tabindex="-1"><span class="a">Smjene u ovoj firmi<small>od danas do ${esc(SC.dayLong(SC.iso(SC.addDays(SC.parseIso(now.date), 27))))}</small></span><span class="pill ${n ? "pill-warn" : "pill-ok"}">${pl(n)}</span><span></span></button><button type="button" tabindex="-1"><span class="a">Pravila za vozila<small>Cjenovnik, Vozila i pravila</small></span><span class="pill ${k ? "pill-warn" : "pill-ok"}">${k}</span><span></span></button></div>
          <div class="sx-tint sx-tint--info">${ic("information-outline", 22)}<div><b>Zone pripadaju gradu, ne firmi</b>Brisanje važi i za druge firme u gradu. Šta server radi sa smjenama i pravilima koja koriste zonu, nije potvrđeno.</div></div>`;
      },
      foot: (sh) => `<div class="two"><button type="button" class="sx-btn" data-act="sheet-close" data-fk="zd-cancel" data-autofocus>Odustani</button><button type="button" class="sx-btn sx-btn--danger" data-act="zdelete-do" data-fk="zd-do" ${sh.saving ? "disabled" : ""}>Obriši zonu</button></div>`,
    };
    ctx.acts["zdelete-do"] = async () => {
      const sh = st.sheet; if (!sh || sh.saving) return;
      sh.saving = true; ctx.refreshSheet();
      const z = world.zones.find((x) => x.id === sh.id);
      try {
        await ctx.api("DELETE", `/dispatcher/zones/${z.id}`);
        // [PRETPOSTAVKA za prototip] server odbija brisanje zone koja ima smjene
        if (usageOf(z) > 0) throw Object.assign(new Error("Zona se ne može obrisati jer ima smjene."), { status: 409 });
        world.zones.splice(world.zones.indexOf(z), 1);
        Z.sel = null; Z.focus = null; st.opener = null;
        ctx.closeSheet(true); ctx.render(); ctx.toast("Zona je obrisana.");
      } catch (e) { sh.saving = false; ctx.refreshSheet(); ctx.toast(e.message || "Ne mogu da obrišem zonu.", { err: true }); }
    };

    return {
      view,
      onInput(ev) {
        const t = ev.target.closest("[data-zf]"); if (!t) return;
        const f = t.getAttribute("data-zf");
        if (f === "q") { Z.q = t.value; const pos = t.selectionStart; ctx.focusKey("zq"); ctx.render(); const i = ctx.el.querySelector('[data-zf="q"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) {} } return; }
        const d = Z.edit; if (!d) return;
        d.askedDiscard = false;
        if (f === "name") d.name = t.value;
        else if (f === "tf") d.tf = dnum(t.value);
        else if (f === "r") d.r = Number(t.value);
        else if (f === "lat") d.lat = dnum(t.value);
        else if (f === "lng") d.lng = dnum(t.value);
        updateEditor();
      },
      onKey(ev) {
        const row = ev.target.closest && ev.target.closest(".sx-pr[data-zid]");
        if (!row || st.sheet || Z.edit) return;
        if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
        ev.preventDefault();
        const rows = [...ctx.el.querySelectorAll(".sx-pr[data-zid]")];
        const i = rows.indexOf(row);
        const n = rows[ev.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)];
        if (n) { Z.sel = Number(n.getAttribute("data-zid")); Z.focus = Z.sel; ctx.focusKey("zr-" + Z.sel); ctx.render(); const f = ctx.el.querySelector(`[data-fk="zr-${Z.sel}"]`); if (f) f.focus(); }
      },
      afterRender() { if (st.tab === "zones" && Z.edit) updateEditor(); },
    };
  };
})();
