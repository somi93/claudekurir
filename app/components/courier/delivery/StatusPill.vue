<template>
  <button
    type="button"
    class="dl-pill"
    :class="`dl-pill--${tone}`"
    :aria-label="ariaLabel"
    @click="emit('select')"
  >
    <span class="dl-pill-dot" aria-hidden="true" />
    <span>{{ label }}</span>
    <small v-if="detail">{{ detail }}</small>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Jedna pilula na mapi umjesto tri banera ("Uključi lokaciju", "Nema veze", ...):
// zelena = sve u redu, narandžasta = radi ali slabo, crvena = ne radi.
const props = defineProps<{
  tone: "ok" | "warn" | "bad";
  label: string;
  detail?: string | null;
}>();

const emit = defineEmits<{
  select: [];
}>();

const ariaLabel = computed(() =>
  props.detail ? `Status: ${props.label}, ${props.detail}` : `Status: ${props.label}`
);
</script>
