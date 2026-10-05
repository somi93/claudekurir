// GET /dispatcher/delivery-companies/{companyId}/couriers-balance (20.08) -
// "ko kome sta duguje" na nivou cijele firme.
//
// Od 01.09 (odgovor 1.2) red nosi i `name` + `phone` (JOIN na users tabelu) -
// bitno baš za "orphan" kurire koji su u balansu ali ih NEMA u couriers-status
// (otpušten / prebačen kurir s otvorenim stavkama; potvrđeno namjerno, nije
// bug). Za takve kurire ime iz couriers-status liste ne postoji, pa se koristi
// ovo. Opciono jer stariji odgovori polja nemaju - UI pada na "Kurir #id".
export type CourierBalance = {
  courier_id: number;
  name?: string | null;
  phone?: string | null;
  cash_owed_to_company: number;
  wage_owed_to_courier: number;
};
