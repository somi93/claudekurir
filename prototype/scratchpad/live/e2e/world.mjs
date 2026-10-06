// Izmišljeni, ali DOSLJEDNI podaci za "Kuriri uživo" (oblici tačno kao u types/*.ts i services/*.ts):
//   couriers-status, courier-locations, couriers-balance, cash-handovers/pending, finance-settings,
//   orders/waiting | active-deliveries | refused | pending-restaurant-confirmation, zones, zones/live-coverage.
// Jedan svijet služi i harnessu (presretač API-ja u pravom Chrome-u) i prototipu table (esbuild paket), pa su brojke
// u mjerenjima i u prototipu iste. Determinističko (seed). NIJE provjereno nad pravim backendom:
//   - da orders/waiting|active-deliveries|pending-restaurant-confirmation nose location.coordination (kod kupca na ponudi
//     je potvrđeno 03.10; na ovim tabelama nije viđeno), da courier-locations izostavlja kurire bez pozicije (dokument 05.10 §8).
import { buildCouriers, COMPANIES, FINANCE } from "./fx.mjs";
import { buildFinanceWorld, serveFinance } from "./fin-fx.mjs";

const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const isoUtc = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, ".000000Z");
const isoOff = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "+00:00");

export const CENTER = { lat: 44.7722, lng: 17.191 };
const M_LAT = 111320;
const mLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
export const offsetM = (lat, lng, dx, dy) => ({ lat: lat + dy / M_LAT, lng: lng + dx / mLng(lat) });

// Zone firme 24 (krug: centar + radijus). Zalužani nema geometriju (kao u svijetu table Raspored).
export const ZONES = [
  { id: 11, city_id: 1, name: "Centar", terrain_factor: 1, center_lat: 44.7722, center_lng: 17.191, radius_meters: 1700 },
  { id: 12, city_id: 1, name: "Borik", terrain_factor: 1.5, center_lat: 44.786, center_lng: 17.209, radius_meters: 1500 },
  { id: 13, city_id: 1, name: "Starčevica", terrain_factor: 1.5, center_lat: 44.7975, center_lng: 17.233, radius_meters: 1600 },
  { id: 14, city_id: 1, name: "Lauš", terrain_factor: 1, center_lat: 44.758, center_lng: 17.174, radius_meters: 1400 },
  { id: 15, city_id: 1, name: "Petrićevac", terrain_factor: 1.5, center_lat: 44.764, center_lng: 17.229, radius_meters: 1500 },
  { id: 16, city_id: 1, name: "Obilićevo", terrain_factor: 1, center_lat: 44.748, center_lng: 17.193, radius_meters: 1300 },
  { id: 17, city_id: 1, name: "Zalužani", terrain_factor: 2, center_lat: null, center_lng: null, radius_meters: null },
];
const zoneBy = (name) => ZONES.find((z) => z.name === name);

// Stanje svakog od 26 kurira po indeksu (buildCouriers): [stanje, godina signala u sekundama, zona, dx, dy, brzina m/s].
//   fresh = signal stiže uživo (svaki odgovor ima novo vrijeme); ostali imaju FIKSNO vrijeme (staro).
// "delivering/online/idle" je ono što kaže server; "stale" = server i dalje kaže online/delivering, a signal je star (aplikacija ugašena).
const S = (state, ago, zone, dx, dy, speed = 0, fresh = false, status = null) => ({ state, ago, zone, dx, dy, speed, fresh, status: status ?? state });
const MIN = 60_000, H = 3_600_000, D = 24 * H;
export const SCRIPT = [
  /* 0 */ S("delivering", 8_000, "Centar", 300, 200, 6.1, true),
  /* 1 */ S("online", 20_000, "Centar", -500, -300, 0, true),
  /* 2 */ S("delivering", 12_000, "Borik", 200, -100, 4.2, true),
  /* 3 */ S("offline", 5 * H, "Petrićevac", 100, 100, 0, false),
  /* 4 */ null,
  /* 5 */ S("online", 35_000, "Lauš", 100, 150, 0, true),
  /* 6 */ null,
  /* 7 */ S("offline", 25 * MIN, "Centar", 900, -600, 0, false),
  /* 8 */ S("delivering", 14 * MIN, "Starčevica", -300, 100, 5.0, false), // u dostavi, signal izgubljen
  /* 9 */ S("online", 2 * H, "Borik", -600, 400, 0, false), // "slobodan", a nije se javio 2 h
  /* 10 */ S("delivering", 6_000, "Petrićevac", 200, 100, 7.3, true),
  /* 11 */ S("delivering", 30_000, "Centar", -200, 700, 3.8, true),
  /* 12 */ S("online", 50_000, "Obilićevo", 50, 50, 0, true),
  /* 13 */ S("online", 15_000, "Centar", 600, 500, 0, true, "idle"),
  /* 14 */ S("online", 70_000, "Borik", 900, 700, 0, true),
  /* 15 */ S("online", 6 * H, "Lauš", -400, -200, 0, false), // "slobodan", a nije se javio 6 h
  /* 16 */ S("delivering", 25_000, "Starčevica", 500, -300, 2.9, true),
  /* 17 */ S("offline", 41 * MIN, "Centar", -900, 100, 0, false),
  /* 18 */ S("offline", 12 * MIN, "Petrićevac", -300, -400, 0, false),
  /* 19 */ S("offline", 55 * MIN, "Lauš", 700, -300, 0, false),
  /* 20 */ S("offline", 3 * H, "Obilićevo", -200, 300, 0, false),
  /* 21 */ S("offline", 9 * H, "Starčevica", 300, 300, 0, false),
  /* 22 */ S("offline", 26 * H, "Centar", -1200, -200, 0, false),
  /* 23 */ S("offline", 3 * D, "Borik", 400, -400, 0, false),
  /* 24 */ null,
  /* 25 */ S("online", 40_000, "Centar", 100, -700, 0, true),
];

const RESTAURANTS = [
  ["Pizzeria Roma", "Gospodska 14", "051/311-100"],
  ["Burger Hub", "Veselina Masleše 9", "051/311-222"],
  ["Sushi Bar Ume", "Kralja Alfonsa XIII 21", "051/229-340"],
  ["Ćevabdžinica Mujo", "Mäkelä 3", "051/216-877"],
  ["Bistro Vrbas", "Kej Vrbasa 2", "051/300-415"],
  ["Wok & Roll", "Jevrejska 11", "051/463-902"],
  ["Pekara Zlatno klasje", "Cara Dušana 33", "051/321-045"],
  ["Trattoria Lido", "Aleja Svetog Save 40", "051/430-218"],
  ["Kebab Istanbul", "Srpska 77", "051/222-190"],
  ["Piletarija Kod Neše", "Ive Andrića 6", "066/501-778"],
];
const rest = (name) => RESTAURANTS.find((r) => r[0] === name);

const ADDR = [
  ["Kralja Petra I Karađorđevića 85", "Centar", 150, 420],
  ["Aleja Svetog Save 12", "Centar", -380, 90],
  ["Vojvode Stepe Stepanovića 43", "Borik", 120, 220],
  ["Bulevar cara Dušana 22", "Centar", 520, -260],
  ["Gundulićeva 7", "Lauš", -90, -140],
  ["Jevrejska 18", "Centar", -140, 330],
  ["Veljka Mlađenovića 14", "Borik", -340, -120],
  ["Cara Lazara 31", "Petrićevac", 210, -190],
  ["Bulevar vojvode Živojina Mišića 9", "Starčevica", 160, 260],
  ["Ivana Franje Jukića 5", "Centar", 40, -520],
  ["Mije Čorkovića 1", "Obilićevo", -120, 120],
  ["Srpska 40", "Centar", 260, 140],
];
const loc = (i, id) => {
  const [address, zn, dx, dy] = ADDR[i % ADDR.length];
  const z = zoneBy(zn);
  const p = offsetM(z.center_lat, z.center_lng, dx, dy);
  return { id, address, apartment: i % 3 === 0 ? String(10 + i) : null, floor: i % 3 === 0 ? String(1 + (i % 5)) : null, firm: null, zip: "78000", coordination: { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) } };
};

// Svijet: sat je ulaz (Date), pa je isti poziv uvijek isti svijet.
export function buildLiveWorld({ now = new Date(), n = 26, seed = 7 } = {}) {
  const t0 = now.getTime();
  const couriers = buildCouriers(n, { now, seed });
  couriers.forEach((c, i) => {
    const s = i === 3 || i === 20;
    c.suspended = s;
    c.suspended_reason = s ? (i === 3 ? "Dug gotovine" : "Nije se javio na smjenu") : null;
    c.suspended_at = s ? isoUtc(t0 - (2 + i) * D) : null;
  });
  couriers[1].vehicle = { id: 9001, type: "scooter" };

  const F = buildFinanceWorld({ now, couriers, n });

  // courier-locations (samo kuriri sa pozicijom)
  const fixed = []; // {courier_id, state script, base position}
  const rnd = mulberry(seed + 3);
  const geo = ZONES.filter((z) => z.center_lat != null);
  // iznad 26 kurira (probe skaliranja) stanja se generišu iz istog rasporeda težina
  const genScript = (i) => {
    const x = rnd();
    const z = geo[Math.floor(rnd() * geo.length)].name;
    const dx = Math.round((rnd() - 0.5) * 3000), dy = Math.round((rnd() - 0.5) * 3000);
    if (x < 0.1) return null;
    if (x < 0.25) return S("delivering", 5_000 + Math.floor(rnd() * 50_000), z, dx, dy, 2 + rnd() * 6, true);
    if (x < 0.45) return S("online", 5_000 + Math.floor(rnd() * 60_000), z, dx, dy, 0, true);
    if (x < 0.52) return S("online", 3 * H + Math.floor(rnd() * 5 * H), z, dx, dy, 0, false);
    if (x < 0.78) return S("offline", (10 + Math.floor(rnd() * 50)) * MIN, z, dx, dy, 0, false);
    return S("offline", (3 + Math.floor(rnd() * 60)) * H, z, dx, dy, 0, false);
  };
  couriers.forEach((c, i) => {
    const sc = i < SCRIPT.length ? SCRIPT[i] : genScript(i);
    if (!sc) return;
    const z = zoneBy(sc.zone);
    const p = offsetM(z.center_lat, z.center_lng, sc.dx, sc.dy);
    fixed.push({ c, i, sc, lat: p.lat, lng: p.lng, heading: (i * 47) % 360, rnd: rnd(), at: t0 - sc.ago });
  });
  const locations = () => fixed.map((f) => ({
    courier_id: f.c.courier_id,
    name: f.c.name,
    phone: f.c.phone,
    suspended: f.c.suspended,
    vehicle: f.c.vehicle,
    location: {
      latitude: +f.lat.toFixed(6),
      longitude: +f.lng.toFixed(6),
      heading: f.sc.state === "offline" || f.sc.speed === 0 ? (f.i % 5 === 0 ? null : f.heading) : f.heading,
      // server šalje null kad uređaj nije javio brzinu; ovdje i jedan kurir u dostavi
      speed: f.sc.fresh ? (f.i === 11 ? null : f.sc.speed) : f.sc.state === "delivering" ? f.sc.speed : f.sc.state === "online" ? 0 : null,
      status: f.sc.status === "idle" ? "idle" : f.sc.state,
      updated_at: isoOff(f.sc.fresh ? W.clock() - f.sc.ago : f.at),
    },
  }));

  // narudžbe
  const mk = (id, name, extra) => ({ id, restaurant_name: name, ...extra });
  const T = (min) => isoUtc(t0 - min * MIN); // prije `min` minuta
  const U = (min) => isoUtc(t0 + min * MIN); // za `min` minuta
  const waiting = [
    mk(4277, "Pizzeria Roma", { ordered_at: T(31), delivery_time: U(-3), waiting_minutes: 26, minutes_until_delivery: -3, status: "ready", ready_in_minutes: 0, ready_at: T(8), delivery_price: 3.5, location: loc(0, 7001), delivery_zone: "Centar", distance_km: 2.3 }),
    mk(4278, "Trattoria Lido", { ordered_at: T(24), delivery_time: U(14), waiting_minutes: 18, minutes_until_delivery: 14, status: "accepted", ready_in_minutes: 6, ready_at: U(6), delivery_price: 4, location: loc(4, 7002), delivery_zone: "Lauš", distance_km: 3.1 }),
    mk(4279, "Kebab Istanbul", { ordered_at: T(9), delivery_time: U(31), waiting_minutes: 6, minutes_until_delivery: 31, status: "accepted", ready_in_minutes: 12, ready_at: U(12), delivery_price: 3.5, location: loc(2, 7003), delivery_zone: "Borik", distance_km: 1.8 }),
    mk(4280, "Pekara Zlatno klasje", { ordered_at: T(4), delivery_time: U(40), waiting_minutes: 2, minutes_until_delivery: 40, status: "ready", ready_in_minutes: 0, ready_at: T(1), delivery_price: 3, location: loc(3, 7004), delivery_zone: "Centar", distance_km: 1.2 }),
    mk(4281, "Piletarija Kod Neše", { ordered_at: T(120), delivery_time: U(370), waiting_minutes: 120, minutes_until_delivery: 370, status: "accepted", ready_in_minutes: 355, ready_at: U(355), delivery_price: 4.5, location: loc(7, 7005), delivery_zone: "Petrićevac", distance_km: 4.2 }),
  ];
  const cour = (i) => ({ id: couriers[i].courier_id, name: couriers[i].name, phone: couriers[i].phone, vehicle: couriers[i].vehicle?.type ?? "foot" });
  const active = [
    mk(4269, "Pizzeria Roma", { ordered_at: T(34), delivery_time: U(9), minutes_until_delivery: 9, status: "picked_up", delivery_price: 3.5, courier: cour(0), location: loc(1, 7011) }),
    mk(4271, "Burger Hub", { ordered_at: T(15), delivery_time: U(22), minutes_until_delivery: 22, status: "booked", delivery_price: 3.5, courier: cour(2), location: loc(6, 7012) }),
    mk(4262, "Sushi Bar Ume", { ordered_at: T(58), delivery_time: U(-11), minutes_until_delivery: -11, status: "picked_up", delivery_price: 4.5, courier: cour(8), location: loc(8, 7013) }),
    mk(4274, "Wok & Roll", { ordered_at: T(28), delivery_time: U(15), minutes_until_delivery: 15, status: "picked_up", delivery_price: 3.5, courier: cour(10), location: loc(7, 7014) }),
    mk(4276, "Kebab Istanbul", { ordered_at: T(10), delivery_time: U(27), minutes_until_delivery: 27, status: "booked", delivery_price: 3.5, courier: cour(11), location: loc(5, 7015) }),
    mk(4265, "Trattoria Lido", { ordered_at: T(49), delivery_time: U(-6), minutes_until_delivery: -6, status: "picked_up", delivery_price: 4, courier: cour(16), location: loc(10, 7016) }),
  ];
  const pending = [
    { id: 4282, restaurant_name: "Burger Hub", restaurant_phone: "051/311-222", delivery_type: 0, ordered_at: T(3), waiting_minutes: 3, delivery_time: U(45), delivery_price: 3.5, location: loc(9, 7021) },
    { id: 4283, restaurant_name: "Wok & Roll", restaurant_phone: "051/463-902", delivery_type: 0, ordered_at: T(9), waiting_minutes: 9, delivery_time: U(40), delivery_price: 3.5, location: loc(1, 7022) },
    { id: 4284, restaurant_name: "Ćevabdžinica Mujo", restaurant_phone: "051/216-877", delivery_type: 0, ordered_at: T(22), waiting_minutes: 22, delivery_time: U(25), delivery_price: 4, location: loc(11, 7023) },
    { id: 4150, restaurant_name: "Bistro Vrbas", restaurant_phone: "051/300-415", delivery_type: 0, ordered_at: T(310), waiting_minutes: 310, delivery_time: T(280), delivery_price: 3.5, location: null },
  ];
  const refused = [{ id: 4255, restaurant_name: "Ćevabdžinica Mujo", delivery_time: T(95), delivery_price: 4, courier_name: couriers[0].name, location: loc(3, 7031) }];

  const W = {
    company: { id: 24, name: "Ordera Dostava Banja Luka", city: "Banja Luka", currency: "KM" },
    couriers, F, zones: ZONES, orders: { waiting, active, pending, refused },
    settings: { ...FINANCE, delivery_company_id: 24, cash_limit_amount: 200, cash_limit_enforcement: "BLOCK", payout_period_days: 7, currency: "KM" },
    flags: { omitNoPosition: true, strings: false },
    clock: () => t0,
    locations,
    t0,
    // --- simulacija za prototip (harness je ne koristi) ---
    // pomjeri svježe kurire koji voze: brzina (m/s) x dt (s) po smjeru; na granici se okreću
    move(dtSec = 15) {
      for (const f of fixed) {
        if (!f.sc.fresh || !(f.sc.speed > 0)) continue;
        const d = f.sc.speed * dtSec;
        const h = (f.heading * Math.PI) / 180;
        const m = offsetM(f.lat, f.lng, Math.sin(h) * d, Math.cos(h) * d);
        const far = Math.hypot((m.lng - CENTER.lng) * mLng(CENTER.lat), (m.lat - CENTER.lat) * M_LAT);
        if (far > 3800) f.heading = (f.heading + 180) % 360;
        else { f.lat = m.lat; f.lng = m.lng; }
      }
    },
    // zadnji signal je bio prije `agoMs` (kurir koji i dalje "online" stoji na serveru)
    loseSignal(courierId, agoMs = 6 * MIN) {
      const f = fixed.find((x) => x.c.courier_id === courierId);
      if (!f) return false;
      f.sc = { ...f.sc, fresh: false };
      f.at = W.clock() - agoMs;
      return true;
    },
    restoreSignal(courierId) {
      const f = fixed.find((x) => x.c.courier_id === courierId);
      if (!f) return false;
      f.sc = { ...f.sc, fresh: true, ago: 6_000 };
      return true;
    },
    nextOrderId: 4290,
    // nova narudžba koja čeka kurira (restoran je prihvatio, hrana je gotova)
    addWaitingOrder() {
      const id = W.nextOrderId++;
      const now = W.clock();
      const nm = RESTAURANTS[id % RESTAURANTS.length][0];
      W.orders.waiting.unshift({ id, restaurant_name: nm, ordered_at: isoUtc(now - 2 * MIN), delivery_time: isoUtc(now + 38 * MIN), waiting_minutes: 1, minutes_until_delivery: 38, status: "ready", ready_in_minutes: 0, ready_at: isoUtc(now - MIN), delivery_price: 3.5, location: loc(id, 7100 + id), delivery_zone: "Centar", distance_km: 1.6 });
      return id;
    },
  };
  return W;
}

// Zona u kojoj je tačka (najmanji krug koji je sadrži); null ako je van svih.
const distM = (a, b) => {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
export const zoneOf = (lat, lng, zones = ZONES) => {
  const hit = zones.filter((z) => z.center_lat != null && distM({ lat, lng }, { lat: z.center_lat, lng: z.center_lng }) <= z.radius_meters);
  hit.sort((a, b) => a.radius_meters - b.radius_meters);
  return hit[0] ?? null;
};

export function liveCoverage(W) {
  const rows = new Map(W.zones.filter((z) => z.center_lat != null).map((z) => [z.id, { zone_id: z.id, zone_name: z.name, online: 0, idle: 0, delivering: 0 }]));
  for (const l of W.locations()) {
    const st = l.location.status;
    if (st === "offline") continue;
    const age = W.clock() - Date.parse(l.location.updated_at);
    if (age > 15 * MIN) continue; // backend broji samo svjež signal (pretpostavka prototipa, nije provjereno)
    const z = zoneOf(l.location.latitude, l.location.longitude, W.zones);
    if (!z) continue;
    const r = rows.get(z.id);
    if (st === "delivering") r.delivering++;
    else if (st === "idle") r.idle++;
    else r.online++;
  }
  return [...rows.values()];
}

// Čista funkcija servera: vraća [status, tijelo] ili null (ruta nije poznata). Koriste je harness i prototip.
export function serveLive(W, { pth, method = "GET", body = null, q = new URLSearchParams() }) {
  const ok = (data) => [200, { success: true, data }];
  let m;
  if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/(.*)$/))) {
    const cid = Number(m[1]);
    const rest = m[2];
    if (cid !== 24) return ok([]);
    if (rest === "couriers-status") return ok(W.couriers);
    if (rest === "courier-locations") {
      const rows = W.locations();
      if (!W.flags.omitNoPosition) {
        for (const c of W.couriers) if (!rows.some((r) => r.courier_id === c.courier_id)) rows.push({ courier_id: c.courier_id, name: c.name, phone: c.phone, suspended: c.suspended, vehicle: c.vehicle, location: null });
      }
      if (W.flags.strings) for (const r of rows) if (r.location) { r.location.latitude = String(r.location.latitude); r.location.longitude = String(r.location.longitude); }
      return ok(rows);
    }
    if (rest === "finance-settings") return ok(W.settings);
  }
  if (pth === "/dispatcher/orders/waiting") return ok(W.orders.waiting);
  if (pth === "/dispatcher/orders/active-deliveries") return ok(W.orders.active);
  if (pth === "/dispatcher/orders/refused") return ok(W.orders.refused);
  if (pth === "/dispatcher/orders/pending-restaurant-confirmation") return ok(W.orders.pending);
  if (pth === "/dispatcher/zones") return ok(W.zones);
  if (pth === "/dispatcher/zones/live-coverage") return ok(liveCoverage(W));
  return serveFinance(W.F, { pth, method, body, q });
}

export { COMPANIES, FINANCE };
