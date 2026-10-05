<template>
  <div class="msg-history">
    <div class="msg-history-toolbar">
      <span class="msg-history-label">Ranije poslato</span>
      <GlobalSelect
        v-model="categoryFilter"
        :items="categoryFilterOptions"
        item-title="label"
        item-value="value"
        density="compact"
        hide-details
        class="msg-history-filter"
      />
    </div>

    <p v-if="!courierId" class="msg-history-state">Izaberi kurira za pregled poslatih poruka.</p>
    <div v-else-if="loading" class="msg-history-state">
      <v-progress-circular indeterminate size="20" color="primary" />
    </div>
    <p v-else-if="error && items.length === 0" class="msg-history-state">
      {{ error }}
      <v-btn variant="text" size="small" @click="courierId && open(courierId, categoryFilter)">
        Pokušaj ponovo
      </v-btn>
    </p>
    <p v-else-if="items.length === 0" class="msg-history-state">
      {{
        categoryFilter
          ? "Nema poslatih poruka u ovoj kategoriji."
          : "Nema ranije poslatih poruka ovom kuriru."
      }}
    </p>
    <div v-else class="msg-history-list">
      <div v-for="msg in items" :key="msg.id" class="msg-history-item">
        <div class="msg-history-head">
          <span class="msg-history-title">{{ msg.title }}</span>
          <v-btn
            icon="mdi-trash-can-outline"
            variant="text"
            size="x-small"
            aria-label="Obriši poruku"
            :loading="deletingId === msg.id"
            @click="onDelete(msg)"
          />
        </div>
        <div class="msg-history-meta">
          <v-chip size="x-small" variant="tonal" :color="CATEGORY_META[msg.category].color">
            {{ CATEGORY_META[msg.category].label }}
          </v-chip>
          <span>
            {{ formatDateTime(msg.sentAt) }} ·
            {{ msg.read ? "pročitano" : "nepročitano" }}
          </span>
        </div>
        <p class="msg-history-body">{{ msg.body }}</p>
      </div>

      <p v-if="error" class="msg-history-state">{{ error }}</p>
      <v-btn
        v-if="!end"
        variant="tonal"
        size="small"
        block
        :loading="loadingMore"
        @click="more()"
      >
        Prikaži starije
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useCourierMessages } from "~/composables/useCourierMessages";
import { useAlertStore } from "~/stores/alert";
import { useConfirmStore } from "~/stores/confirm";
import { formatDateTime } from "~/utils/datetime";
import { CATEGORY_META, DISPATCHER_MESSAGE_CATEGORIES } from "~/utils/inbox";
import type { DispatcherMessageCategory, InboxMessage } from "~/types/inbox";

const props = defineProps<{ courierId: number | null }>();

const confirmStore = useConfirmStore();
const alertStore = useAlertStore();

const { items, loading, loadingMore, error, end, open, more, remove } = useCourierMessages();

// null = "Sve kategorije" (tri zahtjeva, po jedan za svaku kategoriju koju dispečer šalje).
const categoryFilter = ref<DispatcherMessageCategory | null>(null);
const categoryFilterOptions: { label: string; value: DispatcherMessageCategory | null }[] = [
  { label: "Sve kategorije", value: null },
  ...DISPATCHER_MESSAGE_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
];

const deletingId = ref<number | null>(null);

watch(
  () => props.courierId,
  (id) => {
    categoryFilter.value = null;
    if (id) open(id, null);
  },
  { immediate: true }
);

watch(categoryFilter, (value) => {
  if (props.courierId) open(props.courierId, value);
});

const onDelete = async (msg: InboxMessage) => {
  try {
    await confirmStore.confirm(
      "Obriši poruku",
      `Ukloniti poruku "${msg.title}" iz inbox-a kurira?`,
      { color: "error" }
    );
  } catch {
    return; // Otkazano
  }
  deletingId.value = msg.id;
  const ok = await remove(msg.id);
  deletingId.value = null;
  if (!ok) alertStore.error("Ne mogu da obrišem poruku.");
};
</script>

<style scoped>
.msg-history {
  border-top: 1px solid #e7e9ee;
  padding-top: 12px;
}

.msg-history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.msg-history-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #9aa4b2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.msg-history-filter {
  flex: 0 0 180px;
}

.msg-history-state {
  margin: 8px 0 0;
  font-size: 0.82rem;
  color: #9aa4b2;
}

.msg-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.msg-history-item {
  border: 1px solid #e7e9ee;
  border-radius: 10px;
  padding: 8px 10px;
}

.msg-history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.msg-history-title {
  font-weight: 600;
  font-size: 0.86rem;
}

.msg-history-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 0.74rem;
  color: #9aa4b2;
}

.msg-history-body {
  margin: 4px 0 0;
  font-size: 0.82rem;
  color: #6b7685;
  white-space: pre-wrap;
}
</style>
