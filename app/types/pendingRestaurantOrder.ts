import type { Location } from "./order";

// GET /api/dispatcher/orders/pending-restaurant-confirmation?delivery_company_id=X
// Narudžbe koje čekaju da ih restoran/prodavnica PRIHVATI (tablet ugašen,
// zauzeti...). Dispečer inače nema uvid da narudžba "visi" dok je restoran ne
// prihvati. Task "nov ekran/tab: Čeka restoran" (28.8.2026).
export type PendingRestaurantOrderDto = {
  id: number;
  restaurant_name: string;
  restaurant_phone: string | null;
  // Pun rječnik potvrđen 30.08 (odgovor §2.1): 0 = dostava na adresu, 1 =
  // preuzimanje u restoranu, 2 = ručak u restoranu (rezervacija), 3 = slanje
  // poštom, 4 = napušteno (rezervacije stolova - ne bi se trebalo pojaviti
  // ovdje). Mapiranje u utils/dispatchBoardFormat.ts -> deliveryTypeMeta.
  delivery_type: number;
  // Pravi UTC (potvrđeno 30.08, odgovor §2.2) - front koristi standardni
  // new Date() parsing, bez wall-clock workaround-a.
  ordered_at: string;
  // Sirovo vrijeme čekanja na potvrdu restorana - front sam skalira prikaz i
  // računa nivo hitnosti (backend ne šalje gotov flag).
  waiting_minutes: number;
  // null viđen uživo (narudžba bez zakazanog vremena).
  delivery_time: string | null;
  // null viđen uživo.
  delivery_price: number | null;
  // null ili pun Location objekat (isti oblik kao orders/waiting, bez city).
  location?: Location | null;
};
