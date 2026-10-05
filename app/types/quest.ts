export type QuestStatus = "not-joined" | "in-progress" | "completed";

export type Quest = {
  id: number;
  title: string;
  description: string;
  goal: number;
  progress: number;
  unit: string;
  reward: string;
  deadline: string; // ISO date
  status: QuestStatus;
};

export type QuestDto = Quest;

export type CourierQuestsResponse = {
  success: boolean;
  data: QuestDto[];
};

export type QuestCreate = {
  title: string;
  description?: string;
  goal: number;
  unit: string;
  reward: string;
  deadline: string;
  status?: QuestStatus;
};

export type QuestUpdate = Partial<QuestCreate> & { progress?: number };
