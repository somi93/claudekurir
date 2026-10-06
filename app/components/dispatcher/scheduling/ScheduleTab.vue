<template>
  <div class="st">
    <!-- sedmica i radnje -->
    <div class="st-tool" :class="{ 'st-tool--phone': !wide }">
      <div class="st-wk" role="group" aria-label="Sedmica">
        <button type="button" class="st-ib" aria-label="Prethodna sedmica" data-field="wk-prev" @click="view.shiftWeek(-1)">
          <v-icon icon="mdi-chevron-left" size="24" />
        </button>
        <span class="st-lab" aria-live="polite" data-field="wk-label">{{ weekLabel(parseIso(view.weekMon.value)) }}</span>
        <button type="button" class="st-ib" aria-label="Sljedeća sedmica" data-field="wk-next" @click="view.shiftWeek(1)">
          <v-icon icon="mdi-chevron-right" size="24" />
        </button>
        <button v-if="!view.isCurrentWeek.value" type="button" class="st-btn" data-field="wk-today" @click="view.setWeek(null)">
          Ova sedmica
        </button>
      </div>
      <div v-if="wide" class="st-acts">
        <button type="button" class="st-btn" data-field="copy" @click="openCopy()">
          <v-icon icon="mdi-content-copy" size="18" />Kopiraj…
        </button>
        <button type="button" class="st-btn st-btn--pri" data-field="new" @click="openCreate()">
          <v-icon icon="mdi-plus" size="20" />Nova smjena
        </button>
      </div>
    </div>

    <!-- učitavanje -->
    <div v-if="data.state.value === 'loading' || zonesState === 'loading'" class="st-skel" aria-busy="true" aria-label="Učitavam smjene">
      <template v-if="wide">
        <div class="st-skel-grid">
          <div class="st-sk" style="height: 62px" />
          <div v-for="r in 4" :key="r" class="st-skel-row">
            <div class="st-sk" style="height: 18px; width: 70%" />
            <div v-for="c in 7" :key="c" class="st-sk" style="height: 54px" />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="st-sk" style="height: 64px" />
        <div v-for="r in 3" :key="r" class="st-sk" style="height: 96px; border-radius: 16px" />
      </template>
    </div>

    <!-- greška: u mjestu sadržaja, prazna mreža bi izgledala kao sedmica bez smjena -->
    <TintAlert v-else-if="data.state.value === 'error'" tone="bad" role="alert" title="Ne mogu da učitam smjene">
      {{ data.errorReason.value || "Server ne odgovara." }} Sedmica {{ weekLabel(parseIso(view.weekMon.value)) }} nije prikazana,
      jer bi prazna mreža izgledala kao da nema smjena.
      <template #action>
        <button type="button" data-field="retry" @click="data.retry()">Pokušaj ponovo</button>
      </template>
    </TintAlert>

    <TintAlert v-else-if="zonesState === 'error'" tone="bad" role="alert" title="Ne mogu da učitam zone">
      {{ zonesReason || "Server ne odgovara." }} Bez zona se raspored ne može prikazati.
      <template #action>
        <button type="button" data-field="retry-zones" @click="emit('retry-zones')">Pokušaj ponovo</button>
      </template>
    </TintAlert>

    <TintAlert v-else-if="zonesState === 'nocity'" tone="warn" title="Firma nema grad">
      Zone pripadaju gradu firme, pa se raspored ne može prikazati dok se grad ne postavi na tabu Pravila.
    </TintAlert>

    <template v-else>
      <TintAlert v-if="!zones.length" tone="info" title="Nema zona">
        Smjene se prave po zonama. Napravi prvu zonu na tabu Zone, pa planiraj smjene.
        <template #action>
          <button type="button" data-field="go-zones" @click="emit('go-zones')">Otvori Zone</button>
        </template>
      </TintAlert>

      <TintAlert v-if="weekEmpty" tone="info" title="Ova sedmica nema nijednu smjenu">
        <template v-if="prevCount">
          Prethodna sedmica ima {{ smjena(prevCount) }}. Možeš je kopirati i zatim izmijeniti ono što treba.
        </template>
        <template v-else>Dodaj prvu smjenu ili kopiraj plan sa druge sedmice.</template>
        <template v-if="prevCount" #action>
          <button type="button" data-field="copy-prev" @click="openCopyPrev">
            Kopiraj sedmicu {{ weekLabel(addDays(parseIso(view.weekMon.value), -7)) }}
          </button>
        </template>
      </TintAlert>

      <!-- filteri -->
      <div class="st-fbar" :class="{ 'st-fbar--scroll': !wide }" role="group" aria-label="Filter smjena">
        <button
          v-for="p in pills"
          :key="p.key"
          type="button"
          class="st-fp"
          :class="{ 'st-fp--bad': p.key === 'understaffed' }"
          :aria-pressed="view.filter.value === p.key"
          :data-filter="p.key"
          @click="view.setFilter(p.key)"
        >
          <span v-if="p.color" class="st-dot" :style="{ background: p.color }" />{{ p.label }} <span class="st-n">{{ p.count }}</span>
        </button>
        <template v-if="wide">
          <label class="st-sel">
            <span class="sr">Zona</span>
            <select :value="view.zoneId.value ?? ''" aria-label="Zona" data-field="zone-filter" @change="onZone">
              <option value="">Sve zone</option>
              <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
            </select>
            <v-icon icon="mdi-chevron-down" size="18" />
          </label>
          <button type="button" class="st-btn st-btn--sm" :disabled="!problems.length" data-field="next-problem" @click="nextProblem">
            <v-icon icon="mdi-arrow-right" size="18" />Sljedeći problem{{ problems.length ? ` · ${problems.length}` : "" }}
          </button>
        </template>
      </div>
      <div v-if="!wide" class="st-fbar">
        <label class="st-sel">
          <span class="sr">Zona</span>
          <select :value="view.zoneId.value ?? ''" aria-label="Zona" data-field="zone-filter" @change="onZone">
            <option value="">Sve zone</option>
            <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
          </select>
          <v-icon icon="mdi-chevron-down" size="18" />
        </label>
        <button type="button" class="st-btn st-btn--sm" :disabled="!problems.length" data-field="next-problem" @click="nextProblem">
          <v-icon icon="mdi-arrow-right" size="18" />Sljedeći problem{{ problems.length ? ` · ${problems.length}` : "" }}
        </button>
      </div>
      <p class="sr" aria-live="polite" data-live>{{ liveMsg }}</p>

      <ScheduleGrid
        v-if="wide && zones.length"
        :model="model"
        :now="now"
        :sel-cell="selCell"
        :sel-shift="selShift"
        :flash="flash"
        :empty-open="emptyOpen"
        :zone-filtered="view.zoneId.value != null"
        @cell="onCell"
        @shift="openShift"
        @toggle-empty="emptyOpen = !emptyOpen"
      />
      <ScheduleDayList
        v-else-if="!wide && zones.length"
        :model="model"
        :day="view.day.value"
        :sel-shift="selShift"
        :flash="flash"
        @day="view.setDay"
        @shift="openShift"
        @new="openCreate()"
        @copy-day="openCopy('day')"
      />

      <div v-if="!wide && zones.length" class="st-bottom">
        <AppButton icon="mdi-plus" data-field="new" @click="openCreate()">Nova smjena</AppButton>
        <button type="button" class="st-copy" aria-label="Kopiraj" data-field="copy" @click="openCopy()">
          <v-icon icon="mdi-content-copy" size="20" />
        </button>
      </div>
    </template>

    <!-- listovi -->
    <CellSheet
      :open="sheetType === 'cell'"
      :zone-name="zoneName(cellZoneId)"
      :date="cellDate"
      :shifts="cellShifts"
      @update:open="onSheetOpen"
      @shift="openShift"
      @add="openCreate({ zones: [cellZoneId], days: [cellDate] })"
    />
    <ShiftSheet
      :open="sheetType === 'shift'"
      :shift="sheetShift"
      :zone-name="sheetShift ? zoneName(sheetShift.zoneId) : ''"
      :now="now"
      :saving="data.saving.value"
      @update:open="onSheetOpen"
      @save="saveShift"
      @ask="openAsk"
      @copy="openCopyShift"
      @delete="openDelete"
    />
    <DeleteShiftSheet
      :open="sheetType === 'delete'"
      :shift="sheetShift"
      :zone-name="sheetShift ? zoneName(sheetShift.zoneId) : ''"
      :saving="data.saving.value"
      @update:open="onSheetOpen"
      @confirm="removeShift"
    />
    <AskCouriersSheet
      :open="sheetType === 'ask'"
      :shift="sheetShift"
      :zone-name="sheetShift ? zoneName(sheetShift.zoneId) : ''"
      :now="now"
      @update:open="onSheetOpen"
      @go="goAsk"
    />
    <CreateShiftsSheet
      :open="sheetType === 'create'"
      :week-dates="view.dates.value"
      :week-label="weekLabel(parseIso(view.weekMon.value))"
      :zones="zones"
      :shifts="data.shifts.value"
      :initial="createInitial"
      :run="run"
      @update:open="onSheetOpen"
      @done="onCreated"
    />
    <CopyScheduleSheet
      :open="sheetType === 'copy'"
      :initial="copyInitial"
      :week-mon="view.weekMon.value"
      :week-dates="view.dates.value"
      :day="view.day.value"
      :zones="zones"
      :shifts="data.shifts.value"
      :range="data.range.value"
      :run="run"
      :duplicate="data.duplicateWeek"
      @update:open="onSheetOpen"
      @week-copied="data.refreshQuiet()"
      @open-week="onOpenWeek"
      @done="onCreated"
    />
    <CopyShiftSheet
      :open="sheetType === 'copyshift'"
      :shift="sheetShift"
      :zone-name="sheetShift ? zoneName(sheetShift.zoneId) : ''"
      :week-dates="view.dates.value"
      :shifts="data.shifts.value"
      :run="run"
      @update:open="onSheetOpen"
      @done="onCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { navigateTo } from "nuxt/app";
import AppButton from "~/components/common/AppButton.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import AskCouriersSheet from "~/components/dispatcher/scheduling/AskCouriersSheet.vue";
import CellSheet from "~/components/dispatcher/scheduling/CellSheet.vue";
import CopyScheduleSheet from "~/components/dispatcher/scheduling/CopyScheduleSheet.vue";
import CopyShiftSheet from "~/components/dispatcher/scheduling/CopyShiftSheet.vue";
import CreateShiftsSheet from "~/components/dispatcher/scheduling/CreateShiftsSheet.vue";
import DeleteShiftSheet from "~/components/dispatcher/scheduling/DeleteShiftSheet.vue";
import ScheduleDayList from "~/components/dispatcher/scheduling/ScheduleDayList.vue";
import ScheduleGrid from "~/components/dispatcher/scheduling/ScheduleGrid.vue";
import ShiftSheet from "~/components/dispatcher/scheduling/ShiftSheet.vue";
import { smjena, type BatchRunner } from "~/composables/useShiftBatch";
import type { ScheduleData } from "~/composables/useScheduleData";
import type { ScheduleView } from "~/composables/useScheduleView";
import { useAlertStore } from "~/stores/alert";
import { DEFAULT_SELECTION } from "~/utils/messageAudience";
import { serializeDraft } from "~/utils/messageDraft";
import { writeStored } from "~/utils/deviceStorage";
import {
  addDays,
  askDraft,
  dayLong,
  decorate,
  fmtWin,
  iso,
  parseIso,
  weekIsos,
  weekLabel,
  weekModel,
  type Clock,
  type DecoratedShift,
  type NamedZone,
  type ShiftFilter,
} from "~/utils/schedule";
import type { ShiftTemplate, ShiftTemplateCapacityPayload } from "~/types/shiftTemplate";

// Tab "Raspored": sedmica u mreži (računar) ili pregled po danu (telefon), filter po statusu i zoni, "Sljedeći
// problem" i listovi za izmjenu, pravljenje (dani × zone), kopiranje i brisanje smjena. Problem je prvi: smjene
// ispod minimuma se broje, filtriraju i obilaze; završena smjena je sivo "Završeno".
const props = defineProps<{
  data: ScheduleData;
  view: ScheduleView;
  zones: NamedZone[];
  zonesState: "loading" | "error" | "nocity" | "ok";
  zonesReason: string;
  now: Clock;
  wide: boolean;
  companyId: number | null;
}>();

const emit = defineEmits<{ "go-zones": []; "retry-zones": [] }>();

const alertStore = useAlertStore();

// --- model sedmice ---------------------------------------------------------------------------
const model = computed(() =>
  weekModel({
    shifts: props.data.shifts.value,
    zones: props.zones,
    dates: props.view.dates.value,
    now: props.now,
    zoneId: props.view.zoneId.value,
    filter: props.view.filter.value,
  })
);
// Brojevi na pilulama su za cijelu sedmicu (bez filtera zone), da se ne mijenjaju kad se izabere zona.
const plain = computed(() =>
  weekModel({ shifts: props.data.shifts.value, zones: props.zones, dates: props.view.dates.value, now: props.now })
);
const weekEmpty = computed(() => plain.value.total === 0 && props.view.zoneId.value == null && props.zones.length > 0);
const prevCount = computed(() => {
  const prev = weekIsos(addDays(parseIso(props.view.weekMon.value), -7));
  return props.data.shifts.value.filter((s) => prev.includes(s.date)).length;
});

const pills = computed(() => {
  const c = plain.value.counts;
  const list: { key: ShiftFilter; label: string; count: number; color: string | null }[] = [
    { key: "all", label: "Sve", count: c.all, color: null },
    { key: "understaffed", label: "Ispod minimuma", count: c.understaffed, color: "#e5484d" },
    { key: "below_target", label: "Ispod cilja", count: c.below_target, color: "#e08a14" },
    { key: "target_reached", label: "Cilj", count: c.target_reached, color: "#1f9d6b" },
    { key: "full", label: "Popunjeno", count: c.full, color: "#2f6fed" },
  ];
  return list;
});

const zoneName = (id: number | null) => props.zones.find((z) => z.id === id)?.name ?? (id == null ? "" : `Zona #${id}`);

// --- "Sljedeći problem": smjene ispod minimuma u cijelom učitanom prozoru, redom po vremenu -----------
const problems = computed<DecoratedShift[]>(() =>
  props.data.shifts.value
    .map((s) => decorate(s, props.now))
    .filter((s) => s.phase !== "past" && s.status === "understaffed")
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id))
);

const liveMsg = ref("");
const nextProblem = async () => {
  const list = problems.value;
  if (!list.length) return;
  const i = list.findIndex((s) => s.id === selShift.value);
  const idx = (i + 1) % list.length;
  const s = list[idx]!;
  selShift.value = s.id;
  selCell.value = null;
  props.view.goTo(s.date, !props.wide);
  const when = s.date === props.now.date ? "danas" : dayLong(s.date);
  liveMsg.value = `Problem ${idx + 1} od ${list.length}: ${zoneName(s.zoneId)}, ${when} ${fmtWin(s.start, s.end)}, ${s.booked} od ${s.target}, ispod minimuma.`;
  await nextTick();
  await nextTick();
  document.querySelector<HTMLElement>(`[data-shift-id="${s.id}"]`)?.scrollIntoView({ block: "center", inline: "nearest" });
};

const onZone = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  props.view.setZone(value ? Number(value) : null);
};

// --- izbor i isticanje -----------------------------------------------------------------------
const selShift = ref<number | null>(null);
const selCell = ref<string | null>(null);
const emptyOpen = ref(false);
const flash = ref(new Set<number>());
const flashShifts = (ids: number[]) => {
  flash.value = new Set([...flash.value, ...ids]);
  setTimeout(() => {
    const next = new Set(flash.value);
    ids.forEach((id) => next.delete(id));
    flash.value = next;
  }, 1600);
};

// --- listovi ---------------------------------------------------------------------------------
type Sheet =
  | { type: "cell"; zoneId: number; date: string }
  | { type: "shift"; id: number }
  | { type: "delete"; id: number }
  | { type: "ask"; id: number }
  | { type: "copyshift"; id: number }
  | { type: "create"; zones: number[]; days: string[] }
  | { type: "copy"; mode: "week" | "day"; from?: string; to?: string };

const sheet = ref<Sheet | null>(null);
const sheetType = computed(() => sheet.value?.type ?? null);
// Zadnji poznati sadržaj (da list ne pokazuje prazno dok se zatvara).
const last = ref<{ cell: { zoneId: number; date: string } | null; shiftId: number | null }>({ cell: null, shiftId: null });

const cellZoneId = computed(() => (sheet.value?.type === "cell" ? sheet.value.zoneId : (last.value.cell?.zoneId ?? 0)));
const cellDate = computed(() => (sheet.value?.type === "cell" ? sheet.value.date : (last.value.cell?.date ?? props.view.dates.value[0] ?? "")));
const cellShifts = computed(() =>
  props.data.shifts.value
    .filter((s) => s.zoneId === cellZoneId.value && s.date === cellDate.value)
    .map((s) => decorate(s, props.now))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id)
);

const sheetShiftId = computed(() => {
  const s = sheet.value;
  return s && "id" in s ? s.id : last.value.shiftId;
});
const sheetShift = computed(
  () =>
    props.data.shifts.value.find((s) => s.id === sheetShiftId.value) ??
    props.data.todayShifts.value.find((s) => s.id === sheetShiftId.value) ??
    null
);

const createInitial = ref<{ zones: number[]; days: string[] }>({ zones: [], days: [] });
const copyInitial = ref<{ mode: "week" | "day"; from?: string; to?: string }>({ mode: "week" });

// Fokus se vraća na ono što je list otvorilo (ćelija, pločica ili dugme), i kad list zamijeni drugi list.
let opener = "";
const rememberOpener = () => {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return;
  const cell = el.closest<HTMLElement>("[data-cell]");
  const tile = el.closest<HTMLElement>("[data-shift-id]");
  if (cell) opener = `[data-cell="${cell.dataset.cell}"]`;
  else if (tile) opener = `[data-shift-id="${tile.dataset.shiftId}"]`;
  else if (el.dataset.field) opener = `[data-field="${el.dataset.field}"]`;
  else if (el.dataset.day) opener = `[data-day="${el.dataset.day}"]`;
};

const show = (next: Sheet) => {
  if (!sheet.value) rememberOpener();
  if (next.type === "cell") last.value.cell = { zoneId: next.zoneId, date: next.date };
  if ("id" in next) last.value.shiftId = next.id;
  sheet.value = next;
};

const closeSheet = () => {
  sheet.value = null;
  if (!opener) return;
  const sel = opener;
  void nextTick(() => {
    requestAnimationFrame(() => {
      if (sheet.value) return;
      const active = document.activeElement;
      if (!active || active === document.body) document.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true });
    });
  });
};
const onSheetOpen = (open: boolean) => {
  if (!open) closeSheet();
};

const openShift = (id: number) => {
  selShift.value = id;
  selCell.value = null;
  show({ type: "shift", id });
};
const onCell = (zoneId: number, date: string) => {
  selCell.value = `${zoneId}|${date}`;
  const has = props.data.shifts.value.some((s) => s.zoneId === zoneId && s.date === date);
  if (has) show({ type: "cell", zoneId, date });
  else openCreate({ zones: [zoneId], days: [date] });
};
const openCreate = (pre?: { zones: number[]; days: string[] }) => {
  createInitial.value = pre ?? {
    zones: props.view.zoneId.value ? [props.view.zoneId.value] : [],
    days: [props.wide ? (props.view.isCurrentWeek.value ? props.now.date : (props.view.dates.value[0] ?? "")) : props.view.day.value],
  };
  show({ type: "create", zones: createInitial.value.zones, days: createInitial.value.days });
};
const openCopy = (mode: "week" | "day" = "week") => {
  copyInitial.value = { mode };
  show({ type: "copy", mode });
};
const openCopyPrev = () => {
  copyInitial.value = {
    mode: "week",
    from: iso(addDays(parseIso(props.view.weekMon.value), -7)),
    to: props.view.weekMon.value,
  };
  show({ type: "copy", mode: "week", from: copyInitial.value.from, to: copyInitial.value.to });
};
const openAsk = (id: number) => show({ type: "ask", id });
const openCopyShift = (id: number) => show({ type: "copyshift", id });
const openDelete = (id: number) => show({ type: "delete", id });

// --- radnje ----------------------------------------------------------------------------------
const run: BatchRunner = (items, onProgress) =>
  props.data.createMany(items, props.companyId ?? 0, onProgress);

const saveShift = async (id: number, payload: ShiftTemplateCapacityPayload) => {
  if (await props.data.updateCapacity(id, payload)) {
    closeSheet();
    flashShifts([id]);
  }
};
const removeShift = async () => {
  const id = sheetShiftId.value;
  if (id == null) return;
  if (await props.data.remove(id)) {
    selShift.value = null;
    opener = "";
    sheet.value = null;
  }
};

const onCreated = (payload: { created: ShiftTemplate[]; count: number; skipped: number }) => {
  closeSheet();
  const first = payload.created[0];
  if (first && !payload.created.some((c) => props.view.dates.value.includes(c.date))) {
    props.view.goTo(first.date, !props.wide);
  }
  flashShifts(payload.created.map((c) => c.id));
  alertStore.success(
    `Napravljeno ${smjena(payload.count)}${payload.skipped ? `, preskočeno ${payload.skipped} (već postoje)` : ""}.`
  );
};

const onOpenWeek = (mondayIso: string) => {
  closeSheet();
  props.view.setWeek(mondayIso);
};

// "Traži kurire": nacrt ide u isti ključ koji koristi ekran Poruke; slanje se potvrđuje tamo.
defineExpose({ openShift, openAsk });

const goAsk = async () => {
  const s = sheetShift.value;
  if (!s || !props.companyId) return;
  const draft = askDraft(s, zoneName(s.zoneId), props.now);
  writeStored(
    "local",
    `poruke-nacrt-${props.companyId}`,
    serializeDraft({ category: draft.category, title: draft.title, body: draft.body }, DEFAULT_SELECTION, Date.now())
  );
  sheet.value = null;
  opener = "";
  await navigateTo("/dispatcher/notifications");
};

</script>

<style scoped>
.st {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.st-tool {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 12px;
}

.st-tool--phone {
  display: grid;
}

.st-wk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.st-lab {
  min-width: 0;
  padding: 0 4px;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-align: center;
}

.st-ib {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.st-ib:focus-visible,
.st-btn:focus-visible,
.st-fp:focus-visible,
.st-copy:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.st-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.st-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.st-btn:hover {
  background: #f7f8fa;
}

.st-btn--pri {
  border-color: #0b1220;
  background: #0b1220;
  color: #fff;
  box-shadow: 0 6px 16px -6px rgba(11, 18, 32, 0.5);
}

.st-btn--pri:hover {
  background: #1b2638;
}

.st-btn--sm {
  padding: 0 14px;
}

.st-btn:disabled {
  border-color: #e2e5ea;
  background: #f5f6f8;
  color: #5b6676;
  box-shadow: none;
  cursor: not-allowed;
}

.st-fbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.st-fbar--scroll {
  flex-wrap: nowrap;
  margin: 0 -12px;
  padding: 2px 12px;
  overflow-x: auto;
  scrollbar-width: none;
}

.st-fbar--scroll::-webkit-scrollbar {
  display: none;
}

.st-fp {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #e2e5ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.st-fp:hover {
  border-color: #c7ccd4;
}

.st-fp[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.st-n {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.st-fp--bad[aria-pressed="false"] .st-n {
  color: #b42318;
}

.st-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.st-sel {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px 0 14px;
  border: 1.5px solid #e2e5ea;
  border-radius: 999px;
  background: #fff;
  font-size: 0.84rem;
  font-weight: 700;
}

.st-sel select {
  height: 44px;
  padding: 0 20px 0 0;
  border: 0;
  background: transparent;
  color: #0b1220;
  font: inherit;
  font-weight: 700;
  appearance: none;
  cursor: pointer;
}

.st-sel select:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 6px;
  border-radius: 8px;
}

.st-sel :deep(.v-icon) {
  position: absolute;
  right: 10px;
  pointer-events: none;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* učitavanje */
.st-skel {
  display: grid;
  gap: 10px;
}

.st-skel-grid {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.st-skel-grid > .st-sk {
  margin: 14px;
}

.st-skel-row {
  display: grid;
  grid-template-columns: 116px repeat(7, minmax(0, 1fr));
  gap: 5px;
  align-items: center;
  min-height: 76px;
  padding: 5px;
  border-top: 1px solid #eceef2;
}

.st-skel-row > :first-child {
  margin: 0 10px;
}

.st-sk {
  border-radius: 12px;
  background: linear-gradient(90deg, #eceef2 25%, #f6f7f9 37%, #eceef2 63%);
  background-size: 400% 100%;
  animation: st-sh 1.4s ease infinite;
}

@keyframes st-sh {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

/* telefon: Nova smjena i Kopiraj ostaju na dnu ekrana */
.st-bottom {
  position: sticky;
  bottom: 0;
  z-index: 12;
  display: flex;
  gap: 8px;
  margin: 0 -2px;
  padding: 12px 0 calc(14px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(to bottom, rgba(245, 246, 248, 0), #f5f6f8 28%);
}

.st-bottom :deep(.ab) {
  flex: 1;
}

.st-copy {
  display: grid;
  flex: none;
  place-items: center;
  width: 52px;
  min-height: 52px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .st-sk {
    animation: none;
  }
}
</style>
