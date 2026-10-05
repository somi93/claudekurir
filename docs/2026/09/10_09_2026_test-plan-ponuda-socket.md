# Test plan — model ponude + socket (10.09.2026)

Kratka, akciona lista. Za svaki red: okini poziv (curl šabloni na dnu), iskopiraj
**cijeli response** (status + tijelo) u zadnju kolonu, precrtaj `#` kad je gotovo.
Puni kontekst je u `10_09_2026_odgovor-backend-ponuda-socket.textile`; otvorena pitanja
koja ovo treba da zatvori su `10_09_2026_Frontend_pitanja_za_backend.textile` DIO A.

- **API baza:** `https://api.kurir.ordera.app/api`
- **WS:** `wss://ws.kurir.ordera.app:443` · app key `uqrwfjx8bqxf0qtfhmrt`
- **Ulogovan kao:** dispečer firme **24** (`$TOKEN`) + jedan kurirski nalog (`$CTOKEN`, za K1–K4)
- **Test podaci (izvedi kroz Setup):** `$ORDER` = narudžba koja čeka kurira (firma 24) ·
  `$C1`, `$C2` = dva `courier_id` iz `candidate-couriers` te narudžbe
- **Napomena 11.09:** `GET /offers` vraća `422` bez `delivery_company_id` (potvrđeno
  uživo — `{"delivery_company_id":["The delivery company id field is required."]}`).
  Backend ugovor (2.3/2.4) ovo nije pominjao. Frontend je popravljen (query param na
  D1/D2, kao i na `waiting`/`candidate-couriers`). Curl šabloni ispod su ažurirani da
  ga uvijek šalju — ako `POST /offer` (D1) *ne* traži isti parametar, to je vrijedno
  zabilježiti kao razliku od GET-a.
- **Napomena 12.09:** D1 + D2 odrađeni uživo na #3892 (firma 24) — prošli, oblik
  odgovora (`{success, data:{round, offers, server_now}}`) i pitanja koja otvara su u
  `12_09_2026_Frontend_pitanja_za_backend.textile` (DIO A.5/A.6/A.8). S1 prvo blokiran
  CORS-om, backend popravio (`broadcasting/auth` dodat u `config/cors.php` paths) —
  **potvrđeno uživo isti dan da radi** (narudžba #3904, `CandidateCouriersPanel`): auth
  bez CORS greške, runda i countdown se ispravno prikazuju. S1 zatvoreno. Ostaje S4 (da
  li countdown stiže preko pravog WS eventa ili poll fallback-a) i K1–K4.
- **Setup pozivi:** `POST /login` → token · `GET /dispatcher/orders/waiting` → `ORDER` ·
  `GET /dispatcher/orders/{ORDER}/candidate-couriers` → `C1`, `C2`
- **Dev alat:** `/dev/api` — mini-Postman u aplikaciji (metoda + putanja + JSON body).
  Radi za dispečera i kurira. Token se kači automatski; **Token override** polje da
  gađaš tuđe endpointe iz svoje sesije. Ima gotove prečice za sve redove ispod
  (Setup / D1–D5 / K1–K3 / S1–S3 / V1–V6) + "Kopiraj kao curl" / "Kopiraj odgovor".

---

## PRIORITET 1 — dispečerske offer rute (postoje? koji oblik?)

| # | Šta | Kako | Šta gledamo |
|---|---|---|---|
| ~~D1~~ | ~~otvori rundu~~ | **PROŠAO 12.09** | `201`, tijelo `{success,data:{round,offers,server_now}}` (oblik potvrđen u `12_09_2026_Frontend_pitanja_za_backend.textile` A.5) — identično D2 GET tijelu, front ne mora zvati GET odmah poslije POST-a (A.6) |
| ~~D2~~ | ~~stanje runde~~ | **PROŠAO 12.09** | omotač `{success:true, data:{round:{id,order_id,mode,batch_size,is_automatic,status,timeout_seconds,candidate_ids,timeout_action,accepted_by,created_at,resolved_at}, offers:[{courier_id,offer_status,offer_expires_at,responded_at}], server_now}}`; `offers` niz RASTE (ne zamjenjuje), potvrđeno u backend kodu (A.5) |
| ~~D3~~ | ~~GET bez runde~~ | **PROŠAO 13.09** | narudžba #3912 (bez ikad otvorene runde): `200 {"success":true,"data":{"round":null,"offers":[]}}` — čisto, nema 404 dvosmislenosti; front može zvati ovo pri svakom otvaranju narudžbe bez posebnog error-handlinga |
| ~~D4~~ | ~~dvostruki offer~~ | **PROŠAO 13.09** | `409 {"success":false,"message":"Za ovu narudžbu vec postoji aktivna ponuda.","order_status":"ACCEPTED"}` — čista poruka, front može prikazati direktno |
| D5 | prekid runde | `DELETE /dispatcher/orders/{ORDER}/offer` **i** `POST /dispatcher/orders/{ORDER}/offer/cancel` | 🔴 **BLOKIRANO 13.09** — ni jedna ne postoji: `DELETE` → `405` (`Supported methods: POST`, ruta `.../offer` je POST-only), `POST .../offer/cancel` → `404` (ruta ne postoji uopšte). Nema backend načina da se aktivna runda prekine — "Zatvori rundu" na frontu i dalje samo gasi klijentsku pretplatu, backend job nastavlja da šalje ponude dalje. **Treba pitati backend koja je prava ruta / da li treba da se doda.** |

Ako D1 + D2 prođu → parser u `orderOffersService.ts` prestaje da nagađa oblik.

---

## PRIORITET 2 — kurirska strana (kurirski token `$CTOKEN`)

| # | Šta | Kako | Šta gledamo |
|---|---|---|---|
| ~~K1~~ | ~~lista ponuda~~ | **PROŠAO 12.09** | narudžba #3896: red nosi **pun `order` objekat** (`restaurant`, `location` sa `coordination`/`city`, `currency`, `state`) + `restaurant_name`/`delivery_price` na top-levelu; polje je `expires_at` (bez `offer_` prefiksa, za razliku od dispečerskog reda); nema `offer_status` — ruta vraća samo ponude koje čekaju (vidi A.11 u `12_09_2026_Frontend_pitanja_za_backend.textile`) |
| ~~K2~~ | ~~odbij~~ | **PROŠAO 13.09** (narudžba #3915) | `200 {"success":true,"message":"Ponuda odbijena."}` — čist odgovor. Provjera D2 (advance na sljedećeg) u toku. |
| ~~K3~~ | ~~prihvati~~ | **PROŠAO 13.09** (narudžba #3914, kurir 30189, kroz pravi UI tok — `CandidateCouriersPanel` "Pošalji ponudu") | `accept` response nosi pun order objekat, `state → STATE_BOOKED_DELIVERY`. `D2` poslije potvrđuje: `round.status:"accepted"`, `accepted_by:30189`, offer red `offer_status:"accepted"`, `responded_at` popunjen — potpuno konzistentno. (Prvi pokušaj sa kurirom 30189/#3897 pao na `409` cash limit, nepovezano - vidi DIO E. Drugi pokušaj na #3915 je zapravo bio kroz "Direktno dodijeli" na tabli, ne kroz offer-response - taj put ne dira round tabelu uopšte, riješena zabuna, nije bug.) `GET /orders/driver/30189` (K3b) potvrđuje istu narudžbu u listi. |
| ~~K4~~ | ~~kasno / tuđe~~ | **PROŠAO 13.09** (narudžba #3915, runda već `exhausted`) | `404 {"success":false,"message":"Nemate aktivnu ponudu za ovu narudzbu."}` — čista poruka, front lako razlikuje od stvarne greške |

---

## PRIORITET 3 — broadcasting auth + WebSocket

`socket_id "123.456"` je lažan pa je `403` moguć i na tačnom hostu — gledamo **koja ruta
uopšte odgovara auth logikom** (ne 404 / 405 / 419).

| # | Šta | Kako | Šta gledamo |
|---|---|---|---|
| ~~S1~~ | ~~auth, API host~~ | **PROŠAO 12.09** | prvo blokiran CORS-om (`broadcasting/auth` nije bio u `config/cors.php` paths) — backend popravio, potvrđeno uživo isti dan na `CandidateCouriersPanel` (#3904): auth bez CORS greške, runda i countdown se ispravno prikazuju |
| ~~S2~~ | ~~auth, API host + `/api`~~ | **PRESKOČENO 13.09** | nepotrebno — S1 (`https://api.kurir.ordera.app/broadcasting/auth`) je već potvrđen uživo (radi, ugrađen u `nuxt.config.ts:36` kao `authEndpoint`), nema razloga tražiti alternativu |
| ~~S3~~ | ~~auth, WS host~~ | **PRESKOČENO 13.09** | isto obrazloženje kao S2 |
| ~~S4~~ | ~~WS smoke~~ | 🔴 **NALAZ 13.09** — preko pravog UI-ja (DevTools Network → WS → Messages), narudžba #3921 | Auth/subscribe je čist: `pusher:subscribe` → `pusher_internal:subscription_succeeded` na `private-orders.3921` (18:06:53). Ali dok su 2 kandidata vidljivo prešla u "Isteklo" i runda u "exhausted", u Messages tabu se pojavljuju SAMO `pusher:ping`/`pusher:pong` (svakih ~30s) — **nijedan `offer.round.changed` frame nije stigao**. Front sluša tačno taj event (`useOrderOfferRound.ts:19,28`, `.offer.round.changed` na `orders.{id}`), pa se UI ažurirao isključivo preko 10s poll fallback-a, ne preko socketa. **Backend ili ne emituje ovaj broadcast, ili pod drugim imenom/kanalom — treba pitati.** |

Koja od S1–S3 vrati `200 {auth}` → to ide u `runtimeConfig.public.reverb.authEndpoint`.

---

## PRIORITET 4 — validacione probe `POST /dispatcher/orders/{ORDER}/offer`

Na narudžbi koja **čeka kurira** (osim V7).

| # | Tijelo | Šta gledamo |
|---|---|---|
| ~~V1~~ | ~~prazan `courier_ids`~~ | **PROŠAO 13.09** — `422 {"message":"The courier ids field is required.","errors":{"courier_ids":["The courier ids field is required."]}}` (Laravel standardni oblik; prazan niz `[]` pada na `required`, ne posebno na min-length pravilo) |
| ~~V2~~ | ~~kurir van liste~~ | 🟠 **NALAZ 13.09** — `201`, `round.status:"active"` otvorena SA `courier_id: 999999999` (potpuno nepostojeći, nije čak ni validan user id) kao jedinim kandidatom. Backend ne provjerava da li `courier_ids` postoje niti da su iz `candidate-couriers` liste te narudžbe — sequential runda bi čekala pun timeout na kandidata koji nikad neće odgovoriti. Upisano kao pitanje backendu (DIO H). |
| ~~V3~~ | ~~bez `mode`~~ | **PROŠAO 13.09** — `422 {"message":"The mode field is required.","errors":{"mode":["The mode field is required."]}}` — potvrđuje B.1 (mode je required, nema default) |
| ~~V4~~ | ~~mode parallel~~ | **PROŠAO 13.09** — `201`, `round.mode:"parallel"` prihvaćen bez ograničenja (`batch_size` ostaje `1` — potvrđuje B.2: ručna runda uvijek `batch_size:1` bez obzira na `mode`, firmin `assignment_mode` se ne primjenjuje ovdje) |
| ~~V5~~ | ~~timeout 3 (min?)~~ | **PROŠAO 13.09** — `422 {"message":"The offer timeout seconds field must be at least 5.","errors":{"offer_timeout_seconds":["..."]}}` — min 5 potvrđen |
| ~~V6~~ | ~~timeout 999 (max?)~~ | **PROŠAO 13.09** — `422 {"message":"The offer timeout seconds field must not be greater than 120.",...}` — max 120 potvrđen, raspon 5-120 zatvoren (V5+V6) |
| ~~V7~~ | ~~on-hold narudžba~~ | **PROŠAO 13.09** — `409 {"success":false,"message":"Narudzba nije u stanju u kojem se moze ponuditi kuriru.","order_status":"ON_HOLD"}` — isti oblik kao D4, čitljiva poruka |

---

## Setup + curl šabloni

```bash
# --- Setup ---
# tokeni
curl -sS -X POST https://api.kurir.ordera.app/api/login \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"username":"admin.dispecer@ordera","password":"<lozinka>"}'
export TOKEN=...          # dispečer firme 24
export CTOKEN=...         # kurirski nalog (isti /login)

# narudžba koja čeka kurira
curl -sS 'https://api.kurir.ordera.app/api/dispatcher/orders/waiting?delivery_company_id=24' \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'
export ORDER=...

# rangirani kandidati -> uzmi 2 courier_id
curl -sS "https://api.kurir.ordera.app/api/dispatcher/orders/$ORDER/candidate-couriers?delivery_company_id=24" \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'
export C1=...
export C2=...
```

```bash
# --- D1 --- (delivery_company_id dodat kao query - provjeri da li POST i dalje traži i ovo)
curl -sS -i -X POST "https://api.kurir.ordera.app/api/dispatcher/orders/$ORDER/offer?delivery_company_id=24" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"courier_ids\":[$C1,$C2],\"mode\":\"sequential\",\"offer_timeout_seconds\":25}"

# --- D2 --- (delivery_company_id OBAVEZAN - potvrđeno 422 uživo 11.09)
curl -sS -i "https://api.kurir.ordera.app/api/dispatcher/orders/$ORDER/offers?delivery_company_id=24" \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'

# --- D3 --- (zamijeni <DRUGA>)
curl -sS -i "https://api.kurir.ordera.app/api/dispatcher/orders/<DRUGA>/offers?delivery_company_id=24" \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'

# --- D5 ---
curl -sS -i -X DELETE "https://api.kurir.ordera.app/api/dispatcher/orders/$ORDER/offer?delivery_company_id=24" \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'
curl -sS -i -X POST "https://api.kurir.ordera.app/api/dispatcher/orders/$ORDER/offer/cancel?delivery_company_id=24" \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json'

# --- K1 ---
curl -sS -i "https://api.kurir.ordera.app/api/courier/offers" \
  -H "Authorization: Bearer $CTOKEN" -H 'Accept: application/json'

# --- K2 / K3 ---
curl -sS -i -X POST "https://api.kurir.ordera.app/api/orders/$ORDER/offer-response" \
  -H "Authorization: Bearer $CTOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"action":"decline"}'
curl -sS -i -X POST "https://api.kurir.ordera.app/api/orders/$ORDER/offer-response" \
  -H "Authorization: Bearer $CTOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"action":"accept"}'

# --- S1 / S2 / S3 ---
curl -sS -i -X POST https://api.kurir.ordera.app/broadcasting/auth \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"socket_id\":\"123.456\",\"channel_name\":\"private-orders.$ORDER\"}"
curl -sS -i -X POST https://api.kurir.ordera.app/api/broadcasting/auth \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"socket_id\":\"123.456\",\"channel_name\":\"private-orders.$ORDER\"}"
curl -sS -i -X POST https://ws.kurir.ordera.app/broadcasting/auth \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"socket_id\":\"123.456\",\"channel_name\":\"private-orders.$ORDER\"}"

# --- V1..V7 --- (zamijeni <TIJELO> iz tabele PRIORITET 4)
curl -sS -i -X POST "https://api.kurir.ordera.app/api/dispatcher/orders/$ORDER/offer?delivery_company_id=24" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '<TIJELO>'
```

```js
// --- S4: ws-test.mjs ---  (npm i laravel-echo pusher-js u praznom folderu)
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
global.Pusher = Pusher;

const TOKEN = process.env.TOKEN;
const ORDER = process.env.ORDER;
const AUTH  = process.env.AUTH ?? 'https://api.kurir.ordera.app/broadcasting/auth';

const echo = new Echo({
  broadcaster: 'reverb',
  key: 'uqrwfjx8bqxf0qtfhmrt',
  wsHost: 'ws.kurir.ordera.app',
  wsPort: 443, wssPort: 443,
  forceTLS: true,
  enabledTransports: ['wss'],
  authorizer: (channel) => ({
    authorize: (socketId, cb) =>
      fetch(AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json',
                   Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
      }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
        .then(d => cb(null, d)).catch(e => cb(e, null)),
  }),
});

echo.connector.pusher.connection.bind('state_change',
  s => console.log('conn:', s.previous, '->', s.current));
echo.private(`orders.${ORDER}`)
  .subscribed(() => console.log('SUBSCRIBED orders.' + ORDER))
  .error((e) => console.log('SUB ERROR', JSON.stringify(e)))
  .listen('.offer.round.changed',
    (d) => console.log('EVENT offer.round.changed:\n', JSON.stringify(d, null, 2)));
// pokreni:  TOKEN=... ORDER=... node ws-test.mjs
```
