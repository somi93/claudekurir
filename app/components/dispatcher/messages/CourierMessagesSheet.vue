<template>
  <AppSheet
    :open="open"
    :title="courier ? `Poruke · ${courier.name}` : 'Poruke kurira'"
    :subtitle="courier ? `#${courier.id}${courier.phone ? ` · ${fmtPhone(courier.phone)}` : ''}` : ''"
    @update:open="emit('update:open', $event)"
  >
    <div class="cm-filt" role="group" aria-label="Kategorija">
      <button
        v-for="f in FILTERS"
        :key="f.key ?? 'all'"
        type="button"
        class="pill"
        :aria-pressed="category === f.key"
        :data-filter="f.key ?? 'all'"
        @click="setCategory(f.key)"
      >
        {{ f.label }}
      </button>
    </div>

    <TintAlert v-if="error && items.length === 0 && !loading" tone="warn" icon="mdi-cloud-off-outline" title="Ne mogu da učitam poruke">
      {{ error }}
      <template #action>
        <button type="button" data-messages="retry-history" @click="reload">Pokušaj ponovo</button>
      </template>
    </TintAlert>

    <div v-else-if="loading && !loaded" class="cm-sk" role="status" aria-label="Učitavam poruke">
      <i v-for="n in 3" :key="n" class="b" />
    </div>

    <div v-else-if="items.length === 0" class="cm-empty">
      <v-icon icon="mdi-message-text-outline" size="34" />
      <b>{{ category ? "Nema poruka u ovoj kategoriji" : "Ovom kuriru još ništa nije poslato" }}</b>
      <p>Poruke koje pošalješ pojavljuju se ovdje.</p>
    </div>

    <div v-else>
      <div
        v-for="m in items"
        :key="m.id"
        class="cm-m"
        :style="{ '--tint': meta(m).tint, '--ink': meta(m).color }"
        :data-message="m.id"
      >
        <span class="ic1"><v-icon :icon="meta(m).icon" size="20" /></span>
        <span class="tx">
          <b>{{ toLatin(m.title) }}</b>
          <small>{{ meta(m).label }} · {{ dayClock(Date.parse(m.sentAt), now) }}</small>
          <p>{{ toLatin(m.body) }}</p>
        </span>
        <span class="rt">
          <span class="rdp" :class="m.read ? 'rd' : 'un'">
            <v-icon :icon="m.read ? 'mdi-check-all' : 'mdi-clock-outline'" size="16" />
            {{ m.read ? "Pročitano" : "Nije pročitano" }}
          </span>
          <button
            type="button"
            class="del"
            :aria-label="`Ukloni poruku ${toLatin(m.title)}`"
            :data-remove="m.id"
            @click="ask(m.id)"
          >
            <v-icon icon="mdi-trash-can-outline" size="22" />
          </button>
        </span>
        <div v-if="removing === m.id" class="cm-ask" role="alertdialog" aria-label="Potvrda uklanjanja">
          <span>Ukloniti ovu poruku iz sandučeta kurira? Ako ju je pročitao, pročitana je.</span>
          <span class="row">
            <button type="button" class="btn btn--danger" data-remove-ok :disabled="busy" @click="confirmRemove(m.id)">
              Ukloni poruku
            </button>
            <button type="button" class="btn" data-remove-no :disabled="busy" @click="removing = null">Odustani</button>
          </span>
        </div>
      </div>

      <p v-if="error" class="cm-err" role="alert">{{ error }}</p>
      <div v-if="!end" class="cm-more">
        <button type="button" class="btn" data-messages="older" :disabled="loadingMore" @click="more()">
          {{ loadingMore ? "Učitavam…" : "Prikaži starije" }}
        </button>
      </div>
    </div>

    <p class="cm-note">
      <v-icon icon="mdi-information-outline" size="16" />
      <span>Ponude za dostavu se ovdje ne prikazuju: to je trag ponude, a ne poruka dispečera.</span>
    </p>

    <template v-if="sendLabel" #footer>
      <AppButton icon="mdi-message-text-outline" data-messages="send-to-courier" @click="emit('send')">
        {{ sendLabel }}
      </AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useCourierMessages } from "~/composables/useCourierMessages";
import { useAlertStore } from "~/stores/alert";
import { fmtPhone, type RosterCourier } from "~/utils/courierRoster";
import { CATEGORY_META, getCategoryMeta } from "~/utils/inbox";
import { HISTORY_CATEGORIES } from "~/utils/messageHistory";
import { dayClock } from "~/utils/messageTime";
import { toLatin } from "~/utils/toLatin";
import type { DispatcherMessageCategory, InboxMessage } from "~/types/inbox";

// "Poruke kurira": poruke jednog kurira (najnovija prva), BEZ ponuda; filter po kategoriji, "Prikaži
// starije", pročitano / nije pročitano po poruci i uklanjanje uz pitanje u redu. Koristi ga ekran
// Poruke (ikona istorije u listi) i detalj kurira na Kuriri ("Sve poruke").
const props = defineProps<{
  open: boolean;
  courier: RosterCourier | null;
  now: number;
  // Tekst dugmeta "Pošalji poruku <ime>"; bez njega dugmeta nema.
  sendLabel?: string;
}>();

const emit = defineEmits<{ "update:open": [boolean]; send: [] }>();

const alerts = useAlertStore();
const { items, loading, loadingMore, loaded, error, end, open: openMessages, more, remove, reset } =
  useCourierMessages();

const FILTERS: { key: DispatcherMessageCategory | null; label: string }[] = [
  { key: null, label: "Sve" },
  ...HISTORY_CATEGORIES.map((key) => ({ key, label: CATEGORY_META[key].chip })),
];

const category = ref<DispatcherMessageCategory | null>(null);
const removing = ref<number | null>(null);
const busy = ref(false);

const meta = (m: InboxMessage) => getCategoryMeta(m.category);

const reload = () => {
  if (props.courier) void openMessages(props.courier.id, category.value);
};

const setCategory = (key: DispatcherMessageCategory | null) => {
  category.value = key;
  removing.value = null;
  reload();
};

// Otvaranje (ili drugi kurir): kreće iznova, bez filtera.
watch(
  [() => props.open, () => props.courier?.id],
  ([isOpen]) => {
    removing.value = null;
    if (!isOpen || !props.courier) {
      reset();
      return;
    }
    category.value = null;
    void openMessages(props.courier.id, null);
  },
  { immediate: true }
);

const ask = (id: number) => {
  removing.value = id;
};

const confirmRemove = async (id: number) => {
  busy.value = true;
  const ok = await remove(id);
  busy.value = false;
  removing.value = null;
  if (ok) alerts.success("Poruka je uklonjena iz sandučeta kurira.");
  else alerts.error("Ne mogu da uklonim poruku. Pokušaj ponovo.");
};
</script>

<style scoped>
.cm-filt {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.pill[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.pill:focus-visible,
.btn:focus-visible,
.del:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.cm-sk {
  display: grid;
  gap: 8px;
}

.cm-sk .b {
  display: block;
  height: 64px;
  border-radius: 12px;
  background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 50%, #eef0f4 100%);
  background-size: 200% 100%;
  animation: cm-sh 1.3s linear infinite;
}

@keyframes cm-sh {
  to {
    background-position: -200% 0;
  }
}

.cm-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 24px 8px;
  text-align: center;
}

.cm-empty .v-icon {
  color: #c7ccd6;
}

.cm-empty p {
  margin: 0;
  font-size: 0.84rem;
  color: #5b6676;
}

.cm-m {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 12px 4px;
  border-top: 1px solid #eceef2;
}

.cm-m:first-child {
  border-top: 0;
}

.ic1 {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--tint);
  color: var(--ink);
}

.tx {
  min-width: 0;
}

.tx b {
  display: block;
  font-size: 0.92rem;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.tx small {
  display: block;
  margin-top: 2px;
  font-size: 0.76rem;
  color: #5b6676;
}

.tx p {
  margin: 4px 0 0;
  font-size: 0.84rem;
  line-height: 1.4;
  color: #5b6676;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.rt {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.rdp {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.rdp.rd {
  color: #2459c7;
}

.rdp.un {
  color: #9a4a07;
}

.del {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.del:hover {
  background: #f1f3f6;
}

.cm-ask {
  display: grid;
  grid-column: 1 / -1;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fde8e6;
  color: #7a1810;
  font-size: 0.84rem;
}

.cm-ask .row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.btn--danger {
  border-color: #b42318;
  background: #b42318;
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cm-more {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.cm-err {
  margin: 8px 0 0;
  font-size: 0.82rem;
  color: #b42318;
}

.cm-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #5b6676;
}

@media (prefers-reduced-motion: reduce) {
  .cm-sk .b {
    animation: none;
  }
}
</style>
