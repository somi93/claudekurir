<template>
  <AppSheet
    ref="sheet"
    :open="open"
    :title="title"
    :subtitle="subtitle"
    :dirty="dirty"
    @update:open="emit('update:open', $event)"
    @submit="save"
  >
    <template v-if="shift && decorated">
      <div class="ss-big">
        <div class="ss-top">
          <span class="ss-num">{{ shift.booked }}<i> od {{ shift.target }} kurira</i></span>
          <ShiftPill :tone="TONE[decorated.status]">{{ decorated.phase === "past" ? "Završeno" : STATUS[decorated.status].label }}</ShiftPill>
        </div>
        <CoverageMeter
          :booked="shift.booked"
          :min="shift.min"
          :target="shift.target"
          :max="shift.max"
          :color="STATUS_COLOR[decorated.status]"
          size="lg"
        />
        <div class="ss-leg">
          <span><i />Min {{ shift.min }}</span>
          <span><i />Cilj {{ shift.target }}</span>
          <span v-if="shift.max != null">Maks {{ shift.max }}</span>
        </div>
        <div class="ss-need">{{ decorated.phase === "past" ? "Smjena je završena." : need(shift) }}</div>
      </div>

      <TintAlert v-if="decorated.phase === 'live'" tone="info">
        Smjena je u toku, još {{ inText(mm(shift.end) - now.min) }}.
      </TintAlert>

      <div class="ss-cap">
        <StepperField v-model="v.min" label="Najmanje kurira" name="min" :message="msg('min')" @step="step('min', $event)" />
        <StepperField v-model="v.target" label="Cilj" name="target" :message="msg('target')" @step="step('target', $event)" />
        <StepperField
          v-model="v.max"
          label="Najviše"
          name="max"
          optional
          placeholder="Bez ograničenja"
          :message="msg('max')"
          @step="step('max', $event)"
        />
      </div>
      <p v-if="preview" class="ss-preview" aria-live="polite">{{ preview }}</p>

      <SettingSwitch
        v-model="v.hot"
        name="hot"
        label="Hitna smjena"
        hint="Označava smjenu u kojoj je gužva ili je kuriri teško pokrivaju."
      />

      <div class="ss-list">
        <SettingRow
          v-if="canAsk"
          interactive
          icon="mdi-bullhorn-outline"
          tone="blue"
          label="Traži kurire"
          value="Priprema poruku sa potrebnim brojem; šalješ je na ekranu Poruke"
          wrap
          data-field="r-ask"
          @click="emit('ask', shift.id)"
        />
        <SettingRow
          interactive
          icon="mdi-content-copy"
          label="Kopiraj na druge dane"
          value="Isto vrijeme i kapacitet u istoj zoni"
          wrap
          data-field="r-copy"
          @click="emit('copy', shift.id)"
        />
        <SettingRow
          interactive
          icon="mdi-delete-outline"
          tone="bad"
          label="Obriši smjenu"
          :value="shift.booked ? `Ima ${shift.booked} potvrđenih kurira` : 'Nema potvrđenih kurira'"
          wrap
          data-field="r-del"
          @click="emit('delete', shift.id)"
        />
      </div>
    </template>

    <template #footer>
      <AppButton submit :loading="saving" :disabled="!dirty || hasErrors" data-field="shift-save">Sačuvaj</AppButton>
      <p>{{ saving ? "" : hasErrors ? "Provjeri polja iznad." : dirty ? "" : "Nema izmjena." }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SettingRow from "~/components/common/SettingRow.vue";
import SettingSwitch from "~/components/common/SettingSwitch.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import CoverageMeter from "~/components/dispatcher/scheduling/CoverageMeter.vue";
import ShiftPill from "~/components/dispatcher/scheduling/ShiftPill.vue";
import StepperField from "~/components/dispatcher/scheduling/StepperField.vue";
import {
  STATUS,
  STATUS_COLOR,
  cap1,
  dayLong,
  decorate,
  fmtWinFull,
  inText,
  mm,
  missing,
  need,
  statusOf,
  validateShift,
  type Clock,
  type SchedShift,
} from "~/utils/schedule";
import type { FieldMsg } from "~/utils/profileForm";
import type { ShiftTemplateCapacityPayload } from "~/types/shiftTemplate";

// Smjena: koliko je potvrđeno naspram minimuma i cilja (veliki mjerač + "Fale još N"), izmjena kapaciteta
// sa koracima i živim pregledom šta bi smjena bila, hitna smjena, i radnje (traži kurire, kopiraj na druge
// dane, obriši). Vrijeme i zona se ne mijenjaju (server mijenja samo kapacitet): za to se smjena briše i
// pravi nova.
const props = defineProps<{
  open: boolean;
  shift: SchedShift | null;
  zoneName: string;
  now: Clock;
  saving: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [id: number, payload: ShiftTemplateCapacityPayload];
  ask: [id: number];
  copy: [id: number];
  delete: [id: number];
}>();

const TONE = { understaffed: "bad", below_target: "warn", target_reached: "ok", full: "blue" } as const;

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);
const v = reactive({ min: "", target: "", max: "", hot: false });
const orig = reactive({ min: "", target: "", max: "", hot: false });

const decorated = computed(() => (props.shift ? decorate(props.shift, props.now) : null));
const title = computed(() => (props.shift ? `${props.zoneName} · ${fmtWinFull(props.shift.start, props.shift.end)}` : ""));
const subtitle = computed(() =>
  props.shift ? cap1(dayLong(props.shift.date)) + (props.shift.hot ? " · hitna smjena" : "") : ""
);
const canAsk = computed(() => !!props.shift && decorated.value?.phase !== "past" && missing(props.shift) > 0);

const fill = () => {
  const s = props.shift;
  if (!s) return;
  Object.assign(v, { min: String(s.min), target: String(s.target), max: s.max == null ? "" : String(s.max), hot: s.hot });
  Object.assign(orig, v);
};
// Ponovo se puni samo pri otvaranju: izmjena iz drugog izvora ne smije da pregazi ono što se kuca.
watch(
  () => [props.open, props.shift?.id] as const,
  ([open]) => {
    if (open) fill();
  },
  { immediate: true }
);

const dirty = computed(() => (["min", "target", "max", "hot"] as const).some((k) => v[k] !== orig[k]));

const errors = computed(() => {
  const s = props.shift;
  if (!s) return {};
  const e = validateShift({ start: s.start, end: s.end, min: v.min, target: v.target, max: v.max === "" ? null : v.max });
  delete e.start;
  delete e.end;
  return e;
});
const hasErrors = computed(() => Object.keys(errors.value).length > 0);
const msg = (f: "min" | "target" | "max"): FieldMsg | null =>
  errors.value[f] ? { tone: "bad", text: errors.value[f]! } : null;

// Samo cifre; polje se ne može napuniti slovima.
watch(
  () => [v.min, v.target, v.max] as const,
  () => {
    for (const k of ["min", "target", "max"] as const) {
      const clean = v[k].replace(/[^\d]/g, "");
      if (clean !== v[k]) v[k] = clean;
    }
  }
);

const step = (field: "min" | "target" | "max", delta: number) => {
  const cur = v[field] === "" ? (field === "max" ? Number(v.target) || 1 : 1) : Number(v[field]);
  let next = Math.max(1, (Number.isFinite(cur) ? cur : 1) + delta);
  if (field === "max" && v.max === "" && delta < 0) next = Number(v.target) || 1;
  v[field] = String(next);
};

const preview = computed(() => {
  const s = props.shift;
  if (!s || hasErrors.value || !dirty.value) return "";
  const status = statusOf(Number(v.min), Number(v.target), v.max === "" ? null : Number(v.max), s.booked);
  return `Sa ovim kapacitetom smjena bi bila: ${STATUS[status].label} (${s.booked} od ${v.target}).`;
});

const save = () => {
  if (!props.shift || !dirty.value || hasErrors.value || props.saving) return;
  emit("save", props.shift.id, {
    min_couriers: Number(v.min),
    target_couriers: Number(v.target),
    max_couriers: v.max === "" ? null : Number(v.max),
    high_demand: v.hot,
  });
};

defineExpose({ closeNow: () => sheet.value?.closeNow() });
</script>

<style scoped>
.ss-big {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  background: #f5f6f8;
}

.ss-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.ss-num {
  font-size: 1.9rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.ss-num i {
  font-size: 1.1rem;
  font-style: normal;
  font-weight: 600;
  color: #5b6676;
}

.ss-leg {
  display: flex;
  gap: 14px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #5b6676;
}

.ss-leg span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ss-leg i {
  display: inline-block;
  width: 2px;
  height: 12px;
  border-radius: 1px;
  background: #0b1220;
}

.ss-need {
  font-size: 0.88rem;
  font-weight: 700;
}

.ss-cap {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.ss-preview {
  margin: -4px 0 0;
  font-size: 0.8rem;
  color: #5b6676;
}

.ss-list {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

@media (max-width: 559px) {
  .ss-cap {
    grid-template-columns: 1fr;
  }
}
</style>
