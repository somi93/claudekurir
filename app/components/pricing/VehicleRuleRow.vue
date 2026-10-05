<template>
  <div
    class="rr"
    :class="{ 'is-def': fallback, 'is-hit': hit, 'is-flash': flash, 'is-open': open }"
    :data-rule="rule.id"
    :data-rule-fallback="fallback ? '' : undefined"
  >
    <div class="rr-line">
      <span class="rr-n" aria-hidden="true">
        <v-icon v-if="fallback" icon="mdi-infinity" size="15" />
        <template v-else>{{ index + 1 }}</template>
      </span>
      <span class="rr-v" :style="{ '--t': tone.tint, '--k': tone.ink }" aria-hidden="true">
        <v-icon :icon="views[0]?.icon ?? 'mdi-help-circle-outline'" size="22" />
      </span>

      <!-- Cijeli glavni dio je dugme koje otvara editor; strelice su zasebne mete. -->
      <button
        type="button"
        class="rr-m"
        :aria-expanded="open"
        :aria-label="label"
        :data-rule-open="rule.id"
        @click="emit('open', rule.id)"
      >
        <span class="rr-t">
          <b class="rr-name">{{ title }}</b>
          <span v-if="kindText" class="rr-tag" :class="kindTone">{{ kindText }}</span>
          <span v-if="hit" class="rr-tag is-hit" data-pricing="rule-matched">Poklapa se</span>
        </span>
        <span v-if="note" class="rr-s">{{ note }}</span>
        <span class="rr-rank">
          <span v-for="(v, i) in views" :key="i" class="rr-rv">
            <v-icon :icon="v.icon" size="15" />{{ i + 1 }}. {{ v.label }}
            <em v-if="i < views.length - 1" aria-hidden="true">›</em>
          </span>
        </span>
      </button>

      <template v-if="!fallback">
        <button
          type="button"
          class="rr-mv is-up"
          :data-rule-move="`${rule.id}:up`"
          :disabled="!canUp"
          :aria-label="`Pomjeri pravilo ${index + 1} gore`"
          @click="emit('move', rule.id, -1)"
        >
          <v-icon icon="mdi-chevron-up" size="22" />
        </button>
        <button
          type="button"
          class="rr-mv is-down"
          :data-rule-move="`${rule.id}:down`"
          :disabled="!canDown"
          :aria-label="`Pomjeri pravilo ${index + 1} dolje`"
          @click="emit('move', rule.id, 1)"
        >
          <v-icon icon="mdi-chevron-down" size="22" />
        </button>
      </template>
    </div>

    <!-- Greška pomjeranja stoji uz red na koji se odnosi. -->
    <div v-if="error" class="rr-err" role="alert" data-pricing="row-error">
      <v-icon icon="mdi-alert-circle-outline" size="18" />
      <span>{{ error }}</span>
      <button type="button" class="rr-err-x" aria-label="Zatvori poruku" @click="emit('dismissError')">
        <v-icon icon="mdi-close" size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { VehicleRule } from "~/types/pricing";
import { ruleKind, ruleKindLabel, ruleVehicleView } from "~/utils/pricing";

// Red pravila za vozila: broj mjesta, ikona prvog vozila u boji, naslov uslova sa oznakom vrste, napomena
// i vozila redom preferencije ("1. Automobil › 2. Motor"). Zadano pravilo ("Sve ostalo") je isti red bez
// strelica, sa znakom beskonačno umjesto broja. Red ne zna ništa o mreži: javlja šta je dispečer
// uradio (otvori, pomjeri), a stranica odlučuje.
const props = withDefaults(
  defineProps<{
    rule: VehicleRule;
    // Mjesto u listi od 0 (prikazuje se kao index + 1); za zadano pravilo se ne koristi.
    index: number;
    total: number;
    // Naslov uslova ("Zona: Centar"), već izračunat sa nazivima zona i doplata.
    title: string;
    vehicles: readonly string[];
    // Pravilo koje se poklapa sa primjerom narudžbe.
    hit?: boolean;
    // Kratko isticanje poslije snimanja, pomjeranja ili "Otvori pravilo" iz primjera.
    flash?: boolean;
    // Editor ovog pravila je otvoren (aria-expanded).
    open?: boolean;
    canUp?: boolean;
    canDown?: boolean;
    fallback?: boolean;
    // Greška pomjeranja uz ovaj red.
    error?: string;
  }>(),
  { hit: false, flash: false, open: false, canUp: false, canDown: false, fallback: false, error: "" }
);

const emit = defineEmits<{
  open: [id: number];
  move: [id: number, dir: -1 | 1];
  dismissError: [];
}>();

// Boje vozila: tamni ton na blagoj podlozi, kontrast najmanje 4.5 : 1.
const TONES: Record<string, { tint: string; ink: string }> = {
  car: { tint: "#eef4ff", ink: "#2459c7" },
  motorbike: { tint: "#fff2df", ink: "#9a4a07" },
  bicycle: { tint: "#e3f8ef", ink: "#00734f" },
  walk: { tint: "#f1f3f6", ink: "#46505f" },
};
const NEUTRAL_TONE = { tint: "#f1f3f6", ink: "#46505f" };

const views = computed(() => props.vehicles.map((v) => ruleVehicleView(v)));
const tone = computed(() => TONES[props.vehicles[0] ?? ""] ?? NEUTRAL_TONE);

const kind = computed(() => ruleKind(props.rule));
const kindText = computed(() => (props.fallback ? "" : ruleKindLabel(kind.value)));
const kindTone = computed(() => (kind.value === "surcharge" ? "is-amber" : "is-grey"));
const note = computed(() => props.rule.note?.trim() ?? "");

// Ime dugmeta kaže sve što red pokazuje: mjesto, uslov, vozila redom i da li se poklapa.
const label = computed(() => {
  const head = props.fallback
    ? "Uredi zadano pravilo, sve ostalo"
    : `Uredi pravilo ${props.index + 1} od ${props.total}: ${props.title}`;
  const order = views.value.map((v, i) => `${i + 1}. ${v.label}`).join(", ");
  return `${head}. Vozila redom: ${order}${props.hit ? ". Poklapa se u primjeru" : ""}`;
});
</script>

<style scoped>
.rr {
  position: relative;
  min-width: 0;
  /* Da skrol do reda ne završi ispod ljepljivog zaglavlja ili trake primjera. */
  scroll-margin-block: 88px;
  color: #0b1220;
}

.rr-line {
  position: relative;
  display: grid;
  grid-template-columns: 26px 44px minmax(0, 1fr) 44px 44px;
  column-gap: 10px;
  align-items: center;
  min-height: 76px;
  padding: 10px 8px 10px 14px;
}

.rr.is-def .rr-line {
  grid-template-columns: 26px 44px minmax(0, 1fr);
  padding-right: 14px;
}

.rr.is-hit {
  background: #eef4ff;
}

/* Otvoren editor: crna crta uz lijevu ivicu, kao izabran red u Firmi. */
.rr.is-open {
  box-shadow: inset 3px 0 0 #0b1220;
}

.rr.is-def {
  background: #fbfcfd;
}

.rr.is-def.is-hit {
  background: #eef4ff;
}

.rr.is-flash {
  background: #e3f8ef;
}

.rr-n {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #eef1f5;
  color: #46505f;
  font-size: 0.76rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.rr-v {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--t);
  color: var(--k);
}

/* Na plavoj podlozi (red se poklapa) blijedo plava ikona se ne bi vidjela: bijeli obrub je odvaja. */
.rr.is-hit .rr-v {
  box-shadow: 0 0 0 2px #fff;
}

.rr-m {
  display: grid;
  gap: 2px;
  min-width: 0;
  min-height: 56px;
  padding: 4px 6px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rr-m:hover {
  background: rgba(11, 18, 32, 0.04);
}

.rr-m:focus-visible,
.rr-mv:focus-visible,
.rr-err-x:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.rr-t {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
}

.rr-name {
  font-size: 0.96rem;
  font-weight: 800;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.rr-tag {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.rr-tag.is-grey {
  background: #eef1f5;
  color: #46505f;
}

.rr-tag.is-amber {
  background: #fff2df;
  color: #9a4a07;
}

/* Poklapa se: bijela oznaka sa plavim obrubom, jer je podloga reda već plava. */
.rr-tag.is-hit {
  background: #fff;
  color: #2459c7;
  box-shadow: inset 0 0 0 1.5px #2f6fed;
}

.rr-s {
  font-size: 0.82rem;
  line-height: 1.35;
  color: #5b6676;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rr-rank {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #46505f;
}

/* Vozilo se ne lomi na pola ("1." / "Automobil"); razdvojnik ostaje iza njega. */
.rr-rv {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.rr-rv em {
  margin-left: 4px;
  font-style: normal;
  color: #5b6676;
}

.rr-mv {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #46505f;
  cursor: pointer;
}

.rr-mv:hover:not(:disabled) {
  background: #eef1f5;
}

.rr-mv:disabled {
  color: #aab2bf;
  cursor: default;
}

.rr-err {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 44px;
  gap: 8px;
  align-items: center;
  margin: 0 14px 10px;
  padding: 2px 0 2px 12px;
  border-radius: 12px;
  background: #fde8e6;
  color: #7a1810;
  font-size: 0.84rem;
  line-height: 1.4;
}

.rr-err .v-icon {
  color: #b42318;
}

.rr-err-x {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #7a1810;
  cursor: pointer;
}

/* Uzak ekran: strelice se slažu jedna ispod druge (svaka 44 x 44), a broj mjesta postaje značka na uglu
   ikone, da naslov i vozila dobiju širinu. */
@media (max-width: 479px) {
  .rr-line {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    column-gap: 6px;
    padding: 10px 4px 10px 14px;
  }

  .rr.is-def .rr-line {
    grid-template-columns: 44px minmax(0, 1fr);
    padding-right: 10px;
  }

  .rr-v {
    grid-column: 1;
    grid-row: 1 / span 2;
  }

  .rr-m {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  /* Par je sastavljen uz sredinu reda, da strelice ostanu jedna uz drugu i kad je red visok. */
  .rr-mv.is-up {
    grid-column: 3;
    grid-row: 1;
    align-self: end;
  }

  .rr-mv.is-down {
    grid-column: 3;
    grid-row: 2;
    align-self: start;
  }

  .rr-n {
    position: absolute;
    top: 8px;
    left: 3px;
    z-index: 1;
    width: 22px;
    height: 22px;
    border: 2px solid #fff;
    font-size: 0.7rem;
  }

  .rr-err {
    margin: 0 8px 10px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .rr.is-flash {
    animation: rr-flash 1.6s ease-out;
  }
}

@keyframes rr-flash {
  0%,
  40% {
    background: #e3f8ef;
  }

  100% {
    background: #fff;
  }
}
</style>
