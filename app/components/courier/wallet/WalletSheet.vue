<template>
  <v-bottom-sheet
    :model-value="open"
    inset
    max-width="560"
    @update:model-value="emit('update:open', $event)"
  >
    <v-card class="ws" rounded="t-xl" tabindex="-1" :aria-label="label ?? title">
      <div class="ws-grip" aria-hidden="true"><i /></div>

      <header class="ws-head">
        <div class="ws-head-text">
          <h2 class="ws-title">{{ title }}</h2>
          <p v-if="subtitle" class="ws-sub">{{ subtitle }}</p>
        </div>
        <button
          ref="closeBtn"
          type="button"
          class="ws-ib"
          aria-label="Zatvori"
          @click="emit('update:open', false)"
        >
          <v-icon icon="mdi-close" size="20" />
        </button>
      </header>

      <div class="ws-body"><slot /></div>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

// Ljuska donjeg lista u Novčaniku (prijava, detalj predaje, detalj isplate, pomoć): isti izgled kao
// detalj dostave u Istoriji - ručka, naslov sa podnaslovom, X, tijelo koje se skroluje. Donji list
// jer je na telefonu u dosegu palca. Fokus ide na "Zatvori", a po zatvaranju se vraća na ono što
// je list otvorilo; Esc zatvara.
const props = defineProps<{
  open: boolean;
  title: string;
  subtitle?: string;
  // Naziv za čitač ekrana ako se razlikuje od naslova.
  label?: string;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const closeBtn = ref<HTMLButtonElement | null>(null);
let returnFocusTo: HTMLElement | null = null;

watch(
  () => props.open,
  async (open) => {
    if (typeof document === "undefined") return;
    if (open) {
      returnFocusTo = document.activeElement as HTMLElement | null;
      await nextTick();
      closeBtn.value?.focus({ preventScroll: true });
    } else {
      returnFocusTo?.focus?.({ preventScroll: true });
      returnFocusTo = null;
    }
  }
);
</script>

<style scoped>
.ws {
  display: flex;
  flex-direction: column;
  color: #0b1220;
  max-height: 90vh;
  max-height: 90dvh;
  overflow: hidden;
  outline: none;
  box-shadow: 0 -10px 34px rgba(11, 18, 32, 0.16), 0 -1px 2px rgba(11, 18, 32, 0.06);
}

.ws-grip {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
}

.ws-grip i {
  display: block;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: #d5d9e0;
}

.ws-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px 12px 20px;
}

.ws-head-text {
  min-width: 0;
}

.ws-title {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.ws-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.ws-ib {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-top: -4px;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.ws-ib:active {
  background: #e5e8ed;
}

.ws-ib:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.ws-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 20px 18px;
}
</style>
