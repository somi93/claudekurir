# Pitanja i status za backend tim (16. avgust 2026)

Kontekst: pri testiranju "Vozila i pravila" ekrana naišli smo na 404 na
`vehicle-rules/{id}` (sekcija 1). Umesto da prijavimo samo taj jedan slučaj,
iskoristili smo priliku da prođemo kroz ceo frontend projekat i popišemo sve
što je za vas — potvrđen bag, veliki nepotvrđen API sloj (restoranski
finansijski deo), par stvari koje nam deluju kao duplikat, i podsetnik na
staro. Dokument je gušći od 15.08 verzije jer pokriva mnogo širi presek
projekta, ne samo ono što je rađeno "danas".

---

## 1. Hitno — ruta `vehicle-rules/{id}` ne postoji (404, ne 405)

Klik na brisanje/izmenu pravila u "Vozila i pravila" tabu (Cenovnik ekran)
vraća:

```json
{
    "message": "The route api/vehicle-rules/5 could not be found.",
    "exception": "Symfony\\Component\\HttpKernel\\Exception\\NotFoundHttpException",
    "file": "/var/www/kurir/htdocs/web-dostavljaci/vendor/laravel/framework/src/Illuminate/Routing/AbstractRouteCollection.php",
    "line": 44
}
```

Frontend zove:

- `PUT /vehicle-rules/{id}` (izmena — koristi se i za redosled/priority pri
  strelicama gore/dole, i za samu izmenu pravila)
- `DELETE /vehicle-rules/{id}` (brisanje)

Ovo je **"route not found"**, ne "method not allowed" — znači da URI oblik
`vehicle-rules/{id}` uopšte ne postoji u vašoj rutnoj tabeli, bez obzira na
HTTP metod. `GET`/`POST .../delivery-companies/{id}/vehicle-rules` (lista i
kreiranje) rade — samo pojedinačni resurs (`{id}` bez `delivery-companies`
prefiksa) ne postoji.

**Molimo:** koji je tačan oblik rute za izmenu/brisanje pojedinačnog pravila?
Pretpostavljamo da je verovatno ugnježdeno, isto kao lista/kreiranje —
`PUT/DELETE /delivery-companies/{companyId}/vehicle-rules/{ruleId}` — ali
tražimo potvrdu pre nego što menjamo poziv.

---

## 2. Isti "flat `/{resurs}/{id}`" obrazac za izmenu/brisanje je pretpostavljen na još 5 mesta

Pošto se gornji bag pokazao kao pogrešna pretpostavka o obliku rute, a ne
izolovan slučaj, proveravamo: da li je isti obrazac (kreiranje ugnježdeno pod
`/restaurants/{id}/...`, ali izmena/brisanje pojedinačnog resursa kao "flat"
`/{resurs}/{id}` bez `restaurants/{id}` prefiksa) tačan i za ove pozive, ili
su i oni pogrešni na isti način:

| Feature (ekran) | Kreiranje (radi, potvrđeno GET-om) | Izmena/brisanje (nepotvrđeno) |
|---|---|---|
| Provizije (`commissions.vue`) | `POST /restaurants/{id}/commissions` | `PUT/DELETE /commissions/{id}` |
| Uplate restorana (`restaurant-deposits.vue`) | `POST /restaurants/{id}/deposits` | `PUT/DELETE /deposits/{id}` |
| Promocije (`promotions.vue`) | `POST /restaurants/{id}/promotions` | `PUT/DELETE /promotions/{id}` |
| Refundacije (`refunds.vue`) | `POST /restaurants/{id}/refunds` | `PUT/DELETE /refunds/{id}` |
| Plaćanja platformi (`platform-payments.vue`) | — (nema kreiranja) | `PUT /platform-payments/{id}` |

**Molimo:** potvrdite da li je "flat" oblik za izmenu/brisanje tačan za ovih
pet, ili treba svuda `.../restaurants/{restaurantId}/{resurs}/{id}` kao kod
vehicle-rules-a iz sekcije 1. Nijedan od ovih poziva još nije testiran uživo
protiv vašeg servera (razlog — sekcija 3).

---

## 3. Ceo restoranski finansijski deo nema pisanu specifikaciju sa vaše strane

Za "Finansijske postavke" i "Saradnja sa restoranima" (dispečerski "Firma"
ekran) dobili smo `Uputstvo_finansije_i_saradnja_frontend_cirilica.md` sa
tačnim rutama, oblicima odgovora i pravilima (npr. `commission_percentage`
je read-only) — to je implementirano striktno po dokumentu i radi kako je
opisano.

Za **sve ostalo** u restoranskom finansijskom delu (11 ekrana ispod)
**ne postoji ekvivalentan dokument**. Ceo ovaj sloj je izgrađen po analogiji
sa REST konvencijama i imenima ekrana, bez ijedne potvrđene rute:

| Ekran | Pretpostavljena ruta (GET, lista) |
|---|---|
| Finansijski pregled | `GET /restaurants/{id}/financial-overview` |
| Isplate | `GET /restaurants/{id}/payouts` |
| Fakture | `GET /restaurants/{id}/invoices` |
| Transakcije | `GET /restaurants/{id}/transactions` |
| Promet | `GET /restaurants/{id}/turnover` |
| Provizije | `GET /restaurants/{id}/commissions` |
| Promocije | `GET /restaurants/{id}/promotions` |
| Refundacije | `GET /restaurants/{id}/refunds` |
| Knjiga salda | `GET /restaurants/{id}/balance-ledger` |
| Plaćanja platformi | `GET /restaurants/{id}/platform-payments` |
| Uplate restorana | `GET /restaurants/{id}/deposits` |
| Isplate restoranu | `GET /restaurants/{id}/bank-payouts` |

Svi pozivi idu ka pravom `$api` (isti token/refresh mehanizam kao ostatak
aplikacije), **ne** ka mock podacima — ali nijedan nikad nije uspešno pozvan
protiv vašeg servera niti smo dobili primer odgovora, pa ne znamo da li:

- rute uopšte postoje pod ovim imenima,
- oblik odgovora (`{success, data: [...]}`) i imena polja u `data` odgovaraju
  onome što frontend očekuje (modeli/mapiranje su takođe pretpostavka),
- `financial-overview`, `turnover` i `balance-ledger` (komentar u kodu kaže
  "nema svoju tabelu, samo GET, izvedeno iz drugih") uopšte postoje kao zaseban
  endpoint ili treba da ih frontend sam izračuna iz ostalih poziva.

**Molimo:** ili pošaljite dokument istog tipa kao
`Uputstvo_finansije_i_saradnja` za ovih 11 ekrana, ili recite koji od njih
uopšte postoje na backend-u danas — da znamo šta prioritetno testirati kad
dobijemo pristup, umesto da pretpostavljamo dalje.

---

## 4. Dva para ekrana koja nam deluju kao duplikat

Dok smo popisivali sekciju 3, primetili smo da imena/opisi zvuče kao da
opisuju istu stvar dva puta:

- **"Isplate"** (`/restaurant/payouts`, `payouts` endpoint) — "Isplate ka
  restoranu", naspram **"Isplate restoranu"** (`/restaurant/restaurant-payouts`,
  `bank-payouts` endpoint) — "Isplate koje prima restoran". Ovo su dve
  odvojene stranice sa gotovo identičnim izgledom (isti filter po periodu i
  statusu), samo drugi endpoint.
- **"Uplate restorana"** (`/restaurant/restaurant-deposits`, `deposits`
  endpoint) — "Uplate koje šalje restoran", naspram **"Plaćanja platformi"**
  (`/restaurant/platform-payments`, `platform-payments` endpoint) — "Uplate
  prema platformi".

**Molimo:** da li su ovo stvarno dva različita toka podataka (npr. jedan je
"knjiženo" stanje a drugi "stvarni bankovni transfer" status), ili je ovo
frontend pri brzoj izradi napravio dva ekrana za istu stvar? Ako su stvarno
različiti, koja je tačna razlika — to će nam pomoći da popravimo nazive/opise
da dispečeru/restoranu bude jasnije na ekranu.

---

## 5. `delivery_company_id` na `active-deliveries` i `refused` — pretpostavljeno po analogiji

"Dodela narudžbi" ekran (dispečer) sad zove tri sestrinska poziva paralelno:

- `GET /dispatcher/orders/waiting` — `delivery_company_id` kao query parametar,
  **potvrđeno** (postojeći, već korišćen poziv).
- `GET /dispatcher/orders/active-deliveries` — isti `delivery_company_id`
  parametar, **pretpostavljeno po analogiji**, nikad eksplicitno potvrđeno.
- `GET /dispatcher/orders/refused` — isto, pretpostavljeno po analogiji.

**Molimo:** potvrdite da ova dva poslednja endpointa zaista postoje i
prihvataju isti `delivery_company_id` parametar kao `orders/waiting`.

---

## 6. Sitne mock akcije — samo status, ne traži hitnu akciju

Za razliku od sekcije 3 (gde su GET pozivi realni, samo nepotvrđeni), ovo su
akcije koje su **svesno i eksplicitno** ostavljene kao mock (dugme radi,
prikazuje poruku "još nije povezano na backend", ne zove nikakav endpoint):

- `export.vue` (Izvoz PDF/Excel/CSV) — cela stranica je mock, nema
  backend akcije za generisanje izveštaja.
- Excel/CSV/PDF dugmad na "Transakcije" ekranu.
- "Poveži banku" i otpremanje dokaza o uplati na "Plaćanja platformi" ekranu.
- PDF dugmad na detaljima fakture, isplate i "Isplate restoranu".

Ovo je namerno tako (ne bag) — evidentiramo ih samo da postoji jedno mesto
gde piše šta je stvarno vezano, a šta ne, kad budete birali prioritet.

---

## 7. Podsetnik — otvoreno iz 15.08 dokumenta

Ne ponavljamo pun kontekst (vidi `Frontend_pitanja_za_backend_15_avgust.md`),
samo linija po stavka da ne ispadnu iz vidokruga:

- **3.1** — Kurir bez registrovanog vozila: šta vraća `GET /couriers/:id` i
  šta se šalje na `PUT` kad kurir još nije izabrao vozilo? Još nepotvrđeno.
- **3.2** — `GET /condition-tags` oblik odgovora nikad testiran uživo protiv
  vašeg servera. Ako dispečeri prijave da "Brzo dodavanje" chip-ovi fale na
  "Dodatni parametri" ekranu, ovo je prvo mesto za proveru (greška se tiho
  guta).
- **3.4** — Da li postoji (ili ima smisla dodati) `GET /cities`? Dispečer i
  dalje ručno kuca ID grada bez provere pri kreiranju zone.
- Notifikacija kuriru posle "Pošalji ponudu" — čekalo se potvrda od mobilnog
  tima da li `app.ordera.app` već šalje nešto slično.
- `POST/PUT/DELETE .../delivery-companies/{id}/vehicle-rules` vokabular
  (`bicycle`/`scooter`/`motorbike`/`car`) — i dalje tražimo živ primer sa bar
  dva različita vozila da potvrdimo pre nego što dalje pišemo u tu tabelu
  (ovo je odvojeno od 404 baga u sekciji 1 — čak i kad ruta proradi, sam
  vokabular u payload-u je i dalje nepotvrđen).
- Promena lozinke posle prvog logina — `/change-password` je i dalje prazan
  stub, endpoint na backend-u i dalje ne postoji.
- Sistem popusta za preporučene korisnike — zabeleženo za budućnost, bez
  akcije za sada.
