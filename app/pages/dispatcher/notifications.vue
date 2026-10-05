<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader title="Poruke" back-to="/" back-label="Nazad na početnu">
        <template #subtitle>
          <template v-if="roster.state.value === 'ready'">
            {{ couriersText(roster.roster.value.length) }} · {{ liveCount }} uživo
          </template>
        </template>
      </PageHeader>
    </template>

    <div class="mp" :class="{ 'mp--wide': wide }">
      <MessageRecipientList
        v-if="wide"
        ref="listEl"
        v-model:q="q"
        class="mp-list"
        :state="roster.state.value"
        :stale="roster.stale.value"
        :error-text="errorText"
        :total="roster.roster.value.length"
        :items="matched"
        :visible-count="shown"
        :picked="audienceIds"
        :picked-count="audience.length"
        :now="now"
        :currency="roster.currency.value"
        :updated-at="roster.updatedAt.value"
        :refreshing="roster.refreshing.value"
        :flash-ids="noFlash"
        show-kbd
        @toggle="togglePick"
        @history="openHistory"
        @select-shown="selectShown"
        @select-none="selectNone"
        @more="shown += PAGE_ROWS"
        @refresh="roster.refresh()"
        @retry="roster.refresh()"
      />

      <div class="mp-right">
        <div class="mp-tabs" role="tablist" aria-label="Poruke" @keydown="onTabKey">
          <button
            id="mp-tab-new"
            type="button"
            role="tab"
            class="mp-tab"
            data-tab="new"
            aria-controls="mp-pane"
            :aria-selected="tab === 'new'"
            :tabindex="tab === 'new' ? 0 : -1"
            @click="tab = 'new'"
          >
            <v-icon icon="mdi-square-edit-outline" size="20" />Nova poruka
          </button>
          <button
            id="mp-tab-sent"
            type="button"
            role="tab"
            class="mp-tab"
            data-tab="sent"
            aria-controls="mp-pane"
            :aria-selected="tab === 'sent'"
            :tabindex="tab === 'sent' ? 0 : -1"
            @click="tab = 'sent'"
          >
            <v-icon icon="mdi-send-outline" size="20" />Poslato<em v-if="sent.batches.value.length">{{
              sent.batches.value.length
            }}</em>
          </button>
        </div>

        <div class="mp-scroll" :class="{ 'is-card': tab === 'new' }">
          <div
            id="mp-pane"
            role="tabpanel"
            :aria-labelledby="tab === 'new' ? 'mp-tab-new' : 'mp-tab-sent'"
          >
            <MessageCompose
              v-show="tab === 'new'"
              ref="composeEl"
              :draft="drafts.draft"
              :restored-at="drafts.restoredAt.value"
              :can-undo="drafts.undoDraft.value != null"
              :builtin="templates.builtin"
              :mine="templates.mine.value"
              :plan="plan"
              :check="check"
              :roster-ready="roster.state.value === 'ready'"
              :sending="sent.sending.value"
              :send-error="sendError"
              :now="now"
              @edit="onEdit"
              @apply-template="onApplyTemplate"
              @delete-template="onDeleteTemplate"
              @save-template="saveTemplateOpen = true"
              @undo="drafts.undoTemplate()"
              @drop-draft="onDropDraft"
              @send="trySend"
            >
              <template #audience>
                <MessageAudience
                  :state="roster.state.value"
                  :selection="effective"
                  :counts="counts"
                  :sources="sources"
                  :audience="audience"
                  :phone="!wide"
                  @preset="setPreset"
                  @pick="pickOpen = true"
                  @retry="roster.refresh()"
                />
              </template>
            </MessageCompose>

            <SentMessagesPane
              v-if="tab === 'sent'"
              ref="sentPane"
              :batches="sent.batches.value"
              :checks="tracking.checks.value"
              :couriers="rosterById"
              :now="now"
              :flash-id="flashId"
              @new="tab = 'new'"
              @check="onCheck"
              @remind="onRemind"
              @retract="onRetract"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Telefon: ručni izbor kurira je donji list. -->
    <AppSheet
      v-if="!wide"
      :open="pickOpen"
      title="Izaberi kurire"
      @update:open="pickOpen = $event"
      @submit="pickOpen = false"
    >
      <MessageRecipientList
        v-model:q="q"
        class="mp-pick"
        :state="roster.state.value"
        :stale="roster.stale.value"
        :error-text="errorText"
        :total="roster.roster.value.length"
        :items="matched"
        :visible-count="shown"
        :picked="audienceIds"
        :picked-count="audience.length"
        :now="now"
        :currency="roster.currency.value"
        :updated-at="roster.updatedAt.value"
        :refreshing="roster.refreshing.value"
        :flash-ids="noFlash"
        @toggle="togglePick"
        @history="openHistory"
        @select-shown="selectShown"
        @select-none="selectNone"
        @more="shown += PAGE_ROWS"
        @refresh="roster.refresh()"
        @retry="roster.refresh()"
      />
      <template #footer>
        <AppButton submit data-autofocus>
          {{ audience.length ? `Gotovo · ${audience.length} izabrano` : "Gotovo" }}
        </AppButton>
      </template>
    </AppSheet>

    <MessageSendConfirm
      :open="confirmOpen"
      :plan="snap?.plan ?? plan"
      :audience="snap?.label ?? ''"
      :list="snap?.list ?? audience"
      :draft="drafts.draft"
      :sending="sent.sending.value"
      :now="now"
      @update:open="confirmOpen = $event"
      @confirm="confirmSend"
    />

    <SaveTemplateSheet
      :open="saveTemplateOpen"
      :suggestion="drafts.draft.title.trim()"
      :max="templates.MAX_LABEL"
      @update:open="saveTemplateOpen = $event"
      @save="onSaveTemplate"
    />

    <RetractSheet
      :open="tracking.retract.value != null"
      :batch="retractBatch"
      :state="tracking.retract.value"
      @update:open="onRetractOpen"
      @go="tracking.runRetract()"
    />

    <CourierMessagesSheet
      :open="historyId != null"
      :courier="historyCourier"
      :now="now"
      :send-label="historyCourier ? `Pošalji poruku ${historyCourier.first}` : undefined"
      @update:open="onHistoryOpen"
      @send="sendToHistoryCourier"
    />
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Poruke" });

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { storeToRefs } from "pinia";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import CourierMessagesSheet from "~/components/dispatcher/messages/CourierMessagesSheet.vue";
import MessageAudience from "~/components/dispatcher/messages/MessageAudience.vue";
import MessageCompose from "~/components/dispatcher/messages/MessageCompose.vue";
import MessageRecipientList from "~/components/dispatcher/messages/MessageRecipientList.vue";
import MessageSendConfirm from "~/components/dispatcher/messages/MessageSendConfirm.vue";
import RetractSheet from "~/components/dispatcher/messages/RetractSheet.vue";
import SaveTemplateSheet from "~/components/dispatcher/messages/SaveTemplateSheet.vue";
import SentMessagesPane from "~/components/dispatcher/messages/SentMessagesPane.vue";
import { useCourierRoster } from "~/composables/useCourierRoster";
import { useMessageDraft } from "~/composables/useMessageDraft";
import { useMessageTemplates } from "~/composables/useMessageTemplates";
import { useMessageTracking } from "~/composables/useMessageTracking";
import { PAGE_ROWS, WIDE_QUERY } from "~/composables/useRosterView";
import { useSentMessages } from "~/composables/useSentMessages";
import { interceptLeaving } from "~/composables/useSheetGuard";
import { useAlertStore } from "~/stores/alert";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import {
  couriersText,
  liveGroup,
  matchCourier,
  sortRoster,
  type RosterCourier,
} from "~/utils/courierRoster";
import {
  audienceLabel,
  audienceOf,
  normalizeSelection,
  presetCounts,
  sendPlan,
  type PresetKey,
  type Selection,
  type SendPlan,
  type SourcesOk,
} from "~/utils/messageAudience";
import { checkDraft, sentText, type MessageDraft } from "~/utils/messageDraft";
import { reminderDraft, unreadIds } from "~/utils/messageTracking";

// Poruke: radni prostor za slanje poruka kuririma. Lijevo spisak kurira sa stanjem uživo i kvačicom
// za svakog, desno poruka u tri koraka (Kome, Poruka, Pregled) sa gotovim grupama primalaca, šablonima
// i pregledom kako kurir vidi poruku; poslije slanja kartica u "Poslato" pokazuje ko je pročitao,
// podsjeća one koji nisu i može da povuče poruku. Stranica ne čita inbox-summary (broji i ponude).
// Vidi docs/2026/10/05_10_2026_Poruke_handoff.md.
const roster = useCourierRoster({ summary: false });
const alerts = useAlertStore();
const { errorMessage: companiesError } = storeToRefs(useDeliveryCompaniesStore());
const companyId = roster.companyId;
const now = roster.now;

const errorText = computed(() => roster.rowsError.value || companiesError.value);
const wide = ref(true);
let mq: MediaQueryList | null = null;
const syncWide = () => {
  wide.value = mq?.matches ?? true;
};

// --- Izvori i spisak ----------------------------------------------------------------------------

const sources = computed<SourcesOk>(() => ({
  locations: roster.locationsOk.value,
  balances: roster.balancesOk.value,
}));

const rosterById = computed<ReadonlyMap<number, RosterCourier>>(
  () => new Map(roster.roster.value.map((c) => [c.id, c]))
);
const counts = computed(() => presetCounts(roster.roster.value, now.value));
const liveCount = computed(
  () =>
    roster.roster.value.filter((c) => {
      const g = liveGroup(c, now.value);
      return g === "delivering" || g === "online";
    }).length
);

// Pretraga i iscrtavanje po dio (500 kurira ostaje lagano).
const q = ref("");
const shown = ref(PAGE_ROWS);
watch(q, () => {
  shown.value = PAGE_ROWS;
});
const matched = computed(() =>
  sortRoster(
    roster.roster.value.filter((c) => matchCourier(c, q.value)),
    "live",
    now.value
  )
);
const noFlash: ReadonlySet<number> = new Set();

// --- Nacrt, izbor, šabloni ----------------------------------------------------------------------

const drafts = useMessageDraft(companyId);
const templates = useMessageTemplates();

// Izabrana grupa čiji izvor ne radi pada na "Svi aktivni" (ne ostaje tiho prazna).
const effective = computed<Selection>(() => normalizeSelection(drafts.selection.value, sources.value));

const audience = computed<RosterCourier[]>(() =>
  roster.state.value === "ready" ? audienceOf(roster.roster.value, effective.value, now.value) : []
);
const audienceIds = computed<ReadonlySet<number>>(() => new Set(audience.value.map((c) => c.id)));
const plan = computed<SendPlan>(() => sendPlan(roster.roster.value, audience.value));
const check = computed(() => checkDraft(drafts.draft, plan.value.count));

// Izvor koji je zaista pao (ne samo još nije stigao) trajno gasi izabranu grupu.
watch([roster.locationsFailed, roster.balancesFailed], () => {
  if (
    drafts.selection.value.kind === "preset" &&
    effective.value !== drafts.selection.value &&
    (roster.locationsFailed.value || roster.balancesFailed.value)
  ) {
    drafts.setSelection(effective.value);
  }
});

const setPreset = (key: PresetKey) => drafts.setSelection({ kind: "preset", key });

const togglePick = (id: number) => {
  const cur = new Set(audienceIds.value);
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  drafts.setSelection({ kind: "manual", ids: cur });
};
const selectShown = () => {
  const cur = new Set(audienceIds.value);
  for (const c of matched.value) cur.add(c.id);
  drafts.setSelection({ kind: "manual", ids: cur });
};
const selectNone = () => drafts.setSelection({ kind: "manual", ids: new Set() });

// Vraćanje nacrta: kad je spisak prvi put učitan za firmu.
const restoredFor = new Set<number>();
watch(
  [() => roster.state.value, companyId],
  ([state, id]) => {
    if (state !== "ready" || id == null || restoredFor.has(id)) return;
    restoredFor.add(id);
    drafts.restore();
  },
  { immediate: true }
);

const composeEl = ref<InstanceType<typeof MessageCompose> | null>(null);
const sendError = ref("");

const onEdit = (patch: Partial<MessageDraft>) => {
  sendError.value = "";
  drafts.edit(patch);
};

const onApplyTemplate = async (id: string) => {
  const t = templates.find(id);
  if (!t) return;
  drafts.applyTemplate(t);
  sendError.value = "";
  composeEl.value?.reset();
  await nextTick();
  composeEl.value?.focusTitle();
};

const onDeleteTemplate = (id: string) => {
  templates.remove(id);
  alerts.info("Šablon je obrisan.");
};

const saveTemplateOpen = ref(false);
const onSaveTemplate = (label: string) => {
  templates.save(label, drafts.draft);
  saveTemplateOpen.value = false;
  alerts.success("Šablon je sačuvan.");
};

const onDropDraft = () => {
  drafts.drop();
  sendError.value = "";
  composeEl.value?.reset();
};

// --- Slanje -------------------------------------------------------------------------------------

const sent = useSentMessages(companyId);
const tracking = useMessageTracking({
  batches: sent.batches,
  find: sent.find,
  update: sent.update,
});

const tab = ref<"new" | "sent">("new");
const sentPane = ref<InstanceType<typeof SentMessagesPane> | null>(null);
const flashId = ref<string | null>(null);
const confirmOpen = ref(false);
// Primaoci u času otvaranja potvrde: broj u potvrdi je broj koji stvarno dobija poruku.
const snap = ref<{ plan: SendPlan; list: RosterCourier[]; label: string } | null>(null);

const trySend = async () => {
  if (sent.sending.value) return;
  if (!check.value.valid || roster.state.value !== "ready") {
    composeEl.value?.showErrors();
    return;
  }
  const list = audience.value.slice();
  const p = plan.value;
  snap.value = { plan: p, list, label: audienceLabel(p, effective.value, list) };
  if (p.confirm) {
    confirmOpen.value = true;
    return;
  }
  await doSend();
};

const confirmSend = () => void doSend();

const doSend = async () => {
  const s = snap.value;
  if (!s) return;
  sendError.value = "";
  const res = await sent.send(s.plan, { ...drafts.draft }, s.label);
  confirmOpen.value = false;
  if (!res.ok) {
    if (res.message) sendError.value = res.message;
    return;
  }
  const text = sentText(res.sent, res.intended);
  if (text.tone === "ok") alerts.success(text.text);
  else alerts.warning(text.text);
  drafts.drop();
  composeEl.value?.reset();
  tab.value = "sent";
  flashId.value = res.batch.id;
  setTimeout(() => {
    if (flashId.value === res.batch.id) flashId.value = null;
  }, 1800);
  tracking.scheduleAuto(res.batch);
  await nextTick();
  sentPane.value?.focusCard(res.batch.id);
};

// --- Poslato ------------------------------------------------------------------------------------

const onCheck = (id: string) => void tracking.check(id);

const onRemind = async (id: string) => {
  const batch = sent.find(id);
  if (!batch) return;
  const ids = unreadIds(batch);
  if (!ids.length) return;
  drafts.startFrom(reminderDraft(batch), { kind: "manual", ids: new Set(ids) });
  composeEl.value?.reset();
  tab.value = "new";
  alerts.info(`Podsjetnik je spreman za ${couriersText(ids.length)}. Pregledaj i pošalji.`);
  await nextTick();
  composeEl.value?.focusTitle();
};

const onRetract = (id: string) => {
  const batch = sent.find(id);
  if (batch) tracking.openRetract(batch);
};
const retractBatch = computed(() => {
  const state = tracking.retract.value;
  return state ? (sent.batches.value.find((b) => b.id === state.batchId) ?? null) : null;
});
const onRetractOpen = (open: boolean) => {
  if (!open) tracking.closeRetract();
};

// --- Poruke kurira ------------------------------------------------------------------------------

const historyId = ref<number | null>(null);
const historyCourier = computed(() =>
  historyId.value == null ? null : (rosterById.value.get(historyId.value) ?? null)
);
const openHistory = (id: number) => {
  historyId.value = id;
};
const onHistoryOpen = (open: boolean) => {
  if (!open) historyId.value = null;
};

// --- Telefon: ručni izbor je list ---------------------------------------------------------------

const pickOpen = ref(false);

// "Pošalji poruku <ime>": vraća na obrazac sa tim kurirom kao jedinim primaocem.
const sendToHistoryCourier = async () => {
  const id = historyId.value;
  historyId.value = null;
  pickOpen.value = false;
  if (id == null) return;
  drafts.setSelection({ kind: "manual", ids: new Set([id]) });
  tab.value = "new";
  await nextTick();
  composeEl.value?.focusTitle();
};

// --- Tastatura ----------------------------------------------------------------------------------

const listEl = ref<InstanceType<typeof MessageRecipientList> | null>(null);

const typingIn = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.matches("input, textarea, select") || el.isContentEditable);

// Strelice mijenjaju karticu (Nova poruka / Poslato).
const onTabKey = async (event: KeyboardEvent) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const order = ["new", "sent"] as const;
  const at = order.indexOf(tab.value);
  const next =
    event.key === "Home" ? 0 : event.key === "End" ? 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + 2) % 2;
  tab.value = order[next] as "new" | "sent";
  await nextTick();
  document.querySelector<HTMLElement>(`[data-tab="${tab.value}"]`)?.focus();
};

const onKey = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector(".v-overlay--active")) return;
  if (event.key === "/" && !typingIn(event.target) && wide.value) {
    event.preventDefault();
    listEl.value?.focusSearch();
  }
};

onMounted(() => {
  mq = window.matchMedia(WIDE_QUERY);
  syncWide();
  mq.addEventListener("change", syncWide);
  window.addEventListener("keydown", onKey);
  sent.load();
});

onBeforeUnmount(() => {
  mq?.removeEventListener("change", syncWide);
  window.removeEventListener("keydown", onKey);
});

// Dugme Nazad dok je list otvoren zatvara list. Nacrt se čuva sam (useMessageDraft), pa upozorenja
// pri izlasku nema: ništa se ne gubi.
onBeforeRouteLeave(() => {
  if (interceptLeaving()) return false;
});
</script>

<style scoped>
.mp {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.mp > * {
  min-width: 0;
}

.mp--wide {
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.mp-right {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.mp--wide .mp-right {
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 100px);
  max-height: calc(100dvh - 100px);
}

.mp-tabs {
  display: grid;
  flex: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border-radius: 16px;
  background: #e9ecf1;
}

.mp-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #5b6676;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.mp-tab[aria-selected="true"] {
  background: #fff;
  color: #0b1220;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.14);
}

.mp-tab:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 1px;
}

.mp-tab em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: #dfe3ea;
  color: #3d4756;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.mp-tab[aria-selected="true"] em {
  background: #2459c7;
  color: #fff;
}

.mp-scroll {
  min-height: 0;
  border-radius: 20px;
}

.mp-scroll.is-card {
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

/* Na računaru se skroluje samo desna strana, a dugme Pošalji ostaje uz njeno dno. */
.mp--wide .mp-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.mp-pick {
  border-radius: 0;
  box-shadow: none;
}
</style>
