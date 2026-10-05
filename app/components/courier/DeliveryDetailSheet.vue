<template>
  <v-bottom-sheet
    :model-value="open"
    inset
    max-width="560"
    @update:model-value="emit('update:open', $event)"
  >
    <v-card
      v-if="delivery"
      class="dd"
      rounded="t-xl"
      tabindex="-1"
      :aria-label="`Detalj dostave: ${title}`"
      @keydown="onKeydown"
    >
      <div class="dd-grip" aria-hidden="true"><i /></div>

      <header class="dd-head">
        <div class="dd-head-text">
          <h2 class="dd-title">{{ title }}</h2>
          <p class="dd-sub">{{ subtitle }}</p>
        </div>
        <button
          ref="closeBtn"
          type="button"
          class="dd-ib"
          aria-label="Zatvori"
          @click="emit('update:open', false)"
        >
          <v-icon icon="mdi-close" size="20" />
        </button>
      </header>

      <div ref="bodyEl" class="dd-body">
        <!-- Ruta: iz istorije; bez nje (istorija nije stigla) ostaju samo iznosi. -->
        <section v-if="order" class="dd-sec">
          <div class="dd-stops">
            <div class="dd-stop">
              <div class="dd-rail"><span class="dd-dot dd-dot--pickup" /><span class="dd-line" /></div>
              <div class="dd-txt">
                <span class="dd-k">Preuzimanje</span>
                <strong>{{ delivery.restaurant ?? restaurantLabel(order) }}</strong>
                <span v-if="pickupAddress" class="dd-ad">{{ pickupAddress }}</span>
              </div>
            </div>
            <div class="dd-stop">
              <div class="dd-rail"><span class="dd-dot dd-dot--drop" /></div>
              <div class="dd-txt">
                <span class="dd-k">Dostava</span>
                <strong>{{ delivery.street ?? locationLabel(order) }}</strong>
                <div v-if="unitChips.length" class="dd-units">
                  <span v-for="chip in unitChips" :key="chip" class="dd-unit">{{ chip }}</span>
                </div>
                <span v-if="cityLine" class="dd-ad">{{ cityLine }}</span>
              </div>
            </div>
          </div>

          <p v-if="trip" class="dd-trip">
            <v-icon icon="mdi-clock-outline" size="18" />
            <span>{{ trip }}</span>
          </p>

          <div class="dd-acts">
            <button v-if="fullAddress" type="button" class="dd-chip" @click="copy('addr', fullAddress)">
              <v-icon icon="mdi-content-copy" size="16" />
              {{ copied === "addr" ? "Kopirano" : "Kopiraj adresu" }}
            </button>
            <button type="button" class="dd-chip" @click="copy('id', String(delivery.id))">
              <v-icon icon="mdi-pound" size="16" />
              {{ copied === "id" ? "Kopirano" : `Kopiraj broj ${delivery.id}` }}
            </button>
          </div>
        </section>

        <!-- Obračun nije stigao: jasno kažemo da je to problem sa učitavanjem, ne da je 0. -->
        <section v-if="!earnings && delivery.wage == null" class="dd-sec">
          <div class="dd-alert" role="alert">
            <v-icon icon="mdi-alert-outline" size="22" />
            <div>
              <b>Obračun za ovu dostavu trenutno nije dostupan.</b>
              Dostava je upisana, ali zaradu i naplatu ne mogu da učitam.
              <button v-if="retryable" type="button" @click="emit('retry')">Pokušaj ponovo</button>
            </div>
          </div>
        </section>

        <template v-else>
          <section class="dd-sec">
            <h3 class="dd-label">Naplaćeno od kupca</h3>
            <template v-if="!earnings">
              <p class="dd-muted dd-muted--flush">Detalji naplate još nisu dostupni.</p>
            </template>
            <template v-else-if="earnings.collectedFromCustomer != null">
              <div v-if="earnings.foodCollected != null" class="dd-ln">
                <span>Hrana</span>
                <span>{{ money(earnings.foodCollected) }} KM</span>
              </div>
              <div v-if="earnings.deliveryCollected != null" class="dd-ln">
                <span>Dostava</span>
                <span>{{ money(earnings.deliveryCollected) }} KM</span>
              </div>
              <div class="dd-ln dd-ln--total">
                <span>Ukupno</span>
                <span>{{ money(earnings.collectedFromCustomer) }} KM</span>
              </div>
              <!-- Koliko je ova dostava promijenila dug prema firmi - kad backend pošalje cash_effect
                   (stavka N1, dokument od 04.10.); do tada polje ne postoji pa se ni ne prikazuje. -->
              <div v-if="earnings.cashEffect != null" class="dd-ln dd-ln--effect">
                <span>U dug prema firmi</span>
                <span>{{ earnings.cashEffect < 0 ? "−" : "+" }}{{ money(Math.abs(earnings.cashEffect)) }} KM</span>
              </div>
            </template>
            <p v-else class="dd-muted dd-muted--flush">
              Plaćeno karticom: u gotovini nisi ništa naplatio.
            </p>
            <p v-if="earnings?.paymentTypeLabel" class="dd-muted">
              Način plaćanja: {{ earnings.paymentTypeLabel }}
            </p>
          </section>

          <section class="dd-sec">
            <h3 class="dd-label">Tvoja zarada</h3>
            <template v-if="delivery.payMode === 'monthly'">
              <p class="dd-muted dd-muted--flush">
                Zaradu za ovu dostavu firma obračunava mjesečno.
              </p>
            </template>
            <template v-else-if="delivery.wage != null">
              <div class="dd-ln dd-ln--total dd-ln--green dd-ln--flush">
                <span>{{ earnings?.payRateLabel ?? "Zarada" }}</span>
                <span>+{{ money(delivery.wage) }} KM</span>
              </div>
              <p v-if="earnings?.payRateDetail" class="dd-muted">{{ earnings.payRateDetail }}</p>
            </template>
            <p v-else class="dd-muted dd-muted--flush">Zarada za ovu dostavu još nije obračunata.</p>
          </section>
        </template>

        <p class="dd-rule">
          Gotovinu predaješ u cijelosti, a zaradu ti firma isplaćuje posebno.
          <template v-if="walletHint">
            Stanje i predaje vidiš u
            <NuxtLink to="/courier/wallet" @click="emit('update:open', false)">Novčaniku</NuxtLink>.
          </template>
        </p>
      </div>

      <footer v-if="nav && nav.total > 1" class="dd-foot">
        <button
          ref="newerBtn"
          type="button"
          class="dd-nav"
          :disabled="!nav.hasNewer"
          @click="emit('newer')"
        >
          <v-icon icon="mdi-chevron-left" size="20" />
          {{ nav.labels[0] }}
        </button>
        <span class="dd-pos">{{ nav.position }} od {{ nav.total }}</span>
        <button
          ref="olderBtn"
          type="button"
          class="dd-nav"
          :disabled="!nav.hasOlder"
          @click="emit('older')"
        >
          {{ nav.labels[1] }}
          <v-icon icon="mdi-chevron-right" size="20" />
        </button>
      </footer>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { CourierDelivery } from "~/types/courier-delivery";
import { copyText } from "~/utils/clipboard";
import { parseTimestamp } from "~/utils/datetime";
import { clockOf, money, whenOf } from "~/utils/historyGroups";
import {
  customerCityLine,
  customerFullAddress,
  deliveryUnitChips,
  locationLabel,
  restaurantAddress,
  restaurantLabel,
} from "~/utils/orderDisplay";

// Detalj jedne dostave - ZAJEDNIČKI za Istoriju i Novčanik: ruta (restoran i kupac,
// stan / sprat / firma), vrijeme, šta je naplaćeno od kupca i kolika je zarada.
// Donji list jer je na telefonu u dosegu palca; u Istoriji ima i Novija / Starija
// kroz trenutnu listu (strelice na tastaturi rade isto).
const props = withDefaults(
  defineProps<{
    open: boolean;
    delivery: CourierDelivery | null;
    // Kretanje kroz listu (samo Istorija): mjesto, ukupno, ima li susjeda, nazivi dugmadi.
    nav?: {
      position: number;
      total: number;
      hasNewer: boolean;
      hasOlder: boolean;
      labels: [string, string];
    } | null;
    // Poziv na "Stanje i predaje vidiš u Novčaniku" - samo kad list nije već u Novčaniku.
    walletHint?: boolean;
    // Ponudi "Pokušaj ponovo" kad obračun nije stigao.
    retryable?: boolean;
  }>(),
  { nav: null, walletHint: false, retryable: false }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  newer: [];
  older: [];
  retry: [];
}>();

const order = computed(() => props.delivery?.order ?? null);
const earnings = computed(() => props.delivery?.earnings ?? null);

const title = computed(() => props.delivery?.restaurant ?? `Dostava #${props.delivery?.id ?? ""}`);
const subtitle = computed(() => {
  const d = props.delivery;
  if (!d) return "";
  const when = d.ts != null ? whenOf(d.ts, Date.now()) : "Bez datuma";
  return `${when} · #${d.id}`;
});

const pickupAddress = computed(() => (order.value ? restaurantAddress(order.value) : null));
const cityLine = computed(() => (order.value ? customerCityLine(order.value) : null));
const fullAddress = computed(() => (order.value ? customerFullAddress(order.value) : ""));
const unitChips = computed(() => (order.value ? deliveryUnitChips(order.value) : []));

// "Preuzeto 15:02 → dostavljeno 15:18 · 16 min · 3.4 km" - pojavi se samo kad backend
// pošalje picked_up_at / distance_km (Dio 3 dokumenta od 03.10.).
const trip = computed(() => {
  const d = props.delivery;
  if (!d) return "";
  const parts: string[] = [];
  const pickedAt = parseTimestamp(d.order?.pickedUpAt);
  if (pickedAt != null && d.ts != null && d.ts >= pickedAt) {
    const minutes = Math.round((d.ts - pickedAt) / 60_000);
    parts.push(`Preuzeto ${clockOf(pickedAt)} → dostavljeno ${clockOf(d.ts)} · ${minutes} min`);
  }
  const km = d.order?.distanceKm;
  if (km != null && km >= 0) parts.push(`${km.toFixed(1)} km`);
  return parts.join(" · ");
});

// --- Kopiranje ---------------------------------------------------------------

const copied = ref<"addr" | "id" | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
const copy = async (what: "addr" | "id", text: string) => {
  if (!(await copyText(text))) return;
  copied.value = what;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = null), 1600);
};
onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer);
});

// --- Fokus i tastatura --------------------------------------------------------

const closeBtn = ref<HTMLButtonElement | null>(null);
const newerBtn = ref<HTMLButtonElement | null>(null);
const olderBtn = ref<HTMLButtonElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);

const onKeydown = (event: KeyboardEvent) => {
  if (!props.nav) return;
  if (event.key === "ArrowLeft" && props.nav.hasNewer) {
    event.preventDefault();
    emit("newer");
  } else if (event.key === "ArrowRight" && props.nav.hasOlder) {
    event.preventDefault();
    emit("older");
  }
};

let returnFocusTo: HTMLElement | null = null;

// Fokus ide na dugme za zatvaranje, a po zatvaranju se vraća na red koji je otvorio detalj.
watch(
  () => props.open,
  async (open) => {
    if (typeof document === "undefined") return;
    if (open) {
      returnFocusTo = document.activeElement as HTMLElement | null;
      await nextTick();
      closeBtn.value?.focus({ preventScroll: true });
    } else {
      returnFocusTo?.focus?.({ preventScroll: true });
      returnFocusTo = null;
    }
  }
);

// Druga dostava u istom listu: počni od vrha, a fokus ostavi na dugmetu koje je
// pritisnuto (ili na zatvaranju ako dalje nema).
watch(
  () => props.delivery?.id,
  async (id, previous) => {
    if (id == null || previous == null || id === previous) return;
    await nextTick();
    bodyEl.value?.scrollTo({ top: 0 });
    const active = document.activeElement;
    const stillUsable = [newerBtn.value, olderBtn.value].some(
      (btn) => btn && btn === active && !btn.disabled
    );
    if (!stillUsable) closeBtn.value?.focus({ preventScroll: true });
  }
);
</script>

<style scoped>
.dd {
  display: flex;
  flex-direction: column;
  color: #0b1220;
  max-height: 90vh;
  max-height: 90dvh;
  overflow: hidden;
  outline: none;
  box-shadow: 0 -10px 34px rgba(11, 18, 32, 0.16), 0 -1px 2px rgba(11, 18, 32, 0.06);
}

.dd-grip {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
}

.dd-grip i {
  display: block;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: #d5d9e0;
}

.dd-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 14px 12px 20px;
}

.dd-head-text {
  min-width: 0;
}

.dd-title {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.dd-sub {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.dd-ib {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.dd-ib:active {
  background: #e5e8ed;
}

.dd-ib:focus-visible,
.dd-chip:focus-visible,
.dd-nav:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.dd-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 20px 6px;
}

.dd-sec {
  padding: 14px 0;
  border-top: 1px solid #eceef2;
}

.dd-label {
  margin: 0 0 8px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6676;
}

.dd-stops {
  display: grid;
}

.dd-stop {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 12px;
}

.dd-rail {
  display: grid;
  grid-template-rows: auto 1fr;
  justify-items: center;
}

.dd-dot {
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border-radius: 50%;
}

.dd-dot--pickup {
  background: #ffc247;
  box-shadow: 0 0 0 3px #fff2df;
}

.dd-dot--drop {
  background: #2f6fed;
  box-shadow: 0 0 0 3px #eef4ff;
}

.dd-line {
  width: 2px;
  margin: 4px 0;
  background: #eceef2;
}

.dd-txt {
  min-width: 0;
  padding-bottom: 12px;
}

.dd-stop:last-child .dd-txt {
  padding-bottom: 0;
}

.dd-k {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #5b6676;
}

.dd-txt strong {
  display: block;
  font-size: 0.98rem;
  overflow-wrap: anywhere;
}

.dd-ad {
  font-size: 0.84rem;
  color: #5b6676;
}

.dd-units {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.dd-unit {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 11px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  font-size: 0.8rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.dd-trip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 12px 0 0;
  font-size: 0.86rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.dd-trip :deep(.v-icon) {
  color: #5b6676;
}

.dd-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.dd-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 13px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  color: #0b1220;
  cursor: pointer;
}

.dd-chip:active {
  background: #f1f4f9;
}

.dd-ln {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
}

.dd-ln--total {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed #dfe3ea;
  font-weight: 800;
}

.dd-ln--effect {
  margin-top: 2px;
  font-weight: 800;
}

.dd-ln--green {
  color: #00734f;
}

.dd-ln--flush {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.dd-muted {
  margin: 8px 0 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #5b6676;
}

.dd-muted--flush {
  margin-top: 0;
}

.dd-alert {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  padding: 11px 12px;
  border-radius: 14px;
  background: #fff2df;
  color: #5c3305;
  font-size: 0.84rem;
  line-height: 1.4;
}

.dd-alert :deep(.v-icon) {
  color: #9a4a07;
}

.dd-alert b {
  display: block;
}

.dd-alert button {
  display: block;
  margin-top: 6px;
  padding: 2px 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 800;
  color: #9a4a07;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.dd-rule {
  margin: 4px 0 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #5b6676;
}

.dd-rule a {
  color: #2459c7;
  font-weight: 700;
  text-decoration: none;
}

.dd-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px calc(10px + var(--v-safe-bottom, 0px));
  border-top: 1px solid #e7e9ee;
  background: rgba(255, 255, 255, 0.96);
}

.dd-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: none;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  color: #2459c7;
  cursor: pointer;
}

.dd-nav:active:not(:disabled) {
  background: #eef4ff;
}

.dd-nav:disabled {
  opacity: 0.4;
  cursor: default;
}

.dd-pos {
  font-size: 0.76rem;
  font-weight: 600;
  color: #657083;
  font-variant-numeric: tabular-nums;
}
</style>
