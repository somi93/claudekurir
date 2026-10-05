# E2E: stranica Firma (`/dispatcher/company`) u pravom Chrome-u nad lažnim API-jem

**Dvije grupe skripti.** `a-*`, `b-*`, `c-*`, `shots.mjs` mjere STARU stranicu (stanje prije; selektori `.v-form`, `.restaurant-row`) i služe kao dokaz za analizu u `firma-dizajn.html`. `f-*` i `logic-firma.mjs` provjeravaju NOVU, implementiranu stranicu (selektori `data-setting`, `data-company`, `data-row`). Računar je prvi, telefon drugi.

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


## Nova stranica (implementacija)

Pokretanje iz korijena aplikacije (grana `claude/blissful-allen-o8ukzb`, dev server 3100 sa `NUXT_PUBLIC_GPS_API_BASE=http://localhost:4011`, `CHROME_PATH`, `CDP_PORT=9340`, `MDI_DIR`):

```
node docs/2026/10/firma-prototip/e2e/logic-firma.mjs   # 30 provjera čiste logike (utils), bez browsera
node docs/2026/10/firma-prototip/e2e/f-desktop.mjs     # računar 1440×900: 111 provjera
node docs/2026/10/firma-prototip/e2e/f-phone.mjs       # telefon 390×844 + 320 + 150 restorana pri 4× sporijem procesoru: 38 provjera
node docs/2026/10/firma-prototip/e2e/f-company-switch.mjs  # promjena firme u ladici sa nesačuvanim unosom: 11 provjera
node docs/2026/10/firma-prototip/e2e/f-shots.mjs       # snimci cijelog prozora u ../shots/n-*.webp
```

- `flib.mjs`: kontrast svakog teksta (stvarne boje iz stila; onemogućena dugmad izuzeta), mete 44 px (računa i `::after` kojim je meta proširena), polja bez imena, `snap` (snimak bez `captureBeyondViewport`).
- **Zamka alata:** `Page.captureScreenshot` sa `captureBeyondViewport` na tren smanji prozor na 1 px, pa se preklopi raspored računar/telefon i izgubi nesačuvan unos u editoru. Između kucanja i čuvanja zato koristi `snap`, ne `cap` iz `colib.mjs`.
- **Zamka mocka:** `ofetch` sam ponavlja GET pri 500, pa `fails` za čitanje treba `times: 2` (jedan pokušaj i jedno ponavljanje).
- Izmjere važe za probne podatke; ništa nije provjereno nad pravim backendom.
