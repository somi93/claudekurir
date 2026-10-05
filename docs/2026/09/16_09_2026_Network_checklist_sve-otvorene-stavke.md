# Network / retest checklist — SVE otvorene stavke (16.09.2026)

Backend javio da je uradio sve stavke iz `otvorene-stavke-tracker.md`. Ovo je
kompletan retest za sve iz grupa "Backend" i "Bag, potvrđen uživo". Grupa "Za
zajednički dogovor" (dio G ispod) nije backend fix nego UX/arhitekturna odluka -
nema šta da se "sredi" na backendu, ostavljeno bez tabele osim jedne stavke koja
ipak ima konkretan network dokaz.

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo · 🚫 blokirano (ne može se testirati)

---

## A. Automatska dodjela i admin/dispečerski nalozi u rundi

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S1 | ❌ | Firma → Finansijske postavke → `assignment_mode: TOP_N`, `assignment_courier_count: 2`, sačuvati. Poslati NOVU narudžbu (ne recikliranu zaglavljenu) kroz restoran do "Čeka kurira". `GET /dispatcher/orders/{id}/offers` odmah i poslije ~1-2 min | `round` NIJE `null` - automatski se otvorila runda bez ručnog klika — **NE PROLAZI, potvrđeno 16.09 (drugi dan zaredom)**: ista regresija kao juče, backend tvrdnja "sređeno" ne stoji za ovu stavku |
| S1a | 🚫 | Na istoj rundi, `round.candidate_ids` i `offers[]` | NE sadrže `30369` ("Admin Ordera"), `30700` ("Test Dispecer2"), `30722`/`30188` ("Admin1 Dostava Ordera") - ni kao kandidat ni kao stvarni `offer_status: pending` red (15.09 nalaz: `30369` je dobio pravu pending ponudu u TOP_N modu) — **blokirano**, ne može se provjeriti dok S1 ne radi |
| S1b | ❌ | Ako S1 ne prođe (runda se i dalje ne otvara automatski) | Ostaje 🚫 blokirano - ne može se potvrditi S1a dok S1 ne radi — **potvrđeno 16.09**: i dalje ne radi |

## B. `offer.round.changed` WS broadcast na automatski istek

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S2 | ⬜ | Otvoriti rundu (ručno ili automatski), NE dirati je, pratiti WS frames (DevTools → Network → WS, kanal `private-orders.{orderId}`) dok kandidat prirodno istekne (`offer_timeout_seconds`) | Stiže `offer.round.changed` application event na istek (ranije 14.09 - K6 - stizao SAMO na accept/decline/cancel, NIKAD na automatski timeout, front se oslanjao na 10s poll) |

## C. `broadcasting/auth` intermitentan 403

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S3 | ⬜ | Otvoriti "Predloženi kuriri" panel svježe (nova sesija/hard refresh), pratiti PRVI `POST /broadcasting/auth` poziv u Network tabu, ponoviti 3-5x | `200`, `{"...":"subscription_succeeded"...}` - NE `403` sa golim (ne-JSON) tijelom `403 | Forbidden` (14.09 nalaz: prvi pokušaj padao intermitentno, drugi prošao) |

## D. `resolve-restaurant-status` — preostala pod-pitanja

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S4 | ⬜ | "Čeka restoran" tab, zaostala narudžba (>3h), kliknuti "Prihvati", pratiti `POST .../resolve-restaurant-status` i odmah `GET /dispatcher/orders/waiting` | Narudžba se pojavljuje u `waiting` ODMAH (isti tick), bez zastoja |
| S4a | ⬜ | Provjeriti da se push "Nova narudžba" NE šalje dispečeru koji je SAM upravo uradio accept | Dispečer koji je kliknuo ne dobija duplikat notifikacije za istu narudžbu |

## E. `assignment_timeout_action: OPEN_TO_ALL`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S5 | ⬜ | `assignment_mode: NEAREST`, `assignment_timeout_action: OPEN_TO_ALL`, `assignment_courier_pool: ALL_ACTIVE`, `offer_timeout_seconds: 20`. Pustiti prvog kandidata da istekne | Poslije isteka, ponuda se otvara SVIM preostalim kandidatima (ne samo sljedećem najbližem, i NE ide direktno na `exhausted`) - 15.09 nalaz (N2b): runda se gasila poslije prvog isteka, 21 preostali kandidat nikad nije dobio ponudu |

## F. `couriers-balance` — nepoznati ID-jevi (moguće obrisani kuriri)

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S6 | ⬜ | `GET /dispatcher/delivery-companies/24/couriers-balance` i `GET .../couriers-status` u istom trenutku, uporediti broj redova i ID-jeve | Isti broj redova, ILI ako se razlikuju - backend potvrdio šta su `30705`/`30712`/`30720`/`30727` (obrisani kuriri?) i da je namjerno da `couriers-balance` i dalje prikazuje njihovo dugovanje |
| S6a | ⬜ | Poznati stari admin nalozi `30369`/`30700`/`30722`/`30188` | I dalje NE u `couriers-balance` (ovo je već ✅ potvrđeno 16.09 - regresija bi bila ako se vrate) |

## G. Cash limit / razlog unaprijed na `candidate-couriers`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S7 | ⬜ | `GET /dispatcher/orders/{id}/candidate-couriers?delivery_company_id=24` na narudžbi gdje je bar jedan kandidat preko cash limita | Red kandidata ima polje (npr. `cash_over_limit`/`unavailable_reason`) da front prikaže chip UNAPRIJED - do 15.09 backend NIJE vraćao takvo polje, dispečer je morao da proba klik da sazna |

## H. `inbox-summary` — prefiks rute i oblik odgovora

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S8 | ❌ | Otvoriti "Obaveštenja" → "Istorija poslatih poruka", pratiti Network poziv ka `inbox-summary` | Ide na `/dispatcher/delivery-companies/{companyId}/inbox-summary`, `200` (ne `404`) — **NE PROLAZI, 16.09**: `500 Internal Server Error` (dva puta zaredom), ne 404 ni 200 — gore od ranijeg problema (bar je ruta postojala) |
| S8a | 🚫 | Uporediti stvaran JSON sa pretpostavljenim oblikom (`{courier_id, last_message:{title,sent_at,category,sender}|null, dispatcher_unread_count}` u `{success,data:[...]}`) | Polja se poklapaju - ako ne, prilagoditi `InboxSummaryEntryDto`/`mapInboxSummaryEntryDto()` — blokirano, nema odgovora da se uporedi (500) |
| S8b | ❌ | Na ISTOJ stranici, pratiti `couriers-status` poziv | `200` sa listom kurira — **NE PROLAZI, 16.09**: i `couriers-status` vraća `500` na istoj stranici (dva puta zaredom) — ovaj endpoint je JUČE radio ispravno (R3/S6 test), nova regresija, ne stari poznati problem |

## I. "Dodeli odmah" — push za dispečerski hard-assign

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S9 | ⬜ | Dispečer klikne "Dodeli odmah" (`POST /orders/{id}/accept`), na KURIRSKOJ strani (`/courier/deliveries`) pratiti Network/WS odmah poslije | Kurir vidi dodjelu ODMAH (push/WS event), ne čeka do 15s poll - do 15.09 nije postojao potvrđen push signal za ovaj tok (samo za offer-round) |

## J. `paying_type`/`paying`/`contract_signed_at`/`contract_active_from`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S10 | ⬜ | `POST /dispatcher/delivery-companies/{companyId}/couriers` - novi kurir sa popunjenim naplata/ugovor poljima | Odgovor vraća ta 4 polja POPUNJENA, ne `null` (14.09 "SREĐENO" tvrdnja nije prošla retest - i dalje `null` i na create i na patch) |
| S10a | ⬜ | `PATCH .../couriers/{courierId}` na POSTOJEĆEM kuriru, izmjena istih 4 polja | Izmjena se čuva i vraća u odgovoru/na sledećem `GET` |

## K. `image_path` upload

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S11 | ⬜ | Provjeriti da li backend javio konkretan endpoint/plan za upload (van network testa - provjeriti odgovor u pitanja fajlu) | Postoji konkretan endpoint (`POST`/`PATCH .../couriers` sa `image_path` ili posebna upload ruta) - ako ne, ostaje otvoreno kao i ranije |

## L. `/earnings` — `hours_online`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S12 | ⬜ | `GET /couriers/{id}/earnings` za kurira sa istorijom dostava | Odgovor sad sadrži `hours_online` (ili slično polje za "sati online"/"KM po satu"), ne samo broj dostava |

## M. `payouts` — produkcijska potvrda formata datuma

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S13 | ⬜ | `GET /dispatcher/delivery-companies/{companyId}/payouts` i `GET /courier/wallet`-ekvivalent, provjeriti `created_at` format | ISO + `Z` (UTC), prikaz datuma na frontu odgovara stvarnom vremenu isplate bez pomaka |

## N. IDOR — ostale courier-scoped rute

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| S14 | ⬜ | Ulogovan kao kurir A, pozvati SVAKU drugu rutu koja uzima `courier_id`/`driver_id` iz putanje (npr. `GET /courier/{id}/earnings`, `/couriers/{id}`, itd. - nabrojati sve takve rute u servisima) sa TUĐIM ID-om | `403`/`404` na svakoj, isto kao potvrđeni fix na `GET /orders/driver/{id}` (14.09, K1) - ne samo na toj jednoj ruti |

---

## Za zajednički dogovor — informativno, nije backend "fix"

Ove stavke traže odluku (frontend/product), ne network retest - backend ih ne može
"srediti" jednostrano. Jedini izuzetak sa network dokazom:

* **Ručna ponuda, više kandidata, 422 all-or-nothing** — već POTVRĐENO 16.09
  (`POST .../offer`, 4 kandidata, 1 validan, cijeli zahtjev pao na 422). Ako backend
  tvrdi da je "sredio" i ovo, provjeriti isti scenario (1 dostupan + 3 nedostupna u
  istom `courier_ids` nizu) - da li runda SAD otvara samo za validnog, ili i dalje
  422 na sve.

Ostale (dugme "Radim", disable dugmeta za nemoguće kandidate, kurirski prikaz ponude,
Moj profil proširena polja, Dodeli odmah vs. offer-runda) - čekaju odgovor/odluku,
ne network provjeru.

---

Popuniti status kolonu kako se testira. Sve što ne prođe (ili je 🚫 blokirano) ide u
novi dan pitanja backendu (ne dopisivati u stare `*_Frontend_pitanja_za_backend*`
fajlove).
