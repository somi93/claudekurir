import type { SessionStatus } from "~/types/session";

export { formatDate as formatSessionDate } from "~/utils/datetime";

export const SESSION_STATUS_META: Record<SessionStatus, { label: string; icon: string; color: string }> = {
  available: { label: "Dostupno", icon: "mdi-calendar-blank-outline", color: "secondary" },
  reserved: { label: "Rezervisano", icon: "mdi-calendar-check-outline", color: "primary" },
  completed: { label: "Odrađeno", icon: "mdi-check-circle-outline", color: "success" },
  "no-show": { label: "Nije se pojavio", icon: "mdi-alert-circle-outline", color: "error" },
};
