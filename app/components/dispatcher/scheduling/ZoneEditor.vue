<template>
  <form class="ze" :aria-label="draft.id ? 'Izmijeni zonu' : 'Nova zona'" novalidate @submit.prevent="emit('save')">
    <h2>{{ draft.id ? "Izmijeni zonu" : "Nova zona" }}</h2>

    <TintAlert v-if="askDiscard" tone="warn" role="alert" title="Imaš nesačuvane izmjene">
      Ako zatvoriš, izmjene se gube.
      <template #action>
        <div class="ze-discard">
          <button type="button" data-discard="keep" @click="emit('keep')">Nastavi uređivanje</button>
          <button type="button" data-discard="drop" @click="emit('drop')">Odbaci izmjene</button>
        </div>
      </template>
    </TintAlert>

    <SheetField
      v-model="draft.name"
      label="Naziv zone"
      name="zone-name"
      placeholder="npr. Centar"
      :message="nameMsg"
      @blur="touchedName = true"
      @update:model-value="touchedName = true"
    />

    <div class="ze-f">
      <div class="ze-lb">Grad</div>
      <div class="ze-city">{{ city }} <span>· grad firme</span></div>
    </div>

    <div class="ze-f">
      <div id="ze-tf-l" class="ze-lb">Faktor terena</div>
      <ChoiceGroup
        :model-value="tfChoice"
        :options="TF_OPTIONS"
        label="Faktor terena"
        variant="pills"
        @update:model-value="onTf"
      />
      <SheetField
        v-if="tfChoice === 'custom'"
        v-model="tfText"
        label="Vrijednost faktora"
        name="zone-tf"
        inputmode="decimal"
        :message="errors.tf ? { tone: 'bad', text: errors.tf } : null"
        @update:model-value="onTfText"
      />
      <p class="ze-hint">Utiče na to koja vozila smiju u zonu (pravila u Cjenovniku, Vozila i pravila).</p>
    </div>

    <div class="ze-f">
      <label class="ze-lb" for="ze-r">Radijus</label>
      <div class="ze-r">
        <button type="button" class="ze-step" aria-label="Smanji radijus" data-field="zone-r-minus" @click="stepR(-100)">
          <v-icon icon="mdi-minus" size="22" />
        </button>
        <div class="ze-range">
          <input
            id="ze-r"
            type="range"
            :min="RADIUS_MIN"
            :max="RADIUS_MAX"
            step="50"
            :value="draft.r"
            :aria-valuetext="fmtKm(draft.r)"
            data-field="zone-r"
            @input="draft.r = Number(($event.target as HTMLInputElement).value)"
          />
        </div>
        <button type="button" class="ze-step" aria-label="Povećaj radijus" data-field="zone-r-plus" @click="stepR(100)">
          <v-icon icon="mdi-plus" size="22" />
        </button>
      </div>
      <p class="ze-read">{{ fmtKm(draft.r) }} · ≈ {{ fmtNum(Math.round(areaKm2(draft.r) * 10) / 10) }} km²</p>
    </div>

    <p class="ze-click"><v-icon icon="mdi-crosshairs-gps" size="16" /><span>Klikni na kartu da pomjeriš centar zone.</span></p>

    <details class="ze-coords">
      <summary>Koordinate centra</summary>
      <div class="ze-two">
        <SheetField
          v-model="latText"
          label="Geografska širina"
          name="zone-lat"
          inputmode="decimal"
          :message="errors.lat ? { tone: 'bad', text: errors.lat } : null"
          @update:model-value="onLat"
          @blur="emit('coords')"
        />
        <SheetField
          v-model="lngText"
          label="Geografska dužina"
          name="zone-lng"
          inputmode="decimal"
          :message="errors.lng ? { tone: 'bad', text: errors.lng } : null"
          @update:model-value="onLng"
          @blur="emit('coords')"
        />
      </div>
    </details>

    <TintAlert v-if="ov.length" tone="info" title="Preklapa se sa drugim zonama">
      {{ ov.slice(0, 3).map((o) => `${o.zone.name} (${o.pct}% manjeg kruga)`).join(", ") }}. Koja zona važi za adresu u
      presjeku, odlučuje server.
    </TintAlert>

    <div class="ze-acts">
      <AppButton variant="ghost" data-field="zone-cancel" @click="emit('cancel')">Odustani</AppButton>
      <AppButton submit :loading="saving" :disabled="blocked" data-field="zone-save">Sačuvaj</AppButton>
    </div>
    <p class="ze-note">{{ note }}</p>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import ChoiceGroup from "~/components/common/ChoiceGroup.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { FieldMsg } from "~/utils/profileForm";
import {
  RADIUS_MAX,
  RADIUS_MIN,
  TERRAIN,
  areaKm2,
  fmtKm,
  fmtNum,
  overlaps,
  parseDecimal,
  validateZone,
  zoneDirty,
  type GeoZone,
  type ZoneDraft,
} from "~/utils/zoneGeo";

// Uređivač zone (nova ili izmjena): naziv, faktor terena sa prečicama (ravno, brdovito, strmo), radijus sa
// površinom, centar se pomjera klikom na kartu (koordinate su pod "Koordinate centra"), preklapanje sa drugim
// zonama je obavijest, ne zabrana. Krug na karti se pomjera uživo dok se kuca. `draft` mijenja ova komponenta,
// a vlasnik (tab Zone) ga prikazuje na karti.
const props = defineProps<{
  draft: ZoneDraft;
  orig: ZoneDraft;
  zones: GeoZone[];
  city: string;
  saving: boolean;
  askDiscard: boolean;
}>();

const emit = defineEmits<{ save: []; cancel: []; keep: []; drop: []; coords: [] }>();

const TF_OPTIONS = [
  ...TERRAIN.map((t) => ({ value: t.v, label: `${t.label} ${t.hint}` })),
  { value: "custom", label: "Drugo" },
];

const touchedName = ref(false);
const tfCustom = ref(false);
const tfText = ref("");
const latText = ref("");
const lngText = ref("");

const fmtCoord = (n: number) => (Number.isFinite(n) ? n.toFixed(5).replace(".", ",") : "");

// Pri otvaranju (nova zona ili druga zona) polja se pune iz nacrta.
watch(
  () => [props.orig.id, props.orig.name, props.orig.lat, props.orig.lng] as const,
  () => {
    touchedName.value = false;
    tfCustom.value = !TERRAIN.some((t) => t.v === Number(props.draft.tf));
    tfText.value = fmtNum(props.draft.tf);
    latText.value = fmtCoord(props.draft.lat);
    lngText.value = fmtCoord(props.draft.lng);
  },
  { immediate: true }
);

// Klik na kartu pomjera centar: polja sa koordinatama prate, osim onog koje se upravo kuca.
const isTyping = (field: string) =>
  typeof document !== "undefined" && (document.activeElement as HTMLElement | null)?.dataset?.field === field;
watch(
  () => props.draft.lat,
  (v) => {
    if (!isTyping("zone-lat")) latText.value = fmtCoord(v);
  }
);
watch(
  () => props.draft.lng,
  (v) => {
    if (!isTyping("zone-lng")) lngText.value = fmtCoord(v);
  }
);

const errors = computed(() => validateZone(props.draft, props.zones));
const nameMsg = computed<FieldMsg | null>(() =>
  errors.value.name && (touchedName.value || props.draft.name) ? { tone: "bad", text: errors.value.name } : null
);
const dirty = computed(() => zoneDirty(props.draft, props.orig) || props.draft.id == null);
const blocked = computed(() => Object.keys(errors.value).length > 0 || props.saving || (!dirty.value && props.draft.id != null));
const note = computed(() =>
  props.saving ? "" : Object.keys(errors.value).length ? "Provjeri polja iznad." : !dirty.value && props.draft.id != null ? "Nema izmjena." : ""
);

const tfChoice = computed<number | "custom">(() =>
  tfCustom.value || !TERRAIN.some((t) => t.v === Number(props.draft.tf)) ? "custom" : Number(props.draft.tf)
);
const onTf = (value: unknown) => {
  if (value === "custom") {
    tfCustom.value = true;
    tfText.value = fmtNum(props.draft.tf);
  } else {
    tfCustom.value = false;
    props.draft.tf = Number(value);
  }
};
const onTfText = (value: string) => {
  props.draft.tf = parseDecimal(value);
};
const onLat = (value: string) => {
  props.draft.lat = parseDecimal(value);
};
const onLng = (value: string) => {
  props.draft.lng = parseDecimal(value);
};
const stepR = (delta: number) => {
  props.draft.r = Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, props.draft.r + delta));
};

const ov = computed(() =>
  Number.isFinite(props.draft.lat) && Number.isFinite(props.draft.lng)
    ? overlaps({ id: props.draft.id, lat: props.draft.lat, lng: props.draft.lng, r: props.draft.r }, props.zones)
    : []
);
</script>

<style scoped>
.ze {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 16px 18px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.ze h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.ze-f {
  display: grid;
  gap: 6px;
}

.ze-lb {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.ze-city {
  padding: 2px 2px 0;
  font-weight: 700;
}

.ze-city span {
  font-size: 0.8rem;
  font-weight: 600;
  color: #5b6676;
}

.ze-hint {
  margin: 0;
  font-size: 0.8rem;
  color: #5b6676;
}

.ze-r {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: stretch;
  gap: 6px;
}

.ze-step {
  display: grid;
  place-items: center;
  min-height: 52px;
  border: 0;
  border-radius: 14px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.ze-step:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.ze-range {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 10px;
  border-radius: 14px;
  background: #f5f6f8;
}

.ze-range input {
  width: 100%;
  accent-color: #0b1220;
}

.ze-read {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
}

.ze-click {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 0.84rem;
  color: #5b6676;
}

.ze-coords summary {
  min-height: 32px;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.ze-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.ze-acts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.ze-acts :deep(.ab) {
  min-height: 52px;
}

.ze-note {
  min-height: 1.1em;
  margin: -6px 0 0;
  font-size: 0.78rem;
  color: #5b6676;
  text-align: right;
}

.ze-discard {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

@media (max-width: 479px) {
  .ze-two {
    grid-template-columns: 1fr;
  }
}
</style>
