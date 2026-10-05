<template>
  <div
    class="sr"
    :class="{ off: !surcharge.active, 'is-open': open, 'is-flash': flash, 'is-busy': busy }"
    :data-surcharge="surcharge.id"
  >
    <!-- Dugme reda i prekidač su dvije odvojene mete: dodir prekidača ne otvara editor. -->
    <button
      type="button"
      class="sr-main"
      :data-surcharge-open="surcharge.id"
      :aria-expanded="wide ? open : undefined"
      :aria-haspopup="wide ? undefined : 'dialog'"
      :aria-label="openLabel"
      @click="emit('open')"
    >
      <span class="sr-ic"><v-icon :icon="icon" size="20" /></span>
      <span class="sr-t">
        <b>{{ surcharge.name }}</b>
        <em>{{ summary }} · {{ schedule }}</em>
        <span class="sr-tag" :class="`is-${status.tone}`">{{ status.text }}</span>
      </span>
      <span class="sr-end"><v-icon :icon="open ? 'mdi-chevron-up' : 'mdi-chevron-right'" size="20" /></span>
    </button>

    <span class="sr-sw">
      <input
        type="checkbox"
        role="switch"
        class="sr-in"
        :checked="surcharge.active"
        :data-surcharge-toggle="surcharge.id"
        :aria-label="toggleLabel"
        :aria-busy="busy ? 'true' : undefined"
        @change="onChange"
      />
      <i aria-hidden="true" />
    </span>

    <p v-if="error" class="sr-err" role="alert" data-pricing="row-error">
      <v-icon icon="mdi-alert-circle-outline" size="18" />
      <span>{{ error }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from "vue";
import type { Surcharge } from "~/types/pricing";
import { conditionTagDisplayIcon } from "~/utils/conditionTag";
import { surchargeScheduleText, surchargeStatus, surchargeSummary } from "~/utils/pricing";
import { DEFAULT_SURCHARGE_ICON } from "~/utils/pricingDrafts";

// Red jedne doplate: ikona, naziv, "+0,30 KM/km · Ručno", oznaka stanja i prekidač. Red samo prikazuje i javlja
// šta je dispečer uradio (open, toggle); mrežu i obavijesti vodi tab. Oznaka stanja je tekst na tamnom tonu,
// ne prozirnost: "isključeno" se čita i bez boje i ostaje u kontrastu.
const props = withDefaults(
  defineProps<{
    surcharge: Surcharge;
    currency: string;
    // Trenutak za "Na snazi 1 h 12 min": dolazi sa taba, da svi redovi koriste isti sat.
    now: number;
    // Računar: editor se otvara u listi (aria-expanded). Telefon: donji list (aria-haspopup).
    wide?: boolean;
    // Editor ovog reda je otvoren (samo računar).
    open?: boolean;
    // Red je upravo sačuvan: kratko pozeleni.
    flash?: boolean;
    // Poruka kad prekidač nije prošao; prekidač je već vraćen na staro stanje.
    error?: string;
    // Prekidač se čuva.
    busy?: boolean;
  }>(),
  { wide: true, open: false, flash: false, error: undefined, busy: false }
);

const emit = defineEmits<{ open: []; toggle: [] }>();

const icon = computed(() => {
  const s = props.surcharge;
  // Katalog nosi Tabler ikonu (ti-*) koju aplikacija ne crta, pa se ikona uzima iz mape po ključu taga.
  if (s.condition_tag) return conditionTagDisplayIcon(s.condition_tag);
  return s.icon && s.icon.startsWith("mdi-") ? s.icon : DEFAULT_SURCHARGE_ICON;
});

const summary = computed(() => surchargeSummary(props.surcharge, props.currency));
const schedule = computed(() => surchargeScheduleText(props.surcharge));
const status = computed(() => surchargeStatus(props.surcharge, props.now));

const openLabel = computed(
  () => `Uredi doplatu ${props.surcharge.name}. ${summary.value}. ${status.value.text}`
);
const toggleLabel = computed(
  () => `${props.surcharge.active ? "Isključi" : "Uključi"} doplatu ${props.surcharge.name}`
);

// Prekidač prati podatak, ne obrnuto: poslije promjene se vraća na ono što podatak kaže (radni prostor ga
// već prebacio, ili je odbio jer je prethodna izmjena u toku). Red se pri promjeni stanja seli iz grupe
// "na snazi" u "isključene", a premještanje čvora u DOM-u uzima fokus, pa se vraća da tastatura ne ostane bez mjesta.
const onChange = (event: Event) => {
  const el = event.currentTarget as HTMLInputElement;
  const hadFocus = document.activeElement === el;
  emit("toggle");
  void nextTick(() => {
    el.checked = props.surcharge.active;
    if (hadFocus && document.activeElement !== el) el.focus();
  });
};
</script>

<style scoped>
.sr {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  gap: 4px;
  align-items: center;
  padding-right: 10px;
  color: #0b1220;
}

.sr.is-flash {
  animation: sr-flash 1.6s ease-out;
}

@keyframes sr-flash {
  0%,
  40% {
    background: #e3f8ef;
  }
  100% {
    background: #fff;
  }
}

.sr-main {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 20px;
  column-gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 68px;
  padding: 12px 6px 12px 14px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sr-main:hover,
.sr.is-open .sr-main {
  background: #f7f8fa;
}

/* Okvir fokusa unutra: kartica liste ima overflow:hidden pa bi vanjski bio odsječen. */
.sr-main:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.sr-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #e3f8ef;
  color: #00734f;
}

.sr.off .sr-ic {
  background: #f1f3f6;
  color: #5b6676;
}

.sr-t {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.sr-t b {
  font-size: 0.96rem;
  font-weight: 800;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.sr-t em {
  font-size: 0.8rem;
  font-style: normal;
  line-height: 1.35;
  color: #5b6676;
}

.sr-tag {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  margin-top: 4px;
  padding: 2px 9px;
  border-radius: 999px;
  background: #f1f3f6;
  color: #46505f;
  font-size: 0.72rem;
  font-weight: 800;
}

.sr-tag.is-on {
  background: #e3f8ef;
  color: #00734f;
}

.sr-tag.is-auto {
  background: #eef4ff;
  color: #2459c7;
}

.sr-end {
  display: grid;
  place-items: center;
  color: #5b6676;
}

/* Prekidač 56 x 44: pravi checkbox sa role=switch, providan preko naslikane staze. */
.sr-sw {
  position: relative;
  width: 56px;
  height: 44px;
}

.sr-in {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.sr.is-busy .sr-in {
  cursor: progress;
}

.sr-sw i {
  position: absolute;
  top: 6px;
  left: 0;
  width: 56px;
  height: 32px;
  border-radius: 999px;
  background: #8a94a3;
  transition: background 0.15s;
}

.sr-sw i::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}

.sr-in:checked + i {
  background: #00734f;
}

.sr-in:checked + i::after {
  transform: translateX(24px);
}

.sr-in:focus-visible + i {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.sr-err {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 4px 10px 62px;
  padding: 8px 10px;
  border-radius: 12px;
  background: #fde8e6;
  color: #7a1810;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.4;
}

.sr-err :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
  color: #b42318;
}

@media (prefers-reduced-motion: reduce) {
  .sr.is-flash {
    animation: none;
  }

  .sr-sw i,
  .sr-sw i::after {
    transition: none;
  }
}
</style>
