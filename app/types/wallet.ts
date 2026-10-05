import type { CashLimitEnforcement } from "~/types/finance-settings";

// GET /couriers/{courierId}/wallet-balance - pravi ledger saldo, JEDINI izvor
// istine za kurirsku gotovinu. Ravan objekat, bez data wrappera.
//
// Odgovor backenda 28.08 (DIO 2, tačke 2.2 i 2.7): stari /couriers/{id}/wallet +
// /wallet-transactions je odvojen, ručno unošen sistem BEZ veze sa ledgerom -
// više se ne koristi na frontu (obrisan CashTransaction sloj). cash_limit_amount
// i cash_limit_enforcement su dodati na ovaj endpoint i sad stižu uživo.
export type CourierWalletBalance = {
  success: boolean;
  // Gotovina koju kurir trenutno drži = duguje firmi.
  cash_owed_to_company: number;
  // Zarada koju firma duguje kuriru.
  wage_owed_to_courier: number;
  // null = firma nije postavila limit gotovine ("bez limita").
  cash_limit_amount: number | null;
  // BLOCK - preko limita sistem NE spaja kurira sa keš porudžbinama dok ne
  // preda pazar; NOTIFY_ONLY - samo upozorenje, spajanje se nastavlja.
  cash_limit_enforcement: CashLimitEnforcement;
};
