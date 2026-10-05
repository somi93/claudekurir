<template>
  <div class="digest">
    <button
      type="button"
      class="digest-row"
      :aria-expanded="expanded"
      :aria-label="`${label}. ${summary}. ${expanded ? 'Sakrij' : 'Prikaži'} ponude`"
      @click="emit('toggle')"
    >
      <span class="digest-ico" :style="{ background: meta.tint, color: meta.color }">
        <v-icon :icon="meta.icon" size="22" />
      </span>

      <span class="digest-main">
        <span class="digest-eyebrow" :style="{ color: meta.ink }">{{ meta.label }}</span>
        <span class="digest-title">{{ label }}</span>
        <span v-if="summary" class="digest-snippet">{{ summary }}</span>
      </span>

      <span class="digest-meta">
        <span class="digest-time">{{ time }}</span>
        <v-icon icon="mdi-chevron-down" size="20" class="digest-chev" />
      </span>
    </button>

    <div v-if="expanded" class="digest-list">
      <InboxOfferItem
        v-for="offer in offers"
        :key="offer.id"
        :message="offer"
        @open="emit('open', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import InboxOfferItem from "~/components/inbox/InboxOfferItem.vue";
import type { InboxMessage } from "~/types/inbox";
import { CATEGORY_META } from "~/utils/inbox";
import { offerHeadline, offersCountLabel, summarizeOfferNames } from "~/utils/inboxGroups";
import { formatClockTime } from "~/utils/datetime";
import { toLatin } from "~/utils/toLatin";

// Sve ponude jednog dana u JEDNOM redu ("5 ponuda za dostavu", "Restoran A,
// Restoran B i još 3"). Raširi se u pojedinačne ponude. Ponude su trag, ne
// poruke - zato ne utiču na brojač nepročitanog.
const props = defineProps<{
  // Najnovija prva.
  offers: InboxMessage[];
  expanded: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  open: [id: number];
}>();

const meta = CATEGORY_META.offer;
const label = computed(() => offersCountLabel(props.offers.length));
const summary = computed(() =>
  summarizeOfferNames(props.offers.map((offer) => toLatin(offerHeadline(offer))))
);
const time = computed(() => formatClockTime(props.offers[0]?.sentAt));
</script>

<style scoped>
.digest-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: start;
  width: 100%;
  min-height: 76px;
  padding: 14px 16px;
  background: #fff;
  border: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.digest-row:active {
  background: #f1f4f9;
}

.digest-row:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: -2px;
}

.digest-ico {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.digest-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.digest-eyebrow {
  margin: 2px 0 5px;
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.digest-title {
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.25;
  color: #0b1220;
}

.digest-snippet {
  margin-top: 3px;
  font-size: 0.86rem;
  line-height: 1.4;
  color: #5b6676;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.digest-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 34px;
  padding-top: 2px;
}

.digest-time {
  font-size: 0.74rem;
  color: #657083;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.digest-chev {
  color: #657083;
  transition: transform 0.2s ease;
}

.digest-row[aria-expanded="true"] .digest-chev {
  transform: rotate(180deg);
}

.digest-list {
  background: #fafbfc;
  border-top: 1px solid #eceef2;
}

.digest-list > * + * {
  position: relative;
}

.digest-list > * + *::before {
  content: "";
  position: absolute;
  top: 0;
  left: 72px;
  right: 0;
  height: 1px;
  background: #eceef2;
}

@media (prefers-reduced-motion: reduce) {
  .digest-chev {
    transition: none;
  }
}
</style>
