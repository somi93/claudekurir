import type { ReferralStatus } from "~/types/referral";

export const REFERRAL_STATUS_META: Record<ReferralStatus, { label: string; icon: string; color: string }> = {
  invited: { label: "Pozvan", icon: "mdi-email-send-outline", color: "secondary" },
  registered: { label: "Registrovan", icon: "mdi-account-check-outline", color: "primary" },
  active: { label: "Aktivan", icon: "mdi-moped-outline", color: "warning" },
  rewarded: { label: "Nagrada isplaćena", icon: "mdi-gift-outline", color: "success" },
};
