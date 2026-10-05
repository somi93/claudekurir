<template>
  <button
    type="button"
    class="msg-row"
    :class="{ 'msg-row--unread': !message.read }"
    :aria-label="ariaLabel"
    @click="emit('open', message.id)"
  >
    <span class="msg-ico" :style="{ background: category.tint, color: category.color }">
      <v-icon :icon="category.icon" size="22" />
    </span>

    <span class="msg-main">
      <span class="msg-eyebrow" :style="{ color: category.ink }">
        {{ category.label }}<template v-if="message.sender === 'platform'"> · Platforma</template>
      </span>
      <span class="msg-title">{{ title }}</span>
      <span v-if="snippet" class="msg-snippet">{{ snippet }}</span>
    </span>

    <span class="msg-meta">
      <span class="msg-time">{{ time }}</span>
      <span v-if="!message.read" class="msg-dot" aria-hidden="true" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { InboxMessage } from "~/types/inbox";
import { getCategoryMeta } from "~/utils/inbox";
import { formatClockTime } from "~/utils/datetime";
import { toLatin } from "~/utils/toLatin";

// Jedna poruka u listi. Kategorija je u malom naslovu iznad (zamjenjuje stari
// "DISPEČER", koji je uvijek isti), vrijeme je desno, a nepročitano označava
// plava tačka ispod njega. Dan je u zaglavlju grupe, pa ovdje ide samo sat.
const props = defineProps<{
  message: InboxMessage;
}>();

const emit = defineEmits<{
  open: [id: number];
}>();

const category = computed(() => getCategoryMeta(props.message.category));
const time = computed(() => formatClockTime(props.message.sentAt));
const title = computed(() => toLatin(props.message.title));

// Ako je tekst isti kao naslov ("test" / "test"), ne ponavljamo ga u listi.
const snippet = computed(() => {
  const body = toLatin(props.message.body).trim();
  return body && body !== title.value.trim() ? body : "";
});

const ariaLabel = computed(
  () =>
    `${props.message.read ? "" : "Nepročitano. "}${category.value.label}. ${title.value}. ${time.value}`
);
</script>

<style scoped>
.msg-row {
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
  transition: background 0.12s ease;
}

.msg-row:active {
  background: #f1f4f9;
}

.msg-row:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: -2px;
}

.msg-row--unread {
  background: #f5f9ff;
}

.msg-ico {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.msg-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.msg-eyebrow {
  margin: 2px 0 5px;
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.msg-title {
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.25;
  color: #0b1220;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-row--unread .msg-title {
  font-weight: 800;
}

.msg-snippet {
  margin-top: 3px;
  font-size: 0.86rem;
  line-height: 1.4;
  color: #5b6676;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.msg-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  min-width: 34px;
  padding-top: 2px;
}

.msg-time {
  font-size: 0.74rem;
  color: #657083;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.msg-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2f6fed;
}
</style>
