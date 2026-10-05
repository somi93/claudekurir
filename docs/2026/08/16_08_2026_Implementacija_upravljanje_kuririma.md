# Implementacija — "Upravljanje kuririma, lozinka, gradovi" (16. avgust, Milos Petrovic)

Backend tiket sa tri celine (nije odgovor na naše pitanje, nego gotova
specifikacija): promena lozinke + podsetnik, `GET /api/cities` (odloženo),
upravljanje kuririma firme (lista/suspenzija/kreiranje/uklanjanje). Sve tri
su implementirane danas na frontu.

Status: **✅ Implementirano** / **📋 Već zadovoljeno, bez izmene koda** /
**❓ Otvoreno pitanje**

---

## 1. Promena lozinke + podsetnik

**Status: ✅ Implementirano**

- `types/user.ts` — dodato `must_change_password: boolean` na `OrderaUser`
  (dolazi kroz postojeći `GET /me` poziv, `authService.fetchMe`, bez izmene
  samog poziva).
- `services/authService.ts` — nov `changePassword()`,
  `PUT /me/password` sa `current_password`/`new_password`/`new_password_confirmation`.
- `components/common/PasswordReminderBanner.vue` — nov, nenametljiv baner
  (nije modal, ne blokira ekran) sa dugmadima "Promeni sada"/"Preskoči za
  sada", montiran globalno u `app.vue` za sve ulogovane ekrane. Vidljiv samo
  dok je `must_change_password: true` i van same `/change-password` stranice.
- `pages/change-password.vue` — bio je prazan TODO stub, sad prava forma
  (trenutna/nova/potvrda lozinke, validacija, poziv servisa). Uspešan poziv
  lokalno gasi `must_change_password` na sesiji (baner odmah nestaje, bez
  čekanja na sledeći `/me`) i vraća korisnika na njegovu početnu stranu.

**Odluka bez eksplicitne specifikacije — "Preskoči za sada" ne pamti se.**
Tiket ne kaže da li preskakanje treba da bude trajno (npr. sačuvano u
localStorage) ili samo za trenutnu sesiju. Izabrali smo **netrajno** — baner
se vraća posle sledećeg reload-a/prijave, dok korisnik stvarno ne promeni
lozinku — jer je svrha podsetnika (posebno za novokreiranog kurira sa
privremenom lozinkom) da se ne izgubi iz vida. Lako se menja ako želite
trajno skrivanje.

**❓ Pravila za lozinku (dužina/kompleksnost)** — tiket ne navodi min. dužinu
za `new_password` ni za `temporary_password` (stavka 5 ispod). Frontend
trenutno traži minimum 8 karaktera na oba mesta kao razuman default. Ako
backend ima drugačije pravilo (npr. min. 6, ili zahteva broj/veliko slovo),
javite — usklađujemo validaciju da se korisnik ne odbija na frontu za nešto
što bi backend prihvatio, ili obrnuto.

---

## 2. `GET /api/cities` — odloženo, ne koristiti za dispečera

**Status: 📋 Već zadovoljeno, bez izmene koda**

Proverili smo — frontend nigde ne zove `GET /cities`. Lista gradova na
"Raspoređivanje" ekranu (`ZonesTab.vue`, `ZoneListPanel.vue`) se već izvodi
iz `city_id`/`city_name` polja postojećih firmi (`dispatcher/scheduling.vue`,
`cityOptions` computed), ne iz posebnog endpoint-a. Odluka od 16.08 (dodela
grada ide na Ordera super-admin nivo, ne dispečera) je već de facto
ispoštovana — nema akcije.

---

## 3. Lista kurira firme — `GET .../couriers-status`

**Status: ✅ Implementirano**

Nov tab **"Kuriri"** na dispečerskom ekranu "Firma" (`pages/dispatcher/company.vue`,
pored postojećih "Finansijske postavke" i "Saradnja sa restoranima"), scoped
po izabranoj firmi kao i ostala dva taba.

- `types/company-courier.ts` — `CompanyCourier` (`courier_id`, `name`,
  `phone`, `suspended`, `suspended_reason`, `suspended_at`, `vehicle: {id,
  type} | null`), `CourierSuspendPayload`, `CourierCreatePayload`.
- `services/dispatcherCouriersService.ts` — `fetchCompanyCouriers`,
  `setCourierSuspended`, `createCompanyCourier`, `removeCompanyCourier`.
- `composables/useCompanyCouriers.ts` — učitavanje po `companyId` (isti
  obrazac kao `useRestaurantCooperation`), optimistički suspend/aktiviraj sa
  rollback-om na grešku.
- `components/company/CompanyCouriersPanel.vue` — lista kurira (ime, telefon,
  bedž vozila ili "Vozilo nije dodato" ako je `vehicle: null` — tačno kako
  tiket traži, vidljivo bez načina da se doda kroz ovu listu), prekidač
  suspenduj/aktiviraj, dugme "Ukloni", dijalog "Dodaj kurira".

`vehicle.type` čita isti `VehicleKey` vokabular (`car`/`motorbike`/`bicycle`/`scooter`)
kao ostatak aplikacije (`utils/vehicle.ts`, `VEHICLE_META`) — primer iz
tiketa (`"type": "car"`) se poklapa, ponovo smo iskoristili postojeću mapu
umesto nove.

---

## 4. Suspenzija/aktivacija — `PATCH .../couriers/{courierId}/suspend`

**Status: ✅ Implementirano**

Prekidač po redu kurira. Suspendovanje otvara mali dijalog za opcioni
"Razlog" (tekst se šalje samo kad se suspenduje, prazno polje = bez
`reason` polja u telu); aktivacija ide direktno preko globalnog confirm
dijaloga (`useConfirmStore`) — backend sam briše stari `suspended_reason`
pri aktivaciji, front ga zato ni ne šalje.

---

## 5. Kreiranje novog kurira — `POST .../couriers`

**Status: ✅ Implementirano**

Dijalog "Dodaj kurira" (ime, prezime, telefon, email, privremena lozinka,
vozilo opciono). `utils/randomPassword.ts` — nova funkcija koja predlaže
nasumičnu lozinku (dispečer je slobodan da je prepiše), izbacuje vizuelno
slične karaktere (`0`/`O`, `1`/`l`/`I`) da bude lakša za diktiranje telefonom.
Ispod polja stoji upozorenje da sistem ne šalje email/SMS — dispečer sam
prosleđuje lozinku kuriru van sistema, tačno po napomeni iz tiketa.

Novi kurir dobija `must_change_password: true` sa backenda automatski — pri
prvoj prijavi videće baner iz stavke 1, bez dodatne akcije sa frontenda.

---

## 6. Uklanjanje kurira sa liste firme — `DELETE .../couriers/{courierId}`

**Status: ✅ Implementirano**

Dugme na redu kurira, potvrda preko `useConfirmStore` (crveno, tekst
eksplicitno objašnjava da kurir ostaje u sistemu, samo nestaje sa liste ove
firme — da dispečer ne pomeša ovo sa brisanjem naloga). Bez tela zahteva, kao
što tiket traži.

**Postojeći globalni `DELETE /couriers/{id}`** (brisanje naloga,
`state: 0`) namerno nije diran — tiket ga eksplicitno stavlja van
današnjeg fokusa.

---

# Šta smo promenili/dodali danas (ovaj krug)

Novi fajlovi:
- `app/types/company-courier.ts`
- `app/services/dispatcherCouriersService.ts`
- `app/composables/useCompanyCouriers.ts`
- `app/components/company/CompanyCouriersPanel.vue`
- `app/components/common/PasswordReminderBanner.vue`
- `app/utils/randomPassword.ts`

Izmenjeni fajlovi:
- `app/types/user.ts` (`must_change_password`)
- `app/services/authService.ts` (`changePassword`)
- `app/pages/change-password.vue` (od praznog stub-a do prave forme)
- `app/app.vue` (montiran `PasswordReminderBanner`)
- `app/pages/dispatcher/company.vue` (nov tab "Kuriri")

`npx nuxi typecheck` pokrenut posle izmena — postojeće greške u
`useVehicleRules.ts`/`AddTimeSlotDialog.vue`/`nuxt.config.ts` su prethodne,
nepovezane sa ovim krugom; nijedan od gore navedenih fajlova ne uvodi nove
greške.

# Šta čeka backend

1. Potvrda pravila za lozinku (min. dužina/kompleksnost) za `new_password` i
   `temporary_password` — stavka 1 iznad, frontend trenutno pretpostavlja
   minimum 8 karaktera.
