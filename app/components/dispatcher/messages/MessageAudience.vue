<template>
  <div class="au">
    <div v-if="state === 'loading'" class="au-tiles" role="status" aria-label="Učitavam grupe">
      <i v-for="n in 6" :key="n" class="b" style="height: 76px; border-radius: 16px" />
    </div>

    <div v-else-if="state === 'error' || state === 'empty' || state === 'nofirm'" class="au-notes">
      <TintAlert
        :tone="state === 'error' ? 'bad' : 'warn'"
        :icon="state === 'error' ? 'mdi-cloud-off-outline' : 'mdi-account-group-outline'"
        :title="
          state === 'error'
            ? 'Spisak kurira nije učitan'
            : state === 'nofirm'
              ? 'Nema dostavne firme'
              : 'Firma nema kurira'
        "
      >
        {{
          state === "error"
            ? "Primaoce ne mogu da izaberem dok se spisak ne učita. Tekst poruke ostaje kakav jeste."
            : "Poruku nema kome da se pošalje."
        }}
        <template v-if="state === 'error'" #action>
          <button type="button" data-messages="retry-audience" @click="emit('retry')">Pokušaj ponovo</button>
        </template>
      </TintAlert>
    </div>

    <template v-else>
      <div class="au-tiles" role="radiogroup" aria-label="Grupa primalaca" @keydown="onKey">
        <button
          v-for="k in PRESET_ORDER"
          :key="k"
          type="button"
          class="au-pt"
          role="radio"
          :aria-checked="isChecked(k)"
          :aria-disabled="!available(k) ? 'true' : undefined"
          :title="!available(k) ? 'Izvor podataka trenutno ne radi' : undefined"
          :tabindex="k === tabKey ? 0 : -1"
          :aria-label="`${PRESETS[k].label}, ${available(k) ? couriersText(counts[k]) : 'nije dostupno'}`"
          :data-preset="k"
          :style="{ '--tint': PRESET_TONE[k].tint, '--ink': PRESET_TONE[k].ink }"
          @click="pick(k)"
        >
          <span class="ic"><v-icon :icon="PRESETS[k].icon" size="18" /></span>
          <span class="n">{{ available(k) ? counts[k] : "–" }}</span>
          <b>{{ PRESETS[k].label }}</b>
        </button>
      </div>

      <div class="au-sum" :class="{ 'is-zero': audience.length === 0 }" role="status" aria-live="polite">
        <span class="ic">
          <v-icon :icon="audience.length === 0 ? 'mdi-alert-outline' : 'mdi-account-group-outline'" size="22" />
        </span>
        <span class="tx">
          <b>{{ audience.length === 0 ? "Nikoga nije izabrano" : couriersText(audience.length) }}</b>
          <em>{{ summaryText }}</em>
        </span>
        <span class="acts">
          <button v-if="phone" type="button" class="lnk" data-messages="pick" @click="emit('pick')">
            Izaberi ručno
          </button>
          <button
            v-if="selection.kind === 'manual' && audience.length"
            type="button"
            class="lnk"
            data-messages="back-active"
            @click="pick('active')"
          >
            Svi aktivni
          </button>
        </span>
      </div>

      <div v-if="notes.length" class="au-notes">
        <TintAlert v-for="note in notes" :key="note.title" tone="warn" :icon="note.icon" :title="note.title">
          {{ note.text }}
        </TintAlert>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { RosterState } from "~/composables/useCourierRoster";
import { couriersText, type RosterCourier } from "~/utils/courierRoster";
import {
  PRESETS,
  PRESET_ORDER,
  PRESET_TONE,
  audienceText,
  presetAvailable,
  suspendedIn,
  suspendedText,
  type PresetKey,
  type Selection,
  type SourcesOk,
} from "~/utils/messageAudience";

// "Kome": šest gotovih grupa (pravila računata u času slanja) i zbir ko tačno dobija poruku. Izvor
// koji ne radi gasi samo svoje grupe, uz objašnjenje. Grupe su radiogroup: strelice mijenjaju izbor.
const props = defineProps<{
  state: RosterState;
  selection: Selection;
  counts: Record<PresetKey, number>;
  sources: SourcesOk;
  audience: RosterCourier[];
  // Telefon: izbor kurira ručno je list, pa se nudi dugme.
  phone: boolean;
}>();

const emit = defineEmits<{ preset: [PresetKey]; pick: []; retry: [] }>();

const available = (k: PresetKey) => presetAvailable(k, props.sources);
const isChecked = (k: PresetKey) => props.selection.kind === "preset" && props.selection.key === k;
// Jedini Tab: izabrana grupa, a pri ručnom izboru prva.
const tabKey = computed<PresetKey>(() =>
  props.selection.kind === "preset" ? props.selection.key : (PRESET_ORDER[0] as PresetKey)
);

const pick = (k: PresetKey) => {
  if (available(k)) emit("preset", k);
};

const onKey = (event: KeyboardEvent) => {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const items = PRESET_ORDER.filter(available);
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-preset]");
  const at = items.indexOf((target?.dataset.preset ?? "") as PresetKey);
  if (at < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (at + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  const key = items[next];
  if (!key) return;
  emit("preset", key);
  void Promise.resolve().then(() =>
    (event.currentTarget as HTMLElement | null)
      ?.querySelector<HTMLElement>(`[data-preset="${key}"]`)
      ?.focus({ preventScroll: true })
  );
};

const summaryText = computed(() => {
  const list = props.audience;
  if (list.length === 0) {
    return props.selection.kind === "preset"
      ? "U ovoj grupi trenutno nema kurira."
      : "Izaberi kurire u listi ili uzmi gotovu grupu iznad.";
  }
  const sus = suspendedIn(list);
  return `${audienceText(list)}${sus ? ` · ${suspendedText(sus)}` : ""}`;
});

const notes = computed(() => {
  const out: { title: string; text: string; icon: string }[] = [];
  if (!props.sources.locations) {
    out.push({
      title: "Stanje uživo trenutno nije dostupno",
      text: "Grupe „U dostavi“, „Slobodni“ i „Offline“ su isključene dok se pozicije ne vrate. Ostalo radi.",
      icon: "mdi-map-marker-off-outline",
    });
  }
  if (!props.sources.balances) {
    out.push({
      title: "Dugovanja trenutno nisu dostupna",
      text: "Grupa „Duguju gotovinu“ je isključena dok se podaci o novcu ne vrate.",
      icon: "mdi-cash-multiple",
    });
  }
  return out;
});
</script>

<style scoped>
.au-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 0 16px;
}

.au-pt {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 8px;
  row-gap: 8px;
  min-height: 76px;
  padding: 10px 12px;
  border: 1.5px solid #dfe3ea;
  border-radius: 16px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

.au-pt:active {
  background: #f1f4f9;
}

.au-pt:focus-visible,
.lnk:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.au-pt .ic {
  display: grid;
  grid-column: 1;
  grid-row: 1;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--tint);
  color: var(--ink);
}

.au-pt .n {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
  font-size: 1.3rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.au-pt b {
  grid-column: 1 / -1;
  grid-row: 2;
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.2;
}

.au-pt[aria-checked="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  box-shadow: inset 0 0 0 1px #2f6fed;
}

.au-pt[aria-checked="true"] .n,
.au-pt[aria-checked="true"] b {
  color: #2459c7;
}

.au-pt[aria-disabled="true"] {
  opacity: 0.6;
  cursor: not-allowed;
}

.au-sum {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  margin: 10px 16px 0;
  padding: 12px 14px;
  border: 1px solid #eceef2;
  border-radius: 14px;
  background: #fff;
}

.au-sum .ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #eef4ff;
  color: #2459c7;
}

.au-sum.is-zero .ic {
  background: #fff2df;
  color: #9a4a07;
}

.au-sum .tx b {
  display: block;
  font-size: 0.98rem;
  font-weight: 800;
}

.au-sum .tx em {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.8rem;
  font-style: normal;
  color: #5b6676;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.acts {
  display: flex;
  align-items: center;
  gap: 2px;
}

.lnk {
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.au-notes {
  display: grid;
  gap: 8px;
  padding: 10px 16px 0;
}

.b {
  display: block;
  background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 50%, #eef0f4 100%);
  background-size: 200% 100%;
  animation: au-sh 1.3s linear infinite;
}

@keyframes au-sh {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 699px) {
  .au-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 0 12px;
  }

  .au-pt {
    grid-template-columns: 28px minmax(0, 1fr);
    min-height: 64px;
    padding: 8px 10px;
    row-gap: 4px;
  }

  .au-pt .ic {
    width: 28px;
    height: 28px;
    border-radius: 9px;
  }

  .au-sum {
    grid-template-columns: 40px minmax(0, 1fr);
    margin: 10px 12px 0;
  }

  .au-sum .acts {
    grid-column: 1 / -1;
    justify-content: flex-start;
    margin-top: -4px;
  }

  .au-notes {
    padding: 10px 12px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b {
    animation: none;
  }

  .au-pt {
    transition: none;
  }
}
</style>
