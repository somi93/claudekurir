import type { Quest, QuestDto } from "~/types/quest";

export const mapQuestDto = (dto: QuestDto): Quest => ({ ...dto });
