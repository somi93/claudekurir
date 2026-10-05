<template>
  <div>
    <v-card class="week-nav-card mb-4" flat>
      <div class="week-nav">
        <v-btn
          icon
          variant="text"
          size="small"
          aria-label="Prethodna sedmica"
          @click="shiftWeek(-1)"
        >
          <v-icon icon="mdi-chevron-left" />
        </v-btn>
        <div class="week-nav-center">
          <div class="week-nav-title">
            <span class="week-label">{{ weekLabel }}</span>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              class="flex-shrink-0"
              @click="goToday"
              >Ova sedmica</v-btn
            >
          </div>
          <span v-if="!shiftsLoading" class="week-summary">
            Smjena: {{ weekSummary.total
            }}<span v-if="weekSummary.understaffed > 0" class="week-summary-warn">
              · ispod minimuma: {{ weekSummary.understaffed }}</span
            >
          </span>
        </div>
        <v-btn
          icon
          variant="text"
          size="small"
          aria-label="Sljedeća sedmica"
          @click="shiftWeek(1)"
        >
          <v-icon icon="mdi-chevron-right" />
        </v-btn>
      </div>
      <div class="week-nav-actions">
        <GlobalSelect
          v-model="shiftsZoneFilter"
          :items="zoneFilterItems"
          item-title="title"
          item-value="value"
          label="Filtriraj po zoni"
          hide-details
          class="zone-filter"
          @update:model-value="loadShiftsWeek"
        />
        <v-btn
          variant="outlined"
          prepend-icon="mdi-content-copy"
          class="copy-week-btn"
          @click="duplicateDialogOpen = true"
        >
          Kopiraj za narednu sedmicu
        </v-btn>
      </div>
    </v-card>

    <div v-if="shiftsLoading" class="panel-skeleton">
      <v-skeleton-loader type="card" />
    </div>
    <ShiftWeekList
      v-else
      :week-days="weekDays"
      :templates-by-date="templatesByDate"
      :saving="shiftsSaving"
      @add-shift="openAddShift"
      @edit="openEditShift"
      @delete="requestDeleteShift"
    />

    <ShiftTemplateFormDialog
      v-model:open="shiftDialogOpen"
      :saving="shiftsSaving"
      :zones="zones"
      :date="shiftDialogDate"
      :default-zone-id="shiftDialogZoneId"
      :template="editingTemplate"
      @save="onShiftSave"
    />

    <DuplicateWeekDialog
      v-model:open="duplicateDialogOpen"
      :saving="shiftsSaving"
      :zones="zones"
      :default-source-week-start="weekStartIso"
      :default-target-week-start="nextWeekStartIso"
      @duplicate="onDuplicateWeek"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import ShiftWeekList from "~/components/dispatcher/scheduling/ShiftWeekList.vue";
import ShiftTemplateFormDialog from "~/components/dispatcher/scheduling/ShiftTemplateFormDialog.vue";
import DuplicateWeekDialog from "~/components/dispatcher/scheduling/DuplicateWeekDialog.vue";
import { useShiftTemplates } from "~/composables/useShiftTemplates";
import { useAlertStore } from "~/stores/alert";
import { useConfirmStore } from "~/stores/confirm";
import type { DispatcherZone } from "~/types/dispatcherZone";
import type { ShiftTemplate } from "~/types/shiftTemplate";

const props = defineProps<{
  companyId: number | null;
  zones: DispatcherZone[];
}>();

const alertStore = useAlertStore();
const confirmStore = useConfirmStore();
const companyId = computed(() => props.companyId);

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
const WEEKDAY_SHORT = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const mondayFirstIndex = (date: Date) => (date.getDay() === 0 ? 6 : date.getDay() - 1);

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

const weekStart = ref(startOfWeek(new Date()));
const weekStartIso = computed(() => toIsoDate(weekStart.value));
// Default za "Kopiraj za narednu sedmicu" - kopira trenutno prikazanu (već
// isplaniranu) sedmicu u narednu, ne obrnuto.
const nextWeekStartIso = computed(() => {
  const next = new Date(weekStart.value);
  next.setDate(next.getDate() + 7);
  return toIsoDate(next);
});

const weekRange = computed(() => {
  const end = new Date(weekStart.value);
  end.setDate(end.getDate() + 6);
  return { from: toIsoDate(weekStart.value), to: toIsoDate(end) };
});

const todayIso = toIsoDate(new Date());

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.value);
    date.setDate(date.getDate() + index);
    const iso = toIsoDate(date);
    return {
      date: iso,
      shortLabel: WEEKDAY_SHORT[mondayFirstIndex(date)]!,
      dayNumber: date.getDate(),
      isToday: iso === todayIso,
    };
  })
);

const weekLabel = computed(() => {
  const end = new Date(weekStart.value);
  end.setDate(end.getDate() + 6);
  return `${weekStart.value.getDate()}. ${
    MONTH_LONG[weekStart.value.getMonth()]
  } – ${end.getDate()}. ${MONTH_LONG[end.getMonth()]} ${end.getFullYear()}.`;
});

const shiftWeek = (direction: 1 | -1) => {
  const next = new Date(weekStart.value);
  next.setDate(next.getDate() + direction * 7);
  weekStart.value = next;
};

const goToday = () => {
  weekStart.value = startOfWeek(new Date());
};

const {
  templates,
  loading: shiftsLoading,
  saving: shiftsSaving,
  load: loadShiftTemplates,
  create: createShift,
  updateCapacity: updateShiftCapacity,
  remove: removeShift,
  duplicateWeek: duplicateWeekShifts,
} = useShiftTemplates(companyId);

const shiftsZoneFilter = ref<number | null>(null);

const zoneFilterItems = computed(() => [
  { title: "Sve zone", value: null },
  ...props.zones.map((zone) => ({ title: toLatin(zone.name), value: zone.id })),
]);

const loadShiftsWeek = () =>
  loadShiftTemplates(weekRange.value.from, weekRange.value.to, shiftsZoneFilter.value);

const templatesByDate = computed(() => {
  const grouped: Record<string, ShiftTemplate[]> = {};
  for (const template of templates.value) {
    (grouped[template.date] ??= []).push(template);
  }
  return grouped;
});

// Pregled sedmice na prvi pogled - koliko smjena i koliko ih je ispod minimuma
// (glavni radni zadatak dispečera je da "ispod minimuma" spusti na nulu).
const weekSummary = computed(() => ({
  total: templates.value.length,
  understaffed: templates.value.filter((t) => t.status === "understaffed").length,
}));

const shiftDialogOpen = ref(false);
const shiftDialogDate = ref("");
const shiftDialogZoneId = ref<number | null>(null);
const editingTemplate = ref<ShiftTemplate | null>(null);

const openAddShift = ({ date, zoneId }: { date: string; zoneId: number | null }) => {
  editingTemplate.value = null;
  shiftDialogDate.value = date;
  shiftDialogZoneId.value = zoneId;
  shiftDialogOpen.value = true;
};

const openEditShift = (template: ShiftTemplate) => {
  editingTemplate.value = template;
  shiftDialogDate.value = template.date;
  shiftDialogOpen.value = true;
};

const onShiftSave = async (payload: {
  zoneId: number | null;
  startTime: string;
  endTime: string;
  minCouriers: number;
  targetCouriers: number;
  maxCouriers: number | null;
  highDemand: boolean;
}) => {
  if (!companyId.value) return;

  const ok = editingTemplate.value
    ? await updateShiftCapacity(editingTemplate.value.id, {
        min_couriers: payload.minCouriers,
        target_couriers: payload.targetCouriers,
        max_couriers: payload.maxCouriers,
        high_demand: payload.highDemand,
      })
    : await createShift({
        zone_id: payload.zoneId!,
        delivery_company_id: companyId.value,
        date: shiftDialogDate.value,
        start_time: payload.startTime,
        end_time: payload.endTime,
        min_couriers: payload.minCouriers,
        target_couriers: payload.targetCouriers,
        max_couriers: payload.maxCouriers,
        high_demand: payload.highDemand,
      });

  if (ok) {
    shiftDialogOpen.value = false;
    // Od 01.09 (odgovor 2.1) store()/update() vraćaju IDENTIČAN pun red kao
    // index() (zone: {id, name}, HH:MM, status/current_bookings) - composable
    // optimistički ubaci/zamijeni red, re-fetch cijele sedmice više ne treba.
  }
};

const requestDeleteShift = async (template: ShiftTemplate) => {
  try {
    await confirmStore.confirm(
      "Obriši smjenu",
      `Obrisati smjenu "${toLatin(template.zone.name)}", ${template.startTime}–${template.endTime}?`,
      { color: "error" }
    );
    await removeShift(template.id);
  } catch {
    // Otkazano
  }
};

const duplicateDialogOpen = ref(false);

const onDuplicateWeek = async (payload: {
  sourceWeekStart: string;
  targetWeekStart: string;
  zoneId: number | null;
}) => {
  const result = await duplicateWeekShifts({
    source_week_start: payload.sourceWeekStart,
    target_week_start: payload.targetWeekStart,
    zone_id: payload.zoneId,
  });
  if (!result) return;
  alertStore.success(
    `Kreirano ${result.createdCount}, preskočeno ${result.skippedCount} smjena.`
  );
  duplicateDialogOpen.value = false;
  loadShiftsWeek();
};

onMounted(loadShiftsWeek);
watch(companyId, loadShiftsWeek);
watch(weekRange, loadShiftsWeek);
</script>

<style scoped>
.week-nav-card {
  border-radius: 20px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.week-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.week-nav-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.week-nav-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.week-label {
  font-weight: 700;
}

.week-summary {
  font-size: 0.78rem;
  color: #6b7685;
}

.week-summary-warn {
  color: #d1383d;
  font-weight: 700;
}

.week-nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.zone-filter {
  max-width: 240px;
}

@media (max-width: 600px) {
  .week-nav {
    flex-wrap: wrap;
    justify-content: center;
  }

  .week-nav-center {
    order: -1;
    width: 100%;
    justify-content: center;
    text-align: center;
  }

  .week-label {
    font-size: 0.9rem;
  }

  .week-nav-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .zone-filter {
    max-width: none;
  }

  .copy-week-btn {
    width: 100%;
  }
}

.panel-skeleton {
  border-radius: 20px;
}
</style>
