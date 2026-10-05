import type { PricingCalculation } from "~/types/pricing";

export type MatchedRuleDto = {
  id: number;
  condition_type: string;
  condition_text: string;
  note: string | null;
};

export type VehicleRecommendationDto = {
  recommended_vehicles: string[];
  matched_rule: MatchedRuleDto | null;
  // Izračunata cijena dostave, ista logika kao "Primer obračuna" (tiket #223639,
  // 30.08). null ako distance_km nije poslat u zahtjevu. Opciono na DTO-u jer
  // stariji odgovori nemaju polje.
  price?: PricingCalculation | null;
};

export type MatchedRule = {
  id: number;
  conditionType: string;
  conditionText: string;
  note: string | null;
};

export type VehicleRecommendation = {
  recommendedVehicles: string[];
  matchedRule: MatchedRule | null;
  // Oblik je isti kao PricingCalculation (snake_case, kao i drugdje u kodu za
  // obračun) - prolazi bez remapiranja.
  price: PricingCalculation | null;
};
