<template>
  <DeliveryPage :max-width="640">
    <template #header>
      <PageHeader title="Radno vrijeme" back-to="/" back-label="Nazad na početnu" />
    </template>

    <div v-if="companiesLoading" class="panel-skeleton">
      <v-skeleton-loader type="card" />
    </div>

    <v-card v-else-if="companies.length === 0" class="no-company-card" flat>
      <p class="no-company-text">
        Niste aktivno vezani ni za jednu firmu za dostavu. Obratite se dispečeru.
      </p>
    </v-card>

    <template v-else>
      <GlobalSelect
        v-if="companies.length > 1"
        v-model="selectedCompanyId"
        :items="companyItems"
        item-title="name"
        item-value="id"
        label="Dostavna firma"
        class="mb-4"
        hide-details
      />

      <WeekDayStrip
        v-model:selected-date="selectedDate"
        :week-days="weekDays"
        :month-label="monthLabel"
        :is-current-week-selected="isCurrentWeekSelected"
        class="mb-4"
        @shift-week="shiftWeek"
        @go-today="goToday"
      />

      <div v-if="loading" class="panel-skeleton">
        <v-skeleton-loader type="card" />
      </div>
      <DayAvailabilityPanel
        v-else
        :date-label="selectedDateLabel"
        :available="selectedDay.available"
        :total-minutes="selectedDay.totalMinutes"
        :slots="selectedDay.slots"
        :saving="saving"
        :is-past-day="isPastDay"
        @toggle-available="onToggleAvailable"
        @remove-slot="onRemoveSlot"
        @add-slot="openAddDialog"
      />

      <AddTimeSlotDialog
        v-model:open="addDialogOpen"
        :saving="saving"
        :zones="zones"
        :zones-loading="zonesLoading"
        :overlap-error="addSlotError"
        :existing-slots="selectedDay.slots"
        @save="onSaveSlot"
      />
    </template>
  </DeliveryPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Radno vrijeme" });

import { computed, onMounted, ref, watch } from "vue";
import { useSessionStore } from "~/stores/session";
import PageHeader from "~/components/common/PageHeader.vue";
import DeliveryPage from "~/components/layout/DeliveryPage.vue";
import WeekDayStrip from "~/components/availability/WeekDayStrip.vue";
import DayAvailabilityPanel from "~/components/availability/DayAvailabilityPanel.vue";
import AddTimeSlotDialog from "~/components/availability/AddTimeSlotDialog.vue";
import { useCourierAvailability } from "~/composables/useCourierAvailability";
import { useCourierCompanies } from "~/composables/useCourierCompanies";
import { useCourierZones } from "~/composables/useCourierZones";
import { useConfirmStore } from "~/stores/confirm";

const sessionStore = useSessionStore();
const courierId = computed(() => Number(sessionStore.courierId));

const {
  companies,
  selectedCompanyId,
  loading: companiesLoading,
  load: loadCompanies,
} = useCourierCompanies(courierId);

const deliveryCompanyId = computed(() => selectedCompanyId.value);

// Nazivi firmi mogu biti ćirilicom - prikaži ih latinicom u biraču.
const companyItems = computed(() =>
  companies.value.map((company) => ({ ...company, name: toLatin(company.name) }))
);

const { zones, loading: zonesLoading, load: loadZones } = useCourierZones(
  courierId,
  deliveryCompanyId
);

const {
  days,
  loading,
  saving,
  refresh,
  dayFor,
  toggleDayAvailable,
  addSlot,
  removeSlot,
} = useCourierAvailability(courierId, deliveryCompanyId);

const capitalize = (text: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

// Ne oslanjamo se na Intl "bs-BA" - neki browseri nemaju puna ICU podaci za taj
// lokal i tiho padaju nazad na engleski/generički format (npr. "M08" umesto "avgust").
const WEEKDAY_SHORT = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const WEEKDAY_LONG = [
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedjelja",
];
const MONTH_LONG = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "juni",
  "juli",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
];
const mondayFirstIndex = (date: Date) => (date.getDay() === 0 ? 6 : date.getDay() - 1);

const parseIsoDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfWeek = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  result.setDate(result.getDate() + diff);
  return result;
};

const todayIso = toIsoDate(new Date());
const weekStart = ref(startOfWeek(new Date()));
const selectedDate = ref(todayIso);

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.value);
    date.setDate(date.getDate() + index);
    const iso = toIsoDate(date);
    const dayData = days.value.find((d) => d.date === iso);
    return {
      date: iso,
      label: WEEKDAY_SHORT[mondayFirstIndex(date)]!,
      dayNumber: date.getDate(),
      hasAvailability: Boolean(dayData?.available && dayData.slots.length > 0),
    };
  })
);

const monthLabel = computed(() => {
  const midWeek = new Date(weekStart.value);
  midWeek.setDate(midWeek.getDate() + 3);
  return `${capitalize(MONTH_LONG[midWeek.getMonth()] ?? "")} ${midWeek.getFullYear()}`;
});

const selectedDateLabel = computed(() => {
  const date = parseIsoDate(selectedDate.value);
  const weekday = WEEKDAY_LONG[mondayFirstIndex(date)];
  return `${weekday}, ${date.getDate()}. ${
    MONTH_LONG[date.getMonth()]
  } ${date.getFullYear()}.`;
});

const selectedDay = computed(() => dayFor(selectedDate.value));
const isPastDay = computed(() => selectedDate.value < todayIso);
const isCurrentWeekSelected = computed(
  () =>
    toIsoDate(weekStart.value) === toIsoDate(startOfWeek(new Date())) &&
    selectedDate.value === todayIso
);

const weekRange = computed(() => {
  const end = new Date(weekStart.value);
  end.setDate(end.getDate() + 6);
  return { from: toIsoDate(weekStart.value), to: toIsoDate(end) };
});

const loadWeek = () => refresh(weekRange.value.from, weekRange.value.to);

const shiftWeek = (direction: 1 | -1) => {
  const next = new Date(weekStart.value);
  next.setDate(next.getDate() + direction * 7);
  weekStart.value = next;
  selectedDate.value = toIsoDate(next);
};

const goToday = () => {
  weekStart.value = startOfWeek(new Date());
  selectedDate.value = todayIso;
};

const onToggleAvailable = (value: boolean) =>
  toggleDayAvailable(selectedDate.value, value);

const confirmStore = useConfirmStore();

const onRemoveSlot = async (slotId: number) => {
  const slot = selectedDay.value.slots.find((s) => s.id === slotId);
  try {
    await confirmStore.confirm(
      "Obriši termin",
      `Obrisati termin ${slot ? `${slot.startTime}–${slot.endTime}` : ""}?`,
      { color: "error" }
    );
    removeSlot(selectedDate.value, slotId);
  } catch {
    // Otkazano
  }
};

onMounted(loadCompanies);
watch(courierId, loadCompanies);

// Promjena izabrane firme (ili prva dodjela firme kad stigne odgovor iz
// koraka 1) ponovo učitava zone i raspored - podaci se ne miješaju između
// firmi (vidi Uputstvo_kurirski_raspored korak 1).
watch(deliveryCompanyId, () => {
  loadZones();
  loadWeek();
});
watch(weekRange, loadWeek);

const addDialogOpen = ref(false);
const addSlotError = ref<string | null>(null);

const openAddDialog = () => {
  addSlotError.value = null;
  addDialogOpen.value = true;
};

const onSaveSlot = async (payload: {
  zoneId: number | null;
  startTime: string;
  endTime: string;
}) => {
  addSlotError.value = null;
  const outcome = await addSlot(
    selectedDate.value,
    payload.zoneId,
    payload.startTime,
    payload.endTime
  );
  if (outcome.ok) {
    addDialogOpen.value = false;
  } else if (outcome.fieldError) {
    addSlotError.value = outcome.fieldError;
  }
};
</script>

<style scoped>
.panel-skeleton {
  border-radius: 24px;
}

.no-company-card {
  border-radius: 24px;
  padding: 24px;
  text-align: center;
}

.no-company-text {
  margin: 0;
  color: #6b7685;
}
</style>
