# E2E alati: pravi Chrome bez pravog backenda

Namjena: provjera Nuxt aplikacije u pravom headless Chrome-u (CDP preko `ws`, bez puppeteer-a), sa API-jem koji
odgovara sama skripta. Nije dio aplikacije; kopirano iz radne sesije od 05.10.2026.

## Fajlovi
- `cdp.mjs` – pokretač Chrome-a + CDP klijent (`launch()`; `close()` čeka izlaz Chrome-a i BRIŠE privremeni profil).
  Podešavanje: `REPO_ROOT` (default trenutni direktorijum; odatle se učitava `ws` iz `node_modules`), `CHROME_PATH`, `CDP_PORT` (default 9335).
- `nh.mjs` – `session(name, {width, height, world})`: otvara stranicu, presreće API (Fetch.enable), vodi dnevnik zahtjeva, `load()`, `setFlags()`, `evalJs()`, snimci.
- `nfx.mjs`, `fx.mjs` – izmišljeni svijet (kuriri, lokacije, saldo, sandučići, firme); `world: {n: 28}` bira broj kurira.
- `nlib.mjs`, `contrast.mjs` – pomoćne (klikovi pravim događajima, kontrast WCAG po tekstu).
- `n0-smoke.mjs`, `n1-states.mjs` – primjeri skripti nad pravom stranicom (stanja, učitavanje, greške).

## Kako se koristi
1. Pokreni dev server usmjeren na lažni API host (port ne mora imati ništa na sebi, skripta presreće zahtjeve):
   `NUXT_PUBLIC_GPS_API_BASE=http://localhost:4011 npx nuxt dev --port 3100 --host localhost`
   (`nh.mjs` očekuje `E2E_BASE` = `http://localhost:3100` i API host `http://localhost:4011`; provjeri `window.__NUXT__.config.public.gpsApiBase`.)
2. Iz korijena repozitorijuma: `node docs/2026/10/poruke-prototip/e2e/n0-smoke.mjs` (ili vlastita skripta koja uvozi `./nh.mjs`).
3. Prijava: token ključ je `dispatcher-token` u localStorage (ubacuje se `Page.addScriptToEvaluateOnNewDocument`); `/me` odgovara skripta.
4. Cloud/Linux: potreban Chrome ili Chromium (`apt install chromium` ili `CHROME_PATH=...`); `--no-sandbox` je već u pokretaču.
   Ako ništa od ovoga nije dostupno, ne izmišljaj rezultate: napiši koje su provjere preskočene.

## Pravila koja su se isplatila
- Pravi događaji: `Input.dispatchMouseEvent` na sredini elementa (hvata prekrivene mete; `el.click()` ne), tipke `Input.dispatchKeyEvent`
  (Enter na dugmetu traži `text:"\r"`, Space `text:" "`), dodir `Input.dispatchTouchEvent`.
- Prije klika čekaj ~450 ms nakon otvaranja `v-menu`/sheet-a (animacija promaši stavku).
- Provjere piši UPOREDO sa kodom i pokreni ponovo poslije svake ispravke; pogledaj snimak svakog stanja očima, ne samo prolaz/pad.
- Većina "pada" u prvom prolazu su greške testa: reproduciraj sa malom probnom skriptom prije nego dirneš proizvod.
- Čiste utils provjeri običnim Node-om: esbuild (u `node_modules`) bundle sa `alias: { "~": "<repo>/app" }`.
- Mjeri istim mjerilom prije/poslije (broj dodira, zahtjeva, kontrast svakog teksta, mete 44 px, Tab redoslijed, 500 kurira pri `Emulation.setCPUThrottlingRate {rate:4}`).
- `Emulation.clearGeolocationOverride` nikad (visi na pravom OS-u). Ne mijenjaj `app/` dok traje paket testova (HMR).
- Snimak: `Page.captureScreenshot` sa `clip` koristi koordinate DOKUMENTA (dodaj scroll) i `captureBeyondViewport: true`.
- Headless Chrome javlja `prefers-color-scheme: dark`; za svijetlu temu postavi `data-theme="light"`.
- Disk: svaki `launch()` pravi profil u temp direktorijumu; `close()` ga briše. Ako skripta pukne prije `close()`, obriši `cdp-*` iz temp-a.
- Produkcijska provjera: kopija `app/`, `public/`, konfiguracije u scratch direktorijum sa PRAVOM kopijom `node_modules`, `nuxt build`,
  `node .output/server/index.mjs` sa istim `NUXT_PUBLIC_GPS_API_BASE`; `E2E_BASE` pokaži na taj port.
