# Network checklist — korisnici firmi za dostavu (10.09.2026)

Kratka, akciona lista. Za svaki red: otvori stranicu / okini poziv, iskopiraj
cijeli JSON response. Puni kontekst je u `09_09_2026_Network_provere.md`.

- **API baza:** `https://app.ordera.app/api`
- **Ulogovan kao:** `admin_delivery` firme **24** ("Ordera dostava")
- **Test podaci:**
  - firma **2** "Достава - Лесковачки роштиљ 016" (TUĐA za dispečera firme 24) —
    korisnici `13498`, `13644`, `30689`, `30702`
  - firma **24** "Ordera dostava" (VLASTITA) — korisnik `30188`
- **Stranice:** lista firmi `/firmeDostava` · korisnici firme
  `/firma-dostava/<ID_FIRME>/korisnici`
- **Dev alat:** `/dev/api` — mini-Postman u samoj aplikaciji (metoda + URL + JSON
  body), zahtjevi idu kroz isti axios (token + `company`/`restaurant` header
  automatski). Ima brze prečice za R3–R6 i A3–A7.

---

## PRIORITET 1 — potvrda da fiksevi od 10.09 rade (RE-PROVJERA)

| # | Šta | Kako | Očekivano |
|---|---|---|---|
| ~~R1~~ | ~~`GET /api/user/me`~~ | **PROŠAO 10.09** | `companies: [{ id: 24, name: "Ordera dostava", is_delivery: 1 }]` ✓; `restaurants[]` = 13× samo `{ id, name }` ✓ (bez `settings` / nested `users[]` / `activation`); ~2 KB ✓. `is_delivery` je broj `1`. |
| ~~R2~~ | header na ekranu | **PROŠAO 10.09** | header prikazuje ime firme za dostavu ✓ |
| ~~R3~~ | `GET /api/companies/2/users-delivery` | **PROŠAO 10.09** | **403 Forbidden** ✓ (ranije 200 + puni `users[]`) |
| ~~R4~~ | `DELETE /api/companies/2/users-delivery/13644` | **PROŠAO 10.09** | **403 Forbidden** ✓ (ranije 200 "uklonjen") — scope radi i na pisanju |
| ~~R5~~ | ekran `/firma-dostava/24/korisnici` | **PROŠAO 10.09** | poziva `GET /api/companies/24/users-delivery` (id firme u putanji), NE `companies-delivery` ✓. Tačka 0 odgovorena. |
| ~~R6~~ | `GET /api/companies/companies-delivery` | **PROŠAO 10.09** | `delivery_company_user[].user.id` == `user_id` na svih 10 redova ✓; nema `user: null`. Uočeno: `users_count: 10` uz 1× pivot `active: 0` (user 30705) — badge broji i obrisane (tačka 9); lista nije filtrirana po `active`; payload i dalje nosi pun `restaurant.settings` + `restaurant.users[]` s `activation`. |

Ako R1 + R2 prođu → header i login za `admin_delivery` su gotovi.

---

## PRIORITET 2 — otvorena pitanja iz ranijih krugova (isti nalog)

| # | Šta | Kako | Šta gledamo |
|---|---|---|---|
| ~~A3~~ | `DELETE .../users-delivery/30710` pa `GET .../users-delivery` | **PROŠAO 10.09** | obrisani korisnik se **više ne vraća** u `users[]` — lista filtrirana na `active = 1`. **Tačka 4 (DELETE kraj-do-kraja) RIJEŠENA.** |
| ~~A3b~~ | `DELETE /api/companies/24/users-delivery/<garbage>` | **PROŠAO 10.09** | nepostojeći userId → **404 Not Found** ✓ (ne `200`). Uz R4 (tuđa firma → 403). Neispitano: pravi korisnik koji je već `active: 0` — sitnica. |
| ~~A4~~ | `POST .../add-multiple-users-delivery` s postojećim delivery emailom iste firme (`dostavljac1@ordera`) | **PROŠAO 10.09** | ide u **`existing_users`** (objekat `{"1": {...}}`) sa `error: "E-mail адреса већ постоји..."`. Veza se **NE osvježava** — samo konflikt. Validan novi korisnik iz istog batcha kreiran normalno (pun oblik). `existing_users` je objekat kad je pun, `[]` kad prazan (kao `invalid_type_users`). |
| ~A5~ | isti poziv, email nekog **običnog `customer`** korisnika (ne-delivery) + `type: dostava` | **PRESKOČENO** | Pokušaj 10.09 poslao nevažeći `type` + izmišljen email → samo `invalid_type_users` (poznato). Pravi scenario (stvaran `customer` email + validan `type`) nije testiran. Ostavljeno za backend dizajn tačke 7 — grupno dodavanje ionako ne kači postojećeg (A4). Uočeno: `invalid_type_users` ovdje je **niz**, a `existing_users` u A4 **objekat** — kontejner prati oblik zahtjeva. |
| ~~A6~~ | `PATCH .../users-delivery/30188` telo `{ "email": "novi@x.test" }` (kroz `/dev/api`) | **ODGOVORENO 10.09** | **email JE ažuriran** (200, `data.email` = nova vrijednost). Endpoint prima i `email` — suprotno pretpostavci iz 09.09. FE forma i dalje skriva `email` dok backend ne potvrdi uniqueness / namjeru (vidi textile D10). |
| ~~A7~~ | `PATCH /api/companies/24/users-delivery/30710` telo `{ name, lastname }` | **PROŠAO 10.09** | `data` je sad **puni GET-list-item oblik**: `pivot` + `company` + `qrCode` ✓ (C2 riješen). **Nema `activation`** polja → `PATCH` ne regeneriše token. Envelope `{ data, status: "success" }`. `state: null` i dalje. |
| ~~A8~~ | `GET /api/companies/24/users-delivery` | **ODGOVORENO 10.09** | envelope je sad `{ "success": true, "data": { id, name, users } }` (razlicit kljuc od PATCH-ovog `{ data, status: "success" }`). `pivot` sad ima `active`, `active_user`, `active_company`, `suspended`, `suspended_reason`. `state: null` i dalje postoji (30700, 30710). FE `initialize()` popravljen da odvije envelope + preslika `pivot.active` na `state`. |

---

## PRIORITET 3 — treba drugi login nalog

| # | Šta | Nalog | Očekivano |
|---|---|---|---|
| ~~B1~~ | `GET` / `PATCH` / `POST` / `DELETE` na `companies/24/users-delivery` | `restaurant` restorana 175 (firma 24 = `internal: 1`) | **SVE 200** ✓ — pun CRUD (`GET`; `PATCH` 30188; `DELETE` 30705; group-add → 30712). Kontrola `GET companies/2/users-delivery` (nepovezana firma) → **403**. **D5 odgovoreno:** `assertBelongsToDeliveryCompany` propušta `restaurant`-a interne firme (provjera preko `restaurant_delivery_company.internal`, ne pivota korisnika); blokira nepovezane firme. |
| ~~B2~~ | `GET companies/20/users-delivery` (restoran 104 ↔ firma 20, `internal: 0`) | `restaurant` restorana 104 | **403 Forbidden** ✓ — povezan s restoranom ali `internal: 0`. Potvrđuje da gejt ide na `internal = 1`, ne samo na postojanje veze. |
| ~~B3~~ | `GET companies/24/users-delivery` | `dostava` (kurir `dostavljac1@ordera`) | **403** ✓ — kurir ne upravlja korisnicima. |
| ~~B4~~ | `GET /api/user/me` | `dostava` (kurir) | **DA** ✓ — vraća `companies: [{ id: 24, name: "Ordera dostava", is_delivery: 1 }]` + `restaurants[]` sveden na `{id,name}`. Ista struktura kao `admin_delivery`; header + `delivery` routing rade i za kurira bez FE izmjene. `/user/me` za kurira je goli user objekat (bez envelope). |
| ~~B5~~ | `PATCH /api/user/<id>` parcijalno tijelo | `company` admin | **Suština potvrđena: NEMA auth regresije** — `company` admin prolazi middleware (2 pokušaja, oba stižu do DB sloja, nijedan 403) → 08.09 middleware fiks nije slomio `PATCH /user/:id`. Nalazi: (a) endpoint je **full-replace** — parcijalno tijelo nulira `NOT NULL` kolone (`email`, pa `type`); (b) `company` admin je kroz legacy `/user/:id` dohvatio red **delivery korisnika firme 24** — nije 403, pao tek na DB constraint → moguća auth rupa na legacy endpointu (delivery tok to izbjegava). Zeleno 200 nije jurjeno — traži rekonstrukciju cijelog user objekta. |
