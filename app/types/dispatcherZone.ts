// Zone su vezane za grad (city_id), ne za dostavnu firmu - više firmi u istom
// gradu može dijeliti iste zone. Geometrija (centar + radijus) se šalje na
// create/update; GET je dokumentovan bez tih polja, pa ih tretiramo opciono
// da lista ne padne ako backend baš njih ne vrati za stare zone.
export type DispatcherZoneDto = {
  id: number;
  city_id: number;
  name: string;
  terrain_factor: number;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_meters?: number | null;
};

export type DispatcherZone = {
  id: number;
  cityId: number;
  name: string;
  terrainFactor: number;
  centerLat: number | null;
  centerLng: number | null;
  radiusMeters: number | null;
};

export type DispatcherZonePayload = {
  city_id: number;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  terrain_factor: number;
};

export type ZoneLiveCoverageDto = {
  zone_id: number;
  zone_name: string;
  online: number;
  idle: number;
  delivering: number;
};

export type ZoneLiveCoverage = {
  zoneId: number;
  zoneName: string;
  online: number;
  idle: number;
  delivering: number;
};
