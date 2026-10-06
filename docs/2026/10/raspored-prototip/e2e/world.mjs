// Izmišljeni, ali dosljedni podaci za stranicu Raspored i zone (/dispatcher/scheduling).
// Oblici odgovora prate app/services/dispatcherZonesService.ts, shiftTemplatesService.ts i dispatcherAvailabilityService.ts.
// PRETPOSTAVKE (nisu provjerene nad pravim backendom):
//  - status smjene izvodi server iz kapaciteta (bookings < min -> understaffed, < target -> below_target, >= max -> full, inače target_reached);
//  - POST/PUT smjene vraćaju PUN red kao GET (odgovor 01.09, tačka 2.1);
//  - duplicate-week preskače smjenu koja već postoji (ista zona + isto vrijeme + isti datum); pravilo preskakanja nije dokumentovano.
const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const mondayOf = (d) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  return r;
};
export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const statusOf = (min, target, max, bookings) => {
  if (bookings < min) return "understaffed";
  if (bookings < target) return "below_target";
  if (max !== null && bookings >= max) return "full";
  return "target_reached";
};

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
};

export const ZONES = [
  { id: 11, city_id: 1, name: "Centar", terrain_factor: 1.0, center_lat: 44.7722, center_lng: 17.191, radius_meters: 1500 },
  { id: 12, city_id: 1, name: "Starčevica", terrain_factor: 1.4, center_lat: 44.7861, center_lng: 17.2105, radius_meters: 1800 },
  { id: 13, city_id: 1, name: "Lauš", terrain_factor: 1.1, center_lat: 44.7501, center_lng: 17.2012, radius_meters: 2000 },
  { id: 14, city_id: 1, name: "Obilićevo", terrain_factor: 1.0, center_lat: 44.7402, center_lng: 17.1801, radius_meters: 2200 },
  { id: 15, city_id: 1, name: "Борик", terrain_factor: 1.2, center_lat: 44.7845, center_lng: 17.1783, radius_meters: 1400 },
  { id: 16, city_id: 1, name: "Petrićevac", terrain_factor: 1.5, center_lat: 44.796, center_lng: 17.23, radius_meters: 1900 },
  { id: 17, city_id: 1, name: "Zalužani", terrain_factor: 1.3 }, // stara zona bez geometrije (GET je dokumentovan bez tih polja)
];

// Obrazac planirane sedmice: [zona, dani (0=pon), od, do, min, cilj, max|null, hitno dani]
const PATTERN = [
  [11, [0, 1, 2, 3, 4, 5, 6], "11:00", "15:00", 2, 4, 6, []],
  [11, [0, 1, 2, 3, 4, 5, 6], "17:00", "22:00", 3, 6, 8, [4, 5]],
  [12, [0, 1, 2, 3, 4, 5, 6], "12:00", "20:00", 1, 2, 3, []],
  [13, [0, 1, 2, 3, 4, 5], "17:00", "22:00", 1, 2, null, []],
  [14, [0, 1, 2, 3, 4, 5], "11:00", "21:00", 1, 2, null, []],
  [15, [1, 2, 3, 4, 5, 6], "16:00", "22:00", 1, 2, null, []],
  [16, [5, 6], "18:00", "22:00", 1, 1, null, []],
];

// Isti svijet kao u prototipu (board/world.js): iste zone, iste smjene, iste popunjenosti, da "prije" i "poslije" pokazuju iste podatke.
import { createRequire } from "node:module";
const requireCjs = createRequire(import.meta.url);
export function buildSchedulingWorld(now = new Date(), { otherCityZone = false, cityCenter = null } = {}) {
  const W = requireCjs("../world.js");
  const base = W.build();
  const dLat = cityCenter ? cityCenter[0] - 44.7725 : 0;
  const dLng = cityCenter ? cityCenter[1] - 17.1925 : 0;
  const zones = base.zones.map((z) => {
    const row = { id: z.id, city_id: 1, name: z.name, terrain_factor: z.tf };
    if (z.lat != null) Object.assign(row, { center_lat: z.lat + dLat, center_lng: z.lng + dLng, radius_meters: z.r });
    return row;
  });
  if (otherCityZone) zones.push({ id: 21, city_id: 2, name: "Čaršija", terrain_factor: 1.0, center_lat: 44.9791, center_lng: 16.7136, radius_meters: 1200 });
  const shifts = base.shifts.map((s) => {
    const z = zones.find((x) => x.id === s.zoneId);
    return {
      id: s.id, zone: { id: s.zoneId, name: z.name }, date: s.date, start_time: s.start, end_time: s.end,
      min_couriers: s.min, target_couriers: s.target, max_couriers: s.max, current_bookings: s.booked,
      status: statusOf(s.min, s.target, s.max, s.booked), capacity_source: "manual", high_demand: s.hot, delivery_company_id: 24,
    };
  });
  const coverage = base.zones.filter((z) => base.live[z.id]).map((z) => ({ zone_id: z.id, zone_name: z.name, online: base.live[z.id].online, idle: base.live[z.id].idle, delivering: base.live[z.id].delivering }));
  const week0 = mondayOf(new Date(2026, 9, 5));
  return { zones, shifts, coverage, enforcement: { 24: false, 27: true, 31: false }, nextId: () => base.nextShiftId++, nextZoneId: 40, week0 };
}

const fullRow = (S, row) => {
  const z = S.zones.find((x) => x.id === (row.zone?.id ?? row.zone_id));
  return { ...row, zone: { id: z?.id ?? row.zone_id, name: z?.name ?? "" } };
};

// vraća true ako je zahtjev obrađen
export const handleScheduling = async (mode, { pth, method, body, u, fulfill }) => {
  const S = mode.sc;
  if (!S) return false;
  let m;
  if (pth === "/dispatcher/zones" && method === "GET") {
    const city = Number(u.searchParams.get("city_id") || 0);
    await fulfill(200, { success: true, data: city ? S.zones.filter((z) => z.city_id === city) : S.zones });
    return true;
  }
  if (pth === "/dispatcher/zones" && method === "POST") {
    if (!body?.name || !String(body.name).trim()) { await fulfill(422, { message: "The given data was invalid.", errors: { name: ["Naziv zone je obavezan."] } }); return true; }
    if (S.zones.some((z) => z.city_id === body.city_id && z.name.toLowerCase() === String(body.name).trim().toLowerCase())) {
      await fulfill(422, { message: "The given data was invalid.", errors: { name: ["Zona sa tim nazivom već postoji u ovom gradu."] } }); return true;
    }
    const row = { id: S.nextZoneId++, city_id: body.city_id, name: String(body.name).trim(), terrain_factor: body.terrain_factor, center_lat: body.center_lat, center_lng: body.center_lng, radius_meters: body.radius_meters };
    S.zones.push(row);
    await fulfill(200, { success: true, data: row });
    return true;
  }
  if ((m = pth.match(/^\/dispatcher\/zones\/(\d+)$/))) {
    const id = Number(m[1]);
    const z = S.zones.find((x) => x.id === id);
    if (!z) { await fulfill(404, { message: "No query results" }); return true; }
    if (method === "PUT") { Object.assign(z, { city_id: body.city_id, name: body.name, terrain_factor: body.terrain_factor, center_lat: body.center_lat, center_lng: body.center_lng, radius_meters: body.radius_meters }); await fulfill(200, { success: true, data: z }); return true; }
    if (method === "DELETE") {
      if (S.deleteBlocked) { await fulfill(409, { message: "Zona se ne može obrisati jer ima smjene." }); return true; }
      S.zones.splice(S.zones.indexOf(z), 1);
      await fulfill(200, { success: true });
      return true;
    }
  }
  if (pth === "/dispatcher/zones/live-coverage") {
    await fulfill(200, { success: true, data: S.coverageEmpty ? [] : S.coverage });
    return true;
  }
  if (pth === "/dispatcher/shift-templates" && method === "GET") {
    const from = u.searchParams.get("from"), to = u.searchParams.get("to");
    const zone = Number(u.searchParams.get("zone_id") || 0);
    const cid = Number(u.searchParams.get("delivery_company_id") || 0);
    const rows = S.shifts.filter((s) => (!cid || s.delivery_company_id === cid) && (!from || s.date >= from) && (!to || s.date <= to) && (!zone || s.zone.id === zone));
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    await fulfill(200, { success: true, data: rows });
    return true;
  }
  if (pth === "/dispatcher/shift-templates" && method === "POST") {
    if (!(body.end_time > body.start_time)) { await fulfill(422, { message: "The given data was invalid.", errors: { end_time: ["Kraj mora biti poslije početka."] } }); return true; }
    const row = { id: S.nextId(), zone_id: body.zone_id, delivery_company_id: body.delivery_company_id, date: body.date, start_time: body.start_time, end_time: body.end_time, min_couriers: body.min_couriers, target_couriers: body.target_couriers, max_couriers: body.max_couriers, current_bookings: 0, capacity_source: "manual", high_demand: body.high_demand };
    row.status = statusOf(row.min_couriers, row.target_couriers, row.max_couriers, 0);
    const full = fullRow(S, row);
    S.shifts.push(full);
    await fulfill(200, { success: true, data: full });
    return true;
  }
  if (pth === "/dispatcher/shift-templates/duplicate-week" && method === "POST") {
    const src = new Date(`${body.source_week_start}T00:00:00`), dst = new Date(`${body.target_week_start}T00:00:00`);
    const off = Math.round((dst - src) / 86400000);
    let created = 0, skipped = 0;
    const from = body.source_week_start, to = isoDate(addDays(src, 6));
    for (const s of [...S.shifts]) {
      if (s.delivery_company_id !== body.delivery_company_id || s.date < from || s.date > to) continue;
      if (body.zone_id && s.zone.id !== body.zone_id) continue;
      const date = isoDate(addDays(new Date(`${s.date}T00:00:00`), off));
      if (S.shifts.some((x) => x.date === date && x.zone.id === s.zone.id && x.start_time === s.start_time && x.end_time === s.end_time)) { skipped++; continue; }
      S.shifts.push({ ...s, id: S.nextId(), date, current_bookings: 0, status: statusOf(s.min_couriers, s.target_couriers, s.max_couriers, 0) });
      created++;
    }
    await fulfill(200, { success: true, data: { created_count: created, skipped_count: skipped } });
    return true;
  }
  if ((m = pth.match(/^\/dispatcher\/shift-templates\/(\d+)$/))) {
    const id = Number(m[1]);
    const s = S.shifts.find((x) => x.id === id);
    if (!s) { await fulfill(404, { message: "No query results" }); return true; }
    if (method === "PUT") {
      if (body.target_couriers < body.min_couriers) { await fulfill(422, { message: "The given data was invalid.", errors: { target_couriers: ["Cilj mora biti bar jednak minimumu."] } }); return true; }
      Object.assign(s, { min_couriers: body.min_couriers, target_couriers: body.target_couriers, max_couriers: body.max_couriers, high_demand: body.high_demand });
      s.status = statusOf(s.min_couriers, s.target_couriers, s.max_couriers, s.current_bookings);
      await fulfill(200, { success: true, data: s });
      return true;
    }
    if (method === "DELETE") { S.shifts.splice(S.shifts.indexOf(s), 1); await fulfill(200, { success: true }); return true; }
  }
  if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/availability-enforcement$/))) {
    const cid = Number(m[1]);
    if (method === "PATCH") S.enforcement[cid] = Boolean(body?.enabled);
    await fulfill(200, { success: true, data: { delivery_company_id: cid, requires_availability_confirmation: Boolean(S.enforcement[cid]) } });
    return true;
  }
  if ((m = pth.match(/^\/dispatcher\/delivery-companies\/(\d+)\/city$/)) && method === "PATCH") {
    const c = mode.companies.find((x) => x.id === Number(m[1]));
    if (!c) { await fulfill(404, { message: "No query results" }); return true; }
    c.city_id = body.city_id; c.city_name = body.city_id === 1 ? "Banja Luka" : `Grad ${body.city_id}`;
    await fulfill(200, { success: true, data: c });
    return true;
  }
  return false;
};
