# Network / retest checklist — backend javio da je sredio 4 stavke (16.09.2026)

Retest za 4 stavke koje backend tvrdi da je sredio (tiketi/bag-lista, bez posebnog
`odgovor-backend` fajla ovog puta). Izvori nalaza: `15_09_2026_Frontend_pitanja_za_backend.textile`
(stavke 1 i 3), `14_09_2026_Network_checklist_kriticne-stavke.md` (stavka 2 = K5b,
stavka 4 = K6).

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo

## 1. `active-deliveries` — `courier: null` na narudžbi koja je već `picked_up`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R1 | ✅ | Dodijeliti narudžbu kuriru, kurir prihvata i klikne "Preuzeto" (status ide u `picked_up`), zatim `GET /dispatcher/orders/active-deliveries` | Red za tu narudžbu ima popunjen `courier: {id, name, phone, vehicle}` — NE `null`. Original nalaz 15.09 (narudžba #3941): tačno na prelazu u `picked_up` je `courier` nestao, dok je druga narudžba u `booked` statusu (#3943) u istom odgovoru imala pun objekat — **potvrđeno 16.09**: narudžba #3944, `status: "picked_up"`, `courier: {id: 30577, name: "Lazar Hrebeljanovic", phone: "1242144", vehicle: "scooter"}` — popunjen, fix radi |
| R1a | ✅ | Isto na UI-ju: `/dispatcher/assignment`, red te narudžbe (`BoardDeliveryRow.vue`) | Prikazuje ime/telefon kurira i dugme "Pozovi" — NE "⚠ Kurir nedodijeljen" — **potvrđeno 16.09**: red #3944 ("U dostavi") prikazuje "Lazar Hrebeljanovic" i crveno dugme "Pozovi" (uz "Kasni 3 min") |
| R1b | ✅ | Ista narudžba #3944 — kurir markira "Dostavljeno" (`POST /orders/{id}/deliver`, status ide na `DELIVERED`), zatim provjeriti da narudžba ispravno ISPADNE iz `active-deliveries` (više nije aktivna) — ne da `courier` postane `null` dok je narudžba još u odgovoru | Nakon `deliver` narudžba nestaje iz `GET /dispatcher/orders/active-deliveries` odgovora (prelazi u istoriju), ne ostaje sa `courier: null`. Napomena: `COURIER_AT_RESTAURANT`/`COURIER_ARRIVED` (geofence-based) još ne postoje na backendu (`orderDisplay.ts:27-31`), pa nema posebnog "stigao kod kupca" koraka za provjeru — jedina tranzicija poslije `picked_up` je direktno `deliver` — **potvrđeno 16.09**: nakon "Dostavljeno" narudžba #3944 nije više u `active-deliveries` odgovoru, nema `courier: null` zaostatka |

## 2. Automatska runda i dalje nudi admin/dispečerske naloge (candidate_ids/offers)

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R2 | 🚫 | Pokrenuti automatsku dodjelu (TOP_N ili sequential) na narudžbi firme koja ima admin/dispečerske naloge (`30369` "Admin Ordera", `30700` "Test Dispecer2", `30722`/`30188` "Admin1 Dostava Ordera"), pratiti `POST .../offer` ili auto-trigger response | `round.candidate_ids` NE sadrži nijedan od tih ID-jeva — **BLOKIRANO 16.09**: `assignment_mode: TOP_N`, `assignment_courier_count: 2` sačuvano (Finansijske postavke), narudžbe #3948 (čekala 19 min) i #3949 (nova) prošle kroz restoran-accept do "Čeka kurira" - automatska runda se NIKAD nije otvorila za nijednu, ni odmah ni poslije 10 min. `GET /dispatcher/orders/{3948,3949}/offers` → `{"round": null, "offers": []}` za OBIJE. Ne može se testirati da li admin nalozi ulaze u `candidate_ids` kad runda nikad ne postoji - vidi novo pitanje u `16_09_2026_Frontend_pitanja_za_backend.textile` |
| R2a | ⬜ | `GET /dispatcher/orders/{id}/offers` na istoj rundi | `offers[]` NE sadrži red sa `courier_id` iz gornje liste — original nalaz 15.09 (narudžba 3941, TOP_N): `30369` je bio JEDAN OD DVA reda sa `offer_status: "pending"` i pravim `offer_expires_at`, tj. admin nalog je stvarno primio aktivnu ponudu |
| R2b | ⬜ | Ponoviti R2 i na ručnoj ponudi (Predloženi kuriri, čekiranje kandidata) ako je ista lista dostupna za čekiranje | Admin/dispečerski nalozi se ne pojavljuju ni u toj listi (potvrđuje da je isti builder/upit ispravljen na oba puta, ne samo jedan) |

## 3. `couriers-balance` i dalje vraća dispečerske/admin naloge

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R3 | ✅ | `GET /dispatcher/delivery-companies/24/couriers-balance` | Nijedan red sa `courier_id: 30369` ("Admin Ordera"), `30700` ("Test Dispecer2"), `30722`/`30188` ("Admin1 Dostava Ordera") — 14.09 (K5b) je ovo bilo jedino mjesto gdje fix NIJE stigao dok su `couriers-status`/`candidate-couriers` bili već čisti — **potvrđeno 16.09**: 21 red, nijedan od ta 4 ID-ja se ne pojavljuje, svi redovi imenom prepoznatljivi kao stvarni/test kuriri |
| R3a | 🟡 | Uporediti broj redova prije/poslije (ako je poznat tačan broj stvarnih kurira firme) | Broj redova = broj stvarnih kurira, bez dodatnih 3+ admin naloga — **NOVI NALAZ 16.09**: `couriers-status` (firma 24) vraća 17 redova, `couriers-balance` isti trenutak 21 red — 4 ID-ja postoje SAMO u `couriers-balance`: `30705` "Test Provera", `30712` "B Test", `30720` "Test Validan", `30727` "Test Create" (duplikat imena sa `30719`, koji JESTE u obje liste). Nisu isti ID-jevi kao prethodno poznati admin nalozi (30369/30700/30722/30188), pa R3 (ta 4 specifična ID-ja) i dalje ✅ - ali razlika u broju znači da NEŠTO filtrira ova 4 ID-ja iz `couriers-status` a ne iz `couriers-balance`. Nema `type`/`role` polja na redu da se potvrdi da su isti tip (admin_delivery) ili nešto drugo (npr. nekompletan profil/test nalog bez emaila) - treba provjeriti direktno ili pitati backend |

## 4. `offer.round.changed` se ne emituje za automatski istek kandidata

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| R4 | ⬜ | Otvoriti rundu (sequential ili TOP_N), NE dirati je ručno (bez accept/decline/cancel), pratiti WS frames (DevTools → Network → WS, kanal `private-orders.{orderId}`) dok kandidat/kandidati prirodno isteknu (`offer_timeout_seconds`) | Stiže application event `offer.round.changed` (ne samo `pusher:ping`/`pusher:pong`) tačno u trenutku isteka — ovo je jedina akcija koja 14.09 (K6) NIJE brodkastovala, za razliku od accept/decline/cancel koji su uvijek radili |
| R4a | ⬜ | Isti scenario, provjeriti payload primljenog eventa | Oblik odgovara ostalim potvrđenim payload-ima (`{round, offers, server_now}`, bez `{success, data}` omotača — vidi K7) — provjeriti da normalizacija i dalje radi i za ovaj (ranije neviđen) payload |
| R4b | ⬜ | Ako se koristi `assignment_timeout_action: OPEN_TO_ALL` — provjeriti i da runda stvarno pređe na sljedeći korak (ne samo da event stigne) | Vezano na otvoreno pitanje iz 15.09 (`OPEN_TO_ALL` regresija, N2b) — ako i dalje ide direktno na `exhausted` bez ponovnog otvaranja svima, prijaviti odvojeno, nije isto što i broadcast |

---

Sve što ne prođe, prijaviti nazad backend timu u novi fajl pitanja (16.09), ne dopisivati
u stare dane (vidi `[[backend-docs-dated-per-day]]`).
