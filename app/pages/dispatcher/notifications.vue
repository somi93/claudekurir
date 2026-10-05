<template>
  <GlobalPage :max-width="1000">
    <template #header>
      <PageHeader title="Obaveštenja" back-to="/" back-label="Nazad na početnu" />
    </template>

    <PageAlert v-if="errorMessage" closable class="mb-4" @close="clearError">
      {{ errorMessage }}
    </PageAlert>

    <GlobalCard padding="20px">
      <template #title>Grupno slanje poruke</template>
      <template #subtitle>
        Pošalji obaveštenje izabranim kuririma ili svim kuririma firme odjednom.
      </template>

      <v-form ref="formRef" class="composer mt-2" @submit.prevent="submit">
        <GlobalSelect
          v-model="form.category"
          label="Kategorija"
          :items="DISPATCHER_MESSAGE_CATEGORIES"
          item-title="label"
          item-value="value"
          hide-details="auto"
        />
        <GlobalTextField
          v-model="form.title"
          label="Naslov"
          enterkeyhint="next"
          :rules="[rules.required()]"
          hide-details="auto"
          @keydown.enter.exact.prevent="focusBody"
          @keydown.ctrl.enter.prevent="submit"
          @keydown.meta.enter.prevent="submit"
        />
        <GlobalTextarea
          v-model="form.body"
          label="Poruka"
          rows="4"
          auto-grow
          :rules="[rules.required()]"
          hide-details="auto"
          @keydown.ctrl.enter.prevent="submit"
          @keydown.meta.enter.prevent="submit"
        />
        <GlobalAutocomplete
          v-model="selectedIds"
          :items="courierOptions"
          item-title="label"
          item-value="value"
          multiple
          chips
          closable-chips
          select-all
          select-all-text="Izaberi sve kurire firme"
          label="Primaoci"
          placeholder="Pretraži kurira po imenu ili ID-u..."
          no-data-text="Nema kurira za zadatu pretragu."
          :custom-filter="matchOption"
          :error="showRecipientError"
          :error-messages="recipientErrorText"
          hide-details="auto"
        />

        <div class="composer-foot">
          <span class="composer-count">{{ couriersReady ? recipientSummary : "Spisak kurira nije učitan." }}</span>
          <GlobalButtonPrimary
            type="submit"
            prepend-icon="mdi-send-outline"
            :loading="broadcasting"
            :disabled="!couriersReady || couriers.length === 0"
          >
            Pošalji
          </GlobalButtonPrimary>
        </div>
      </v-form>
    </GlobalCard>

    <GlobalCard padding="20px" class="mt-4">
      <template #title>Istorija poslatih poruka</template>
      <template #subtitle>
        Izaberi kurira da vidiš i pretražiš šta mu je ranije poslato.
      </template>

      <GlobalTextField
        v-model="historySearch"
        density="compact"
        variant="solo"
        flat
        hide-details
        clearable
        placeholder="Pretraži kurira po imenu ili ID-u..."
        prepend-inner-icon="mdi-magnify"
        class="mt-2"
      />

      <p v-if="loadingCouriers && !couriersLoaded" class="history-empty mt-3" role="status">
        Učitavam kurire…
      </p>
      <div v-else-if="!couriersLoaded" class="history-empty mt-3" role="alert">
        Ne mogu da učitam listu kurira.
        <v-btn variant="text" size="small" @click="reloadCouriers()">Pokušaj ponovo</v-btn>
      </div>
      <div v-else-if="filteredHistoryCouriers.length > 0" class="history-courier-list mt-2">
        <button
          v-for="courier in filteredHistoryCouriers"
          :key="courier.courier_id"
          type="button"
          class="history-courier-row"
          @click="openHistory(courier)"
        >
          <div class="history-courier-text">
            <div class="history-courier-main">
              <span class="history-courier-id">#{{ courier.courier_id }}</span>
              <span class="history-courier-name">{{ toLatin(courier.name) }}</span>
              <span v-if="courier.suspended" class="history-courier-tag">suspendovan</span>
            </div>
            <span
              v-if="summaryFor(courier.courier_id)?.lastMessage"
              class="history-courier-preview"
            >
              {{ toLatin(summaryFor(courier.courier_id)!.lastMessage!.title) }} ·
              {{ formatRelativeTime(summaryFor(courier.courier_id)!.lastMessage!.sentAt) }}
            </span>
          </div>
          <v-chip
            v-if="summaryFor(courier.courier_id)?.dispatcherUnreadCount"
            size="x-small"
            variant="tonal"
            color="accent"
            class="history-courier-unread"
          >
            {{ summaryFor(courier.courier_id)!.dispatcherUnreadCount }} nepročitano
          </v-chip>
          <v-icon icon="mdi-chevron-right" size="18" class="history-courier-open" />
        </button>
      </div>
      <p v-else class="history-empty mt-3">
        {{
          couriers.length === 0
            ? "Nema kurira na listi ove firme."
            : "Nema kurira za zadatu pretragu."
        }}
      </p>
    </GlobalCard>

    <FormDialog
      :open="showHistory"
      hide-actions
      max-width="560"
      :title="
        historyCourier
          ? `Poruke - ${toLatin(historyCourier.name)} · #${historyCourier.courier_id}`
          : 'Poruke kurira'
      "
      @update:open="showHistory = $event"
    >
      <CourierMessageHistory
        :courier-id="showHistory ? historyCourier?.courier_id ?? null : null"
      />
    </FormDialog>
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Obaveštenja" });

import { computed, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import type { VForm } from "vuetify/components";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { useCompanyCouriers } from "~/composables/useCompanyCouriers";
import { useCourierMessaging } from "~/composables/useCourierMessaging";
import { useValidationRules } from "~/composables/useValidationRules";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import PageAlert from "~/components/common/PageAlert.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalAutocomplete from "~/components/common/GlobalAutocomplete.vue";
import FormDialog from "~/components/common/FormDialog.vue";
import CourierMessageHistory from "~/components/company/couriers/CourierMessageHistory.vue";
import {
  DEFAULT_MESSAGE_CATEGORY,
  DISPATCHER_MESSAGE_CATEGORIES,
  formatRelativeTime,
} from "~/utils/inbox";
import { fetchInboxSummary } from "~/services/courierInboxService";
import { buildRoster, matchCourier } from "~/utils/courierRoster";
import type { BroadcastMessagePayload, InboxSummaryEntry } from "~/types/inbox";
import type { CompanyCourier } from "~/types/company-courier";

const rules = useValidationRules();

const companiesStore = useDeliveryCompaniesStore();
const { selectedCompanyId, errorMessage: companiesError } = storeToRefs(companiesStore);
companiesStore.ensureLoaded();

const companyId = computed(() => selectedCompanyId.value);

const {
  couriers,
  loadingCouriers,
  couriersLoaded,
  reloadCouriers,
  errorMessage: couriersError,
} = useCompanyCouriers(companyId);
// Dok se zna samo da se spisak učitava (ili je pao), ne tvrdi se ništa o kuririma.
const couriersReady = computed(() => couriersLoaded.value);
const { broadcasting, broadcast } = useCourierMessaging();

// Isti oblik reda i ista pretraga kao na Kuriri (matchCourier): bez dijakritika, ćirilica,
// telefon u svakom zapisu, #ID, bilo koji redoslijed riječi.
const rosterById = computed(
  () => new Map(buildRoster(couriers.value).map((courier) => [courier.id, courier]))
);
const matchOption = (_value: unknown, query: string, item?: { raw?: { value?: number } }) => {
  const courier = rosterById.value.get(item?.raw?.value ?? -1);
  return courier ? matchCourier(courier, query) : false;
};

const courierOptions = computed(() =>
  couriers.value.map((courier) => ({
    value: courier.courier_id,
    label: `${toLatin(courier.name)} · #${courier.courier_id}${
      courier.suspended ? " (suspendovan)" : ""
    }`,
  }))
);

// --- Grupno slanje ---
const formRef = ref<InstanceType<typeof VForm> | null>(null);
const form = reactive({
  category: DEFAULT_MESSAGE_CATEGORY,
  title: "",
  body: "",
});
const selectedIds = ref<number[]>([]);
const showRecipientError = ref(false);

const allSelected = computed(
  () => couriers.value.length > 0 && selectedIds.value.length >= couriers.value.length
);

const recipientSummary = computed(() =>
  allSelected.value
    ? `svi (${couriers.value.length})`
    : `izabrano: ${selectedIds.value.length}`
);

const recipientErrorText = computed(() =>
  showRecipientError.value
    ? 'Izaberi bar jednog kurira ili "Izaberi sve kurire firme".'
    : undefined
);

watch(selectedIds, () => {
  if (selectedIds.value.length > 0) showRecipientError.value = false;
});

// Enter u naslovu ide na tekst poruke; šalje samo dugme ili Ctrl+Enter.
const focusBody = () => {
  const el = (formRef.value as unknown as { $el?: HTMLElement } | null)?.$el;
  el?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
};

const submit = async () => {
  if (!companyId.value || !couriersReady.value) return;

  const { valid } = (await formRef.value?.validate()) ?? { valid: false };
  if (selectedIds.value.length === 0) showRecipientError.value = true;
  if (!valid || selectedIds.value.length === 0) return;

  const base = {
    category: form.category,
    title: form.title.trim(),
    body: form.body.trim(),
  };
  const payload: BroadcastMessagePayload = allSelected.value
    ? { ...base, all_couriers: true }
    : { ...base, all_couriers: false, courier_ids: [...selectedIds.value] };

  const ok = await broadcast(companyId.value, payload);
  if (!ok) return;

  form.category = DEFAULT_MESSAGE_CATEGORY;
  form.title = "";
  form.body = "";
  selectedIds.value = [];
  showRecipientError.value = false;
  formRef.value?.resetValidation();
  loadSummary();
};

// --- Pregled poslednje poruke po kuriru (inbox-summary, odgovor 15.09) ---
// Jedan poziv za cijelu firmu umesto GET .../inbox po kuriru (N poziva) - vidi
// fetchInboxSummary. Mapa po courier_id da je O(1) lookup u redu liste.
const summaryByCourier = ref(new Map<number, InboxSummaryEntry>());
const loadingSummary = ref(false);

const loadSummary = async () => {
  if (!companyId.value) return;
  loadingSummary.value = true;
  try {
    const entries = await fetchInboxSummary(companyId.value);
    summaryByCourier.value = new Map(entries.map((entry) => [entry.courierId, entry]));
  } catch {
    // Tiho - ovo je samo pretpregled uz listu, ne blokira "Istoriju po kuriru"
    // (koja i dalje radi preko GET .../inbox po kliku) ako summary ruta padne.
    summaryByCourier.value = new Map();
  } finally {
    loadingSummary.value = false;
  }
};
const summaryFor = (courierId: number) => summaryByCourier.value.get(courierId) ?? null;

watch(companyId, () => loadSummary(), { immediate: true });

// --- Istorija po kuriru ---
// Lista kurira (kao na strani Kuriri) - klik otvara njegovu istoriju poslatog
// u dijalogu (samo pregled, bez slanja - za slanje je "Grupno slanje" gore).
const historySearch = ref("");

const filteredHistoryCouriers = computed(() => {
  const query = historySearch.value.trim();
  if (!query) return couriers.value;
  return couriers.value.filter((courier) => {
    const row = rosterById.value.get(courier.courier_id);
    return row ? matchCourier(row, query) : false;
  });
});

const showHistory = ref(false);
const historyCourier = ref<CompanyCourier | null>(null);
const openHistory = (courier: CompanyCourier) => {
  historyCourier.value = courier;
  showHistory.value = true;
};
// Zatvaranje dijaloga - osveži pretpregled (brisanje poruke u dijalogu mijenja
// zadnju poruku/broj nepročitanih za tog kurira na listi iza).
watch(showHistory, (open) => {
  if (!open) loadSummary();
});

const errorMessage = computed(() => companiesError.value || couriersError.value);
const clearError = () => {
  companiesError.value = "";
  couriersError.value = "";
};
</script>

<style scoped>
.composer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.composer-count {
  font-size: 0.82rem;
  color: #6b7685;
}

.history-courier-list {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow-y: auto;
}

.history-courier-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 6px;
  border: none;
  border-bottom: 1px solid #e7e9ee;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.history-courier-row:last-child {
  border-bottom: none;
}

.history-courier-row:hover {
  background: #f5f6f8;
}

.history-courier-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.history-courier-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-courier-id {
  font-size: 0.78rem;
  font-weight: 600;
  color: #9aa4b2;
}

.history-courier-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.history-courier-tag {
  font-size: 0.72rem;
  font-weight: 600;
  color: #d64545;
}

.history-courier-preview {
  font-size: 0.78rem;
  color: #6b7685;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-courier-unread {
  flex-shrink: 0;
}

.history-courier-open {
  margin-left: 4px;
  flex-shrink: 0;
  color: #9aa4b2;
}

.history-empty {
  font-size: 0.82rem;
  color: #9aa4b2;
}
</style>
