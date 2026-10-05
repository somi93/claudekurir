<template>
  <div
    class="sm"
    :class="bare ? 'sm--bare' : 'sm--card'"
    data-pricing="sim"
    :role="bare ? undefined : 'group'"
    :aria-labelledby="bare ? undefined : ids.title"
    :aria-busy="loading ? 'true' : undefined"
  >
    <div v-if="!bare" class="sm-h">
      <h2 :id="ids.title" class="sm-t">Primjer narudžbe</h2>
      <span v-if="ws.price.dirty" class="sm-draft" data-pricing="sim-draft"><i aria-hidden="true" />Nacrt</span>
    </div>

    <!-- Učitavanje: oblik sadržaja, ne nula kao cijena. -->
    <div
      v-if="!ws.calc && loading"
      class="sm-sk"
      role="status"
      aria-label="Učitavam primjer"
      data-pricing="sim-loading"
    >
      <span class="b sm-sk-l" />
      <span class="b sm-sk-in" />
      <span class="b sm-sk-sel" />
      <span class="sm-sk-row"><span class="b sm-sk-chip" /><span class="b sm-sk-chip" /><span class="b sm-sk-chip" /></span>
      <span class="b sm-sk-tot" />
      <span class="b sm-sk-veh" />
    </div>

    <!-- Bez cijene ili doplata obračun bi lagao (ukupno bez doplata), pa se ne pokazuje. -->
    <div v-else-if="!ws.calc" class="sm-na" data-pricing="sim-unavailable">
      <p>Primjer je dostupan kad se podaci učitaju.</p>
      <AppButton
        v-if="failed"
        variant="ghost"
        icon="mdi-refresh"
        class="sm-retry"
        data-pricing="sim-retry"
        @click="ws.actions.reloadAll()"
      >
        Pokušaj ponovo
      </AppButton>
    </div>

    <template v-else>
      <div class="sm-in">
        <!-- Udaljenost: klizač sa vidljivom trakom (stari je bio iste boje kao kartica) i dugmad ±0,5 km. -->
        <div class="sm-f">
          <div class="sm-dv">
            <label :for="ids.dist" class="sm-l">Udaljenost</label>
            <output :for="ids.dist" class="sm-out" aria-live="off" data-sim="dist-value">{{ km }} km</output>
          </div>
          <div class="sm-dr">
            <button
              type="button"
              class="sm-step"
              data-sim="dist-minus"
              aria-label="Manje za 0,5 km"
              @click="ws.sim.step(-1)"
            >
              <v-icon icon="mdi-minus" size="18" />
            </button>
            <input
              :id="ids.dist"
              class="sm-rg"
              type="range"
              data-sim="dist"
              :min="SIM_MIN"
              :max="SIM_MAX"
              :step="SIM_STEP"
              :value="ws.sim.dist"
              :style="{ '--r': ratio }"
              :aria-valuetext="`${km} km`"
              @input="onDist"
            />
            <button
              type="button"
              class="sm-step"
              data-sim="dist-plus"
              aria-label="Više za 0,5 km"
              @click="ws.sim.step(1)"
            >
              <v-icon icon="mdi-plus" size="18" />
            </button>
          </div>
        </div>

        <!-- Zona: bez nje se zona ne uzima u obzir ("Svejedno"). Pad učitavanja ne gasi ostatak primjera. -->
        <div class="sm-f">
          <template v-if="zonesFailed">
            <span class="sm-l">Zona</span>
            <TintAlert tone="warn" role="status" data-pricing="sim-zones-error">
              Zone nisu učitane. {{ ws.zones.loadReason }}
              <template #action>
                <button type="button" class="sm-link" data-pricing="sim-zones-retry" @click="ws.zones.reload()">
                  Pokušaj ponovo
                </button>
              </template>
            </TintAlert>
          </template>
          <template v-else>
            <label :for="ids.zone" class="sm-l">Zona</label>
            <div class="sm-sel">
              <select
                :id="ids.zone"
                v-model="ws.sim.zoneId"
                data-sim="zone"
                :disabled="zonesLoading"
                :aria-busy="zonesLoading ? 'true' : undefined"
              >
                <option :value="null">{{ zonesLoading ? "Učitavam zone…" : "Svejedno" }}</option>
                <option v-for="z in ws.zones.list" :key="z.id" :value="z.id">{{ z.name }}</option>
              </select>
              <v-icon icon="mdi-chevron-down" size="20" class="sm-sel-ic" />
            </div>
          </template>
        </div>

        <!-- "Šta ako": dodir prebacuje doplatu samo u primjeru; cjenovnik se ne mijenja. -->
        <fieldset v-if="chips.length > 0" class="sm-chs" :aria-describedby="ids.help" data-pricing="sim-sur">
          <legend>Doplate u primjeru</legend>
          <div class="sm-chrow">
            <button
              v-for="c in chips"
              :key="c.id"
              type="button"
              class="sm-ch"
              :class="{ 'is-diff': c.diff }"
              :aria-pressed="c.on ? 'true' : 'false'"
              :data-sim-sur="c.id"
              @click="ws.sim.toggleOver(c.id)"
            >
              <v-icon v-if="c.on" icon="mdi-check" size="16" />
              {{ c.name }}
              <span v-if="c.diff" class="sm-vh">, razlikuje se od stvarnog stanja</span>
            </button>
          </div>
        </fieldset>
        <p v-if="chips.length > 0" :id="ids.help" class="sm-f-t sm-help" aria-live="polite">
          <template v-if="ws.sim.hasOver">
            <span>Primjer se razlikuje od stvarnog stanja.</span>
            <button type="button" class="sm-link" data-pricing="sim-reset" @click="ws.sim.resetOver()">
              Vrati na stvarno
            </button>
          </template>
          <span v-else>Prikazano je stvarno stanje. Dodirni doplatu da vidiš „šta ako“. Ne mijenja cjenovnik.</span>
        </p>
      </div>

      <!-- Kupac plaća: nacrt cijene sa doplatama iz primjera. -->
      <div class="sm-tot" role="group" aria-label="Kupac plaća" data-pricing="sim-total-card">
        <div class="sm-tot-h">
          <span aria-hidden="true">Kupac plaća</span>
          <b data-pricing="sim-total">{{ formatNum2(ws.calc.draft.total) }}<small>{{ ws.company.currency }}</small></b>
        </div>
        <dl data-pricing="sim-lines">
          <div>
            <dt>Startna cijena</dt>
            <dd>{{ formatNum2(ws.calc.draft.base) }}</dd>
          </div>
          <div>
            <dt>{{ km }} km × {{ formatNum2(ws.price.numbers.km) }}</dt>
            <dd>{{ formatNum2(ws.calc.draft.perKm) }}</dd>
          </div>
          <div v-for="line in ws.calc.draft.lines" :key="line.id" class="sx">
            <dt>+ {{ line.name }}</dt>
            <dd>{{ formatNum2(line.amount) }}</dd>
          </div>
        </dl>
        <div v-if="ws.calc.diff.changed" class="sm-tot-d" data-pricing="sim-diff">
          <v-icon icon="mdi-alert-outline" size="16" />
          <span>{{ diffText }}</span>
        </div>
      </div>

      <!-- Preporučeno vozilo: redom preferencije, uz pravilo koje se poklopilo. -->
      <div v-if="ws.recommended" class="sm-veh" role="group" :aria-labelledby="ids.veh" data-pricing="sim-vehicle">
        <p :id="ids.veh" class="sm-eb">Preporučeno vozilo</p>
        <ol class="sm-rank" data-pricing="sim-vehicles">
          <li v-for="(v, i) in rank" :key="`${v.key}-${i}`" :data-vehicle="v.key">
            <em v-if="i > 0" aria-hidden="true">›</em>
            <v-icon :icon="v.icon" size="18" />
            <span>{{ i + 1 }}. {{ v.label }}</span>
          </li>
        </ol>
        <div class="sm-rule">
          <span class="sm-rule-t" data-pricing="sim-rule">{{ ruleText }}</span>
          <button
            v-if="ws.recommended.rule && ws.recommended.ruleId !== null"
            type="button"
            class="sm-link"
            data-pricing="sim-open-rule"
            :aria-label="`Otvori pravilo: ${ws.recommended.title}`"
            @click="openRule"
          >
            Otvori pravilo
          </button>
        </div>
      </div>
      <div v-else-if="rulesPending" class="sm-veh" aria-busy="true" data-pricing="sim-vehicle">
        <p class="sm-eb">Preporučeno vozilo</p>
        <span class="b sm-sk-veh" role="status" aria-label="Učitavam pravila" />
      </div>
      <div v-else-if="rulesFailed" class="sm-veh" data-pricing="sim-vehicle">
        <p class="sm-eb">Preporučeno vozilo</p>
        <TintAlert tone="warn" role="status" title="Pravila za vozila nisu učitana">
          Preporuka vozila nije dostupna. {{ ws.rules.loadReason }}
          <template #action>
            <button type="button" class="sm-link" data-pricing="sim-rules-retry" @click="ws.rules.reload()">
              Pokušaj ponovo
            </button>
          </template>
        </TintAlert>
      </div>
      <div v-else class="sm-veh" data-pricing="sim-vehicle" data-match="none">
        <p class="sm-eb">Preporučeno vozilo</p>
        <TintAlert tone="warn" title="Nijedno pravilo se ne poklapa">Dodaj zadano pravilo u tabu Vozila.</TintAlert>
      </div>

      <!-- Provjera B5: klijentski i serverski obračun se razlikuju. Nije greška, pa je diskretno. -->
      <TintAlert v-if="mismatch" tone="info" data-pricing="sim-mismatch">{{ mismatch }}</TintAlert>

      <div class="sm-foot">
        <p class="sm-f-t">Pregled za odabrani primjer. Cijenu za narudžbu računa server.</p>
        <p v-if="ws.server.loadFailed" class="sm-f-t" data-pricing="sim-server-note">
          Primjer nije osvježen sa servera; obračun je izračunat u aplikaciji.
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import {
  SIM_MAX,
  SIM_MIN,
  SIM_STEP,
  formatKm,
  formatMoney,
  formatNum2,
  ruleVehicleView,
} from "~/utils/pricing";

// Primjer narudžbe: udaljenost, zona i doplate "šta ako" na ulazu; cijena, preporučena vozila i pravilo na
// izlazu. Ništa se ne računa ovdje: obračun i izbor pravila su u radnom prostoru (ws.calc, ws.recommended),
// komponenta samo prikazuje i prosljeđuje dodire. Kartica (računar, desna kolona) ili samo tijelo (`bare`, donji
// list na telefonu). Ne zove mrežu osim "Pokušaj ponovo" koji ide kroz ws.
const props = withDefaults(defineProps<{ ws: PricingWorkspace; bare?: boolean }>(), { bare: false });

const uid = useId();
const ids = {
  title: `sm-t-${uid}`,
  dist: `sm-dist-${uid}`,
  zone: `sm-zone-${uid}`,
  help: `sm-help-${uid}`,
  veh: `sm-veh-${uid}`,
};

// Stanja učitavanja: obračun postoji tek kad su cijena i doplate stigle (ws.calc).
const loading = computed(() => props.ws.price.loading || props.ws.surcharges.loading);
const failed = computed(() => props.ws.price.loadFailed || props.ws.surcharges.loadFailed);

const zonesLoading = computed(() => props.ws.zones.loading && props.ws.zones.list.length === 0);
// Zone koje su ranije stigle ostaju upotrebljive i kad osvježavanje padne; poruka samo kad nemamo nijednu.
const zonesFailed = computed(() => props.ws.zones.loadFailed && props.ws.zones.list.length === 0);

// Bez učitanih pravila "Nijedno pravilo se ne poklapa" bi lagalo, pa se razlikuju učitavanje i pad.
const rulesPending = computed(() => props.ws.rules.loading && props.ws.rules.list.length === 0);
const rulesFailed = computed(() => props.ws.rules.loadFailed && props.ws.rules.list.length === 0);

const km = computed(() => formatKm(props.ws.sim.dist));
// Udio popunjene trake (0 do 1): CSS ga koristi da oboji dio trake do ručice.
const ratio = computed(() => (props.ws.sim.dist - SIM_MIN) / (SIM_MAX - SIM_MIN));

// Napomene nemaju iznos, pa ne mijenjaju cijenu i nemaju šta da se uključi u primjeru.
const chips = computed(() =>
  props.ws.surcharges.list
    .filter((s) => s.type !== "note")
    .map((s) => ({
      id: s.id,
      name: s.name,
      on: props.ws.sim.active[s.id] === true,
      diff: s.id in props.ws.sim.over,
    }))
);

const rank = computed(() =>
  (props.ws.recommended?.vehicles ?? []).map((key) => ({ key, ...ruleVehicleView(key) }))
);

// "Pravilo 2 · Zona: Centar"; zadano pravilo i pravilo koje se ne nalazi u listi nemaju redni broj.
const ruleText = computed(() => {
  const r = props.ws.recommended;
  if (!r) return "";
  return r.index !== null && r.index >= 0 ? `Pravilo ${r.index + 1} · ${r.title}` : r.title;
});

const diffText = computed(() => {
  const d = props.ws.calc?.diff;
  if (!d?.changed) return "";
  return `Nacrt: sačuvano je ${formatMoney(d.before, props.ws.company.currency)} (${d.up ? "+" : "−"}${formatNum2(Math.abs(d.delta))})`;
});

const mismatch = computed(() => {
  const m = props.ws.priceMismatch;
  if (!m) return "";
  const cur = props.ws.company.currency;
  return `Server računa drugačije: ${formatMoney(m.server, cur)} umjesto ${formatMoney(m.client, cur)}.`;
});

// Klizač šalje tekst; workspace ga svodi na granice i korak od 0,5 km.
const onDist = (e: Event) => {
  props.ws.sim.setDist(Number((e.target as HTMLInputElement).value));
};

const openRule = () => {
  const id = props.ws.recommended?.ruleId;
  if (id != null) props.ws.view.openRule(id);
};
</script>

<style scoped>
.sm {
  display: grid;
  gap: 16px;
  align-content: start;
  min-width: 0;
  color: #0b1220;
}

/* Računar: kartica se lijepi uz vrh dok se lijeva strana skroluje (kao detalj na Firmi) i skroluje se iznutra
   ako je viša od prozora. Da bi se lijepila, kolona u kojoj stoji mora biti visoka kao red mreže. */
.sm--card {
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 100px);
  max-height: calc(100dvh - 100px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: 18px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

/* Donji list: razmak i okvir daje AppSheet; samo prostor za donju ivicu uređaja. */
.sm--bare {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.sm-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sm-t {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

/* #9a4a07 na #fff2df je 5.7:1. */
.sm-draft {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 2px 12px;
  border-radius: 999px;
  background: #fff2df;
  color: #9a4a07;
  font-size: 0.76rem;
  font-weight: 800;
}

.sm-draft i {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e08a14;
}

.sm-in {
  display: grid;
  gap: 14px;
}

.sm-f {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.sm-l {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0b1220;
}

.sm-dv {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.sm-out {
  font-size: 1.02rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.sm-dr {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  gap: 8px;
  align-items: center;
}

.sm-step {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1.5px solid #dfe3ea;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  cursor: pointer;
}

.sm-step:hover {
  background: #e7eaef;
}

.sm-step:active {
  background: #dde1e8;
}

.sm-step:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

/* Klizač: popunjeni dio #2459c7 (6.3:1 prema bijeloj), prazni dio #8a94a3 (3.1:1), ručica tamna sa bijelim
   prstenom. Stari klizač je imao istu boju trake, ispune i ručice kao kartica, pa se nije vidio. */
.sm-rg {
  --fill: calc(13px + (100% - 26px) * var(--r, 0));
  width: 100%;
  height: 44px;
  margin: 0;
  background: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.sm-rg::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(to right, #2459c7 var(--fill), #8a94a3 var(--fill));
}

.sm-rg::-moz-range-track {
  height: 8px;
  border-radius: 999px;
  background: #8a94a3;
}

.sm-rg::-moz-range-progress {
  height: 8px;
  border-radius: 999px;
  background: #2459c7;
}

.sm-rg::-webkit-slider-thumb {
  -webkit-appearance: none;
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  margin-top: -9px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #0b1220;
  box-shadow: 0 0 0 1.5px #0b1220, 0 2px 6px rgba(0, 0, 0, 0.25);
}

.sm-rg::-moz-range-thumb {
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: #0b1220;
  box-shadow: 0 0 0 1.5px #0b1220, 0 2px 6px rgba(0, 0, 0, 0.25);
}

.sm-rg:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 8px;
}

.sm-sel {
  position: relative;
}

.sm-sel select {
  width: 100%;
  min-height: 52px;
  padding: 0 40px 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.sm-sel select:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-color: #2f6fed;
}

.sm-sel select:disabled {
  background: #f5f6f8;
  color: #46505f;
  cursor: default;
}

.sm-sel-ic {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  color: #5b6676;
  pointer-events: none;
}

.sm-chs {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.sm-chs legend {
  margin-bottom: 8px;
  padding: 0;
  font-size: 0.8rem;
  font-weight: 700;
}

.sm-chrow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sm-ch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.sm-ch:hover {
  border-color: #c7ccd4;
}

/* #04382a na #e3f8ef je 11:1; stanje nije samo u boji: uključena doplata ima kvačicu. */
.sm-ch[aria-pressed="true"] {
  border-color: #00734f;
  background: #e3f8ef;
  color: #04382a;
}

.sm-ch .v-icon {
  color: #00734f;
}

/* Razlikuje se od stvarnog stanja: isprekidan rub, tamniji da se vidi i na bijeloj podlozi. */
.sm-ch.is-diff {
  border-style: dashed;
  border-color: #5b6676;
}

.sm-ch.is-diff[aria-pressed="true"] {
  border-color: #00734f;
}

.sm-ch:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.sm-f-t {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
  color: #5b6676;
}

.sm-help {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 6px;
}

.sm-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 4px;
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

.sm-link:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 6px;
}

/* Unutar TintAlert-a dugme nasljeđuje boju poruke (#5c3305 / #17408f), pa je kontrast kao kod poruke. */
.sm :deep(.tint-action) .sm-link {
  color: inherit;
}

.sm-tot {
  display: grid;
  gap: 10px;
  padding: 16px 16px 14px;
  border-radius: 16px;
  background: #0b1220;
  color: #fff;
}

.sm-tot-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.sm-tot-h span {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #bfc6d1;
}

/* #00d290 na #0b1220 je 9.3:1. */
.sm-tot-h b {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  color: #00d290;
  font-variant-numeric: tabular-nums;
}

.sm-tot-h b small {
  margin-left: 4px;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0;
  color: #d3d9e2;
}

.sm-tot dl {
  display: grid;
  gap: 6px;
  margin: 0;
  font-size: 0.86rem;
  color: #d3d9e2;
  font-variant-numeric: tabular-nums;
}

.sm-tot dl > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.sm-tot dt {
  min-width: 0;
  overflow-wrap: anywhere;
}

.sm-tot dd {
  margin: 0;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}

.sm-tot dl .sx dd {
  color: #ffc247;
}

.sm-tot-d {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #2c3445;
  font-size: 0.8rem;
  font-weight: 700;
  color: #ffd98a;
}

.sm-veh {
  display: grid;
  gap: 10px;
}

.sm-eb {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #5b6676;
}

.sm-rank {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
  font-weight: 700;
}

.sm-rank li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sm-rank em {
  font-style: normal;
  color: #657083;
}

.sm-rule {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 10px;
  padding: 6px 12px;
  border-radius: 14px;
  background: #eef4ff;
}

.sm-rule-t {
  min-width: 0;
  padding: 6px 0;
  font-size: 0.84rem;
  font-weight: 700;
  color: #17408f;
  overflow-wrap: anywhere;
}

.sm-foot {
  display: grid;
  gap: 4px;
}

.sm-na {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 16px;
  text-align: center;
  font-size: 0.88rem;
  color: #5b6676;
}

.sm-na p {
  margin: 0;
}

.sm .sm-retry {
  width: auto;
}

.sm-vh {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.b {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: sm-shimmer 1.3s linear infinite;
}

.sm-sk {
  display: grid;
  gap: 14px;
}

.sm-sk-l {
  width: 36%;
  height: 14px;
}

.sm-sk-in {
  height: 44px;
}

.sm-sk-sel {
  height: 52px;
  border-radius: 14px;
}

.sm-sk-row {
  display: flex;
  gap: 8px;
}

.sm-sk-chip {
  width: 84px;
  height: 44px;
  border-radius: 999px;
}

.sm-sk-tot {
  height: 150px;
  border-radius: 16px;
}

.sm-sk-veh {
  width: 70%;
  height: 44px;
}

@keyframes sm-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b {
    animation: none;
  }
}
</style>
