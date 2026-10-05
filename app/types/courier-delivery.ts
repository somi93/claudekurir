import type { Order } from "~/models/Order";
import type { OrderEarnings } from "~/types/earnings";

// Kako firma obračunava zaradu za ovu dostavu:
//   delivery - po dostavi (fiksno / procenat) - zarada je poznata
//   monthly  - mjesečno (pay_rate_label je null) - zarade po dostavi nema
//   unknown  - za dostavu nema reda u /earnings
export type PayMode = "delivery" | "monthly" | "unknown";

// Jedna završena dostava kurira: spoj reda iz /history (ruta, adrese, vrijeme) i
// reda iz /earnings (zarada, naplata) po broju narudžbe. Svaki od dva dijela može
// nedostajati - istorija ne mora stići (greška) ili zarada ne mora stići / ne
// pokriva ovaj period - pa ekran radi sa onim što ima.
export type CourierDelivery = {
  id: number;
  // Vrijeme dostave u ms; null kad ga nijedan izvor nema.
  ts: number | null;
  order: Order | null;
  earnings: OrderEarnings | null;

  // Pripremljeno jednom pri spajanju, da lista i pretraga ne računaju iznova:
  restaurant: string | null; // naziv restorana (latinica)
  address: string | null; // puna adresa kupca (latinica)
  street: string | null; // samo ulica ("Vuka Karadžića")
  city: string | null;
  // Grad kupca se razlikuje od grada restorana (npr. dostava u drugi grad) - samo tada
  // se grad ispisuje u redu liste; inače je isti u svakom redu i samo krati ulicu.
  crossCity: boolean;
  payMode: PayMode;
  // Zarada za ovu dostavu; null = nema obračuna ili se plaća mjesečno.
  wage: number | null;
  // Koliko je kurir naplatio od kupca; null = kartica (ili nema obračuna).
  collected: number | null;
  // Ravan tekst za pretragu: restoran, adresa, grad i "#broj".
  search: string;
};
