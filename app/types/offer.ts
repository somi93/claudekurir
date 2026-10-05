// Model ponude narudžbe više kurira (backend odgovor 10.09.2026, stavke 2.3 +
// 2.4). Dispečer otvara "rundu" ponude preko POST /dispatcher/orders/{id}/offer;
// backend šalje push kuririma i sam prelazi na sljedećeg kandidata na
// decline/timeout. Stanje runde front čita jednom (GET) i dalje osvježava iz
// `.offer.round.changed` socket eventa.

// mode "sequential" = ponuda ide kuriru po kuriru (redom iz liste); "parallel"
// = svi kuriri dobiju ponudu odmah, prvi koji prihvati je dobija, ostali
// prelaze u "superseded".
export type OfferMode = "sequential" | "parallel";

// Stanje ponude pojedinačnog kurira u rundi. "none" = kuriru još nije poslata
// (na redu je kasnije, kod sequential). "superseded" = neko drugi je prihvatio
// prije njega (parallel).
export type CourierOfferStatus =
  | "none"
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "superseded";

// Stanje cijele runde - potvrđen pun enum od backenda 12.09 (OrderOfferRound
// model). "exhausted" = svi kandidati odbili/istekli; backend tad primjenjuje
// assignment_timeout_action (OPEN_TO_ALL / obavijesti dispečera). "canceled"
// (JEDNO "l") - npr. nova runda zamijeni staru.
export type OfferRoundStatus = "active" | "accepted" | "exhausted" | "canceled";

// Red iz data.offers (POST /offer i GET /offers - potvrđeno uživo 12.09, isti
// omotač na oba).
export type CourierOfferDto = {
  courier_id: number;
  offer_status: CourierOfferStatus;
  offer_expires_at: string | null;
  responded_at?: string | null;
  // claude 26.09.2026 - dispecerska vidljivost isporuke (backend
  // OfferRoundPayload). push_sent: null = jos nema podatka (npr. kurir
  // uopste ne postoji), inace true/false da li je FCM stvarno stigao na
  // uredjaj. socket_received_at: kurirova app potvrdila da je OBRADILA
  // `.courier.offers.changed` event za ovu ponudu (POST /courier/offers/{id}/ack).
  push_sent?: boolean | null;
  socket_received_at?: string | null;
};

// data.round iz istog odgovora. Vrijednosti `status` osim "active" i
// `timeout_action` osim "NEXT_NEAREST" nisu još viđene uživo (vidi
// 12_09_2026_Frontend_pitanja_za_backend.textile, A.5).
export type OfferRoundDto = {
  id: string;
  order_id: number;
  mode: OfferMode;
  batch_size: number;
  is_automatic: boolean;
  status: OfferRoundStatus;
  timeout_seconds: number;
  candidate_ids: number[];
  timeout_action: string;
  accepted_by: number | null;
  created_at: string;
  resolved_at: string | null;
};

// Cijeli odgovor POST /dispatcher/orders/{orderId}/offer i GET .../offers -
// potvrđeno uživo 12.09: { success, data: { round, offers, server_now } }.
export type OfferRoundStateDto = {
  round: OfferRoundDto;
  offers: CourierOfferDto[];
  server_now: string;
};

// Pretpostavka da socket payload nosi isti omotač kao REST - nije potvrđeno
// (test plan S4 nije još odrađen).
export type OfferRoundEventPayload = OfferRoundStateDto;

// Kurir koji je izostavljen iz runde pri slanju ponude (POST /offer, top-level
// `skipped` pored `data` - potvrđeno uživo 24.09, npr. "Kurir #30189 trenutno
// vozi drugu dostavu."). Backend šalje samo gotov tekst, pa ID vadimo iz
// "#<id>" da bi front mogao da zameni broj imenom iz liste kandidata.
export type SkippedCourier = {
  courierId: number | null;
  message: string;
};

// Rezultat POST /offer: stanje runde + kuriri koji nisu ušli u nju.
export type OpenOfferRoundResult = {
  round: OfferRound;
  skipped: SkippedCourier[];
};

// Telo POST /dispatcher/orders/{orderId}/offer.
export type OpenOfferRoundBody = {
  courier_ids: number[];
  mode: OfferMode;
  offer_timeout_seconds?: number;
};

// Normalizovan oblik za front (camelCase, Date za istek).
export type CourierOffer = {
  courierId: number;
  status: CourierOfferStatus;
  expiresAt: Date | null;
  pushSent: boolean | null;
  socketReceivedAt: Date | null;
};

export type OfferRound = {
  orderId: number | null;
  mode: OfferMode | null;
  roundStatus: OfferRoundStatus | null;
  offers: CourierOffer[];
  // round.candidate_ids - ko je uopšte u rundi (ostali kandidati iz liste NE dobijaju
  // ponudu). null = nema runde / payload ga ne nosi.
  candidateIds: number[] | null;
  // claude 21.09.2026 - kandidati koje je backend preskočio (nedostupan/zauzet/
  // neodgovarajuće vozilo) umjesto da odbije cijeli POST /offer. Top-level polje
  // uz "data" (ne unutar OfferRoundStateDto) - vidi DispatcherOrderMatchingController::offer().
  skipped: string[];
};

// Kurirska strana: red iz GET /courier/offers - potvrđeno uživo 12.09. Nema
// `offer_status` (ruta vraća samo ponude koje čekaju odgovor - sve su
// implicitno "pending"). Nosi pun order preview (`order.restaurant`,
// `order.location`, `delivery_price`) - bogatije od pretpostavke u A.11.
export type CourierInboxOfferDto = {
  offer_id: number;
  order_id: number;
  expires_at: string | null;
  mode?: OfferMode;
  restaurant_name?: string;
  delivery_price?: number;
  // true = kurir je premašio limit gotovine (viđeno uživo 30.09 u socket eventu
  // `.courier.offers.changed`; nije u dokumentaciji). Kurirska kartica ponude
  // prikazuje upozorenje. NIJE potvrđeno da ga nosi i GET /courier/offers.
  exceeded?: boolean;
  // Polja koja backend još ne šalje na ponudi (stavke 10-16 u dokumentu od
  // 03.10.2026): zarada kurira za ovu dostavu, udaljenosti (kad restoran nema
  // koordinate u ponudi) i serversko vrijeme za odbrojavanje.
  courier_earning?: number | string | null;
  pickup_distance_m?: number | null;
  trip_distance_m?: number | null;
  // Rutna udaljenost restoran -> kupac u km: isto polje koje backend već vraća na
  // GET /dispatcher/orders/waiting (28.08, stavka 7.2). Front ga čita kao trip_distance_m.
  distance_km?: number | string | null;
  server_now?: string | null;
  expires_in?: number | null;
  order?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OfferResponseAction = "accept" | "decline";
