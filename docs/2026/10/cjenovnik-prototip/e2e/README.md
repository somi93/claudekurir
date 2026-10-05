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


## Nova stranica (implementacija)

Pokretanje iz korijena aplikacije (grana `claude/amazing-mayer-uwcb4s`, dev server 3100 sa `NUXT_PUBLIC_GPS_API_BASE=http://localhost:4011`, `CHROME_PATH=/opt/pw-browsers/chromium`, `CDP_PORT=9340`, `MDI_DIR`):

```
node docs/2026/10/cjenovnik-prototip/e2e/logic-pricing.mjs    # 168 provjera čiste logike (utils/pricing.ts, utils/pricingDrafts.ts), bez browsera
node docs/2026/10/cjenovnik-prototip/e2e/logic-workspace.mjs  # 19 provjera radnog prostora (usePricingWorkspace i composables) nad lažnim serverom, bez browsera
node docs/2026/10/cjenovnik-prototip/e2e/p-smoke.mjs          # 471 provjera u pravom Chrome-u: računar 1440x900, telefon 390x844, uzak telefon 320x640
```

`p-smoke.mjs` za svaku veličinu prozora učita stranicu, obiđe tri taba, otvori editore i prijavi: greške u konzoli (console.error, Vue warn, hydration), `data-pricing` kuke koje fale,
vodoravni skrol, mete ispod 44 px, kontrast ispod 4,5:1, polja bez imena, PUT/POST/DELETE tijela (cijena, prekidač, izmjena i nova doplata, pomjeranje i novo pravilo, brisanje doplate sa pravilom),
pitanje pri prelasku taba sa nesačuvanim nacrtom i donje listove na telefonu. `ONLY=...` bira scenarije.

Zamke: `pr-fx.mjs` PUT doplate diže `activated_at` samo kad tijelo nosi `active` (izmjena naziva ili iznosa ga ne dira); širina prelaska na dva stupca je `PRICING_WIDE_QUERY` u `app/composables/usePricingView.ts`
(rupa 1145 do 1215 px: bočna traka je već stalna, a radna kolona bi bila uža od 480 px, pa tu ostaje jedna kolona sa trakom Primjera).
Izmjere važe za probne podatke; ništa nije provjereno nad pravim backendom (pitanja 28 do 36 u `05_10_2026_Frontend_pitanja_za_backend.textile`).
