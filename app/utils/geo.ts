// Geometrija za kurirski ekran Dostave: udaljenosti, najbliža tačka na ruti i
// skraćivanje rute (pređeni dio se ne crta). Sve u metrima / stepenima WGS84;
// na razmjeri jednog grada ravna aproksimacija (equirectangular) je dovoljno
// tačna za odlučivanje "da li je kurir skrenuo sa rute" i "koliko je još ostalo".

export type LatLngTuple = [number, number];

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Haversine - tačna i na većim razdaljinama (npr. kurir i udaljeni restoran).
export const distanceMeters = (a: LatLngTuple, b: LatLngTuple): number => {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

// Koordinate iz API-ja su tipizirane kao brojevi, ali Laravel decimal cast ume da ih serijalizuje
// kao string ("44.7722000"; isto je viđeno za cash_limit_amount). Bez normalizacije bi pin tiho
// nestao sa mape jer Number.isFinite("44.77") je false.
export const toLatLng = (
  coordination: { lat: number | string; lng: number | string } | null | undefined
): LatLngTuple | null => {
  if (!coordination) return null;
  const lat = Number(coordination.lat);
  const lng = Number(coordination.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

export const isFiniteLatLng = (point: LatLngTuple | null | undefined): point is LatLngTuple =>
  Boolean(point) && Number.isFinite(point![0]) && Number.isFinite(point![1]);

// Ukupna dužina polilinije u metrima.
export const polylineLengthMeters = (line: LatLngTuple[]): number => {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += distanceMeters(line[i - 1]!, line[i]!);
  return total;
};

export type SnapResult = {
  // Indeks segmenta [index, index + 1] na kojem leži najbliža tačka.
  index: number;
  point: LatLngTuple;
  // Rastojanje tačke od rute u metrima.
  distance: number;
};

// Najbliža tačka na polilinije: projekcija na svaki segment u lokalnoj ravni
// (metri oko `point`), pa se uzima najkraće rastojanje.
export const snapToPolyline = (point: LatLngTuple, line: LatLngTuple[]): SnapResult | null => {
  if (line.length === 0) return null;
  if (line.length === 1) {
    return { index: 0, point: line[0]!, distance: distanceMeters(point, line[0]!) };
  }

  const cosLat = Math.cos(toRad(point[0]));
  const mPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerDegLng = mPerDegLat * cosLat;
  const toXY = (p: LatLngTuple): [number, number] => [
    (p[1] - point[1]) * mPerDegLng,
    (p[0] - point[0]) * mPerDegLat,
  ];

  let best: SnapResult | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const a = toXY(line[i]!);
    const b = toXY(line[i + 1]!);
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const lenSq = abx * abx + aby * aby;
    // Tačka je ishodište (0, 0) u ovoj ravni.
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (-a[0] * abx + -a[1] * aby) / lenSq));
    const px = a[0] + abx * t;
    const py = a[1] + aby * t;
    const distance = Math.hypot(px, py);
    if (!best || distance < best.distance) {
      const from = line[i]!;
      const to = line[i + 1]!;
      best = {
        index: i,
        point: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t],
        distance,
      };
    }
  }
  return best;
};

// Dio rute ispred kurira: od najbliže tačke na ruti do kraja. Pređeni dio se
// ne crta. Vraća i koliko metara ostaje (uključujući spoj kurir -> ruta).
export const remainingRoute = (
  location: LatLngTuple,
  line: LatLngTuple[]
): { line: LatLngTuple[]; meters: number; offRoute: number } | null => {
  const snap = snapToPolyline(location, line);
  if (!snap) return null;
  const rest: LatLngTuple[] = [snap.point, ...line.slice(snap.index + 1)];
  return {
    line: rest,
    meters: polylineLengthMeters(rest),
    offRoute: snap.distance,
  };
};
