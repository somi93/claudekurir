<template>
  <div class="rf" data-company="filters">
    <div class="rf-tiles" role="group" aria-label="Stanje saradnje">
      <button
        v-for="tile in tiles"
        :key="tile.key"
        type="button"
        class="tile"
        :aria-pressed="filter === tile.key"
        :data-filter="tile.key"
        :style="{ '--dot': tile.dot, '--tint': tile.tint, '--ink': tile.ink }"
        @click="emit('filter', tile.key)"
      >
        <i />
        <span>{{ tile.label }}</span>
        <b>{{ counts[tile.key] }}</b>
      </button>
    </div>

    <div v-if="counts.currency > 0 || filter === 'currency' || hasFilter" class="rf-chips" role="group" aria-label="Šta traži pažnju">
      <button
        v-if="counts.currency > 0 || filter === 'currency'"
        type="button"
        class="chip"
        :aria-pressed="filter === 'currency'"
        data-filter="currency"
        @click="emit('filter', 'currency')"
      >
        <i />Druga valuta<em>{{ counts.currency }}</em>
      </button>
      <button v-if="hasFilter" type="button" class="clear" data-filter="reset" @click="emit('reset')">
        Očisti filtere
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { COOP_META, type RestaurantCounts, type RestaurantFilter } from "~/utils/restaurantCooperation";

// Pločice stanja saradnje (isti jezik kao pločice stanja u Kuriri) sa brojevima iz cijele liste, i
// oznaka "Druga valuta" ispod njih. Pločica bez restorana se ne prikazuje (osim Svi i izabrane).
// Na telefonu su pločice pilule u redu koji klizi.
const props = defineProps<{
  counts: RestaurantCounts;
  filter: RestaurantFilter;
  hasFilter: boolean;
}>();

const emit = defineEmits<{ filter: [RestaurantFilter]; reset: [] }>();

const tiles = computed(() => {
  const all = [
    { key: "all" as const, label: "Svi", dot: "#0b1220", tint: "#f5f6f8", ink: "#0b1220" },
    { key: "active" as const, label: "Aktivna", ...pick("active") },
    { key: "ours" as const, label: "Suspendovali ste", ...pick("ours") },
    { key: "theirs" as const, label: "Isključio vas", ...pick("theirs") },
    { key: "internal" as const, label: "Sopstvena dostava", ...pick("internal") },
  ];
  return all.filter((t) => t.key === "all" || props.counts[t.key] > 0 || props.filter === t.key);
});

function pick(state: "active" | "ours" | "theirs" | "internal") {
  const m = COOP_META[state];
  return { dot: m.dot, tint: m.tint, ink: m.ink };
}
</script>

<style scoped>
.rf {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.rf-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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

.chip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e08a14;
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

/* Telefon: pločice su pilule u redu koji klizi. */
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
