import type { DispatcherZone } from "~/types/dispatcherZone";
import { addDays, fold, iso, parseIso, type Clock, type SchedShift } from "~/utils/schedule";

// Čista logika zona: krug (centar + radijus), preklapanje, površina, faktor terena, pretraga i
// upotreba zone u smjenama. Bez DOM-a i bez Nuxta, pa se provjerava u običnom Node-u.

// Zona u obliku koji logika koristi; lat/lng/r su null za zonu bez položaja na karti.
export type GeoZone = {
  id: number;
  name: string;
  tf: number;
  lat: number | null;
  lng: number | null;
  r: number | null;
};

export const toGeoZone = (z: DispatcherZone): GeoZone => ({
  id: z.id,
  name: z.name,
  tf: z.terrainFactor,
  lat: z.centerLat,
  lng: z.centerLng,
  r: z.radiusMeters,
});

export type Circle = { lat: number; lng: number; r: number };

export const hasGeo = (z: GeoZone): z is GeoZone & Circle => z.lat != null && z.lng != null && z.r != null;

const R_EARTH = 6371000;
export const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
};

// Koliko se manji krug preklapa sa većim, u procentima manjeg (0–100).
export const overlapPct = (a: Circle, b: Circle): number => {
  const d = distM(a, b);
  const r1 = a.r;
  const r2 = b.r;
  if (d >= r1 + r2) return 0;
  const small = Math.min(r1, r2);
  const big = Math.max(r1, r2);
  if (d <= big - small) return 100;
  const A =
    r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)) +
    r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2)) -
    0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return Math.min(100, Math.round((A / (Math.PI * small * small)) * 100));
};

export const areaKm2 = (r: number): number => (Math.PI * r * r) / 1e6;

export const fmtKm = (m: number): string =>
  m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1).replace(".", ",")} km` : `${m} m`;

export const fmtNum = (n: number): string => String(n).replace(".", ",");

export type ZoneOverlap = { zone: GeoZone; pct: number };

// Zone sa kojima se krug preklapa, od najvećeg preklapanja. `zone` može biti nacrt (id null).
export const overlaps = (
  zone: { id: number | null; lat: number | null; lng: number | null; r: number | null },
  zones: GeoZone[]
): ZoneOverlap[] => {
  if (zone.lat == null || zone.lng == null || zone.r == null) return [];
  const mine: Circle = { lat: zone.lat, lng: zone.lng, r: zone.r };
  return zones
    .filter(hasGeo)
    .filter((z) => z.id !== zone.id)
    .map((z) => ({ zone: z as GeoZone, pct: overlapPct(mine, z) }))
    .filter((x) => x.pct > 0)
    .sort((a, b) => b.pct - a.pct);
};

// Faktor terena: prečice umjesto slobodnog broja. Utiče na to koja vozila smiju u zonu (max_terrain_factor u Cjenovniku).
export const TERRAIN = [
  { v: 1, label: "Ravno", hint: "1,0" },
  { v: 1.5, label: "Brdovito", hint: "1,5" },
  { v: 2, label: "Strmo", hint: "2,0" },
];
export const terrainWord = (tf: number): string =>
  tf === 1 ? " · ravno" : tf >= 2 ? " · strmo" : tf >= 1.5 ? " · brdovito" : "";

export const searchZones = <T extends { name: string }>(zones: T[], q: string): T[] => {
  const n = fold(q).trim();
  return n ? zones.filter((z) => fold(z.name).includes(n)) : zones;
};

// Broj smjena u zoni od danas za `days` dana: za list brisanja zone.
export const usage = (zoneId: number, shifts: SchedShift[], now: Clock, days = 28): number => {
  const end = iso(addDays(parseIso(now.date), days));
  return shifts.filter((s) => s.zoneId === zoneId && s.date >= now.date && s.date < end).length;
};

/* ---------- uređivač zone ---------- */
export type ZoneDraft = {
  id: number | null;
  name: string;
  tf: number;
  r: number;
  lat: number;
  lng: number;
};

export const RADIUS_MIN = 100;
export const RADIUS_MAX = 5000;

// "1,5" ili "1.5" -> 1.5; neispravno -> NaN.
export const parseDecimal = (s: string): number => {
  const t = String(s).trim().replace(",", ".");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? n : NaN;
};

export type ZoneErrors = Partial<Record<"name" | "tf" | "r" | "lat" | "lng", string>>;

export const validateZone = (d: ZoneDraft, zones: GeoZone[]): ZoneErrors => {
  const e: ZoneErrors = {};
  if (!d.name.trim()) e.name = "Upiši naziv zone.";
  else if (zones.some((z) => z.id !== d.id && fold(z.name) === fold(d.name.trim()))) {
    e.name = "Zona sa tim nazivom već postoji u ovom gradu.";
  }
  if (!(d.tf > 0) || !Number.isFinite(d.tf)) e.tf = "Faktor terena je broj veći od 0, npr. 1,5.";
  if (!(d.r >= RADIUS_MIN && d.r <= RADIUS_MAX)) e.r = "Radijus je od 100 do 5000 m.";
  if (!(d.lat >= -90 && d.lat <= 90)) e.lat = "Širina je od −90 do 90.";
  if (!(d.lng >= -180 && d.lng <= 180)) e.lng = "Dužina je od −180 do 180.";
  return e;
};

export const zoneDirty = (d: ZoneDraft, orig: ZoneDraft): boolean =>
  d.name !== orig.name ||
  Number(d.tf) !== Number(orig.tf) ||
  d.r !== orig.r ||
  Math.abs(d.lat - orig.lat) > 1e-7 ||
  Math.abs(d.lng - orig.lng) > 1e-7;

// Granice svih krugova (za "Prikaži sve"): [[jug, zapad], [sjever, istok]] sa malim marginom.
export const boundsOfCircles = (
  circles: Circle[],
  pad = 0.1
): [[number, number], [number, number]] | null => {
  if (!circles.length) return null;
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  for (const c of circles) {
    const dLat = (c.r / 111320) * 1;
    const dLng = c.r / (111320 * Math.max(0.01, Math.cos((c.lat * Math.PI) / 180)));
    s = Math.min(s, c.lat - dLat);
    n = Math.max(n, c.lat + dLat);
    w = Math.min(w, c.lng - dLng);
    e = Math.max(e, c.lng + dLng);
  }
  const h = n - s;
  const wd = e - w;
  return [
    [s - h * pad, w - wd * pad],
    [n + h * pad, e + wd * pad],
  ];
};

// Središte krugova (za početni pogled kad se ne zna ništa drugo).
export const centroid = (circles: Circle[]): { lat: number; lng: number } | null =>
  circles.length
    ? {
        lat: circles.reduce((a, c) => a + c.lat, 0) / circles.length,
        lng: circles.reduce((a, c) => a + c.lng, 0) / circles.length,
      }
    : null;
