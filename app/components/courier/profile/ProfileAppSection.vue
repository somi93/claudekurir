<template>
  <ProfileSection title="Aplikacija">
    <ProfileRow
      :icon="pushView.icon"
      label="Obavještenja"
      :value="pushView.value"
      :tone="pushView.tone"
    >
      <template #end>
        <ProfileChip v-if="push === 'granted'" tone="ok">Radi</ProfileChip>
        <button
          v-else-if="push === 'default'"
          type="button"
          class="pa-mini"
          aria-label="Uključi obavještenja"
          :disabled="pushBusy"
          @click="enablePush"
        >
          Uključi
        </button>
      </template>
    </ProfileRow>
    <TintAlert
      v-if="push === 'denied'"
      class="pa-tint"
      tone="bad"
      icon="mdi-bell-off-outline"
      title="Obavještenja su blokirana"
    >
      Bez njih ponuda ne stiže kad je aplikacija u pozadini. Dodirni katanac pored adrese, uključi
      Obavještenja, pa provjeri ponovo.
      <template #action>
        <button type="button" class="pa-act" :disabled="pushBusy" @click="enablePush">
          Provjeri ponovo
        </button>
      </template>
    </TintAlert>

    <ProfileRow
      :icon="geoView.icon"
      label="Lokacija"
      :value="geoView.value"
      :tone="geoView.tone"
    >
      <template #end>
        <ProfileChip v-if="geo === 'granted'" tone="ok">Radi</ProfileChip>
        <button
          v-else-if="geo === 'prompt'"
          type="button"
          class="pa-mini"
          aria-label="Zatraži dozvolu za lokaciju"
          :disabled="geoBusy"
          @click="enableGeo"
        >
          Zatraži
        </button>
        <button
          v-else-if="geo === 'unknown'"
          type="button"
          class="pa-mini"
          aria-label="Provjeri dozvolu za lokaciju"
          :disabled="geoBusy"
          @click="enableGeo"
        >
          Provjeri
        </button>
      </template>
    </ProfileRow>
    <TintAlert
      v-if="geo === 'denied'"
      class="pa-tint"
      tone="bad"
      icon="mdi-map-marker-outline"
      title="Lokacija je isključena"
    >
      Dodirni katanac pored adrese, pa Lokacija, pa Dozvoli.
      <template #action>
        <button type="button" class="pa-act" :disabled="geoBusy" @click="recheckGeo">
          Provjeri ponovo
        </button>
      </template>
    </TintAlert>

    <ProfileRow
      :icon="soundEnabled ? 'mdi-volume-high' : 'mdi-volume-off'"
      label="Zvuk i vibracija"
      :value="soundEnabled ? 'Uključeno' : 'Isključeno'"
      :tone="soundEnabled ? 'ok' : null"
    >
      <template #end>
        <button v-if="soundEnabled" type="button" class="pa-mini" @click="playTestSound">
          Testiraj
        </button>
        <button
          type="button"
          class="pa-sw"
          role="switch"
          :aria-checked="soundEnabled"
          aria-label="Zvuk i vibracija za novu ponudu"
          @click="setEnabled(!soundEnabled)"
        />
      </template>
    </ProfileRow>

    <template #foot>
      Bez lokacije ponude ne stižu; bez obavještenja ne stižu kad je aplikacija u pozadini.
    </template>
  </ProfileSection>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import ProfileChip from "~/components/courier/profile/ProfileChip.vue";
import ProfileRow from "~/components/courier/profile/ProfileRow.vue";
import ProfileSection from "~/components/courier/profile/ProfileSection.vue";
import { useLocationPermission } from "~/composables/useLocationPermission";
import { usePushNotifications } from "~/composables/usePushNotifications";
import { useSoundNotifications } from "~/composables/useSoundNotifications";
import { useAlertStore } from "~/stores/alert";

// Grupa "Aplikacija": obavještenja, lokacija i zvuk - ono što odlučuje hoće li ponuda stići do
// kurira. Stanje je isto što i "Spremnost" na Dostavama (isti izvori: usePushNotifications,
// useSoundNotifications), pa se ne mogu razilaziti. Svaka loša stavka ima radnju u istom redu.
// Zamjenjuje stranicu Podešavanja.
const props = defineProps<{ courierId: number }>();

const alerts = useAlertStore();

// --- Obavještenja ----------------------------------------------------------------------
const { permissionState: push, syncPermissionState, requestPermissionAndRegister } =
  usePushNotifications();
const pushBusy = ref(false);

onMounted(syncPermissionState);

const PUSH_VIEW = {
  granted: { icon: "mdi-bell-ring-outline", tone: "ok", value: "Uključena" },
  default: { icon: "mdi-bell-off-outline", tone: "warn", value: "Nije uključena" },
  denied: { icon: "mdi-bell-off-outline", tone: "bad", value: "Blokirana u pregledaču" },
  unsupported: { icon: "mdi-bell-off-outline", tone: "warn", value: "Nije podržana u ovom pregledaču" },
} as const;
const pushView = computed(() => PUSH_VIEW[push.value]);

const enablePush = async () => {
  pushBusy.value = true;
  try {
    await requestPermissionAndRegister();
    if (push.value === "granted") alerts.success("Obavještenja su uključena.", 4000);
    else if (push.value === "denied") {
      alerts.warning("Obavještenja su i dalje blokirana u podešavanjima pregledača.", 5000);
    }
  } finally {
    pushBusy.value = false;
  }
};

// --- Lokacija --------------------------------------------------------------------------
const { state: geo, check: checkGeo, request: requestGeo } = useLocationPermission();
const geoBusy = ref(false);

const GEO_VIEW = {
  granted: { icon: "mdi-crosshairs-gps", tone: "ok", value: "Odobrena" },
  prompt: { icon: "mdi-crosshairs-gps", tone: "warn", value: "Nije zatražena" },
  denied: { icon: "mdi-crosshairs-gps", tone: "bad", value: "Odbijena u pregledaču" },
  unknown: { icon: "mdi-crosshairs-gps", tone: "warn", value: "Nije provjerena" },
} as const;
const geoView = computed(() => GEO_VIEW[geo.value]);

const afterGeo = (state: string) => {
  if (state === "granted") alerts.success("Lokacija je odobrena.", 4000);
  else if (state === "denied") {
    alerts.warning("Lokacija je i dalje odbijena u podešavanjima pregledača.", 5000);
  }
};

const enableGeo = async () => {
  geoBusy.value = true;
  try {
    afterGeo(await requestGeo());
  } finally {
    geoBusy.value = false;
  }
};

const recheckGeo = async () => {
  geoBusy.value = true;
  try {
    afterGeo(await checkGeo());
  } finally {
    geoBusy.value = false;
  }
};

// --- Zvuk ------------------------------------------------------------------------------
const { enabled: soundEnabled, setEnabled, playTestSound } = useSoundNotifications(
  computed(() => props.courierId)
);
</script>

<style scoped>
.pa-tint {
  margin: 2px 12px 12px;
}

/* Tekstualno dugme u redu: meta od 44 px. */
.pa-mini {
  min-height: 44px;
  padding: 0 6px 0 10px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.pa-mini:disabled {
  color: #657083;
  cursor: progress;
}

.pa-mini:focus-visible,
.pa-sw:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 0;
  border-radius: 12px;
}

/* Radnja u tonu (TintAlert je ostavlja nižom od 44 px). */
.pa-act {
  min-height: 44px;
  margin: -8px 0;
}

/* Prekidač: dodirna meta 56 x 44, pruga 52 x 32 (bez uključenog stanja samo u boji: ima i riječ). */
.pa-sw {
  position: relative;
  flex: none;
  width: 56px;
  height: 44px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.pa-sw::before {
  content: "";
  position: absolute;
  top: 6px;
  left: 2px;
  width: 52px;
  height: 32px;
  border-radius: 999px;
  background: #8a94a4;
  transition: background 0.15s;
}

.pa-sw::after {
  content: "";
  position: absolute;
  top: 9px;
  left: 5px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(11, 18, 32, 0.3);
  transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pa-sw[aria-checked="true"]::before {
  background: #008a62;
}

.pa-sw[aria-checked="true"]::after {
  transform: translateX(20px);
}

@media (prefers-reduced-motion: reduce) {
  .pa-sw::before,
  .pa-sw::after {
    transition: none;
  }
}
</style>
