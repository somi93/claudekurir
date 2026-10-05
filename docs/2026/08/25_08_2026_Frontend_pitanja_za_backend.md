# Pitanja i status za backend tim (25. avgust 2026)

Kontekst: `cash-limit-frontend.textile` opisuje proveru limita gotovine na
`accept()` endpointu (BLOCK/NOTIFY_ONLY po firmi) — ovo je tačno stavka
najavljena kao "sledeća faza" u vašem `dispatcher.md` ("Limit na količinu
gotovine koju kurir smije da drži (blokada novih pouzeća narudžbi)").

Već implementirano na frontendu na osnovu tog dokumenta:
- `accept()` sada čita `warning` polje iz odgovora i prikazuje ga kao žuto
  upozorenje bez prekidanja toka (NOTIFY_ONLY).
- `accept()` hvata HTTP 409 i prikazuje vašu poruku iz `message` direktno
  kuriru, ne dozvoljava dalji tok prihvatanja (BLOCK).
- Dispečerski panel finansijskih postavki ima novo polje za izbor
  `cash_limit_enforcement` (BLOCK / NOTIFY_ONLY) uz postojeći
  `cash_limit_amount`.

Sve ispod su pretpostavke i otvorena pitanja — tražimo potvrdu/ispravku pre
nego što ovo ide dalje od internog testiranja.

---

## 1. Da li je "gotovina koju kurir drži" ovde isto što i `cash_owed_to_company` iz wallet sistema?

Vaš raniji `dispatcher.md` (endpoint 2 `wallet-balance` i endpoint 5
`couriers-balance`) već ima `cash_owed_to_company` — broj koji pokazuje
koliko gotovine kurir trenutno drži. `cash-limit-frontend.textile` ne
pominje taj naziv, samo kaže da je kurir "преко cash_limit_amount".

**Molimo:**
- Da li `accept()` interno poredi baš `cash_owed_to_company > cash_limit_amount`?
- Ako da — kad dispečer potvrdi predaju gotovine
  (`POST /dispatcher/cash-handovers/{id}/confirm`, vidi naš prethodni
  dokument od 22. avgusta), da li se blokada kurira odmah uklanja na
  sledećem `accept()` pozivu, ili postoji kašnjenje (batch obrada)? Ovo nam
  je bitno jer smo upravo integrisali "Kase kurira" tab za dispečera — ako su
  ova dva sistema povezana kako pretpostavljamo, dispečerova potvrda bi
  trebalo odmah da oslobodi kurira.

---

## 2. Da li `message`/`warning` nosi i strukturirane brojeve, ili samo gotov tekst?

Primjeri u dokumentu ("Dostigli ste limit gotovine (38.50 od 20.00)...") su
gotov tekst za prikaz, bez odvojenih numeričkih polja.

**Molimo:** da li postoje (ili planirate) odvojena polja uz `warning`/
`message`, npr. `current_cash_amount` i `cash_limit_amount`, da bi frontend
mogao da prikaže npr. progress bar ili razliku bez parsiranja teksta iz
zagrada? Ako ne planirate strukturirana polja, frontend će samo proslijediti
`message`/`warning` tačno kako stignu — molimo da tada forma poruke ("X od
Y") ostane stabilna, jer se na nju ne oslanjamo programski, samo je
prikazujemo.

---

## 3. Da li BLOCK utiče na već aktivnu (prihvaćenu) porudžbinu, ili samo na `accept()` nove?

Dokument eksplicitno kaže da se provjera dešava samo na `accept()`. Nije nam
jasno šta se dešava ako kurir pređe limit dok već ima aktivnu, još
nedostavljenu porudžbinu (npr. naplati veći iznos na trenutnoj dostavi) — da
li `pickup`/`deliver` za tu porudžbinu ostaju dozvoljeni bez obzira na
limit?

**Pretpostavka koju smo implementirali:** `pickup` i `deliver` endpoint-i su
potpuno nezavisni od limita, provjera je isključivo na "kapiji" za
prihvatanje NOVE porudžbine. Molimo potvrdite da je to tačno.

---

## 4. Da li kurir može unaprijed da vidi svoj limit i trenutno stanje, prije nego pokuša `accept()`?

Kurirska mobilna/PWA strana trenutno ne prikazuje ni `cash_limit_amount`
firme ni sopstveni `cash_owed_to_company` (endpoint postoji,
`GET /couriers/{courierId}/wallet-balance`, ali ga kurirski ekran još ne
poziva). Bez toga kurir prvi put saznaje da je preko limita tek kad dobije
409 ili `warning` na `accept()` — što djeluje iznenadno usred smjene.

**Molimo mišljenje:** da li preporučujete da frontend proaktivno povuče
`wallet-balance` i prikaže trajni indikator (npr. "42/50 KM") na kurirskom
ekranu? Ako da — kurir trenutno nema pristup
`/dispatcher/delivery-companies/{companyId}/finance-settings` (dispečerski
endpoint, drugi token/rola), pa bi nam trebao poseban endpoint koji kuriru
preko njegovog tokena vraća važeći `cash_limit_amount` i
`cash_limit_enforcement` njegove firme.

---

## 5. `cash_limit_amount = 0` — "ne smije da drži nimalo gotovine" ili se tretira kao "nema limita"?

Dokument razlikuje samo `NULL` (nema limita uopšte) od postavljene
vrijednosti. Nije nam jasno da li je `0` validna, "stroga" vrijednost koja
odmah blokira/upozorava kurira čim uzme bilo kakvu gotovinu, ili se `0`
(falsy) na backendu tiho tretira isto kao `NULL`.

**Molimo:** potvrdite ponašanje za `0`. Trenutno naša forma
(`cash_limit_amount` text-field) dozvoljava dispečeru da upiše `0` — ako se
to na vašoj strani tumači kao "bez limita", trebalo bi da dodamo poseban
način da dispečer eksplicitno ukloni limit (prazno polje → `null`) umjesto
da slučajno upiše `0` misleći da je to strogo ograničenje.

---

## 6. Validacija `cash_limit_enforcement` na PATCH-u — šta vraća backend na nevalidnu vrijednost?

Dokument kaže "prihvata samo `BLOCK` ili `NOTIFY_ONLY`".

**Molimo:** da li slanje nečeg trećeg (prazan string, mala slova `"block"`,
izostavljeno polje) vraća `422` sa porukom u
`errors.cash_limit_enforcement` (isti oblik kao ostala Laravel validaciona
polja u ovom projektu), da bismo grešku prikazali na tačnom polju u formi
umjesto generičkog toast-a? Frontend trenutno šalje samo `"BLOCK"` ili
`"NOTIFY_ONLY"` iz padajuće liste, pa bi ovo trebalo da bude rijedak slučaj,
ali ne testira se defanzivno bez potvrde.

---

## 7. Da li `cash_limit_enforcement` već stiže na `GET finance-settings` za postojeće firme, ili čeka migraciju/deploy?

Pitamo prije nego što ovo spojimo na test okruženje.

**Molimo:** da li `GET .../finance-settings` već vraća ovo polje (sa
default `NOTIFY_ONLY`) za sve postojeće firme, ili treba prvo da se pokrene
migracija/deploy na vašoj strani da bismo mogli da testiramo end-to-end?

---

## 8. Kurir radi za više dostavnih firmi istovremeno — čiji `cash_limit_amount` važi?

Nismo sigurni da li je ovo uopšte moguć scenario u sistemu (kurir vezan za
više firmi odjednom), ali ako jeste:

**Molimo:** koja firma se koristi za limit — firma same porudžbine
(`delivery_company_id` na `Order`) koju kurir prihvata, ili neka "matična"
firma kurira? Ovo utiče na to da li ćemo ikad morati da prikažemo kuriru
"koji" limit ga je blokirao kad radi za više firmi.
