export type CompanyDto = {
  id: number;
  name: string;
  city_id?: number | null;
  city_name?: string | null;
  // Valuta firme - dodano na my-companies (odgovor backend 15.09, prethodno
  // pitanje 13_09 §II "Valuta firme nedostupna"). Opciono jer stariji odgovori
  // ga možda ne nose.
  currency?: string | null;
};

export type Company = {
  id: number;
  name: string;
  cityId: number | null;
  cityName: string | null;
  currency: string | null;
};

export type Pricing = {
  delivery_company_id: number;
  base_price: number;
  price_per_km: number;
  currency: string;
};

export type PricingCalculationSurcharge = {
  id: number;
  name: string;
  type: SurchargeType;
  amount: number;
};

export type PricingCalculation = {
  distance_km: number;
  currency: string;
  base_price: number;
  price_per_km: number;
  per_km_total: number;
  surcharges: PricingCalculationSurcharge[];
  surcharge_total: number;
  total: number;
  duration_seconds: number;
};

export type SurchargeType = "per_km" | "fixed" | "note";

// Zajednički katalog uslova (GET /condition-tags, isti za sve firme) -
// "Brzo dodavanje" chip-ovi na "Dodatni parametri" ekranu. `icon` je Tabler
// klasa (ti-*) sa backend-a - front je prikazuje preko mape na mdi-* (vidi
// utils/conditionTag.ts), ali šalje sirovu vrednost nazad backend-u pri
// kreiranju naknade. default_time_from/to izostaju na ugnježdenom
// Surcharge.condition_tag u GET .../surcharges odgovoru, zato opciono.
export type ConditionTag = {
  id: number;
  key: string;
  name: string;
  icon: string;
  default_time_from?: string | null;
  default_time_to?: string | null;
};

export type Surcharge = {
  id: number;
  delivery_company_id: number;
  name: string;
  description: string | null;
  icon: string | null;
  type: SurchargeType;
  value: number;
  unit: string | null;
  time_from?: string | null;
  time_to?: string | null;
  active: boolean;
  // Automatizacija (14.08) - backend je sam postavlja kad active pređe iz
  // false u true; null ako nikad nije bila aktivirana ili je trenutno neaktivna.
  activated_at?: string | null;
  // Katalog (14.08) - null ako naknada nije povezana sa condition_tags
  // (prilagođena), signal za bedž "iz kataloga" vs "prilagođeno" na kartici.
  condition_tag?: ConditionTag | null;
};

// Predlog naknade koji korisnik može popuniti jednim klikom (Tab: Dodatni
// parametri) - lokalni, nije deo condition_tags kataloga (nema condition_tag_id).
export type SurchargePreset = {
  name: string;
  description: string;
  icon: string;
  type: SurchargeType;
  value: number;
  unit: string;
  time_from?: string;
  time_to?: string;
};

// Forma za novu naknadu (Tab: Dodatni parametri). "Brzo dodavanje" chip
// (katalog ili lokalni preset) samo popunjava ovu formu - korisnik i dalje
// mora da klikne "Sačuvaj parametar" (14.08, jedinstven tok za oba izvora).
export type NewSurchargeForm = {
  name: string;
  description: string;
  type: SurchargeType;
  value: number;
  unit: string;
  timeFrom: string;
  timeTo: string;
  // Da li se prikazuju/šalju Vreme od/do - isključi da ih forma ne šalje
  // dok su polja skrivena. Uključuje se automatski uz katalog tag koji ima
  // default_time_from/to, inače ručno.
  autoTime: boolean;
  // Id iz condition_tags kataloga - null za prilagođeni parametar (uključujući
  // lokalne presete). Zaključava Naziv polje dok je postavljen.
  conditionTagId: number | null;
  icon: string;
};

// delivery_vehicle_rules.vehicle - ZASEBAN vokabular od registracije
// (vehicles.type = car/motorbike/bicycle/scooter). Backend 28.08 (DIO 4, 4.1)
// potvrdio: pravila koriste car/motorbike/bicycle/walk, namerno odvojeno od
// ENUM-a vozila. "walk" = pravilo za dostavu pešice (nije isto što i routing
// "foot" iz candidate-couriers, samo isti pojam).
export type VehicleRuleVehicle = "car" | "motorbike" | "bicycle" | "walk";

export type VehicleRuleConditionType = "zone" | "surcharge" | "distance" | "default";

export type VehicleRule = {
  id: number;
  delivery_company_id: number;
  condition_text: string;
  vehicle: VehicleRuleVehicle;
  zone_id: number | null;
  max_terrain_factor: number | null;
  note: string | null;
  // Automatizacija (14.08) - opciona, stara pravila ih nemaju.
  condition_type?: VehicleRuleConditionType;
  surcharge_id?: number | null;
  min_distance_km?: number | null;
  // "ispod X km" (15.08 dopuna) - sa min_distance_km zajedno pravi opseg.
  max_distance_km?: number | null;
  preferred_vehicles?: string[];
  priority?: number;
};
