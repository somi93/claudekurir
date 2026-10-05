import type { CandidateCourier } from "~/types/candidateCourier";
import type { FinanceSettings } from "~/types/finance-settings";

// Pravila firme koja odlučuju kome dispečer smije poslati ponudu. Izvedena iz
// finance-settings; dok se postavke ne učitaju (null) ne blokira se ništa na
// osnovu njih - backend ionako ima zadnju riječ (409 / skipped).
export type OfferPolicy = {
  // cash_limit_enforcement === "BLOCK": kurir preko limita ne može prihvatiti.
  blockCashLimit: boolean;
  // assignment_courier_pool === "AVAILABLE_NOW": ponuda samo dostupnima.
  requireAvailable: boolean;
};

export type OfferBlockReason = "on_delivery" | "cash_limit" | "unavailable";

// PRIVREMENO ZA TEST: true = blokiranim kandidatima (na isporuci, limit gotovine,
// nedostupan) ponuda se ipak može poslati - čekiranjem i dugmetom "Pošalji
// ponudu". Oznake (crveni čipovi), sekcija "Ne mogu dobiti ponudu" i redoslijed
// ostaju isti; mijenja se samo zaključavanje akcija. Backend ionako ima zadnju
// riječ (skipped / 409). Vrati na false kad se završi testiranje.
export const ALLOW_OFFER_TO_BLOCKED = false;

export const offerPolicyFromSettings = (settings: FinanceSettings | null): OfferPolicy => ({
  blockCashLimit: settings?.cash_limit_enforcement === "BLOCK",
  requireAvailable: settings?.assignment_courier_pool === "AVAILABLE_NOW",
});

// Razlozi zbog kojih ovom kuriru NE može poslati ponuda (prazno = može).
// "Na isporuci" blokira uvijek - backend ga odbija i ručno i u automatskoj rundi.
export const offerBlockReasons = (
  candidate: CandidateCourier,
  policy: OfferPolicy
): OfferBlockReason[] => {
  const reasons: OfferBlockReason[] = [];
  if (candidate.onDelivery) reasons.push("on_delivery");
  if (candidate.cashLimitExceeded && policy.blockCashLimit) reasons.push("cash_limit");
  if (!candidate.currentlyAvailable && policy.requireAvailable) reasons.push("unavailable");
  return reasons;
};

// Da li su akcije slanja ponude (čekiranje, "Pošalji ponudu") zaključane za
// kandidata. Razlikuje se od offerBlockReasons samo dok je ALLOW_OFFER_TO_BLOCKED
// uključen - tada je blokiran kandidat i dalje označen, ali nije zaključan.
export const isOfferSendLocked = (candidate: CandidateCourier, policy: OfferPolicy): boolean =>
  !ALLOW_OFFER_TO_BLOCKED && offerBlockReasons(candidate, policy).length > 0;
