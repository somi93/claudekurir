import type { VehicleKey } from "~/types/vehicle";

// GET /dispatcher/delivery-companies/{companyId}/couriers-status (16.08) -
// vehicle: null znaci kurir nema registrovano vozilo. Edit (26.08, vidi
// CourierUpdatePayload ispod) sad omogucava da se vozilo promeni kroz ovu
// listu direktno.
//
// Backend je 30.08 (odgovor §1.2 / §3.2) uveo zajednički fullCourierRow() -
// index / store / toggle / update sad vraćaju IDENTIČAN pun red, uključujući
// suspended*, vehicle i contact_phone / bank_account / note. Zato su ta polja
// sad obavezna i edit forma se popuni već pri prvom otvaranju.
export type CompanyCourier = {
  courier_id: number;
  // Spojeno puno ime (ostaje nepromijenjeno, bez breaking change).
  name: string;
  // Odvojena polja - backend ih drži razdvojeno i od 01.09 (odgovor C.1) vraća
  // u couriers-status kao `first_name` / `last_name`. Opciono jer stariji
  // odgovori ih nemaju - edit forma tada rasparsira `name`.
  first_name?: string | null;
  last_name?: string | null;
  // null viđen uživo 30.08 (kurir bez unesenog telefona).
  phone: string | null;
  // Korisničko ime kurira za prijavu = email. Dispečer ga vidi u "Izmeni
  // kurira" da zna kome mijenja lozinku (zahtjev 07.09). SREĐENO - provjereno
  // uživo 09.09: `couriers-status` sad vraća `email` na svakom redu (string,
  // nijedan null viđen). Ostaje `?: string | null` radi konzistentnosti s
  // first_name/last_name (isti "dodano naknadno" obrazac) i jer nije potvrđeno
  // stiže li `email` i u POST/PATCH .../couriers odgovor (fullCourierRow) niti
  // može li biti null - vidi docs/2026/09/09_09_2026_Frontend_pitanja_za_backend.textile §1.1.
  email?: string | null;
  suspended: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
  vehicle: { id: number; type: VehicleKey } | null;
  // Zadržano radi kompatibilnosti (CourierWalletDetailsDialog i dalje ga
  // prikazuje) - nova "Izmeni kurira" forma ga VIŠE NE UREĐUJE (13.09,
  // zahtjev backend-a), jer dupla svrhu sa detail.emergency_contact_phone.
  // Koristi emergency_contact_* za novi kod.
  contact_phone: string | null;
  bank_account: string | null;
  note: string | null;
  // Naplata/ugovor za OVU firmu (13.09) - dio delivery_company_user tabele.
  // POTVRĐENO UŽIVO 14.09 prijepodne: ni `couriers-status` (GET), ni
  // `POST .../couriers`, ni `PATCH .../couriers/{id}` odgovor NISU vraćali ova
  // polja (ključevi izostavljeni). Backend je 14.09 kasno popodne javio da su
  // sva 4 endpointa popravljena - RETESTOVANO 14.09 večernje
  // (docs/2026/09/14_09_2026_Network_checklist_prosirena-forma-kurira.md, DIO
  // A) i tvrdnja NIJE tačna za ova 4 polja: POST i naknadni GET i dalje vraćaju
  // sva 4 kao `null` iako su poslata. PATCH strana (update()) retestovana
  // naknadno (isto DIO B) - identičan nalaz, NIJE ostala ispravna kako je
  // originalna 13.09 specifikacija tvrdila. Eskalirano u
  // docs/2026/09/14_09_2026_Frontend_pitanja_za_backend_prosirena-forma-kurira.textile.
  // SREĐENO, POTVRĐENO UŽIVO 28.09: POST (21.09, kurir 30742) i PATCH (28.09,
  // kurir 30189) oba vraćaju sva 4 polja sa tačnim poslatim vrijednostima, i u
  // odgovoru i u naknadnom couriers-status GET-u. Ostaju opciona jer stariji
  // kuriri i dalje mogu imati `null` (nikad popunjeno), ne zbog bug-a.
  paying_type?: CourierPayingType | null;
  paying?: string | null;
  contract_signed_at?: string | null;
  contract_active_from?: string | null;
  // Read-only, tabela users (13.09) - upload mehanizam odložen na backendu
  // (14.09 popodne, vidi odgovor-backend-prosirena-forma-kurira.textile DIO
  // II) - front ostaje read-only prikaz dok backend ne javi plan.
  image_path?: string | null;
  created_at?: string | null;
  // Lični podaci osobe (13.09, nova tabela user_details) - null dok korisnik
  // nema nijedno od ovih polja unešeno (prazna tabela za postojeće korisnike).
  // SREĐENO I POTVRĐENO UŽIVO 14.09 večernje na OBA endpointa: `detail`
  // objekat (7 polja) stiže tačno kako je poslato na POST-u, PATCH-u i
  // naknadnom GET-u (couriers-status) - za razliku od paying_type/paying/
  // contract_* iznad, ovaj dio fixa stvarno radi svuda. Ostaje opciono radi
  // konzistentnosti sa starijim odgovorima bez ovog polja.
  detail?: CourierDetail | null;
};

// 1=mjesečno, 2=procenat, 3=po dostavi - ista semantika kao
// restaurant_delivery_company (13.09).
export type CourierPayingType = 1 | 2 | 3;

// user_details (13.09) - vezano za OSOBU, ne za firmu; ostaje isto ako kurir
// pređe u drugu firmu.
export type CourierDetail = {
  date_of_birth: string | null;
  iban: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  referral_url: string | null;
  referral_short_url: string | null;
  referred_by: number | null;
};

// PATCH /dispatcher/delivery-companies/{companyId}/couriers/{courierId} -
// backend 28.08 (DIO 5, 5.1) POTVRDIO endpoint. Sva polja opciona, šalje se samo
// ono što je izmenjeno u FormDialog-u. vehicle_type: null EKSPLICITNO briše
// vozilo sa kurira (potvrđeno, nije posebna akcija). name + lastname se šalju
// ODVOJENO na svaki edit (odgovor §1.1) - backend inače nadopisuje sačuvano
// prezime pa se ime "gomila".
export type CourierUpdatePayload = {
  name?: string;
  lastname?: string;
  phone?: string;
  vehicle_type?: VehicleKey | null;
  contact_phone?: string | null;
  bank_account?: string | null;
  note?: string | null;
  // Lični podaci (user_details) - endpoint TREBA da sam raspoređuje polja na
  // users/user_details/delivery_company_user, šalje se isto PATCH telo (13.09).
  // POTVRĐENO UŽIVO 14.09 prijepodne: backend je tiho ignorisao svih 8 polja
  // ispod (date_of_birth .. contract_active_from). Backend javlja 14.09 kasno
  // popodne da su store()/update() popravljeni - RETESTOVANO 14.09 večernje na
  // PATCH-u (kurir 30742): user_details polja (date_of_birth/iban/
  // emergency_contact_*) SREĐENO, rade i vraćaju se ispravno.
  date_of_birth?: string | null;
  iban?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  // Naplata i ugovor za ovu firmu (delivery_company_user). RETESTOVANO 14.09
  // večernje na PATCH-u (isti kurir 30742) - i dalje NE RADE, identično POST-u
  // (vidi napomenu uz CourierCreatePayload): odgovor vraća sva 4 kao null iako
  // su poslata. Eskalirano u
  // docs/2026/09/14_09_2026_Frontend_pitanja_za_backend_prosirena-forma-kurira.textile.
  // SREĐENO, POTVRĐENO UŽIVO 28.09 (kurir 30189) - PATCH odgovor i naknadni
  // couriers-status GET oba vraćaju sva 4 polja tačno kako su poslata.
  paying_type?: CourierPayingType | null;
  paying?: string | null;
  contract_signed_at?: string | null;
  contract_active_from?: string | null;
  // Nova lozinka kurira - dispečer je zada u "Izmeni kurira". POTVRĐENO 09.09
  // (odgovor 1.2): PATCH prima opciono `password` (string, min:8), 422 istog
  // oblika (errors.password) na lošu vrijednost, odgovor je pun red kao i inače,
  // i postavlja must_change_password: true (kurir mora promijeniti pri
  // sljedećoj prijavi). Šalje se SAMO kad dispečer eksplicitno zada novu (inače
  // se izostavi). Kao i kod create-a, sistem NE šalje email/SMS - dispečer je
  // prosljeđuje van sistema.
  password?: string;
};

// PATCH .../couriers/{courierId}/suspend - reason opciono, samo bitno kad se
// suspenduje (backend ga sam brise kad se aktivira).
export type CourierSuspendPayload = {
  suspended: boolean;
  reason?: string;
};

// POST .../couriers - temporary_password unosi dispecer (front generise
// predlog, vidi useCompanyCouriers.generateTemporaryPassword), sistem ga NE
// salje kuriru automatski (nema email/SMS) - dispecer ga prosledjuje van
// sistema. Novi kurir dobija must_change_password: true, vidi
// PasswordReminderBanner.vue.
//
// Lični podaci + naplata/ugovor (13.09) - front ih ŠALJE već pri kreiranju
// (isti izgled forme kao "Izmeni kurira"). POTVRĐENO UŽIVO 14.09 prijepodne:
// store() ih tada nije prihvatao (čak ni stara bank_account/note, iako PATCH
// njih već podržavao). Backend je 14.09 kasno popodne javio da je store()
// popravljen za svih 8 + bank_account/note. RETESTOVANO 14.09 večernje
// (docs/2026/09/14_09_2026_Network_checklist_prosirena-forma-kurira.md, DIO A,
// kurir 30753) - DJELIMIČNO tačno:
// - date_of_birth/iban/emergency_contact_name/emergency_contact_phone (idu na
//   detail u CompanyCourier) i bank_account/note - RADE, potvrđeno.
// - paying_type/paying/contract_signed_at/contract_active_from - NE RADE i
//   dalje, POST i naknadni GET ih vraćaju kao null iako su poslati.
//   Eskalirano u
//   docs/2026/09/14_09_2026_Frontend_pitanja_za_backend_prosirena-forma-kurira.textile.
// SREĐENO, POTVRĐENO UŽIVO: POST 21.09 (kurir 30742), PATCH 28.09 (kurir
// 30189) - oba endpointa sad vraćaju sva 4 polja tačno kako su poslata, i u
// odgovoru i u naknadnom couriers-status GET-u.
// I dalje namjerno nema POST→PATCH workaround-a na frontu.
export type CourierCreatePayload = {
  name: string;
  lastname: string;
  phone: string;
  email: string;
  temporary_password: string;
  vehicle_type?: VehicleKey;
  date_of_birth?: string | null;
  iban?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  paying_type?: CourierPayingType | null;
  paying?: string | null;
  bank_account?: string | null;
  contract_signed_at?: string | null;
  contract_active_from?: string | null;
  note?: string | null;
};

// Napomena (16.08) - tri razlicita nivoa "iskljucivanja" kurira, ne mesati:
// suspend = privremeno, kurir ostaje na listi firme, samo blokiran za nove
// narudzbe; remove (DELETE ovde) = nestaje sa liste TE firme, ostaje u bazi,
// moguce i dalje vezan za druge firme; brisanje naloga (postojeci
// DELETE /couriers/{id}) = globalno deaktivira nalog, van obima ovog ekrana.
