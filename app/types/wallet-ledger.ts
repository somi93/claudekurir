import type { CourierDelivery } from "./courier-delivery";

// Kurirski Novčanik ima dva ODVOJENA računa (odluka 30.09: kurir ne zadržava
// zaradu iz gotovine, firma mu je isplaćuje posebno):
//   cash - dug kurira prema firmi (predaja gotovine dispečeru)
//   wage - dug firme prema kuriru (isplata zarade)
// Ista dostava se pojavljuje u oba, sa različitim iznosom.
export type WalletAccount = "cash" | "wage";
export type WalletPeriod = "today" | "week" | "month";
// Dodir na pločicu sažetka sužava listu: samo dostave, ili samo ono što knjiži
// račun (predaje u gotovini, isplate u zaradi).
export type WalletFilter = "delivery" | "settle";

// Predaja gotovine kako je ekran koristi (iz /cash-handovers). Iznosi su brojevi,
// vremena milisekunde.
export type WalletHandover = {
  id: number;
  // Prijavljena, dispečer je još nije potvrdio (ne smanjuje dug).
  pending: boolean;
  reported: number;
  // Potvrđeni iznos; null dok predaja čeka.
  confirmed: number | null;
  reportedAt: number;
  confirmedAt: number | null;
  // Ko je potvrdio (latinica); null dok čeka.
  confirmedBy: string | null;
  note: string | null;
};

// Isplata zarade (iz /payouts).
export type WalletPayout = {
  id: number;
  amount: number;
  ts: number;
  note: string | null;
  // transaction_id - broj za razgovor sa dispečerom.
  reference: string;
};

export type WalletItem =
  | { kind: "delivery"; key: string; ts: number; delivery: CourierDelivery }
  | { kind: "handover"; key: string; ts: number; handover: WalletHandover }
  | { kind: "payout"; key: string; ts: number; payout: WalletPayout };

// Jedan lokalni dan u listi (Danas / Juče / Pon, 28. sep).
export type WalletDayGroup = {
  key: string;
  label: string;
  items: WalletItem[];
  // "3 dostave · 21.40 KM" ili "2 stavke".
  meta: string;
};

// Šta je otvoreno iz adrese (?o=): list dostave / predaje / isplate, prijava ili pomoć.
export type WalletSheetRef =
  | { kind: "delivery"; id: number }
  | { kind: "handover"; id: number }
  | { kind: "payout"; id: number }
  | { kind: "report" }
  | { kind: "help" };

// Jedan korak vremenske linije u listu predaje / isplate; "off" je korak koji se još čeka.
export type WalletTimelineEvent = {
  label: string;
  value: string;
  note?: string;
  state?: "done" | "off";
};
