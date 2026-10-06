<template>
  <GlobalCard padding="20px" class="surcharge-card" :class="{ inactive: !surcharge.active }">
    <div class="surcharge-head">
      <div
        class="surcharge-icon"
        :style="{ background: surcharge.active ? '#e3f8ef' : '#f5f6f8' }"
      >
        <v-icon :icon="displayIcon" :color="surcharge.active ? '#00b37e' : '#9aa4b2'" />
      </div>
      <div class="d-flex align-center ga-1">
        <v-switch
          v-model="surcharge.active"
          color="accent"
          hide-details
          density="compact"
          @update:model-value="emit('toggle', surcharge)"
        />
        <GlobalButtonDelete
          ariaLabel="Obriši naknadu"
          @click="emit('remove', surcharge.id)"
        />
      </div>
    </div>

    <h3>{{ surcharge.name }}</h3>
    <p class="surcharge-desc">{{ surcharge.description }}</p>

    <p v-if="surcharge.time_from" class="reminder-label text-medium-emphasis">Automatski po satu</p>
    <p v-else-if="activationLabel" class="reminder-label text-warning">{{ activationLabel }}</p>

    <div class="surcharge-meta">
      <v-chip v-if="surcharge.type !== 'note'" size="small" variant="tonal" color="primary">
        +{{ surcharge.value }} {{ surcharge.unit }}
      </v-chip>
      <v-chip v-else size="small" variant="tonal" color="secondary">
        {{ surcharge.unit }}
      </v-chip>
      <v-chip v-if="surcharge.time_from" size="small" variant="outlined">
        <v-icon start icon="mdi-clock-outline" size="14" />
        {{ surcharge.time_from }}–{{ surcharge.time_to }}
      </v-chip>
    </div>

    <div class="catalog-badge">
      <v-chip v-if="surcharge.condition_tag" size="x-small" color="primary" variant="tonal">
        Iz kataloga
      </v-chip>
      <v-chip v-else size="x-small" color="default" variant="tonal">Prilagođeno</v-chip>
    </div>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import GlobalButtonDelete from "~/components/common/GlobalButtonDelete.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import type { Surcharge } from "~/types/pricing";
import { formatElapsedDuration } from "~/utils/datetime";
import { conditionTagDisplayIcon } from "~/utils/conditionTag";

const props = defineProps<{
  surcharge: Surcharge;
}>();

const emit = defineEmits<{
  toggle: [surcharge: Surcharge];
  remove: [id: number];
}>();

// Osvežava "Aktivno Xh Ymin" tekst na svaki minut bez ponovnog fetch-a liste.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 60000);
});
onUnmounted(() => {
  if (ticker) clearInterval(ticker);
});

const activationLabel = computed(() => {
  void now.value;
  if (!props.surcharge.active || !props.surcharge.activated_at) return null;
  return `Aktivno ${formatElapsedDuration(props.surcharge.activated_at)}`;
});

const displayIcon = computed(() =>
  props.surcharge.condition_tag
    ? conditionTagDisplayIcon(props.surcharge.condition_tag)
    : props.surcharge.icon || "mdi-tune-variant"
);
</script>

<style scoped>
.surcharge-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: opacity 150ms ease;
}

.surcharge-card.inactive {
  opacity: 0.6;
}

.surcharge-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.surcharge-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.surcharge-card h3 {
  margin: 4px 0 0;
  font-size: 1.05rem;
}

.surcharge-desc {
  margin: 0;
  color: #6b7685;
  font-size: 0.85rem;
  line-height: 1.4;
  min-height: 40px;
}

.reminder-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
}

.surcharge-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
}

.catalog-badge {
  margin-top: 4px;
}

@media (max-width: 600px) {
  .surcharge-desc {
    min-height: 0;
  }
}
</style>
