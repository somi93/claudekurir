# Odgovor backenda na `Frontend_pitanja_za_backend_16_avgust.md` — status sa naše strane

Backend je danas (16.08) odgovorio kroz tiket (Milos Petrovic) na stavke 1, 2,
3.2 (podsetnik iz 15.08, condition-tags), 5 i deo 7 iz našeg dokumenta.
Finansijski deo (sekcije 2 i 3 originalnog dokumenta) i dalje čeka — najavljeno
za sledeću poruku, zajedno sa odgovorom na sekciju 4 (duplikati).

Status po stavci: **✅ Već ispravljeno** / **📋 Provereno, bez izmene** /
**❓ Čeka vaš odgovor** / **⏳ Čekamo vaš sledeći dokument**

---

## 1. `vehicle-rules/{id}` — 404 (naša sekcija 1)

**Status: ✅ Već ispravljeno**

Backend je potvrdio tačan oblik: `PUT/DELETE /api/delivery-companies/vehicle-rules/{id}`
(flat ruta pod `delivery-companies` prefiksom, bez `companyId` u putanji — isti
obrazac kao `surcharges/{id}`). Ovo je već implementirano
(`app/services/vehicleRulesService.ts`), radi.

---

## 2. Pet restoranskih finansijskih ruta — flat obrazac (naša sekcija 2)

**Status: ✅ Već ispravljeno**

Backend je potvrdio "flat" obrazac za svih pet, bez izmene naše pretpostavke:

```
PUT/DELETE /api/commissions/{id}
PUT/DELETE /api/deposits/{id}
PUT/DELETE /api/promotions/{id}
PUT/DELETE /api/refunds/{id}
PUT /api/platform-payments/{id}
```

Već implementirano u odgovarajućim servisima
(`restaurantCommissionsService.ts`, `restaurantDepositsService.ts`,
`restaurantPromotionsService.ts`, `restaurantRefundsService.ts`,
`restaurantPlatformPaymentsService.ts`) — nema akcije.

---

## 3. `delivery_company_id` na `active-deliveries`/`refused` (naša sekcija 5)

**Status: ✅ Već ispravljeno**

Backend je potvrdio isti `delivery_company_id` query parametar kao
`orders/waiting`. Već implementirano u `activeDeliveriesService.ts` i
`refusedOrdersService.ts` — nema akcije.

---

## 4. `GET /condition-tags` — "Brzo dodavanje" chip-ovi (podsetnik iz 15.08, 3.2)

**Status: 📋 Provereno, bez izmene ponašanja**

Backend tvrdi da endpoint uživo vraća ispravan odgovor (4 taga: Kiša, Sneg,
Gužva, Noćna dostava, sa `default_time_from`/`default_time_to`) i da ako
chip-ovi i dalje fale, uzrok nije na njihovoj strani.

Prošli smo ceo lanac (`conditionTagsService.ts` → `useSurcharges.fetchConditionTags`
→ `SurchargesPanel.vue quickAddItems`) — svi tipovi i imena polja se poklapaju
sa onim što backend opisuje, poziv se dešava odmah pri učitavanju ekrana,
nezavisno od `companyId`. Nismo našli grešku u kodu.

Jedini nalaz: greška iz `fetch` poziva se tiho gutala (namerno, katalog nije
kritičan za rad forme), pa ako poziv padne (401, mrežna greška...) chip-ovi
prosto ne bi bili prikazani, bez traga u konzoli — teško za dijagnostiku "u
polju". Dodali smo `console.warn` na tu granu (`useSurcharges.ts`) da sledeći
put bude odmah vidljivo da li poziv uopšte propada. Nemamo odavde pristup
produkcionom API-ju sa pravim nalogom da ovo i uživo potvrdimo u browseru —
ako se prijava o nedostajućim chip-ovima ponovi, prva stvar za proveru je
konzola u tom trenutku.

---

## 5. Vokabular vozila u `vehicle-rules` (naša sekcija 7, poslednja stavka)

**Status: ❓ Čeka vaš odgovor — nismo menjali kod**

Backend je danas naveo validaciju kao `in:car,motorbike,bicycle,walk`, uz
napomenu da su `car`/`bicycle` potvrđeni uživo, a `motorbike`/`scooter` nisu
(nema živog primera), ali su "isti deo iste validacije".

Ovo se kosi sa dva ranija, eksplicitna nalaza u istoj konverzaciji:

- **14.08** — potvrđeno da `vehicle-rules` čita `Vehicle::type` **direktno**,
  isti vokabular kao registracija opreme (`car`/`motorbike`/`bicycle`/`scooter`),
  i da je ranija pretpostavka o odvojenom `"walk"` vokabularu za vehicle-rules
  bila **pogrešna** (komentar u `app/types/pricing.ts:114-116`).
- **15.08** — potvrđeno da `VehicleType` (registracija) ima tačno četiri
  vrednosti, **bez** "peške"/`"walk"` — po tome smo tu opciju uklonili sa
  kurirskog profila (`Frontend_pitanja_za_backend_15_avgust.md`, 3.1). Pitanje
  da li kurir/pravilo uopšte može biti "bez vozila" (peške) je i dalje otvoreno
  odatle, neodgovoreno.

`"walk"` se ne pojavljuje ni u jednom od tri utvrđena vokabulara u sistemu
(registracija: `bicycle/scooter/motorbike/car`; GpsTracking/routing:
`car/bicycle/foot/motorcycle` — koristi `"foot"`, ne `"walk"`; vehicle-rules:
potvrđeno 14.08 = registracija). Zato **nismo** menjali dropdown u
`VehicleRulesPanel.vue` (ostaje `car/motorbike/bicycle/scooter`) — rizik da
pokvarimo postojeća pravila sa `scooter` vrednošću na osnovu citata koji je u
direktnoj suprotnosti sa vašom sopstvenom 14.08 ispravkom.

**Molimo:** možete li dvaput proveriti da li je `in:car,motorbike,bicycle,walk`
stvarno trenutna validacija za `vehicle_rules.vehicle`, ili je ovo omaška (npr.
preslikano iz otvorenog pitanja o "peške" kuriru iz 15.08, koje je odvojena
tema)? Ako je `"walk"` zaista tačno, treba nam i odgovor na 15.08 pitanje 3.1
(da li kurir/pravilo bez vozila uopšte postoji i kako se to šalje) da bismo
znali kako da ga ponudimo u formi. U međuvremenu, živi primer sa makar jednim
`motorbike` redom bi konačno zatvorio i taj deo (`scooter` protiv `walk`) bez
nagađanja.

---

## 6. Duplikati (naša sekcija 4) i finansijski sloj (naša sekcija 3)

**Status: ⏳ Čekamo vaš sledeći dokument**

Backend je potvrdio da ovo dolazi uz veći pregled restoranskog finansijskog
sloja (10 kontrolera), dokument istog tipa kao
`Uputstvo_finansije_i_saradnja_frontend_cirilica`. Nema akcije sa naše strane
dok ne stigne.

---

# Šta smo promenili danas (ovaj krug)

- `app/composables/useSurcharges.ts` — dodat `console.warn` u catch granu
  `fetchConditionTags` (dijagnostika, bez promene ponašanja za korisnika).

Stavke 1, 2 i 3 (iz numeracije iznad) su bile implementirane ranije danas, pre
ovog tiketa — ovaj dokument samo potvrđuje da se poklapaju sa onim što je
backend danas rekao.

# Šta čeka backend

1. Razjasniti `walk` vs `scooter` za `vehicle_rules.vehicle` (stavka 5) — u
   suprotnom sa sopstvenom 14.08 potvrdom.
2. Živ primer `vehicle-rules` reda sa `motorbike` (ili `scooter`) da se
   vokabular konačno zatvori.
3. Odgovor na 15.08 pitanje 3.1 (kurir/pravilo bez registrovanog vozila).
4. Najavljeni dokument za restoranski finansijski sloj + odgovor na duplikate
   (naša sekcija 4).
