<template>
  <v-card class="day-card" flat>
    <p class="day-card-date">{{ dateLabel }}</p>

    <div class="d-flex justify-space-between align-center flex-wrap ga-3 available-row">
      <div>
        <p class="available-title">Dostupan</p>
        <p class="available-subtitle">{{ totalHoursLabel }}</p>
      </div>
      <v-switch
        :model-value="available"
        color="accent"
        hide-details
        :disabled="saving || isPastDay"
        @update:model-value="emit('toggle-available', Boolean($event))"
      />
    </div>

    <div v-if="slots.length > 0" class="slot-list">
      <div v-for="slot in slots" :key="slot.id" class="slot-row">
        <div class="slot-icon">
          <v-icon icon="mdi-clock-outline" size="20" />
        </div>
        <div class="slot-info">
          <div class="slot-range-row">
            <p class="slot-range">{{ slot.startTime }} – {{ slot.endTime }}</p>
            <v-chip size="x-small" variant="flat" :color="STATUS_META[slot.status].color">
              {{ STATUS_META[slot.status].label }}
            </v-chip>
          </div>
          <p class="slot-duration">{{ slotDurationLabel(slot) }}</p>
          <p v-if="slot.zone" class="slot-zone">{{ toLatin(slot.zone.name) }}</p>
          <p v-if="slot.status === 'waitlisted'" class="waitlisted-note">
            Smjena je puna, javićemo vam kad se oslobodi mjesto.
          </p>
        </div>
        <GlobalButtonDelete
          :iconSize="20"
          ariaLabel="Obriši termin"
          :disabled="saving"
          @click="emit('remove-slot', slot.id)"
        />
      </div>
    </div>
    <GlobalEmptyState v-else icon="mdi-calendar-blank-outline">
      Još nema termina za ovaj dan.
    </GlobalEmptyState>

    <p v-if="isPastDay" class="past-day-note">
      Ne možeš mijenjati raspored za prošle dane.
    </p>
    <v-btn
      v-else
      class="add-slot-btn mt-3"
      variant="outlined"
      color="primary"
      block
      prepend-icon="mdi-plus"
      :disabled="saving"
      @click="emit('add-slot')"
    >
      Dodaj termin
    </v-btn>

    <p class="autosave-note">Promjene se spremaju automatski.</p>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AvailabilitySlotStatus, AvailabilityTimeSlot } from "~/types/availability";
import GlobalButtonDelete from "~/components/common/GlobalButtonDelete.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";

const props = defineProps<{
  dateLabel: string;
  available: boolean;
  totalMinutes: number;
  slots: AvailabilityTimeSlot[];
  saving: boolean;
  isPastDay: boolean;
}>();

const emit = defineEmits<{
  "toggle-available": [value: boolean];
  "remove-slot": [slotId: number];
  "add-slot": [];
}>();

const STATUS_META: Record<AvailabilitySlotStatus, { color: string; label: string }> = {
  confirmed: { color: "success", label: "Potvrđeno" },
  waitlisted: { color: "warning", label: "Na čekanju" },
};

const formatHours = (minutes: number) => {
  if (minutes <= 0) return "0h";
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
};

const slotDurationLabel = (slot: AvailabilityTimeSlot) =>
  formatHours(slot.durationMinutes);

const totalHoursLabel = computed(() => `Ukupno ${formatHours(props.totalMinutes)}`);
</script>

<style scoped>
.day-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  padding: 20px;
}

.day-card-date {
  margin: 0 0 14px;
  font-weight: 800;
  font-size: 1.05rem;
  color: #0b1220;
}

.available-row {
  padding: 14px 16px;
  background: #f5f6f8;
  border-radius: 16px;
}

.available-title {
  margin: 0;
  font-weight: 700;
}

.available-subtitle {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: #6b7685;
}

.slot-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.slot-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid #e7e9ee;
  border-radius: 16px;
}

.slot-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #e7e9ee;
  color: #0b1220;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.slot-info {
  flex: 1;
  min-width: 0;
}

.slot-range-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slot-range {
  margin: 0;
  font-weight: 700;
}

.slot-duration {
  margin: 1px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
}

.slot-zone {
  margin: 1px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
}

.waitlisted-note {
  margin: 4px 0 0;
  font-size: 0.76rem;
  color: #b98900;
}

.past-day-note {
  margin: 16px 0 0;
  font-size: 0.82rem;
  color: #9aa4b2;
}

.add-slot-btn {
  border-style: dashed;
}

.autosave-note {
  margin: 14px 0 0;
  text-align: center;
  font-size: 0.78rem;
  color: #9aa4b2;
}
</style>
