# Odgovori na frontend analizu API-ja (14. avgust 2026)

Odgovor na svih 14 stavki poslatih danas. Status po stavci:
**✅ Deploy-ovano** / **📋 Odgovoreno (nema izmene)** / **⏳ Odloženo** / **❓ Čeka vaš odgovor**

---

## 1. Vozila — četiri različita vokabulara

**Status: 📋 Odgovoreno**

Ispravka tabele — stvarno postoje **tri**, ne dva vokabulara:
- `Vehicle`/`VehicleType` (registracija opreme): `bicycle`, `scooter`, `motorbike`, `car`
- `GpsTracking`/routing/`accept`: `car`, `bicycle`, `foot`, `motorcycle` (usklađeno danas, ranije `bike`)
- `DeliveryVehicleRule`/`candidate-couriers`: čita `Vehicle::type` direktno, isti vokabular kao registracija

`bycicle` typo — proverite da li je u vašem `types/vehicle.ts`, backend `VehicleType` enum ima ispravno `bicycle`.

`candidate-couriers` tabela u vašoj analizi ne odgovara stvarnoj implementaciji — proverite protiv svežeg poziva.

Standardizacija na jedan vokabular — **odbijeno za sada**, rizik zbog `GpsTracking` veze sa OSRM.

**Uživo zatvoreno:** stari `vehicle: "bike"` red (`id=1`, `delivery_company_id=24`) ispravljen u bazi, potvrđeno da nema više zaostalih (`COUNT=0`).

---

## 2.1 Nema endpoint-a za "narudžbe koje čekaju kurira"

**Status: ✅ Deploy-ovano**

Nov endpoint: `GET /api/dispatcher/orders/waiting?delivery_company_id=X`

```json
{
    "success": true,
    "data": [
        {
            "id": 501,
            "restaurant_name": "Roštiljnica Laguna",
            "delivery_time": "2026-08-14T14:30:00.000000Z",
            "status": "accepted",
            "ready_in_minutes": 8,
            "ready_at": "2026-08-14T14:05:00.000000Z"
        }
    ]
}
```

Uključuje narudžbe **čim** restoran prihvati (`status: "accepted"`), ne tek kad je hrana gotova (`status: "ready"`) — po vašoj napomeni da je to već vreme za dodelu kurira.

---

## 2.2 Da li `vehicle_suitable` stvarno koristi `vehicle-rules`

**Status: 📋 Odgovoreno**

Da, logika je stvarna, ne placeholder — `VehicleZoneMatcher::isVehicleSuitable()` upoređuje `zone.terrain_factor` sa `rule.max_terrain_factor`. Povezano 14.08, posle changelog-a od 13.08 (koji je bio tačan u trenutku pisanja).

**Praktična napomena:** trenutna pravila za firmu 24 nemaju postavljen `max_terrain_factor` (sva `NULL`), pa `vehicle_suitable` praktično uvek vraća `true` — ne zato što je nepovezano, nego zato što nema još smislenog praga. Front UI za unos ovog polja još ne postoji (vidi 2.3 niže — puna forma već dizajnirana, čeka implementaciju).

---

## 2.3 Nema GET za "provjera dostupnosti" prekidač

**Status: ✅ Deploy-ovano**

`GET /api/dispatcher/delivery-companies/{delivery_company}/availability-enforcement`

```json
{ "data": { "delivery_company_id": 24, "requires_availability_confirmation": true } }
```

**Bonus nalaz:** postojeći `PATCH` za isti endpoint nije proveravao da li dispečer sme baš tu firmu da menja — ispravljeno istovremeno, obe rute sad zahtevaju aktivnu vezu dispečer↔firma.

---

## 2.4 Notifikacija kuriru posle "Pošalji ponudu"

**Status: ⏳ Odloženo**

Infrastruktura postoji (`FcmService`, kompletan i testiran ranije za mobilnu app), ali **nikad nije bila povezana** sa dodelom narudžbi — ni automatski (restoran prihvata → push), ni kroz dispečerski tok.

Dizajn i delimičan kod postoje (`PendingOrderNotifier`, `NotifyWaitingOrders` scheduled komanda — top 2-3 kandidata preko već postojećeg `OrderCourierMatcher`-a) — **namerno nedeploy-ovano**, čeka test da li glavni backend (`app.ordera.app`) možda već šalje nešto slično (potrebna pomoć mobilnog programera).

**Za sada:** dispečer ručno osvežava "Dodela narudžbi" ekran (`orders/waiting`, već gotovo). Kurir vidi narudžbu kroz postojeći `GET /orders/available` tok, nezavisno.

---

## 3.1 `driver_id` se ne proverava protiv vlasnika tokena

**Status: ✅ Deploy-ovano**

Potvrđeno kao stvarna sigurnosna rupa (ne samo teorijski dispečerski slučaj) — bilo koji autentifikovan korisnik je mogao poslati tuđi `driver_id` bez provere.

Ispravka (`OrderController::assertCanActOnBehalfOf()`, primenjena na `accept`/`pickup`/`cancelReservation`/`deliver`):
- Kurir i dalje radi u svoje ime bez ograničenja (nepromenjeno ponašanje)
- Dispečer sme da šalje tuđi `driver_id` **samo** ako je taj kurir aktivno vezan za istu firmu kao dispečer
- Svako drugo — `403`

---

## 3.2 `delivery_company_id` nije vezan za narudžbu

**Status: ✅ Deploy-ovano**

Bitna ispravka vaše pretpostavke — `company_id` na `Order` **nije** dostavna firma (to je zaostavština korporativne ishrane, nepovezano). Nema veze sa `delivery_companies`.

Dodato **novo, odvojeno** polje `delivery_company_id` u `OrderResource`, izračunato preko `Restaurant::deliveryCompanies()`, uzima prvu:

```json
{ "id": 501, "delivery_company_id": 24, "company_id": 7, "...": "..." }
```

**Pretpostavka na kojoj se ovo zasniva** (potvrđena sa vama): restoran ima **tačno jednu** aktivnu dostavnu firmu u datom trenutku (interna ili eksterna, prekidač na strani restorana). Ako se ovo poslovno pravilo ikad promeni, `delivery_company_id` treba preraditi — zabeleženo u `README_dostupnost_kurira_cirilica.md`.

Optimizovano — eager-load dodat u sve postojeće pozive, bez N+1 upita.

---

## 3.3 Ruta se uvek računa za automobil

**Status: 📋 Odgovoreno**

Routing servis već podržava `car | bicycle | foot | motorcycle` (usklađeno danas). Molimo šaljite kurirov stvarni `VehicleType` umesto fiksnog `"car"`.

**Napomena:** `VehicleType` ima `motorbike`/`scooter`, routing servis nema `scooter` — za skutere preporučujemo mapiranje na `motorcycle` na frontu.

---

## 3.4 Nepotvrđena polja u `referrals`

**Status: 📋 Odgovoreno**

Potvrđeno — `email`/`phone` se tiho odbacuju (`validate()` ih ne sadrži). Molimo prestanite da ih šaljete.

Ideja za sistem popusta preporučenim korisnicima zabeležena za budućnost (veći poduhvat, ne samo dva polja) — odloženo dok ne postane konkretan prioritet.

---

## 3.5 Enum stanja narudžbe

**Status: 📋 Odgovoreno**

Kompletna, potvrđena lista (22 stanja, `OrderState.php`) — poslata posebno, sa punim opisima. Ključno:

- Aktivna narudžba kurira = **`BOOKED_DELIVERY` (3) ili `CHARGED_DELIVERY` (5)**, eksplicitno filtrirati po ovo dvoje, ne osloniti se na pretpostavku "najviše jedna"
- **Numeracija nije sekvencijalna** — nikad `state >= N` poređenje

---

## 4. Restoranski deo — mock finansijske stranice

**Status: ⏳ Odloženo**

Potvrđen gap, ali van obima današnjeg rada (PDF/Excel generisanje, bankovna integracija, email — svaka stavka sopstveni veći poduhvat). Nijedan od `Restaurant*` kontrolera (Payout, Invoice, PlatformPayment, Transaction, BankPayout) nije danas pregledan.

Mock ponašanje na frontu ostaje ispravno rešenje za sada.

---

## 5.1 Promena lozinke posle prvog logina

**Status: ⏳ Preskočeno** (na zahtev tima, nije istraživano)

---

## 6. Housekeeping

**Status: 📋 Primljeno, bez akcije za backend**

Oba nalaza (mock-api fajlovi, `vehicle_type` mrtav kod u `deliveryPricingService.ts`) su front-side odluke.

---

# Sažetak — šta čeka vaš deploy

Sledeći fajlovi su promenjeni danas kao odgovor na ovu analizu (van paketa automatizacije vozila koji je već deploy-ovan ranije):

- `app/Http/Controllers/DispatcherAvailabilityEnforcementController.php`
- `app/Http/Controllers/DispatcherOrderMatchingController.php`
- `app/Modules/GpsTracking/Http/Controllers/OrderController.php`
- `app/Http/Resources/OrderResource.php`
- `routes/api.php`

# Šta čeka vas (front)

1. Uskladiti vokabular vozila prema tabeli u stavci 1
2. Koristiti `delivery_company_id` (stavka 3.2) umesto hardkodiranog `24`
3. Slati stvarni `VehicleType` u routing pozive (stavka 3.3)
4. Ukloniti `email`/`phone` iz referral poziva (stavka 3.4)
5. Eksplicitno filtrirati aktivnu narudžbu po `BOOKED_DELIVERY`/`CHARGED_DELIVERY` (stavka 3.5)
