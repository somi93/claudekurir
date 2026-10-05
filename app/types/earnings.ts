// GET /couriers/{courierId}/earnings - živ oblik potvrđen 29.08 (NIJE kao u
// tiketu #223636 §6 - nema daily_breakdown / current_week / previous_week /
// hours_online / avg_per_day). Endpoint vraća:
//   total  - zbir zarade (svih vraćenih redova)
//   daily  - agregat po danu (datum, zarada, broj dostava)
//   data   - red po porudžbini (wage + koliko je pokupljeno gotovine)
export type CourierEarningsResponse = {
  success: boolean;
  total: number;
  daily: DailyEarningsDto[];
  data: OrderEarningsDto[];
};

export type DailyEarningsDto = {
  date: string; // "YYYY-MM-DD"
  amount: number; // zarada tog dana
  deliveries: number;
};

export type OrderEarningsDto = {
  order_id: number;
  wage: number;
  food_collected: number;
  // null viđen uživo (porudžbina bez naplate dostave od kupca).
  delivery_collected: number | null;
  collected_from_customer: number;
  date: string; // "YYYY-MM-DD HH:MM:SS" (bez Z - new Date() lokalno)
  // Mali natpis - zašto je ova dostava drugačije obračunata (npr. kurir
  // avansirao restoranu pa mu se dio naplate poništava) i po kom modelu je
  // zarada izračunata (mjesečno / procenat / po dostavi).
  // pay_rate_label je null samo za paying_type=1 (mjesečno, van ledgera).
  payment_type_label: string;
  pay_rate_label: string | null;
  // Ceo račun ("7.30 KM × 20% = 1.46 KM" / "Fiksno po dostavi: 2.00 KM") -
  // null kad pay_rate_label je null (mjesečno, nema po-dostavi računa).
  pay_rate_detail: string | null;
  // Koliko je ova dostava promijenila dug kurira prema firmi (npr. +1.36 kad kurir plaća
  // restoranu iz svog džepa: u dug ulazi samo cijena dostave). Backend ga još ne šalje
  // (stavka N1, dokument od 04.10.), pa je opciono - ekran ga čita čim stigne.
  cash_effect?: number | string | null;
};

// Sistemski dnevni agregat - kurirska strana je samo za čitanje. hoursOnline
// više ne stiže sa backenda (endpoint ga ne vraća), pa je izbačen iz modela.
export type DailyEarnings = {
  date: string;
  deliveries: number;
  earnings: number;
};

export type CourierEarnings = {
  total: number;
  daily: DailyEarnings[];
  orders: OrderEarnings[];
};

export type OrderEarnings = {
  orderId: number;
  // null kad backend pošalje nešto što nije iznos - bolje "nema obračuna" nego 0.00.
  wage: number | null;
  collectedFromCustomer: number | null;
  // Od čega se sastoji naplaćeni iznos (hrana + dostava). deliveryCollected je
  // null kad dostava nije naplaćena kupcu (npr. plaća restoran).
  foodCollected: number | null;
  deliveryCollected: number | null;
  date: string;
  paymentTypeLabel: string;
  payRateLabel: string | null;
  payRateDetail: string | null;
  // Koliko je dostava promijenila dug prema firmi; null dok backend ne pošalje polje.
  cashEffect: number | null;
};
