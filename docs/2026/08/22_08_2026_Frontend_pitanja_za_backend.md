# Pitanja i status za backend tim (22. avgust 2026)

Kontekst: `dispatcher.md` (vaš izveštaj) opisuje 6 endpoint-a za kurirski
novčanik/zaradu i predaju gotovine, sa fokusom na dispečera. Integrisali smo
odmah endpoint 5 (`couriers-balance`) i endpoint 6
(`cash-handovers/pending`) u novi tab "Kase kurira" na dispečerskom "Firma"
ekranu (`app/pages/dispatcher/company.vue`), plus potvrdu preko endpointa iz
tačke 3 vašeg dokumenta (`/dispatcher/cash-handovers/{id}/confirm`).

Endpoint-i 1-4 (zarada, wallet-balance, prijava predaje, istorija predaja) su
namerno preskočeni na dispečerskom ekranu — vaš dokument kaže da je to
mobilni/kurirski tok. Ali upravo zato što dispečer NEMA pristup toj istoriji,
otvorilo nam se nekoliko pitanja ispod (sekcija 3).

Sve što je ispod je već implementirano na frontendu uz pretpostavke —
tražimo potvrdu/ispravku pre nego što ovo ide dalje od internog testiranja.

---

## 1. Potvrda predaje gotovine — šta se dešava kad se prijavljeni i stvarni iznos ne poklapaju?

Vaš dokument (tačka 6) kaže da endpoint za potvrdu
(`POST /dispatcher/cash-handovers/{id}/confirm`) je "već implementiran i
testiran ranije", ali ne opisuje **telo zahteva**. Istorija predaja (tačka 4)
ima i `reported_amount` i `confirmed_amount` kao odvojena polja — što
implicira da se mogu razlikovati.

Trenutno smo implementirali dugme "Potvrdi" da šalje `POST` **bez tela**
(dispečer samo potvrđuje iznos kakav je prijavljen, ne unosi ništa).

**Molimo:**
- Da li `confirm` bez tela zaista postavlja `confirmed_amount = reported_amount`
  automatski, ili endpoint očekuje `{ confirmed_amount, note }` u telu?
- Ako se u praksi desi da je kurir predao *drugačiju* sumu od prijavljene
  (npr. prijavio 50, a fizički predao 45) — kako dispečer to danas evidentira?
  `disputed` status je po vašem dokumentu "rezervisan za budućnost" — da li to
  znači da danas nema načina da se takva razlika ispravi kroz API, ili postoji
  neki drugi endpoint za to koji nije naveden u `dispatcher.md`?

---

## 2. Da li potvrda gotovine automatski menja `cash_owed_to_company`?

Pretpostavili smo (i tako implementirali — nakon potvrde ponovo učitavamo
`couriers-balance`) da potvrda predaje **umanjuje** `cash_owed_to_company`
za dotičnog kurira za potvrđeni iznos. Ovo nije eksplicitno napisano u
`dispatcher.md`.

**Molimo:** potvrdite da je ovo tačno, i da li umanjenje kasni (npr. neki
batch proces) ili je odmah vidljivo na sledećem GET-u balansa.

---

## 3. Dispečer nema uvid u istoriju — samo trenutno stanje i pending listu

Endpoint 5 (`couriers-balance`) daje samo **trenutni zbir**, a endpoint 6
samo **pending** zahteve. Kad dispečer potvrdi predaju, ona nestaje sa liste
i dispečer više nema gde da vidi da se to desilo (koji iznos, kada, koji
kurir) — osim ako sam ne vodi belešku van sistema.

Kurir na mobilnoj ima pristup istoriji (endpoint 4,
`GET /couriers/{courierId}/cash-handovers`), ali taj endpoint je vezan za
`courierId` iz tokena kurira — dispečeru ne koristi za tuđi `courierId`
(nema `Authorization: Bearer <token dispečera>` varijantu u dokumentu).

**Molimo:** da li postoji (ili planirate) dispečerski ekvivalent, npr.
`GET /dispatcher/delivery-companies/{companyId}/cash-handovers` (sve, ne
samo pending, sa filterom po kuriru/periodu/statusu)? Bez ovoga dispečer ne
može da razreši spor ("ja sam predao", "nisi") niti da vidi ko je konzistentno
kasnio sa predajom.

---

## 4. Nema paginacije/filtera na `couriers-balance` i `cash-handovers/pending`

Oba endpoint-a (5 i 6) vraćaju punu listu bez `page`/`per_page` parametara u
primerima iz dokumenta.

**Molimo:** potvrdite da li su ovi endpoint-i namerno bez paginacije (npr.
očekivano malo kurira po firmi, malo pending zahteva u isto vreme), ili
treba da očekujemo `data`/`meta` oblik sa paginacijom kad broj kurira/zahteva
poraste? Ovo utiče na to da li sada gradimo "učitaj sve odjednom" ili treba
odmah da planiramo scroll/paginaciju u UI-ju.

---

## 5. Ko sme da potvrdi — da li `confirm` proverava firmu dispečera?

Endpoint-i 5 i 6 su ugnježdeni pod `/dispatcher/delivery-companies/{companyId}/...`,
ali endpoint za potvrdu (tačka 3) je **flat**:
`/dispatcher/cash-handovers/{id}/confirm`, bez `companyId` u putanji.

**Molimo:** ako jedan dispečerski nalog upravlja sa više firmi, da li
`confirm` interno proverava da `{id}` zahteva pripada kuriru iz firme koju
taj dispečer sme da vidi? Šta vraća ako pokuša da potvrdi predaju kurira iz
tuđe firme — `403` ili `404`? Trenutno frontend ne šalje `companyId` uz
`confirm` poziv (isto kao vaš dokument), samo `{id}` predaje.

---

## 6. Tip podatka za novčane iznose nije dosledan između endpoint-a

- `earnings`, `wallet-balance`, `couriers-balance` → brojevi (`45.60`, `175.95`).
- `cash-handovers` (report i history) → **stringovi** (`"50.00"`).

Frontend radi `Number(reported_amount)` pri prikazu (vidi
`CompanyWalletPanel.vue`), ali ovo je krhko ako se format ikad promeni (npr.
separator hiljada, `null` umesto `"0.00"`).

**Molimo:** da li je string namerno (npr. da se izbegne float zaokruživanje
na backend-u), i da li se to zadržava i za buduće endpoint-e (isplate,
bonusi iz "sledeće faze")? Ako da, uskladićemo i naš tip da svuda očekuje
string pa parsira, umesto trenutnog mešanja.

---

## 7. Ime/telefon kurira nije u odgovoru — potvrda da se oslanjamo na spajanje sa `couriers-status`

`couriers-balance` i `cash-handovers/pending` vraćaju samo `courier_id`.
Frontend trenutno spaja taj `courier_id` sa već učitanom listom sa
`GET /dispatcher/delivery-companies/{companyId}/couriers-status` (postojeći
endpoint) da prikaže ime.

**Molimo:** potvrdite da su `courier_id` vrednosti iz sva tri endpoint-a
(`couriers-status`, `couriers-balance`, `cash-handovers/pending`) uvek isti
identifikator (isti kurir = isti broj svuda), uključujući i za
suspendovane/uklonjene kurire — vidi sekciju 8.

---

## 8. Suspendovani/uklonjeni kurir sa dugom — da li ostaje vidljiv?

Ako je kurir suspendovan (postojeći `PATCH .../couriers/{id}/suspend`) ili
uklonjen sa liste firme (`DELETE .../couriers/{id}`), a i dalje ima dug
(`cash_owed_to_company` > 0 ili `wage_owed_to_courier` > 0):

**Molimo:**
- Da li i dalje ostaje na `couriers-balance` listi (bitno da dispečer ne
  "izgubi iz vida" dug kad kurir ode)?
- Da li i dalje može da pošalje `cash-handovers/report` sa mobilne ako je
  suspendovan (verovatno ne bi trebalo da može da radi dostave, ali predaja
  stare gotovine je druga stvar)?

---

## 9. Notifikacija dispečeru o novom zahtevu za predaju

Trenutno frontend osvežava pending listu samo pri promeni firme (nema
polling ni push). Ako kurir prijavi predaju gotovine dok je dispečer na
ekranu, dispečer to neće videti bez ručnog osvežavanja stranice.

**Molimo:** da li postoji (ili je planiran) push/notifikacioni kanal za
dispečera (isti sistem kao za "Pošalji ponudu" iz ranijeg dokumenta,
`Frontend_pitanja_za_backend_16_avgust.md` sekcija 7), ili treba da uvedemo
periodično pooling na frontendu (i na koji interval biste preporučili)?

---

## 10. Sledeća faza — samo da precizirate obim pre nego što počnemo

Vaš dokument navodi tri stavke za sledeću fazu: periodičnu isplatu zarade,
limit gotovine, bonuse/ručne korekcije. Nemamo pitanje za sada, samo molimo
da nas obavestite kad počne rad na tome — trenutni "Kase kurira" tab je
napravljen tako da su balansi čisto informativni (nema nijednog dugmeta za
isplatu/limit), pa ćemo taj deo dodati kad endpoint-i budu spremni umesto da
nagađamo unapred.
