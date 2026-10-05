// GET /couriers/{courierId}/payouts - istorija isplata zarade kuriru (Glovo
// "Isplate" tab). Oblik potvrđen živim odgovorom 30.08.
// - amount: string ("30.00"), decimal:2 kao dogovoreno (DIO 3.5).
// - note: backend sam generiše ("Isplata kuriru (gotovina)") ako dispečer ne
//   pošalje svoj; teoretski uvijek popunjen, ali držimo | null za svaki slučaj.
// - created_at: od 01.09 (odgovor D.1) ISO + Z, usklađeno s cash-handovers
//   ("...000000Z"). Ranije je bio "YYYY-MM-DD HH:MM:SS" bez offseta. formatDateTime
//   (new Date + lokalni getteri) barata s oba oblika. Prod sanity-check: D.3.
export type CourierPayout = {
  id: number;
  amount: string;
  note: string | null;
  created_at: string;
  transaction_id: string;
};

// Opcioni ?from= i ?to= (datumski filter, "YYYY-MM-DD"). null = filter nije
// postavljen (ne šalje se u query).
export type PayoutHistoryFilters = {
  from: string | null;
  to: string | null;
};

// GET /dispatcher/delivery-companies/{companyId}/payouts (odgovor §3.6, novo) -
// sve isplate firme, analogno cash-handovers istoriji. Isti red kao
// CourierPayout + courier_id.
export type CompanyPayout = CourierPayout & {
  courier_id: number;
};

// Opcioni ?courier_id= / ?from= / ?to=. null = filter nije postavljen.
export type CompanyPayoutFilters = {
  courierId: number | null;
  from: string | null;
  to: string | null;
};

// POST /couriers/{courierId}/payout - dispečer isplaćuje zaradu kuriru.
// method je slobodan tekst (npr. "gotovina", "bankovni transfer") - front nudi
// birač sa te dvije vrijednosti (mockup u issue-u), ali backend prima bilo šta.
//
// idempotency_key (backend odgovor 16.09.2026 §2) - generisan pri OTVARANJU
// forme (ne pri kliku), isti kroz sve pokušaje tog otvaranja (uključujući
// dupli klik/mrežni retry) - backend na isti kljuc vraca istu transakciju
// umjesto duple isplate. Novo otvaranje forme = novi kljuc.
export type PayoutRequest = {
  delivery_company_id: number;
  amount: number;
  method: string;
  note?: string;
  idempotency_key: string;
};

// Odgovor cash-receipt / payout akcija. warning se pojavi kad iznos premašuje
// trenutni dug (ne blokira, samo upozorava - odgovor §2.3).
export type CashPayoutActionResponse = {
  success: boolean;
  transaction_id: string;
  warning?: string;
};

// POST /dispatcher/couriers/{courierId}/cash-receipt - dispečer direktno
// evidentira primljenu gotovinu, bez prethodne prijave kurira (4c). Koristi se
// kad kurir ne koristi aplikaciju ili je predaja obavljena uživo.
export type CashReceiptRequest = {
  delivery_company_id: number;
  amount: number;
  note?: string;
};
