<template>
  <div class="cmp" @keydown="onKey">
    <div v-if="restoredAt || canUndo" class="cmp-bar" role="status">
      <v-icon :icon="restoredAt ? 'mdi-content-save-outline' : 'mdi-information-outline'" size="18" />
      <span>
        {{ restoredAt ? `Vraćen nacrt od ${restoredAt}.` : "Šablon je zamijenio tvoj tekst." }}
      </span>
      <button
        type="button"
        :data-messages="restoredAt ? 'drop-draft' : 'undo-template'"
        @click="restoredAt ? emit('dropDraft') : emit('undo')"
      >
        {{ restoredAt ? "Odbaci nacrt" : "Vrati moj tekst" }}
      </button>
    </div>

    <section class="cmp-sec" aria-labelledby="cmp-kome">
      <h2 id="cmp-kome" class="gt">Kome</h2>
      <slot name="audience" />
    </section>

    <section class="cmp-sec" aria-labelledby="cmp-poruka">
      <h2 id="cmp-poruka" class="gt">
        <span>Poruka</span>
        <v-menu location="bottom end" :close-on-content-click="true">
          <template #activator="{ props: menu }">
            <button v-bind="menu" type="button" class="cmp-tpl" data-messages="templates" aria-haspopup="menu">
              <v-icon icon="mdi-text-box-outline" size="18" />Šabloni<v-icon icon="mdi-chevron-down" size="18" />
            </button>
          </template>
          <v-list density="comfortable" role="menu" aria-label="Šabloni" class="cmp-menu">
            <v-list-subheader>Početni tekstovi</v-list-subheader>
            <v-list-item
              v-for="t in builtin"
              :key="t.id"
              role="menuitem"
              :data-template="t.id"
              :title="t.label"
              :subtitle="t.title"
              @click="emit('applyTemplate', t.id)"
            >
              <template #prepend>
                <span class="cmp-ti" :style="tone(t.category)"><v-icon :icon="getCategoryMeta(t.category).icon" size="20" /></span>
              </template>
            </v-list-item>
            <template v-if="mine.length">
              <v-divider />
              <v-list-subheader>Tvoji šabloni</v-list-subheader>
              <v-list-item
                v-for="t in mine"
                :key="t.id"
                role="menuitem"
                :data-template="t.id"
                :title="t.label"
                :subtitle="t.title"
                @click="emit('applyTemplate', t.id)"
              >
                <template #prepend>
                  <span class="cmp-ti" :style="tone(t.category)"><v-icon :icon="getCategoryMeta(t.category).icon" size="20" /></span>
                </template>
                <template #append>
                  <button
                    type="button"
                    class="cmp-td"
                    :aria-label="`Obriši šablon ${t.label}`"
                    :data-template-delete="t.id"
                    @click.stop="emit('deleteTemplate', t.id)"
                  >
                    <v-icon icon="mdi-trash-can-outline" size="20" />
                  </button>
                </template>
              </v-list-item>
            </template>
            <v-divider />
            <v-list-item
              role="menuitem"
              data-messages="save-template"
              :disabled="blank"
              title="Sačuvaj ovu poruku kao šablon"
              :subtitle="blank ? 'Prvo upiši naslov i tekst' : 'Ostaje u ovom pregledaču'"
              prepend-icon="mdi-content-save-outline"
              @click="emit('saveTemplate')"
            />
          </v-list>
        </v-menu>
      </h2>

      <div class="cmp-form">
        <ChoiceGroup
          :model-value="draft.category"
          :options="CATEGORIES"
          label="Kategorija"
          variant="pills"
          :columns="3"
          @update:model-value="emit('edit', { category: String($event) as DispatcherMessageCategory })"
        />
        <SheetField
          :model-value="draft.title"
          name="title"
          label="Naslov"
          enterkeyhint="next"
          :message="fieldMsg('title')"
          @update:model-value="emit('edit', { title: $event })"
          @blur="touched.title = true"
          @keydown.enter.exact.prevent="focusBody"
        />
        <div>
          <SheetTextarea
            :model-value="draft.body"
            name="body"
            label="Tekst poruke"
            :rows="4"
            :message="fieldMsg('body')"
            @update:model-value="emit('edit', { body: $event })"
            @blur="touched.body = true"
          />
          <p class="cmp-hint">
            <span><v-icon icon="mdi-information-outline" size="16" />Brojevi telefona i linkovi u tekstu postaju dodirljivi.</span>
            <span class="cmp-count">{{ draft.body.length ? `${draft.body.length} znakova` : "" }}</span>
          </p>
        </div>
      </div>
    </section>

    <section class="cmp-sec" aria-labelledby="cmp-pregled">
      <h2 id="cmp-pregled" class="gt">Pregled</h2>
      <div class="cmp-pv"><MessagePreview :draft="draft" :now="now" /></div>
    </section>

    <div class="cmp-foot">
      <TintAlert v-if="sendError" tone="bad" role="alert" title="Ne mogu da pošaljem">{{ sendError }}</TintAlert>
      <AppButton
        icon="mdi-send-outline"
        data-messages="send"
        :disabled="!check.valid || !rosterReady"
        :loading="sending"
        @click="emit('send')"
      >
        {{ sending ? "Šaljem…" : plan.count ? `Pošalji ${couriersText(plan.count)}` : "Pošalji" }}
      </AppButton>
      <p aria-live="polite">{{ hint }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import SheetField from "~/components/common/SheetField.vue";
import SheetTextarea from "~/components/common/SheetTextarea.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import MessagePreview from "~/components/dispatcher/messages/MessagePreview.vue";
import { couriersText } from "~/utils/courierRoster";
import { CATEGORY_META, DISPATCHER_MESSAGE_CATEGORIES, getCategoryMeta } from "~/utils/inbox";
import type { SendPlan } from "~/utils/messageAudience";
import { isBlankDraft, type DraftCheck, type MessageDraft, type MessageTemplate } from "~/utils/messageDraft";
import type { FieldMsg } from "~/utils/profileForm";
import type { DispatcherMessageCategory } from "~/types/inbox";

// Pisanje poruke: kategorija, naslov, tekst, šabloni, pregled i dugme Pošalji uz dno. Enter u naslovu
// ide na tekst (ne šalje); Ctrl+Enter i dugme prolaze kroz iste provjere i potvrdu kod roditelja.
const props = defineProps<{
  draft: MessageDraft;
  restoredAt: string | null;
  canUndo: boolean;
  builtin: MessageTemplate[];
  mine: MessageTemplate[];
  plan: SendPlan;
  check: DraftCheck;
  // Spisak kurira je učitan (bez njega se ne zna ko su primaoci).
  rosterReady: boolean;
  sending: boolean;
  sendError: string;
  now: number;
}>();

const emit = defineEmits<{
  edit: [patch: Partial<MessageDraft>];
  applyTemplate: [id: string];
  deleteTemplate: [id: string];
  saveTemplate: [];
  undo: [];
  dropDraft: [];
  send: [];
}>();

const CATEGORIES: ChoiceOption[] = DISPATCHER_MESSAGE_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
  icon: CATEGORY_META[c.value].icon,
}));

const touched = reactive({ title: false, body: false });
const submitted = ref(false);

const blank = computed(() => isBlankDraft(props.draft) || !props.draft.title.trim() || !props.draft.body.trim());

const tone = (category: DispatcherMessageCategory) => {
  const m = getCategoryMeta(category);
  return { background: m.tint, color: m.ink };
};

const fieldMsg = (key: "title" | "body"): FieldMsg | null => {
  const bad = key === "title" ? !props.check.titleOk : !props.check.bodyOk;
  if (!bad || !(touched[key] || submitted.value)) return null;
  return { tone: "bad", text: key === "title" ? "Upiši naslov." : "Upiši tekst poruke." };
};

const hint = computed(() => {
  if (props.sending) return "";
  if (!props.rosterReady) return "Spisak kurira nije učitan.";
  if (props.check.valid) {
    return props.plan.confirm
      ? "Prije slanja tražimo još jednu potvrdu."
      : "Kurir vidi poruku kad otvori aplikaciju.";
  }
  return props.check.hint;
});

const field = (name: string) => document.querySelector<HTMLElement>(`.cmp [data-field="${name}"]`);

const focusBody = () => field("body")?.focus();

// Ctrl/Cmd+Enter u poljima poruke: pošalji (sa potvrdom kad treba).
const onKey = (event: KeyboardEvent) => {
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
  const target = event.target as HTMLElement | null;
  if (!target?.closest("[data-field=title],[data-field=body]")) return;
  event.preventDefault();
  emit("send");
};

// Pokušaj slanja sa nepotpunom porukom: greške se pokazuju, fokus ide na prvo neispravno polje.
const showErrors = () => {
  submitted.value = true;
  if (!props.check.titleOk) field("title")?.focus();
  else if (!props.check.bodyOk) field("body")?.focus();
};

const reset = () => {
  touched.title = false;
  touched.body = false;
  submitted.value = false;
};

defineExpose({ showErrors, reset, focusTitle: () => field("title")?.focus({ preventScroll: true }) });
</script>

<style scoped>
.cmp {
  display: grid;
  gap: 4px;
  padding: 14px 0 0;
}

.gt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.cmp-sec {
  padding: 0 0 4px;
}

.cmp-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 16px 6px;
  padding: 6px 6px 6px 12px;
  border-radius: 12px;
  background: #eef4ff;
  color: #17408f;
  font-size: 0.82rem;
  font-weight: 700;
}

.cmp-bar button {
  min-height: 44px;
  margin: -6px 0;
  padding: 0 8px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.cmp-bar button:focus-visible,
.cmp-tpl:focus-visible,
.cmp-td:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.cmp-tpl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: -10px -6px -10px 0;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
}

.cmp-tpl:hover {
  background: #eef4ff;
}

.cmp-menu {
  min-width: 300px;
  max-width: 340px;
}

.cmp-ti {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-right: 10px;
  border-radius: 12px;
}

.cmp-td {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.cmp-td:hover {
  background: #e9ecf1;
}

.cmp-form {
  display: grid;
  gap: 14px;
  padding: 0 16px;
}

.cmp-hint {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #5b6676;
}

.cmp-hint span:first-child {
  display: flex;
  gap: 6px;
}

.cmp-count {
  flex: none;
  font-weight: 700;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.cmp-pv {
  padding: 0 16px;
}

.cmp-foot {
  position: sticky;
  bottom: 0;
  z-index: 6;
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding: 10px 16px 14px;
  border-top: 1px solid #eceef2;
  border-radius: 0 0 20px 20px;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(6px);
}

.cmp-foot p {
  margin: 0;
  min-height: 1.1em;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #5b6676;
  text-align: center;
}

@media (max-width: 699px) {
  .cmp-form,
  .cmp-pv {
    padding: 0 12px;
  }

  .cmp-bar {
    margin: 0 12px 6px;
  }

  .gt {
    padding-left: 12px;
    padding-right: 12px;
  }

  .cmp-foot {
    margin: 14px 0 0;
    padding: 10px 12px 14px;
    border-radius: 0;
    box-shadow: 0 -8px 20px rgba(11, 18, 32, 0.06);
  }
}
</style>
