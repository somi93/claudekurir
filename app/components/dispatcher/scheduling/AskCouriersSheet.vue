<template>
  <AppSheet :open="open" title="Traži kurire" :subtitle="subtitle" @update:open="emit('update:open', $event)">
    <div v-if="draft" class="ac-draft">
      <div class="ac-lb">Nacrt poruke</div>
      <b class="ac-title">{{ draft.title }}</b>
      <p class="ac-body">{{ draft.body }}</p>
      <div class="ac-to">Kome: <b>Svi aktivni kuriri</b> (promijeni na ekranu Poruke)</div>
    </div>
    <TintAlert tone="info">
      Poruka se ne šalje odavde. Otvara se ekran Poruke sa ovim nacrtom: tamo vidiš pregled i potvrđuješ slanje.
    </TintAlert>

    <template #footer>
      <AppButton icon="mdi-send-outline" data-autofocus data-field="ask-go" @click="emit('go')">Otvori u Porukama</AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { askDraft, dayLong, fmtWinFull, type Clock, type SchedShift } from "~/utils/schedule";

// "Traži kurire": priprema nacrt poruke sa brojem kurira koji fali i otvara ekran Poruke (nacrt se čuva
// na uređaju, isti ključ koji Poruke koriste). Ništa se ne šalje bez pregleda i potvrde tamo.
const props = defineProps<{ open: boolean; shift: SchedShift | null; zoneName: string; now: Clock }>();
const emit = defineEmits<{ "update:open": [value: boolean]; go: [] }>();

const draft = computed(() => (props.shift ? askDraft(props.shift, props.zoneName, props.now) : null));
const subtitle = computed(() =>
  props.shift ? `${props.zoneName} · ${fmtWinFull(props.shift.start, props.shift.end)} · ${dayLong(props.shift.date)}` : ""
);
</script>

<style scoped>
.ac-draft {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  background: #f5f6f8;
}

.ac-lb {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #5b6676;
}

.ac-title {
  font-size: 1rem;
}

.ac-body {
  margin: 0;
  font-size: 0.9rem;
  color: #5b6676;
}

.ac-to {
  font-size: 0.8rem;
  color: #5b6676;
}

.ac-to b {
  color: #0b1220;
}
</style>
