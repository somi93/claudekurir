<template>
  <div class="rf">
    <TintAlert
      v-if="locationsFailed"
      tone="warn"
      icon="mdi-map-marker-off-outline"
      title="Pozicije kurira trenutno nisu dostupne"
      data-roster="live-failed"
    >
      Stanje uživo (u dostavi, slobodni, offline) nije pouzdano dok se pozicije ne vrate. Ostalo radi.
    </TintAlert>
    <div class="rf-tiles" role="group" aria-label="Stanje kurira">
      <button
        v-for="tile in tiles"
        :key="tile.key"
        type="button"
        class="tile"
        :aria-pressed="live === tile.key"
        :data-filter="`live:${tile.key}`"
        :style="{ '--dot': tile.dot, '--tint': tile.tint, '--ink': tile.ink }"
        @click="emit('live', tile.key)"
      >
        <i />
        <span>{{ tile.label }}</span>
        <b>{{ counts[tile.key] }}</b>
      </button>
    </div>

    <div v-if="chips.length || hasFilter" class="rf-chips" role="group" aria-label="Šta traži pažnju">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        class="chip"
        :aria-pressed="flags.includes(chip.key)"
        :disabled="chip.disabled"
        :data-filter="`flag:${chip.key}`"
        :style="{ '--dot': chip.dot }"
        @click="emit('flag', chip.key)"
      >
        <i />{{ FLAG_LABELS[chip.key] }}<em>{{ counts[chip.key] }}</em>
      </button>
      <button v-if="hasFilter" type="button" class="clear" data-filter="reset" @click="emit('reset')">
        Očisti filtere
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import {
  FLAG_LABELS,
  FLAG_ORDER,
  LIVE_META,
  type RosterCounts,
  type RosterFlag,
  type RosterLive,
} from "~/utils/courierRoster";

// Pločice stanja uživo (isti nazivi i boje kao Kuriri uživo) i oznake pažnje ispod njih. Oznaka se
// vidi samo kad je broj veći od 0 ili kad je uključena. Brojevi dolaze iz cijele liste, ne iz
// filtriranog dijela. Oznake koje zavise od izvora koji ne radi (dug, poruke) su onemogućene.
// Na telefonu su pločice pilule u redu koji klizi.
const props = defineProps<{
  counts: RosterCounts;
  live: RosterLive;
  flags: RosterFlag[];
  hasFilter: boolean;
  balancesFailed: boolean;
  summaryFailed: boolean;
  locationsFailed?: boolean;
}>();

const emit = defineEmits<{ live: [RosterLive]; flag: [RosterFlag]; reset: [] }>();

const tiles = computed(() => [
  { key: "all" as const, label: "Svi", dot: "#0b1220", tint: "#f5f6f8", ink: "#0b1220" },
  { key: "delivering" as const, label: "U dostavi", dot: LIVE_META.delivering.dot, tint: LIVE_META.delivering.tint, ink: LIVE_META.delivering.ink },
  { key: "online" as const, label: "Slobodni", dot: LIVE_META.online.dot, tint: LIVE_META.online.tint, ink: LIVE_META.online.ink },
  { key: "offline" as const, label: "Offline", dot: LIVE_META.offline.dot, tint: LIVE_META.offline.tint, ink: LIVE_META.offline.ink },
]);

const DOTS: Record<RosterFlag, string> = {
  suspended: "#e5484d",
  noVehicle: "#e08a14",
  debt: "#e08a14",
  unread: "#2f6fed",
};

const chips = computed(() =>
  FLAG_ORDER.filter((k) => props.counts[k] > 0 || props.flags.includes(k)).map((key) => ({
    key,
    dot: DOTS[key],
    disabled:
      (key === "debt" && props.balancesFailed && !props.flags.includes(key)) ||
      (key === "unread" && props.summaryFailed && !props.flags.includes(key)),
  }))
);
</script>

<style scoped>
.rf {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.rf-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.tile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 50px;
  padding: 8px 12px;
  border: 1.5px solid #eceef2;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.tile:hover {
  border-color: #d7dce6;
}

.tile:focus-visible,
.chip:focus-visible,
.clear:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.tile i {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot);
}

.tile b {
  order: -1;
  font-size: 1.05rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.tile span {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #657083;
}

.tile[aria-pressed="true"] {
  border-color: var(--ink);
  background: var(--tint);
}

.tile[aria-pressed="true"] b,
.tile[aria-pressed="true"] span {
  color: var(--ink);
}

.rf-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid #e2e5ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.chip:hover {
  border-color: #c7ccd4;
}

.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot);
}

.chip em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #eceff3;
  color: #5b6676;
  font-size: 0.7rem;
  font-style: normal;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.chip[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.chip[aria-pressed="true"] em {
  background: #2f6fed;
  color: #fff;
}

.clear {
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

/* Telefon: pločice i oznake su pilule u redu koji klizi. */
@media (max-width: 700px) {
  .rf-tiles,
  .rf-chips {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .rf-tiles::-webkit-scrollbar,
  .rf-chips::-webkit-scrollbar {
    display: none;
  }

  .tile {
    flex: none;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 999px;
  }

  .tile span {
    font-size: 0.82rem;
    letter-spacing: 0;
    text-transform: none;
    color: #0b1220;
  }

  .tile b {
    order: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: #eceff3;
    color: #5b6676;
    font-size: 0.7rem;
  }

  .tile[aria-pressed="true"] {
    border-color: #2f6fed;
    background: #eef4ff;
  }

  .tile[aria-pressed="true"] span {
    color: #2459c7;
  }

  .tile[aria-pressed="true"] b {
    background: #2f6fed;
    color: #fff;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile {
    transition: none;
  }
}
</style>
