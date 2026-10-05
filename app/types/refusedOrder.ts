import type { Location } from "./order";

// GET /api/dispatcher/orders/refused?delivery_company_id=X - nov endpoint
// (Dopuna_dodela_narudzbi_frontend.md, 16.08). "Kupac odbio" tab - gleda
// unazad (poslednja 24h), terminalno stanje. Nema minutes_until_delivery
// (nema smisla za nešto što se već desilo) pa se "Kasni" oznaka ovde ne
// prikazuje. courier_name dolazi ravno (ne ugnježdeno kao na
// active-deliveries), jer kurir više nije "aktivan" na ovoj narudžbi.
export type RefusedOrderDto = {
  id: number;
  restaurant_name: string;
  delivery_time: string;
  delivery_price: number;
  courier_name: string;
  location?: Location | null;
};
