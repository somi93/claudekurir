// Lažni API za stranicu Cjenovnik (/dispatcher/pricing). Oblici odgovora prate app/services/*Service.ts i app/types/pricing.ts.
// PRETPOSTAVKE (nisu provjerene nad pravim backendom, vidi dokument, "Šta nije provjereno"):
//  - recommend-vehicle uzima PRVO pravilo koje se poklopi, po rastućem `priority`;
//  - validacija PUT /pricing vraća 422 kao Laravel (npr. "must be a number" za prazan string);
//  - aktivna naknada = polje `active` (backend ga sam diže po vremenskom prozoru, `activated_at`).
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, ".000000Z");

export const buildPricingWorld = (now = new Date()) => {
  const ago = (min) => iso(new Date(now.getTime() - min * 60000));
  const tags = [
    { id: 1, key: "rain", name: "Kiša", icon: "ti-cloud-rain" },
    { id: 2, key: "snow", name: "Snijeg", icon: "ti-snowflake" },
    { id: 3, key: "traffic", name: "Gužva", icon: "ti-traffic-lights" },
    { id: 4, key: "night", name: "Noćna dostava", icon: "ti-moon", default_time_from: "22:00:00", default_time_to: "06:00:00" },
  ];
  const mk = (id, cid, o) => ({ id, delivery_company_id: cid, description: null, icon: null, unit: null, time_from: null, time_to: null, active: false, activated_at: null, condition_tag: null, ...o });
  const surcharges = {
    24: [
      mk(501, 24, { name: "Kiša", description: "Dodatak po kilometru dok pada kiša.", icon: "ti-cloud-rain", type: "per_km", value: 0.3, unit: "KM/km", active: true, activated_at: ago(72), condition_tag: tags[0] }),
      mk(502, 24, { name: "Noćna dostava", description: "Fiksna doplata za dostave između 22:00 i 06:00.", icon: "ti-moon", type: "fixed", value: 1.5, unit: "KM", time_from: "22:00", time_to: "06:00", condition_tag: tags[3] }),
      mk(503, 24, { name: "Gužva", description: "Fiksna doplata u vrijeme saobraćajne gužve.", icon: "ti-traffic-lights", type: "fixed", value: 1, unit: "KM", condition_tag: tags[2] }),
      mk(504, 24, { name: "Centar grada", description: "Poseban obračun — prednost biciklistima zbog gužve i parkinga.", icon: "mdi-city", type: "note", value: 0, unit: "prilagođeno vozilo", active: true, activated_at: ago(2600) }),
      mk(505, 24, { name: "Praznik", description: "Državni praznici.", type: "fixed", value: 2, unit: "KM" }),
    ],
    27: [],
  };
  const zones = [
    { id: 11, city_id: 1, name: "Centar", terrain_factor: 1.0, center_lat: 44.7722, center_lng: 17.191, radius_meters: 1500 },
    { id: 12, city_id: 1, name: "Starčevica", terrain_factor: 1.4, center_lat: 44.7861, center_lng: 17.2105, radius_meters: 1800 },
    { id: 13, city_id: 1, name: "Lauš", terrain_factor: 1.1, center_lat: 44.7501, center_lng: 17.2012, radius_meters: 2000 },
    { id: 14, city_id: 1, name: "Obilićevo", terrain_factor: 1.0, center_lat: 44.7402, center_lng: 17.1801, radius_meters: 2200 },
  ];
  const rule = (id, cid, o) => ({ id, delivery_company_id: cid, zone_id: null, max_terrain_factor: null, note: null, surcharge_id: null, min_distance_km: null, max_distance_km: null, ...o });
  const rules = {
    24: [
      rule(701, 24, { priority: 1, condition_type: "surcharge", surcharge_id: 501, condition_text: "Naknada: Kiša", vehicle: "car", preferred_vehicles: ["car", "motorbike"], note: "Kiša: biciklisti ne voze." }),
      rule(702, 24, { priority: 2, condition_type: "zone", zone_id: 12, condition_text: "Zona: Starčevica", vehicle: "motorbike", preferred_vehicles: ["motorbike", "car"], max_terrain_factor: 1.6, note: "Brdovit teren." }),
      rule(703, 24, { priority: 3, condition_type: "zone", zone_id: 11, condition_text: "Zona: Centar", vehicle: "bicycle", preferred_vehicles: ["bicycle", "walk", "motorbike"] }),
      rule(704, 24, { priority: 4, condition_type: "distance", min_distance_km: 4, condition_text: "Udaljenost preko 4 km", vehicle: "car", preferred_vehicles: ["car", "motorbike"] }),
      rule(705, 24, { priority: 5, condition_type: "default", condition_text: "Uvijek", vehicle: "motorbike", preferred_vehicles: ["motorbike", "bicycle", "car"], note: "Zadano pravilo." }),
    ],
    27: [],
  };
  return {
    pricing: {
      24: { delivery_company_id: 24, base_price: 2.5, price_per_km: 0.8, currency: "KM" },
      27: { delivery_company_id: 27, base_price: 3, price_per_km: 0.9, currency: "KM" },
    },
    tags, surcharges, zones, rules,
    nextId: 900,
    allowed: ["KM", "BAM", "EUR", "RSD"],
  };
};

const money2 = (n) => Math.round(n * 100) / 100;

const calc = (W, cid, distance) => {
  const p = W.pricing[cid];
  const per = money2(p.price_per_km * distance);
  const lines = (W.surcharges[cid] ?? []).filter((s) => s.active && s.type !== "note").map((s) => ({ id: s.id, name: s.name, type: s.type, amount: money2(s.type === "per_km" ? s.value * distance : s.value) }));
  const st = money2(lines.reduce((a, l) => a + l.amount, 0));
  return { distance_km: distance, currency: p.currency, base_price: p.base_price, price_per_km: p.price_per_km, per_km_total: per, surcharges: lines, surcharge_total: st, total: money2(p.base_price + per + st), duration_seconds: Math.round(distance * 240) };
};

const matches = (W, cid, r, zoneId, distance) => {
  const zone = W.zones.find((z) => z.id === zoneId);
  if (r.max_terrain_factor != null && zone && zone.terrain_factor > r.max_terrain_factor) return false;
  if (r.condition_type === "default") return true;
  if (r.condition_type === "zone") return r.zone_id == null || r.zone_id === zoneId;
  if (r.condition_type === "surcharge") return Boolean((W.surcharges[cid] ?? []).find((s) => s.id === r.surcharge_id && s.active));
  if (r.condition_type === "distance") {
    if (distance == null) return false;
    return (r.min_distance_km == null || distance >= r.min_distance_km) && (r.max_distance_km == null || distance <= r.max_distance_km);
  }
  return false;
};

// vraća true ako je zahtjev obrađen
export const handlePricing = async (mode, { pth, method, body, u, fulfill }) => {
  const W = mode.pr;
  if (!W) return false;
  let m;
  if (pth === "/condition-tags") { await fulfill(200, { success: true, data: W.tags }); return true; }
  if (pth === "/dispatcher/zones" && method === "GET") {
    const city = Number(u.searchParams.get("city_id") || 0);
    await fulfill(200, { success: true, data: city ? W.zones.filter((z) => z.city_id === city) : W.zones }); return true;
  }
  if ((m = pth.match(/^\/delivery-companies\/(\d+)\/pricing$/))) {
    const cid = Number(m[1]);
    const p = W.pricing[cid] ?? (W.pricing[cid] = { delivery_company_id: cid, base_price: 0, price_per_km: 0, currency: "KM" });
    if (method === "PUT") {
      const errors = {};
      for (const k of ["base_price", "price_per_km"]) {
        const v = body?.[k];
        if (typeof v !== "number" || !Number.isFinite(v)) errors[k] = [`The ${k.replace("_", " ")} field must be a number.`];
        else if (v < 0) errors[k] = [`The ${k.replace("_", " ")} field must be at least 0.`];
      }
      if (body?.currency && !W.allowed.includes(body.currency)) errors.currency = ["Valuta nije dozvoljena."];
      if (Object.keys(errors).length) { await fulfill(422, { message: "The given data was invalid.", errors }); return true; }
      Object.assign(p, { base_price: body.base_price, price_per_km: body.price_per_km, currency: body.currency ?? p.currency });
    }
    await fulfill(200, { success: true, data: { ...p } }); return true;
  }
  if ((m = pth.match(/^\/delivery-companies\/(\d+)\/pricing\/calculate$/)) && method === "POST") {
    await fulfill(200, { success: true, data: calc(W, Number(m[1]), 4.5) }); return true;
  }
  if ((m = pth.match(/^\/delivery-companies\/(\d+)\/surcharges$/))) {
    const cid = Number(m[1]); const list = W.surcharges[cid] ?? (W.surcharges[cid] = []);
    if (method === "POST") {
      const tag = W.tags.find((t) => t.id === body.condition_tag_id) ?? null;
      const row = { id: W.nextId++, delivery_company_id: cid, name: body.name, description: body.description, icon: body.icon, type: body.type, value: body.value, unit: body.unit, time_from: body.time_from, time_to: body.time_to, active: Boolean(body.active), activated_at: body.active ? iso(new Date()) : null, condition_tag: tag };
      list.push(row); await fulfill(200, { success: true, data: row }); return true;
    }
    await fulfill(200, { success: true, data: list }); return true;
  }
  if ((m = pth.match(/^\/delivery-companies\/surcharges\/(\d+)$/))) {
    for (const cid of Object.keys(W.surcharges)) {
      const list = W.surcharges[cid]; const i = list.findIndex((s) => s.id === Number(m[1]));
      if (i < 0) continue;
      if (method === "DELETE") { list.splice(i, 1); await fulfill(200, { success: true }); return true; }
      if (method === "PUT") { Object.assign(list[i], body, { activated_at: body.active ? (list[i].activated_at ?? iso(new Date())) : null }); await fulfill(200, { success: true, data: list[i] }); return true; }
    }
    await fulfill(404, { message: "No query results" }); return true;
  }
  if ((m = pth.match(/^\/delivery-companies\/(\d+)\/vehicle-rules$/))) {
    const cid = Number(m[1]); const list = W.rules[cid] ?? (W.rules[cid] = []);
    if (method === "POST") {
      const row = { id: W.nextId++, delivery_company_id: cid, ...body };
      list.push(row); await fulfill(200, { success: true, data: row }); return true;
    }
    await fulfill(200, { success: true, data: [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)) }); return true;
  }
  if ((m = pth.match(/^\/delivery-companies\/vehicle-rules\/(\d+)$/))) {
    for (const cid of Object.keys(W.rules)) {
      const list = W.rules[cid]; const i = list.findIndex((r) => r.id === Number(m[1]));
      if (i < 0) continue;
      if (method === "DELETE") { list.splice(i, 1); await fulfill(200, { success: true }); return true; }
      if (method === "PUT") { Object.assign(list[i], body); await fulfill(200, { success: true, data: list[i] }); return true; }
    }
    await fulfill(404, { message: "No query results" }); return true;
  }
  if ((m = pth.match(/^\/delivery-companies\/(\d+)\/recommend-vehicle$/))) {
    const cid = Number(m[1]);
    const zoneId = u.searchParams.get("zone_id") ? Number(u.searchParams.get("zone_id")) : null;
    const distance = u.searchParams.get("distance_km") ? Number(u.searchParams.get("distance_km")) : null;
    const sorted = [...(W.rules[cid] ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const hit = sorted.find((r) => matches(W, cid, r, zoneId, distance)) ?? null;
    await fulfill(200, { success: true, data: { recommended_vehicles: hit ? (hit.preferred_vehicles?.length ? hit.preferred_vehicles : [hit.vehicle]) : [], matched_rule: hit ? { id: hit.id, condition_type: hit.condition_type, condition_text: hit.condition_text, note: hit.note } : null, price: distance != null ? calc(W, cid, distance) : null } });
    return true;
  }
  return false;
};
