# `/dispatcher/company` — analiza i predlog dizajna

Interaktivni mockup (isti sadržaj, klikabilan, svijetla i tamna tema, mobilni prikaz):
[`dispatcher-company-mockup.html`](./dispatcher-company-mockup.html)

## 0. Šta je analizirano i šta nedostaje

Repo `somi93/claudekurir` sadrži samo konfiguraciju i dokumentaciju. **Izvorni kod aplikacije
(`app/`, `pages/`, `components/`) nije u repou**, pa tekuću implementaciju stranice nisam mogao
pročitati. Analiza je rađena iz ovoga:

| Izvor | Šta daje |
|---|---|
| `nuxt.config.ts` | Vuetify tema `delivery`, defaults (`VBtn` pill, `VCard` `rounded: lg`, `elevation: 0`, outlined polja), Reverb/WS, i18n |
| `network-provjera.md` | Tačna struktura stranice: 4 taba i svi API pozivi po tabu (sekcije 3–6) |
| `network-provjera-backend.md`, `*_Network_checklist*.md` | Stvarni oblik odgovora, otvoreni bugovi i pitanja (npr. 1.5, 2.8, D.5) |
| `companies-delivery.json` | Cijeli model firme: finansijska pravila, dodjela narudžbi, odgovornost, veze sa restoranima |
| Redmine screenshot (#223652) | Specifikacija dodjele narudžbi (`assignment_*`, `offer_timeout_seconds`) i tamni UI već korišten za taj ekran |

Gdje nešto zaključujem iz dokumentacije, a ne iz koda, to je naznačeno kao **pretpostavka**.
Prije implementacije treba proći stvarni kod stranice i uporediti sa sekcijom 2.

## 1. Šta stranica danas radi (rekonstrukcija)

Stranica ima četiri taba i radi nad firmom izabranom u sidebaru (`{companyId}`).

| Tab | Endpointi | Akcije |
|---|---|---|
| **Kase kurira** | `GET …/couriers-balance`, `GET …/cash-handovers` | „Primio sam gotovinu" (`POST /dispatcher/couriers/{id}/cash-receipt`), „Isplati zaradu" (`POST /couriers/{id}/payout`), pregled predaja |
| **Kuriri** | `GET …/couriers-status`, `PATCH`/`POST …/couriers[/{id}]` | Dodaj, izmijeni, „Detalji kurira" |
| **Saradnja sa restoranima** | `GET /dispatcher/{companyId}/restaurants` | Lista veza firma–restoran |
| **Finansijske postavke** | `GET/PATCH …/finance-settings` | Limit gotovine, provizija, isplata, dodjela narudžbi, prikaz cijene |

## 2. Problemi koje dizajn treba da riješi

**Informaciona arhitektura**

1. Ulaz na stranicu je jedan od taba, ne sažetak. Dispečer mora otvoriti „Kase kurira" da vidi da li
   neko krši limit gotovine. Nema mjesta koje kaže „šta je danas hitno".
2. „Finansijske postavke" miješa tri nepovezane stvari: novac (limit, isplata), operativu (dodjela
   narudžbi) i ono što vidi kupac (`show_price_breakdown`). Naziv taba ne pokriva dodjelu narudžbi.
3. Kurir i njegov novac žive u dva taba. Dispečer koji gleda kurira u „Kuriri" ne vidi koliko duguje,
   a u „Kase kurira" ne vidi da li je online ili suspendovan.
4. Postoji i zasebna stranica `/dispatcher/couriers` (dokument 09.09), a tab „Kuriri" ovdje radi isto.
   **Pretpostavka:** treba odlučiti ostaje li jedna od njih. Predlog: tab ovdje je jedino mjesto.

**Podaci koje backend vraća, a UI ih mora podnijeti**

| Nalaz | Posljedica za UI |
|---|---|
| `couriers-status` vraća i dispečere (`admin_delivery`), red nema `type` (checklist 1.5) | Filtrirati po `courier_id` iz `couriers-balance` dok backend ne doda `type`; ne prikazivati dispečera kao kurira |
| `cash_owed_to_company` može biti negativan (viđeno −19.2) | Prikazati kao „viška", zeleno, ne kao negativan dug |
| `couriers-balance` nema `currency` (2.7, 2.8) | Valuta iz `finance-settings.available_currencies` i izabrane firme; prikazati jednom u zaglavlju |
| `couriers-balance` nema `link_active` | Kurir sa dugom koji je suspendovan mora ostati vidljiv (D.5); nikad ne sakrivati red samo zato što nije aktivan |
| `courier-locations` `search` hvata samo ime i telefon, ne ID | Pretraga klijentska po `#ID` + server po imenu/telefonu |
| `POST …/couriers` sa `motorbike` može dati 500 (D.4) | Greška se prikazuje u formi sa porukom, ne kao prazan toast; ponuditi ostala vozila |
| `method` kod isplate je možda enum, možda slobodan tekst (A.5) | Select sa tri vrijednosti dok se ne potvrdi; 422 mapirati na polje |
| `GET /dispatcher/{id}/restaurants` može vraćati `status: 0` (D.6) | Filter Aktivni / Čeka odgovor / Pauzirani, podrazumijevano „Svi" sa vidljivim statusom |
| `PATCH` odgovor je pun red kurira, `email` nikad nije `null` u viđenim podacima | Osvježiti red iz odgovora, bez novog `GET` |
| `show_price_breakdown` mijenja ono što kupac vidi odmah | Prikazati pregled „Kupac vidi" uz prekidač |

**Dizajn i interakcija**

- Novac je glavna tema stranice, a nigdje nije prikazan u odnosu na limit. Dispečer uspoređuje
  brojeve u glavi (214,40 naspram 200).
- Radnje nad kurirom („Primio sam gotovinu", „Isplati") traže da se prvo izabere kurir, pa tek onda
  radnja. Bez pregleda posljedice (koliko ostaje dugovanja) lako je pogriješiti u iznosu.
- Postavke dodjele narudžbi imaju zavisna polja (broj kurira samo za `TOP_N`, akcija po isteku samo
  za `NEAREST`/`TOP_N`). Ako su sva prikazana odjednom, ekran izgleda kao da sve važi svuda.

## 3. Predlog

### 3.1 Struktura

```
Zaglavlje firme (naziv, status, valuta, pravila u jednom redu, [Postavke] [Dodaj kurira])
Traka sa 4 broja (gotovina kod kurira · dugujemo kuririma · online · čeka potvrdu)
Tabovi: Pregled · Kuriri · Kase kurira · Saradnja sa restoranima · Postavke
```

Najveća promjena: **novi tab „Pregled" kao ulaz**, i **„Finansijske postavke" postaju „Postavke"**
sa pet jasnih sekcija. Nazivi ostalih tabova se čuvaju jer ih dispečeri već koriste.

### 3.2 Tabovi

**Pregled** (novo, računa se iz poziva koji se ionako rade)
- „Traži vašu pažnju": kurir iznad limita, prijava predaje koja čeka, suspendovan kurir sa dugom,
  kurir na 85% limita. Svaka stavka ima jednu radnju (Primi gotovinu, Pregledaj, Otvori).
  Prazno stanje: „Sve je u redu."
- Raspodjela kurira po statusu (traka + brojevi).
- Novac: kuriri duguju firmi, firma duguje kuririma, viškovi uplate, neto za izravnanje.
- Pravila koja važe, sa linkom na Postavke. Dispečer ne mora otvarati postavke da zna da je limit
  200 KM i blokira.

**Kuriri**
- Pretraga + filter čipovi sa brojačima: Svi, Online, Offline, Sa dugom, Suspendovani.
- Red: kurir (avatar, ime, telefon, #ID), vozilo, status, **gotovina prema limitu** (mjerač sa
  oznakom limita), iznos koji firma duguje.
- Klik na red otvara **panel sa strane** (ne novu stranicu): oba iznosa, mjerač, posljednje
  aktivnosti, radnje Primio sam gotovinu / Isplati zaradu / Izmijeni / Suspenduj.
- Mobilni: svaki red postaje kartica, mjerač ostaje.

**Kase kurira**
- Lijevo: kuriri sortirani po dugu (najveći prvi), radnje u samom redu. Dugmad su onemogućena kad
  nema šta primiti ili isplatiti.
- Desno: „Prijave predaje gotovine" (čekaju potvrdu prve, dugme „Potvrdi 100,00 KM" jednim klikom
  i „Drugi iznos") i „Posljednje isplate".
- Svaki dijalog (primitak, isplata) ima **izračun uživo**: `214,40 KM → 0,00 KM`, prečice „Cijeli
  iznos" / „Pola", validaciju (iznos veći od duga se odbija) i napomenu.

**Saradnja sa restoranima**
- Kartice umjesto tabele, jer je sadržaj opisan (obračun, ko plaća dostavu, naknada) a ne
  numerički. Status: Aktivna saradnja / Čeka odgovor restorana / Pauzirana (iz `active_company`,
  `active_restoran`, `status`, razlozi suspenzije).
- Radnja po statusu: Pauziraj, Aktiviraj, Povuci poziv. Pauziranje traži razlog
  (`suspension_reason_by_company`).
- Mapiranje polja: `settlement_route: VIA_ORDERA` → „Preko Ordere", `delivery_fee_payer: CUSTOMER`
  → „Dostavu plaća kupac", `paying` → naknada. **Pretpostavka:** značenje `paying_type` (1) treba
  potvrditi sa backendom prije nego što se prikaže kao „fiksno" ili „procenat".

**Postavke** (jedna stranica, sticky navigacija sekcija, jedna traka za čuvanje)

| Sekcija | Polja |
|---|---|
| Profil firme | naziv, kontakt osoba, telefon, e-mail, JIB, PIB |
| Dodjela narudžbi | `assignment_mode` (kartice za izbor), `assignment_courier_count` (samo `TOP_N`, 1–50), `offer_timeout_seconds` (5–120), `assignment_timeout_action` (samo ne-`ALL`), `assignment_courier_pool` |
| Gotovina i isplate | `cash_limit_amount`, `cash_limit_enforcement` (Samo obavijesti / Blokiraj), `payout_period_days`, `daily_handover_time`, `commission_percentage`, valuta |
| Prikaz cijene | `show_price_breakdown` prekidač + dva pregleda „Kupac vidi" |
| Odgovornost | `liability_customer_fault`, `liability_courier_fault`, broj i datum ugovora |

- Zavisna polja se pojavljuju tek kad su relevantna (specifikacija iz Redmine #223652).
- Traka „Imate nesačuvane izmjene" sa Odbaci / Sačuvaj pojavljuje se samo kad se nešto promijenilo.
- Zastarjela vrijednost `BEST_MATCH` se ne nudi kao opcija (po specifikaciji), ali se ne smije
  slomiti ako dođe iz podataka: prikazati je kao „Zastarjelo podešavanje" dok se ne izabere nova.

### 3.3 Vizuelni jezik

Preuzet iz teme `delivery`, bez novih boja:

| Uloga | Vrijednost | Upotreba |
|---|---|---|
| Pozadina / površina | `#f5f6f8` / `#ffffff` | Stranica / kartice |
| Primarna (tamna) | `#0b1220` | Glavno dugme, aktivni filter, naslovi |
| Sekundarna (plava) | `#2f6fed` | Fokus, „Na dostavi", mjerač u normali |
| Akcenat (zelena) | `#00b37e` | Online, aktivan, prekidač uključen, višak uplate |
| Brend (žuta) | `#ffc247` | Mjerač blizu limita, „Isplati zaradu", traka za čuvanje |
| Greška | `#ef4444` | Iznad limita, suspendovan, suspenduj |
| Ivica | `#e7e9ee` | 1px ivice kartica, bez sjene |

- Oblici kao u `defaults`: dugmad i čipovi pill, kartice radijus 8 px bez elevacije, polja outlined.
- Font ostaje Roboto (Vuetify podrazumijevani), brojevi sa `tabular-nums` da se iznosi poravnaju.
- **Stanje se kodira oblikom, ne samo bojom:** pill sa tačkom i tekstom, mjerač sa vidljivom
  oznakom limita, ikona uz stavke koje traže pažnju.
- Tamna tema: tokeni su definisani i za tamnu temu (Redmine screenshot pokazuje da je dispečerski
  ekran postavki već viđen tamno). Glavno dugme se u tamnoj temi obrće (svijetlo na tamnom).
- Pristupačnost: fokus prsten na svim kontrolama, radio kartice zadržavaju tastaturni fokus,
  dijalozi se zatvaraju sa Esc i vraćaju fokus, `prefers-reduced-motion` poštovan.

## 4. Primjena u Vuetify-u

| Mockup | Vuetify komponenta |
|---|---|
| Tabovi | `VTabs` + `VWindow` (hash u URL-u: `#kuriri`) |
| Traka sa brojevima | `VCard` sa `VRow`/`VCol`, bez `VCardTitle` |
| Red kurira | `VDataTable` ili `VList` sa gridom; na `xs` kartice |
| Panel sa strane | `VNavigationDrawer location="right" temporary` (na mobilnom `VBottomSheet`) |
| Dijalozi primitka/isplate | `VDialog` sa `VForm`, validacija pravilima |
| Čipovi filtera | `VChipGroup` sa brojačima |
| Mjerač gotovine | mala komponenta `CashMeter.vue` (`VProgressLinear` sa oznakom limita) |
| Postavke | `VCard` po sekciji, `VRadioGroup` sa karticama, `VSwitch`, `VSnackbar` za čuvanje |
| Nesačuvane izmjene | `VSystemBar`/sticky `VCard` na dnu |

Predložene zajedničke komponente: `CashMeter`, `CourierStatusPill`, `MoneyAmount` (format `214,40 KM`,
negativno kao „viška"), `AttentionList`, `SettingsSection`. `GlobalTextField`/`GlobalSelect` se
koriste svuda gdje danas postoje.

## 5. Izvedba i stanja

- **Učitavanje:** Pregled koristi iste pozive kao tabovi (`couriers-status`, `couriers-balance`,
  `cash-handovers`, `restaurants`, `finance-settings`), pa se učitavaju jednom u zajednički store
  (Pinia) i dijele između tabova. Skeleton umjesto spinnera.
- **Sinhronizacija:** nakon `cash-receipt` / `payout` ponovo učitati samo `couriers-balance` i
  `cash-handovers` (ne cijelu stranicu). Reverb kanal firme može kasnije zamijeniti ručno osvježavanje.
- **Prazna stanja:** svaka lista ima tekst koji kaže šta će se pojaviti i kako dodati prvu stavku.
- **Greške:** 403 (firma nije vaša) → cijela stranica sa objašnjenjem; 422 → uz polje; 500 → traka
  u dijalogu sa „Pokušaj ponovo", forma ostaje popunjena.
- **Pregled „Traži pažnju" se računa na klijentu** iz podataka koji već stižu; ne traži novi endpoint.
  Prag „blizu limita" (85%) je konstanta koju treba potvrditi sa dispečerima.

## 6. Redoslijed implementacije

1. Zajednički store i komponente (`MoneyAmount`, `CashMeter`, `CourierStatusPill`).
2. Kuriri + panel sa strane (zamjenjuje „Detalji kurira").
3. Kase kurira sa dijalozima i izračunom uživo.
4. Pregled (zavisi od 2 i 3).
5. Postavke: podjela na sekcije, zavisna polja, traka za čuvanje.
6. Saradnja sa restoranima (kartice, pauziranje sa razlogom).
7. Mobilni prolaz, tamna tema, pristupačnost.

## 7. Otvorena pitanja

1. Gdje je izvorni kod stranice? Treba ga dodati u repo da bi se predlog mapirao na stvarne komponente.
2. Ostaje li `/dispatcher/couriers` kao zasebna stranica, ili se ukida u korist taba?
3. Backend: `type` u `couriers-status` (1.5), `currency` u `couriers-balance`, `link_active` (2.8).
4. Značenje `paying_type` i `paying` kod veze sa restoranom.
5. Dozvoljene vrijednosti za `liability_*` (viđene samo `PLATFORM` i `DELIVERY_COMPANY`).
6. Je li `method` kod isplate enum, i koje vrijednosti.
7. Može li dispečer suspendovati/aktivirati kurira iz ovog taba (postoji `suspended`/`suspended_reason`
   na pivotu), i postoji li za to endpoint.
8. Aktivnosti kurira u panelu (posljednje narudžbe, predaje, isplate): treba izvor podataka ili se izostavlja.
