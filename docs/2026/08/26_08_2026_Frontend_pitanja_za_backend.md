# Pitanja i status za backend tim (26. avgust 2026)

Kontekst: dva tiketa na dispečerskom ekranu "Firma" - dopune taba "Kuriri"
(pretraga/filter/ID/edit) i taba "Kase kurira" (pretraga/sortiranje/ID/modal
sa detaljima kurira).

Već implementirano na frontendu, bez potrebe za backend izmenom:
- **Kuriri tab** - pretraga (ime/telefon/ID), filter Aktivni/Neaktivni, ID
  kurira u listi. Sve čisto na frontu nad već učitanom
  `GET .../couriers-status` listom.
- **Kase kurira tab** - pretraga (ime/ID), sortiranje po koloni (klik na
  zaglavlje "Kurir"/"Duguje firmi"/"Firma duguje kuriru"), ID kurira u
  listi, klik na red otvara modal sa detaljima kurira. Modal spaja već
  učitane `couriers-balance` i `couriers-status` liste po `courier_id` -
  isti obrazac kao postojeći `courierName()` lookup, ništa novo sa mreže.

Sve ispod je novo i **nije potvrđeno sa backendom** - tražimo potvrdu pre
nego što ovo ide dalje od internog testiranja.

---

## 1. Edit kurira - novo dugme na "Kuriri" tabu, endpoint pretpostavljen

Tiket traži da se postojeći kurir može izmeniti (ime, telefon, vozilo) sa
liste firme - do sada je postojalo samo Dodaj/Suspenduj/Ukloni, bez Edit-a.

Frontend sad zove:

```
PATCH /dispatcher/delivery-companies/{companyId}/couriers/{courierId}
Body: { name?, phone?, vehicle_type?, contact_phone?, bank_account?, note? }
Response pretpostavljen: { data: CompanyCourier }  (isti oblik kao POST .../couriers)
```

Ovo je **pretpostavka po analogiji** sa postojećim `PATCH .../couriers/{id}/suspend`
i `POST .../couriers` na istom resursu - endpoint nije nigde potvrđen u
dosadašnjoj dokumentaciji koju smo dobili.

**Molimo:**
- Da li ovaj endpoint postoji, i ako ne, pod kojom putanjom/metodom treba da
  ide edit postojećeg kurira firme?
- Da li `vehicle_type: null` u telu treba da znači "ukloni vozilo sa kurira"
  (kurir vraća na `vehicle: null` stanje), ili je uklanjanje vozila posebna
  akcija?
- Postoji li već negde generički `PUT /couriers/:id` (koristi ga
  `courierProfileService.ts` za sopstveni profil kurira) koji bismo umesto
  toga trebalo da zovemo sa dispečerskim tokenom za tuđeg kurira? Ako da,
  prelazimo na taj endpoint umesto novog.

---

## 2. Tri nova polja kurira - kontakt telefon, žiro račun, napomena

Tiket eksplicitno traži dodatna polja pri editu kurira: **telefon kontakt
osobe**, **žiro račun** i **napomena**. Nijedno od ova tri ne postoji u
potvrđenoj šemi `CompanyCourier` (`couriers-status` odgovor) niti u
`CourierProfileDto` (`GET /couriers/:id`).

Frontend je za sad dodao opciona polja `contact_phone`, `bank_account`,
`note` - i u tipu i u edit formi - ali:
- **Ne znamo da li `GET .../couriers-status` uopšte vraća ova polja.** Ako
  ne vraća, edit forma će se uvek otvarati prazna za njih (korisnik ne vidi
  prethodno unetu vrednost dok ne osveži stranicu/ponovo ne učita listu).
- **Ne znamo tačna imena/tipove polja na backendu** - nazive `contact_phone`/
  `bank_account`/`note` smo izmislili po smislu, ne po specifikaciji.
- Da li žiro račun treba validaciju formata (IBAN, dužina, samo cifre)?

**Molimo:** potvrdu da li ova tri polja postoje u modelu kurira na backendu,
tačna imena/tipove, i da li ih `couriers-status` vraća ili treba poseban
poziv (npr. `GET .../couriers/{courierId}` detalj).

---

## 3. "Kase kurira" - nema novih pitanja

Sve četiri stavke tiketa za taj tab (pretraga, sortiranje, ID, modal sa
detaljima) rade se isključivo nad podacima koje već imamo sa dva postojeća
poziva (`couriers-balance`, `couriers-status`). Modal će prikazivati
kontakt telefon/žiro račun/napomenu ako i kad stavka 2 iznad dobije odgovor
- do tada su ta tri reda u modalu prazna (`-`) za svakog kurira.
