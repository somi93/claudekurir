# Pitanja i status za backend tim (15. avgust 2026)

Kontekst: implementirali smo svih 5 stavki iz `Odgovori_frontend_analiza_14_avgust.md`
("Šta čeka vas (front)") i katalog uslova (`condition_tags`) iz
`Dopuna_katalog_tagovi_frontend_cirilica.md` / `UIUX_napomene_katalog_frontend.md`.
Ovaj dokument ima nekoliko delova: **(1) šta je urađeno danas**, **(2) ispravke**
koje smo potvrdili/otkrili u međuvremenu (jedna testiranjem uživo, jedna
pregledom koda), **(3) pitanja koja i dalje traže vašu potvrdu**, i **(4)
podsetnik na stavke koje su već ranije označene kao odložene/otvorene**, da ne
ispadnu iz vidokruga.

---

## 1. Implementirano danas — kratak pregled

- Vokabular vozila usklađen: `bicycle`/`scooter`/`motorbike`/`car` za registraciju
  i vehicle-rules; `car`/`bicycle`/`foot`/`motorcycle` za routing i
  candidate-couriers (sa mapiranjem motorbike/scooter → motorcycle na frontu za
  routing pozive) — candidate-couriers vokabular ispravljen naknadno, vidi
  sekciju 2.
- Kurirski profil i "Pravila za odabir vozila" sad nude "Skuter" umjesto "Pešice".
- `delivery_company_id` iz `OrderResource` zamenio hardkodovani `24` u kalkulaciji
  cene za kurira.
- Routing pozivi šalju kurirov stvarni tip vozila umjesto fiksnog `"car"`.
- `email`/`phone` uklonjeni iz javnog referral poziva (`POST /couriers/:id/referrals`
  sa landing stranice).
- Aktivna narudžba kurira se eksplicitno filtrira po `BOOKED_DELIVERY`/`CHARGED_DELIVERY`.
- Katalog uslova (`condition_tags`) povezan na "Dodatni parametri" ekranu - chip-ovi
  iz `GET /condition-tags`, `condition_tag_id` se šalje pri kreiranju naknade.
- Usput smo primetili da prekidač "Provjera dostupnosti" (Podešavanja tab,
  `/dispatcher/scheduling`) nikad nije čitao vaš `GET .../availability-enforcement`
  (deploy-ovan 14.08, stavka 2.3) - front je i dalje mislio da taj GET ne postoji
  pa je prekidač uvek prikazivao "isključeno" bez obzira na stvarno stanje firme.
  Ovo je čisto naša greška (zaboravili smo da povežemo endpoint posle deploy-a),
  ispravljeno danas - nema akcije potrebne sa vaše strane, samo obaveštenje da
  je vaš rad sada stvarno u upotrebi.
- Isto tako smo dodali unos za `max_terrain_factor` u formu za novo pravilo
  vozila (Vozila i pravila tab) - do sada se uvek slalo `null`, pa je
  `vehicle_suitable` praktično uvek vraćao `true` (stavka 2.2 iz 14.08
  odgovora). Dispečer sad može da postavi prag po pravilu.
- I "Dodela narudžbi" ekran je dopunjen - vidi 2.2 ispod, endpoint koji ste
  deploy-ovali 14.08 konačno ima front koji ga koristi.

---

## 2. Ispravke

### 2.1 candidate-couriers NE koristi registracioni vokabular

U prošlom odgovoru (14.08) je pisalo: *"DeliveryVehicleRule/candidate-couriers:
čita Vehicle::type direktno, isti vokabular kao registracija"* i, u istoj
stavci: *"candidate-couriers tabela u vašoj analizi ne odgovara stvarnoj
implementaciji — proverite protiv svežeg poziva."* Uradili smo izmenu na
osnovu prve rečenice (uskladili vokabular sa registracijom:
`bicycle`/`scooter`/`motorbike`/`car`), a danas smo dobili stvaran odgovor sa
`GET /dispatcher/orders/{id}/candidate-couriers`:

```json
{
    "data": [
        { "courier_id": 30189, "vehicle": "car", "...": "..." },
        { "courier_id": 30188, "vehicle": "foot", "...": "..." },
        { "courier_id": 30369, "vehicle": "foot", "...": "..." }
    ]
}
```

`"foot"` **ne postoji** u registracionom vokabularu (`bicycle`/`scooter`/
`motorbike`/`car`) — znači da tvrdnja "isti vokabular kao registracija" nije
tačna. Ono što stvarno vidimo (`car`, `foot`) se poklapa sa **routing**
vokabularom (`car`/`bicycle`/`foot`/`motorcycle`), ne sa registracionim.

**Šta smo uradili:** vratili smo `candidate-couriers` vokabular na routing
skup (`car`/`bicycle`/`foot`/`motorcycle`), gde `foot` znači "kurir nema
registrovano vozilo" (oba testna kurira sa `"foot"` u primeru iznad izgledaju
kao test/admin nalozi bez podešenog vozila).

**Molimo:** potvrdite da je ovo tačan vokabular (i da nema još neke vrednosti
koju nismo videli u ova tri primera - npr. `bicycle`/`motorcycle` za stvarno
registrovane bicikliste/motocikliste), i po mogućstvu ispravite opis u internoj
dokumentaciji da candidate-couriers koristi routing, ne registracioni vokabular.

### 2.2 "Dodela narudžbi" ekran nije koristio `orders/waiting` — sad ispravljeno

I prošli i ovaj dokument (naš, ne vaš) su tvrdili da je "Dodela narudžbi" ekran
već povezan na `GET /api/dispatcher/orders/waiting` ("dispečer ručno osvežava
'Dodela narudžbi' ekran (orders/waiting, već gotovo)" - rečenica je originalno
vaša, iz 14.08 odgovora, mi smo je samo preneli bez provere). Pri pregledu koda
smo utvrdili da to **nije bilo tačno** - ekran za predlaganje kurira i dalje je
tražio da dispečer ručno ukuca ID narudžbe, bez ijednog poziva na
`orders/waiting`.

**Ovo nije bila greška vaše strane** - endpoint je stajao deploy-ovan i gotov
od 14.08, front ga jednostavno nikad nije povezao. Popravili smo to danas:
"Dodela narudžbi" ekran sad ima listu "Čeka kurira" (osvežava `orders/waiting`
na svakih 20s, prikazuje restoran/status/procenu vremena), klik na narudžbu odmah
popuni i pokrene pretragu kandidata za nju - ista funkcionalnost koju je vaš
14.08 odgovor opisivao kao već gotovu, sad je to i stvarno tako. Nema akcije
potrebne sa vaše strane.

---

## 3. Pitanja koja i dalje traže vašu potvrdu

### 3.1 Kurir bez registrovanog vozila — šta se šalje/prima na profilu?

Pošto je `VehicleType` (registracija) potvrđeno tačno četiri vrednosti
(`bicycle`/`scooter`/`motorbike`/`car`, bez "peške"/"walk"), uklonili smo tu
opciju iz kurirskog profila. Iz nalaza u sekciji 2 sad znamo da `candidate-couriers`
predstavlja "bez vozila" kao `"foot"` - ali to je routing vokabular, ne
registracija, pa ostaje otvoreno konkretno za profil:

- Da li kurir uopšte može da nema registrovano vozilo (npr. dostavlja peške)?
  Ako da — kako se to predstavlja na `GET /couriers/:id`? `vehicle: null`, ili
  neka posebna vrednost?
- Šta se dešava ako frontend pošalje `PUT /couriers/:id` bez `vehicle_type`
  polja uopšte (kurir još nije izabrao ništa)?

Trenutno frontend za nepostojeći/neregistrovan profil prikazuje "Automobil" kao
čisto vizuelni placeholder dok kurir prvi put ne sačuva svoj izbor — ali ovo je
naša pretpostavka, ne potvrđeno ponašanje.

### 3.2 GET /condition-tags — potvrda da smo dobro pogodili format

Implementacija je urađena striktno po primeru iz
`Dopuna_katalog_tagovi_frontend_cirilica.md` (4 taga: rain/snow/traffic/night,
`{success, data: [...]}` oblik, `default_time_from`/`default_time_to` kao
`"HH:mm:ss"` ili `null`). Nismo mogli da pozovemo endpoint uživo iz našeg
okruženja.

**Molimo:** potvrdite da je ovo tačan, trenutni oblik odgovora (posebno da
`icon` polje uvek dolazi kao Tabler klasa tipa `"ti-cloud-rain"` - mi to lokalno
mapiramo na naše ikone za prikaz, ali nazad vam šaljemo tačno ono što ste nam
dali).

### 3.3 vehicle-rules vokabular — ista tvrdnja kao candidate-couriers, ali nikad testirana uživo

Rečenica iz 14.08 odgovora koja je pokrenula ispravku u sekciji 2.1 ("čita
Vehicle::type direktno, isti vokabular kao registracija") je bila **jedna
tvrdnja za dva endpointa odjednom** - `DeliveryVehicleRule` (vehicle-rules) i
`candidate-couriers`. Za candidate-couriers smo danas dokazali da tvrdnja nije
tačna. Za `vehicle-rules` (Vozila i pravila tab, `GET/POST .../vehicle-rules`)
**nismo imali priliku da testiramo uživo** - `VehicleRuleVehicle` je i dalje
implementiran kao isti vokabular kao registracija (`bicycle`/`scooter`/
`motorbike`/`car`), oslanjajući se na istu, sad već jednom pogrešnu, tvrdnju.

Ovo je bitnije od candidate-couriers slučaja jer front **piše nazad**
(`POST/PUT .../vehicle-rules` šalje `vehicle` polje) - ako je vokabular
pogrešan, ne samo da bi se pogrešno prikazivalo, nego bi mogli da upišemo
neispravnu vrednost u `delivery_vehicle_rules` tabelu.

**Molimo:** pošaljite nam stvaran primer `GET /delivery-companies/{id}/vehicle-rules`
odgovora sa bar dva različita pravila/vozila, da potvrdimo pre nego što
nastavimo da pišemo u tu tabelu na osnovu nepotvrđene pretpostavke.

### 3.4 Da li postoji (ili može postojati) `GET /cities` ili slično?

Zone i firme se vezuju za `city_id`, ali frontend nema nijedan način da
dispečeru ponudi listu gradova za izbor - jedini "izvor" gradova su gradovi
firmi za koje je dispečer već vezan (`GET /couriers/:id/companies` tipa
podataka). Kad firma još nema podešen grad, ili kad se pravi nova zona a
nijedna od dispečerovih firmi nema grad, jedina opcija je da dispečer **ručno
ukuca numerički ID grada** bez ikakve provere da li taj ID postoji.

**Molimo:** da li postoji `GET /cities` (ili ekvivalent) koji bismo mogli da
pozovemo da zamenimo ovo slobodno unošenje ID-a pravim padajućim menijem? Ako
ne postoji, da li ima smisla da se doda - operativno je rizično da dispečeri
kucaju ID-eve napamet.

---

## 4. Podsetnik — stavke i dalje otvorene iz prošlog odgovora

Ovo nisu nova pitanja, samo podsetnik da ne ispadnu iz vidokruga. Brojevi u
zagradi su stavke iz **prošlog** (14.08) odgovora, ne iz ovog dokumenta:

- **Notifikacija kuriru posle "Pošalji ponudu"** (prošla stavka 2.4) —
  infrastruktura (`FcmService`, `PendingOrderNotifier`) postoji ali nije
  povezana; čekalo se da mobilni programer proveri da li `app.ordera.app` već
  šalje nešto slično. Ima li pomaka?
- **Restoranski deo — mock finansijske stranice** (prošla stavka 4) — potvrđen
  gap, van obima prošlog kruga. I dalje mock na frontu, čekamo prioritet za
  backend deo (PDF/Excel, bankovna integracija, email).
- **Promena lozinke posle prvog logina** (prošla stavka 5.1) — prošli put
  namerno preskočeno na zahtev tima. Frontend stranica (`/change-password`)
  postoji samo kao prazan stub sa TODO komentarom, jer **endpoint za promenu
  lozinke trenutno ne postoji u projektu**. Kad ovo postane prioritet, treba
  nam: (a) endpoint, (b) da li je promena obavezna posle prvog logina ili
  opciona.
- **Ideja: sistem popusta za preporučene korisnike** (prošla stavka 3.4) —
  zabeleženo za budućnost, bez akcije za sada (veći poduhvat).

---

## 5. Sitno, samo za info (ne traži akciju)

`GET /condition-tags` greška se na frontu tiho guta (ako endpoint padne,
"Brzo dodavanje" chip-ovi na "Dodatni parametri" ekranu prosto nestanu, bez
error poruke dispečeru). Ako nam dispečeri prijave da chip-ovi fale, prvo
mjesto za proveru je taj endpoint.
