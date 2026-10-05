# Network / retest checklist — otvorene stavke DIO II-IV (15.09.2026)

Retest za `15_09_2026_odgovor-backend-otvorene-stavke.textile`. Kritične stavke (DIO I)
imaju svoju checklistu — `14_09_2026_Network_checklist_kriticne-stavke.md` — ne
ponavljaju se ovdje. Otvorena pitanja koja ne blokiraju retest su u
`15_09_2026_Frontend_pitanja_za_backend.textile`.

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo

## A. `POST .../offer` — validacija `courier_id`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| N1 | ✅ | `/dev/api` ili ručno: `POST .../offer` sa `{"courier_ids":[999999999],"mode":"sequential"}` (izmišljen ID) | 4xx sa čitljivom porukom, umjesto `201` sa otvorenom rundom (13.09 nalaz) — **potvrđeno 15.09**: `422`, `{"message":"Kurir #999999999999999 nije kandidat za ovu narudzbu/firmu.","errors":{"courier_ids":["..."]}}` — standardna Laravel validation forma, ista kao svugdje drugo na frontu (`getValidationMessage()` je već pokriva) |

## B. Prošireni model dodjele — stvarni efekat

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| N2 | ✅ | Postaviti firmu na `assignment_mode: TOP_N`, `assignment_courier_count: 2`, poslati narudžbu (auto-dodjela, ne ručna ponuda) | Ponuda ide DVOJICI najbližih kandidata istovremeno, ne samo jednom (staro `ALL`/no-effect ponašanje) — **potvrđeno 15.09** (narudžba 3941, `is_automatic: true`, `batch_size: 2`): `offers[]` ima tačno 2 reda, oba `offer_status: pending`, isti `offer_expires_at` — TOP_N stvarno šalje N odjednom. Napomena: `round.mode` je `"sequential"` iako je firma na TOP_N - vjerovatno interno ime za "grupa po grupa" tok, ne mijenja da je batch_size ispravno primijenjen |
| N2a | ✅ | Postaviti `assignment_courier_pool: AVAILABLE_NOW`, imati bar jednog kurira koji NIJE označio "dostupan za rad" u kandidat-poolu | Taj kurir se NE pojavljuje/ne dobija ponudu u automatskoj dodjeli — **potvrđeno 15.09**: mehanizam razjašnjen uživo - `currently_available` prati kurirov "Radno vrijeme" (`/courier/availability`, tab-slot za trenutno vrijeme), NE `on_delivery` (nezavisna polja, oba se ponašala ispravno - `on_delivery` pao na `false` poslije predaje narudžbe, `currently_available` ostao `true` jer radno vrijeme i dalje pokriva sada). Sa TAČNO jednim kuririm (30577) `currently_available: true` (od 21 kandidata na prethodnoj N2 rundi), nova automatska runda (narudžba 3942, TOP_N) je vratila `candidate_ids: [30577]` - isključivo taj jedan, svi ostali odbačeni iako bi inače bili kandidati. Filter stvarno radi |
| N2b | ❌ | Postaviti `assignment_mode: NEAREST`, `assignment_timeout_action: OPEN_TO_ALL`, `offer_timeout_seconds: 20`, pustiti da prvi kandidat istekne | Poslije isteka, ponuda se otvara SVIM kandidatima (ne samo sljedećem najbližem) — **NE PROLAZI, potvrđeno 15.09** (narudžba 3943, `assignment_courier_pool: ALL_ACTIVE`, 22 kandidata u `candidate_ids`, `timeout_action: "OPEN_TO_ALL"`): prvi kandidat (30577) dobio ponudu, `offer_expires_at` +20s. Poslije isteka (provjereno ~40s kasnije) `round.status → "exhausted"`, `resolved_at` popunjen, `offers[]` i dalje sadrži SAMO taj jedan red (`offer_status: "expired"`) - NIJEDNA nova ponuda nije poslata nijednom od preostalih 21 kandidata. Runda se jednostavno zatvorila umjesto da otvori svima - `OPEN_TO_ALL` se ponaša kao no-op (ni "svima" ni staro `NEXT_NEAREST` ponašanje) |

## C. Cash limit — ručna dodjela preko "Predloženi kuriri"

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| N3a | ✅ | Kurir preko cash limita (BLOCK enforcement), u `candidate-couriers` listi za narudžbu, dispečer klikne "Pošalji ponudu"/"Dodeli odmah" | Scenario (a) potvrđen uživo 15.09: narudžba #3941 ("Čeka kurira"), dispečer klikne "Dodeli odmah" (top-ranked kandidat, kurir sa saldom 66.90 preko limita od 50.00) — greška stiže ODMAH sa istog API poziva ("Dostigli ste limit gotovine (66.90 od 50.00). Predajte pazar prije nove narudžbe."), ne čeka se `offer_timeout_seconds`. Otvoreno pitanje iz `15_09_2026_Frontend_pitanja_za_backend.textile` (dio 1) riješeno - ručni tok NE ostavlja slot da visi. Napomena: tekst poruke je u kurirskom licu ("Dostigli STE") prikazan DISPEČERU - vjerovatno je to ista copy poruka kao push ka kuriru, ponovo iskorišćena za dispečerski error bez prilagođavanja lica/konteksta - kozmetički nalaz, nije blokirajući. Dio 2 pitanja (cash status polje u `candidate-couriers` za proaktivan chip) ostaje otvoren - backend i dalje ne vraća takvo polje |

## D. `GET /courier/offers` — `delivery_price`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| N3 | ⬜ | Test narudžba na restoranu sa `active_restoran=1 AND active_company=1` (ne generički test restoran) | `delivery_price` (top-level i `order.delivery_price`) je stvarna cijena, ne `0` |

## E. `order_status` enum — nova mapa poruka

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| N4 | ⬜ | Izazvati 409 na `/accept` sa bar 2-3 različita `order_status` (npr. narudžba u `PREPARING`, pa u `EXPIRED`) | Dispečer vidi TAČNU novu poruku iz `ORDER_STATUS_MESSAGES` (useCandidateCouriers.ts), ne staru heurističku i ne generičku fallback poruku |
| N4a | ⬜ | Ako se uhvati `order_status` vrijednost koje NEMA u enumu (očekivano ne bi trebalo) | Front pada na server/generičku poruku bez pucanja — provjeriti da se ništa ne prikaže kao "undefined"/prazno |

## F. `inbox-summary` — prefiks rute i oblik

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| N5 | ⬜ | Otvoriti "Obaveštenja" → "Istorija poslatih poruka", pratiti Network tab za poziv ka `inbox-summary` | Poziv ide na `/dispatcher/delivery-companies/{companyId}/inbox-summary` i vraća `200` (ne `404` — ako `404`, ruta je bez `/dispatcher` prefiksa, ispraviti `fetchInboxSummary()` u `courierInboxService.ts`) |
| N5a | ⬜ | Uporediti stvaran JSON odgovor sa `InboxSummaryEntryDto` (`types/inbox.ts`) | Polja se poklapaju (`courier_id`, `last_message.{title,sent_at,category,sender}` ili `null`, `dispatcher_unread_count`) — ako ne, prilagoditi tip + `mapInboxSummaryEntryDto()` |
| N5b | ⬜ | Kuriru sa poslatom porukom (i bar jednom NEPROČITANOM od strane kurira) provjeriti prikaz u listi | Red prikazuje naslov + relativno vrijeme zadnje poruke i chip "N nepročitano" — provjeriti da li broj u chipu stvarno odgovara nepročitanim porukama TOG kurira (semantika `dispatcher_unread_count` nije potvrđena, vidi pitanje) |
| N5c | ⬜ | U dijalogu "Poruke kurira" obrisati poruku, zatvoriti dijalog | Pretpregled na listi iza (naslov/vrijeme/broj nepročitanih) se osvježi na tog kurira |
| N5d | ⬜ | Poslati grupnu poruku (broadcast) svim kuririma | Pretpregled na listi se osvježi za sve primaoce bez ručnog refresh-a stranice |

## G. Company currency — my-companies fallback

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| N6 | ✅ | `GET /dispatcher/my-companies` direktno (Network tab ili curl) | Odgovor sad ima `currency` po firmi (npr. `"KM"`/`"EUR"`) — **potvrđeno 15.09**: firma 24 vraća `"currency": "KM"` u redu, tačno polje/naziv koji je frontend pretpostavio u `CompanyDto` |
| N6a | ✅ | Otvoriti "Firma" stranicu direktno na tabu "Saradnja sa restoranima" (ne "Finansijske postavke") na SPOROJ konekciji (throttling), prije nego finance-settings stigne | Upozorenje o neslaganju valute u `RestaurantCooperationPanel` koristi stvarnu valutu firme (sa `my-companies`), ne hardkodovano `"KM"` fallback dok finance-settings još učitava — **potvrđeno 15.09** |

---

Sve što ne prođe prijaviti nazad backend timu u novi fajl pitanja (dan retesta), po istom
obrascu kao `14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile`.
