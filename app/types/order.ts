export type City = {
  id: number;
  name: string | null;
  code: string | null;
};

export type Location = {
  id: number;
  address: string | null;
  apartment: string | null;
  floor: string | null;
  firm: string | null;
  zip: string | null;
  coordination: { lat: number; lng: number } | null;
  city?: City | null;
};

export type Restaurant = {
  id: number;
  name: string | null;
  address: string | null;
  city?: City | null;
  location?: Location | null;
};

export type OrderDto = {
  id: number;
  user_id: number | null;
  restaurant_id: number | null;
  company_id: number | null;
  // Dostavna firma restorana (Restaurant::deliveryCompanies(), prva aktivna) -
  // odvojeno od company_id (korporativna ishrana, nepovezano). Dodato 14.08.
  delivery_company_id: number | null;
  location_id: number | null;
  state: string | null;
  delivery_type: number | null;
  date: string | null;
  delivery_time: string | null;
  guest_number: number | null;
  currency: string | null;
  delivery_price: number | null;
  location?: Location | null;
  restaurant?: Restaurant | null;
  // Polja koja kurirski ekran Dostave već zna da pročita, a backend ih još ne
  // šalje (docs/2026/10/03_10_2026_Frontend_pitanja_za_backend.textile, stavke
  // 10-16). Kad stignu, prikaz se pojavi sam - bez izmjene fronta.
  amount_to_collect?: number | string | null;
  payment_method?: string | null;
  total_price?: number | string | null;
  courier_earning?: number | string | null;
  restaurant_phone?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_note?: string | null;
  ready_at?: string | null;
  // Polja koja ekran Istorija zna da pročita, a backend ih još ne šalje
  // (docs/2026/10/03_10_2026_Frontend_pitanja_za_backend.textile, Dio 3). Kad
  // stignu, u detalju dostave se pojave kilometri i trajanje - bez izmjene fronta.
  distance_km?: number | string | null;
  accepted_at?: string | null;
  picked_up_at?: string | null;
};

export type OrdersResponse = {
  success: boolean;
  data: OrderDto[];
};

export type OrderActionResponse = {
  success: boolean;
  message: string;
  // Postoji uvijek (i kad je null) - popunjava se samo na accept() kad je
  // kurir preko cash_limit_amount svoje firme i firma ima NOTIFY_ONLY (vidi
  // cash-limit-frontend.textile). Kod BLOCK-a accept() umjesto ovoga baca 409.
  warning?: string | null;
  // Strukturirani iznosi gotovine - stižu na SVAKI accept() odgovor: null kad
  // kurir nije blizu limita, brojevi kad jeste (i za NOTIFY_ONLY i za BLOCK
  // slučaj, iako BLOCK vrati 409 pa se ova polja tamo čitaju iz tela greške).
  // Odgovor backenda DIO 2, tačka 2.1.
  current_cash_amount?: number | null;
  cash_limit_amount?: number | null;
  data?: OrderDto;
};

export type DeliveredOrderDto = OrderDto & { delivered_at: string };

export type CourierHistoryResponse = {
  success: boolean;
  data: DeliveredOrderDto[];
};
