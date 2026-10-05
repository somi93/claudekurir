export type ScoreFactor = {
  key: string;
  label: string;
  value: string;
  icon: string;
  positive: boolean;
};

export type BatchSlot = {
  batch: number;
  opensAt: string; // "08:00"
};

export type ScoreFactorDto = ScoreFactor;

export type CourierScoringDto = {
  current_batch: number;
  last_week_score: number;
  factors: ScoreFactorDto[];
};

export type CourierScoringResponse = {
  success: boolean;
  data: CourierScoringDto;
};
