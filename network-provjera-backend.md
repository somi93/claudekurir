# Network provjera — što mi treba iz DevTools

> **Nalaz 09.09 (deploy je išao djelomično kroz dan, na kraju SVE):** RADE sve četiri —
> 1.1 (`email` u `couriers-status`), 1.2 (lozinka), 1.3 (`courier-locations` ruta + oblik),
> 2.1 (`available_currencies`). Sve provjereno uživo. Ostaju samo sitna pitanja po
> stavkama + frontend prebacivanje "Kuriri uživo" stranice na novi endpoint (1.3).

Baza svih ruta: `{gpsApiBase}` (vidljivo u Network tabu). Otvori DevTools → Network, pa po redu:

| # | Stranica | Endpoint (nađi u Network tabu) | Šta gledam | Rezultat |
|---|----------|-------------------------------|------------|----------|
| 1.3 | `/dispatcher` → klik **Test courier-locations** | `GET /dispatcher/delivery-companies/{id}/courier-locations` | cijeli `data[0]` | ✅ oblik: `{courier_id, name, phone, suspended, vehicle, location:{latitude,longitude,heading,speed,status,updated_at}}` — tip usklađen |
| 1.3 | isto | `GET .../courier-locations?page=1&per_page=5` | `meta` blok | ✅ `{current_page,last_page,per_page,total}` — tip se poklapa; `total:1` (samo kuriri s pozicijom) |
| 1.3 | isto | `GET .../courier-locations?active_within=60` | broj redova | ✅ `data: []` (jedini kurir ima poziciju od 07.09, ispada iz 60 min) — filter po `updated_at` radi |
| 1.3 | isto | `GET .../courier-locations?search=<ID>` vs `?search=<ime>` | hvata li ID | ✅ `search` = **samo ime/telefon** (ID → `[]`, ime → 1). Sidebar zadržava klijentski `#ID` match; molba backendu da doda ID u LIKE (§1.3) |
| 1.1 | `/dispatcher/couriers` | `GET /dispatcher/delivery-companies/{id}/couriers-status` | ima li `email` | ✅ **svih 8 redova ima `email`** (string, nijedan null) — 1.1 deployano |
| **1.5** 🔴 | isto | isto `couriers-status` | **vraća i dispečere** (`admin_delivery`): 30369=ulogovani dispečer, 30700=Test Dispecer2 (`type:"admin_delivery"`), 30188. Red nema `type` polje → front ne može filtrirati. Novo pitanje za backend §1.5 |
| 1.1a | `/dispatcher/couriers` → izmijeni kurira, snimi | `PATCH /dispatcher/delivery-companies/{id}/couriers/{courierId}` | ima li `email` u response | ✅ **ima** (pun `fullCourierRow`, isti oblik kao couriers-status). Ostaje samo: može li `email` biti `null` |
| 2.1 | `/dispatcher/finance` | `GET /dispatcher/delivery-companies/{id}/finance-settings` | sadržaj `available_currencies` | ✅ **`["KM","BAM","EUR","RSD"]`** (pojavilo se u 2. provjeri) — 2.1 deployano |
| 2.7 | bilo koja (fira na load) | `GET /dispatcher/my-companies` | ima li `currency` po redu | ❌ **nema** — red = `{id, name, city_id, city_name}` |
| 2.7 | bilo koja | `GET /me` | ima li `currency` | ❌ **nema** — `/me` = `{id, name, lastname, email, type, must_change_password}` |
| 2.5 | `/courier/earnings` (kurirski login) | `GET /couriers/{id}/earnings` | ima li `hours_online` u `daily[]` | ✅ provjereno 09.09 — `daily[]` = `{date, amount, deliveries}`, **nema `hours_online`**; `data[]` = `{order_id, wage, food_collected, delivery_collected\|null, collected_from_customer, date}`. Poklapa se s frontom, ništa tiho dodano |
| 2.6 | logout → login kao dispečer | `POST /push-tokens` | fira li, koji `kind` | ✅ fira, `{id, user_id, name:"web", token, kind:1}` — dispečer dobija token |
| 2.6 | — | šalje li backend push za 4 događaja + `data.type` | ne provjeravamo (ide kroz SW, ne XHR) → **pitanje za backend** u §2.6 |
| 2.8 | `/dispatcher/finance` (ili gdje se učita balans) | `GET /dispatcher/delivery-companies/{id}/couriers-balance` | ima li `link_active` flag; diff `courier_id` vs couriers-status | ⚠️ red = `{courier_id, name, phone, cash_owed_to_company, wage_owed_to_courier}` — **nema `link_active`**; svih 8 ID-eva = kao couriers-status (nema orphana za test). `cash_owed` može biti negativan (-19.2 viđeno) |
| 2.2 | `/dispatcher/assignment` → "Pošalji ponudu" na narudžbe u raznim stanjima | `POST /orders/{id}/accept` (409) | `order_status` string iz svakog 409 tijela | |

---

## Preostalo za provjeru (kad bude vremena)

Sve gore je odrađeno osim ovoga:

1. ~~**2.5** — kurirski login → `/courier/earnings` → potvrdi da `daily[]` nema `hours_online`~~ ✅ **provjereno 09.09** — nema ga, front usklađen.
2. **2.2** — izazovi 409 na `POST /orders/{id}/accept` za par narudžbi u raznim stanjima (čeka restoran / dodijeljena / isporučena / otkazana), zapiši `order_status` string iz svakog. Nije hitno — front ima heuristiku.
3. **2.2a** 🔴 — uočeno 09.09: "Čeka restoran" → "Zaostale" → **Prihvati** na #3870 → `resolve-restaurant-status accept` vrati **200**, ali `orders/waiting` je ne vraća ni na refresh (tab "Čeka kurira" ostaje prazan); istovremeno stiže FCM "Nova narudzba #3870". Pitanje za backend upisano u `09_09_2026_Frontend_pitanja_za_backend.textile` §2.2a. Front ne dira dok ne stigne odgovor.

Ostalo (ne provjerava se iz taba, čeka backend odgovor): **1.5 dispečeri u couriers-status**, 2.6 slanje push-a, 2.3/2.4 offer model, 2.8 orphan kurir, 1.3 sitna pitanja (`location` null / `status` enum / `search` po ID / `battery`+`accuracy` u payloadu), 1.1 `email` nullable.

Frontend: ~~prebacivanje "Kuriri uživo" na `courier-locations`~~ ✅ **urađeno** (build prolazi). Preostaje samo server-side search+paginacija u sidebar-u (sad klijentski + cap 100).

Frontend: prebacivanje "Kuriri uživo" na `courier-locations` endpoint.
