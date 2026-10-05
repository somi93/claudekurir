import type { CourierScoringDto, ScoreFactor } from "~/types/scoring";

export type CourierScoring = {
  currentBatch: number;
  lastWeekScore: number;
  scoreFactors: ScoreFactor[];
};

export const mapCourierScoringDto = (dto: CourierScoringDto): CourierScoring => ({
  currentBatch: dto.current_batch,
  lastWeekScore: dto.last_week_score,
  scoreFactors: dto.factors,
});
