export type InboxSender = "dispatcher" | "platform";

// category polje (spec #223681) - postoji na backendu od ranije, sad izloženo u
// UI-ju. "offer" je REZERVISAN za automatske ponude za dostavu (sistem ih sam
// generiše) - dispečer ga NE bira ručno, zato nije u DISPATCHER_MESSAGE_CATEGORIES.
export type InboxCategory = "announcement" | "todo" | "promotion" | "offer";

// Podskup koji dispečer smije da pošalje (bez "offer").
export type DispatcherMessageCategory = Exclude<InboxCategory, "offer">;

export type InboxMessage = {
  id: number;
  sender: InboxSender;
  category: InboxCategory;
  title: string;
  body: string;
  sentAt: string; // ISO datetime
  read: boolean;
};

export type InboxMessageDto = {
  id: number;
  sender: InboxSender;
  category: InboxCategory | null;
  title: string;
  body: string;
  sent_at: string;
  read: boolean;
};

// meta se pojavi TEK ako se pošalje ?page= (spec #223681, tačka 3). Bez njega
// odgovor je čist niz u `data` - zato opciono.
export type InboxPaginationMeta = {
  current_page: number;
  last_page: number;
  total: number;
};

export type CourierInboxResponse = {
  success: boolean;
  data: InboxMessageDto[];
  meta?: InboxPaginationMeta;
};

// Query parametri za GET /couriers/{id}/inbox - svi opcioni, ponašanje se ne
// mijenja ako se ne pošalju (spec #223681, tačka 3).
export type CourierInboxQuery = {
  category?: InboxCategory;
  page?: number;
  perPage?: number;
};

export type CourierInboxPage = {
  messages: InboxMessage[];
  meta: InboxPaginationMeta | null;
};

// Isti oblik pod kraćim imenom - koristi ga kurirski store sandučeta.
export type InboxPage = CourierInboxPage;

// POST /api/couriers/{courierId}/inbox (spec 27_08_2026_dispecer-inbox-poruke).
// sender: "dispatcher" dodaje servis; dispečer šalje naslov + tekst + kategoriju.
// Backend vraća 403 ako dispečer ne dijeli aktivnu vezu (delivery_company_user)
// sa tim kurirom. category je opciona - backend default "announcement".
export type SendInboxMessagePayload = {
  category: DispatcherMessageCategory;
  title: string;
  body: string;
};

// POST /api/dispatcher/delivery-companies/{companyId}/broadcast (spec #223681,
// tačka 2). Ili courier_ids + all_couriers:false (izabrani), ili all_couriers:true
// (svi kuriri firme) - tada courier_ids izostaje.
export type BroadcastMessagePayload = {
  category: DispatcherMessageCategory;
  title: string;
  body: string;
} & (
  | { all_couriers: true }
  | { all_couriers: false; courier_ids: number[] }
);

export type BroadcastResponse = {
  success: boolean;
  data: { sent_to_count: number };
};

// GET .../inbox-summary (zahtjev 13.09, odgovor backend 15.09 "SREĐENO") -
// zbirni red po kuriru za "Istorija poslatih poruka" (bez N poziva po kuriru).
// Oblik DTO-a je onaj koji je frontend tražio - backend odgovor nije naveo
// konkretan JSON, treba potvrditi uživo (network checklist 15.09).
export type InboxSummaryLastMessageDto = {
  title: string;
  sent_at: string;
  category: InboxCategory | null;
  sender: InboxSender;
};

export type InboxSummaryEntryDto = {
  courier_id: number;
  last_message: InboxSummaryLastMessageDto | null;
  dispatcher_unread_count: number;
};

export type InboxSummaryLastMessage = {
  title: string;
  sentAt: string;
  category: InboxCategory;
  sender: InboxSender;
};

export type InboxSummaryEntry = {
  courierId: number;
  lastMessage: InboxSummaryLastMessage | null;
  dispatcherUnreadCount: number;
};
