import type { VehicleKey } from "~/types/vehicle";
import type { VehicleRuleVehicle } from "~/types/pricing";
import type { RoutingVehicle } from "~/types/courier";

export const VEHICLE_META: Record<VehicleKey, { label: string; icon: string; color: string }> = {
  car: { label: "Automobil", icon: "mdi-car", color: "#2f6fed" },
  motorbike: { label: "Motor", icon: "mdi-motorbike", color: "#ff9f1c" },
  bicycle: { label: "Bicikl", icon: "mdi-bike", color: "#00b37e" },
  scooter: { label: "Skuter", icon: "mdi-moped", color: "#9aa4b2" },
};

// vehicle-rules ima ZASEBAN vokabular (backend 28.08, DIO 4 tačka 4.1):
// car/motorbike/bicycle/walk - "walk" umesto "scooter" iz registracije.
// Deli ga VehicleRulesPanel (birač pri kreiranju pravila) i VehicleSimulationPanel.
export const RULE_VEHICLE_META: Record<VehicleRuleVehicle, { label: string; icon: string; color: string }> =
  {
    car: VEHICLE_META.car,
    motorbike: VEHICLE_META.motorbike,
    bicycle: VEHICLE_META.bicycle,
    walk: { label: "Pešice", icon: "mdi-walk", color: "#9aa4b2" },
  };

const FALLBACK_VEHICLE_META = { label: "Nepoznato vozilo", icon: "mdi-help-circle-outline", color: "#9aa4b2" };

// Pravila/preporuke mogu doći sa vrednošću vozila koja nije u gornjoj mapi
// (npr. "motorcycle"/"foot" - routing vokabular, ili staro "scooter" pravilo
// od prije 28.08) - bez fallback-a to ruši prikaz (undefined.icon/.color).
export const ruleVehicleMeta = (vehicle: string) =>
  RULE_VEHICLE_META[vehicle as VehicleRuleVehicle] ?? { ...FALLBACK_VEHICLE_META, label: vehicle };

// Kurirsko vozilo iz active-deliveries / candidate-couriers: registracioni
// vokabular (bicycle/scooter/motorbike/car) + "foot" (bez registrovanog vozila)
// + defanzivno "motorcycle" (routing). Uvijek fallback - nepoznata vrednost je
// ranije rušila render liste (undefined.icon/.color). Vidi memoriju
// candidate-couriers-vehicle-vocab.
const COURIER_VEHICLE_META: Record<string, { label: string; icon: string; color: string }> = {
  ...VEHICLE_META,
  motorcycle: VEHICLE_META.motorbike,
  foot: { label: "Pešice", icon: "mdi-walk", color: "#9aa4b2" },
};
export const courierVehicleMeta = (vehicle: string) =>
  COURIER_VEHICLE_META[vehicle] ?? FALLBACK_VEHICLE_META;

// GpsTracking/routing/accept ima uži, odvojen vokabular (car/bicycle/foot/
// motorcycle) - standardizacija na jedan vokabular odbijena zbog OSRM veze
// (vidi Odgovori_frontend_analiza_14_avgust.md, stavka 1 i 3.3). "motorbike"
// i "scooter" nemaju par pa se mapiraju na "motorcycle"; kurir bez
// registrovanog vozila (null) ide na "foot".
export const toRoutingVehicle = (vehicle: VehicleKey | null): RoutingVehicle => {
  switch (vehicle) {
    case "car":
      return "car";
    case "bicycle":
      return "bicycle";
    case "motorbike":
    case "scooter":
      return "motorcycle";
    default:
      return "foot";
  }
};
