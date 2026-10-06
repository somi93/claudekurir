<template>
  <div class="nw">
    <!-- greška prvog učitavanja: prazan prikaz bi izgledao kao da u zonama nikoga nema -->
    <TintAlert v-if="live.state.value === 'firsterror'" tone="bad" role="alert" title="Ne mogu da učitam stanje uživo">
      Server ne odgovara. Prazan prikaz bi izgledao kao da u zonama nikoga nema, zato ga ne pokazujem.
      <template #action>
        <button type="button" data-field="now-retry" @click="live.refresh()">Pokušaj ponovo</button>
      </template>
    </TintAlert>
    <TintAlert v-else-if="shiftsState === 'error'" tone="bad" role="alert" title="Ne mogu da učitam smjene">
      Bez smjena se plan ne može uporediti sa stanjem na terenu, zato kartice ne pokazujem.
      <template #action>
        <button type="button" data-field="now-retry-shifts" @click="emit('retry-shifts')">Pokušaj ponovo</button>
      </template>
    </TintAlert>

    <div v-else-if="live.state.value === 'loading' || shiftsState === 'loading'" aria-busy="true" aria-label="Učitavam stanje">
      <div class="nw-top"><div class="nw-t"><h2>Sada</h2><small>Učitavam…</small></div></div>
      <div class="nw-grid nw-grid--skel">
        <div v-for="i in 3" :key="i" class="nw-skel-card">
          <div class="nw-sk" style="height: 22px; width: 50%" />
          <div class="nw-sk" style="height: 64px" />
          <div class="nw-sk" style="height: 30px" />
          <div class="nw-sk" style="height: 26px" />
        </div>
      </div>
    </div>

    <template v-else>
      <div class="nw-top">
        <div class="nw-t">
          <h2>Sada · {{ fmtTime(now.min) }}</h2>
          <small>Osvježeno <span data-ago>{{ live.updatedAt.value == null ? "—" : ago(live.secondsAgo.value) }}</span></small>
        </div>
        <div class="nw-ctl">
          <button type="button" class="nw-fp" :aria-pressed="live.auto.value" data-field="auto" @click="live.auto.value = !live.auto.value">
            <v-icon icon="mdi-refresh" size="16" />Automatski svakih {{ LIVE_INTERVAL_MS / 1000 }} s
          </button>
          <button
            type="button"
            class="nw-btn"
            :aria-disabled="live.busy.value"
            :aria-busy="live.busy.value ? 'true' : undefined"
            data-field="now-refresh"
            @click="live.refresh()"
          >
            <v-icon icon="mdi-refresh" size="18" />{{ live.busy.value ? "Osvježavam…" : "Osvježi" }}
          </button>
        </div>
      </div>

      <TintAlert v-if="live.stale.value" tone="bad" role="alert" title="Nisam uspio da osvježim">
        Prikazani su podaci od {{ clockOf(live.updatedAt.value) }}.
        <template #action>
          <button type="button" data-field="now-retry" @click="live.refresh()">Pokušaj ponovo</button>
        </template>
      </TintAlert>

      <div class="nw-tot" role="group" aria-label="Ukupno na terenu">
        <div><b>{{ totals.d }}</b><span>U dostavi</span></div>
        <div><b>{{ totals.f }}</b><span>Slobodni</span></div>
        <div><b>{{ totals.i }}</b><span>Neaktivni</span></div>
        <div><b :class="{ 'is-bad': attention }">{{ attention }}</b><span>Zone koje traže pažnju</span></div>
      </div>

      <div class="nw-grid">
        <NowZoneCard
          v-for="c in cards"
          :key="c.zone.id"
          :zone="c.zone"
          :plan="c.plan"
          :live="c.live"
          :zn="c.zn"
          :now="now"
          @ask="emit('ask', $event)"
          @open="emit('open', $event)"
        />
      </div>

      <div v-if="quiet.length" class="nw-quiet">
        <span><b>Danas bez smjena i bez kurira:</b> {{ quiet.map((q) => q.zone.name).join(", ") }}</span>
      </div>
      <TintAlert v-if="!zones.length" tone="info" title="Nema zona">Napravi zone na tabu Zone da bi se ovdje vidjelo stanje po zonama.</TintAlert>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import NowZoneCard from "~/components/dispatcher/scheduling/NowZoneCard.vue";
import { LIVE_INTERVAL_MS, type useLiveNow } from "~/composables/useLiveNow";
import {
  ago,
  fmtTime,
  nowPlan,
  zoneNow,
  type Clock,
  type NamedZone,
  type SchedShift,
} from "~/utils/schedule";

// Tab "Sada": plan smjena i stanje uživo po zonama na jednom mjestu. Kartice su poredane po hitnosti (nikoga u
// zoni, ispod minimuma, sljedeća smjena ispod minimuma, ...). Osvježava se samo dok je tab otvoren i stranica
// vidljiva; pad osvježavanja ostavlja stare podatke uz upozorenje od kada su.
const props = defineProps<{
  zones: NamedZone[];
  // Današnje smjene i stanje njihovog učitavanja.
  shifts: SchedShift[];
  shiftsState: "loading" | "error" | "ok";
  now: Clock;
  live: ReturnType<typeof useLiveNow>;
}>();

const emit = defineEmits<{ ask: [id: number]; open: [id: number]; "retry-shifts": [] }>();

const states = computed(() =>
  props.zones.map((zone) => {
    const plan = nowPlan({ shifts: props.shifts, zoneId: zone.id, now: props.now });
    const live = props.live.byZone.value.get(zone.id) ?? null;
    return { zone, plan, live, zn: zoneNow(plan, live) };
  })
);
const cards = computed(() =>
  states.value
    .filter((x) => x.live || x.plan.today.length)
    .sort((a, b) => a.zn.rank - b.zn.rank || a.zone.name.localeCompare(b.zone.name))
);
const quiet = computed(() => states.value.filter((x) => !x.live && !x.plan.today.length));

const totals = computed(() =>
  cards.value.reduce(
    (a, x) => {
      const l = x.live ?? { delivering: 0, online: 0, idle: 0 };
      a.d += l.delivering;
      a.f += l.online;
      a.i += l.idle;
      return a;
    },
    { d: 0, f: 0, i: 0 }
  )
);
const attention = computed(() => cards.value.filter((x) => ["empty", "under", "next-under"].includes(x.zn.code)).length);

const clockOf = (ms: number | null) => {
  if (ms == null) return "—";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
</script>

<style scoped>
.nw {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.nw-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
}

.nw-t {
  display: grid;
  gap: 2px;
}

.nw-t h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.nw-t small {
  font-size: 0.82rem;
  font-weight: 600;
  color: #5b6676;
}

.nw-ctl {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.nw-fp {
  display: inline-flex;
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
  cursor: pointer;
}

.nw-fp[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.nw-btn {
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

.nw-btn[aria-disabled="true"] {
  background: #f5f6f8;
  color: #5b6676;
  cursor: progress;
}

.nw-fp:focus-visible,
.nw-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.nw-tot {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.nw-tot > div {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 20px rgba(11, 18, 32, 0.05);
}

.nw-tot b {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.nw-tot b.is-bad {
  color: #b42318;
}

.nw-tot span {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.nw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 14px;
}

.nw-quiet {
  padding: 12px 14px;
  border-radius: 16px;
  background: #fff;
  font-size: 0.86rem;
  color: #5b6676;
}

.nw-quiet b {
  color: #0b1220;
}

.nw-skel-card {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.nw-sk {
  border-radius: 12px;
  background: linear-gradient(90deg, #eceef2 25%, #f6f7f9 37%, #eceef2 63%);
  background-size: 400% 100%;
  animation: nw-sh 1.4s ease infinite;
}

@keyframes nw-sh {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

@media (max-width: 400px) {
  .nw-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nw-sk {
    animation: none;
  }
}
</style>
