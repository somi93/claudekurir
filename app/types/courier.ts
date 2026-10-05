import type { VehicleKey } from "./vehicle";

// GpsTracking/routing/accept vokabular - odvojen od VehicleKey (registracija),
// backend odbio da ih objedini zbog OSRM veze. Nema "scooter"/"motorbike" -
// mapiranje na "motorcycle" radi toRoutingVehicle (utils/vehicle.ts).
export type RoutingVehicle = "car" | "bicycle" | "foot" | "motorcycle";

export type CourierLocationPayload = {
  driver_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  battery?: number | null;
  status?: string;
  timestamp?: string;
};

export type RouteRequest = {
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  vehicle: RoutingVehicle;
};

export type RouteResponse = {
  geometry: [number, number][];
  distance: number;
  duration: number;
  provider: string;
};

export type CourierLocation = {
  driver_id: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  battery: number | null;
  status: string;
  timestamp: string;
};

export type CourierLocationsResponse = {
  success: boolean;
  data: CourierLocation[];
};

// GET /api/dispatcher/delivery-companies/{companyId}/courier-locations (09.09,
// odgovor 1.3) - namjenski server-side endpoint za "Kuriri uživo" na skali.
// Query: search (LIKE ime/prezime/puno ime/telefon), active_within (1-1440 min,
// lokacija ažurirana u zadnjih N min), page (uz njega odgovor je paginiran +
// meta), per_page (default 50, max 200).
export type DispatcherCourierLocationsQuery = {
  search?: string;
  active_within?: number;
  page?: number;
  per_page?: number;
};

// meta se pojavi TEK ako se pošalje ?page= (isti obrazac kao inbox / #223681).
export type DispatcherCourierLocationsMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

// Ugniježdeni "location" blok u DispatcherCourierLocation redu - potvrđen oblik
// uživo 09.09.
export type DispatcherCourierLocationPoint = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  // Backend vrijednost (NE računa se iz staleness-a kao utils/courierStatus).
  // Viđeno "offline"; vjerovatno i "online" / "delivering" (isto kao
  // CourierLocationPayload.status) - traži se potvrda enuma (09_09 pitanja §1.3).
  status: string;
  // ISO 8601 sa offsetom: "2026-09-07T23:52:10+02:00" (NE "Z" - drugačije od
  // cash-handovers konvencije, ali new Date() ga parsira). Polje na koje se
  // veže active_within.
  updated_at: string;
};

// GET .../courier-locations red - potvrđen oblik uživo 09.09. NAPOMENA: vraća
// SAMO kurire koji imaju poznatu poziciju (firma 24: 8 u couriers-status, 1
// ovdje). Nema first_name/last_name (samo spojeno `name`), nema accuracy/
// altitude. Nije potvrđeno može li `location` biti null - vidi 09_09 pitanja §1.3.
export type DispatcherCourierLocation = {
  courier_id: number;
  name: string;
  phone: string | null;
  suspended: boolean;
  vehicle: { id: number; type: VehicleKey } | null;
  location: DispatcherCourierLocationPoint | null;
};

export type DispatcherCourierLocationsResponse = {
  success: boolean;
  data: DispatcherCourierLocation[];
  meta?: DispatcherCourierLocationsMeta;
};

// user_details (13.09, ista tabela kao dispečerski CourierDetail u
// types/company-courier.ts) - vezano za OSOBU, ne za firmu. Ovaj oblik ima i
// id/user_id/created_at/updated_at (CourierDetail na dispečerskoj strani ih
// nema, taj GET/PATCH ih ne vraća) - vjerovatno isti backend resurs, samo
// serijalizovan malo drugačije po ruti.
export type CourierProfileDetailDto = {
  id: number;
  user_id: number;
  // Puni ISO datum-vrijeme sa "Z" (npr. "1999-09-06T22:00:00.000000Z"), NE
  // gola "YYYY-MM-DD" kao na dispečerskom PATCH-u za isto polje (potvrđeno
  // uživo 28.09, isti kurir) - isti obrazac kao D.1 (višestruki serijalizacioni
  // putevi na backendu). Mora se čitati kroz lokalne Date gettere (kao
  // formatDateTime), ne string-slice, da se izbjegne pomak dana - vidi
  // mapCourierProfileDto.
  date_of_birth: string | null;
  iban: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  referral_short_url: string | null;
  referral_url: string | null;
  referred_by: number | null;
  created_at: string;
  updated_at: string;
};

// Potvrđena šema GET /couriers/:id (2026-08-03, prošireno 28.09 - vidi
// CourierProfileDetailDto). vehicle stiže ugnježdeno, "name" unutra je
// model/registracija (isto polje koje se šalje flat kao vehicle_note na
// update-u). `private_email`/`address`/`state`/`city_id`/`created_at` su NOVA
// polja viđena 28.09 - značenje nepotvrđeno od backenda (state je možda isti
// record_status enum 0/1/2 viđen drugdje, ali nije provjereno), namjerno bez
// UI-ja dok se ne potvrdi - vidi docs/2026/09/28_09_2026_Frontend_pitanja_za_backend.textile.
export type CourierProfileDto = {
  id: number;
  name: string;
  lastname: string;
  email: string;
  // Ličan mejl kurira, odvojen od `email` (koji je login/korisničko ime - vidi
  // primjer "dostavljac1@ordera", nije pravi mejl domen). Značenje nepotvrđeno.
  private_email: string | null;
  phone: string;
  address: string | null;
  image_path: string | null;
  state: number;
  city_id: number | null;
  created_at: string;
  vehicle: {
    type: VehicleKey;
    name: string | null;
  } | null;
  detail: CourierProfileDetailDto | null;
};

// PUT /couriers/:id - sva polja opciona, ažurira User + primarno Vehicle +
// (28.09) user_details. Lični podaci koriste ISTA imena polja kao dispečerski
// CourierUpdatePayload (types/company-courier.ts) - ista tabela, isti PATCH
// obrazac koji je već potvrđeno da radi (28.09).
export type CourierProfileUpdate = {
  name?: string;
  lastname?: string;
  phone?: string;
  email?: string;
  // Šalje se SAMO kad kurir mijenja vozilo (ili njegovu napomenu - napomena bez tipa
  // ne dira vozilo, potvrđeno 28.08). null = ide pješice: za dispečerski PATCH potvrđeno
  // da briše vozilo, za ovaj PUT je odgovor "isti fix" - uživo nije provjereno (04.10, stavka 10).
  vehicle_type?: VehicleKey | null;
  vehicle_note?: string;
  date_of_birth?: string | null;
  iban?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

// GET /couriers/:id/companies - firme za koje je kurir AKTIVNO vezan (obje
// strane veze aktivne). Prazan niz znači kurir nije vezan ni za jednu firmu.
export type CourierCompanyDto = {
  id: number;
  name: string;
  city_id: number;
};

export type CourierCompany = {
  id: number;
  name: string;
  cityId: number;
};
