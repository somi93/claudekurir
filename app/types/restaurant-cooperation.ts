// GET /dispatcher/{companyId}/restaurants (BEZ "delivery-companies" segmenta,
// backend ispravka 27.08 - vidi restaurantCooperationService.ts),
// PATCH /dispatcher/restaurant-delivery-company/{id} - vidi
// Uputstvo_finansije_i_saradnja_frontend_cirilica.md.
//
// Dva nezavisna prekidaca po restoranu, samo jedan je nas:
// - active_restoran: menja DISPECER preko ovog PATCH-a (uprkos imenu koje
//   sugerise suprotno).
// - active_company: menja RESTORAN, nezavisno od ovog API-ja - front ga
//   samo prikazuje (zakljucano), da dispecer razume da saradnja ne radi iz
//   razloga koji nije na njegovoj strani.
export type RestaurantCooperation = {
  id: number;
  restaurant_id: number;
  restaurant_name: string;
  active_restoran: boolean;
  active_company: boolean;
  cooperation_active: boolean;
  // Sopstvena dostava restorana (ne spoljna firma) - informativno, nije unosivo.
  // Backend (27.08) potvrdio: PATCH za internal = true nema smisla (nema prave
  // firme cija saradnja se ukljucuje), pa prekidac na frontu onemogucavamo.
  internal: boolean;
  // Razlog suspenzije koji je unela FIRMA (kolona suspension_reason_by_company,
  // 27.08). Popunjava se kad active_restoran ide na false preko PATCH-a; backend
  // ga sam vraca na null pri reaktivaciji. Restoranska strana ima zasebnu
  // kolonu (suspension_reason_by_restaurant) van obima ovog ekrana.
  suspension_reason: string | null;
  // Sirova vrednost "status" kolone veze: 0 = neaktivan, 1 = aktivan, 2 =
  // obrisan zapis (potvrđeno 01.09, 1.4). Nezavisno od active_restoran /
  // active_company prekidača. NAPOMENA (backend, 01.09): 7/12 restorana firme
  // #24 ima status=0 iako je saradnja stvarno aktivna - poznata, otvorena
  // neusklađenost podataka, NE prikazivati je korisniku kao grešku. Front ga
  // zato i dalje NE koristi za prikaz ni filter (endpoint vraća sve veze).
  record_status: number;
  // Valuta restorana (restaurant.settings.price) - dodato na red 01.09 (odgovor
  // 2.2). Slobodan string ("KM", "EUR"...). Front upoređuje s valutom firme i
  // upozorava dispečera pri uključivanju saradnje ako se razlikuju. Opciono -
  // stari zapisi / restorani bez podešene valute ga nemaju.
  restaurant_currency?: string | null;
  // Kontakt podaci restorana za modal na klik (backend 28.08, "Допуна").
  // Sve opciono/nullable - stari zapisi mogu imati prazna polja.
  restaurant_address?: string | null;
  restaurant_phone?: string | null;
  restaurant_email?: string | null;
  restaurant_contact_person?: string | null;
  restaurant_latitude?: number | null;
  restaurant_longitude?: number | null;
  // Poreski podaci restorana + datum početka saradnje - prikaz u "Kontakt podaci
  // restorana" modalu. Sve opciono/nullable; backend tek treba da ih vrati u
  // GET .../restaurants (dok ne stigne, prikazuju se kao "-").
  restaurant_jib?: string | null;
  restaurant_pib?: string | null;
  cooperation_started_at?: string | null;
};
