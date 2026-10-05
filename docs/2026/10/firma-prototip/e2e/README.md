# E2E: stranica Firma (`/dispatcher/company`) u pravom Chrome-u nad lažnim API-jem

Dopuna alata iz `docs/2026/10/poruke-prototip/e2e/` (isti `cdp.mjs`, `nh.mjs`, `fx.mjs`, `nfx.mjs`). Ovdje je `nh.mjs` proširen:
- `finance-settings` je stanje po firmi (GET i PATCH, PATCH vraća 422 za nepoznatu valutu i neispravan `payout_period_days`),
- `GET /dispatcher/{id}/restaurants` i `PATCH /dispatcher/restaurant-delivery-company/{id}` (`co-fx.mjs` pravi 12 ili 150 restorana),
- stilski fajl ikona `@mdi/font` se servira lokalno (bez interneta ikone su prazne); putanja je `MDI_DIR` (npr. `npm i @mdi/font@5.9.55` u `/tmp/mdi`).

Pokretanje (iz korijena aplikacije, grana `master`; dev server na 3100 sa `NUXT_PUBLIC_GPS_API_BASE=http://localhost:4011`):

```
REPO_ROOT=$PWD CHROME_PATH=/path/to/chrome CDP_PORT=9340 node docs/2026/10/firma-prototip/e2e/a-finance.mjs
```

- `a-finance.mjs` – računar, tab Finansijske postavke: visina, neimenovana polja, mete, kontrast, limit isključi/uključi (PATCH tijelo), 422, tastatura na tabovima.
- `a-errors.mjs` – 422 dok je korisnik na dnu, pad učitavanja (500), sporo učitavanje, nesačuvano pri promjeni taba i firme, nesnimljena valuta.
- `b-rest.mjs` – tab restorani: statusi, filteri, kontrast, suspenzija (PATCH), 403 sa povratkom, detalj, 150 restorana pri 4× sporijem procesoru.
- `c-phone.mjs` – telefon 390×844 (dodir, razmjera 2): visina, položaj Sačuvaj, mete, dijalozi.
- `shots.mjs` – snimci sa crvenim oznakama koji su u dokumentu `firma-dizajn.html` (`colib.mjs`: `cap`, `markAt`, `pt`, `measure`).

Napomena: izmjere važe za probne podatke; ništa nije provjereno nad pravim backendom.
