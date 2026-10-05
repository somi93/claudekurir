# Network / retest checklist — proširena forma kurira (14.09.2026, kasno popodne)

Retest za `14_09_2026_odgovor-backend-prosirena-forma-kurira.textile` (backendov odgovor
na `14_09_2026_Frontend_pitanja_za_backend.textile`, DIO I — 8 novih polja + stari
`bank_account`/`note` na POST). Forma nikad nije uklonila polja pa retest ide direktno
kroz UI ("Dodaj kurira" / "Izmeni kurira") — nema potrebe ništa vraćati prije testa.

Status kolona: ⬜ nije testirano · ✅ potvrđeno · ❌ nije prošlo

## A. POST (kreiranje) — `/dispatcher/delivery-companies/{companyId}/couriers`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| L1 | ✅ | "Dodaj kurira" — popuniti sva osnovna polja + svih 8 novih (datum rođenja, IBAN, hitni kontakt ime/telefon, način naplate, iznos naplate, datum potpisa ugovora, datum početka ugovora) + `bank_account`/`note` | `201`, novi kurir kreiran — **potvrđeno 14.09 večernje**: kurir 30753, `201` |
| L2 | ✅ | Odgovor na L1 poziv (`POST` response body) | Sadrži `detail` objekat sa svih 7 `UserDetail` polja (`date_of_birth`/`iban`/`emergency_contact_name`/`emergency_contact_phone`/`referral_*`) POPUNJEN onim što je poslato — ne `null`/izostavljeno kao 14.09 prijepodne — **potvrđeno**: `detail.date_of_birth`/`iban`/`emergency_contact_name`/`emergency_contact_phone` tačno kako je poslato, `referral_*` `null` (očekivano, nisu ni poslati) |
| L3 | ❌ | Isti odgovor — vrhnji nivo | `paying_type`, `paying`, `contract_signed_at`, `contract_active_from` prisutni na vrhnjem nivou reda, sa poslatim vrijednostima — **NE PROLAZI, testirano 14.09 večernje**: poslato `paying_type:1, paying:"255", contract_signed_at:"2026-09-08", contract_active_from:"2026-09-13"`, odgovor vraća sva 4 kao `null`. Backendova tvrdnja da su ova polja popravljena NIJE tačna — samo `UserDetail` (`detail` objekat, L2) je stvarno popravljen, `delivery_company_user` pivot polja i dalje se tiho ignorišu na POST-u |
| L4 | ✅ | Isti odgovor — stara polja | `bank_account`/`note` popunjeni (ranije su na POST-u uvijek bili `null` bez obzira šta se pošalje — ovo je regresija-check da POST fix nije pokvario nešto drugo) — **potvrđeno**: `bank_account: "22-2222222222-222"`, `note: "nap"` tačno kako je poslato |

## B. PATCH (izmjena) — `/dispatcher/delivery-companies/{companyId}/couriers/{courierId}`

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| L5 | ✅ | "Izmeni kurira" na kuriru iz L1 — promijeniti bar jedno od svih 8 polja (npr. drugi datum, drugi IBAN) + `bank_account`/`note` | `200 OK` — **potvrđeno 14.09 večernje**: kurir 30742, `200` |
| L6 | ✅ | Odgovor na L5 poziv | `detail` objekat sa NOVIM vrijednostima (ne stare iz L1) — **potvrđeno**: `detail.date_of_birth`/`iban`/`emergency_contact_name`/`emergency_contact_phone` tačno kako je poslato na PATCH-u, i `bank_account`/`note` isto |
| L7 | ❌ | Isti odgovor — vrhnji nivo | `paying_type`/`paying`/`contract_signed_at`/`contract_active_from` ažurirani na vrhnjem nivou — **NE PROLAZI, testirano 14.09 večernje**: poslato `paying_type:1, paying:"242", contract_signed_at:"2026-09-07", contract_active_from:"2026-09-14"`, odgovor vraća sva 4 kao `null` — identičan nalaz kao L3 (POST). PATCH NE radi za pivot polja ništa bolje od POST-a - obara pretpostavku da je PATCH strana i dalje radila kako je 13.09 opisano |

## C. GET (lista) — `couriers-status` (index)

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| L8 | ✅/❌ | `GET .../couriers-status` (ili ekvivalentan GET pojedinačnog kurira) poslije L5 | Red za tog kurira ima ISTI `detail` objekat + vrhnji-nivo pivot polja kao PATCH odgovor (L6/L7) — index mora vraćati isti prošireni oblik, ne stari uzak red — **testirano 14.09 večernje, kurir 30742**: ✅ `detail` + `bank_account`/`note` identični L6 (index prati PATCH odgovor za ove); ❌ `paying_type`/`paying`/`contract_signed_at`/`contract_active_from` i dalje `null` na indexu, isto kao L7 |
| L9 | ⬜ | Zatvoriti i ponovo otvoriti "Izmeni kurira" na istom kuriru (bez re-fetch-a cijele stranice, samo iz liste učitane u L8) | Forma se popuni svih 8 polja + `bank_account`/`note` iz liste — potvrđuje da dispečer stvarno VIDI sačuvane podatke pri sledećem otvaranju, ne samo da POST/PATCH odgovor ih ima — lični podaci/bank_account/note treba da rade, naplata/ugovor polja će ostati prazna dok se L7 ne riješi |

**Usput potvrđeno (odmah poslije L1 POST-a, prije bilo kakvog PATCH-a)**: `GET
.../couriers-status` za kurira 30753 vraća identičan obrazac kao L2-L4 — `detail` objekat
potpuno popunjen, `bank_account`/`note` popunjeni, ali `paying_type`/`paying`/
`contract_signed_at`/`contract_active_from` sva 4 `null` iako su poslata na POST-u. Znači
L3 nalaz nije samo POST-response artefakt - iste vrijednosti (ništa) su i trajno
sačuvane/vraćene na indexu.

L5-L8 (PATCH strana, kurir 30742) sad potvrđuju identičan obrazac - pretpostavka da PATCH
možda i dalje čuva pivot polja (kako je 13.09 opisano, prije POST fixa) NIJE tačna: PATCH
je isto tako pokvaren za `paying_type`/`paying`/`contract_signed_at`/`contract_active_from`
kao i POST. Fix 14.09 kasno popodne je popravio user_details stranu (`detail`) na OBA
endpointa, ali pivot stranu ni na jednom.

## D. Praznine / edge slučajevi

| # | Status | Provjera | Očekivano |
|---|---|---|---|
| L10 | ⬜ | Kreirati kurira BEZ ijednog od 8 novih polja (ostaviti prazno u formi) | `201`, `detail` objekat prisutan ali polja `null` (ne izostavljena, ne 422) |
| L11 | ⬜ | `toggle` (suspend/aktiviraj) na kuriru iz L1 | Odgovor takođe nosi `detail` + pivot polja (backend navodi da i `toggle` ide kroz isti `DispatcherCourierResource`) |

---

L3 nalaz (paying_type/paying/contract_signed_at/contract_active_from i dalje null) je već
eskaliran u `14_09_2026_Frontend_pitanja_za_backend_prosirena-forma-kurira.textile`. Kad
DIO B/C/D budu popunjeni i backend potvrdi pivot fix, tek onda u
`types/company-courier.ts`/dialog komentarima trajno skinuti preostale napomene o
"backend još ne perzistira".
