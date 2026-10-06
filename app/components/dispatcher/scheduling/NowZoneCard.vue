<template>
  <article class="nz" :class="{ 'nz--bad': zn.tone === 'bad', 'nz--warn': zn.tone === 'warn' }" :aria-label="`${zone.name}: ${zn.label}`" :data-zone="zone.id" :data-code="zn.code">
    <div class="nz-h">
      <h3>{{ zone.name }}</h3>
      <ShiftPill :tone="zn.tone" :icon="ICON[zn.tone]">{{ zn.label }}</ShiftPill>
    </div>

    <!-- plan -->
    <div class="nz-pl">
      <template v-if="plan.current.length">
        <span class="nz-l">Smjena sada</span>
        <template v-for="s in plan.current" :key="s.id">
          <div class="nz-v">
            <span>{{ fmtWinFull(s.start, s.end) }}</span>
            <span class="nz-mut">još {{ inText(mm(s.end) - now.min) }}</span>
            <span class="nz-ct">{{ s.booked }}<i>/{{ s.target }}</i></span>
          </div>
          <CoverageMeter :booked="s.booked" :min="s.min" :target="s.target" :max="s.max" :color="STATUS_COLOR[s.status]" size="md" />
          <span class="nz-sub">{{ need(s) }}</span>
        </template>
      </template>
      <template v-else-if="nextShift">
        <span class="nz-l">Sljedeća smjena</span>
        <div class="nz-v">
          <span>{{ fmtWinFull(nextShift.start, nextShift.end) }}</span>
          <span class="nz-mut">za {{ inText(plan.minutesToNext ?? 0) }}</span>
          <span class="nz-ct">{{ nextShift.booked }}<i>/{{ nextShift.target }}</i></span>
        </div>
        <CoverageMeter :booked="nextShift.booked" :min="nextShift.min" :target="nextShift.target" :max="nextShift.max" :color="STATUS_COLOR[nextShift.status]" size="md" />
        <span class="nz-sub">{{ need(nextShift) }}</span>
      </template>
      <template v-else>
        <span class="nz-l">Smjena</span>
        <span class="nz-sub">Danas nema smjena u ovoj zoni.</span>
      </template>
    </div>

    <!-- teren -->
    <div class="nz-pl">
      <span class="nz-l">Na terenu</span>
      <div v-if="live" class="nz-live">
        <span class="is-d"><b>{{ live.delivering }}</b> u dostavi</span>
        <span class="is-f"><b>{{ live.online }}</b> {{ plural(live.online, "slobodan", "slobodna", "slobodnih") }}</span>
        <span class="is-i"><b>{{ live.idle }}</b> {{ plural(live.idle, "neaktivan", "neaktivna", "neaktivnih") }}</span>
      </div>
      <div v-else class="nz-live"><span class="is-i">Nema podataka o kuririma u zoni</span></div>
    </div>

    <!-- traka dana -->
    <div>
      <div class="nz-tl" role="img" :aria-label="`Smjene danas: ${plan.today.map((s) => fmtWin(s.start, s.end)).join(', ') || 'nema'}; sada je ${fmtTime(now.min)}`">
        <span
          v-for="s in plan.today"
          :key="s.id"
          class="nz-seg"
          :style="{
            left: `${((mm(s.start) - AX0) / (AX1 - AX0)) * 100}%`,
            width: `${((mm(s.end) - mm(s.start)) / (AX1 - AX0)) * 100}%`,
            '--c': s.phase === 'past' ? '#9aa4b2' : STATUS_COLOR[s.status],
            opacity: s.phase === 'past' ? 0.7 : 1,
          }"
          :title="`${fmtWinFull(s.start, s.end)}, ${s.booked} od ${s.target}`"
        />
        <span class="nz-nw" :style="{ left: `${((now.min - AX0) / (AX1 - AX0)) * 100}%` }" />
      </div>
      <div class="nz-ax" aria-hidden="true">
        <span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span>
      </div>
    </div>

    <div v-if="target" class="nz-acts">
      <button v-if="needsAsk" type="button" class="nz-btn" :data-field="`ask-${zone.id}`" @click="emit('ask', target.id)">
        <v-icon icon="mdi-bullhorn-outline" size="18" />Traži kurire
      </button>
      <button type="button" class="nz-btn" :data-field="`open-${zone.id}`" @click="emit('open', target.id)">Otvori smjenu</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CoverageMeter from "~/components/dispatcher/scheduling/CoverageMeter.vue";
import ShiftPill from "~/components/dispatcher/scheduling/ShiftPill.vue";
import {
  STATUS_COLOR,
  decorate,
  fmtTime,
  fmtWin,
  fmtWinFull,
  inText,
  missing,
  mm,
  need,
  plural,
  type Clock,
  type LiveCounts,
  type NamedZone,
  type NowPlan,
  type ZoneNow,
} from "~/utils/schedule";

// Kartica zone na tabu "Sada": smjena koja traje (ili sljedeća) sa mjeračem i "Fale još N", kuriri na terenu,
// traka dana sa crtom "sada" i dvije prečice - "Traži kurire" i "Otvori smjenu". Plan i teren se porede samo u
// jednom slučaju: smjena traje, a u zoni nema nikoga.
const props = defineProps<{
  zone: NamedZone;
  plan: NowPlan;
  live: LiveCounts | null;
  zn: ZoneNow;
  now: Clock;
}>();

const emit = defineEmits<{ ask: [id: number]; open: [id: number] }>();

const ICON = {
  bad: "mdi-alert-circle-outline",
  warn: "mdi-alert-outline",
  ok: "mdi-check-circle-outline",
  idle: "mdi-clock-outline",
} as const;

const AX0 = 6 * 60;
const AX1 = 24 * 60;

// Sljedeća smjena računa status kao da je počela (nema "završeno").
const nextShift = computed(() => (props.plan.next ? decorate(props.plan.next, { date: props.plan.next.date, min: 0 }) : null));
const target = computed(() => (props.plan.current.length ? props.plan.worst : props.plan.next));
const needsAsk = computed(
  () => !!target.value && missing(target.value) > 0 && ["empty", "under", "next-under", "below"].includes(props.zn.code)
);
</script>

<style scoped>
.nz {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px 16px;
  border: 1.5px solid transparent;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.nz--bad {
  border-color: #f3b4ae;
}

.nz--warn {
  border-color: #f0d1a0;
}

.nz-h {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.nz-h h3 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.nz-h :deep(.sp) {
  margin-left: auto;
}

.nz-pl {
  display: grid;
  gap: 4px;
}

.nz-l {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #5b6676;
}

.nz-v {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.nz-mut {
  font-weight: 600;
  color: #5b6676;
}

.nz-ct {
  margin-left: auto;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.nz-ct i {
  font-style: normal;
  font-weight: 600;
  color: #5b6676;
}

.nz-sub {
  font-size: 0.8rem;
  font-weight: 600;
  color: #5b6676;
}

.nz-live {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nz-live span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f1f3f6;
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.nz-live b {
  font-weight: 800;
}

.nz-live .is-d {
  background: #eef4ff;
  color: #17408f;
}

.nz-live .is-f {
  background: #e3f8ef;
  color: #04382a;
}

.nz-live .is-i {
  background: #f1f3f6;
  color: #46505f;
}

.nz-tl {
  position: relative;
  height: 26px;
  overflow: hidden;
  border-radius: 8px;
  background: #f1f3f6;
}

.nz-seg {
  position: absolute;
  top: 5px;
  bottom: 5px;
  border-radius: 5px;
  background: var(--c);
}

.nz-nw {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #0b1220;
}

.nz-ax {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.nz-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nz-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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

.nz-btn:hover {
  background: #f7f8fa;
}

.nz-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
