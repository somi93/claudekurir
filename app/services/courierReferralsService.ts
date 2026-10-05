import { ofetch } from "ofetch";
import { useNuxtApp, useRuntimeConfig } from "nuxt/app";
import type {
  CourierReferralsResponse,
  ReferralCreate,
  ReferredFriend,
  ReferredFriendDto,
} from "~/types/referral";
import { mapReferredFriendDto } from "~/models/ReferredFriend";
import { REFERRAL_REWARD_DELIVERIES } from "~/config/referral";

export const fetchCourierReferrals = async (courierId: number): Promise<ReferredFriend[]> => {
  const response = await useNuxtApp().$api<CourierReferralsResponse>(
    `/couriers/${courierId}/referrals`
  );
  return (response.data ?? []).map(mapReferredFriendDto);
};

export const createReferral = async (
  courierId: number,
  payload: ReferralCreate
): Promise<ReferredFriend> => {
  const dto = await useNuxtApp().$api<ReferredFriendDto>(`/couriers/${courierId}/referrals`, {
    method: "POST",
    body: payload,
  });
  return mapReferredFriendDto(dto);
};

export const deleteReferral = async (id: number): Promise<void> => {
  await useNuxtApp().$api<void>(`/referrals/${id}`, {
    method: "DELETE",
  });
};

export type PublicReferralLead = {
  name: string;
};

// Poziva ga neulogovan posetilac /r/:courierId linka (nema nalog, nema token) -
// zato ide direktno preko ofetch-a, mimo $api iz plugins/api.client.ts. $api bi
// na 401 pokusao refresh (nema ga cim je gost) i preusmerio na /login, sto bi
// pokvarilo javnu landing stranicu.
//
// email/phone uklonjeni 14.08 - backend potvrdio da CourierReferralResource
// nema kolone za njih i tiho ih odbacuje (validate() ih ne sadrži).
export const createPublicReferralLead = async (
  courierId: number,
  lead: PublicReferralLead
): Promise<void> => {
  const runtimeConfig = useRuntimeConfig();
  await ofetch(`/couriers/${courierId}/referrals`, {
    baseURL: runtimeConfig.public.gpsApiBase as string,
    method: "POST",
    body: { ...lead, deliveries_required: REFERRAL_REWARD_DELIVERIES },
  });
};
