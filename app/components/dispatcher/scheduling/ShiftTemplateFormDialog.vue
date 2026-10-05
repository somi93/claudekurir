<template>
  <FormDialog
    v-model:open="open"
    :title="template ? 'Kapacitet smjene' : 'Nova smjena'"
    :saving="saving"
    :editing="!!template"
    @save="submit"
  >
    <GlobalTextField
      :model-value="formattedDate"
      label="Datum"
      readonly
      prepend-inner-icon="mdi-calendar-outline"
      hide-details="auto"
    />

    <template v-if="!template">
      <GlobalSelect
        v-model="zoneId"
        label="Zona"
        :items="zoneItems"
        item-title="title"
        item-value="value"
        :rules="[rules.required()]"
        hide-details="auto"
      />

      <GlobalTimePicker
        v-model="startTime"
        label="Početak"
        :rules="[rules.required()]"
        hide-details="auto"
      />

      <GlobalTimePicker
        v-model="endTime"
        label="Kraj"
        :rules="[rules.required(), endAfterStart]"
        hide-details="auto"
      />
    </template>

    <template v-else>
      <GlobalTextField
        :model-value="toLatin(template.zone?.name ?? '')"
        label="Zona"
        readonly
        prepend-inner-icon="mdi-map-marker-outline"
        hint="Zona se ne može mijenjati — obriši smjenu i napravi novu."
        persistent-hint
        hide-details="auto"
      />

      <div class="time-row">
        <GlobalTextField
          :model-value="template.startTime"
          label="Početak"
          readonly
          prepend-inner-icon="mdi-clock-outline"
          hide-details="auto"
        />
        <GlobalTextField
          :model-value="template.endTime"
          label="Kraj"
          readonly
          prepend-inner-icon="mdi-clock-outline"
          hide-details="auto"
        />
      </div>
    </template>

    <GlobalTextField
      v-model.number="minCouriers"
      label="Min. kurira"
      type="number"
      :rules="[rules.required(), rules.positiveInteger()]"
      hide-details="auto"
    />

    <GlobalTextField
      v-model.number="targetCouriers"
      label="Ciljani broj kurira"
      type="number"
      :rules="[rules.required(), rules.positiveInteger(), targetAtLeastMin]"
      hide-details="auto"
    />

    <GlobalTextField
      v-model.number="maxCouriers"
      label="Maks. kurira (opciono)"
      type="number"
      clearable
      :rules="[maxAtLeastTarget]"
      hide-details="auto"
    />

    <v-switch v-model="highDemand" color="warning" label="Hitna smjena" hide-details />
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import GlobalTimePicker from "~/components/common/GlobalTimePicker.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import type { DispatcherZone } from "~/types/dispatcherZone";
import type { ShiftTemplate } from "~/types/shiftTemplate";

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";
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

const props = defineProps<{
  saving: boolean;
  zones: DispatcherZone[];
  date: string;
  // Predpopunjena zona kad se "Nova smjena" otvara iz ćelije rota tabele.
  defaultZoneId?: number | null;
  template: ShiftTemplate | null;
}>();

const emit = defineEmits<{
  save: [
    payload: {
      zoneId: number | null;
      startTime: string;
      endTime: string;
      minCouriers: number;
      targetCouriers: number;
      maxCouriers: number | null;
      highDemand: boolean;
    },
  ];
}>();

const open = defineModel<boolean>("open", { required: true });

const rules = useValidationRules();

const zoneId = ref<number | null>(null);
const zoneItems = computed(() =>
  props.zones.map((zone) => ({ title: toLatin(zone.name), value: zone.id }))
);
const startTime = ref(DEFAULT_START);
const endTime = ref(DEFAULT_END);
const minCouriers = ref(1);
const targetCouriers = ref(1);
const maxCouriers = ref<number | null>(null);
const highDemand = ref(false);

const formattedDate = computed(() => {
  const [year, month, day] = props.date.split("-").map(Number);
  if (!year || !month || !day) return props.date;
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAY_LONG[date.getDay() === 0 ? 6 : date.getDay() - 1];
  return `${weekday}, ${date.getDate()}. ${MONTH_LONG[date.getMonth()]} ${date.getFullYear()}.`;
});

const endAfterStart = (value: string) => {
  if (!value || !startTime.value) return true;
  return value > startTime.value || "Kraj mora biti poslije početka.";
};

const targetAtLeastMin = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return true;
  return num >= minCouriers.value || "Cilj mora biti bar jednak minimumu.";
};

const maxAtLeastTarget = (value: unknown) => {
  if (value === null || value === "" || value === undefined) return true;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) return "Unesi ceo broj veći ili jednak 1.";
  return num >= targetCouriers.value || "Maksimum mora biti bar jednak cilju.";
};

// Svako otvaranje kreće od čistih vrijednosti (create) ili od vrijednosti
// smjene koja se izmjenjuje (edit) - dijalog ne pamti prethodni unos.
watch(open, (isOpen) => {
  if (!isOpen) return;
  if (props.template) {
    minCouriers.value = props.template.minCouriers;
    targetCouriers.value = props.template.targetCouriers;
    maxCouriers.value = props.template.maxCouriers;
    highDemand.value = props.template.highDemand;
  } else {
    zoneId.value = props.defaultZoneId ?? null;
    startTime.value = DEFAULT_START;
    endTime.value = DEFAULT_END;
    minCouriers.value = 1;
    targetCouriers.value = 1;
    maxCouriers.value = null;
    highDemand.value = false;
  }
});

const submit = () => {
  emit("save", {
    zoneId: zoneId.value,
    startTime: startTime.value,
    endTime: endTime.value,
    minCouriers: minCouriers.value,
    targetCouriers: targetCouriers.value,
    maxCouriers: maxCouriers.value,
    highDemand: highDemand.value,
  });
};
</script>

<style scoped>
.time-row {
  display: flex;
  gap: 12px;
}

.time-row > * {
  flex: 1;
}
</style>
