<template>
  <AppSheet
    :open="open"
    title="Obrisati smjenu?"
    :subtitle="subtitle"
    @update:open="emit('update:open', $event)"
  >
    <TintAlert v-if="shift && shift.booked" tone="bad" role="alert" :title="bookedTitle">
      Obriši samo ako je smjena otkazana. Kurire obavijesti sam; šta se sa njihovim terminima desi na serveru, aplikacija ne zna.
    </TintAlert>
    <TintAlert v-else tone="info">U smjeni nema potvrđenih kurira. Brisanje se ne može poništiti.</TintAlert>

    <template #footer>
      <div class="ds-two">
        <AppButton variant="ghost" data-autofocus data-field="del-cancel" @click="emit('update:open', false)">Odustani</AppButton>
        <AppButton variant="danger" :loading="saving" data-field="del-do" @click="emit('confirm')">Obriši smjenu</AppButton>
      </div>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { dayLong, fmtWinFull, type SchedShift } from "~/utils/schedule";

// Brisanje smjene: kaže koliko je kurira potvrđeno (pitanje "Obrisati smjenu?" to nije pominjalo). Fokus je na
// "Odustani", a brisanje je crveno i nikad prvo.
const props = defineProps<{ open: boolean; shift: SchedShift | null; zoneName: string; saving: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean]; confirm: [] }>();

const subtitle = computed(() =>
  props.shift ? `${props.zoneName} · ${fmtWinFull(props.shift.start, props.shift.end)} · ${dayLong(props.shift.date)}` : ""
);
const bookedTitle = computed(() =>
  props.shift?.booked === 1 ? "U smjeni je 1 potvrđen kurir" : `U smjeni je ${props.shift?.booked ?? 0} potvrđenih kurira`
);
</script>

<style scoped>
.ds-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ds-two :deep(.ab) {
  min-height: 52px;
}
</style>
