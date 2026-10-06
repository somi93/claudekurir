<template>
  <component
    :is="phone ? 'button' : 'span'"
    :type="phone ? 'button' : undefined"
    class="tile"
    :class="[
      `tile--${kind}`,
      { 'tile--phone': phone, 'is-past': past, 'is-dim': !shift.match, 'is-sel': selected, 'is-flash': flash },
    ]"
    :data-shift-id="shift.id"
    @click.stop="emit('open', shift.id)"
  >
    <span class="t-r1">
      <span class="t-tm">{{ phone ? fmtWinFull(shift.start, shift.end) : fmtWin(shift.start, shift.end) }}</span>
      <span v-if="shift.hot" class="t-hot" title="Hitna smjena">
        <v-icon icon="mdi-fire" :size="phone ? 18 : 14" />
        <span class="sr">hitna smjena</span>
      </span>
      <span class="t-ct">{{ shift.booked }}<i>/{{ shift.target }}</i></span>
    </span>
    <CoverageMeter
      :booked="shift.booked"
      :min="shift.min"
      :target="shift.target"
      :max="shift.max"
      :color="past || !shift.match ? '#9aa4b2' : STATUS_COLOR[shift.status]"
      :size="phone ? 'md' : 'sm'"
    />
    <span class="t-st"><v-icon :icon="icon" :size="phone ? 16 : 14" />{{ label }}</span>
    <span v-if="phone && !past && shift.status !== 'target_reached' && shift.status !== 'full'" class="t-nd">
      {{ need(shift) }}
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CoverageMeter from "~/components/dispatcher/scheduling/CoverageMeter.vue";
import { STATUS, STATUS_COLOR, fmtWin, fmtWinFull, need, type DecoratedShift } from "~/utils/schedule";

// Pločica smjene: vrijeme i broj potvrđenih/cilj, mjerač i status riječju + ikonom (boja nikad nije jedina
// oznaka). Završena smjena je sivo "Završeno": status je istorija, ne zadatak. U mreži (računar) pločica nije
// zaseban taster - ćelija je jedna meta tastature; na telefonu je pločica pravo dugme.
const props = defineProps<{
  shift: DecoratedShift;
  phone?: boolean;
  selected?: boolean;
  flash?: boolean;
}>();

const emit = defineEmits<{ open: [id: number] }>();

const past = computed(() => props.shift.phase === "past");
const kind = computed(
  () => ({ understaffed: "under", below_target: "below", target_reached: "ok", full: "full" })[props.shift.status]
);
const label = computed(() => (past.value ? "Završeno" : STATUS[props.shift.status].label));
const icon = computed(() =>
  past.value
    ? "mdi-check"
    : props.shift.status === "understaffed"
      ? "mdi-alert-outline"
      : props.shift.status === "below_target"
        ? "mdi-alert-circle-outline"
        : "mdi-check-circle-outline"
);
</script>

<style scoped>
.tile {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 6px 8px 7px;
  border: 1px solid #e2e5ea;
  border-left: 4px solid var(--c);
  border-radius: 10px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
  position: relative;
}

.tile--under {
  --c: #e5484d;
  --tc: #b42318;
  background: #fff8f7;
}

.tile--below {
  --c: #e08a14;
  --tc: #8f4406;
}

.tile--ok {
  --c: #1f9d6b;
  --tc: #04694a;
}

.tile--full {
  --c: #2f6fed;
  --tc: #2459c7;
}

.tile:hover {
  border-color: #b8bec9;
  border-left-color: var(--c);
}

.tile.is-past,
.tile.is-dim {
  --c: #c9ced7;
  --tc: #5b6676;
  border-color: #e7e9ee;
  border-left-color: #c9ced7;
  background: #f5f6f8;
}

.tile.is-past .t-tm,
.tile.is-past .t-ct,
.tile.is-dim .t-tm,
.tile.is-dim .t-ct {
  color: #5b6676;
}

.tile.is-sel {
  box-shadow: 0 0 0 3px #2f6fed;
}

.tile.is-flash {
  animation: tile-flash 1.5s ease;
}

.t-r1 {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.t-tm {
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.t-ct {
  margin-left: auto;
  font-size: 0.84rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.t-ct i {
  font-style: normal;
  font-weight: 600;
  color: #5b6676;
}

.t-hot {
  display: grid;
  place-items: center;
  flex: none;
  color: #9a4a07;
}

.t-st {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.2;
  color: var(--tc);
}

.t-st :deep(.v-icon) {
  flex: none;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* telefon: velika pločica sa objašnjenjem koliko fali */
.tile--phone {
  gap: 6px;
  width: 100%;
  padding: 12px 14px;
  border-left-width: 5px;
  border-radius: 16px;
}

.tile--phone:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.tile--phone .t-r1 {
  gap: 8px;
}

.tile--phone .t-tm,
.tile--phone .t-ct {
  font-size: 1.05rem;
}

.tile--phone .t-st {
  gap: 6px;
  font-size: 0.82rem;
}

.t-nd {
  font-size: 0.8rem;
  color: #5b6676;
}

@keyframes tile-flash {
  0% {
    box-shadow: 0 0 0 0 rgba(47, 111, 237, 0.9);
  }

  35% {
    box-shadow: 0 0 0 5px rgba(47, 111, 237, 0.55);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(47, 111, 237, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile.is-flash {
    animation: none;
  }
}
</style>
