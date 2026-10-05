<template>
  <div v-if="visible" class="outbox-bar" :class="{ 'outbox-bar--critical': relayDown }">
    <v-icon :icon="relayDown ? 'mdi-alert-circle' : 'mdi-clock-alert-outline'" size="18" />
    <span class="outbox-text">
      <template v-if="relayDown">
        Knjiženje dostava u glavnu knjigu ne radi{{
          status?.last_run_at ? ` od ${formatDateTime(status.last_run_at)}` : ""
        }}. Ovo je kvar sistema, ne treba ništa da radite - obavezno prijavite podršci.
      </template>
      <template v-else-if="hasStalePending">
        Čeka {{ status?.pending }} {{ status?.pending === 1 ? "događaj" : "događaja" }} za
        knjiženje u glavnu knjigu.
      </template>
      <template v-else-if="hasDead">
        {{ status?.dead }} knjiženj{{ status?.dead === 1 ? "e" : "a" }} je palo više puta i čeka
        ručnu odluku podrške (lista pojedinačnih stavki još nije dostupna na ovom ekranu).
      </template>
    </span>
    <div class="outbox-actions">
      <GlobalButtonPrimary
        v-if="hasStalePending && !relayDown"
        size="small"
        :loading="syncing"
        @click="sync"
      >
        Sinhronizuj
      </GlobalButtonPrimary>
    </div>
  </div>
</template>

<script setup lang="ts">
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import { useOutboxStatus } from "~/composables/useOutboxStatus";
import { formatDateTime } from "~/utils/datetime";

const { status, visible, relayDown, hasStalePending, hasDead, syncing, sync } =
  useOutboxStatus();
</script>

<style scoped>
.outbox-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #fff4e0;
  color: #7a4a00;
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.outbox-bar--critical {
  background: #fde8e8;
  color: #8c1c13;
}

.outbox-text {
  flex: 1 1 auto;
}

.outbox-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
</style>
