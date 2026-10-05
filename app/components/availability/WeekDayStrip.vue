<template>
  <v-card class="week-card" flat>
    <div class="week-nav">
      <v-btn
        icon
        variant="text"
        size="small"
        aria-label="Prethodna sedmica"
        @click="emit('shift-week', -1)"
      >
        <v-icon icon="mdi-chevron-left" />
      </v-btn>
      <div class="week-nav-center">
        <span class="week-month">{{ monthLabel }}</span>
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          :disabled="isCurrentWeekSelected"
          @click="emit('go-today')"
        >
          Danas
        </v-btn>
      </div>
      <v-btn
        icon
        variant="text"
        size="small"
        aria-label="Sljedeća sedmica"
        @click="emit('shift-week', 1)"
      >
        <v-icon icon="mdi-chevron-right" />
      </v-btn>
    </div>

    <div class="day-strip">
      <button
        v-for="day in weekDays"
        :key="day.date"
        type="button"
        class="day-chip"
        :class="{ 'day-chip--selected': day.date === selectedDate }"
        @click="selectedDate = day.date"
      >
        <span class="day-chip-label">{{ day.label }}</span>
        <span class="day-chip-number">{{ day.dayNumber }}</span>
        <span class="day-chip-dot" :class="{ 'day-chip-dot--visible': day.hasAvailability }" />
      </button>
    </div>
  </v-card>
</template>

<script setup lang="ts">
export type WeekDay = {
  date: string;
  label: string;
  dayNumber: number;
  hasAvailability: boolean;
};

defineProps<{
  weekDays: WeekDay[];
  monthLabel: string;
  isCurrentWeekSelected: boolean;
}>();

const emit = defineEmits<{
  "shift-week": [direction: 1 | -1];
  "go-today": [];
}>();

const selectedDate = defineModel<string>("selectedDate", { required: true });
</script>

<style scoped>
.week-card {
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  padding: 18px;
}

.week-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.week-nav-center {
  display: flex;
  align-items: center;
  gap: 10px;
}

.week-month {
  font-weight: 700;
  color: #0b1220;
}

.day-strip {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-top: 14px;
}

.day-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 2px;
  border: none;
  border-radius: 14px;
  background: #f5f6f8;
  color: #0b1220;
  cursor: pointer;
  font: inherit;
}

.day-chip--selected {
  background: #0b1220;
  color: #fff;
}

.day-chip-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: capitalize;
  opacity: 0.8;
}

.day-chip-number {
  font-size: 1rem;
  font-weight: 800;
}

.day-chip-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
}

.day-chip-dot--visible {
  opacity: 0.8;
}
</style>
