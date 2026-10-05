# Network / retest checklist — SVE otvorene stavke (21.09.2026)

Backend javio (usmeno/chat, bez konkretne liste) da je sredio "neke greske". Pošto
nema preciznog spiska šta tačno, ovo je kompletan retest svih stavki iz
`otvorene-stavke-tracker.md` koje su i dalje otvorene poslije 16.09 retesta. Grupa
"Za zajednički dogovor" nije backend fix nego UX/arhitekturna odluka — bez tabele,
lista na dnu.

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo · 🚫 blokirano (ne može se testirati)

---

## A. Bag, potvrđen uživo — najviši prioritet (16.09 ~23:20 regresija)

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R1 | ✅ | `GET /dispatcher/delivery-companies/{id}/couriers-status` | **POTVRĐENO 21.09**: `200`, `{success:true, data:[...]}`, 17 kurira, validni podaci, admin/dispečerski nalozi (30369/30700/30722/30188) i dalje ISKLJUČENI iz liste (fix ostaje na snazi) — 16.09 padao na `500` |
| R1a | ✅ | `GET /dispatcher/delivery-companies/{id}/courier-locations` — "Kuriri uživo" (mapa) | **POTVRĐENO 21.09**: `200`, `{success:true, data:[...]}`, 3 kurira sa validnim `location` (lat/lng, status online/offline, `updated_at`) — 16.09 padao na `500` |
| R1b | ✅ | `GET /dispatcher/delivery-companies/{id}/inbox-summary` — "Obaveštenja" → "Istorija poslatih poruka" | **POTVRĐENO 21.09**: `200`, `{success:true, data:[...]}`, 17 redova sa validnim `last_message`/`dispatcher_unread_count` — 16.09 padao na `500`. Cela grupa A (R1/R1a/R1b) sad prolazi |
| R2 | ✅ | `assignment_mode: TOP_N`, sačuvati, poslati NOVU narudžbu kroz restoran do "Čeka kurira". `GET /dispatcher/orders/{id}/offers` odmah i poslije 1-2 min, pa opet poslije 10-19 min | **POTVRĐENO 21.09**: `round` NIJE `null` — `order_id:3974`, `mode:"sequential"`, `batch_size:2`, `is_automatic:true`, `status:"active"`, `timeout_action:"OPEN_TO_ALL"` — runda se automatski otvorila bez ručnog klika, 16.09 regresija (drugi dan zaredom) izgleda sređena |
| R3 | ✅ | Na istoj rundi, `round.candidate_ids` i `offers[]` | **POTVRĐENO 21.09**: `candidate_ids` (15 stavki: 30742,30189,30584,30592,30710,30711,30719,30721,30723,30724,30726,30731,30744,30752,30753) i oba `offers[]` reda (30742, 30189, oba `offer_status:"pending"`) NE sadrže nijedan admin/dispečerski nalog (30369/30700/30722/30188) — 15.09/16.09 nalaz da `30369` dobija pravu pending ponudu više se ne ponavlja |
| R3b | ✅ | RAZJAŠNJENO 21.09 — "prihvatili ponudu" u prošlom nalazu značilo je da je DISPEČER pokrenuo/potvrdio slanje runde, ne da je KURIR prihvatio — kurir tek treba da klikne "Prihvati" | Stanje `round.status:"active"`, `accepted_by:null`, oba `offer_status:"pending"` je OČEKIVANO u ovoj fazi (nije bag) — pravi test za accept flow (da `offer_status` pređe u `accepted` i da se `accepted_by`/`resolved_at` popune) ide kao poseban scenario: kurir stvarno klikne "Prihvati", ODMAH povući `GET .../offers` |

## B. `couriers-balance` — nepoznati ID-jevi

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R4 | ✅ | `GET /dispatcher/delivery-companies/24/couriers-balance` i `.../couriers-status` u istom trenutku, uporediti ID-jeve | **OBJAŠNJENO 21.09 (backend)**: NIJE bag — `couriers-balance` namjerno vraća i neaktivne kurire, jer ako su ostali dužni platformi dispečer treba to da vidi (dug ne nestaje suspenzijom/deaktivacijom). `couriers-status` prikazuje samo aktivne, pa je razlika u broju redova očekivana. Preostaje samo potvrditi da `30705`/`30712`/`30720`/`30727` konkretno JESU neaktivni sa dugom (ne nešto drugo), i provjeriti da frontend tabela ima vizuelnu naznaku "neaktivan" za te redove da dispečeru bude jasno zašto se razlikuju od couriers-status liste |

## C. IDOR na ostalim courier-scoped rutama

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R5 | ✅ | Ulogovan kao kurir A, pozvati sve rute koje uzimaju `courier_id`/`driver_id` iz putanje (`GET /couriers/{id}`, `/couriers/{id}/earnings`, itd.) sa TUĐIM ID-om | `403`/`404` na SVAKOJ, ne samo na već potvrđenoj `GET /orders/driver/{id}` (14.09, K1). **DJELIMIČNO POTVRĐENO 28.09**: tri rute probane sa tuđim `courier_id` (`30742`) - `GET /orders/driver/30742` → `403`, `GET /couriers/30742` → `403`, `GET /couriers/30742/earnings` → `403`. Obrazac ide u prilog generičkoj provjeri vlasništva, ali ostale `/couriers/{id}/...` rute (`wallet-balance`, `cash-handovers`, `availability`, `inbox`, `payouts`, `quests`, `referrals`, `scoring`, `sessions`, `zones`, `companies`, `history`) nisu pojedinačno testirane - vidi `28_09_2026_Frontend_pitanja_za_backend.textile` |

## D. `offer.round.changed` na automatski istek

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R6 | ✅ | Otvoriti rundu, ne dirati je, pratiti WS frames (`private-orders.{orderId}`) dok kandidat prirodno istekne | Stiže `offer.round.changed` na istek, ne samo na accept/decline/cancel — do 16.09 front se oslanjao na 10s poll. **PRELIMINARNO 21.09 (order 3975, `private-orders.3975`)**: `pusher:subscribe` u 15:06:46.7 → `subscription_succeeded` u 15:06:46.8 → jedan `offer.round.changed` u 15:07:04.9 (~18s kasnije, `timeout_seconds:20`, `is_automatic:true`, `candidate_ids` počinje `[30577,30742,30189,…]`, payload 2556 B). Vrijeme se poklapa sa istekom prvog batch-a (Lazar i Kurir 2 na listi "Isteklo", ostali "Ponuđeno · 10s"), a runda je postojala prije subscribe-a, pa ovo NIJE event otvaranja runde — vjerovatno prvi automatski-istek broadcast ikad. **POTVRĐENO 28.09 (order 4183, `private-orders.4183`, Network tab filtriran na Socket, runda nije dirana)**: `pusher:connection_established` 08:30:14.117 → `pusher:subscribe` 08:30:14.224 → `subscription_succeeded` 08:30:14.259 → `offer.round.changed` #1 u 08:30:27.407 (`round.id:"b1ebe920-…"`, `order_id:4183`, `mode:"sequential"`, `batch_size:2`, `is_automatic:true`, `status:"active"`, `timeout_seconds:20`) → `offer.round.changed` #2 u 08:30:50.512 (~23s kasnije, ISTI `round.id`, `status:"exhausted"`). Nijedna ručna akcija (accept/decline/cancel/Zatvori rundu) nije napravljena između ta dva frame-a - `active`→`exhausted` prelaz je došao ISKLJUČIVO iz automatskog isteka kandidata, i to JE emitovalo broadcast. Ovo OBARA raniji nalaz (14.09) da automatski istek nikad ne broadcast-uje - ili je backend u međuvremenu popravio, ili je 14.09 dijagnoza bila netačna. Kandidatska lista na ekranu (dispečer) odmah je pokazala "Isteklo" na više redova bez ijednog ručnog Osveži/reload-a, u skladu sa ovim |

## E. `broadcasting/auth` intermitentan 403

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R7 | ✅ | Otvoriti "Predloženi kuriri" panel svježe (hard refresh), pratiti PRVI `POST /broadcasting/auth`, ponoviti 3-5x | **REŠENO/OBJAŠNJENO 28.09 - NIJE bag, deterministički obrazac nađen.** Test: "Prikaži kandidate" na narudžbi sa REŠENOM rundom → `403`, ponovljeno 10x zaredom → `403` SVIH 10x (nije flaky/intermitentno kao što se mislilo). Odmah zatim "Pošalji ponudu" na istoj narudžbi (otvara NOVU rundu) → `200`. Poslije toga "Prikaži kandidate" na toj (sad aktivnoj) rundi → `200`. Zaključak: backend odbija pretplatu na `orders.{orderId}` kanal SVAKI PUT kad runda nije aktivna (logično - nema šta da se broadcast-uje za zatvorenu rundu), i dozvoljava je svaki put kad JESTE aktivna - nema veze sa "prvi pokušaj vs. drugi" (14.09/21.09 uzorci su se slučajno poklopili sa tim obrascem, ne sa svježinom konekcije kako je ranije pretpostavljeno). **Frontend bug nađen i ispravljen**: `useOrderOfferRound.ts`'s `watchOrder()` je pokušavao da se pretplati na socket i za VEĆ REŠENE runde (heuristika `offers.length > 0`), što je garantovano pravilo lažan `403` na svaki klik "Prikaži kandidate" za takvu narudžbu - popravljeno da se UŽIVO praćenje (subscribe+poll) drži samo dok je `roundStatus === "active"`, istorija se i dalje prikazuje (već dolazi iz GET-a) |

## F. `resolve-restaurant-status` — preostala pitanja

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R8 | ⬜ | "Čeka restoran" tab, zaostala narudžba (>3h), "Prihvati", pratiti `POST .../resolve-restaurant-status` i odmah `GET /dispatcher/orders/waiting` | Narudžba se pojavljuje u `waiting` ODMAH (isti tick) |
| R8a | ⬜ | Push "Nova narudžba" dispečeru koji je SAM uradio accept | NE dobija duplikat notifikacije za istu narudžbu |

## G. `assignment_timeout_action: OPEN_TO_ALL`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R9 | ✅ | `assignment_mode: NEAREST`, `assignment_timeout_action: OPEN_TO_ALL`, `assignment_courier_pool: ALL_ACTIVE`, `offer_timeout_seconds: 20`. Pustiti prvog kandidata da istekne | Poslije isteka runda se otvara SVIM preostalim kandidatima, ne gasi se na `exhausted` poslije prvog isteka — 15.09 nalaz: 21 preostali kandidat nikad nije dobio ponudu. **PRELIMINARNO 21.09** (TOP_N umjesto NEAREST, samo djelimično vidljiva lista - vidi napomenu ispod). **POTVRĐENO 28.09, u ispravnom NEAREST modu**: poslije isteka prvog (najbližeg) kandidata, runda se otvorila ostalima umjesto da ode na `exhausted` - regresija od 15.09 ispravljena. Pun tok potvrđen: 1) ponuda prvo najbližem kuriru, 2) po isteku bez odgovora otvara se SVIM preostalim, 3) poslije i njihovog isteka runda konačno ide na `exhausted` (nema više koga da se pita) - tačno očekivano ponašanje, sva tri koraka rade |

## H. Cash limit / razlog unaprijed na `candidate-couriers`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R10 | ❌ | `GET .../candidate-couriers?delivery_company_id=24` na narudžbi gdje je bar jedan kandidat preko cash limita | Red kandidata ima polje (npr. `unavailable_reason`/`cash_over_limit`) da front unaprijed prikaže chip, bez potrebe za probnim klikom. **POTVRĐENO 28.09**: polje i dalje ne postoji, dispečer nema unaprijed naznaku |

## I. `inbox-summary` — prefiks rute i oblik odgovora

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R11 | ✅ | Uporediti stvaran JSON sa pretpostavljenim oblikom (`{courier_id, last_message:{title,sent_at,category,sender}|null, dispatcher_unread_count}` u `{success,data:[...]}`) | **POTVRĐENO 21.09**: oblik se TAČNO poklapa sa `InboxSummaryEntryDto` pretpostavkom — svi primjeri imaju `category:"offer"` (sistemska "Nova ponuda za dostavu" poruka, `sender:"dispatcher"`), u skladu sa napomenom da je `offer` rezervisana kategorija (issue #223681) — nema potrebe za izmjenom mapera |

## J. "Dodeli odmah" — push za dispečerski hard-assign

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R12 | ❌ | Dispečer klikne "Dodeli odmah" (`POST /orders/{id}/accept`), na kurirskoj strani (`/courier/deliveries`) pratiti Network/WS odmah poslije | Kurir vidi dodjelu ODMAH (push/WS event), ne čeka 15s poll. **POTVRĐENO 28.09**: kurirski socket kanal (`App.Models.User.{courierId}`) NIŠTA ne emituje na ovu akciju - logično, `POST /orders/{id}/accept` ne prolazi kroz offer-round model. Kurir dodjelu vidi jedino preko narednog 15s poll-a (`GET /orders/driver/{id}`). Pitanje otvoreno u `28_09_2026_Frontend_pitanja_za_backend.textile` - da li se postojeći, već potvrđeno pouzdan kanal (radi za ponude od 25.09) može proširiti i na ovu akciju |

## K. `paying_type`/`paying`/`contract_signed_at`/`contract_active_from`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R13 | ✅ | `POST /dispatcher/delivery-companies/{companyId}/couriers` — novi kurir sa popunjenim naplata/ugovor poljima | **DJELIMIČNO POTVRĐENO 21.09** iz `couriers-status` odgovora: kurir `30742` ima sva 4 polja POPUNJENA (`paying_type:1`, `paying:"242.00"`, `contract_signed_at:"2026-09-07"`, `contract_active_from:"2026-09-14"`) + kompletan `detail` (datum rođenja, IBAN, hitni kontakt) — prvi put da ijedan kurir ima ova polja nenulta poslije 14.09 "SREĐENO" tvrdnje. Ostali kurira u istom odgovoru imaju `null` na ova 4 polja, ali to su stariji test nalozi kreirani PRIJE fixa — treba potvrditi svježim POST-om da je ovo ponovljivo, ne izolovan slučaj |
| R13a | ✅ | `PATCH .../couriers/{courierId}` na postojećem kuriru, izmjena istih 4 polja | Izmjena se čuva i vraća na sledećem `GET` — još nije testirano PATCH scenario, samo POST (R13). **POTVRĐENO 28.09** (kurir `30189`): `PATCH` sa `paying_type:3`, `paying:"2.00"`, `contract_signed_at:"2026-09-14"`, `contract_active_from:"2026-09-21"` (+ lični podaci + `bank_account`/`note`) → `200`, odgovor vraća SVE poslate vrijednosti tačno. Odmah zatim `GET couriers-status` - isti kurir u nizu ima identične vrijednosti. Sva 4 pivot polja SAD rade i na PATCH-u, ne samo na POST-u (R13) - stavka potpuno zatvorena |

## L. `image_path` upload

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R14 | ⬜ | Provjeriti da li backend javio konkretan endpoint/plan za upload (van network testa) | Postoji konkretan endpoint (`POST`/`PATCH .../couriers` sa `image_path` ili posebna upload ruta) |

## M. `/earnings` — `hours_online`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R15 | ❌ | `GET /couriers/{id}/earnings` za kurira sa istorijom dostava | Odgovor sadrži `hours_online` (ili slično polje), ne samo broj dostava. **POTVRĐENO 28.09** (kurir sa 18 stavki u `data`, `total:120`): odgovor ima TAČNO `success`/`total`/`daily[]`/`data[]` - isti oblik potvrđen 29.08, i dalje NEMA `hours_online` ni bilo koje polje za sate online. `data[]` (red po porudžbini: `order_id`, `wage`, `food_collected`, `delivery_collected`, `collected_from_customer`, `date`) postoji u odgovoru ali frontend ga i dalje ne koristi (`fetchCourierEarnings` mapira samo `total`/`daily`) |

## N. `payouts` — produkcijska potvrda formata datuma

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R16 | ✅ | `GET /dispatcher/delivery-companies/{companyId}/payouts`, provjeriti `created_at` | ISO + `Z` (UTC), prikaz datuma na frontu odgovara stvarnom vremenu isplate bez pomaka na produkciji. **POTVRĐENO 28.09** (firma 24, kurir 30189): oblik odgovora tačno prati `CompanyPayout` (`id`/`amount`/`note`/`created_at`/`transaction_id`/`courier_id`). Namjerno biran test slučaj preko granice ponoći: red `created_at:"2026-09-16T22:11:57.000000Z"` (22:11 UTC = 00:11 sledećeg dana po Beogradu, ljetno računanje) - ekran "Isplate" prikazuje "17. sep 00:11", TAČNO prelazi u sledeći dan, nema pomaka |

---

## Za zajednički dogovor — informativno, nije backend "fix"

Traže odluku (frontend/product), ne network retest:

* Ručna ponuda, više kandidata, 422 all-or-nothing (`POST .../offer`) — 16.09
  potvrđeno network dokazom (4 čekirana, 1 dostupan, cijeli zahtjev pao na 422). Ako
  backend tvrdi da je "sredio" i ovo, provjeriti isti scenario ponovo.
  **21.09 PONOVLJENO, ISTI REZULTAT**: `POST offer?delivery_company_id=24` sa 4
  kandidata (30742, 30189, 30577, 30576) pao na 422, `errors.courier_ids`:
  "Kurir #30742 trenutno nije dostupan.", "Kurir #30189 trenutno nije dostupan.",
  "Kurir #30577 trenutno vozi drugu dostavu.", "Kurir #30576 trenutno vozi drugu
  dostavu." — cijeli zahtjev i dalje pada zbog nedostupnih, umjesto da posalje
  samo dostupnima.
  **NOVO PITANJE 21.09**: Finansijske postavke → "Koje kurire uzeti u obzir pri
  dodeli" je postavljeno na "Sve aktivne kurire firme (bez provjere dostupnosti)"
  — opis izričito kaže "bez provjere dostupnosti". Ako je tako, zašto ručni
  `POST .../offer` i dalje vraća "trenutno nije dostupan"/"trenutno vozi drugu
  dostavu"? Da li ta postavka namjerno važi SAMO za automatsku dodjelu (pool
  kandidata za automatsku rundu), a ručno slanje ponude ima svoju, odvojenu
  provjeru dostupnosti koja se ne oslanja na ovu postavku? Ako je namjerno,
  trebalo bi to jasnije naglasiti u opisu postavke na frontu; ako nije namjerno,
  ovo je dodatni argument da ručni `/offer` treba da preskoči nedostupne umjesto
  422 na sve.
  **21.09 DRUGI PRIMJER, isti UI tok** (screenshot "Predloženi kuriri" →
  "Pošalji ponudu (4)"): 4 čekirana kandidata (30742, 30189, 30576, 30577), 3 od
  4 nedostupna (30742/30189 "trenutno nije dostupan", 30576 "trenutno vozi drugu
  dostavu", "and 2 more errors" = 3 greške ukupno), samo 30577 bi bio validan —
  cijeli zahtjev i dalje pada, dispečer vidi samo generičku crvenu poruku "Ne
  mogu da pošaljem ponudu.", ne i listu/razlog po kuriru.
  **PREDLOŽENO PONAŠANJE (dispečer, 21.09)**: kad je bar jedan kandidat validan,
  zahtjev treba da PROĐE i pošalje ponudu SAMO validnom/validnima, a dispečer
  treba da vidi koji kandidati NISU dobili ponudu i zašto (razlog po kuriru, ne
  samo generička poruka) — umjesto trenutnog all-or-nothing 422. Ovo je konkretan
  predlog za backend pitanje, ne samo primjedba; ako backend prihvati, frontend
  treba da prikaže djelimičan uspjeh (npr. toast/lista "poslato: X, nije poslato:
  Y (razlog)") umjesto jedne crvene greške.
* Dugme "Radim"/"Prestao sam da radim" za kurira
* "Pošalji ponudu" klikabilno i za nemoguće kandidate
* Kurirski prikaz ponude siromašan
* Moj profil — proširena polja nedostupna kuriru
* "Dodeli odmah" — hard-assign vs. offer-runda

---

Popuniti status kolonu kako se testira. Sve što ne prođe (ili ostane 🚫 blokirano)
ide u novi dan pitanja backendu (ne dopisivati u stare `*_Frontend_pitanja_za_backend*`
fajlove) i ažurirati `otvorene-stavke-tracker.md`.
