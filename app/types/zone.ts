export type ZoneDto = {
  id: number;
  name: string;
  terrain_factor?: number | null;
  vehicle_suitable?: boolean;
  note?: string | null;
};

export type Zone = {
  id: number;
  name: string;
  terrainFactor: number | null;
  vehicleSuitable: boolean;
  note: string | null;
};
