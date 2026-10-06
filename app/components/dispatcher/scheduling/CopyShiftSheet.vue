<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Kopiraj smjenu"
    :subtitle="subtitle"
    :dirty="touched && !batch.finished.value"
    @update:open="emit('update:open', $event)"
    @submit="create"
  >
    <BatchResultNote
      v-if="batch.finished.value"
      :created="batch.createdTotal.value"
      :failed-count="batch.failed.value.length"
      :lines="batch.failLines(() => zoneName)"
      :skipped="batch.skipped.value"
    />
    <template v-else-if="shift">
      <div class="cs-f">
        <div class="cs-lb">Na dane</div>
        <ChipGroup :model-value="days" :options="options" label="Ciljni dani" @update:model-value="onDays" />
      </div>
      <div class="cs-sum" aria-live="polite">
        <span v-if="!days.length">Izaberi bar jedan dan.</span>
        <template v-else>
          <span><b>Napravit će se {{ smjena(plan.create.length) }}.</b></span>
          <span v-if="plan.dup">{{ plan.dup }} već {{ plan.dup === 1 ? "postoji" : "postoje" }} i preskače se.</span>
        </template>
      </div>
    </template>

    <template #footer>
      <template v-if="batch.finished.value">
        <div class="cs-actions">
          <AppButton :loading="batch.running.value" data-field="create-retry" @click="retry">
            Pokušaj ponovo ({{ batch.failed.value.length }})
          </AppButton>
          <AppButton variant="ghost" data-autofocus data-field="cs-done" @click="emit('update:open', false)">Zatvori</AppButton>
        </div>
      </template>
      <template v-else>
        <AppButton submit :loading="batch.running.value" :disabled="blocked" data-field="cs-do">{{ label }}</AppButton>
        <p>{{ days.length && !plan.create.length ? "Sve već postoji." : "" }}</p>
      </template>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import BatchResultNote from "~/components/dispatcher/scheduling/BatchResultNote.vue";
import ChipGroup, { type ChipOption } from "~/components/dispatcher/scheduling/ChipGroup.vue";
import { smjena, useShiftBatch, type BatchRunner } from "~/composables/useShiftBatch";
import {
  WD_SHORT,
  addDays,
  dayLong,
  expandCreate,
  fmtWinFull,
  iso,
  parseIso,
  wdIndex,
  type SchedShift,
} from "~/utils/schedule";
import type { ShiftTemplate } from "~/types/shiftTemplate";

// "Kopiraj na druge dane": isto vrijeme i kapacitet u istoj zoni, za izabrane dane sedmice ili isti dan
// sljedeće sedmice. Pregled kaže koliko se pravi i koliko već postoji.
const props = defineProps<{
  open: boolean;
  shift: SchedShift | null;
  zoneName: string;
  weekDates: string[];
  shifts: SchedShift[];
  run: BatchRunner;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [payload: { created: ShiftTemplate[]; count: number; skipped: number }];
}>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);
const batch = useShiftBatch((items, onProgress) => props.run(items, onProgress));
const days = ref<string[]>([]);
const touched = ref(false);
let allCreated: ShiftTemplate[] = [];

const subtitle = computed(() => {
  const s = props.shift;
  if (!s) return "";
  return `${props.zoneName} · ${fmtWinFull(s.start, s.end)} · kapacitet ${s.min}/${s.target}${s.max != null ? "/" + s.max : ""}`;
});

const nextWeekDay = computed(() => (props.shift ? iso(addDays(parseIso(props.shift.date), 7)) : ""));

const options = computed<ChipOption[]>(() => {
  const s = props.shift;
  if (!s) return [];
  return [
    ...props.weekDates
      .filter((d) => d !== s.date)
      .map((d) => ({
        value: d,
        label: `${WD_SHORT[wdIndex(parseIso(d))]} ${parseIso(d).getDate()}`,
        aria: dayLong(d),
      })),
    { value: nextWeekDay.value, label: "Isti dan sljedeće sedmice" },
  ];
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    batch.reset();
    allCreated = [];
    touched.value = false;
    days.value = props.weekDates.filter((d) => d !== props.shift?.date).slice(0, 4);
  },
  { immediate: true }
);

const onDays = (value: unknown) => {
  days.value = (value as string[]).slice().sort();
  touched.value = true;
};

const plan = computed(() => {
  const s = props.shift;
  if (!s) return { items: [], create: [], dup: 0, overlaps: 0, tooMany: false };
  return expandCreate(
    { days: days.value, zones: [s.zoneId], start: s.start, end: s.end, min: s.min, target: s.target, max: s.max, hot: s.hot },
    props.shifts
  );
});

const blocked = computed(() => !days.value.length || plan.value.create.length === 0 || plan.value.tooMany);
const label = computed(() =>
  batch.running.value
    ? `Kopiram ${batch.done.value} od ${batch.total.value}…`
    : plan.value.create.length
      ? `Kopiraj ${smjena(plan.value.create.length)}`
      : "Kopiraj"
);

const finish = () => {
  if (batch.failed.value.length) return;
  sheet.value?.closeNow();
  emit("done", { created: allCreated, count: batch.createdTotal.value, skipped: batch.skipped.value });
};
const create = async () => {
  if (batch.running.value || blocked.value) return;
  allCreated.push(...(await batch.start(plan.value.create, plan.value.dup)));
  finish();
};
const retry = async () => {
  if (batch.running.value) return;
  allCreated.push(...(await batch.retry()));
  finish();
};
</script>

<style scoped>
.cs-f {
  display: grid;
  gap: 6px;
}

.cs-lb {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.cs-sum {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.86rem;
  color: #5b6676;
}

.cs-sum b {
  color: #0b1220;
}

.cs-actions {
  display: grid;
  gap: 8px;
}
</style>
