<template>
  <div class="dl">
    <div class="dl-strip" role="group" aria-label="Dani sedmice">
      <button
        v-for="(d, i) in model.days"
        :key="d.date"
        type="button"
        class="dl-chip"
        :class="{ 'is-today': d.today, 'is-past': d.past }"
        :aria-pressed="day === d.date"
        :data-day="d.date"
        :aria-label="chipLabel(d)"
        @click="emit('day', d.date)"
      >
        <span class="dl-wd">{{ WD_SHORT[i] }}</span>
        <span class="dl-dn">{{ parseIso(d.date).getDate() }}</span>
        <span v-if="d.under" class="dl-pb">{{ d.under }}</span>
        <span v-else-if="d.below" class="dl-pb dl-pb--w">{{ d.below }}</span>
        <span v-else-if="d.slots" class="dl-pb dl-pb--n">{{ d.slots }}</span>
        <span v-else class="dl-pb dl-pb--x" aria-hidden="true">0</span>
      </button>
    </div>
    <p class="dl-key">
      Broj na danu: <b class="dl-k-bad">crveno</b> ispod minimuma, <b class="dl-k-warn">žuto</b> ispod cilja, sivo ukupno smjena.
    </p>

    <div v-if="current" class="dl-head">
      <h2>{{ cap1(dayLong(day)) }}</h2>
      <span>{{ pl(current.slots) }} · {{ current.booked }}/{{ current.target }}</span>
    </div>

    <template v-if="groups.length">
      <section v-for="g in groups" :key="g.zone.id" class="dl-zg" :aria-label="g.zone.name">
        <h3>
          {{ g.zone.name }}<em v-if="g.gap">rupa {{ g.gap }}</em>
        </h3>
        <ShiftTile
          v-for="s in g.shifts"
          :key="s.id"
          phone
          :shift="s"
          :selected="selShift === s.id"
          :flash="flash.has(s.id)"
          @open="emit('shift', $event)"
        />
      </section>
    </template>
    <div v-else class="dl-empty">
      <b>Nema smjena za {{ dayLong(day) }}.</b>
      <span>Dodaj smjenu ili kopiraj plan sa drugog dana.</span>
      <div class="dl-empty-acts">
        <AppButton icon="mdi-plus" @click="emit('new')">Nova smjena</AppButton>
        <AppButton variant="ghost" @click="emit('copy-day')">Kopiraj dan…</AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import ShiftTile from "~/components/dispatcher/scheduling/ShiftTile.vue";
import {
  WD_SHORT,
  cap1,
  dayLong,
  gaps,
  parseIso,
  plural,
  short,
  type DayTotals,
  type DecoratedShift,
  type NamedZone,
  type WeekModel,
} from "~/utils/schedule";

// Pregled po danu (telefon): sedam dana u redu sa brojem problema, ispod njih smjene izabranog dana
// grupisane po zonama. Problem se vidi bez skrolanja kroz sedmicu.
const props = defineProps<{
  model: WeekModel;
  day: string;
  selShift: number | null;
  flash: Set<number>;
}>();

const emit = defineEmits<{ day: [date: string]; shift: [id: number]; new: []; "copy-day": [] }>();

const pl = (n: number) => `${n} ${plural(n, "smjena", "smjene", "smjena")}`;

const current = computed(() => props.model.days.find((d) => d.date === props.day) ?? null);

const chipLabel = (d: DayTotals) =>
  `${cap1(dayLong(d.date))}${d.under ? `, ${d.under} ispod minimuma` : d.below ? `, ${d.below} ispod cilja` : ""}`;

const groups = computed(() =>
  props.model.rows
    .map((r) => {
      const shifts: DecoratedShift[] = r.cells.find((c) => c.date === props.day)?.shifts ?? [];
      const g = gaps(shifts);
      return {
        zone: r.zone as NamedZone,
        shifts,
        gap: g.map((x) => `${short(x.from)}–${short(x.to)}`).join(", "),
      };
    })
    .filter((g) => g.shifts.length)
);
</script>

<style scoped>
.dl {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.dl-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.dl-chip {
  display: grid;
  justify-items: center;
  gap: 1px;
  min-height: 64px;
  padding: 8px 0 6px;
  border: 1.5px solid #e2e5ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  cursor: pointer;
}

.dl-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.dl-wd {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #5b6676;
}

.dl-dn {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.dl-pb {
  min-width: 20px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: #b42318;
  color: #fff;
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

.dl-pb--w {
  background: #e08a14;
  color: #2a1800;
}

.dl-pb--n {
  background: #e8ebf0;
  color: #5b6676;
}

.dl-pb--x {
  visibility: hidden;
}

.dl-chip[aria-pressed="true"] {
  border-color: #0b1220;
  background: #0b1220;
  color: #fff;
}

.dl-chip[aria-pressed="true"] .dl-wd {
  color: #c9d2e0;
}

.dl-chip.is-today:not([aria-pressed="true"]) {
  border-color: #2f6fed;
  background: #eef4ff;
}

.dl-chip.is-past:not([aria-pressed="true"]) .dl-dn {
  color: #657083;
}

.dl-key {
  margin: -6px 0 0;
  font-size: 0.74rem;
  color: #5b6676;
}

.dl-k-bad {
  color: #b42318;
}

.dl-k-warn {
  color: #8f4406;
}

.dl-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 0;
}

.dl-head h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.dl-head span {
  font-size: 0.8rem;
  font-weight: 600;
  color: #5b6676;
}

.dl-zg {
  display: grid;
  gap: 8px;
}

.dl-zg h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0 2px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5b6676;
}

.dl-zg h3 em {
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  color: #8f4406;
}

.dl-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 34px 18px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  color: #5b6676;
  font-size: 0.9rem;
  text-align: center;
}

.dl-empty b {
  color: #0b1220;
  font-size: 1rem;
}

.dl-empty-acts {
  display: grid;
  gap: 8px;
  width: 100%;
  max-width: 280px;
}
</style>
