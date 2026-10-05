<template>
  <div class="dl-rd" role="group" aria-label="Spremnost za ponude">
    <span class="dl-rd-chip" :class="`is-${gpsTone}`">
      <v-icon icon="mdi-crosshairs-gps" size="16" />
      Lokacija <small>{{ gpsText }}</small>
    </span>

    <span class="dl-rd-chip" :class="`is-${connectionTone}`">
      <v-icon :icon="connection === 'offline' ? 'mdi-wifi-off' : 'mdi-wifi'" size="16" />
      Veza <small>{{ connectionText }}</small>
    </span>

    <component
      :is="pushActionable ? 'button' : 'span'"
      class="dl-rd-chip"
      :class="`is-${pushTone}`"
      :type="pushActionable ? 'button' : undefined"
      @click="pushActionable && emit('request-push')"
    >
      <v-icon :icon="push === 'granted' ? 'mdi-bell-ring-outline' : 'mdi-bell-off-outline'" size="16" />
      Obavještenja <small v-if="pushText">{{ pushText }}</small>
    </component>

    <button
      type="button"
      class="dl-rd-chip"
      :class="{ 'is-ok': soundEnabled }"
      :aria-pressed="soundEnabled"
      @click="emit('toggle-sound')"
    >
      <v-icon :icon="soundEnabled ? 'mdi-volume-high' : 'mdi-volume-off'" size="16" />
      Zvuk <small>{{ soundEnabled ? "uključen" : "isključen" }}</small>
    </button>

    <button
      v-if="awakeSupported"
      type="button"
      class="dl-rd-chip"
      :class="{ 'is-ok': keepAwake }"
      :aria-pressed="keepAwake"
      @click="emit('toggle-awake')"
    >
      <v-icon icon="mdi-cellphone" size="16" />
      Ekran <small>{{ keepAwake ? "ostaje upaljen" : "može da se ugasi" }}</small>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PushPermissionState } from "~/composables/usePushNotifications";

// Pet provjera koje odlučuju hoće li ponuda stići do kurira. Svaka loša ima
// svoju radnju (dodir na čip ili dugme u upozorenju iznad).
const props = defineProps<{
  gps: "ok" | "searching" | "weak" | "blocked" | "unsupported";
  accuracy: number | null;
  connection: "live" | "polling" | "offline";
  push: PushPermissionState;
  soundEnabled: boolean;
  keepAwake: boolean;
  awakeSupported: boolean;
}>();

const emit = defineEmits<{
  "request-push": [];
  "toggle-sound": [];
  "toggle-awake": [];
}>();

const gpsTone = computed(() =>
  props.gps === "ok" ? "ok" : props.gps === "blocked" || props.gps === "unsupported" ? "bad" : "warn"
);
const gpsText = computed(() => {
  switch (props.gps) {
    case "ok":
      return props.accuracy !== null ? `±${Math.round(props.accuracy)} m` : "uključena";
    case "searching":
      return "tražim";
    case "weak":
      return "slab signal";
    case "blocked":
      return "isključena";
    default:
      return "nije podržana";
  }
});

const connectionTone = computed(() =>
  props.connection === "live" ? "ok" : props.connection === "offline" ? "bad" : "warn"
);
const connectionText = computed(() =>
  props.connection === "live" ? "uživo" : props.connection === "offline" ? "nema" : "svakih 15 s"
);

// Obavještenja: uključena = zeleno; još nije pitano = može se uključiti dodirom;
// blokirana ili nepodržana = upozorenje (uputstvo je u panelu iznad).
const pushTone = computed(() => (props.push === "granted" ? "ok" : "warn"));
const pushActionable = computed(() => props.push === "default");
const pushText = computed(() => {
  switch (props.push) {
    case "granted":
      return "";
    case "default":
      return "uključi";
    case "denied":
      return "blokirana";
    default:
      return "nisu podržana";
  }
});
</script>
