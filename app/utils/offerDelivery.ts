import type { CourierOfferStatus } from "~/types/offer";

// Jedna rečenica šta se desilo sa ponudom na putu do kurira (samo za "nije
// odgovorio" i ponudu koja još čeka). seenLive = kurir je bio u aplikaciji pa mu
// se ponuda prikazala (socket_received_at), pushSent = stiglo je push obavještenje.
export const offerDiagnosis = (
  status: CourierOfferStatus,
  pushSent: boolean | null,
  seenLive: boolean
): string | null => {
  if (status === "expired") {
    if (seenLive) return "Vidio ponudu, nije odgovorio.";
    if (pushSent) return "Obavještenje stiglo, aplikaciju nije otvorio.";
    return "Ponuda nije stigla — vjerovatno je offline.";
  }
  if (status === "pending" && !seenLive) {
    return pushSent ? "Čeka da otvori aplikaciju." : "Ponuda još nije stigla.";
  }
  return null;
};
