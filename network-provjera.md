# Network provjera — šta skinuti umjesto da pitamo backend

Lični fajl (dodaj u `.gitignore` ako ne želiš da se commituje).
Prati stavke iz `docs/2026/08/29_08_2026_Frontend_pitanja_za_backend.textile`.

**API base:** `https://api.kurir.ordera.app/api`
**Kako:** DevTools → Network → filter **Fetch/XHR** → uključi **Preserve log** → otvori stranicu → desni klik na poziv → *Copy → Copy response* (ili *Save all as HAR* za cijelu stranicu).
**Zamjene:** `{courierId}` = ID prijavljenog kurira · `{companyId}` = izabrana firma u sidebaru.

---

## 1. `/courier/earnings` — prijavljen kao KURIR

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /couriers/{courierId}/earnings` | **A.1** 🔴 | Je li odgovor još `{ success, data: [ {id,date,hours_online,deliveries,earnings} ] }` ili novi oblik sa `daily_breakdown` + `current_week` + `previous_week`. Ako je novo — kopiraj cijeli JSON, treba mi tačan naziv svakog polja + tipovi. |

---

## 2. `/courier/wallet` — prijavljen kao KURIR

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /couriers/{courierId}/wallet-balance` | kontekst | Ima li `currency` polje (očekujem da nema). Je li `success` uvijek prisutan. |
| `GET /couriers/{courierId}/cash-handovers` | **A.2** 🟡 | Wrapper `{success,data:[]}` ili goli niz? Nazivi polja, `status` vrijednosti (`pending`/`confirmed`/?), je li sortirano najnovije-prvo, jesu li `confirmed_amount`/`confirmed_at` `null` dok nije potvrđeno, je li iznos string (`"50.00"`). Treba primjer sa bar jednom `pending` i jednom `confirmed` stavkom. |
| `GET /couriers/{courierId}/payouts` | **A.6** 🟡 | Nazivi polja, `amount` string?, `created_at` format (`"2026-08-23 11:03:55"` bez `Z`/offseta?). Treba bar jedna stavka. |
| `GET /couriers/{courierId}/earnings` | **A.1** 🔴 | (isto kao #1 — fira i ovdje za „Ova sedmica" karticu) |
| `POST /cash-handovers/report` | **A.3** 🟡 | Klikni „Prijavi predaju gotovine", unesi iznos, pošalji. Kopiraj **request body** i **response**. Vraća li kreiranu stavku (`id`, `status:"pending"`) ili samo `{success:true}`. Pa osvježi — pojavi li se odmah u `cash-handovers` listi kao `pending`. |

---

## 3. `/dispatcher/company` → tab „Kase kurira" — prijavljen kao DISPEČER

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /dispatcher/delivery-companies/{companyId}/couriers-balance` | **D.5** 🟡 / kontekst | Ima li `currency`. Ako u firmi postoji **suspendovan kurir sa dugom** — pojavljuje li se u ovoj listi. |
| `GET /dispatcher/delivery-companies/{companyId}/cash-handovers` | **A.2** 🟡 | (dispečerska varijanta iste stvari kao 2/A.2) — promijeni filter datuma da se pozove. Nazivi polja, primjer `pending` + `confirmed`. |
| `POST /dispatcher/couriers/{courierId}/cash-receipt` | **A.4** 🟡 | „Detalji kurira" → „Primio sam gotovinu". Kopiraj request body + response. Pa provjeri `couriers-balance` — je li `cash_owed_to_company` pao odmah. |
| `POST /couriers/{courierId}/payout` | **A.5** 🟡 | „Detalji kurira" → „Isplati zaradu". Request body + response. Je li `wage_owed_to_courier` pao. Za `method`: probaj poslati `"bankovni transfer"` — prolazi ili 422 (enum vs slobodan tekst). |

---

## 4. `/dispatcher/company` → tab „Kuriri" — DISPEČER

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /dispatcher/delivery-companies/{companyId}/couriers-status` | **D.2** 🟠 | Vraća li `contact_phone` / `bank_account` po kuriru (očekujem da NE). |
| `PATCH /dispatcher/delivery-companies/{companyId}/couriers/{courierId}` | **D.2** 🟠 | Izmijeni kurira, sačuvaj. Vraća li odgovor `contact_phone` / `bank_account` nazad. |
| `POST /dispatcher/delivery-companies/{companyId}/couriers` | **D.4** 🟡 | „Dodaj kurira" sa **vozilo = Motor** (`vehicle_type: "motorbike"`). Prolazi (200/201) ili puca 500 (`Data truncated for column 'type'`). Usput probaj i „Skuter". |

---

## 5. `/dispatcher/company` → tab „Saradnja sa restoranima" — DISPEČER

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /dispatcher/{companyId}/restaurants` | **D.6** 🟡 | Bez ikakvih query parametara — pojavljuju li se redovi sa `status: 0` (neaktivni), ili samo `status: 1`. |

---

## 6. `/dispatcher/company` → tab „Finansijske postavke" — DISPEČER

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /dispatcher/delivery-companies/{companyId}/finance-settings` | kontekst (C) | Potvrdi da NEMA `currency` polja ovdje (da znamo da valuta ne živi na finance-settings). |

---

## 7. `/dispatcher/assignment` — DISPEČER

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /dispatcher/orders/pending-restaurant-confirmation?delivery_company_id={companyId}` | **B.1** 🟠 | **Kopiraj cijeli odgovor.** Gledam: `restaurant_phone` (može `null`? format?), koje vrijednosti `delivery_type` stvarno stižu (ima li `2`?), `location` — prazan `{}`, `null`, ili pun objekat (isti oblik kao `orders/waiting`?), `delivery_time` format (onaj `.0000002` na kraju — je li stvarno `Z`), ima li paginacije/`meta`. |
| ↑ ista lista | **B.2** 🟡 | Ima li narudžbi sa `ordered_at` iz 2024/2025 (potvrda da je prozor neograničen). |
| ↑ + `GET /dispatcher/orders/waiting?delivery_company_id={companyId}` | **B.3** 🟡 | Uporedi `id`-eve iz obje liste — ima li iste narudžbe u obje. |
| `GET /dispatcher/orders/waiting?delivery_company_id={companyId}` | **D.1** 🔴 | Uzmi jednu narudžbu, pogledaj `ordered_at` i `delivery_time`: `"...T15:17:13.000000Z"` / `"...T13:17:13Z"` / `"...+02:00"` — i uporedi cifre sa stvarnim vremenom kad je napravljena. |
| ↑ ista | **D.3** 🟠 | `waiting_minutes` i `minutes_until_delivery` — poklapaju li se sa stvarnim satom (poslije tz ispravke od 28.08). |

---

## 8. `/dispatcher/pricing` — DISPEČER

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /delivery-companies/{companyId}/pricing` | **C.3** 🟢 | Vrijednost `currency` polja: `"KM"` (prikazni string) ili `"BAM"` (ISO kod). |

---

## 9. Bootstrap — bilo koja stranica (fira na login/refresh)

| Endpoint | Doc | Šta gledaš |
|---|---|---|
| `GET /me` | **C.1** 🟢 | Cijeli odgovor. Ima li ikakav objekat firme (`delivery_company`, `company`, …). Očekujem da nema — potvrda da polje treba dodati. |
| `GET /dispatcher/my-companies` | **C.2** 🟢 | Ima li `currency` po redu. Kopiraj jedan red. |

---

## 10. Ručne probe (ne fira ih nijedna stranica — pozovi direktno, npr. iz konzole ili Postman-a sa svojim tokenom)

| Poziv | Doc | Šta gledaš |
|---|---|---|
| `GET /dispatcher/delivery-companies/{companyId}/couriers/{courierId}` | **D.2** 🟠 | Postoji li ta ruta (200 sa detaljem kurira) ili 404. |
| `GET /couriers/{TUĐI_courierId}/payouts` (kao kurir A, tuđi ID) | **A.7** 🟡 | Vraća 403 (dobro) ili tuđe podatke (loše). Isto za `/cash-handovers`, `/wallet-balance`, `/earnings`. **Samo na test nalozima.** |
| `GET /couriers/{courierId}/payouts?from=2026-08-01&to=2026-08-31` | **A.6** 🟡 | Rade li `from`/`to` filteri, po kom polju filtriraju. |

---

## Rezime — koje doc stavke ova provjera zatvara

| Doc | Zatvara se ako pošalješ |
|---|---|
| **A.1** 🔴 | JSON od `GET /couriers/{id}/earnings` |
| **A.2** 🟡 | `GET .../cash-handovers` (kurirski + dispečerski), po jedan `pending`+`confirmed` |
| **A.3** 🟡 | request+response od `POST /cash-handovers/report` |
| **A.4** 🟡 | request+response od `POST .../cash-receipt` + balans prije/poslije |
| **A.5** 🟡 | request+response od `POST /couriers/{id}/payout` + balans prije/poslije + test `method` |
| **A.6** 🟡 | JSON od `GET /couriers/{id}/payouts` (+ test filtera) — ostaje samo pitanje dispečerskog agregata |
| **A.7** 🟡 | rezultat ručne probe tuđeg ID-a |
| **B.1** 🟠 | cijeli JSON od `pending-restaurant-confirmation` |
| **B.2 / B.3** 🟡 | ista lista + `orders/waiting` (poređenje ID-eva, stari datumi) |
| **C.1 / C.2 / C.3** 🟢 | `GET /me`, `GET /dispatcher/my-companies`, `currency` iz `/pricing` |
| **D.1** 🔴 | jedan `ordered_at` iz bilo kog odgovora + stvarno vrijeme |
| **D.2** 🟠 | `couriers-status` + `PATCH` odgovor + proba `GET .../couriers/{id}` |
| **D.3** 🟠 | `waiting_minutes` / `minutes_until_delivery` vs sat |
| **D.4** 🟡 | rezultat kreiranja kurira sa `motorbike` |
| **D.5** 🟡 | `couriers-balance` kad postoji suspendovan kurir sa dugom |
| **D.6** 🟡 | `GET /dispatcher/{companyId}/restaurants` bez parametara |

Ostaje čisto za backend: **A.6** (dio — dispečerski agregat), **B.2/B.4** (namjera/plan), **C.1/C.2** (sam zahtjev za polje), **D.7** (push).
