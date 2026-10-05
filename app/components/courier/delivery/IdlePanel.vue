<template>
  <div class="dl-panel">
    <div class="dl-sheet-in">
      <div class="dl-idle-h">
        <span class="dl-idle-ic" :class="{ 'dl-idle-ic--bad': gpsBad }">
          <v-icon :icon="gpsBad ? 'mdi-alert-outline' : 'mdi-moped-outline'" size="26" />
        </span>
        <div>
          <div class="dl-title">{{ gpsBad ? "Lokacija je isključena" : "Čekaš ponudu" }}</div>
          <div class="dl-sub">
            {{
              gpsBad
                ? "Bez nje dispečer ne vidi gdje si i ponude ti ne stižu."
                : soundEnabled
                  ? "Nova dostava stiže uz zvuk i vibraciju."
                  : "Nova dostava stiže na ekran."
            }}
          </div>
        </div>
      </div>

      <div v-if="gps === 'blocked'" class="dl-alert dl-alert--bad" role="alert">
        <v-icon icon="mdi-map-marker-outline" size="22" />
        <div>
          <b>Uključi lokaciju u pregledaču</b>
          Dodirni katanac pored adrese, pa Lokacija, pa Dozvoli.
          <div class="dl-alert-act">
            <button type="button" class="dl-btn dl-btn--blue" @click="emit('retry-gps')">
              <v-icon icon="mdi-crosshairs-gps" size="20" /> Uključi lokaciju
            </button>
          </div>
        </div>
      </div>
      <div v-else-if="gps === 'unsupported'" class="dl-alert dl-alert--bad" role="alert">
        <v-icon icon="mdi-map-marker-outline" size="22" />
        <div>
          <b>Pregledač ne podržava lokaciju</b>
          Otvori aplikaciju u drugom pregledaču da bi mogao da radiš.
        </div>
      </div>

      <div v-if="connection === 'offline'" class="dl-alert" role="status">
        <v-icon icon="mdi-wifi-off" size="22" />
        <div>
          <b>Nema veze sa serverom</b>
          Ponude će stići čim se veza vrati.<template v-if="lastSyncLabel">
            Posljednja provjera {{ lastSyncLabel }}.</template
          >
        </div>
      </div>

      <div v-if="push === 'denied'" class="dl-alert" role="status">
        <v-icon icon="mdi-bell-off-outline" size="22" />
        <div>
          <b>Obavještenja su blokirana</b>
          Bez njih ponuda ne stiže kad je aplikacija u pozadini. Dodirni katanac pored adrese,
          uključi Obavještenja, pa provjeri ponovo.
          <div class="dl-alert-act">
            <button type="button" class="dl-btn" @click="emit('request-push')">Provjeri ponovo</button>
          </div>
        </div>
      </div>

      <div v-if="ordersError" class="dl-alert dl-alert--bad" role="alert">
        <v-icon icon="mdi-alert-circle-outline" size="22" />
        <div>
          <b>Ne mogu da učitam dostave</b>
          {{ ordersError }}
          <div class="dl-alert-act">
            <button type="button" class="dl-btn" @click="emit('retry-orders')">Pokušaj ponovo</button>
          </div>
        </div>
      </div>

      <div>
        <div class="dl-eyebrow">Spremnost</div>
        <ReadinessList
          :gps="gps"
          :accuracy="accuracy"
          :connection="connection"
          :push="push"
          :sound-enabled="soundEnabled"
          :keep-awake="keepAwake"
          :awake-supported="awakeSupported"
          @request-push="emit('request-push')"
          @toggle-sound="emit('toggle-sound')"
          @toggle-awake="emit('toggle-awake')"
        />
      </div>

      <div>
        <div class="dl-eyebrow">Danas</div>
        <div class="dl-today">
          <div class="dl-tile">
            <b>{{ deliveriesText }}</b>
            <span>{{ deliveriesLabel }}</span>
          </div>
          <div class="dl-tile">
            <b>{{ wageText }} <small v-if="wage !== null">KM</small></b>
            <span>zarada</span>
          </div>
          <NuxtLink
            to="/courier/wallet"
            class="dl-tile dl-tile--link"
            :aria-label="`Gotovina ${cashText}${cashOwed !== null ? ' KM' : ''}, otvori Novčanik`"
          >
            <b>{{ cashText }} <small v-if="cashOwed !== null">KM</small></b>
            <span>gotovina ›</span>
          </NuxtLink>
        </div>

        <div v-if="cashSummary && cashLimit !== null" class="dl-meter">
          <div class="dl-meter-track" aria-hidden="true">
            <div
              class="dl-meter-fill"
              :class="`is-${cashSummary.state}`"
              :style="{ width: `${cashSummary.percent}%` }"
            />
          </div>
          <div class="dl-meter-row">
            <span>Limit gotovine {{ cashLimit.toFixed(2) }} KM</span>
            <b :class="`is-${cashSummary.state}`">{{ cashSummary.text }}</b>
          </div>
        </div>
        <div v-else-if="cashOwed !== null" class="dl-meter">
          <div class="dl-meter-row"><span>Bez limita gotovine</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ReadinessList from "~/components/courier/delivery/ReadinessList.vue";
import type { PushPermissionState } from "~/composables/usePushNotifications";
import { summarizeCashLimit } from "~/utils/cashLimit";
import { pluralizeSr } from "~/utils/datetime";

const props = defineProps<{
  gps: "ok" | "searching" | "weak" | "blocked" | "unsupported";
  accuracy: number | null;
  connection: "live" | "polling" | "offline";
  lastSyncedAt: Date | null;
  push: PushPermissionState;
  soundEnabled: boolean;
  keepAwake: boolean;
  awakeSupported: boolean;
  ordersError: string;
  deliveries: number | null;
  wage: number | null;
  cashOwed: number | null;
  cashLimit: number | null;
}>();

const emit = defineEmits<{
  "retry-gps": [];
  "request-push": [];
  "toggle-sound": [];
  "toggle-awake": [];
  "retry-orders": [];
}>();

const gpsBad = computed(() => props.gps === "blocked" || props.gps === "unsupported");

const lastSyncLabel = computed(() =>
  props.lastSyncedAt
    ? props.lastSyncedAt.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })
    : ""
);

const deliveriesText = computed(() => (props.deliveries === null ? "—" : String(props.deliveries)));
const deliveriesLabel = computed(() =>
  props.deliveries === null ? "dostave" : pluralizeSr(props.deliveries, "dostava", "dostave", "dostava")
);
const wageText = computed(() => (props.wage === null ? "—" : props.wage.toFixed(2)));
const cashText = computed(() => (props.cashOwed === null ? "—" : props.cashOwed.toFixed(2)));

const cashSummary = computed(() =>
  props.cashOwed !== null && props.cashLimit !== null
    ? summarizeCashLimit(props.cashOwed, props.cashLimit)
    : null
);
</script>
