import type { Location } from "./order";
import type { CandidateCourierVehicle } from "./candidateCourier";

// GET /api/dispatcher/orders/active-deliveries?delivery_company_id=X - nov
// endpoint (Dopuna_dodela_narudzbi_frontend.md, 16.08). Pokriva dva taba
// istovremeno - "Čeka preuzimanje" (booked) i "U dostavi" (picked_up),
// razlikuju se preko status polja.
export type ActiveDeliveryStatus = "booked" | "picked_up";

// phone nije 100% potvrđeno od backenda - može doći kao null ako je pogrešno
// ime kolone na njihovoj strani.
export type ActiveDeliveryCourierDto = {
  id: number;
  name: string;
  phone: string | null;
  vehicle: CandidateCourierVehicle;
};

export type ActiveDeliveryDto = {
  id: number;
  restaurant_name: string;
  ordered_at: string;
  delivery_time: string;
  minutes_until_delivery: number;
  status: ActiveDeliveryStatus;
  delivery_price: number;
  // Ranije se pretpostavljalo da je uvek prisutno (narudžba u ovom endpoint-u
  // ima dodeljenog kurira), ali produkcija je vratila red sa courier: null -
  // mapper i prikaz to sad podnose bez rušenja cele liste.
  courier: ActiveDeliveryCourierDto | null;
  location?: Location | null;
};
