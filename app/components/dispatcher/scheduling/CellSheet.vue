<template>
  <AppSheet
    :open="open"
    :title="`${zoneName} · ${cap1(dayLong(date))}`"
    :subtitle="smjena(shifts.length)"
    @update:open="emit('update:open', $event)"
  >
    <div class="cs-rows">
      <button v-for="s in shifts" :key="s.id" type="button" class="cs-row" :data-shift-row="s.id" @click="emit('shift', s.id)">
        <span class="cs-a">
          {{ fmtWinFull(s.start, s.end) }}
          <small>{{ s.booked }} od {{ s.target }} kurira{{ s.hot ? " · hitna" : "" }}</small>
        </span>
        <ShiftPill :tone="TONE[s.status]">{{ s.phase === "past" ? "Završeno" : STATUS[s.status].label }}</ShiftPill>
        <v-icon icon="mdi-chevron-right" size="20" />
      </button>
    </div>
    <TintAlert v-if="holes.length" tone="info" title="Rupa u pokrivenosti">
      <template v-for="g in holes" :key="g.from">Od {{ g.from }} do {{ g.to }} u ovoj zoni nema nijedne smjene.<br /></template>
    </TintAlert>

    <template #footer>
      <AppButton icon="mdi-plus" data-field="cell-add" @click="emit('add')">Dodaj smjenu</AppButton>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import ShiftPill from "~/components/dispatcher/scheduling/ShiftPill.vue";
import { smjena } from "~/composables/useShiftBatch";
import { STATUS, cap1, dayLong, fmtWinFull, gaps, type DecoratedShift } from "~/utils/schedule";

// Ćelija mreže (zona + dan) sa smjenama: spisak sa statusom, jedan dodir otvara smjenu; ispod je rupa u
// pokrivenosti ako je ima. "Dodaj smjenu" otvara novu smjenu za baš tu zonu i dan.
const props = defineProps<{ open: boolean; zoneName: string; date: string; shifts: DecoratedShift[] }>();
const emit = defineEmits<{ "update:open": [value: boolean]; shift: [id: number]; add: [] }>();

const TONE = { understaffed: "bad", below_target: "warn", target_reached: "ok", full: "blue" } as const;
const holes = computed(() => gaps(props.shifts));
</script>

<style scoped>
.cs-rows {
  display: grid;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.cs-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 20px;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 12px;
  border: 0;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.cs-row + .cs-row {
  border-top: 1px solid #eceef2;
}

.cs-row:hover {
  background: #fafbfc;
}

.cs-row:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.cs-a {
  font-weight: 800;
}

.cs-a small {
  display: block;
  font-size: 0.76rem;
  font-weight: 600;
  color: #5b6676;
}
</style>
