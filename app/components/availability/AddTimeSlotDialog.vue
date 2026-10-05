<template>
  <FormDialog
    v-model:open="open"
    title="Novi termin"
    :saving="saving"
    max-width="420"
    @save="submit"
  >
    <GlobalSelect
      v-model="zoneId"
      label="Zona"
      :items="zoneItems"
      item-title="title"
      item-value="value"
      :loading="zonesLoading"
      hide-details="auto"
    >
      <template #item="{ item, props: itemProps }">
        <v-list-item v-bind="itemProps" :title="undefined">
          <template #title>
            <span class="d-flex align-center ga-1">
              {{ item.raw.title }}
              <v-tooltip
                v-if="!item.raw.vehicleSuitable"
                :text="item.raw.note ?? 'Vozilo možda nije pogodno za ovu zonu'"
                location="top"
              >
                <template #activator="{ props: tooltipProps }">
                  <v-icon
                    v-bind="tooltipProps"
                    icon="mdi-alert"
                    color="warning"
                    size="18"
                  />
                </template>
              </v-tooltip>
            </span>
          </template>
        </v-list-item>
      </template>
    </GlobalSelect>

    <GlobalTimePicker
      v-model="startTime"
      label="Početak"
      :rules="[rules.required()]"
      hide-details="auto"
      :min="startBounds.min"
      :max="startBounds.max"
      :allowed-hours="isHourAvailable"
    />

    <GlobalTimePicker
      v-model="endTime"
      label="Kraj"
      :rules="[rules.required(), endAfterStart, noOverlap]"
      hide-details="auto"
      :min="endBounds.min"
      :max="endBounds.max"
    />

    <p v-if="overlapError" class="overlap-error">{{ overlapError }}</p>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import GlobalTimePicker from "~/components/common/GlobalTimePicker.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import type { Zone } from "~/types/zone";

const DEFAULT_START = "09:00";
const DEFAULT_DURATION_MINUTES = 60;
const DAY_START = "00:00";
const DAY_END = "23:59";
const FLEXIBLE_ZONE_LABEL = "Svejedno mi je gdje radim";

const props = defineProps<{
  saving: boolean;
  zones: Zone[];
  zonesLoading: boolean;
  overlapError: string | null;
  existingSlots: { startTime: string; endTime: string }[];
}>();

const emit = defineEmits<{
  save: [payload: { zoneId: number | null; startTime: string; endTime: string }];
}>();

const open = defineModel<boolean>("open", { required: true });

const rules = useValidationRules();

const zoneId = ref<number | null>(null);
const startTime = ref(DEFAULT_START);
const endTime = ref(DEFAULT_START);

const zoneItems = computed(() => [
  {
    title: FLEXIBLE_ZONE_LABEL,
    value: null,
    vehicleSuitable: true,
    note: null as string | null,
  },
  ...props.zones.map((zone) => ({
    title: toLatin(zone.name),
    value: zone.id,
    vehicleSuitable: zone.vehicleSuitable,
    note: zone.note,
  })),
]);

const sortedSlots = computed(() =>
  [...props.existingSlots].sort((a, b) => a.startTime.localeCompare(b.startTime))
);

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(
    2,
    "0"
  )}`;

// Vrijeme koje se dodaje mora u cjelosti stati u jedan slobodan prostor između
// postojećih termina - ne smije preklapati nijedan od njih.
const freeWindow = (time: string) => {
  let min = DAY_START;
  let max = DAY_END;
  for (const slot of sortedSlots.value) {
    if (slot.endTime <= time) {
      min = slot.endTime;
    } else if (slot.startTime >= time) {
      max = slot.startTime;
      break;
    } else {
      // Vrijeme upada unutar postojećeg termina.
      min = time;
      max = time;
      break;
    }
  }
  return { min, max };
};

// Početak smije biti bilo gdje u toku dana - jedino ograničenje je da ne upada
// u postojeći termin i da nije poslije kraja. Ne smije se vezati za "prazninu"
// oko trenutno izabranog početka, jer bi to onemogućilo skok u drugi slobodan
// dio dana (npr. sa 09-17 zauzeto na 04-06 ujutru).
const startBounds = computed(() => ({ min: DAY_START, max: endTime.value }));

// Kraj mora ostati u istoj slobodnoj praznini kao početak - ne smije "preskočiti"
// preko sledećeg postojećeg termina.
const endBounds = computed(() => {
  const gap = freeWindow(startTime.value);
  return { min: startTime.value, max: gap.max };
});

// Sat je nedostupan ako se ijednim dijelom preklapa sa postojećim terminom.
const isHourAvailable = (hour: number) => {
  const hourStart = hour * 60;
  const hourEnd = hourStart + 60;
  return !sortedSlots.value.some((slot) => {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    return slotStart < hourEnd && slotEnd > hourStart;
  });
};

const endAfterStart = (value: string) => {
  if (!value || !startTime.value) return true;
  return value > startTime.value || "Kraj mora biti poslije početka.";
};

const noOverlap = (value: string) => {
  if (!value || !startTime.value) return true;
  const overlaps = sortedSlots.value.some(
    (slot) => startTime.value < slot.endTime && value > slot.startTime
  );
  return !overlaps || "Termin se preklapa sa postojećim terminom.";
};

// Pronalazi prvi slobodan prostor od početka dana dovoljno dug za podrazumevano
// trajanje termina, preskačući postojeće termine za taj dan.
const findDefaultTimes = () => {
  let cursor = timeToMinutes(DEFAULT_START);
  for (const slot of sortedSlots.value) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    if (cursor + DEFAULT_DURATION_MINUTES <= slotStart) break;
    if (slotEnd > cursor) cursor = slotEnd;
  }
  const end = Math.min(cursor + DEFAULT_DURATION_MINUTES, timeToMinutes(DAY_END));
  return { start: minutesToTime(cursor), end: minutesToTime(end) };
};

// Kad se početak promijeni tako da trenutni kraj više ne staje u slobodnu
// prazninu (prije početka ili preskače preko sledećeg termina), pomjeri kraj
// nazad u važeći opseg umjesto da ostane nevidljivo neispravan do submit-a.
watch(startTime, () => {
  const bounds = endBounds.value;
  if (endTime.value < bounds.min) {
    endTime.value = bounds.min;
  } else if (endTime.value > bounds.max) {
    endTime.value = bounds.max;
  }
});

// Svako otvaranje dijaloga kreće od čistih podrazumevanih vrednosti - dijalog
// ne pamti prethodno uneti termin.
watch(open, (isOpen) => {
  if (!isOpen) return;
  zoneId.value = null;
  const defaults = findDefaultTimes();
  startTime.value = defaults.start;
  endTime.value = defaults.end;
});

const submit = () => {
  emit("save", {
    zoneId: zoneId.value,
    startTime: startTime.value,
    endTime: endTime.value,
  });
};
</script>

<style scoped>
.overlap-error {
  margin: -8px 0 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-error));
}
</style>
