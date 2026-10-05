import type { RoutingVehicle } from "~/types/courier";
import type { LatLngTuple } from "~/utils/geo";

// Linkovi za spoljašnju navigaciju (kurir već vozi uz Google Maps / Waze, mapa u
// aplikaciji je pregled). Uvijek postoji rezerva po adresi: restoran bez
// koordinata ne smije da ostavi kurira bez navigacije.
export type NavigationApp = "google" | "waze" | "apple";

export type NavigationTarget = {
  coords?: LatLngTuple | null;
  address?: string | null;
};

const GOOGLE_TRAVEL_MODE: Record<RoutingVehicle, string> = {
  car: "driving",
  bicycle: "bicycling",
  motorcycle: "two-wheeler",
  foot: "walking",
};

const APPLE_DIRECTION_FLAG: Record<RoutingVehicle, string> = {
  car: "d",
  bicycle: "w",
  motorcycle: "d",
  foot: "w",
};

const coordText = (coords: LatLngTuple) => `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;

export const hasNavigationTarget = (target: NavigationTarget): boolean =>
  Boolean(target.coords) || Boolean(target.address?.trim());

export const navigationUrl = (
  app: NavigationApp,
  target: NavigationTarget,
  vehicle: RoutingVehicle = "car"
): string | null => {
  const coords =
    target.coords && Number.isFinite(target.coords[0]) && Number.isFinite(target.coords[1])
      ? target.coords
      : null;
  const address = target.address?.trim() || null;
  if (!coords && !address) return null;

  const destination = coords ? coordText(coords) : address!;
  const encoded = encodeURIComponent(destination);

  switch (app) {
    case "google":
      return (
        `https://www.google.com/maps/dir/?api=1&destination=${encoded}` +
        `&travelmode=${GOOGLE_TRAVEL_MODE[vehicle]}&dir_action=navigate`
      );
    case "waze":
      return coords
        ? `https://waze.com/ul?ll=${encoded}&navigate=yes`
        : `https://waze.com/ul?q=${encoded}&navigate=yes`;
    case "apple":
      return `https://maps.apple.com/?daddr=${encoded}&dirflg=${APPLE_DIRECTION_FLAG[vehicle]}`;
  }
};

// Apple Maps ima smisla samo na Apple uređajima.
export const isAppleDevice = (): boolean =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
