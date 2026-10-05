# Kompletna analiza projekta — šta nam treba, šta ne treba (16. avgust 2026)

Pregled cele aplikacije (41 servis, sve stranice, svi dosadašnji dokumenti
prepiske sa backendom) — ne samo dva današnja tiketa, nego sve što je ikad
označeno kao pretpostavka, potvrđeno, mock ili odloženo. Cilj: jedan
dokument koji kaže, za svaki deo aplikacije, da li **stvarno treba nešto od
backenda** ili je **već rešeno / svesno van obima**.

Izvori (pročitani u celosti pri pisanju ovog dokumenta):
`Frontend_pitanja_za_backend_15_avgust.md`, `Frontend_pitanja_za_backend_16_avgust.md`,
`Odgovori_frontend_analiza_14_avgust.md`, `Odgovori_frontend_analiza_16_avgust.md`,
`Implementacija_upravljanje_kuririma_16_avgust.md`,
`docs/Uputstvo_finansije_i_saradnja_frontend_cirilica.md`,
`docs/Dopuna_katalog_tagovi_frontend_cirilica.md`, `docs/UIUX_napomene_katalog_frontend.md`,
plus svih 41 fajlova u `app/services/`.

**Ažurirano 16.08 popodne** sa rezultatima prvog uživo testa novog "Kuriri"
taba protiv pravog servera (`api.kurir.ordera.app`) — vidi **B3**, **B6**,
**B7** za nove, potvrđene nalaze (dva stvarna baga, ne pretpostavke).

---

# DEO A — Radi, potvrđeno, nema akcije

## A1. Auth / sesija
`POST /login`, `GET /me` (sad i sa `must_change_password`, 16.08),
`PUT /me/password` (novo, 16.08), `POST /logout`, refresh-token tok
(`plugins/api.client.ts`). Stabilno, koristi ga cela aplikacija.

## A2. Kurir — profil i registracija vozila
- `GET/PUT /couriers/:id` — profil, potvrđen oblik (osim jednog otvorenog
  ugla, vidi **B4**).
- Vokabular registracije vozila: `bicycle`/`scooter`/`motorbike`/`car` —
  potvrđeno 14.08, korišćeno u profilu, vehicle-rules dropdown-u (uz
  otvoreno pitanje, vidi **B2**) i novom "Dodaj kurira" dijalogu (16.08).

## A3. Kurir — svakodnevni rad
`GET /orders/available`, `GET /orders/driver/:id`, `POST /orders/:id/accept|pickup|deliver`,
`GET/POST /couriers/:id/wallet`, `PUT/DELETE /wallet-transactions/:id`,
`GET /couriers/:id/earnings` (read-only, sistemski agregat),
`GET /couriers/:id/history` (izvedeno iz `orders_guest`),
`GET /couriers/:id/inbox`, `PUT /inbox/:id`, `PUT /couriers/:id/inbox/mark-all-read`,
`GET /couriers/:id/scoring` (read-only, nedeljni batch),
`GET/POST /couriers/:id/sessions`, rezervacija/swap/otkazivanje sesija,
`GET /couriers/:id/zones`, `GET/POST/PATCH/DELETE .../availability`,
`GET /couriers/:id/companies`, `POST/DELETE .../referrals` (email/phone
uklonjeni 14.08), `POST /routing/route` (šalje stvaran tip vozila, ne fiksni
`"car"`, od 15.08).

## A4. Dispečer — dodela i praćenje
- `GET /dispatcher/orders/waiting|active-deliveries|refused` — sva tri sa
  `delivery_company_id` query parametrom, poslednja dva potvrđena danas
  (16.08), prvo već ranije.
- `GET /dispatcher/orders/:id/candidate-couriers` — vokabular **routing**
  (`car`/`bicycle`/`foot`/`motorcycle`), ispravljeno 15.08 pošto se
  ispostavilo da originalna 14.08 tvrdnja ("isti vokabular kao
  registracija") nije tačna za ovaj endpoint (`"foot"` se pojavljuje uživo).
- `POST /orders/:id/accept` (dispečer u ime kurira) — `driver_id`
  provera vlasništva ispravljena 14.08 (bezbednosna rupa zatvorena).
- `GET/PATCH /dispatcher/delivery-companies/:id/availability-enforcement` —
  deploy-ovano i povezano 14.08/15.08.
- `GET /dispatcher/zones`, CRUD, `GET .../zones/live-coverage`.
- `GET /dispatcher/my-companies`, `PATCH .../city`.
- `GET/POST/PUT/DELETE /dispatcher/shift-templates`, duplikacija nedelje.
- `GET .../recommend-vehicle`.

## A5. Dispečer — Cenovnik (pricing.vue)
- Osnovna cena (`GET/PUT /delivery-companies/:id/pricing`, `POST .../calculate`).
- Naknade (surcharges) — puni CRUD, flat `PUT/DELETE /delivery-companies/surcharges/:id`.
- **Katalog uslova** (`GET /condition-tags`) — implementiran po
  `Dopuna_katalog_tagovi_frontend_cirilica.md`, backend danas (16.08)
  potvrdio da uživo vraća tačan odgovor (4 taga). Kod je proveren
  liniju-po-liniju danas, poklapa se; dodat je samo `console.warn` na
  tihu grešku (vidi `Odgovori_frontend_analiza_16_avgust.md`, stavka 4).
- **Vozila i pravila** (vehicle-rules) — `GET/POST` ugnježdeno, `PUT/DELETE`
  flat `/delivery-companies/vehicle-rules/:id` (404 ispravljen danas). Sam
  **vokabular** polja `vehicle` ostaje otvoren, vidi **B2**.

## A6. Dispečer — Firma (company.vue)
- Finansijske postavke — striktno po `Uputstvo_finansije_i_saradnja_frontend_cirilica.md`,
  `commission_percentage` zaključano (read-only). **Uživo potvrđeno danas**
  (16.08, test dispečera) — `GET .../finance-settings` vraća tačno
  dokumentovan oblik, ekran radi.
- Saradnja sa restoranima — kod je i dalje po istom dokumentu (dva nezavisna
  prekidača, `active_restoran`/`active_company` ispravno razdvojena), ali
  **uživo test danas otkrio regresiju** — `GET .../restaurants` sad vraća
  404 "route not found" na pravom serveru. Vidi **B7**, front kod nije uzrok.
- **Kuriri** (nov tab, 16.08) — lista/suspenzija/kreiranje/uklanjanje.
  **Delimično potvrđeno uživo danas** — vidi **B6** za pun nalaz (GET radi
  ispravno, POST kreiranja puca za `vehicle_type: "motorbike"`, vidi **B3**).

## A7. Restoran — finansijski slojevi sa dokumentovanim ugovorom
Isti pet ruta gore (commissions/deposits/promotions/refunds/platform-payments)
za PUT/DELETE su flat i potvrđene danas. `internal` polje na saradnji,
`activated_at` na naknadi — dokumentovano, radi.

## A8. Promena lozinke + podsetnik, `GET /cities`
Implementirano danas (vidi `Implementacija_upravljanje_kuririma_16_avgust.md`).
`GET /cities` odluka (16.08: ide na Ordera super-admin nivo, ne dispečera) —
frontend je nikad nije ni pozivao, već zadovoljeno.

---

# DEO B — Šta nam stvarno treba (otvoreni blokeri, tražena akcija od backenda)

## B1. 🔴 Najveći — restoranski finansijski GET sloj (11 ekrana)
`financial-overview`, `payouts` (`/payouts`), `invoices`, `transactions`,
`turnover`, `balance-ledger`, `restaurant-payouts` (`/bank-payouts`) —
**nijedan od ovih sedam nikad nije uspešno pozvan protiv pravog servera.**
Rute, oblik odgovora (`{success, data}`), imena polja u `data` — sve je
pretpostavka po REST konvenciji i imenu ekrana.

**Nijansa vredna pažnje:** za preostalih pet (`commissions`, `deposits`,
`promotions`, `refunds`, `platform-payments`) postoji **kontradikcija u
našoj sopstvenoj dokumentaciji** — `Frontend_pitanja_za_backend_16_avgust.md`
sekcija 2 tvrdi da je kreiranje (POST) za ovih pet "potvrđeno GET-om", dok
ista sekcija 3, istog dokumenta, iste rute stavlja u tabelu "nijedan nikad
nije uspešno pozvan protiv vašeg servera". Ne znamo koja je tvrdnja tačna —
preporuka: tretirati GET listu za svih 11+5 ekrana kao **nepotvrđenu** dok
ne stigne najavljeni dokument (10 kontrolera, isti tip kao
`Uputstvo_finansije_i_saradnja`), i pri prvoj prilici razjasniti internu
nedoslednost da se ne ponovi.

**Blokira:** svih 12 restoranskih finansijskih ekrana (osim finance-settings/
restaurant-cooperation na dispečerskoj strani, koji su OK, vidi A6).

## B2. 🟠 Vokabular `vehicle` polja u `vehicle-rules`
Danas (16.08) backend je naveo validaciju kao `in:car,motorbike,bicycle,walk`
— u sukobu sa sopstvenom 14.08 potvrdom da vehicle-rules deli **isti**
vokabular kao registracija (`car/motorbike/bicycle/scooter`, bez "walk").
`"walk"` se ne pojavljuje ni u jednom od tri utvrđena vokabulara u sistemu.
Nismo menjali kod (rizik da pokvarimo postojeća `scooter` pravila na osnovu
citata koji je u direktnoj suprotnosti sa ranijom ispravkom) — detaljno
obrazloženje u `Odgovori_frontend_analiza_16_avgust.md`, stavka 5.

Povezano — ovo isto pitanje je već postavljeno **15.08** (sekcija 3.3,
"pošaljite stvaran primer sa bar dva različita vozila") i **nikad nije
dobilo živ primer sa `motorbike` redom**. Dva različita dana, dve
kontradiktorne informacije, nula živih primera — potreban je konačan,
proveren odgovor, ne još jedna usputna napomena.

**Nova čvrsta indicija (16.08, uživo test):** pokušaj kreiranja kurira sa
`vehicle_type: "motorbike"` je pukao na bazi — vidi **B3**. To znači da
`vehicles.type` kolona u bazi **trenutno fizički ne prihvata `"motorbike"`**,
što je direktan dokaz protiv 14.08 potvrde da je `motorbike` deo
registracionog vokabulara. Ovo pitanje se više ne može rešiti dodatnim
pismenim odgovorom — treba provera/migracija na samoj `vehicles` tabeli.

## B3. 🔴 KRITIČNO (potvrđeno uživo, 16.08) — kreiranje kurira puca za `vehicle_type: "motorbike"`

Uživo test danas: `POST /api/dispatcher/delivery-companies/24/couriers` sa
telom
`{name: "Novi", lastname: "Kurir", phone: "065568744", email: "novikurir@kurir.com", temporary_password: "CuhrZ7tyMc", vehicle_type: "motorbike"}`
vratio je **500 Internal Server Error**:

```
SQLSTATE[01000]: Warning: 1265 Data truncated for column 'type' at row 1
(Connection: mysql, Host: 136.243.81.37, Port: 3306, Database: restoranidostava,
SQL: insert into `vehicles` (`user_id`, `type`, `updated_at`, `created_at`)
values (30459, motorbike, 2026-08-16 19:45:16, 2026-08-16 19:45:16))
```

Ovo je klasična MySQL greška za ENUM kolonu koja ne sadrži poslatu vrednost
— `vehicles.type` na bazi **fizički ne prihvata `"motorbike"`** kao validnu
vrednost, uprkos tome što je `motorbike` deo pismeno potvrđenog (14.08)
registracionog vokabulara (`bicycle`/`scooter`/`motorbike`/`car`) i uprkos
tome što ga danas (16.08, item 5 prvog tiketa) backend navodi kao deo
`vehicle_rules` validacije. Ovo dodatno destabilizuje **B2** — treći nezavisan
signal (14.08 tvrdnja, 16.08 tvrdnja, i sad stvarna DB šema) i sva tri se ne
slažu.

**Sumnja na dodatan problem — orphan red:** SQL greška je na `insert into
vehicles`, što znači da je `user_id: 30459` (novi kurir) verovatno **već
upisan** u `users` tabelu pre nego što je insert u `vehicles` pukao. Ako
transakcija ne pokriva oba insert-a zajedno, dispečer koji dobije grešku i
pokuša ponovo da kreira istog kurira (isti telefon/email) može naleteti na
"već postoji" grešku za nalog koji na ekranu nikad nije uspešno kreiran.
**Molimo backend da proveri** da li je `user_id 30459` ostao u bazi bez
vozila (očekivano i bezopasno, front to i inače prikazuje kao "Vozilo nije
dodato") ili u nekom nekonzistentnom stanju.

**Preporuka za front (nije još urađeno, čeka potvrdu obima):** ne uklanjamo
"Motor" iz padajućeg menija u "Dodaj kurira" dijalogu dok ne znamo da li je
problem specifičan za `motorbike` ili širi (npr. i `scooter` puca na istoj
koloni) — brisanje opcije na osnovu jednog testa bi moglo sakriti stvarni
domet bага. Sledeći uživo test treba da proba kreiranje sa `"car"`,
`"bicycle"`, `"scooter"` i bez `vehicle_type` polja uopšte, da se izoluje
da li je ovo samo `motorbike` ili čitava kolona pogrešno definisana.

## B4. 🟡 Kurir bez registrovanog vozila
Otvoreno od **15.08** (sekcija 3.1), i dalje bez odgovora:
- Da li kurir uopšte može nemati vozilo (dostava peške)?
- Kako `GET /couriers/:id` predstavlja to stanje — `vehicle: null`, ili
  posebna vrednost?
- Šta se dešava ako `PUT /couriers/:id` ode bez `vehicle_type` polja?

Frontend i dalje prikazuje "Automobil" kao čisto vizuelni placeholder dok
kurir prvi put ne sačuva izbor — **pretpostavka, ne potvrđeno ponašanje**
(`app/models/CourierProfile.ts:21`). Ovo je sad relevantnije nego ranije —
novi `couriers-status` endpoint (16.08) potvrđuje da `vehicle: null` **jeste**
realno stanje u bazi (primer "Ana Ilić" u tiketu), ali samo za dispečerski
pregled liste, ne za sam kurirski profil — ta dva ugla i dalje nisu
usaglašena.

## B5. 🟡 Pravila za lozinku (min. dužina/kompleksnost)
Postavljeno danas (`Implementacija_upravljanje_kuririma_16_avgust.md`) —
frontend pretpostavlja minimum 8 karaktera i za `new_password`
(`PUT /me/password`) i za `temporary_password` (`POST .../couriers`), bez
potvrde da li se to poklapa sa backend validacijom.

## B6. 🟡 Kuriri firme — uživo testirano danas, delimično potvrđeno

**Ažurirano 16.08 posle uživo testa** (prethodno je ovde pisalo "nikad
testirano" — sad imamo stvarne rezultate):

- ✅ **`GET .../couriers-status` potvrđeno, radi tačno kako je specifikovano.**
  Odgovor za firmu 24 (`Admin1 Dostava Ordera` bez vozila, `Dostavljac 1
  Ordera` sa `vehicle: {id: 2, type: "car"}`, `Admin Ordera` bez vozila) se
  poklapa polje-po-polje sa `types/company-courier.ts`. UI je renderovao
  listu ispravno — imena, telefon, bedž "Automobil"/"Vozilo nije dodato",
  status "Aktivan" — bez izmene koda potrebne.
- 🔴 **`POST .../couriers` puca za `vehicle_type: "motorbike"`** — vidi **B3**,
  novi kritičan nalaz, ne generička sumnja.
- ❓ **Suspenzija/aktivacija i uklanjanje sa liste — još nisu testirani uživo.**
  Preporuka: sledeći uživo prolaz treba da pokrije `PATCH .../suspend`
  (sa i bez `reason`) i `DELETE .../couriers/:id`, plus kreiranje kurira sa
  `vehicle_type` različitim od `motorbike` (ili bez tog polja) da se
  potvrdi da ostatak toka radi.

## B7. 🔴 Regresija (potvrđeno uživo, 16.08) — `GET .../restaurants` vraća 404

"Saradnja sa restoranima" tab na "Firma" ekranu danas na pravom serveru
vraća:

```json
{
    "message": "The route api/dispatcher/delivery-companies/24/restaurants could not be found.",
    "exception": "Symfony\\Component\\HttpKernel\\Exception\\NotFoundHttpException"
}
```

Front zove tačno ono što `docs/Uputstvo_finansije_i_saradnja_frontend_cirilica.md`
dokumentuje (`GET /api/dispatcher/delivery-companies/{companyId}/restaurants`,
potvrđeno u `app/services/restaurantCooperationService.ts:9`) — ovo nije
neusklađenost frontenda sa dokumentom, nego "route not found" na serveru za
rutu koja je ranije bila dokumentovana kao gotova. Moguće da je ruta
slučajno uklonjena/premeštena u međuvremenu. Nismo menjali front kod —
nema šta da se popravi sa naše strane dok backend ne vrati rutu.

## B8. 🟡 Duplikati — "Isplate" vs "Isplate restoranu", "Uplate restorana" vs "Plaćanja platformi"
Pitano 16.08 (sekcija 4 originalnog dokumenta) — da li su ovo stvarno dva
odvojena toka podataka ili je front napravio dva ekrana za istu stvar.
Backend je danas potvrdio da odgovor dolazi uz finansijski dokument
(vidi B1) — i dalje čekamo.

## B9. 🟢 Notifikacija kuriru posle "Pošalji ponudu"
Otvoreno od **14.08** (stavka 2.4), ponovljeno 15.08 kao podsetnik, **bez
pomaka od tada** (ni u 16.08 tiketima). Infrastruktura (`FcmService`,
`PendingOrderNotifier`) postoji ali nije povezana — čeka se provera da li
`app.ordera.app` (mobilni tim) već šalje nešto slično. Ako se ovo ne pomeri
uskoro, vredi ponovo eskalirati direktno mobilnom timu umesto čekanja.

---

# DEO C — Šta nam NE treba / svesno van obima (ne čeka akciju)

## C1. `GET /api/cities` za dispečera
Eksplicitno odlučeno 16.08 — dodela grada ide na Ordera super-admin nivo.
Frontend ionako nikad nije zvao ovaj endpoint (gradovi se izvode iz
postojećih firmi). Zatvoreno.

## C2. Šest svesno mock akcija (nisu bagovi)
Iz `Frontend_pitanja_za_backend_16_avgust.md` sekcija 6, potvrđeno u kodu
danas (`grep` po `mockAction`/"još nije povezano na backend"):
- `export.vue` — ceo ekran (PDF/Excel/CSV izvoz) je mock.
- `transactions.vue` — Excel/CSV/PDF dugmad.
- `platform-payments.vue` — "Poveži banku" i otpremanje dokaza o uplati.
- PDF dugmad na detaljima fakture/isplate/"Isplate restoranu".

Dugmad postoje i rade vizuelno (snackbar poruka), samo ne zovu backend —
namerno, dok se ne odredi prioritet za PDF/Excel generisanje i bankovnu
integraciju.

## C3. Standardizacija vozila-vokabulara u jedan
Eksplicitno odbijeno 14.08 zbog rizika sa `GpsTracking`/OSRM vezom. Tri
odvojena vokabulara (registracija, routing, vehicle-rules) ostaju — vidi
napomenu u `app/utils/vehicle.ts`.

## C4. Globalno brisanje naloga kurira (`DELETE /couriers/:id`)
Postoji, radi, ali je eksplicitno van obima 16.08 kuririma-tiketa
(razlikuje se od "ukloni sa liste firme" — vidi
`Implementacija_upravljanje_kuririma_16_avgust.md`, stavka 6). Nije dirano.

## C5. Sistem popusta za preporučene korisnike
Zabeleženo 14.08 kao ideja za budućnost, ponovljeno 15.08 kao podsetnik —
"veći poduhvat, bez akcije za sada". I dalje tako, namerno.

## C6. Zastarele reference na `docs/glovo-rider-features.md`
Sitan nalaz, ne blokira ništa: `app/utils/navigation.ts:74` i stari
komentar u `app/pages/change-password.vue` (pre današnje izmene)
referenciraju fajl koji više ne postoji u `docs/` — verovatno preimenovan/
uklonjen u ranijem čišćenju. Same stranice (`courier/*`, `restaurant/*`)
odavno nisu "prazni stub-ovi" kako komentar tvrdi — sve imaju stvarne
servise (vidi Deo A). Kozmetički dug, čisto po prilici, ne hitno.

---

# DEO D — Karta dokumenata (za orijentaciju kroz prepisku)

| Dokument | Ko piše | Šta pokriva |
|---|---|---|
| `Odgovori_frontend_analiza_14_avgust.md` | backend → front | 14 stavki, vozila, `delivery_company_id`, sigurnosna rupa, enum stanja |
| `Frontend_pitanja_za_backend_15_avgust.md` | front → backend | Ispravke posle 14.08, `candidate-couriers` vokabular, otvorena pitanja (kurir bez vozila, condition-tags, vehicle-rules vokabular, `GET /cities`) |
| `docs/Uputstvo_finansije_i_saradnja_frontend_cirilica.md` | backend → front | Finance-settings + restaurant-cooperation (dispečerska "Firma" strana) — jedini deo finansijskog sloja sa punom specifikacijom |
| `docs/Dopuna_katalog_tagovi_frontend_cirilica.md` + `docs/UIUX_napomene_katalog_frontend.md` | backend/dizajn → front | `condition_tags` katalog, "Brzo dodavanje" UX |
| `Frontend_pitanja_za_backend_16_avgust.md` | front → backend | 404 bag, 5+11 nepotvrđenih restoranskih ruta, duplikati, `delivery_company_id` na 2 endpointa, mock akcije, podsetnici |
| `Odgovori_frontend_analiza_16_avgust.md` | front (na osnovu tiketa) | Status po stavci iz gornjeg dokumenta — 3 potvrđene/implementirane, 1 tehnički proverena, 1 sporna (vokabular) |
| (tiket, bez posebnog `.md`) | backend → front | "Upravljanje kuririma, lozinka, gradovi" — pokriveno u `Implementacija_upravljanje_kuririma_16_avgust.md` |
| `Implementacija_upravljanje_kuririma_16_avgust.md` | front | Šta je urađeno po gornjem tiketu + otvoreno pitanje o pravilima lozinke |
| **Ovaj dokument** | front | Presek svega gore + pun sken koda (41 servis) |

---

# Sažetak — redosled prioriteta za backend

**Ažurirano posle uživo testa 16.08 (popodne)** — dva nova, potvrđena,
reproducibilna nalaza guraju se na vrh liste jer su stvarni bagovi sa stack
trace-om, ne pretpostavke:

1. **B3** 🔴 — kreiranje kurira puca za `vehicle_type: "motorbike"`
   (`Data truncated for column 'type'`, `vehicles` tabela) — potvrđeno
   uživo, blokira deo funkcionalnosti kreiranje kurira **danas**, ne samo
   teoretski. Proveriti i da li je ostao orphan `user_id 30459` red.
2. **B7** 🔴 — `GET .../restaurants` (Saradnja sa restoranima) vraća 404
   uživo, iako je ranije dokumentovano kao gotovo — regresija na serveru.
3. **B1** — finansijski GET sloj (11+ ekrana) — najveći po obimu, blokira
   ceo restoranski finansijski deo aplikacije.
4. **B2** — vehicle-rules vokabular (`walk` vs `scooter`) — sad potkrepljeno
   dodatnim dokazom iz B3 (isti `vehicles.type` problem).
5. **B4** — kurir bez vozila — otvoreno od 15.08, sad još relevantnije zbog
   novog courier-status endpointa.
6. **B8** — duplikati ekrana — dolazi uz B1, ne posebna akcija.
7. **B5**, **B6** — sitnije: pravila za lozinku, i ostatak live-testa
   kuriri-taba (suspenzija/uklanjanje, kreiranje sa drugim vozilom).
8. **B9** — notifikacije, stoji od 14.08 bez pomaka — vredi eskalirati
   nezavisno ako se ne pomeri uskoro.
