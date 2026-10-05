import type { LatLngTuple } from "~/utils/geo";

// Tačka na mapi ekrana Dostave: restoran (žuti pin) ili kupac (tamni pin).
// `dim` = sljedeći cilj koji još nije na redu (prigušen, ne ulazi u uklapanje kadra).
export type MapPin = {
  key: string;
  kind: "restaurant" | "customer";
  latLng: LatLngTuple;
  label?: string | null;
  dim?: boolean;
};

// Šta zaklanja mapu (pilula, plutajuće dugme, panel), u pikselima. Kamera
// uklapa i centrira kurira u preostalom, vidljivom dijelu.
export type MapInsets = { top: number; right: number; bottom: number; left: number };

// "fit" = cijela ruta (kurir + trenutni cilj), "follow" = prati kurira.
// Slobodno (kurir povukao mapu) je zasebna oznaka `free`, ne treći režim.
export type CameraMode = "fit" | "follow";

export type CameraState = { mode: CameraMode; free: boolean };
