/* Čista logika stranice "Kuriri uživo" (bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u). Nije Vue kod: imena, pragovi i tekstovi su izvor za
   portovanje u app/utils/liveBoard.ts. Pravi kod aplikacije (courierRoster, dispatchBoard, courierStatus, zoneGeo, cashLimit, currency, modeli narudžbi) dolazi
   iz paketa LVW (esbuild nad app/utils/*), pa se ovdje piše samo ono što je novo: svježina signala, pažnja, geometrija mape, klasteri, adresa. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(() => globalThis.LVW);
  else root.LV = factory(() => root.LVW);
})(typeof self !== "undefined" ? self : this, function (W) {
  "use strict";
  const SEC = 1000;
  const MIN = 60 * SEC;
  const H = 60 * MIN;

  /* ---------- svježina signala (odluka D3: front računa, server ne šalje) ----------
     Kurirska aplikacija javlja poziciju sa svakim GPS očitanjem, pa je 90 s (isti prag kao STALE_AFTER_MS u courierStatus.ts) već kasno.
     Server i dalje kaže "online"/"delivering" za kurira kojem se aplikacija ugasila (komentar u courierStatus.ts: "ručno prijavljen kao online pre par dana"),
     pa stanje ostaje ono što server kaže, a svježina je POSEBNA oznaka. */
  const SIGNAL = { FRESH_MS: 90 * SEC, LOST_MS: 5 * MIN };

  const signalAge = (loc, now) => (loc ? Math.max(0, now - Date.parse(loc.updated_at)) : null);
  const signalLevel = (loc, now) => {
    if (!loc) return "none";
    const a = signalAge(loc, now);
    if (!Number.isFinite(a)) return "none";
    return a <= SIGNAL.FRESH_MS ? "fresh" : a <= SIGNAL.LOST_MS ? "weak" : "lost";
  };
  // Kratko: "8 s", "14 min", "2 h", "3 dana"
  const shortAge = (ms) => {
    const s = Math.round(ms / SEC);
    if (s < 60) return `${s} s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h`;
    const d = Math.round(h / 24);
    return `${d} ${d === 1 ? "dan" : "dana"}`;
  };
  const signalText = (loc, now) => {
    const a = signalAge(loc, now);
    if (a == null || !Number.isFinite(a)) return "nema lokacije";
    return a < 5 * SEC ? "upravo sad" : `pre ${shortAge(a)}`;
  };

  /* ---------- brzina: km/h, nepoznato nije "stoji" ---------- */
  const speedKmh = (ms) => (ms == null || !Number.isFinite(Number(ms)) ? null : Math.round(Number(ms) * 3.6));
  const speedText = (loc, live) => {
    if (!loc || live === "offline" || live === "none") return "";
    if (loc.speed == null) return "Brzina nepoznata";
    return Number(loc.speed) < 0.5 ? "Stoji" : `${speedKmh(loc.speed)} km/h`;
  };

  /* ---------- kurir: stanje + svježina + dostava + novac ---------- */
  const pad2 = (n) => String(n).padStart(2, "0");

  // roster = RosterCourier[] (pravi buildRoster), active = ActiveDelivery[] (modeli), cashLimit = broj|null
  const decorate = (roster, { now, active = [], cashLimit = null }) => {
    const byCourier = new Map();
    for (const d of active) {
      if (!d.courier) continue;
      const arr = byCourier.get(d.courier.id) || [];
      arr.push(d);
      byCourier.set(d.courier.id, arr);
    }
    return roster.map((c) => {
      const live = W().liveOf(c, now);
      const sig = signalLevel(c.loc, now);
      const ds = (byCourier.get(c.id) || []).slice().sort((a, b) => a.minutesUntilDelivery - b.minutesUntilDelivery);
      return {
        ...c,
        live, // delivering | online | offline | none
        group: live === "none" ? "offline" : live,
        sig, // fresh | weak | lost | none
        sigMs: signalAge(c.loc, now),
        ghost: (live === "delivering" || live === "online") && sig === "lost",
        deliveries: ds,
        delivery: ds[0] || null,
        level: W().cashLevel(c.cash, cashLimit),
      };
    });
  };

  /* ---------- filteri i redoslijed popisa kurira ---------- */
  const FLAG = {
    lost: (c) => c.ghost,
    limit: (c) => c.level === "near" || c.level === "over",
    suspended: (c) => c.suspended,
  };
  const FLAG_ORDER = ["lost", "limit", "suspended"];
  const FLAG_LABELS = { lost: "Bez signala", limit: "Blizu limita", suspended: "Suspendovani" };
  const FLAG_HINTS = { lost: "Server kaže online ili u dostavi, a signal je stariji od 5 min", limit: "Gotovina od 80 % limita", suspended: "Ne primaju narudžbe" };

  const filterCouriers = (list, { q = "", live = "all", flags = [] }, now) => {
    const base = W().filterRoster(list, { q, live, flags: [] }, now);
    // filterRoster vraća iste objekte iz `list` (sa dodatim poljima), pa predikati ostaju primjenjivi
    return flags.length ? base.filter((c) => flags.every((f) => FLAG[f] && FLAG[f](c))) : base;
  };
  const SORTS = { live: "Uživo prvo", name: "Ime A-Z", lost: "Najduže bez signala" };
  const sortCouriers = (list, mode, now) => {
    if (mode === "lost") {
      return list.slice().sort((a, b) => {
        const ra = a.ghost ? 0 : 1, rb = b.ghost ? 0 : 1;
        if (ra !== rb) return ra - rb;
        const sa = a.sigMs == null ? -1 : a.sigMs, sb = b.sigMs == null ? -1 : b.sigMs;
        return rb - sa;
      });
    }
    return W().sortRoster(list, mode === "name" ? "name" : "live", now);
  };
  // Brojevi su iz cijele liste (ne iz filtriranog dijela), pa ostaju stabilni dok se filtrira.
  const courierCounts = (list, now) => {
    const o = { all: list.length, delivering: 0, online: 0, offline: 0, lost: 0, limit: 0, suspended: 0, none: 0 };
    for (const c of list) {
      o[c.group] += 1;
      if (c.live === "none") o.none += 1;
      for (const f of FLAG_ORDER) if (FLAG[f](c)) o[f] += 1;
    }
    return o;
  };
  // Pun spisak je nepouzdan dok pozicije ne stignu: kurir bez pozicije je tada "nepoznato", ne "offline".
  const liveTotal = (counts) => counts.delivering + counts.online;

  /* ---------- narudžbe ---------- */
  // Svaka narudžba iz tri izvora (modeli iz aplikacije) u jedan oblik. kind: pending | waiting | booked | picked
  const normalizeOrders = ({ waiting = [], active = [], pending = [] }) => {
    const out = [];
    const coord = (loc) => {
      const c = loc && loc.coordination;
      if (!c) return null;
      const lat = Number(c.lat), lng = Number(c.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    };
    const addr = (loc) => {
      if (!loc) return "";
      const parts = [loc.address, loc.apartment ? `stan ${loc.apartment}` : null, loc.floor ? `sprat ${loc.floor}` : null].filter(Boolean);
      return parts.join(", ");
    };
    for (const o of pending) out.push({ kind: "pending", id: o.id, restaurant: o.restaurantName, phone: o.restaurantPhone, orderedAt: o.orderedAt, waitingMin: o.waitingMinutes, untilMin: o.deliveryTime ? Math.round((Date.parse(o.deliveryTime) - Date.parse(o.orderedAt)) / MIN) : null, price: o.deliveryPrice, address: addr(o.location), pos: coord(o.location), zone: null, km: null, courier: null, raw: o });
    for (const o of waiting) out.push({ kind: "waiting", id: o.id, restaurant: o.restaurantName, phone: null, orderedAt: o.orderedAt, waitingMin: o.waitingMinutes, untilMin: o.minutesUntilDelivery, price: o.deliveryPrice, address: addr(o.location), pos: coord(o.location), zone: o.deliveryZone, km: o.distanceKm, status: o.status, courier: null, raw: o });
    for (const o of active) out.push({ kind: o.status === "booked" ? "booked" : "picked", id: o.id, restaurant: o.restaurantName, phone: null, orderedAt: o.orderedAt, waitingMin: null, untilMin: o.minutesUntilDelivery, price: o.deliveryPrice, address: addr(o.location), pos: coord(o.location), zone: null, km: null, courier: o.courier, raw: o });
    return out;
  };

  // Hitnost: late | critical | warn | calm | sched | stale (isti pragovi kao Dodela narudžbi: dispatchBoard.ts)
  const orderTier = (o) => {
    const R = W();
    if (o.kind === "pending") {
      const t = R.restaurantWaitTier(o.waitingMin);
      return t === "warning" ? "warn" : t;
    }
    if (o.kind === "waiting") {
      if (R.isLateDelivery(o.raw.minutesUntilDelivery)) return "late";
      if (R.isScheduledOrder(o.raw)) return "sched";
      if (R.isCriticalWaitingOrder(o.raw)) return "critical";
      return o.waitingMin >= 5 ? "warn" : "calm";
    }
    return R.isLateDelivery(o.untilMin) ? "late" : "calm";
  };
  const TIER_RANK = { late: 0, critical: 1, warn: 2, calm: 3, sched: 4, stale: 5 };
  const KIND_LABEL = { pending: "Čeka restoran", waiting: "Čeka kurira", booked: "Čeka preuzimanje", picked: "U dostavi" };

  // Vrijeme uz narudžbu: "Kasni 11 min", "Za 9 min", "Čeka 18 min"
  const orderTiming = (o) => {
    const t = orderTier(o);
    if (o.kind === "pending") return { text: `Čeka restoran ${W().formatWaitingDuration(o.waitingMin)}`, tier: t };
    if (o.untilMin != null && o.untilMin < 0) return { text: `Kasni ${-o.untilMin} min`, tier: "late" };
    if (o.kind === "waiting") {
      if (t === "sched") return { text: `Zakazano, za ${o.untilMin >= 120 ? Math.round(o.untilMin / 60) + " h" : o.untilMin + " min"}`, tier: t };
      return { text: `Čeka kurira ${W().formatWaitingDuration(o.waitingMin)}`, tier: t };
    }
    return { text: `Stiže za ${o.untilMin} min`, tier: t };
  };

  const filterOrders = (orders, { group = "all" }) => {
    if (group === "all") return orders;
    if (group === "late") return orders.filter((o) => orderTier(o) === "late");
    if (group === "wait") return orders.filter((o) => o.kind === "waiting");
    if (group === "rest") return orders.filter((o) => o.kind === "pending");
    if (group === "run") return orders.filter((o) => o.kind === "booked" || o.kind === "picked");
    return orders;
  };
  const sortOrders = (orders) =>
    orders.slice().sort((a, b) => TIER_RANK[orderTier(a)] - TIER_RANK[orderTier(b)] || (b.waitingMin || 0) - (a.waitingMin || 0) || (a.untilMin ?? 1e9) - (b.untilMin ?? 1e9));

  /* ---------- šta traži pažnju ---------- */
  // Jedan spisak preko kurira i narudžbi, od najhitnijeg. Pad izvora ne smije da ostavi lažnu nulu: pozivalac prosljeđuje samo ono što zna (null = ne zna).
  const buildAttention = ({ couriers, orders, handovers = null, now }) => {
    const items = [];
    const counts = { lost: 0, lostDelivering: 0, late: 0, waiting: 0, waitingCritical: 0, restaurant: 0, restaurantCritical: 0, stale: 0, limit: 0, over: 0, suspended: 0, handovers: handovers == null ? null : handovers };
    const ghostOf = new Map();
    for (const c of couriers || []) {
      if (c.level === "over") counts.over += 1;
      if (FLAG.limit(c)) counts.limit += 1;
      if (c.suspended) counts.suspended += 1;
      if (!c.ghost) continue;
      counts.lost += 1;
      ghostOf.set(c.id, c);
      if (c.live === "delivering") counts.lostDelivering += 1;
    }
    if (orders) {
      for (const o of orders) {
        const t = orderTier(o);
        if (o.kind === "waiting") { counts.waiting += 1; if (t === "critical" || t === "late") counts.waitingCritical += 1; }
        if (o.kind === "pending") { if (t === "stale") counts.stale += 1; else { counts.restaurant += 1; if (t === "critical") counts.restaurantCritical += 1; } }
        if (t === "late") counts.late += 1;
      }
      for (const o of orders) {
        const t = orderTier(o);
        const g = o.courier ? ghostOf.get(o.courier.id) : null;
        if (g && (o.kind === "picked" || o.kind === "booked")) {
          items.push({ id: `lost:${g.id}`, kind: "courier-lost", sev: t === "late" ? 100 : 85, courierId: g.id, orderId: o.id, tel: g.phone, title: `${g.name}: bez signala ${shortAge(g.sigMs)}`, sub: `${KIND_LABEL[o.kind]} #${o.id} · ${orderTiming(o).text}` });
        } else if (t === "late") {
          items.push({ id: `late:${o.id}`, kind: "order-late", sev: o.kind === "waiting" ? 80 : 60, orderId: o.id, courierId: o.courier ? o.courier.id : null, tel: o.courier ? o.courier.phone : null, title: `#${o.id} ${o.restaurant}: ${orderTiming(o).text}`, sub: o.kind === "waiting" ? "Još nema kurira" : `Kurir ${o.courier ? W().toLatin(o.courier.name) : "nepoznat"}` });
        } else if (o.kind === "waiting" && t === "critical") {
          items.push({ id: `wait:${o.id}`, kind: "order-waiting", sev: 70, orderId: o.id, title: `#${o.id} ${o.restaurant}: ${orderTiming(o).text}`, sub: "Hrana " + (o.status === "ready" ? "je gotova" : "se sprema") });
        } else if (o.kind === "pending" && t === "critical") {
          items.push({ id: `rest:${o.id}`, kind: "restaurant", sev: 55, orderId: o.id, tel: o.phone, title: `#${o.id} ${o.restaurant}: ${orderTiming(o).text}`, sub: "Restoran nije prihvatio narudžbu" });
        }
      }
    }
    // slobodan kurir bez signala: nije hitno, ali "Slobodni" ga računa
    for (const c of ghostOf.values()) {
      if (c.live === "online") items.push({ id: `lostfree:${c.id}`, kind: "courier-lost-free", sev: 35, courierId: c.id, tel: c.phone, title: `${c.name}: slobodan, bez signala ${shortAge(c.sigMs)}`, sub: "Računa se u Slobodne, a ne javlja se" });
    }
    items.sort((a, b) => b.sev - a.sev);
    return { counts, items };
  };

  /* ---------- zone ---------- */
  const R_EARTH = 6371008.8;
  const rad = (x) => (x * Math.PI) / 180;
  const distanceM = (a, b) => {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m / 10) * 10} m`);
  const hasGeo = (z) => z.center_lat != null && z.center_lng != null && z.radius_meters != null;
  const zoneOfPoint = (lat, lng, zones) => {
    const hit = zones.filter((z) => hasGeo(z) && distanceM({ lat, lng }, { lat: z.center_lat, lng: z.center_lng }) <= z.radius_meters);
    hit.sort((a, b) => a.radius_meters - b.radius_meters);
    return hit[0] || null;
  };
  // Brojevi po zoni sa mape: iz pozicija koje vidi dispečer, ne iz posebnog poziva (stanje kao na pločicama, svježina kao na markeru)
  const zoneCounts = (couriers, zones) => {
    const m = new Map(zones.filter(hasGeo).map((z) => [z.id, { id: z.id, delivering: 0, online: 0, lost: 0, total: 0 }]));
    for (const c of couriers) {
      if (!c.loc || (c.live !== "delivering" && c.live !== "online")) continue;
      const z = zoneOfPoint(c.loc.latitude, c.loc.longitude, zones);
      if (!z) continue;
      const r = m.get(z.id);
      r.total += 1;
      if (c.ghost) r.lost += 1;
      else if (c.live === "delivering") r.delivering += 1;
      else r.online += 1;
    }
    return m;
  };

  /* ---------- mapa: projekcija (ravna, oko centra) ---------- */
  const M_LAT = 111320;
  const mLng = (lat) => 111320 * Math.cos(rad(lat));
  const ORIGIN = { lat: 44.7722, lng: 17.191 };
  // metri od ishodišta: x istok, y sjever
  const toMeters = (lat, lng, o = ORIGIN) => ({ x: (Number(lng) - o.lng) * mLng(o.lat), y: (Number(lat) - o.lat) * M_LAT });
  const fromMeters = (x, y, o = ORIGIN) => ({ lat: o.lat + y / M_LAT, lng: o.lng + x / mLng(o.lat) });
  // piksela po metru (kao Leaflet: 256 px pločice)
  const ppm = (z, lat = ORIGIN.lat) => Math.pow(2, z) / (156543.03392 * Math.cos(rad(lat)));
  const view = (cx, cy, z) => ({ cx, cy, z });
  const toScreen = (m, v, size) => {
    const k = ppm(v.z);
    return { x: size.w / 2 + (m.x - v.cx) * k, y: size.h / 2 - (m.y - v.cy) * k };
  };
  const fromScreen = (p, v, size) => {
    const k = ppm(v.z);
    return { x: v.cx + (p.x - size.w / 2) / k, y: v.cy - (p.y - size.h / 2) / k };
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ZMIN = 10, ZMAX = 17;
  // Pogled koji obuhvata sve tačke (metri) sa marginom u pikselima; jedna tačka = zum 15
  const fitView = (pts, size, { pad = 72, zmin = ZMIN, zmax = 16, bottom = 0 } = {}) => {
    if (!pts.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
    // `bottom` = piksela pri dnu koje zaklanja donji list (telefon): sadržaj se uklapa u ostatak i pomjera iznad njega
    const z = pts.length === 1 || (w < 30 && h < 30) ? 15 : Math.floor(clamp(Math.log2(Math.min((size.w - 2 * pad) / w, (size.h - bottom - 2 * pad) / h) * 156543.03392 * Math.cos(rad(ORIGIN.lat))), zmin, zmax) * 4) / 4;
    return view(cx, cy - bottom / 2 / ppm(z), z);
  };

  // Početni pogled: ko je na terenu (svježi ili viđeni u zadnjih 60 min) -> svi sa pozicijom -> zone -> pregled regije. Nikad Beograd.
  const RECENT_MS = 60 * MIN;
  const initialView = ({ couriers, zones, size, now, bottom = 0 }) => {
    const withPos = (couriers || []).filter((c) => c.loc);
    const recent = withPos.filter((c) => c.live !== "offline" || (c.sigMs != null && c.sigMs <= RECENT_MS));
    const pick = recent.length ? recent : withPos;
    if (pick.length) {
      const v = fitView(pick.map((c) => toMeters(c.loc.latitude, c.loc.longitude)), size, { bottom });
      return { view: v, reason: recent.length ? "couriers" : "couriers-old", count: pick.length };
    }
    const geo = (zones || []).filter(hasGeo);
    if (geo.length) {
      const pts = [];
      for (const z of geo) {
        const c = toMeters(z.center_lat, z.center_lng);
        pts.push({ x: c.x - z.radius_meters, y: c.y - z.radius_meters }, { x: c.x + z.radius_meters, y: c.y + z.radius_meters });
      }
      return { view: fitView(pts, size, { bottom }), reason: "zones", count: geo.length };
    }
    return { view: view(0, 0, 11), reason: "default", count: 0 };
  };

  /* ---------- klasteri: problemi se nikad ne sklanjaju ---------- */
  // items: [{id, x, y, live, pinned}] u pikselima; vraća [{one: item} | {cluster: {x, y, count, ids, delivering, online, offline}}]
  const clusterMarkers = (items, cell = 40) => {
    const out = [];
    const buckets = new Map();
    for (const it of items) {
      if (it.pinned) { out.push({ one: it }); continue; }
      const key = `${Math.floor(it.x / cell)}:${Math.floor(it.y / cell)}`;
      const b = buckets.get(key);
      if (b) b.push(it); else buckets.set(key, [it]);
    }
    for (const b of buckets.values()) {
      if (b.length === 1) { out.push({ one: b[0] }); continue; }
      const c = { x: 0, y: 0, count: b.length, ids: b.map((i) => i.id), delivering: 0, online: 0, offline: 0 };
      for (const i of b) { c.x += i.x; c.y += i.y; c[i.live === "none" ? "offline" : i.live] += 1; }
      c.x /= b.length; c.y /= b.length;
      out.push({ cluster: c });
    }
    return out;
  };

  /* ---------- adresa: stanje stranice ---------- */
  const TABS = ["k", "n"];
  const parseQuery = (search) => {
    const p = new URLSearchParams(search);
    const id = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
    const f = (p.get("f") || "").split(",").filter(Boolean);
    return {
      c: id(p.get("c")),
      o: id(p.get("o")),
      t: TABS.includes(p.get("t")) ? p.get("t") : "k",
      live: ["delivering", "online", "offline"].find((x) => f.includes(x)) || "all",
      flags: FLAG_ORDER.filter((x) => f.includes(x)),
      q: (p.get("q") || "").trim(),
      layers: p.get("l") == null ? { zones: true, orders: true, labels: true } : { zones: p.get("l").includes("z"), orders: p.get("l").includes("n"), labels: p.get("l").includes("i") },
    };
  };
  const buildQuery = (s) => {
    const p = new URLSearchParams();
    if (s.c) p.set("c", String(s.c));
    if (s.o) p.set("o", String(s.o));
    if (s.t && s.t !== "k") p.set("t", s.t);
    const f = [...(s.live && s.live !== "all" ? [s.live] : []), ...FLAG_ORDER.filter((x) => (s.flags || []).includes(x))];
    if (f.length) p.set("f", f.join(","));
    if (s.q) p.set("q", s.q);
    const l = s.layers || { zones: true, orders: true, labels: true };
    if (!(l.zones && l.orders && l.labels)) p.set("l", `${l.zones ? "z" : ""}${l.orders ? "n" : ""}${l.labels ? "i" : ""}`);
    const str = p.toString();
    return str ? `?${str}` : "";
  };

  /* ---------- tekstovi ---------- */
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
  };
  const subtitle = (counts, ok) => (ok ? `${counts.all} ${plural(counts.all, "kurir", "kurira", "kurira")} · ${liveTotal(counts)} uživo` : "");
  // Prototip: sat je zaključan na ljetno srednjoevropsko vrijeme (UTC+2), da tekst ne zavisi od zone pregledača; aplikacija koristi lokalno vrijeme
  const clock = (ms) => { const d = new Date(ms + 2 * 3600_000); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`; };

  return {
    SEC, MIN, H, SIGNAL, RECENT_MS, ZMIN, ZMAX, ORIGIN,
    signalAge, signalLevel, signalText, shortAge,
    speedKmh, speedText,
    decorate, FLAG, FLAG_ORDER, FLAG_LABELS, FLAG_HINTS, filterCouriers, sortCouriers, SORTS, courierCounts, liveTotal,
    normalizeOrders, orderTier, orderTiming, TIER_RANK, KIND_LABEL, filterOrders, sortOrders,
    buildAttention,
    distanceM, fmtDist, hasGeo, zoneOfPoint, zoneCounts,
    toMeters, fromMeters, ppm, view, toScreen, fromScreen, clamp, fitView, initialView,
    clusterMarkers,
    parseQuery, buildQuery, plural, subtitle, clock,
  };
});
