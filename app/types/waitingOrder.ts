import type { Location } from "./order";

// GET /api/dispatcher/orders/waiting?delivery_company_id=X - deploy-ovano
// 14.08 (Odgovori_frontend_analiza_14_avgust.md, stavka 2.1). Uključuje
// narudžbe čim restoran prihvati (status: "accepted"), ne tek kad je hrana
// gotova (status: "ready").
//
// Dopuna 16.08 (Dopuna_dodela_narudzbi_frontend.md) - klizni vremenski
// prozor na backendu (delivery_time od 2h unazad do 6h unapred od trenutka
// poziva, pokriva noćnu smenu), plus nova polja ispod. minutes_until_delivery
// može biti negativan - to je direktno "kasni" signal, bez računanja na
// frontu.
export type WaitingOrderDto = {
  id: number;
  restaurant_name: string;
  ordered_at: string;
  delivery_time: string;
  waiting_minutes: number;
  minutes_until_delivery: number;
  status: string;
  ready_in_minutes: number;
  ready_at: string;
  // Cena dostave (ne cena hrane - to polje nije potvrđeno na Order-u).
  delivery_price: number;
  location?: Location | null;
  // Dodato 28.08 (backend DIO 7, 7.2) - isti rječnik/logika kao candidate-couriers.
  // delivery_zone = naziv zone koja pokriva adresu dostave; null ako adresa nije
  // ni u jednoj definisanoj zoni (nije greška). distance_km = rutna udaljenost
  // restoran -> kupac; null ako se ne može izračunati.
  delivery_zone?: string | null;
  distance_km?: number | null;
};
