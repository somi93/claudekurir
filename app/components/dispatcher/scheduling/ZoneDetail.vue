<template>
  <section class="zd" :aria-label="`Zona ${zone.name}`">
    <div class="zd-h">
      <h2>{{ zone.name }}</h2>
      <span class="zd-sp" />
      <button type="button" class="zd-btn" data-field="zone-edit" @click="emit('edit')">
        <v-icon icon="mdi-pencil-outline" size="18" />Izmijeni
      </button>
      <button type="button" class="zd-btn zd-btn--bad" data-field="zone-del" @click="emit('delete')">
        <v-icon icon="mdi-delete-outline" size="18" />Obriši
      </button>
    </div>

    <div v-if="!hasGeo(zone)" class="zd-tint">
      <TintAlert tone="warn" title="Zona nema položaj na karti">
        Bez centra i radijusa se ne vidi na karti.
        <template #action>
          <button type="button" data-field="zone-place" @click="emit('edit')">Postavi na karti</button>
        </template>
      </TintAlert>
    </div>

    <div class="zd-kv">
      <div>
        <small>Faktor terena</small>
        <b>{{ fmtNum(zone.tf) }}{{ terrainWord(zone.tf) }}</b>
      </div>
      <div>
        <small>Radijus</small>
        <b>{{ hasGeo(zone) ? `${fmtKm(zone.r)} · ≈ ${f1(areaKm2(zone.r))} km²` : "–" }}</b>
      </div>
      <div>
        <small>Smjene u narednih {{ usageDays }} dana</small>
        <b>{{ usageCount == null ? "–" : smjena(usageCount) }}</b>
      </div>
      <div>
        <small>Preklapa se sa</small>
        <b>{{ overlapText }}</b>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { smjena } from "~/composables/useShiftBatch";
import { diffDays, type Clock, type SchedShift } from "~/utils/schedule";
import { areaKm2, fmtKm, fmtNum, hasGeo, overlaps, terrainWord, usage, type GeoZone } from "~/utils/zoneGeo";

// Izabrana zona: faktor terena (sa riječju), radijus sa površinom, broj smjena u narednih dana i sa kojim se
// zonama preklapa. Brojevi smjena se računaju iz učitanog rasporeda: ako on ne pokriva svih 28 dana, piše koliko
// dana pokriva (tačan broj pokazuje list brisanja).
const props = defineProps<{
  zone: GeoZone;
  zones: GeoZone[];
  shifts: SchedShift[];
  now: Clock;
  range: { from: string; to: string } | null;
}>();

const emit = defineEmits<{ edit: []; delete: [] }>();

const f1 = (n: number) => fmtNum(Math.round(n * 10) / 10);

const usageDays = computed(() => {
  const r = props.range;
  if (!r || r.from > props.now.date) return 28;
  return Math.max(1, Math.min(28, diffDays(props.now.date, r.to) + 1));
});
const usageCount = computed(() => {
  const r = props.range;
  if (!r || r.from > props.now.date || r.to < props.now.date) return null;
  return usage(props.zone.id, props.shifts, props.now, usageDays.value);
});

const overlapText = computed(() => {
  const ov = hasGeo(props.zone) ? overlaps(props.zone, props.zones) : [];
  return ov.length ? ov.slice(0, 3).map((o) => `${o.zone.name} ${o.pct}%`).join(", ") : "nijednom zonom";
});
</script>

<style scoped>
.zd {
  display: grid;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.zd-h {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.zd-h h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.zd-sp {
  flex: 1;
}

.zd-btn {
  display: inline-flex;
  align-items: center;
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

.zd-btn--bad {
  color: #b42318;
}

.zd-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.zd-tint {
  padding: 0 16px 12px;
}

.zd-kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid #eceef2;
}

.zd-kv > div {
  padding: 10px 16px;
  border-top: 1px solid #eceef2;
}

.zd-kv > div:nth-child(-n + 2) {
  border-top: 0;
}

.zd-kv small {
  display: block;
  font-size: 0.74rem;
  font-weight: 700;
  color: #5b6676;
}

.zd-kv b {
  font-size: 0.95rem;
  font-weight: 700;
}

@media (max-width: 419px) {
  .zd-kv {
    grid-template-columns: minmax(0, 1fr);
  }

  .zd-kv > div:nth-child(2) {
    border-top: 1px solid #eceef2;
  }
}
</style>
