<template>
  <div v-if="shown" class="sb">
    <!-- Rezerva u toku stranice iste visine kao traka: traka je fiksna, pa bi inače prekrila kraj sadržaja. -->
    <div class="sb-gap" aria-hidden="true" />
    <button
      type="button"
      class="sb-btn"
      data-pricing="sim-bar"
      aria-haspopup="dialog"
      :aria-expanded="ws.view.simOpen ? 'true' : 'false'"
      @click="ws.view.simOpen = true"
    >
      <span class="sb-a">
        <small>Primjer {{ km }} km<template v-if="ws.price.dirty"> · Nacrt</template></small>
        <b>
          <span class="sb-vh">Kupac plaća </span>{{ total }}<template v-if="vehicle">
            · <em><span class="sb-vh">vozilo </span>{{ vehicle }}</em></template
          >
        </b>
      </span>
      <span class="sb-go">Otvori <v-icon icon="mdi-chevron-up" size="16" /></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import { formatKm, formatMoney, ruleVehicleView } from "~/utils/pricing";

// Traka Primjera narudžbe na dnu telefona (tamna, 64 px): udaljenost, ukupno i prvo preporučeno vozilo;
// dodir otvara donji list (SimulatorSheet). Pokazuje se samo na telefonu i tek kad obračun postoji, jer bez
// cijene ne bi imala šta da pokaže (u učitavanju i padu ne stoji "mrtva" traka). Fiksna je uz donju ivicu
// prozora, a u toku stranice ostavlja prazan prostor iste visine, pa stranica ne treba nikakav dodatni
// padding. Ljepljiva traka nesačuvanog (Cijena) na telefonu treba bottom: calc(64px + safe-area).
const props = defineProps<{ ws: PricingWorkspace }>();

const shown = computed(() => !props.ws.view.wide && props.ws.calc !== null);

const km = computed(() => formatKm(props.ws.sim.dist));
const total = computed(() =>
  props.ws.calc ? formatMoney(props.ws.calc.draft.total, props.ws.company.currency) : ""
);
const vehicle = computed(() => {
  const first = props.ws.recommended?.vehicles[0];
  return first ? ruleVehicleView(first).label : "";
});
</script>

<style scoped>
.sb {
  --sb-safe: max(var(--v-safe-bottom, 0px), env(safe-area-inset-bottom, 0px));
}

.sb-gap {
  height: calc(64px + var(--sb-safe));
}

/* Ispod ladice i dijaloga (Vuetify ih diže iznad 1000), iznad sadržaja stranice. */
.sb-btn {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  min-height: calc(64px + var(--sb-safe));
  padding: 10px 12px calc(10px + var(--sb-safe)) 16px;
  border: 0;
  background: #0b1220;
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sb-btn:active {
  background: #1b2638;
}

/* Prsten unutra: traka je zalijepljena uz ivice prozora, pa bi vanjski bio odsječen. #2f6fed na #0b1220 je 4.1:1. */
.sb-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.sb-a {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.sb-a small {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #bfc6d1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-a b {
  font-size: 1.05rem;
  font-weight: 800;
  color: #fff;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* #00d290 na #0b1220 je 9.3:1. */
.sb-a b em {
  font-style: normal;
  color: #00d290;
}

.sb-go {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  background: #2a3140;
  font-size: 0.84rem;
  font-weight: 800;
}

.sb-vh {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
