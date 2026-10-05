# Network / retest checklist — finansije: transakcije + knjiga salda (14.09.2026)

Retest za `13_09_2026_Komplеtan_odgovor_frontu_finansije.textile`. Pokriva `to`/paginaciju na
`/transactions`, novi `RESTAURANT_OWES_DELIVERY_COMPANY` money_flow, `from`/`to` na
`/balance-ledger`, i frontend-only filtere (money_flow dropdown, pretraga) na oba taba. Presetovi
za ručno testiranje: `/dev/api`, grupa F1-F6.

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo

## A. Transakcije — `to` parametar i paginacija

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| F1 | ✅ | Otvoriti Transakcije tab, ostaviti period na "Posljednjih 30 dana" | Poziv sadrži i `from` i `to` (ne samo `from` kao ranije); tabela i saldo se učitavaju bez greške — **potvrđeno 14.09** |
| F1b | ✅ | Retest nakon F13 fixa (`toDateParam`) — provjeriti da 7d/30d/90d na Transakcijama i dalje šalju ispravne datume (ovaj tab nema "Ova godina" opciju, ali koristi isti helper) | `from`/`to` odgovaraju stvarnom lokalnom datumu, ne dan ranije — **potvrđeno 14.09** |
| F2 | ✅ | Preset F1 (`/dev/api`) — `GET restaurants/175/transactions` bez ikakvih parametara | 200, `meta` objekat prisutan (`current_page`/`last_page`/`total`/`per_page`), ponašanje bez filtera nepromijenjeno — **potvrđeno 14.09**: `meta: {current_page:1, last_page:1, total:11, per_page:50}`, svaki red ima `money_flow` (ORDER_VALUE/DIRECT_PAYMENT). **Nalaz**: `entry_type: "CASH_ADVANCE"` se pojavljuje na 7/11 redova (kurir platio restoranu pri preuzimanju, `money_flow: DIRECT_PAYMENT`) — nije bio na originalnom ticket popisu tipova niti u frontend `KNOWN_TYPES`. Ispravljeno isti dan: dodato u `FinanceTabTransactions.vue`/`FinanceTabBalanceLedger.vue` (`KNOWN_TYPES`/`TYPE_LABEL_KEYS`) + prevodi (`finance_desc_cash_advance`) u 8 lokalizacija koje već imaju taj ključ (bs/hr/sr/sr-lat/rs/rs-lat/mk/si). **Vizuelno potvrđeno u UI-ju** (screenshot, Transakcije tab): kolona "Врста" ispravno prikazuje "Готовински аванс" umjesto sirovog fallback teksta |
| F3 | ✅ | `?from=2026-09-01&to=2026-09-13&money_flow=ORDER_VALUE&type=ORDER_REVENUE&service_id=1` (kombinacija sva 4 filtera odjednom, vrijednosti biraju iz stvarnih podataka F1/F2) | Očekivano tačno 4 reda (id 173,162,151,134) — NE smije vratiti ostalih 7 (`CASH_ADVANCE`/`DIRECT_PAYMENT`/`service_id:null`) — **potvrđeno 14.09**: tačno 4 reda, `meta.total: 4`, svi ostali ispravno isključeni |
| F3a | ✅ | Samo `?type=ORDER_REVENUE` (bez ostalih filtera) | Očekivano 4 reda (id 173,162,151,134) — **potvrđeno 14.09**: `data[]` i `meta.total` oba ispravna (4) — `type` sam za sebe nema problem sa brojanjem, potvrđuje da je F3b bug specifičan za `money_flow` |
| F3b | ⚠️ | Samo `?money_flow=DIRECT_PAYMENT` | Očekivano 7 redova (id 171,160,149,147,145,143,132) — **testirano 14.09**: `data[]` sadrži TAČNO tih 7 redova (ispravno filtrirano), ALI `meta.total: 11` (i dalje neopozvani ukupan broj, ne 7) — `meta.current_page:1, last_page:1`. **Backend bug**: brojanje za paginaciju (`total`/`last_page`) ne primjenjuje `money_flow` filter, iako sam `data[]` upit ga primjenjuje ispravno — vidi napomenu ispod tabele, treba prijaviti backendu |
| F3c | ✅ | Samo `?service_id=1` | Očekivano 4 reda (id 173,162,151,134 — jedini sa `service_id:1`) — **potvrđeno 14.09**: `data[]` i `meta.total` oba ispravna (4) — dodatna potvrda da je F3b bug specifičan za `money_flow`, ne za brojanje uopšte |
| F3d | ✅ | Samo `?from=2026-09-13&to=2026-09-20` (van opsega — svi podaci su od 12.09) | Očekivano prazan niz — **potvrđeno 14.09**: prazan `data[]`, `meta.total: 0`, `from`/`to` ispravno filtrira |
| F4 | ✅ | Preset F3 — `?page=2` | `meta.current_page: 2`, redovi različiti od stranice 1 — **potvrđeno 14.09**: ispravno ponašanje |
| F5 | ⬜ | U UI-ju, ako `meta.total` prelazi jednu stranicu — provjeriti da se pojavljuje paginacija ispod tabele i da klik na broj stranice učitava nove redove | Paginacija vidljiva samo kad `last_page > 1`, navigacija radi — **blokirano 14.09**: restoran 175 ima samo 11 transakcija (< 50 = `per_page`), nema `last_page > 1` da se testira. Kod prikazuje paginaciju uslovno (`v-if="lastPage > 1"`, `FinanceTabTransactions.vue:142`) — logika pregledana, ali nije vizuelno potvrđena uživo. **Za retest**: naći restoran sa 50+ transakcija, ili privremeno probati `?per_page=5` preko `/dev/api` da se sa postojećih 11 redova vještački dobije `last_page: 3` (samo za provjeru da meta/paginacija komponenta ispravno reaguje — frontend trenutno ne šalje `per_page` iz UI-ja) |
| F6 | ⬜ | Pretraga (search) dok je učitana stranica 2 | Pretraga filtrira SAMO redove trenutno učitane stranice (frontend-only, po dizajnu) — potvrditi da je ovo prihvatljivo ponašanje ili eskalirati ako korisnici očekuju pretragu preko svih stranica — **blokirano 14.09**: isti razlog kao F5, nema stranice 2 kod restorana 175 da se testira. **Eskalirano** — vidi `14_09_2026_Frontend_pitanja_za_backend_finansije.textile` (N2), tražen pravi `?search=` parametar da pretraga radi preko svih stranica, ne samo trenutne |

**Bug potvrđen (F3b) — za backend tim**: `GET /restaurants/175/transactions?money_flow=DIRECT_PAYMENT`
vraća ispravno filtriran `data[]` (7 redova), ali `meta.total`/`meta.last_page` i dalje računaju
CIJELU (nefiltriranu) tabelu od 11 redova umjesto 7. F3a (`type` samostalno) i F3c (`service_id`
samostalno) su potvrđeni ISPRAVNI — `meta.total` prati filter kod oba. F3 (kombinacija sva 4 filtera)
takođe ispravan (`meta.total: 4`). Zaključak: problem je **izolovano vezan za `money_flow` parametar**
— jedini filter kod kog upit koji generiše `total`/`last_page` ga ne primjenjuje, dok `data[]` upit
ispravno primjenjuje sve filtere uključujući `money_flow`. Za restoran 175 ovo se ne vidi u UI-ju jer
i 11 i 7 staju na jednu stranicu (`per_page: 50`), ali kod restorana sa stotinama transakcija bi
ovo prikazalo pogrešan "Ukupno rezultata" broj i potencijalno prazne dodatne stranice kad je
`money_flow` filter aktivan. **Prijavljeno backendu** — vidi `14_09_2026_Frontend_pitanja_za_backend_finansije.textile` (N1).
| F7 | ⬜ | "Saldo za izabrano" dok je aktivna paginacija | Saldo se računa samo iz trenutno prikazane stranice (ne cijelog filtriranog skupa) — potvrditi da je ovo prihvatljivo ili eskalirati — **blokirano 14.09**: isti razlog kao F5/F6, nema stranice 2 kod restorana 175 da se testira |

## B. Novi money_flow — `RESTAURANT_OWES_DELIVERY_COMPANY`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| F8 | ✅ | Filter "Tok novca" na Transakcijama — provjeriti da se nova opcija pojavljuje u dropdownu | Labela "Restoran duguje firmi za dostavu", narandžasta tačkica u legendi — **potvrđeno 14.09** |
| F9 | ⬜ | Backend vrati red sa `money_flow: "RESTAURANT_OWES_DELIVERY_COMPANY"` (ugovor sa firmom gdje restoran direktno plaća dostavu) | Tačkica u tabeli narandžasta, label ispravan, red se filtrira ispravno kad se izabere taj filter — **blokirano 14.09**: nema restorana/ugovora u testnim podacima sa ovom vrijednošću (spec kaže "rijetko se pojavljuje" — samo kad je ugovor sa firmom za dostavu tako podešen). **Za retest**: tražiti od backend/ops tima da ukaže na restoran koji ima ovakav ugovor, ili sačekati da se pojavi organski |
| F10 | ⬜ | Isto na Knjizi salda (money_flow dropdown + tačkica u tabeli + rekapitulacija) | Ista boja/labela, red se pojavljuje u gornjoj rekapitulaciji kao posebna stavka — **blokirano 14.09**: isti razlog kao F9, nema testnog podatka sa ovom vrijednošću |

## C. Knjiga salda — `from`/`to` i redizajn rekapitulacije

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| F11 | ✅ | Preset F4 — `GET restaurants/175/balance-ledger` bez perioda | `opening_balance + Σ ledger_entries[].amount == current_balance` (sanity check iz izvještaja) — **potvrđeno 14.09**: `0 + (-23.9) = -23.9 = current_balance`, tačno se poklapa. Svih 11 redova ima `money_flow` (7× `DIRECT_PAYMENT`, 4× `ORDER_VALUE`), nema `COMMISSION`/`RESTAURANT_OWES_ORDERA` (isto kao F1/F2 na Transakcijama — konzistentno). `description` polja bez "KOD - " prefiksa (npr. Ćirilica "Приход од наруџбе #3902") prikazuju se ispravno kako jesu (potvrđuje `describe()` fix) |
| F12 | ✅ | Preset F5 — `?from=2026-08-01&to=2026-08-31` | Svi `ledger_entries` unutar opsega; `current_balance` i dalje predstavlja CIJELU istoriju (nije pogođen filterom, po spec-u) — **potvrđeno 14.09** |
| F13 | ❌→✅ | U UI-ju, promijeniti period dropdown (30d/90d/godina/sve) | Novi poziv sa ispravnim `from`/`to` za svaku opciju, tabela i rekapitulacija se osvježavaju — **bug nađen i ispravljen 14.09**: "Ova godina" je slao `from=2025-12-31` umjesto `from=2026-01-01`. Uzrok: `new Date(2026, 0, 1)` pravi LOKALNU ponoć, a `.toISOString().slice(0,10)` konvertuje u UTC — za UTC+1/+2 zone (Bosna/Srbija/Hrvatska) to gura datum jedan dan unazad. Isti obrazac je postojao i u `FinanceTabTransactions.vue` (period dropdown) i `FinanceTabOverview.vue` (Pregled ekran) — sva tri mjesta popravljena novim `toDateParam()` helperom u `constants.js` koji koristi lokalne `getFullYear/getMonth/getDate` umjesto `toISOString()`. **Retest potreban** da se potvrdi da "Ova godina" sad šalje `from=2026-01-01` |
| F14 | ✅ | Gornja rekapitulacija (Početno stanje / stavke / Trenutno stanje) na restoranu sa mješovitim redovima (npr. restoran 230 iz izvještaja) | Stavke grupisane po money_flow (ne više po opisu), zbir stavki + početno stanje = trenutno stanje — **potvrđeno 14.09** (screenshot, restoran 175): "Почетно стање 0.00 / -Плаћено директно -57.10 / +Вредност наруџбе +33.20 / Тренутно стање -23.90" — grupisano po money_flow, "Ostalo" se više NE pojavljuje, zbir se poklapa |
| F15 | ✅ | Money_flow filter dropdown + pretraga na tabeli Knjige salda | Oba rade lokalno (bez novog API poziva), filtriraju već učitane redove — **potvrđeno 14.09** |
| F15a | ✅ | Retest nakon `customSearch` fixa (F15 nalaz) — pretraga na Transakcijama I Knjizi salda latinicom treba da pronađe ćirilične zapise i obrnuto (npr. ukucati "prihod" da pronađe "Приход од наруџбе #3902") | Pretraga radi bez obzira na pismo — **potvrđeno 14.09** |
| F16 | ⬜ | Redovi bez plain-text description-a (stariji format "KOD - opis" ako se još pojavljuje) | `describe()` i dalje ispravno prikazuje detalj poslije crtice; provjeriti da se ništa nije pokvarilo za stare redove |

**Napomena (F15) — nalaz iz produkcije, ispravljeno 14.09**: pretraga na oba nova taba
(Transakcije + Knjiga salda) je originalno koristila prostu `.toLowerCase().includes()` provjeru, koja
NE pronalazi ćirilične zapise kad se kuca latinicom i obrnuto (npr. opisi kao "Приход од наруџбе
#3902" se ne bi pronašli kucanjem "prihod"). App već ima `customSearch(items, headers, search,
additionalFields)` - globalni mixin metod u `main.js` (koristi se na 60+ mjesta u appu, npr.
`EmployeeTable.vue`) koji normalizuje ćirilicu/latinicu i dijakritike prije poređenja. Oba taba
prebačena na njega: `FinanceTabTransactions.vue` (`visibleTransactions`, dodatno polje `sourceId`) i
`FinanceTabBalanceLedger.vue` (`visibleEntries`, dodatno polje `source_id`, money_flow filter se i
dalje primjenjuje odvojeno PRIJE `customSearch` poziva). **Retest F15a** treba potvrditi da pretraga
sad radi bez obzira na pismo.

## D. Pregled (financial-overview) — regresija

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| F17 | ✅ | Preset F6 — `GET restaurants/175/financial-overview` | `current_balance` i `money_flow_summary` i dalje prisutni i ispravni (frontend ih NE računa lokalno — samo regresija, ništa nije mijenjano ovdje) — **potvrđeno 14.09**: `current_balance: -23.9` poklapa se sa Knjigom salda (F11); `money_flow_summary.direct_payments_this_period: 57.1` poklapa se sa zbirom svih 7 `CASH_ADVANCE`/`DIRECT_PAYMENT` iznosa (8.3×6+7.3) |
| F17a | ✅ | Retest nakon F13 fixa — na Pregled ekranu promijeniti period dropdown na "Posljednjih 7/90 dana" | `from`/`to` odgovaraju stvarnom lokalnom datumu (isti `toDateParam()` fix primijenjen i ovdje, `FinanceTabOverview.vue` je imao identičan `toISOString()` obrazac iako nije direktno prijavljen kao bug) — **potvrđeno 14.09** |

---

Nakon što se ovaj checklist popuni, ažurirati status ovdje i prijaviti nazad backend timu bilo šta
što ne prođe (F16 posebno ako se pokaže da stariji redovi na Knjizi salda i dalje dolaze u
"KOD - opis" formatu umjesto čistog teksta).
