<template>
  <button
    type="button"
    class="offer-row"
    :aria-label="`Ponuda za dostavu. ${headline}. ${time}`"
    @click="emit('open', message.id)"
  >
    <span class="offer-time">{{ time }}</span>
    <span class="offer-main">
      <span class="offer-name">{{ headline }}</span>
      <span v-if="details" class="offer-details">{{ details }}</span>
    </span>
    <v-icon icon="mdi-chevron-right" size="18" class="offer-chev" />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { InboxMessage } from "~/types/inbox";
import { splitOfferBody } from "~/utils/inbox";
import { formatClockTime } from "~/utils/datetime";
import { toLatin } from "~/utils/toLatin";

// Jedna ponuda za dostavu kao SKROMAN red (sat, restoran, detalji). Ponuda se
// prihvata na ekranu Dostave - ovdje je samo trag, pa nema ni naglašenog
// "nepročitano" stanja.
const props = defineProps<{
  message: InboxMessage;
}>();

const emit = defineEmits<{
  open: [id: number];
}>();

const parts = computed(() => splitOfferBody(toLatin(props.message.body)));
const headline = computed(() => parts.value.headline || toLatin(props.message.title));
const details = computed(() => parts.value.details);
const time = computed(() => formatClockTime(props.message.sentAt));
</script>

<style scoped>
.offer-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: center;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.offer-row:active {
  background: #f1f4f9;
}

.offer-row:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: -2px;
}

.offer-time {
  text-align: center;
  font-size: 0.74rem;
  font-weight: 700;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.offer-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.offer-name {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0b1220;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.offer-details {
  font-size: 0.78rem;
  color: #5b6676;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.offer-chev {
  color: #a7afbb;
}
</style>
