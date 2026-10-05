import type { DispatcherCourierLocation } from "~/types/courier";

export type CourierState = "delivering" | "online" | "offline";

export type EnrichedCourierLocation = {
  courier: DispatcherCourierLocation;
  state: CourierState;
};

const STALE_AFTER_MS = 90_000;

// Prag posle kog se offline kurir smatra "davno nestalim" (ne samo da je
// upravo izgubio signal) - koristi se da takvi zapisi budu manje istaknuti
// na listi/mapi i potisnuti na dno, umesto da se mešaju sa nedavno offline
// kuririma.
const LONG_OFFLINE_MS = 60 * 60 * 1000;

// Backend status je merodavan (šalje ga i za starije zapise, npr. kurir koji
// je ručno prijavljen kao online pre par dana) - starost zapisa je samo
// fallback kad status nije prepoznat, ne sme da pregazi "delivering"/"online"
// koje backend eksplicitno vrati. Kurir bez `location` bloka (nema poznatu
// poziciju) je offline.
export const courierState = (
  courier: DispatcherCourierLocation,
  now: number
): CourierState => {
  const loc = courier.location;
  if (!loc) return "offline";
  if (loc.status === "delivering") return "delivering";
  if (loc.status === "offline") return "offline";
  if (loc.status === "online" || loc.status === "idle") return "online";

  const age = now - new Date(loc.updated_at).getTime();
  return age > STALE_AFTER_MS ? "offline" : "online";
};

export const isLongOffline = (courier: DispatcherCourierLocation, now: number) => {
  if (!courier.location) return true;
  return now - new Date(courier.location.updated_at).getTime() > LONG_OFFLINE_MS;
};

export const STATE_META: Record<CourierState, { label: string; color: string }> = {
  delivering: { label: "U dostavi", color: "#2f6fed" },
  online: { label: "Slobodan", color: "#00b37e" },
  offline: { label: "Offline", color: "#9aa4b2" },
};

// Redosled važnosti stanja za listu (aktivni kuriri prvi) - mapa koristi isti
// prioritet obrnuto, da aktivni markeri budu iscrtani preko neaktivnih.
export const STATE_PRIORITY: Record<CourierState, number> = {
  delivering: 0,
  online: 1,
  offline: 2,
};

// Zajedničke labele za `location` blok koji može biti null (kurir bez poznate
// pozicije) - drže null-guard na jednom mjestu umjesto u svakom template-u.
export const speedLabel = (location: { speed: number | null } | null): string =>
  location && location.speed ? `${location.speed.toFixed(1)} m/s` : "stoji";

export const lastSeenLabel = (
  location: { updated_at: string } | null,
  now: number
): string => (location ? relativeTime(location.updated_at, now) : "nema lokacije");

export const relativeTime = (timestamp: string, now: number) => {
  const diffSeconds = Math.round((now - new Date(timestamp).getTime()) / 1000);
  if (diffSeconds < 5) return "upravo sad";
  if (diffSeconds < 60) return `pre ${diffSeconds}s`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `pre ${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `pre ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  return `pre ${diffDays} ${diffDays === 1 ? "dan" : "dana"}`;
};
