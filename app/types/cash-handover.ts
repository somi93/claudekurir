// GET /dispatcher/delivery-companies/{companyId}/cash-handovers/pending (20.08) -
// "koga treba da potvrdim danas", sortirano najstarije prvo.
export type PendingCashHandover = {
  id: number;
  courier_id: number;
  reported_amount: string;
  reported_at: string;
};

export type CashHandoverStatus = "pending" | "confirmed";

// GET /dispatcher/delivery-companies/{companyId}/cash-handovers - SVE predaje
// (svi statusi, svi kuriri), sa opcionim filterima courier_id / status / from /
// to (datumi filtriraju po reported_at). Odgovor backenda DIO 3, tačka 3.2.
// Oblik potvrđen živim odgovorom 30.08: identičan kurirskoj varijanti
// (CourierCashHandover) + courier_id. Wrapper { success, data: [...] }, iznosi
// string, confirmed_* null dok nije "confirmed", note null ako nema razlike
// prijavljeno/potvrđeno (auto-tekst samo kad se razlikuju - 3.1). reported_at /
// confirmed_at su pravi UTC (D.1, 30.08).
export type CashHandoverHistoryItem = {
  id: number;
  courier_id: number;
  reported_amount: string;
  confirmed_amount: string | null;
  reported_at: string;
  confirmed_at: string | null;
  status: CashHandoverStatus;
  note: string | null;
  // Ko je potvrdio predaju - dodato u GET listu 30.08 (odgovor §3.5), za
  // rješavanje sporova. null dok je "pending".
  confirmed_by: number | null;
  confirmed_by_name: string | null;
};

// Sve null = bez filtera (šalje se prazan query). from/to su "YYYY-MM-DD".
export type CashHandoverHistoryFilters = {
  courierId: number | null;
  status: CashHandoverStatus | null;
  from: string | null;
  to: string | null;
};

// GET /couriers/{courierId}/cash-handovers - kurirska strana iste istorije
// (issue #223636, tačka 2): sopstvene predaje, potvrđene i na čekanju. Bez
// courier_id (uvijek prijavljeni kurir). Oblik potvrđen živim odgovorom 30.08:
// { success, data: [...] }, iznosi string ("50.00"), confirmed_* null dok nije
// potvrđeno, reported_at/confirmed_at su "...000000Z" wall-clock (vidi D.1).
export type CourierCashHandover = {
  id: number;
  reported_amount: string;
  confirmed_amount: string | null;
  reported_at: string;
  confirmed_at: string | null;
  status: CashHandoverStatus;
  note: string | null;
  // Dispečer koji je potvrdio predaju (odgovor §3.5) - null dok je "pending".
  confirmed_by: number | null;
  confirmed_by_name: string | null;
};
