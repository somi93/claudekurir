import { onMounted, ref } from "vue";
import { readStored, writeStored } from "~/utils/deviceStorage";
import { parseTemplates, TEMPLATES, type MessageDraft, type MessageTemplate } from "~/utils/messageDraft";

const KEY = "poruke-sabloni";
const MAX_LABEL = 40;

// Šabloni poruka: pet početnih tekstova (prijedlog formulacije, dispečer ih mijenja prije slanja) i
// lični šabloni koji ostaju u pregledaču. Zajednički šabloni po firmi bi tražili backend (B8).
export const useMessageTemplates = () => {
  const mine = ref<MessageTemplate[]>([]);

  onMounted(() => {
    mine.value = parseTemplates(readStored("local", KEY));
  });

  const persist = () => writeStored("local", KEY, JSON.stringify(mine.value));

  const save = (label: string, draft: MessageDraft): MessageTemplate => {
    const t: MessageTemplate = {
      id: `u${Date.now()}`,
      label: label.trim().slice(0, MAX_LABEL),
      category: draft.category,
      title: draft.title.trim(),
      body: draft.body.trim(),
    };
    mine.value = [...mine.value, t];
    persist();
    return t;
  };

  const remove = (id: string) => {
    mine.value = mine.value.filter((t) => t.id !== id);
    persist();
  };

  const find = (id: string): MessageTemplate | undefined =>
    [...TEMPLATES, ...mine.value].find((t) => t.id === id);

  return { builtin: TEMPLATES, mine, save, remove, find, MAX_LABEL };
};
