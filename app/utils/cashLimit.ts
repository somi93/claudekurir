// Gotovina koju kurir nosi naspram limita firme, u tri stanja: u redu, blizu
// limita (od 80%) i preko limita. Ista pravila kao CashMeter u Novčaniku.
export const NEAR_RATIO = 0.8;

export type CashLimitState = "ok" | "near" | "over";

export type CashLimitSummary = {
  state: CashLimitState;
  // 0-100, za širinu trake.
  percent: number;
  // Koliko još smije da nosi do limita (0 kad je dostignut).
  remaining: number;
  // Koliko je preko limita (0 kad nije).
  exceeded: number;
  text: string;
};

const money = (value: number) => value.toFixed(2);

// `owed` = cash_owed_to_company (negativan saldo ne "puni" limit);
// `limit` = null znači da firma nije postavila limit, 0 je stroga vrijednost.
export const summarizeCashLimit = (owed: number, limit: number): CashLimitSummary => {
  const counted = Math.max(0, owed);
  const ratio = limit === 0 ? (counted > 0 ? 1 : 0) : counted / limit;
  const over = limit === 0 ? counted > 0 : counted >= limit;
  const near = !over && ratio >= NEAR_RATIO;
  const state: CashLimitState = over ? "over" : near ? "near" : "ok";
  const remaining = Math.max(0, limit - counted);
  const exceeded = Math.max(0, counted - limit);

  let text: string;
  if (state === "over") {
    text = exceeded > 0 ? `Preko limita za ${money(exceeded)} KM` : "Limit je dostignut";
  } else if (state === "near") {
    text = `Blizu limita · još ${money(remaining)} KM`;
  } else {
    text = limit === 0 ? "Bez dozvoljene gotovine" : `Još ${money(remaining)} KM do limita`;
  }

  return { state, percent: Math.min(100, Math.round(ratio * 100)), remaining, exceeded, text };
};
