<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Nova smjena"
    :subtitle="`Sedmica ${weekLabel}`"
    :dirty="touched && !batch.finished.value"
    @update:open="emit('update:open', $event)"
    @submit="create"
  >
    <BatchResultNote
      v-if="batch.finished.value"
      :created="batch.createdTotal.value"
      :failed-count="batch.failed.value.length"
      :lines="batch.failLines(zoneName)"
      :skipped="batch.skipped.value"
    />

    <template v-else>
      <div class="cr-f">
        <div class="cr-lb">
          Dani
          <button type="button" class="cr-link" data-field="days-work" @click="setDays('work')">Radni dani</button>
          <button type="button" class="cr-link" data-field="days-all" @click="setDays('all')">Cijela sedmica</button>
        </div>
        <ChipGroup
          :model-value="v.days"
          :options="dayOptions"
          label="Dani"
          layout="days"
          @update:model-value="onDays"
        />
      </div>

      <div class="cr-f">
        <div class="cr-lb">
          Zone
          <button type="button" class="cr-link" data-field="zones-all" @click="setZones(zones.map((z) => z.id))">Sve zone</button>
        </div>
        <ChipGroup
          :model-value="v.zones"
          :options="zones.map((z) => ({ value: z.id, label: z.name }))"
          label="Zone"
          @update:model-value="onZones"
        />
      </div>

      <div class="cr-f">
        <div class="cr-lb">Vrijeme</div>
        <ChipGroup
          :model-value="v.preset"
          :options="presetOptions"
          label="Uobičajena vremena"
          mode="single"
          @update:model-value="onPreset"
        />
      </div>

      <div class="cr-two">
        <StepperField v-model="v.start" label="Početak" name="start" :message="msg('start')" @step="stepTime('start', $event)" @update:model-value="onTime" />
        <StepperField v-model="v.end" label="Kraj" name="end" :message="msg('end')" @step="stepTime('end', $event)" @update:model-value="onTime" />
      </div>

      <div class="cr-cap">
        <StepperField v-model="v.min" label="Najmanje kurira" name="min" :message="msg('min')" @step="stepNum('min', $event)" @update:model-value="onNum" />
        <StepperField v-model="v.target" label="Cilj" name="target" :message="msg('target')" @step="stepNum('target', $event)" @update:model-value="onNum" />
        <StepperField
          v-model="v.max"
          label="Najviše"
          name="max"
          optional
          placeholder="Bez ograničenja"
          :message="msg('max')"
          @step="stepNum('max', $event)"
          @update:model-value="onNum"
        />
      </div>

      <SettingSwitch v-model="v.hot" name="hot" label="Hitna smjena" hint="Gužva ili smjena koju je teško pokriti." @update:model-value="touched = true" />

      <div class="cr-sum" aria-live="polite">
        <span v-if="!v.zones.length">Izaberi bar jednu zonu.</span>
        <span v-else-if="!v.days.length">Izaberi bar jedan dan.</span>
        <template v-else>
          <span>
            <b>{{ v.days.length }} {{ plural(v.days.length, "dan", "dana", "dana") }} × {{ v.zones.length }} {{ plural(v.zones.length, "zona", "zone", "zona") }} = {{ smjena(plan.items.length) }}</b>
          </span>
          <span v-if="plan.dup">{{ plan.dup }} već {{ plan.dup === 1 ? "postoji" : "postoje" }} i preskače se.</span>
          <span v-if="plan.overlaps">{{ plan.overlaps }} se preklapa sa postojećom smjenom u istoj zoni (dozvoljeno, ali provjeri).</span>
          <span v-if="plan.tooMany" class="cr-bad">Najviše {{ MAX_BATCH }} smjena odjednom. Smanji broj dana ili zona.</span>
        </template>
      </div>
    </template>

    <template #footer>
      <template v-if="batch.finished.value">
        <div class="cr-actions">
          <AppButton :loading="batch.running.value" data-field="create-retry" @click="retry">
            Pokušaj ponovo ({{ batch.failed.value.length }})
          </AppButton>
          <AppButton variant="ghost" data-autofocus data-field="create-done" @click="emit('update:open', false)">Zatvori</AppButton>
        </div>
      </template>
      <template v-else>
        <AppButton submit :loading="batch.running.value" :disabled="blocked" data-field="create-do">{{ buttonLabel }}</AppButton>
        <p>{{ note }}</p>
      </template>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SettingSwitch from "~/components/common/SettingSwitch.vue";
import BatchResultNote from "~/components/dispatcher/scheduling/BatchResultNote.vue";
import ChipGroup, { type ChipOption } from "~/components/dispatcher/scheduling/ChipGroup.vue";
import StepperField from "~/components/dispatcher/scheduling/StepperField.vue";
import { smjena, useShiftBatch, type BatchRunner } from "~/composables/useShiftBatch";
import {
  MAX_BATCH,
  WD_SHORT,
  expandCreate,
  fmtWin,
  parseIso,
  parseTime,
  plural,
  presetWindows,
  stepTime as stepClock,
  validateShift,
  type NamedZone,
  type SchedShift,
} from "~/utils/schedule";
import type { FieldMsg } from "~/utils/profileForm";
import type { ShiftTemplate } from "~/types/shiftTemplate";

// Nova smjena: jedna smjena za više dana i zona odjednom (dani × zone), sa vremenima koja firma već koristi kao
// prečice, koracima za kapacitet i živim zbirom (koliko se pravi, koliko već postoji, koliko se preklapa).
// Server nema poziv za više smjena, pa se pravi N poziva (do 4 istovremeno, najviše 60); pad nekih ostavlja
// ishod u listu sa "Pokušaj ponovo" samo za neuspjele.
const props = defineProps<{
  open: boolean;
  // Sedam datuma prikazane sedmice i njen naziv.
  weekDates: string[];
  weekLabel: string;
  zones: NamedZone[];
  shifts: SchedShift[];
  // Šta je izabrano pri otvaranju (ćelija: jedna zona i dan; dugme: izabrana zona i dan).
  initial: { zones: number[]; days: string[] };
  run: BatchRunner;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  done: [payload: { created: ShiftTemplate[]; count: number; skipped: number }];
}>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);
const batch = useShiftBatch((items, onProgress) => props.run(items, onProgress));
const touched = ref(false);
let allCreated: ShiftTemplate[] = [];

type Preset = number | "custom";
const v = reactive<{
  days: string[];
  zones: number[];
  preset: Preset;
  start: string;
  end: string;
  min: string;
  target: string;
  max: string;
  hot: boolean;
}>({ days: [], zones: [], preset: "custom", start: "09:00", end: "17:00", min: "1", target: "1", max: "", hot: false });

const zoneName = (id: number) => props.zones.find((z) => z.id === id)?.name ?? `Zona #${id}`;

// Prečice: najčešća vremena zone (ako je izabrana jedna zona koja ima smjene), inače cijele firme.
const presets = computed(() => {
  const inZones = props.shifts.filter((s) => v.zones.includes(s.zoneId));
  const base = v.zones.length === 1 && inZones.length ? inZones : props.shifts;
  return presetWindows(base, 4);
});
const presetOptions = computed<ChipOption[]>(() => [
  ...presets.value.map((p, i) => ({ value: i, label: fmtWin(p.start, p.end), small: `${p.count}×` })),
  { value: "custom", label: "Drugo" },
]);
const dayOptions = computed<ChipOption[]>(() =>
  props.weekDates.map((d, i) => ({
    value: d,
    label: String(parseIso(d).getDate()),
    small: WD_SHORT[i] ?? "",
  }))
);

const applyPreset = (index: number) => {
  const p = presets.value[index];
  if (!p) return;
  v.preset = index;
  v.start = p.start;
  v.end = p.end;
  v.min = String(p.min);
  v.target = String(p.target);
  v.max = p.max == null ? "" : String(p.max);
};

const init = () => {
  batch.reset();
  allCreated = [];
  touched.value = false;
  v.zones = [...props.initial.zones];
  v.days = props.initial.days.length ? [...props.initial.days] : [props.weekDates[0] ?? ""];
  v.hot = false;
  if (presets.value.length) applyPreset(0);
  else Object.assign(v, { preset: "custom", start: "09:00", end: "17:00", min: "1", target: "1", max: "" });
};
watch(
  () => props.open,
  (open) => {
    if (open) init();
  },
  { immediate: true }
);

const onDays = (value: unknown) => {
  v.days = (value as string[]).slice().sort();
  touched.value = true;
};
const setDays = (kind: "work" | "all") => {
  v.days = kind === "work" ? props.weekDates.slice(0, 5) : props.weekDates.slice();
  touched.value = true;
};
const setZones = (ids: number[]) => {
  v.zones = ids;
  touched.value = true;
  // Prečice zavise od izabranih zona: ako je izabrana prečica, vrijednosti se osvježe.
  if (v.preset !== "custom") applyPreset(Math.min(Number(v.preset), Math.max(0, presets.value.length - 1)));
};
const onZones = (value: unknown) => setZones(value as number[]);
const onPreset = (value: unknown) => {
  touched.value = true;
  if (value === "custom") v.preset = "custom";
  else applyPreset(Number(value));
};
const onTime = () => {
  touched.value = true;
  v.preset = "custom";
};
const onNum = () => {
  touched.value = true;
  for (const k of ["min", "target", "max"] as const) {
    const clean = v[k].replace(/[^\d]/g, "");
    if (clean !== v[k]) v[k] = clean;
  }
};
const stepTime = (field: "start" | "end", delta: number) => {
  const base = parseTime(v[field]) == null ? (field === "start" ? "09:00" : "17:00") : v[field];
  v[field] = stepClock(base, delta * 15) ?? base;
  onTime();
};
const stepNum = (field: "min" | "target" | "max", delta: number) => {
  const cur = v[field] === "" ? (field === "max" ? Number(v.target) || 1 : 1) : Number(v[field]);
  let next = Math.max(1, (Number.isFinite(cur) ? cur : 1) + delta);
  if (field === "max" && v.max === "" && delta < 0) next = Number(v.target) || 1;
  v[field] = String(next);
  touched.value = true;
};

const errors = computed(() =>
  validateShift({ start: v.start, end: v.end, min: v.min, target: v.target, max: v.max === "" ? null : v.max })
);
const msg = (f: "start" | "end" | "min" | "target" | "max"): FieldMsg | null =>
  errors.value[f] ? { tone: "bad", text: errors.value[f]! } : null;

const plan = computed(() =>
  expandCreate(
    {
      days: v.days,
      zones: v.zones,
      start: v.start,
      end: v.end,
      min: Number(v.min),
      target: Number(v.target),
      max: v.max === "" ? null : Number(v.max),
      hot: v.hot,
    },
    props.shifts
  )
);

const blocked = computed(
  () =>
    Object.keys(errors.value).length > 0 ||
    !v.days.length ||
    !v.zones.length ||
    plan.value.tooMany ||
    plan.value.create.length === 0
);
const buttonLabel = computed(() =>
  batch.running.value
    ? `Pravim ${batch.done.value} od ${batch.total.value}…`
    : plan.value.create.length > 1
      ? `Napravi ${smjena(plan.value.create.length)}`
      : "Napravi smjenu"
);
const note = computed(() =>
  batch.running.value
    ? ""
    : plan.value.create.length === 0 && v.days.length && v.zones.length
      ? "Sve izabrane smjene već postoje."
      : blocked.value
        ? "Provjeri polja iznad."
        : ""
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
.cr-f {
  display: grid;
  gap: 6px;
}

.cr-lb {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.cr-link {
  min-height: 44px;
  margin: -8px 0;
  padding: 0 8px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.cr-link:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 8px;
}

.cr-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cr-cap {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.cr-sum {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.86rem;
  color: #5b6676;
}

.cr-sum b {
  color: #0b1220;
}

.cr-bad {
  color: #b42318;
  font-weight: 700;
}

.cr-actions {
  display: grid;
  gap: 8px;
}

@media (max-width: 559px) {
  .cr-cap {
    grid-template-columns: 1fr;
  }

  .cr-two {
    gap: 8px;
  }
}
</style>
