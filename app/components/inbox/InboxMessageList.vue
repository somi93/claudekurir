<template>
  <div class="inbox-list">
    <section v-for="group in groups" :key="group.key" class="inbox-day">
      <header class="inbox-day-head">
        <h2 class="inbox-day-label">{{ group.label }}</h2>
        <span v-if="group.unread > 0" class="inbox-day-unread">
          {{ unreadCountLabel(group.unread) }}
        </span>
      </header>

      <div class="inbox-card">
        <div v-for="entry in group.entries" :key="entry.key" class="inbox-entry">
          <InboxOfferDigest
            v-if="entry.kind === 'digest'"
            :offers="entry.offers"
            :expanded="expanded.has(group.key)"
            @toggle="emit('toggle-digest', group.key)"
            @open="emit('open', $event)"
          />
          <InboxOfferItem
            v-else-if="isOffer(entry.message)"
            :message="entry.message"
            @open="emit('open', $event)"
          />
          <InboxMessageItem v-else :message="entry.message" @open="emit('open', $event)" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import InboxMessageItem from "~/components/inbox/InboxMessageItem.vue";
import InboxOfferItem from "~/components/inbox/InboxOfferItem.vue";
import InboxOfferDigest from "~/components/inbox/InboxOfferDigest.vue";
import { isOffer, unreadCountLabel, type InboxDayGroup } from "~/utils/inboxGroups";

// Poruke grupisane po danu: oznaka dana, pa jedna kartica sa redovima razdvojenim
// tankom linijom (isti obrazac kao Novčanik, vidi WalletList.vue).
defineProps<{
  groups: InboxDayGroup[];
  // Ključevi dana čiji je sažetak ponuda rasklopljen.
  expanded: Set<string>;
}>();

const emit = defineEmits<{
  open: [id: number];
  "toggle-digest": [dayKey: string];
}>();
</script>

<style scoped>
.inbox-day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 20px 4px 8px;
}

.inbox-day:first-child .inbox-day-head {
  padding-top: 4px;
}

.inbox-day-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #0b1220;
}

.inbox-day-unread {
  font-size: 0.76rem;
  font-weight: 700;
  color: #2459c7;
}

.inbox-card {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.inbox-entry {
  position: relative;
}

/* Linija između redova, uvučena od ikone (padding 16 + ikona 44 + razmak 12). */
.inbox-entry + .inbox-entry::before {
  content: "";
  position: absolute;
  top: 0;
  left: 72px;
  right: 0;
  height: 1px;
  background: #eceef2;
  z-index: 1;
}
</style>
