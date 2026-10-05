import { useNuxtApp } from "nuxt/app";
import { mapOrderDto, type Order } from "~/models/Order";
import type { OrderDto } from "~/types/order";
import type {
  CourierInboxOfferDto,
  CourierOffer,
  CourierOfferDto,
  OfferMode,
  OfferResponseAction,
  OfferRound,
  OfferRoundStateDto,
  OpenOfferRoundResult,
  SkippedCourier,
} from "~/types/offer";

// Puni model ponude više kurira (backend odgovor 10.09.2026, 2.3 + 2.4).
// Zamjenjuje jednokratni POST /orders/{id}/accept iz candidateCouriersService
// za slučaj kad dispečer hoće da PONUDI (ne tvrdo dodijeli) narudžbu.

const mapCourierOfferDto = (dto: CourierOfferDto): CourierOffer => ({
  courierId: dto.courier_id,
  status: dto.offer_status,
  expiresAt: dto.offer_expires_at ? new Date(dto.offer_expires_at) : null,
  pushSent: dto.push_sent ?? null,
  socketReceivedAt: dto.socket_received_at ? new Date(dto.socket_received_at) : null,
});

// REST (POST /offer, GET /offers, POST /offer/cancel) omotava u
// { success, data: { round: {...}, offers: [...], server_now } } - potvrđeno
// uživo 12.09/14.09. WS broadcast (`.offer.round.changed`) NEMA taj vanjski
// omotač - Echo/pusher-js već parsira "data" string iz Pusher poruke prije
// nego što stigne u `.listen()` callback, pa payload stiže direktno kao
// { round: {...}, offers: [...], server_now } (potvrđeno uživo 14.09, prvi put
// stvarno uhvaćen frame - ranije, 13.09, event uopšte nije stizao pa ovo nije
// moglo da se primijeti). Bez ovog unwrap-a, svaki live socket event je tiho
// proizvodio prazan round - UI se u praksi oslanjao isključivo na 10s poll.
export const normalizeOfferRound = (
  orderId: number,
  payload: unknown
): OfferRound => {
  const obj = (payload && typeof payload === "object" ? payload : {}) as {
    data?: Partial<OfferRoundStateDto>;
    skipped?: string[];
  } & Partial<OfferRoundStateDto>;
  const state = obj.data ?? obj;
  const round = state.round;
  const offers = state.offers ?? [];
  return {
    orderId: round?.order_id ?? orderId,
    mode: round?.mode ?? null,
    roundStatus: round?.status ?? null,
    offers: offers.map(mapCourierOfferDto),
    candidateIds: round?.candidate_ids ?? null,
    // skipped je top-level (uz "data"), ne unutar OfferRoundStateDto.
    skipped: obj.skipped ?? [],
  };
};

// Backend uz `data` šalje i top-level `skipped: string[]` - kuriri koje je
// izostavio iz runde s razlogom (potvrđeno uživo 24.09: "Kurir #30189
// trenutno vozi drugu dostavu."). Samo tekst, bez strukturiranog courier_id,
// pa se ID vadi iz "#<id>". Čita se i iz tijela greške (error.data) - ako su
// SVI izabrani preskočeni, backend najvjerovatnije ne otvara rundu i odgovara
// greškom; taj oblik nije još viđen uživo.
export const extractSkipped = (body: unknown): SkippedCourier[] => {
  const skipped = (body as { skipped?: unknown } | null | undefined)?.skipped;
  if (!Array.isArray(skipped)) return [];
  return skipped
    .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
    .map((message) => {
      const id = /#(\d+)/.exec(message)?.[1];
      return { courierId: id ? Number(id) : null, message };
    });
};

// POST /dispatcher/orders/{orderId}/offer - otvara rundu. Ne mijenja vlasništvo
// narudžbe dok neko ne prihvati. 201 vraća puno stanje runde, identično
// GET /offers (potvrđeno uživo 12.09) - pozivalac ne treba follow-up GET.
// delivery_company_id je obavezan kao query (potvrđeno na GET /offers, 11.09 -
// isti /dispatcher/orders/* prefiks kao waiting/candidate-couriers/refused).
export const openOfferRound = async (
  orderId: number,
  deliveryCompanyId: number,
  courierIds: number[],
  mode: OfferMode,
  offerTimeoutSeconds?: number
): Promise<OpenOfferRoundResult> => {
  const response = await useNuxtApp().$api<unknown>(
    `/dispatcher/orders/${orderId}/offer`,
    {
      method: "POST",
      query: { delivery_company_id: deliveryCompanyId },
      body: {
        courier_ids: courierIds,
        mode,
        ...(offerTimeoutSeconds ? { offer_timeout_seconds: offerTimeoutSeconds } : {}),
      },
    }
  );
  return {
    round: normalizeOfferRound(orderId, response),
    skipped: extractSkipped(response),
  };
};

// POST /dispatcher/orders/{orderId}/offer/cancel - prekida aktivnu rundu prije
// isteka (backend odgovor 14.09 - ruta ranije nije postojala, "Zatvori rundu"
// je do tad gasila samo klijentsku pretplatu/poll dok je runda ostajala aktivna
// na serveru). delivery_company_id ide u BODY ovdje (za razliku od open/fetch
// gdje je query) - potvrđeno primjerom u odgovoru.
export const cancelOfferRound = async (
  orderId: number,
  deliveryCompanyId: number
): Promise<OfferRound> => {
  const response = await useNuxtApp().$api<unknown>(
    `/dispatcher/orders/${orderId}/offer/cancel`,
    {
      method: "POST",
      body: { delivery_company_id: deliveryCompanyId },
    }
  );
  return normalizeOfferRound(orderId, response);
};

// GET /dispatcher/orders/{orderId}/offers - početno stanje runde (poslije se
// osvježava iz socket eventa, uz reconnect kao fallback). delivery_company_id
// obavezan - potvrđeno stvarnim 422 odgovorom 11.09 ("The delivery company id
// field is required.").
export const fetchOfferRound = async (
  orderId: number,
  deliveryCompanyId: number
): Promise<OfferRound> => {
  const response = await useNuxtApp().$api<unknown>(
    `/dispatcher/orders/${orderId}/offers`,
    { query: { delivery_company_id: deliveryCompanyId } }
  );
  return normalizeOfferRound(orderId, response);
};

// --- Kurirska strana ---

// Lista ponuda iz REST odgovora ili socket payload-a `.courier.offers.changed`
// (isti oblik: `{ success, data: [...] }`, potvrđeno uživo 25.09). Vraća null
// kad oblik nije prepoznat - pozivalac tad NE smije da tumači to kao "nema
// ponuda" (prazna lista je validan, drugačiji odgovor).
export const parseCourierOffers = (payload: unknown): CourierInboxOfferDto[] | null => {
  if (Array.isArray(payload)) return payload as CourierInboxOfferDto[];
  const obj = (payload ?? {}) as Record<string, unknown>;
  if (Array.isArray(obj.data)) return obj.data as CourierInboxOfferDto[];
  if (Array.isArray(obj.offers)) return obj.offers as CourierInboxOfferDto[];
  return null;
};

// GET /courier/offers - ponude koje čekaju ulogovanog kurira (početno stanje i
// fallback; nove ponude stižu kroz socket).
export const fetchCourierOffers = async (): Promise<CourierInboxOfferDto[]> => {
  const response = await useNuxtApp().$api<unknown>("/courier/offers");
  return parseCourierOffers(response) ?? [];
};

// POST /orders/{orderId}/offer-response - kurir prihvata ili odbija ponudu.
// Odvojeno od self-serve POST /orders/{id}/accept. Odgovor je
// `{ success, message, data: <narudžba> }` (28.09): kod prihvatanja vraćamo tu
// narudžbu da ekran odmah pređe na dostavu, bez praznog trenutka do sljedećeg
// GET-a. Za odbijanje (i ako `data` izostane) vraća null.
export const respondToOffer = async (
  orderId: number,
  action: OfferResponseAction
): Promise<Order | null> => {
  const response = await useNuxtApp().$api<{ data?: Partial<OrderDto> | null } | null>(
    `/orders/${orderId}/offer-response`,
    {
      method: "POST",
      body: { action },
    }
  );
  const data = response?.data;
  if (action !== "accept" || !data || typeof data !== "object" || typeof data.id !== "number") {
    return null;
  }
  return mapOrderDto(data as OrderDto);
};

// POST /courier/offers/{offerId}/ack - kurirova app zove ovo cim OBRADI
// `.courier.offers.changed` socket event za konkretnu ponudu (ne cim korisnik
// reaguje), da dispecer uzivo vidi da je ponuda stvarno stigla preko
// Reverb-a. Best-effort/idempotentno na backendu - pozivalac (useCourierOffers)
// gasi gresku, ne sme da prekine kurirov UI tok.
export const ackOffer = async (offerId: number): Promise<void> => {
  await useNuxtApp().$api(`/courier/offers/${offerId}/ack`, { method: "POST" });
};
