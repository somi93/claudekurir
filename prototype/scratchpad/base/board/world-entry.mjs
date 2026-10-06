import { buildCouriers } from "../e2e/fx.mjs";
import { buildFinanceWorld, serveFinance } from "../e2e/fin-fx.mjs";
// Ponedjeljak 6. oktobar 2026, 14:20 (+02:00): sat je zaključan da brojke u tekstu table ostanu iste pri svakom otvaranju.
const NOW = Date.parse("2026-10-06T12:20:00.000Z");
window.FCW = {
  NOW,
  serveFinance,
  build(o = {}) {
    const now = new Date(NOW);
    const couriers = buildCouriers(o.n || 24, { now });
    const F = buildFinanceWorld({ now, couriers, nHistory: o.nHistory, nPayouts: o.nPayouts });
    return {
      company: { id: 24, name: "Ordera Dostava Banja Luka", city: "Banja Luka", currency: "KM" },
      settings: { delivery_company_id: 24, currency: "KM", cash_limit_amount: 200, cash_limit_enforcement: "BLOCK", payout_period_days: 7, daily_handover_time: "14:16" },
      couriers, F,
    };
  },
};
