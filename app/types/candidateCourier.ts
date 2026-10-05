import type { VehicleKey } from "./vehicle";

// candidate-couriers vraća registracioni Vehicle::type (bicycle/scooter/
// motorbike/car) + "foot" kad kurir nema registrovano vozilo - potvrđeno
// stvarnim odgovorom 31.08 (nosio "motorbike" i "scooter"). Raniji zaključak
// da je vokabular routing (car/bicycle/foot/motorcycle) je bio pogrešan;
// "motorcycle" ostaje u tipu jer ga active-deliveries kurir zna vratiti.
// Prikaz uvijek ide kroz courierVehicleMeta() (utils/vehicle.ts) koji ima fallback.
export type CandidateCourierVehicle = VehicleKey | "foot" | "motorcycle";

// "zone" je naziv zone u kojoj se kurir trenutno nalazi (live GPS), null ako
// je van svih zona ili nema poziciju - potvrđeno u
// dispecer-Dodela_kurira_frontend.md.
export type CandidateCourierDto = {
  courier_id: number;
  name: string;
  vehicle: CandidateCourierVehicle;
  distance_km: number | null;
  zone: string | null;
  vehicle_suitable: boolean;
  currently_available: boolean;
  // Kurir trenutno vozi neku dostavu (prihvatio narudžbu, još je nije
  // isporučio). Nezavisno od currently_available (može biti dostupan po
  // rasporedu a ipak na isporuci).
  on_delivery: boolean;
  // Kurir je premašio limit gotovine - dispečer to mora vidjeti prije slanja
  // ponude (accept može vratiti 409 na BLOCK limitu). Opciono dok backend
  // ne garantuje polje na svim odgovorima.
  cash_limit_exceeded?: boolean;
};

export type CandidateCourier = {
  courierId: number;
  name: string;
  vehicle: CandidateCourierVehicle;
  distanceKm: number | null;
  zone: string | null;
  vehicleSuitable: boolean;
  currentlyAvailable: boolean;
  onDelivery: boolean;
  cashLimitExceeded: boolean;
};
