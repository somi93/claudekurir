<template>
  <DeliveryPage :max-width="860">
    <template #header>
      <PageHeader title="Kvestovi" back-to="/" back-label="Nazad na početnu">
        <template #actions>
          <v-btn
            icon="mdi-plus"
            variant="flat"
            color="primary"
            size="small"
            aria-label="Dodaj kvest"
            @click="openAddDialog"
          />
        </template>
      </PageHeader>
    </template>

    <GlobalTabBar v-model="activeTab" :tabs="questTabs" class="mb-4" />

      <div v-if="loading" class="quest-grid">
        <v-skeleton-loader v-for="n in 2" :key="n" type="card" class="quest-skeleton" />
      </div>

      <GlobalEmptyState v-else-if="errorMessage" icon="mdi-alert-circle-outline">
        {{ errorMessage }}
        <template #action>
          <v-btn variant="tonal" size="small" @click="refresh">Pokušaj ponovo</v-btn>
        </template>
      </GlobalEmptyState>

      <v-window v-else v-model="activeTab">
        <v-window-item value="available">
          <v-row v-if="availableQuests.length > 0">
            <v-col v-for="quest in availableQuests" :key="quest.id" cols="12" sm="6">
              <QuestCard
                :quest="quest"
                variant="available"
                @join="joinQuest"
                @edit="openEditDialog"
                @delete="confirmDelete"
              />
            </v-col>
          </v-row>
          <GlobalEmptyState v-else icon="mdi-flag-outline">
            Nema kvestova na čekanju. Dodaj novi preko dugmeta gore.
          </GlobalEmptyState>
        </v-window-item>

        <v-window-item value="current">
          <v-row v-if="currentQuests.length > 0">
            <v-col v-for="quest in currentQuests" :key="quest.id" cols="12" sm="6">
              <QuestCard
                :quest="quest"
                variant="current"
                @edit="openEditDialog"
                @delete="confirmDelete"
              />
            </v-col>
          </v-row>
          <GlobalEmptyState v-else icon="mdi-flag-outline">
            Još nisi pridružen nijednom kvestu. Pogledaj tab "Dostupno".
          </GlobalEmptyState>
        </v-window-item>
      </v-window>
    <QuestFormDialog
      v-model:open="dialogOpen"
      :saving="saving"
      :quest="editingQuest"
      @save="onSaveQuest"
    />
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Kvestovi" });

import { computed, ref } from "vue";
import { useSessionStore } from "~/stores/session";
import QuestCard from "~/components/quests/QuestCard.vue";
import QuestFormDialog from "~/components/quests/QuestFormDialog.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import { useCourierQuests } from "~/composables/useCourierQuests";
import { useConfirmStore } from "~/stores/confirm";
import type { Quest, QuestCreate } from "~/types/quest";

const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

const {
  loading,
  errorMessage,
  refresh,
  saving,
  activeTab,
  availableQuests,
  currentQuests,
  addQuest,
  editQuest,
  removeQuest,
  joinQuest,
} = useCourierQuests(courierId);

const questTabs = computed<GlobalTabBarItem<"available" | "current">[]>(() => [
  {
    value: "available",
    label: "Dostupno",
    icon: "mdi-flag-checkered",
    badge: availableQuests.value.length,
    badgeColor: "#2f6fed",
  },
  {
    value: "current",
    label: "Trenutno",
    icon: "mdi-progress-check",
    badge: currentQuests.value.length,
    badgeColor: "#00b37e",
  },
]);

const dialogOpen = ref(false);
const editingQuest = ref<Quest | null>(null);

const openAddDialog = () => {
  editingQuest.value = null;
  dialogOpen.value = true;
};

const openEditDialog = (quest: Quest) => {
  editingQuest.value = quest;
  dialogOpen.value = true;
};

const onSaveQuest = async (payload: QuestCreate) => {
  const ok = editingQuest.value
    ? await editQuest(editingQuest.value.id, payload)
    : await addQuest(payload);
  if (ok) dialogOpen.value = false;
};

const confirmStore = useConfirmStore();

const confirmDelete = async (id: number) => {
  const quest = [...availableQuests.value, ...currentQuests.value].find((q) => q.id === id);
  if (!quest) return;
  try {
    await confirmStore.confirm("Obriši kvest", `Obrisati kvest "${quest.title}"?`, {
      color: "error",
    });
    await removeQuest(quest.id);
  } catch {
    // Otkazano
  }
};
</script>

<style scoped>
.quest-grid {
  display: grid;
  gap: 12px;
}

.quest-skeleton {
  border-radius: 20px;
  height: 180px;
}
</style>
