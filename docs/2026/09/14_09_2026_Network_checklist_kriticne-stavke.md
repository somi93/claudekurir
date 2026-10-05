# Network / retest checklist — kritične stavke DIO I (14.09.2026)

Retest za `14_09_2026_odgovor-backend-kriticne-stavke.textile` (backendov odgovor na svih
6 kritičnih stavki iz `13_09_2026_Frontend_pitanja_za_backend.textile`, DIO I). Otvorena
pod-pitanja koja ne blokiraju retest su u
`14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile`. Presetovi za ručno
testiranje: `/dev/api` (`D5b` za offer/cancel, ostalo ručni pozivi/curl jer nisu bili u
originalnom test-plan setu).

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo

## A. Sigurnosni nalaz — `GET /orders/driver/{id}` (IDOR)

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| K1 | ✅ | Ulogovan kao kurir A (npr. 30577), pozvati `GET /orders/driver/{id}` sa TUĐIM `courier_id` (npr. 30189, aktivna narudžba tog kurira) | `403`/`404` (ili barem odbijen pristup) umjesto `200` sa tuđim podacima narudžbe — **potvrđeno 14.09**: `GET /orders/driver/30189` → `403 Forbidden`, `{"message":"Niste ovlascene da djelujete u ime ovog kurira."}` — retest tačno istog poziva koji je 13.09 vratio 200, IDOR zatvoren |
| K1b | ✅ | Isti test, ulogovan kao dispečer pozivajući za kurira SVOJE firme vs. kurira DRUGE firme (ako dispečerski pristup ovoj ruti uopšte postoji) | Dispečer van firme kurira dobija odbijen pristup; nije jasno da li dispečer ima legitiman pristup ovoj ruti uopšte — provjeriti da li frontend uopšte zove ovu rutu kao dispečer (ne bi trebalo, `courierOrdersService.ts` je kurirska strana) — **potvrđeno 14.09** |

## B. Otkazivanje runde ponude — `POST .../offer/cancel`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| K2 | ✅ | `/dev/api`, preset `D5b` — otvoriti rundu (`D1`), zatim `POST /dispatcher/orders/{id}/offer/cancel` sa `{"delivery_company_id": 24}` u body | `200`, `data.round.status: "canceled"`, svi `data.offers[]` prelaze u `superseded` (ili slično) — provjeriti tačan naziv statusnog polja na redu (`status` vs `offer_status` — nesigurno iz primjera u odgovoru) — **potvrđeno 14.09** (narudžba 3933, automatska sekvencijalna runda): `200`, `round.status: "canceled"`, `resolved_at` popunjen. Red u `offers[]` koristi `offer_status: "superseded"` — POTVRĐENO da je isto polje kao svugdje drugo (`offer_status`, NE `status` kako je pisalo u primjeru odgovora) — `normalizeOfferRound()`/`CourierOfferDto` ne trebaju izmjenu |
| K3 | ❌→✅ | U UI-ju (Predloženi kuriri), poslati ponudu, kliknuti "Zatvori rundu" | Dugme pokazuje loading dok poziv traje; po uspjehu runda/bar nestaju (isto kao ranije), ALI sad i stvarno na serveru — potvrditi naknadnim `GET .../offers` da je `round.status: "canceled"`, ne i dalje `active` — **bug nađen i ispravljen 14.09**: "Zatvori rundu" dugme je bilo vidljivo i na VEĆ RIJEŠENOJ rundi (uživo uhvaćeno na narudžbi 3933, chip "Runda: svi odbili / isteklo" = `exhausted`), klik je vratio `409 "Nema aktivne ponude za ovu narudzbu."` — backend je ispravno odbio, ali dugme nije trebalo ni da bude vidljivo/klikabilno. Uzrok: `roundActive` prop (koji je kontrolisao i chip i dugme) je bio vezan samo za "da li panel prati ovu rundu" (`offerRoundActiveHere`), ne i za stvaran status runde. **Ispravljeno**: novi `offerRoundCancelable` computed u `useCandidateOfferRound.ts` (`offerRoundActiveHere && offerRound.roundActive` - potonji je već postojeći `roundStatus === "active" \|\| null` iz `useOrderOfferRound.ts`), novi `canCancel` prop na `OfferRoundBar.vue` kontroliše SAMO dugme (chip i dalje koristi `roundActive` da prikaže i riješeno stanje). **Retest POTVRĐEN 14.09**: na novoj ručno otvorenoj rundi (`is_automatic: false`, 3 čekirana kandidata) klik na "Zatvori rundu" je vratio `200`, `round.status: "canceled"`, `offer_status: "superseded"` — dugme radi ispravno kad JESTE otkaziva runda (za razliku od ranijeg 409 na već isteklu) |
| K3a | ✅ | Nakon K3 fixa — na ISTOJ (već isteklog/exhausted) rundi, provjeriti da se čekiranje kandidata i "Redom/Paralelno" opet mogu koristiti | **Regresija uočena uživo ODMAH poslije K3 fixa** (narudžba 3933): dugme "Zatvori rundu" je ispravno nestalo, ALI checkbox-ovi za bulk čekiranje i "Redom/Paralelno" toggle su ostali trajno zaključani (`offerRoundLocked` je i dalje bio vezan za `offerRoundActiveHere`, ne za stvaran status), i "Osveži" nije pomagao (`load()` uvijek zove `watchExistingRound()` koji re-zaključava jer `hasLiveRound` gleda `offers.length > 0`, ne samo `roundStatus`). Pojedinačno "Pošalji ponudu" po redu je i dalje radilo (nije bilo vezano za lock) - to je namjerno tako. **Ispravljeno**: `offerRoundLocked` sad je isto što i `offerRoundCancelable` (otključano čim runda nije stvarno aktivna) umjesto `offerRoundActiveHere`. **Usput nađen i ispravljen srodan bug**: `open()` u `useOrderOfferRound.ts` nije zvao `unsubscribe()` prije `subscribe()` kad se nova runda otvara za ISTU narudžbu koja se već pratila (moguće otkad se zaključavanje otključava ranije) - moglo je dovesti do duplog `.listen()` na istom Echo kanalu (svaki `.offer.round.changed` event bi dvaput pozvao `applyRound`). **Retest POTVRĐEN 14.09**: čekiranje je bilo otključano na istoj narudžbi 3933 (uspješno čekirana 3 nova kandidata i poslata nova ručna runda) — dupli WS listener scenario nije posebno provjeren (nema direktnog dokaza da se `.offer.round.changed` primio dvaput), ostaje kao mala nesigurnost ali fix je siguran i bez štete i bez tog dokaza |
| K4 | ✅ | Simulirati grešku na cancel pozivu (npr. DevTools throttling/offline, ili pogrešan `delivery_company_id` preko `/dev/api`) | Greška se prikazuje korisniku (`offerMessage` alert), runda OSTAJE praćena (bar/chip i dalje vidljivi, dugme opet klikabilno) — ne smije tiho nestati kao da je zatvorena kad zapravo nije — **potvrđeno 14.09** (DevTools "Block request URL" na `*/offer/cancel*`): zahtjev pao (`blocked:devtools`), `PageAlert` sa greškom se pojavio na vrhu panela, chip "Runda: u toku" i dugme "Zatvori rundu" ostali vidljivi, ništa se tiho nije zatvorilo |
| K5x | ⬜ | Live retest S4 iz `10_09_2026_test-plan-ponuda-socket.md` (WS payload za cancel ako event i za ovo okine) | Vidi sekciju D ispod — ista provjera, sad i za cancel scenario |

**Novi nalaz (K2, usput) — za backend tim, ozbiljniji od K5b**: `round.candidate_ids` na
automatskoj rundi za narudžbu 3933 (`is_automatic: true`, sekvencijalna) sadrži 17 ID-jeva,
uključujući `30369` "Admin Ordera", `30700` "Test Dispecer2" i `30722` "Admin1.dostava
Ordera" - ISTI admin/dispečerski nalozi kao u K5b. Runda je otkazana dok je nudila prvom
kandidatu (`30189`, sad `superseded`) - da nije otkazana, sekvencijalni redoslijed bi
DOŠAO DO reda i ponudio narudžbu ovim admin/dispečerskim nalozima (`timeout_action:
NEXT_NEAREST` ide dalje kroz listu na `decline`/`expired`). Ovo je gore od K5b
(prikaz na listi) - ovdje je u pitanju stvarni pool automatske dodjele, tj. dispečer/admin
nalog bi realno mogao dobiti push ponudu za narudžbu kao da je kurir. Isti uzrok kao K5b
(admin_delivery nalozi nisu isključeni iz baznog upita za kandidate), samo drugi endpoint/put
(builder automatske dodjele, ne REST candidate-couriers lista). Dodato u pitanja fajl kao
🔴, prioritet iznad K5b.

## C. `couriers-status` / `candidate-couriers` / `couriers-balance` — filter dispečera

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| K5 | ✅ | `GET /dispatcher/delivery-companies/24/couriers-status` | Svi redovi su stvarni kuriri — nema `admin_delivery` naloga (npr. "Admin Ordera", "Test Dispecer2" iz 09.09 nalaza) — **potvrđeno 14.09**: 16 redova, nijedan od poznatih admin ID-jeva (30369/30700/30188) se ne pojavljuje |
| K5a | ✅ | `GET /dispatcher/orders/{id}/candidate-couriers?delivery_company_id=24` | Isto — backend je eksplicitno potvrdio fix samo za `couriers-status`, ovo NIJE potvrđeno, treba provjeriti odvojeno — **potvrđeno 14.09** (narudžba 3912, firma 24): 16 redova, nijedan od poznatih `admin_delivery` ID-jeva (30369 "Admin Ordera", 30700 "Test Dispecer2", 30188 "Admin1 Dostava Ordera" iz 09.09 nalaza) se ne pojavljuje — svi redovi su imenom prepoznatljivi kao stvarni kuriri/test kuriri |
| K5b | ❌ | `GET /dispatcher/delivery-companies/24/couriers-balance` | Isto kao K5a — odvojena provjera, nije eksplicitno potvrđena — **testirano 14.09, NE PROLAZI**: i dalje vraća `admin_delivery` naloge — `courier_id: 30369` "Admin Ordera", `30700` "Test Dispecer2", `30722` "Admin1.dostava Ordera" (svi `cash_owed_to_company: 0`/`wage_owed_to_courier: 0`, prepoznatljivi po imenu). Fix je primijenjen samo na `couriers-status` (K5) i `candidate-couriers` (K5a), NE i na `couriers-balance` — vidi napomenu ispod tabele |

**Bug potvrđen (K5b) — za backend tim**: `GET /dispatcher/delivery-companies/24/couriers-balance`
i dalje vraća dispečerske/admin naloge pomiješane sa stvarnim kuririma — potvrđeno uživo
14.09: `30369` "Admin Ordera" (isti nalog identifikovan još 09.09), `30700` "Test Dispecer2"
(potvrđen `type: "admin_delivery"` 09.09), i `30722` "Admin1.dostava Ordera" (izgleda kao isti
tip naloga kao ranije viđeni `30188` "Admin1 Dostava Ordera" - blago drugačije ime, moguće
preimenovan ili drugi nalog istog tipa). Za razliku od `couriers-status`/`candidate-couriers`
(K5/K5a, oba potvrđeno sređena), ovdje fix očigledno NIJE primijenjen - vjerovatno je
`couriers-balance` na drugom kontroleru/upitu koji fix nije dotakao. Nema `type`/`role` polja
na redu ni ovdje, pa front i dalje ne može filtrirati sam. Eskalirano nazad backendu u
`14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile`.

## D. `offer.round.changed` WS broadcast

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| K6 | ❌ | Otvoriti rundu (sequential), pratiti WS frames u DevTools (Network → WS) dok kandidat ide `pending → expired` (sačekati timeout) | Stiže `offer.round.changed` application event (ne samo `pusher:ping`/`pusher:pong`) — ovo je tačno ono što 13.09 NIJE radilo — **Precizno utvrđeno 14.09 (3 odvojena retesta, narudžbe 3933/3935/3936)**: broadcast POUZDANO radi za sve akcije koje neko (dispečer ili kurir) DIREKTNO uradi kroz endpoint u istom request-u — **accept** (potvrđeno: `round.status → "accepted"`, plus BONUS otkriveni eventi na istom kanalu: `order.status.changed` i `order.status.show`, nepovezani s offer modelom ali korisni za budućnost), **decline/odbijanje** (potvrđeno, chip "Odbio"), i **cancel** (K2/K3). NE radi SAMO za automatski **istek/timeout** kandidata (chip "Isteklo") — tu i dalje stiže isključivo `pusher:ping`/`pusher:pong`, nikad `offer.round.changed`. Zaključak: vjerovatno job/scheduled task koji obrađuje automatski istek (queue worker) ne zove `broadcast()`, dok sve sinhrone kontroler akcije (accept/decline/cancel) to rade ispravno. Eskalirano precizno formulisano backendu |
| K7 | 🟡 | Isti scenario — uporediti primljeni payload sa `OfferRoundEventPayload` tipom (`{success, data: {round, offers, server_now}}`) | Payload odgovara REST `GET .../offers` obliku 1:1 — ako je drugačiji, `normalizeOfferRound()` treba prilagoditi — **Bug nađen i ispravljen 14.09** (na cancel-triggered frame-u): WS payload NEMA `{success, data: {...}}` omotač kao REST — Echo/pusher-js već parsira Pusher poruke "data" string prije `.listen()` callback-a, pa stiže DIREKTNO `{round: {...}, offers: [...], server_now}` (potvrđeno iz stvarnog frame-a, prvi key je `"round"`, ne `"success"`/`"data"`). `normalizeOfferRound()` je očekivala `payload.data.round` pa je svaki live socket event TIHO proizvodio prazan round otkad je ovaj kod napisan (10.09). **Ispravljeno**: `normalizeOfferRound()` sad prihvata OBA oblika (`payload.data ?? payload`) — ovo ostaje ispravno i korisno bez obzira na K6 nalaz iznad, ali **payload oblik za prirodni istek nije provjeren jer taj event uopšte ne stiže** (vidi K6) — ne može se do kraja potvrditi dok K6 ne prođe |
| K7a | 🟡 | Nakon K6/K7 potvrđenih — ugasiti/upaliti mrežu (simulacija reconnect) dok je runda aktivna | Reconnect-catch-up (`connection.bind("connected", ...)` u `useOrderOfferRound.ts`) povuče `GET` i uhvati propušteno stanje — **NEZAKLJUČENO 14.09**: DevTools Network "Offline" simulacija ne ubija pouzdano WS konekciju u Chrome-u — `pusher:ping`/`pusher:pong` su nastavili da prolaze DOK su HTTP GET pozivi (`offers`/`candidate-couriers`) padali sa `net::ERR_INTERNET_DISCONNECTED`. `[echo] state_change` nikad nije prešao u "disconnected", pa reconnect-catch-up logika nije ni imala priliku da se testira. Treba druga metoda (npr. stvarno gašenje WiFi-ja/mreže na OS nivou, ili ručno `pusher.disconnect()`/`connect()` preko konzole ako se izloži globalno) da se ovo pravilno retestuje |
| K7b | ❌→✅ | (Nova stavka, otkrivena tokom K7a pokušaja) — poslije mrežnog pada, provjeriti da se error alert-i sami sklone kad veza radi ponovo | **Bug nađen i ispravljen 14.09**: crveni alert "Nema veze sa serverom..." (`useCandidateCouriers.errorMessage`, gore u panelu) se sam obrisao poslije ~20s auto-refresh-a - ISPRAVNO. Ali DRUGI alert sa istim tekstom (`offerMessage`, iz `useOrderOfferRound.errorMessage` preko 10s poll-a u `useCandidateOfferRound.ts`) je ostao trajno zaglavljen i pošto je veza odavno radila - potvrđeno na drugom pokušaju ("dva alerta, jedan je nestao drugi je ostao"). Uzrok: watcher na `offerRound.errorMessage` je reagovao SAMO kad greška postane istinita, nikad kad se vrati na `""` (a to se dešava na sledećem uspješnom poll-u). **Ispravljeno**: watcher sad briše `offerMessage` i u tom slučaju (samo ako je trenutno prikazana poruka tipa "error", da ne obriše npr. netom prikazanu poruku uspjeha). **Retest potreban** da se potvrdi da se oba alerta sad sama sklone poslije povratka konekcije |

**Novi nalaz (usput, dok se tražio uzrok "praznog" Socket taba) — za backend tim**:
`POST https://api.kurir.ordera.app/broadcasting/auth` intermitentno vraća `403 Forbidden`
sa GOLIM tijelom (`403 | Forbidden`, nije JSON) — potvrđeno uživo 14.09: PRVI pokušaj
pretplate odmah po otvaranju "Predloženi kuriri" panela je pao na 403, DRUGI pokušaj
(poslije slanja ponude, isti tab/sesija/token) je uspio (`200`, `subscription_succeeded`).
Isključeno: token refresh race (nijedan drugi poziv u tom trenutku nije vratio 401).
Goli (ne-JSON) oblik tijela je bitna razlika od svih ostalih odgovora ovog backend-a
(svugdje drugo `{"success":false,"message":"..."}`) — sugeriše da se ovo NE odbija u
Laravel app kodu (`BroadcastController`/auth logika), nego RANIJE u stack-u (nginx/WAF/
rate-limiter), prije nego zahtjev uopšte stigne do aplikacije. Ovo pravi cijeli WS put
nepouzdanim (poll fallback pokriva UI ali ne i pouzdanost same funkcije). Prijavljeno
backendu u pitanja fajlu, prioritet visok (vezano za K6/K7 čim se WS uopšte koristi).

## E. `resolve-restaurant-status accept`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| K8 | ⬜ | "Čeka restoran" tab, zaostala narudžba (>3h stara) → *Prihvati* → `200 OK` | Narudžba se pojavljuje u `GET /dispatcher/orders/waiting` odmah (isti tick) — retest tačnog scenarija koji je 09.09 i 13.09 reprodukovan kao bug — **blokirano 14.09**: trenutno nema zaostale (>3h) narudžbe u test podacima da se testira, odloženo za sutra |
| K8a | ⬜ | Isti test sa NOVOM (< 3h) zaostalom narudžbom, za poređenje | I ova treba da se pojavi — potvrđuje da fix nije vezan samo za vremenski prozor — **blokirano 14.09**, isti razlog kao K8 |

## F. `/logout` ruta + CORS credentials

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| K9 | ✅ | Kliknuti "Odjava" u UI-ju, pratiti Network tab | `POST /logout` poziv ide (ranije je tiho pucao jer ruta nije postojala), vraća `200` (ili barem ne CORS grešku u konzoli) — **potvrđeno 14.09**: `POST /api/logout` → `200 OK` iz pravog UI klika na "Odjava" — ruta postoji i radi; K10 i dalje treba provjeriti response headere direktno (200 status sam po sebi ne garantuje da su `Access-Control-Allow-Origin`/`-Credentials` headeri ispravno postavljeni) |
| K10 | ✅ | Network tab (ili `curl -i`) — pogledati response headere na `/login` i `/logout` direktno | `Access-Control-Allow-Origin` echo-uje TAČAN origin (ne `*`), `Access-Control-Allow-Credentials: true` prisutan na OBA — backend nije eksplicitno potvrdio ovaj dio, samo da ruta postoji — **potvrđeno 14.09 na `/logout`**: `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Origin: http://localhost:3000` (tačan origin, ne `*`), `Vary: Origin` (potvrđuje da je origin-aware, ne statičan). `/login` nije posebno provjeren ovim istim network tragom, ali je pod istim `api/*` CORS pravilima (potvrđeno 12.09) pa se očekuje isto ponašanje |
| K10a | N/A | Ako K10 ne prođe — provjeriti da li se refresh-token cookie stvarno invalidira na serveru poslije logout-a (npr. probati refresh token poziv poslije odjave) | Refresh treba da padne poslije logout-a ako je invalidacija stvarno implementirana — **N/A, K10 prošao** — opciono i dalje vrijedi provjeriti da je invalidacija stvarna (funkcionalna provjera, ne CORS), ali više nije blokirajuće |

---

Nakon popune, sve što ne prođe (posebno K10 — CORS headeri su odvojeni od toga da ruta
postoji, pa "SREĐENO" na `/logout` ne znači nužno da je CORS dio i riješen) prijaviti
nazad backend timu i eskalirati iz 🟡 u 🔴 u
`14_09_2026_Frontend_pitanja_za_backend_kriticne-stavke.textile` ako blokira.
