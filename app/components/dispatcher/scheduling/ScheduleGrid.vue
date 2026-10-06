<template>
  <div class="sg" role="grid" aria-label="Raspored smjena po zonama i danima" :aria-rowcount="shown.length + 1">
    <div class="sg-head" role="row">
      <div role="columnheader" class="sg-z sg-zh">Zona</div>
      <div
        v-for="(d, i) in model.days"
        :key="d.date"
        role="columnheader"
        class="sg-d"
        :class="{ 'is-today': d.today, 'is-past': d.past }"
      >
        <div class="sg-wd">{{ WD_SHORT[i] }}</div>
        <div class="sg-dn">{{ parseIso(d.date).getDate() }}</div>
        <span v-if="d.today" class="sg-tg">danas</span>
        <div v-if="d.slots" class="sg-tot" title="Potvrđeno / cilj, zbir po smjenama">
          {{ d.booked }}/{{ d.target }}
          <template v-if="d.under">
            <i aria-hidden="true" />
            <span class="sr">{{ d.under }} ispod minimuma</span>
          </template>
        </div>
        <div v-else class="sg-tot">–</div>
      </div>
    </div>

    <div v-for="(row, r) in shown" :key="row.zone.id" class="sg-row" :class="{ 'is-empty': row.empty }" role="row">
      <div class="sg-z" role="rowheader">
        {{ row.zone.name }}
        <small v-if="row.empty">Nema smjena</small>
        <small v-else-if="gapNote(row)" class="sg-gap">{{ gapNote(row) }}</small>
      </div>
      <div
        v-for="(cell, c) in row.cells"
        :key="cell.date"
        role="gridcell"
        class="sg-c"
        :class="{ 'is-today': cell.date === now.date, 'is-empty': !cell.shifts.length, 'is-sel': selCell === key(row.zone.id, cell.date) }"
        :tabindex="key(row.zone.id, cell.date) === focusKey ? 0 : -1"
        :data-cell="key(row.zone.id, cell.date)"
        :data-r="r"
        :data-c="c"
        :aria-label="cellLabel(row.zone, cell.date, cell.shifts)"
        @click="emit('cell', row.zone.id, cell.date)"
        @keydown="onKey($event, r, c, row.zone.id, cell.date)"
        @focus="active = key(row.zone.id, cell.date)"
      >
        <ShiftTile
          v-for="s in cell.shifts"
          :key="s.id"
          :shift="s"
          :selected="selShift === s.id"
          :flash="flash.has(s.id)"
          @open="emit('shift', $event)"
        />
        <span v-if="!cell.shifts.length" class="sg-add"><v-icon icon="mdi-plus" size="14" />Dodaj</span>
      </div>
    </div>

    <div v-if="hiddenEmpty.length && !showEmpty" class="sg-more">
      <span>Zone bez smjena ove sedmice ({{ hiddenEmpty.length }}): {{ hiddenEmpty.map((r) => r.zone.name).join(", ") }}</span>
      <button type="button" class="sg-btn" data-field="empty-toggle" @click="emit('toggle-empty')">Prikaži</button>
    </div>
    <div v-else-if="showEmpty && emptyOpen && emptyRows.length" class="sg-more">
      <span>Prikazane su i zone bez smjena.</span>
      <button type="button" class="sg-btn" data-field="empty-toggle" @click="emit('toggle-empty')">Sakrij</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import ShiftTile from "~/components/dispatcher/scheduling/ShiftTile.vue";
import {
  STATUS,
  WD_SHORT,
  dayLong,
  fmtWin,
  gaps,
  parseIso,
  plural,
  short,
  type Clock,
  type DecoratedShift,
  type NamedZone,
  type WeekModel,
  type WeekRow,
} from "~/utils/schedule";

// Mreža sedmice (računar): redovi su zone grada, kolone dani. Cijela mreža je JEDAN taster u redoslijedu
// Tab (role=grid, roving tabindex): strelice, Home i End pomjeraju ćeliju, Enter ili razmak je otvaraju
// (prazna ćelija otvara novu smjenu), a klik na pločicu otvara smjenu. Zone bez smjena ove sedmice su iza
// "Prikaži" (osim kad je izabrana jedna zona).
const props = defineProps<{
  model: WeekModel;
  now: Clock;
  selCell: string | null;
  selShift: number | null;
  flash: Set<number>;
  emptyOpen: boolean;
  zoneFiltered: boolean;
}>();

const emit = defineEmits<{
  cell: [zoneId: number, date: string];
  shift: [id: number];
  "toggle-empty": [];
}>();

const key = (zoneId: number, date: string) => `${zoneId}|${date}`;

const withShifts = computed(() => props.model.rows.filter((r) => !r.empty));
const emptyRows = computed(() => props.model.rows.filter((r) => r.empty));
const showEmpty = computed(() => props.zoneFiltered || props.emptyOpen);
const shown = computed<WeekRow[]>(() =>
  showEmpty.value ? props.model.rows : withShifts.value.length ? withShifts.value : props.model.rows
);
const hiddenEmpty = computed(() => (withShifts.value.length ? emptyRows.value : []));

// Ćelija koja je sada u redoslijedu Tab (roving): zadnja fokusirana, inače prva.
const active = ref<string | null>(null);
const firstKey = computed(() => {
  const r = shown.value[0];
  const d = props.model.days[0];
  return r && d ? key(r.zone.id, d.date) : "";
});
const focusKey = computed(() => {
  const k = active.value ?? props.selCell;
  const exists = k && shown.value.some((r) => r.cells.some((c) => key(r.zone.id, c.date) === k));
  return exists ? k : firstKey.value;
});
watch(
  () => props.model.days[0]?.date,
  () => {
    active.value = null;
  }
);

const pl = (n: number) => `${n} ${plural(n, "smjena", "smjene", "smjena")}`;

const cellLabel = (z: NamedZone, date: string, list: DecoratedShift[]): string => {
  const d = dayLong(date);
  if (!list.length) return `${z.name}, ${d}: nema smjena. Enter dodaje smjenu.`;
  return (
    `${z.name}, ${d}: ${pl(list.length)}. ` +
    list
      .map(
        (s) =>
          `${fmtWin(s.start, s.end)}, ${s.booked} od ${s.target}, ${s.phase === "past" ? "završeno" : STATUS[s.status].label.toLowerCase()}`
      )
      .join("; ") +
    ". Enter otvara."
  );
};

// "Rupa 15–17" ako svi dani imaju istu rupu, inače "Rupe u N dana".
const gapNote = (row: WeekRow): string => {
  const gs = row.cells.map((c) => gaps(c.shifts)).filter((g) => g.length);
  if (!gs.length) return "";
  const sig = (g: { from: string; to: string }[]) => g.map((x) => `${x.from}-${x.to}`).join();
  const first = gs[0]!;
  if (gs.every((g) => sig(g) === sig(first))) {
    return `Rupa ${first.map((g) => `${short(g.from)}–${short(g.to)}`).join(", ")}`;
  }
  return `Rupe u ${gs.length} ${plural(gs.length, "dan", "dana", "dana")}`;
};

const onKey = async (event: KeyboardEvent, r: number, c: number, zoneId: number, date: string) => {
  if (event.target !== event.currentTarget) return;
  const k = event.key;
  if (k === "Enter" || k === " ") {
    event.preventDefault();
    emit("cell", zoneId, date);
    return;
  }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(k)) return;
  event.preventDefault();
  const nr = k === "ArrowUp" ? Math.max(0, r - 1) : k === "ArrowDown" ? Math.min(shown.value.length - 1, r + 1) : r;
  const nc = k === "ArrowLeft" ? Math.max(0, c - 1) : k === "ArrowRight" ? Math.min(6, c + 1) : k === "Home" ? 0 : k === "End" ? 6 : c;
  const row = shown.value[nr];
  const day = props.model.days[nc];
  if (!row || !day) return;
  active.value = key(row.zone.id, day.date);
  await nextTick();
  (event.currentTarget as HTMLElement | null)
    ?.closest(".sg")
    ?.querySelector<HTMLElement>(`[data-cell="${active.value}"]`)
    ?.focus();
};
</script>

<style scoped>
.sg {
  min-width: 0;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.sg-head,
.sg-row {
  display: grid;
  grid-template-columns: 116px repeat(7, minmax(0, 1fr));
}

.sg-head {
  position: sticky;
  top: 0;
  z-index: 5;
  background: #fff;
  border-bottom: 1px solid #eceef2;
}

.sg-head > div {
  min-width: 0;
  padding: 8px 6px;
  border-left: 1px solid #eceef2;
  text-align: center;
}

.sg-head > div:first-child {
  border-left: 0;
}

.sg-zh {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5b6676;
}

.sg-wd {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5b6676;
}

.sg-dn {
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.sg-tot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 3px;
  font-size: 0.74rem;
  font-weight: 700;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.sg-tot i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b42318;
}

.sg-d.is-today {
  background: #eef4ff;
}

.sg-d.is-today .sg-wd,
.sg-d.is-today .sg-dn {
  color: #2459c7;
}

.sg-tg {
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #2459c7;
}

.sg-d.is-past .sg-wd,
.sg-d.is-past .sg-dn {
  color: #657083;
}

.sg-row {
  border-top: 1px solid #eceef2;
}

.sg-head + .sg-row {
  border-top: 0;
}

.sg-z {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 10px;
  font-size: 0.9rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.sg-z small {
  font-size: 0.72rem;
  font-weight: 600;
  color: #5b6676;
}

.sg-z small.sg-gap {
  font-weight: 700;
}

.sg-row.is-empty .sg-z {
  color: #5b6676;
}

.sg-c {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  min-height: 76px;
  padding: 5px;
  border-left: 1px solid #eceef2;
  background: #fff;
  cursor: pointer;
}

.sg-c.is-today {
  background: #f6f9ff;
}

.sg-c:hover {
  background: #f7f8fa;
}

.sg-c.is-today:hover {
  background: #eef4ff;
}

.sg-c:focus-visible {
  z-index: 3;
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.sg-c.is-sel {
  z-index: 2;
  box-shadow: inset 0 0 0 3px #2f6fed;
}

.sg-c.is-empty {
  align-items: center;
  justify-content: center;
}

.sg-add {
  display: none;
  align-items: center;
  gap: 4px;
  margin: auto;
  padding: 4px 10px;
  border: 1.5px dashed #c7ccd4;
  border-radius: 10px;
  color: #657083;
  font-size: 0.74rem;
  font-weight: 700;
}

.sg-c.is-empty .sg-add {
  display: inline-flex;
}

.sg-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid #eceef2;
  font-size: 0.84rem;
  color: #5b6676;
}

.sg-btn {
  flex: none;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
}

.sg-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
