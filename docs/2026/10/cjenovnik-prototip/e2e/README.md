# E2E: stranica Cjenovnik (`/dispatcher/pricing`) u pravom Chrome-u nad lažnim API-jem

Alat je isti kao u `docs/2026/10/firma-prototip/e2e/` (`cdp.mjs`, `nh.mjs`, `fx.mjs`, `nfx.mjs`, `co-fx.mjs`, `colib.mjs`, `flib.mjs`), proširen fajlom `pr-fx.mjs`
(cijena, `pricing/calculate`, doplate, katalog `condition-tags`, pravila za vozila, `recommend-vehicle`, zone). Mock odgovara presretanjem u pregledniku (Fetch domena),
poseban server ne treba.

**PRETPOSTAVKE mocka (nisu provjerene nad pravim backendom, vidi pitanja B1 do B5 u dokumentu):**
- `recommend-vehicle` uzima PRVO pravilo koje se poklopi, po rastućem `priority` (B1);
- `PUT …/pricing` vraća 422 u Laravel obliku za prazan ili negativan broj (B5);
- brisanje doplate ne kaskadira na pravila (B4).

## Pokretanje (iz korijena aplikacije, grana `master`)

```
npm install
mkdir -p /tmp/mdi && (cd /tmp/mdi && npm init -y && npm i @mdi/font@5.9.55)     # bez ovoga su ikone prazne
NUXT_PUBLIC_GPS_API_BASE=http://localhost:4011 npx nuxt dev --port 3100 --host 127.0.0.1 &
export REPO_ROOT=$PWD CHROME_PATH=/path/to/chrome CDP_PORT=9340 MDI_DIR=/tmp/mdi/node_modules/@mdi/font/
node docs/2026/10/cjenovnik-prototip/e2e/a-measure.mjs   > a-measure.json   # STARA stranica, računar: raspored, kontrast, mete, tokovi, stanja
node docs/2026/10/cjenovnik-prototip/e2e/a-extra.mjs     > a-extra.json     # prazno polje (izuzetak), valuta, simulacija, telefon
node docs/2026/10/cjenovnik-prototip/e2e/shots.mjs                          # snimci sa crvenim oznakama u e2e/shots/{d,p}/
node docs/2026/10/cjenovnik-prototip/e2e/shadow.mjs                         # novo pravilo iza „Uvijek“, simulacija 3 km
```

Prototip i tabla (ne traže aplikaciju ni dev server):

```
python3 docs/2026/10/cjenovnik-prototip/build.py          # sklapa cjenovnik-dizajn.html iz board.template.html + app.css + app.js + shots/*.webp
node docs/2026/10/cjenovnik-prototip/e2e/proto-check.mjs  # 21 stanje prototipa: kontrast, mete 44 px, imena polja, font, konzola
BOARD=/apsolutna/putanja/board.html OUT=/tmp/out node docs/2026/10/cjenovnik-prototip/e2e/board-test.mjs   # 35 provjera tokova (board.html = doctype + cjenovnik-dizajn.html)
```

## Zamke alata
- `nuxt dev` prvi put optimizuje zavisnosti i ponovo učita stranicu: čekaj klijentski sadržaj (`input[type=number]`), ne `.global-page` (to je SSR kostur prije hidracije).
- `Page.captureScreenshot` sa `captureBeyondViewport` na tren smanji prozor; između kucanja i čuvanja koristi `snap` iz `flib.mjs`. Clip koordinate su dokumentne (dodaj `scrollY`).
- Klizač Vuetify-a se pomjera tasterima na `.v-slider-thumb`, ne na `input`. Prva `.v-slider` na stranici je skriveni kalkulator sa taba Cijena: ciljaj `.v-window-item--active`.
- `pkill -f` sa portom u istoj komandi ubije i sam shell; Chrome iz prethodne skripte zatvori sa `kill <pid>`.
- Izmjere važe za probne podatke; ništa nije provjereno nad pravim backendom.
