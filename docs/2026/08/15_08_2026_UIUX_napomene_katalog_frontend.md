# UI/UX napomene — katalog uslova, uz postojeći front

Ove napomene se referenciraju na **postojeći** "Dodatni parametri" ekran
(forma sa Naziv/Tip/Iznos/Jedinica/Opis/Vreme od/Vreme do, "Brzo dodavanje"
chip-ovi, kartice sa toggle-om) — ne pišemo iznova, samo dopunjujemo.

## "Brzo dodavanje" chip-ovi — sad iz API-ja, ne hardkodirano

Trenutno postoji bar jedan chip ("Sneg") — verovatno hardkodiran u kodu.
Zameni izvor: povuci listu iz `GET /api/condition-tags`, renderuj chip po
tag-u (`icon` + `name` iz odgovora). Kad korisnik klikne chip:

1. Popuni polje **Naziv** sa `tag.name` (zaključaj ga — korisnik ne menja)
2. Popuni **Vreme od/Vreme do** sa `tag.default_time_from`/`default_time_to`
   **ako postoje** (Gužva, Noćna dostava); ostavi prazno i isključi
   "Automatski po vremenu" prekidač ako su `null` (Kiša, Snijeg) — taj
   prekidač smo već razradili u ranijem mockup-u, ista logika ostaje
3. Pošalji `condition_tag_id: tag.id` uz ostatak forme pri čuvanju

## "Prilagođeni parametar" dugme — ostaje kako jeste

Ne menja se — otključava Naziv polje, `condition_tag_id` se ne šalje.

## Kartice — dodaj mali bedž

Na postojećoj kartici (ikonica + naziv + toggle + kanta), dodaj **jedan
mali red** na dnu:

- Ako `condition_tag` **nije** `null` u odgovoru → plavi bedž **"iz
  kataloga"**
- Ako **je** `null` → sivi bedž **"prilagođeno"**

Isti vizuelni koncept koji smo ranije pokazali kroz mockup — sad samo
konkretno vezan za `condition_tag` polje koje backend stvarno vraća.

## Šta se NE menja na postojećem

- Tip/Iznos/Jedinica/Opis polja — identična, bez izmene
- Toggle za `active` — identičan
- `activated_at` podsetnik ("Aktivno Xh Ymin") — već pokriven ranijim
  uputstvom, ne menja se ovim taskom
