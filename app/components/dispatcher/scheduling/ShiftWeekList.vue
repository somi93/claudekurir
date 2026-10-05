<template>
  <!-- ŠIRI EKRAN: rota tabela — redovi su zone, kolone su dani sedmice. -->
  <div v-if="wide" class="rota-wrap">
    <div class="rota" role="table" aria-label="Raspored smjena po zonama i danima">
      <div class="rota-row rota-row--head" role="row">
        <div class="rota-cell rota-corner" role="columnheader">
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            class="rota-new"
            :disabled="saving"
            @click="emitAdd(defaultAddDate, null)"
          >
            Nova smjena
          </v-btn>
        </div>
        <div
          v-for="day in weekDays"
          :key="day.date"
          class="rota-cell rota-day"
          :class="{ 'is-today': day.isToday }"
          role="columnheader"
        >
          <span class="rota-day-name">{{ day.shortLabel }}</span>
          <span class="rota-day-num">{{ day.dayNumber }}</span>
          <span v-if="day.isToday" class="rota-day-today">danas</span>
        </div>
      </div>

      <div
        v-for="zone in rotaZones"
        :key="zone.id"
        class="rota-row"
        role="row"
      >
        <div class="rota-cell rota-zone" role="rowheader" :title="zone.name">
          {{ zone.name }}
        </div>
        <div
          v-for="day in weekDays"
          :key="day.date"
          class="rota-cell rota-slot"
          :class="{ 'is-today': day.isToday }"
          role="cell"
        >
          <ShiftTemplateCard
            v-for="t in cellShifts(zone.id, day.date)"
            :key="t.id"
            hide-zone
            :template="t"
            :saving="saving"
            @edit="emit('edit', $event)"
            @delete="emit('delete', $event)"
          />
          <button
            type="button"
            class="rota-add"
            :aria-label="`Dodaj smjenu — ${zone.name}, ${day.shortLabel} ${day.dayNumber}`"
            :disabled="saving"
            @click="emitAdd(day.date, zone.id)"
          >
            <v-icon icon="mdi-plus" size="15" />
          </button>
        </div>
      </div>

      <div v-if="!rotaZones.length" class="rota-row" role="row">
        <div class="rota-cell rota-blank" role="cell">
          <GlobalEmptyState icon="mdi-calendar-blank-outline">
            Nijedna zona nema smjenu ove sedmice. Klikni „Nova smjena“ ili
            „Kopiraj za narednu sedmicu“.
          </GlobalEmptyState>
        </div>
      </div>
    </div>
  </div>

  <!-- UŽI EKRAN: dan po dan. -->
  <div v-else class="daylist">
    <div
      v-for="day in weekDays"
      :key="day.date"
      class="daylist-day"
      :class="{ 'is-today': day.isToday, 'is-empty': !dayShifts(day.date).length }"
    >
      <div class="daylist-head">
        <span class="daylist-num">{{ day.dayNumber }}</span>
        <span class="daylist-name">{{ day.shortLabel }}</span>
        <span v-if="day.isToday" class="daylist-today">danas</span>
      </div>
      <div class="daylist-body">
        <ShiftTemplateCard
          v-for="t in dayShifts(day.date)"
          :key="t.id"
          class="daylist-chip"
          :template="t"
          :saving="saving"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)"
        />
        <span v-if="!dayShifts(day.date).length" class="daylist-empty">Nema smjena</span>
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-plus"
          class="daylist-add"
          :disabled="saving"
          @click="emitAdd(day.date, null)"
        >
          Dodaj
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDisplay } from "vuetify";
import ShiftTemplateCard from "~/components/dispatcher/scheduling/ShiftTemplateCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import type { ShiftTemplate } from "~/types/shiftTemplate";

const props = defineProps<{
  weekDays: { date: string; shortLabel: string; dayNumber: number; isToday: boolean }[];
  templatesByDate: Record<string, ShiftTemplate[]>;
  saving: boolean;
}>();

const emit = defineEmits<{
  "add-shift": [payload: { date: string; zoneId: number | null }];
  edit: [template: ShiftTemplate];
  delete: [template: ShiftTemplate];
}>();

const { mdAndUp: wide } = useDisplay();

const dayShifts = (date: string): ShiftTemplate[] => props.templatesByDate[date] ?? [];

// Zone koje imaju bar jednu smjenu u prikazanoj sedmici → redovi tabele.
// Zona bez ijedne smjene se ne prikazuje (doda se preko „Nova smjena“).
const rotaZones = computed(() => {
  const seen = new Map<number, string>();
  for (const list of Object.values(props.templatesByDate)) {
    for (const t of list) {
      if (!seen.has(t.zone.id)) seen.set(t.zone.id, toLatin(t.zone.name));
    }
  }
  return [...seen]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const cellShifts = (zoneId: number, date: string) =>
  dayShifts(date).filter((t) => t.zone.id === zoneId);

// „Nova smjena“ bez konteksta dana: danas ako je u prikazanoj sedmici, inače
// prvi dan te sedmice.
const defaultAddDate = computed(
  () => props.weekDays.find((d) => d.isToday)?.date ?? props.weekDays[0]?.date ?? ""
);

const emitAdd = (date: string, zoneId: number | null) =>
  emit("add-shift", { date, zoneId });
</script>

<style scoped>
/* ---------- Rota tabela ---------- */
.rota-wrap {
  overflow-x: auto;
}

.rota {
  min-width: 880px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rota-row {
  display: flex;
  gap: 4px;
  align-items: stretch;
}

.rota-cell {
  min-width: 0;
}

/* Fiksna lijeva kolona sa imenom zone. */
.rota-corner,
.rota-zone {
  flex: 0 0 148px;
  display: flex;
  align-items: center;
}

.rota-zone {
  padding: 8px 10px;
  font-weight: 700;
  font-size: 0.82rem;
  color: #0b1220;
  background: #f4f6f8;
  border-radius: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rota-new {
  text-transform: none;
  letter-spacing: 0;
}

/* Dan-kolone. */
.rota-day,
.rota-slot {
  flex: 1 1 0;
}

.rota-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 6px 4px;
  border-radius: 10px;
  background: #f4f6f8;
}

.rota-day-name {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7685;
}

.rota-day-num {
  font-size: 1rem;
  font-weight: 800;
  color: #0b1220;
  line-height: 1.2;
}

.rota-day-today {
  font-size: 0.52rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #2f6fed;
}

.rota-day.is-today {
  background: #e4edff;
}

.rota-day.is-today .rota-day-name,
.rota-day.is-today .rota-day-num {
  color: #2f6fed;
}

.rota-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: #fafbfc;
}

.rota-slot.is-today {
  background: #eef4ff;
}

/* „+“ u ćeliji — tih, puni prazan slot i služi kao meta za dodavanje. */
.rota-add {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #b4bcc8;
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease;
}

.rota-slot:hover .rota-add {
  color: #6b7685;
}

.rota-add:hover {
  color: #2f6fed;
  background: #e4edff;
}

.rota-add:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 1px;
}

.rota-add:disabled {
  cursor: default;
  opacity: 0.4;
}

.rota-blank {
  flex: 1;
}

/* ---------- Uži ekran: dan po dan ---------- */
.daylist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.daylist-day {
  display: grid;
  grid-template-columns: 48px 1fr;
  grid-template-areas:
    "head body";
  gap: 4px 14px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #f4f6f8;
}

.daylist-day.is-empty {
  padding: 10px 14px;
  background: #f8f9fb;
}

.daylist-day.is-today {
  background: #eef4ff;
  outline: 1px solid #d5e2ff;
  outline-offset: -1px;
}

.daylist-head {
  grid-area: head;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.daylist-num {
  font-size: 1.3rem;
  font-weight: 800;
  color: #0b1220;
  line-height: 1;
}

.daylist-name {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7685;
}

.daylist-today {
  font-size: 0.54rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #2f6fed;
}

.daylist-day.is-today .daylist-num,
.daylist-day.is-today .daylist-name {
  color: #2f6fed;
}

.daylist-body {
  grid-area: body;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.daylist-chip {
  width: 100%;
  max-width: 360px;
}

.daylist-empty {
  font-size: 0.82rem;
  color: #9aa4b2;
}

.daylist-add {
  text-transform: none;
  letter-spacing: 0;
}

@media (max-width: 560px) {
  .daylist-chip {
    max-width: none;
  }

  .daylist-add {
    width: 100%;
  }
}
</style>
