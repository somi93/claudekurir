export type ReferralStatus = "invited" | "registered" | "active" | "rewarded";

export type ReferredFriend = {
  id: number;
  name: string;
  status: ReferralStatus;
  deliveriesDone: number;
  deliveriesRequired: number;
  invitedAt: string; // ISO date
};

export type ReferredFriendDto = {
  id: number;
  courier_id: number;
  referred_user_id: number | null;
  name: string;
  status: ReferralStatus;
  deliveries_done: number;
  deliveries_required: number;
  invited_at: string;
};

export type CourierReferralsResponse = {
  success: boolean;
  data: ReferredFriendDto[];
};

export type ReferralCreate = {
  name: string;
  deliveries_required: number;
  referred_user_id?: number;
  status?: ReferralStatus;
  invited_at?: string;
};
