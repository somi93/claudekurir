<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Kopiraj raspored"
    :subtitle="v.mode === 'week' ? 'Cijela sedmica ili jedna zona' : 'Jedan dan na druge dane'"
    :dirty="touched && !weekResult && !batch.finished.value"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <!-- ishod kopiranja sedmice -->
    <TintAlert v-if="weekResult" tone="ok" role="alert" :title="`Napravljeno ${weekResult.created}`">
      Sve je kopirano u sedmicu {{ weekLabel(parseIso(weekResult.to)) }}.
      <template v-if="weekResult.skipped"><br />Preskočeno {{ weekResult.skipped }} jer već postoje.</template>
    </TintAlert>
    <!-- ishod kopiranja dana (djelimičan neuspjeh) -->
    <BatchResultNote
      v-else-if="batch.finished.value"
      :created="batch.createdTotal.value"
      :failed-count="batch.failed.value.length"
      :lines="batch.failLines(zoneName)"
      :skipped="batch.skipped.value"
    />

    <template v-else>
      <ChoiceGroup
        :model-value="v.mode"
        :options="[
          { value: 'week', label: 'Sedmicu' },
          { value: 'day', label: 'Dan' },
        ]"
        label="Šta se kopira"
        variant="pills"
        @update:model-value="setMode"
      />

      <template v-if="v.mode === 'week'">
        <div v-for="w in WEEK_PICKERS" :key="w.key" class="cp-f">
          <div class="cp-lb">{{ w.label }}</div>
          <div class="cp-wk">
            <button type="button" class="cp-arrow" :aria-label="`Prethodna sedmica: ${w.label}`" :data-field="`wk-${w.key}-minus`" @click="moveWeek(w.key, -1)">
              <v-icon icon="mdi-chevron-left" size="22" />
            </button>
            <div class="cp-wk-t">
              <b>{{ weekLabel(parseIso(v[w.key])) }}</b>
              <span>{{ weekCount(v[w.key]) }}</span>
            </div>
            <button type="button" class="cp-arrow" :aria-label="`Sljedeća sedmica: ${w.label}`" :data-field="`wk-${w.key}-plus`" @click="moveWeek(w.key, 1)">
              <v-icon icon="mdi-chevron-right" size="22" />
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="cp-f">
          <div class="cp-lb">Iz dana</div>
          <ChipGroup
            :model-value="v.from"
            :options="dayOptions"
            label="Izvorni dan"
            mode="single"
            layout="days"
            @update:model-value="setFrom"
          />
        </div>
        <div class="cp-f">
          <div class="cp-lb">Na dane</div>
          <ChipGroup
            :model-value="v.toDays"
            :options="dayOptions.filter((o) => o.value !== v.from)"
            label="Ciljni dani"
            layout="days"
            @update:model-value="setToDays"
          />
        </div>
      </template>

      <div class="cp-f">
        <label class="cp-lb" for="cp-zone">Zona</label>
        <div class="cp-sel">
          <select id="cp-zone" v-model="zoneModel" data-field="zoneId" @change="touched = true">
            <option value="">Sve zone</option>
            <option v-for="z in zones" :key="z.id" :value="String(z.id)">{{ z.name }}</option>
          </select>
          <v-icon icon="mdi-chevron-down" size="20" />
        </div>
      </div>

      <TintAlert v-if="notLoaded" tone="info">
        Smjene te sedmice nisu učitane. Pomjeri prikaz rasporeda na nju pa kopiraj.
      </TintAlert>

      <div v-else class="cp-sum" aria-live="polite">
        <template v-if="v.mode === 'week'">
          <b v-if="v.from === v.to" class="cp-bad">Izvorna i ciljna sedmica su iste.</b>
          <template v-else>
            <span><b>Kopira se {{ smjena(weekPlan.source) }}.</b></span>
            <span>
              Procjena: {{ weekPlan.create.length }} {{ plural(weekPlan.create.length, "se pravi", "se prave", "se pravi") }}, {{ weekPlan.dup }}
              već {{ weekPlan.dup === 1 ? "postoji" : "postoje" }} u ciljnoj sedmici i preskače se.
            </span>
            <span class="cp-small">Server preskače smjenu koja već postoji; tačno pravilo preskakanja nije dokumentovano.</span>
          </template>
        </template>
        <template v-else>
          <span v-if="!dayPlan.source"><b>{{ cap1(dayLong(v.from)) }} nema smjena.</b></span>
          <span v-else-if="!v.toDays.length">Izaberi bar jedan ciljni dan.</span>
          <template v-else>
            <span><b>Napravit će se {{ smjena(dayPlan.create.length) }}.</b></span>
            <span v-if="dayPlan.dup">{{ dayPlan.dup }} već {{ dayPlan.dup === 1 ? "postoji" : "postoje" }} i preskače se.</span>
            <span v-if="dayPlan.tooMany" class="cp-bad">Najviše {{ MAX_BATCH }} smjena odjednom.</span>
          </template>
        </template>
      </div>
    </template>

    <template #footer>
      <template v-if="weekResult">
        <div class="cp-actions">
          <AppButton data-autofocus data-field="cp-open" @click="openWeek">Otvori sedmicu</AppButton>
          <AppButton variant="ghost" data-field="cp-done" @click="emit('update:open', false)">Zatvori</AppButton>
        </div>
      </template>
      <template v-else-if="batch.finished.value">
        <div class="cp-actions">
          <AppButton :loading="batch.running.value" data-field="create-retry" @click="retry">
            Pokušaj ponovo ({{ batch.failed.value.length }})
          </AppButton>
          <AppButton variant="ghost" data-autofocus data-field="cp-done" @click="emit('update:open', false)">Zatvori</AppButton>
        </div>
      </template>
      <template v-else>
        <AppButton submit :loading="running" :disabled="blocked" data-field="copy-do">{{ buttonLabel }}</AppButton>
        <p>{{ footNote }}</p>
      </template>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup from "~/components/common/ChoiceGroup.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import BatchResultNote from "~/components/dispatcher/scheduling/BatchResultNote.vue";
import ChipGroup, { type ChipOption } from "~/components/dispatcher/scheduling/ChipGroup.vue";
import { smjena, useShiftBatch, type BatchRunner } from "~/composables/useShiftBatch";
import {
  MAX_BATCH,
  WD_SHORT,
  addDays,
  cap1,
  copyDayPlan,
  copyWeekPlan,
  dayLong,
  iso,
  mondayOf,
  parseIso,
  plural,
  weekIsos,
  weekLabel,
  type NamedZone,
  type SchedShift,
} from "~/utils/schedule";
import type { DuplicateWeekResult } from "~/types/shiftTemplate";
import type { ShiftTemplate } from "~/types/shiftTemplate";

// Kopiranje rasporeda: cijela sedmica (jedan poziv servera, pregled je procjena jer pravilo preskakanja nije
// dokumentovano) ili jedan dan na druge dane (N poziva kao nova smjena). Izvorna i ciljna sedmica se biraju
// koracima (uvijek ponedjeljak), a ishod kaže šta je stvarno napravljeno i nudi "Otvori sedmicu".
const props = defineProps<{
  open: boolean;
  initial: { mode: "week" | "day"; from?: string; to?: string };
  // Prikazana sedmica: njen ponedjeljak, sedam datuma i izabrani dan (telefon).
  weekMon: string;
  weekDates: string[];
  day: string;
  zones: NamedZone[];
  shifts: SchedShift[];
  // Raspon datuma za koji su smjene učitane (van njega pregled ne zna šta postoji).
  range: { from: string; to: string } | null;
  run: BatchRunner;
  duplicate: (payload: { source_week_start: string; target_week_start: string; zone_id: number | null }) => Promise<DuplicateWeekResult | null>;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  // Sedmica je kopirana (server): roditelj osvježava prozor smjena.
  "week-copied": [];
  "open-week": [mondayIso: string];
  done: [payload: { created: ShiftTemplate[]; count: number; skipped: number }];
}>();

const WEEK_PICKERS = [
  { key: "from", label: "Iz sedmice" },
  { key: "to", label: "U sedmicu" },
] as const;

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);
const batch = useShiftBatch((items, onProgress) => props.run(items, onProgress));
const touched = ref(false);
const weekRunning = ref(false);
const weekResult = ref<{ created: number; skipped: number; to: string } | null>(null);
let allCreated: ShiftTemplate[] = [];

const v = reactive<{ mode: "week" | "day"; from: string; to: string; toDays: string[]; zoneId: number | null }>({
  mode: "week",
  from: "",
  to: "",
  toDays: [],
  zoneId: null,
});

const zoneModel = computed({
  get: () => (v.zoneId == null ? "" : String(v.zoneId)),
  set: (value: string) => {
    v.zoneId = value ? Number(value) : null;
  },
});

const zoneName = (id: number) => props.zones.find((z) => z.id === id)?.name ?? `Zona #${id}`;
const running = computed(() => weekRunning.value || batch.running.value);

const otherDays = () => props.weekDates.filter((d) => d !== v.from).slice(0, 4);

const init = () => {
  batch.reset();
  allCreated = [];
  touched.value = false;
  weekResult.value = null;
  weekRunning.value = false;
  v.mode = props.initial.mode;
  v.zoneId = null;
  if (v.mode === "week") {
    v.from = props.initial.from ?? props.weekMon;
    v.to = props.initial.to ?? iso(addDays(parseIso(props.weekMon), 7));
    v.toDays = [];
  } else {
    v.from = props.initial.from ?? props.day;
    v.to = iso(addDays(parseIso(props.weekMon), 7));
    v.toDays = otherDays();
  }
};
watch(
  () => props.open,
  (open) => {
    if (open) init();
  },
  { immediate: true }
);

const setMode = (m: unknown) => {
  v.mode = m as "week" | "day";
  touched.value = true;
  if (v.mode === "day") {
    v.from = props.day;
    v.toDays = otherDays();
  } else {
    v.from = props.weekMon;
    v.to = iso(addDays(parseIso(props.weekMon), 7));
  }
};
const moveWeek = (key: "from" | "to", delta: number) => {
  v[key] = iso(addDays(parseIso(v[key]), delta * 7));
  touched.value = true;
};
const setFrom = (d: unknown) => {
  v.from = d as string;
  v.toDays = v.toDays.filter((x) => x !== v.from);
  touched.value = true;
};
const setToDays = (d: unknown) => {
  v.toDays = (d as string[]).slice().sort();
  touched.value = true;
};

const dayOptions = computed<ChipOption[]>(() =>
  props.weekDates.map((d, i) => ({ value: d, label: String(parseIso(d).getDate()), small: WD_SHORT[i] ?? "" }))
);

// Sedmica je učitana ako je cijela u rasponu smjena.
const inRange = (mondayIso: string) => {
  const r = props.range;
  if (!r) return false;
  return r.from <= mondayIso && iso(addDays(parseIso(mondayIso), 6)) <= r.to;
};
const weekCount = (mondayIso: string): string => {
  if (!inRange(mondayIso)) return "nije učitano";
  const dates = weekIsos(parseIso(mondayIso));
  return smjena(props.shifts.filter((s) => dates.includes(s.date)).length);
};

const notLoaded = computed(() =>
  v.mode === "week" ? !inRange(v.from) || !inRange(v.to) : !props.weekDates.includes(v.from)
);

const weekPlan = computed(() =>
  copyWeekPlan({
    src: props.shifts,
    tgt: props.shifts,
    srcMon: parseIso(v.from),
    tgtMon: parseIso(v.to),
    zoneId: v.zoneId,
  })
);
const dayPlan = computed(() =>
  copyDayPlan({ src: props.shifts, fromIso: v.from, toIsos: v.toDays, zoneId: v.zoneId, existing: props.shifts })
);

const blocked = computed(() =>
  notLoaded.value ||
  (v.mode === "week"
    ? v.from === v.to || weekPlan.value.create.length === 0
    : !v.toDays.length || dayPlan.value.tooMany || dayPlan.value.create.length === 0)
);
const buttonLabel = computed(() => {
  if (batch.running.value) return `Kopiram ${batch.done.value} od ${batch.total.value}…`;
  if (weekRunning.value) return "Kopiram…";
  const n = v.mode === "week" ? weekPlan.value.create.length : dayPlan.value.create.length;
  return n ? `Kopiraj ${smjena(n)}` : "Kopiraj";
});
const footNote = computed(() => {
  if (running.value || notLoaded.value) return "";
  if (v.mode === "week" && v.from === v.to) return "Izaberi dvije različite sedmice.";
  const p = v.mode === "week" ? weekPlan.value : dayPlan.value;
  if (p.create.length === 0) return p.source ? "Sve već postoji u cilju." : "Nema šta da se kopira.";
  return "";
});

const submit = async () => {
  if (running.value || blocked.value) return;
  if (v.mode === "week") {
    weekRunning.value = true;
    const result = await props.duplicate({
      source_week_start: v.from,
      target_week_start: v.to,
      zone_id: v.zoneId,
    });
    weekRunning.value = false;
    if (!result) return;
    weekResult.value = { created: result.createdCount, skipped: result.skippedCount, to: v.to };
    emit("week-copied");
    return;
  }
  allCreated.push(...(await batch.start(dayPlan.value.create, dayPlan.value.dup)));
  finishDay();
};
const retry = async () => {
  if (batch.running.value) return;
  allCreated.push(...(await batch.retry()));
  finishDay();
};
const finishDay = () => {
  if (batch.failed.value.length) return;
  sheet.value?.closeNow();
  emit("done", { created: allCreated, count: batch.createdTotal.value, skipped: batch.skipped.value });
};

const openWeek = () => {
  const to = weekResult.value?.to;
  sheet.value?.closeNow();
  if (to) emit("open-week", iso(mondayOf(parseIso(to))));
};
</script>

<style scoped>
.cp-f {
  display: grid;
  gap: 6px;
}

.cp-lb {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.cp-wk {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: stretch;
  gap: 4px;
}

.cp-arrow {
  display: grid;
  place-items: center;
  min-height: 52px;
  border: 0;
  border-radius: 14px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.cp-arrow:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.cp-wk-t {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 6px;
  border-radius: 14px;
  background: #f5f6f8;
  text-align: center;
}

.cp-wk-t b {
  font-size: 1rem;
}

.cp-wk-t span {
  font-size: 0.78rem;
  color: #5b6676;
}

.cp-sel {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 52px;
  border-radius: 14px;
  background: #f5f6f8;
}

.cp-sel select {
  flex: 1;
  min-width: 0;
  height: 52px;
  padding: 0 40px 0 14px;
  border: 0;
  border-radius: 14px;
  outline: 0;
  background: transparent;
  color: #0b1220;
  font: inherit;
  font-weight: 600;
  appearance: none;
  cursor: pointer;
}

.cp-sel select:focus-visible {
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.cp-sel :deep(.v-icon) {
  position: absolute;
  right: 12px;
  pointer-events: none;
}

.cp-sum {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.86rem;
  color: #5b6676;
}

.cp-sum b {
  color: #0b1220;
}

.cp-sum .cp-bad,
.cp-bad {
  color: #b42318;
  font-weight: 700;
}

.cp-small {
  font-size: 0.76rem;
}

.cp-actions {
  display: grid;
  gap: 8px;
}
</style>
