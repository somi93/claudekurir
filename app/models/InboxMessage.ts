import type {
  InboxCategory,
  InboxMessage,
  InboxMessageDto,
  InboxSummaryEntry,
  InboxSummaryEntryDto,
} from "~/types/inbox";

// Nepoznata / izostavljena kategorija -> "announcement" (isti obrazac kao kod
// vehicle vokabulara: nepokriveni string ne smije da obori prikaz cijele liste).
const KNOWN_CATEGORIES: InboxCategory[] = ["announcement", "todo", "promotion", "offer"];

const normalizeCategory = (value: InboxMessageDto["category"]): InboxCategory =>
  value && KNOWN_CATEGORIES.includes(value) ? value : "announcement";

export const mapInboxMessageDto = (dto: InboxMessageDto): InboxMessage => ({
  id: dto.id,
  sender: dto.sender,
  category: normalizeCategory(dto.category),
  title: dto.title,
  body: dto.body,
  sentAt: dto.sent_at,
  read: dto.read,
});

export const mapInboxSummaryEntryDto = (dto: InboxSummaryEntryDto): InboxSummaryEntry => ({
  courierId: dto.courier_id,
  lastMessage: dto.last_message
    ? {
        title: dto.last_message.title,
        sentAt: dto.last_message.sent_at,
        category: normalizeCategory(dto.last_message.category),
        sender: dto.last_message.sender,
      }
    : null,
  dispatcherUnreadCount: dto.dispatcher_unread_count ?? 0,
});
