<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Poruka kuriru"
    :subtitle="subtitle"
    :dirty="Boolean(draft.title.trim() || draft.body.trim())"
    focus="title"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div v-if="recipients.length > 1" class="ms-who">
      <span class="ms-ic"><v-icon icon="mdi-account-group-outline" size="20" /></span>
      <span>
        <small>Primaoci</small>
        <b>{{ everyone ? `Svi kuriri firme (${recipients.length})` : couriersText(recipients.length) }}</b>
        <em>{{ who }}{{ suspendedCount ? ` · uključuje ${suspendedCount} suspendovana` : "" }}</em>
      </span>
    </div>

    <ChoiceGroup
      :model-value="draft.category"
      :options="CATEGORIES"
      label="Kategorija"
      variant="pills"
      :columns="3"
      @update:model-value="pickCategory(String($event) as DispatcherMessageCategory)"
    />
    <SheetField
      v-model="draft.title"
      name="title"
      label="Naslov"
      enterkeyhint="next"
      :message="serverMessage('title')"
      @update:model-value="edited"
    />
    <SheetTextarea
      v-model="draft.body"
      name="body"
      label="Poruka"
      :message="serverMessage('body')"
      @update:model-value="edited"
    />

    <div class="ms-prev" aria-live="polite">
      <small>Tako kurir vidi poruku</small>
      <div class="m" :style="{ '--ink': meta.ink, '--tint': meta.tint }">
        <span class="ic"><v-icon :icon="meta.icon" size="20" /></span>
        <span>
          <b>{{ draft.title || "Naslov poruke" }}</b>
          <span>{{ draft.body || "Tekst poruke se vidi ovdje." }}</span>
        </span>
      </div>
    </div>

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da pošaljem">{{ error }}</TintAlert>

    <template #footer>
      <AppButton submit :disabled="!check.valid" :loading="saving">
        {{ saving ? "Šaljem…" : "Pošalji" }}
      </AppButton>
      <p>{{ !saving && !check.valid ? check.hint : "" }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import SheetField from "~/components/common/SheetField.vue";
import SheetTextarea from "~/components/common/SheetTextarea.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import type { MessageDraft } from "~/utils/messageDraft";
import { checkMessage, couriersText, type RosterCourier } from "~/utils/courierRoster";
import { CATEGORY_META, DEFAULT_MESSAGE_CATEGORY, DISPATCHER_MESSAGE_CATEGORIES } from "~/utils/inbox";
import type { FieldMsg } from "~/utils/profileForm";
import type { DispatcherMessageCategory } from "~/types/inbox";

// List "Poruka kuriru": jedan za jednog kurira, za sve koje lista trenutno prikazuje (filter već
// kaže ko je primalac) ili za izabrane kurire. Ispod polja je pregled kako kurir vidi poruku.
const props = defineProps<{
  open: boolean;
  recipients: RosterCourier[];
  // Odakle primaoci: "Svi koje trenutno vidiš u listi", "Izabrani u listi".
  who: string;
  // Svi kuriri firme (šalje se kao all_couriers).
  everyone: boolean;
  send: (ids: number[], draft: MessageDraft) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean]; sent: [ids: number[]] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const CATEGORIES: ChoiceOption[] = DISPATCHER_MESSAGE_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
  icon: CATEGORY_META[c.value].icon,
}));

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ category: DEFAULT_MESSAGE_CATEGORY as DispatcherMessageCategory, title: "", body: "" })
);

const subtitle = computed(() =>
  props.recipients.length === 1
    ? `${props.recipients[0]?.name} · #${props.recipients[0]?.id}`
    : `${props.recipients.length} primalaca`
);
const suspendedCount = computed(() => props.recipients.filter((c) => c.suspended).length);
const meta = computed(() => CATEGORY_META[draft.category]);
const check = computed(() => checkMessage(draft));

const serverMessage = (key: string): FieldMsg | null =>
  serverFields.value[key] ? { tone: "bad", text: serverFields.value[key] as string } : null;

const pickCategory = (category: DispatcherMessageCategory) => {
  draft.category = category;
  edited();
};

const ids = () => props.recipients.map((c) => c.id);

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => check.value.valid,
  firstBad: () => (draft.title.trim() ? "body" : "title"),
  run: () => props.send(ids(), { category: draft.category, title: draft.title, body: draft.body }),
  success: () => {
    const n = props.recipients.length;
    return `Poruka poslata ${n} ${n === 1 ? "kuriru" : "kurira"}.`;
  },
  onDone: () => emit("sent", ids()),
});
</script>

<style scoped>
.ms-who {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.ms-who > span:last-child {
  display: grid;
  gap: 1px;
}

.ms-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #eef4ff;
  color: #2459c7;
}

.ms-who small {
  font-size: 0.76rem;
  font-weight: 700;
  color: #5b6676;
}

.ms-who b {
  font-size: 0.98rem;
}

.ms-who em {
  font-size: 0.8rem;
  font-style: normal;
  color: #5b6676;
}

.ms-prev {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px dashed #cfd5df;
  border-radius: 14px;
  background: #f7f8fa;
}

.ms-prev small {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6676;
}

.m {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 8px;
  border-radius: 12px;
  background: #fff;
}

.m .ic {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--tint);
  color: var(--ink);
}

.m b,
.m > span:last-child > span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.m b {
  font-size: 0.88rem;
}

.m > span:last-child > span {
  font-size: 0.8rem;
  color: #5b6676;
}
</style>
