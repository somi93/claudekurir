import type { ReferredFriend, ReferredFriendDto } from "~/types/referral";

export const mapReferredFriendDto = (dto: ReferredFriendDto): ReferredFriend => ({
  id: dto.id,
  name: dto.name,
  status: dto.status,
  deliveriesDone: dto.deliveries_done,
  deliveriesRequired: dto.deliveries_required,
  invitedAt: dto.invited_at,
});
