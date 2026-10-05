# Handoff: implementacija stranice Poruke (/dispatcher/notifications)

Datum analize: 05.10.2026. Ovaj fajl je namijenjen sesiji koja implementira; ne zna ništa iz prethodnog razgovora.
Jezik komunikacije sa korisnikom: srpski (latinica). Ne commit-uj dok korisnik ne zatraži; ne diraj stare datirane
dokumente (svaki dan ima svoj fajl, pitanja za backend idu u NOVI/današnji).

## Šta se radi
Stranica `app/pages/dispatcher/notifications.vue` (kompozer + istorija svih kurira + FormDialog) se prepisuje u radni
prostor "Poruke". Analiza, 18 nalaza i prototip koji radi su gotovi. Odluke su preporuke D1–D15 ispod; **korisnik nije
naveo veto ni na jednu**, pa se grade sve preporuke (D1, D9, D10, D11, D13 su označene kao moguć veto: ako korisnik kaže
drugačije, prati njega). Faza 2 se NE gradi.

Izvor istine za tekst i logiku (kopirano u `docs/2026/10/poruke-prototip/`):
- `logic.js` – čista logika (PRESETS, audienceOf, sendPlan, checkDraft, matchSent, takeNext k-way merge, TEMPLATES...). Portuj u `app/utils/*.ts` PRVO, provjeri običnim Node-om (`logic-test.mjs` ima 34 provjere; esbuild bundle sa `alias {"~": "app"}`).
- `world.js` fiksture (28 izmišljenih kurira, poruke, ponude), `p0-core.js` lažni server, `p1..p5` prikazi/tokovi/događaji prototipa, `msg.css`/`app.css` stilovi, `board.body.html` kompletan tekst table (nalazi F1–F18, odluke, redosled, backend B1–B8; `__M_x__` su mjerenja koja ovdje nisu razriješena).
- Prototip nije Vue kod: portuj ponašanje i tekstove, ne markup. Aplikacijski tokeni i komponente su u repou.

## Postojeće u repou što se koristi / dira
- `app/composables/useCourierRoster.ts`, `app/utils/courierRoster.ts` (`buildRoster`, `matchCourier`, `isEveryone`), `app/components/dispatcher/roster/*` (MessageSheet, RosterRow, RosterFilters, RosterDetail) – ekran Kuriri, isti obrazac spisak+detalj.
- `app/composables/useCourierMessaging.ts`, `app/services/courierInboxService.ts`, `app/types/inbox.ts`, `app/utils/inbox.ts`, `app/models/InboxMessage.ts`, `app/components/inbox/*`.
- Zajedničke komponente: AppSheet, AppButton, ChoiceGroup, TintAlert, SheetField, SheetTextarea, PageHeader, GlobalPage (`app/components/common/`). Navigacija: `app/utils/navigation.ts` (stavka "Obaveštenja").
- Ne diraj izmjene korisnika na Kuriri osim D13/D11 (tačno navedeno ispod).

## API (samo postojeće rute)
- `POST /dispatcher/delivery-companies/{id}/broadcast` tijelo `{title, message, category, all_couriers:true}` ili `{all_couriers:false, courier_ids:[...]}`; odgovor samo `sent_to_count`.
- `POST /couriers/{id}/inbox`; `GET /couriers/{id}/inbox?category&page&per_page` (meta samo uz `?page`); `DELETE /inbox/{id}`.
- `GET …/inbox-summary`: **zagađen ponudama** (`category:"offer"`, kreirane nepročitane, nikad se ne čiste; doc 21.09 R11). Nova stranica ga NE čita (D12). Kategorija `offer` je rezervisana, dispečer je nikad ne bira.
- Kategorije za dispečera: obavještenje (`announcement`; natpis "Obaveštenje", čip "Obaveštenja") i ostale iz postojećeg koda; provjeri `app/types/inbox.ts`.

## Nalazi (kratko, dokaz je u board.body.html)
F1 istorija kurira pokazuje ponude ili ništa (jedna stranica od 20, filtrira sender na klijentu); F2 pretpregled i "nepročitano" iz zagađenog sažetka; F3 Enter u Naslovu šalje svima (1 POST, `all_couriers:true`, bez potvrde); F4 slanje svima bez pregleda; F5 primaoci kao imena u meniju bez konteksta; F6 nema traga poslatog (briši grešku iz 25 sandučića = 75 dodira); F7 "Nema kurira" tokom učitavanja i pri padu; F8 pretraga nalazi 3 od 12 upita (matchCourier 12/12); F9 nacrt se gubi; F10 brojke se ne osvježavaju; F11 kontrast 2.27–2.71; F12 mete <44 px; F13 tastatura; F14 skala 500; F15 raspored; F16 naziv; F17 nepoznato šalje li push; F18 množina u čipu.

## Odluke
- **D1** (moguć veto) naziv "Poruke" u meniju/naslovu/kartici na početnoj; ruta ostaje.
- **D2** raspored kao Kuriri: spisak 400 px lijevo, poruka desno; telefon jedna kolona, Pošalji zalijepljen uz dno; kontrast ≥4.5, mete ≥44 px.
- **D3** primaoci su pravila računata u času slanja, 6 grupa (aktivni, u dostavi, uživo, offline, duguju gotovinu, suspendovani); suspendovani su van svih osim "Duguju gotovinu" i "Suspendovani"; izbor je skup id-jeva.
- **D4** izbor vidljiv u spisku (kvačica, klik na red = ručni izbor, strelice, jedno Tab mjesto), pretraga `matchCourier`, 12 redova po stranici.
- **D5** pregled "Tako kurir vidi poruku" (jednosmjerno: "Odgovor nije moguć").
- **D6** potvrda od 10 primalaca (CONFIRM_AT=10).
- **D7** nacrt se čuva sam (naslov, tekst, kategorija, izbor), baner "Vraćen nacrt od 14:20 · Odbaci nacrt", stariji od 7 dana se odbacuje.
- **D8** Enter u Naslovu ide na tekst; Ctrl+Enter i dugme prolaze iste provjere i potvrdu.
- **D9** (moguć veto) praćenje čitanja po sandučićima: do 40 primalaca (CHECK_MAX), 6 istovremeno, poklapanje po tekstu u ±15 min (matchSent sa `taken`), ručno + automatski nakon ~20 s i ~2 min; kartica "Poslato u ovoj sesiji" (sessionStorage). Staje ako padne >1/3 zahtjeva.
- **D10** (moguć veto) "Povuci poruku": `DELETE /inbox/{id}` po primaocu, uz pitanje i napomenu da ko je pročitao, pročitao je; podsjetnik samo nepročitanima (prefiks "Podsjetnik: ").
- **D11** (moguć veto) istorija kurira kao list: tri zahtjeva po kategoriji i spajanje po vremenu (takeNext), ponude se ne čitaju/ne prikazuju; na Kuriri u detalju veza "Sve poruke".
- **D12** stranica ne čita `inbox-summary`; `useCourierRoster` dobija opciju bez njega.
- **D13** (moguć veto) Kuriri: `buildRoster` čuva kategoriju poruke pa "Zadnja poruka" ne prikazuje ponudu.
- **D14** pet početnih šablona (t1–t5), lični u localStorage; šablon sa `___` blokira slanje dok se ne popuni.
- **D15** Faza 2 (paketi poruka sa servera) se ne gradi dok backend ne potvrdi B1.

## Redosled
- **Faza 0** (može posebno): 0.1 istorija bez ponuda (F1); 0.2 učitavanje/greška sa "Pokušaj ponovo", nikad "Nema kurira" dok se ne zna (F7); 0.3 Enter ne šalje (F3); 0.4 pretraga kao na Kuriri (F8); 0.5 D13.
- **Faza 1** nova stranica: utils (grupe, plan slanja, provjera nacrta, poklapanje, spajanje) → composable-i (nacrt, šabloni, poslato, praćenje, poruke kurira) → komponente u `app/components/dispatcher/messages/` → stranica prepisana; stari dijalog istorije obriši tek kad `grep` pokaže da ga niko ne uvozi; naziv u meniju (D1), veza na Kuriri (D11).

## Backend pitanja (idu u dnevni dokument, ne u ovaj fajl)
Ako se gradi 05.10.: dodaj "Dio 2" u `docs/2026/10/05_10_2026_Frontend_pitanja_za_backend.textile` (stavke 1–11 su Kuriri, nastavi sa 12). Inače novi fajl sa današnjim datumom u istom formatu (`{{toc}}`, legenda 🔴🟠🟡🟢, "Šta vidimo / Prijedlog / Pitanja"). Uz to: `docs/2026/09/otvorene-stavke-tracker.md` i `app/pages/dev/otvorene-stavke.vue`.
B1 paketi poruka (`message_id` + recipients u odgovoru slanja, lista/primaoci/brisanje po poruci); B2 sažetak bez ponuda + šta broji `dispatcher_unread_count`; B3 filter inboxa `sender`/`exclude_category` (diže stavku 7 iz 05_10 na 🟠); B4 značenje `all_couriers:true` i `skipped[]`; B5 ograničenje brzine/429; B6 najveća dužina naslova/teksta; B7 šalje li poruka push (stavka 3 iz 03_10); B8 zajednički šabloni po firmi. Najmanje što pomaže odmah: B2 + `message_id` u odgovoru slanja i na redu inboxa.

## Provjera (obavezno, ne samo typecheck)
- `nuxi typecheck` (exit 0, `grep -c "error TS"`).
- E2E u pravom headless Chrome-u nad lažnim API-jem (CDP, Fetch interception API hosta), pisan UPOREDO sa kodom: stanja, grupe, ručni izbor, pretraga, šabloni, slanje sa/bez potvrde, greške slanja i provjere, praćenje, podsjetnik, povlačenje (potpuno/djelimično), istorija kurira, nacrt, 500 kurira; telefon 390 i 320 dodirom; kontrast svakog teksta ≥4.5; mete 44 px; tastatura. Pogledaj snimak svakog stanja očima.
- Alati za E2E (CDP pokretač, presretanje API-ja, izmišljeni svijet, kontrast) su u `docs/2026/10/poruke-prototip/e2e/`; uputstvo je u `e2e/README.md`. Pokreću se iz korijena repoa, uz dev server sa `NUXT_PUBLIC_GPS_API_BASE=http://localhost:4011`.
- Na prototipu su prošle 34 logičke, 166 tokova i 52 provjere uređaja/pristupačnosti: to je dokaz za prototip, ne za aplikaciju.
- Ne tvrdi ništa što nije provjereno. NIJE provjereno: pravi backend (sender ponuda u `/inbox`, značenje unread, rate limit, `all_couriers`, push), iOS/pravi telefon, čitači ekrana, produkcijski build.
- Ako je izvor teksta nejasan, sve je i u Artifactu "Dizajn dispečerskih poruka" (privatan, korisnik ima link): https://claude.ai/artifact/UExTWXyVFcjrEv7kbecJoz
