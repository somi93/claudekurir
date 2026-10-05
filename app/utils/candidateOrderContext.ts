import { isLateDelivery } from "~/utils/dispatchBoard";
import { deliveryTiming } from "~/utils/dispatchBoardFormat";
import { toLatin } from "~/utils/toLatin";
import type { WaitingOrder } from "~/models/WaitingOrder";
import type { ActiveDelivery } from "~/models/ActiveDelivery";
import type { RefusedOrder } from "~/models/RefusedOrder";
import type { PendingRestaurantOrder } from "~/models/PendingRestaurantOrder";

// "Predloženi kuriri" (CandidateCouriersPanel) ima smisla SAMO za narudžbe koje
// čekaju kurira (prošle restoran, još nedodijeljene). candidate-couriers
// endpoint ne vraća status narudžbe, pa ga izvodimo iz board lista: ako je ID u
// "Čeka restoran" / "Čeka preuzimanje" / "U dostavi" / "Kupac odbio", slanje
// ponude (POST /orders/{id}/accept) će pasti sa 409 - bolje to reći dispečeru
// unaprijed nego prikazati sirovi "Order is no longer available for pickup".
export type CandidateOrderContext =
  | { state: "assignable" }
  | { state: "waiting_restaurant" }
  | { state: "assigned"; courierName: string; timingText: string; late: boolean }
  | { state: "refused" }
  | { state: "unknown" };

export const buildCandidateOrderContexts = (lists: {
  waiting: WaitingOrder[];
  pendingRestaurant: PendingRestaurantOrder[];
  booked: ActiveDelivery[];
  pickedUp: ActiveDelivery[];
  refused: RefusedOrder[];
}): Map<number, CandidateOrderContext> => {
  const map = new Map<number, CandidateOrderContext>();
  for (const o of lists.pendingRestaurant) map.set(o.id, { state: "waiting_restaurant" });
  for (const o of lists.waiting) map.set(o.id, { state: "assignable" });
  for (const d of [...lists.booked, ...lists.pickedUp]) {
    map.set(d.id, {
      state: "assigned",
      courierName: d.courier ? toLatin(d.courier.name) : "",
      timingText: deliveryTiming(d).text,
      late: isLateDelivery(d.minutesUntilDelivery),
    });
  }
  for (const o of lists.refused) map.set(o.id, { state: "refused" });
  return map;
};

// Ponuda prolazi samo za narudžbu koja čeka kurira. Za ostala stanja gasimo
// dugmad u CandidateCouriersPanel i objašnjavamo zašto - umjesto sirovog 409.
// "unknown" (narudžba nije ni u jednoj board listi - vjerovatno isporučena/
// otkazana/van perioda) je namjerno uključeno ovdje - inače je dugmad ostajala
// aktivna iako `buildOrderStateNote` ispod već ispisuje upozorenje da slanje
// vjerovatno neće uspjeti (potvrđeno uživo 28.09, narudžba #41858).
export const offersDisabledForContext = (ctx: CandidateOrderContext | null): boolean => {
  const s = ctx?.state;
  return s === "waiting_restaurant" || s === "assigned" || s === "refused" || s === "unknown";
};

export type CandidateOrderStateNote = { type: "info" | "warning"; text: string };

export const buildOrderStateNote = (
  ctx: CandidateOrderContext | null
): CandidateOrderStateNote | null => {
  if (!ctx || ctx.state === "assignable") return null;
  if (ctx.state === "waiting_restaurant") {
    return {
      type: "warning",
      text:
        "Narudžba još čeka potvrdu restorana — ponuda kuriru nije moguća dok restoran ne prihvati.",
    };
  }
  if (ctx.state === "assigned") {
    return {
      type: ctx.late ? "warning" : "info",
      text:
        `Narudžba već ima kurira${ctx.courierName ? `: ${ctx.courierName}` : ""}. ` +
        `${ctx.timingText}.`,
    };
  }
  if (ctx.state === "refused") {
    return {
      type: "warning",
      text: "Kupac je odbio ovu narudžbu — dodjela kurira nije moguća.",
    };
  }
  return {
    type: "warning",
    text:
      "Narudžba nije u aktivnim listama (možda je već isporučena, otkazana ili van perioda) — slanje ponude vjerovatno neće uspjeti.",
  };
};
