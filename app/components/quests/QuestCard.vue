<template>
  <v-card class="quest-card" flat :class="{ completed: quest.status === 'completed' }">
    <div class="quest-head">
      <h3>{{ quest.title }}</h3>
      <div class="quest-head-actions">
        <v-chip v-if="quest.status === 'completed'" size="small" color="success" variant="flat">
          <v-icon start icon="mdi-check" size="14" />
          Ispunjeno
        </v-chip>
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              icon="mdi-dots-vertical"
              variant="text"
              size="small"
              class="quest-menu-btn"
              aria-label="Opcije"
              v-bind="props"
            />
          </template>
          <v-list density="compact">
            <v-list-item @click="emit('edit', quest)">
              <v-list-item-title>Izmeni</v-list-item-title>
            </v-list-item>
            <v-list-item @click="emit('delete', quest.id)">
              <v-list-item-title class="text-error">Obriši</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>

    <p class="quest-desc">{{ quest.description }}</p>

    <div class="quest-meta">
      <v-chip size="small" variant="tonal" color="accent">
        <v-icon start icon="mdi-gift-outline" size="14" />
        {{ quest.reward }}
      </v-chip>
      <span class="quest-deadline">
        <v-icon icon="mdi-calendar-outline" size="14" />
        do {{ formatDate(quest.deadline) }}
      </span>
    </div>

    <template v-if="variant === 'current'">
      <v-progress-linear
        :model-value="(quest.progress / quest.goal) * 100"
        :color="quest.status === 'completed' ? 'success' : 'primary'"
        height="8"
        rounded
        class="quest-progress"
      />
      <p class="quest-progress-label">{{ quest.progress }} / {{ quest.goal }} {{ quest.unit }}</p>
    </template>

    <GlobalButtonPrimary v-else block size="small" @click="emit('join', quest.id)">Pridruži se</GlobalButtonPrimary>
  </v-card>
</template>

<script setup lang="ts">
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import type { Quest } from "~/types/quest";
import { formatDate } from "~/utils/datetime";

defineProps<{
  quest: Quest;
  variant: "available" | "current";
}>();

const emit = defineEmits<{
  join: [id: number];
  edit: [quest: Quest];
  delete: [id: number];
}>();
</script>

<style scoped>
.quest-card {
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.quest-card.completed {
  background: #f1fbf6;
}

.quest-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.quest-head h3 {
  margin: 0;
  font-size: 1.02rem;
  letter-spacing: -0.01em;
}

.quest-head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.quest-menu-btn {
  margin: -8px -8px -8px 0;
}

.quest-desc {
  margin: 0;
  color: #6b7685;
  font-size: 0.85rem;
  line-height: 1.45;
}

.quest-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.quest-deadline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: #9aa4b2;
}

.quest-progress {
  margin-top: 4px;
}

.quest-progress-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: #0b1220;
}
</style>
