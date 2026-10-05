<template>
  <li>
    <div
      class="rr"
      :class="{ 'is-sel': selected, 'is-flash': flash }"
      :data-id="courier.id"
      @click="picking ? emit('pick') : emit('open')"
    >
      <button
        v-if="picking"
        type="button"
        class="rr-check"
        role="checkbox"
        :aria-checked="picked"
        :aria-label="`Izaberi ${courier.name}`"
        :data-row="`pick:${courier.id}`"
      >
        <span><v-icon v-if="picked" icon="mdi-check" size="18" /></span>
      </button>
      <span
        v-else
        class="rr-av"
        :style="{ '--tint': vehicle.tint, '--ink': vehicle.ink }"
        aria-hidden="true"
      >
        <v-icon :icon="vehicle.icon" size="22" />
        <span class="dot" :style="{ background: courier.suspended ? '#e5484d' : live.dot }" />
      </span>

      <button
        type="button"
        class="rr-main"
        :data-row="`row:${courier.id}`"
        :tabindex="tabbable ? 0 : -1"
        :aria-current="selected ? 'true' : undefined"
        :aria-label="`${aria}. Otvori detalje`"
      >
        <span class="rr-name">
          <b>{{ courier.name }}</b>
          <i>#{{ courier.id }}</i>
        </span>
        <span class="rr-sub">{{ sub }}</span>
        <span v-if="hasTags" class="rr-tags">
          <span v-if="isNew" class="tag tag--green"><v-icon icon="mdi-check" size="14" />Dodat sada</span>
          <span v-if="cashTag" class="tag" :class="cashTag.cls">
            <v-icon icon="mdi-cash-multiple" size="14" />{{ cashTag.text }}
          </span>
          <span v-if="courier.unread" class="tag tag--blue">
            <v-icon icon="mdi-message-text-outline" size="14" />{{ unreadText(courier.unread) }}
          </span>
          <span v-if="!courier.vehicle" class="tag tag--amber">
            <v-icon icon="mdi-alert-outline" size="14" />Bez vozila
          </span>
        </span>
      </button>

      <span class="rr-end">
        <span
          class="rr-st"
          :style="
            courier.suspended
              ? { '--tint': '#fde8e6', '--ink': '#b42318', '--dot': '#e5484d' }
              : { '--tint': live.tint, '--ink': live.ink, '--dot': live.dot }
          "
        >
          <i />{{ courier.suspended ? "Suspendovan" : live.label }}
        </span>
        <span class="rr-seen">{{ seenLine }}</span>
      </span>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  LIVE_META,
  cashLevel,
  fmtPhone,
  liveOf,
  seenText,
  unreadText,
  vehicleView,
  type RosterCourier,
} from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";

// Red liste kurira: avatar sa tačkom stanja, ime i ID, telefon i vozilo, oznake (dug, poruke, bez
// vozila) i stanje uživo desno. Jedino dugme u redu koje je u redoslijedu tastera Tab je glavno
// (roving tabindex: strelice po listi), ostalo je isti dodir. Suspenzija ima prednost nad stanjem.
const props = defineProps<{
  courier: RosterCourier;
  now: number;
  currency: string;
  cashLimit: number | null;
  selected: boolean;
  picking: boolean;
  picked: boolean;
  isNew: boolean;
  flash: boolean;
  tabbable: boolean;
}>();

const emit = defineEmits<{ open: []; pick: [] }>();

const vehicle = computed(() => vehicleView(props.courier.vehicle));
const liveKey = computed(() => liveOf(props.courier, props.now));
const live = computed(() => LIVE_META[liveKey.value]);

const sub = computed(
  () => `${props.courier.phone ? fmtPhone(props.courier.phone) : "bez telefona"} · ${vehicle.value.label}`
);

const seenLine = computed(() =>
  props.courier.suspended
    ? `${live.value.label.toLowerCase()} · ${seenText(props.courier, props.now)}`
    : seenText(props.courier, props.now)
);

const cashTag = computed(() => {
  const cash = props.courier.cash;
  if (cash == null || !(cash > 0)) return null;
  const level = cashLevel(cash, props.cashLimit);
  return {
    cls: level === "over" ? "tag--red" : level === "near" ? "tag--amber" : "",
    text: `${level === "over" ? "Preko limita " : "Duguje "}${formatAmount(cash, props.currency)}`,
  };
});

const hasTags = computed(
  () => props.isNew || !!cashTag.value || props.courier.unread > 0 || !props.courier.vehicle
);

const aria = computed(() => {
  const c = props.courier;
  const bits = [c.name, `kurir ${c.id}`, c.suspended ? "suspendovan" : live.value.label.toLowerCase()];
  if (c.cash != null && c.cash > 0) bits.push(`duguje ${formatAmount(c.cash, props.currency)}`);
  if (c.unread) bits.push(`${unreadText(c.unread)} poruke`);
  return bits.join(", ");
});
</script>

<style scoped>
.rr {
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 12px 14px;
  border-top: 1px solid #eceef2;
  background: #fff;
  cursor: pointer;
}

li:first-child > .rr {
  border-top: 0;
}

li:last-child > .rr {
  border-radius: 0 0 20px 20px;
}

.rr:hover {
  background: #fafbfc;
}

.rr.is-sel {
  background: #f5f6f8;
  border-top-color: transparent;
  border-radius: 14px;
  box-shadow: inset 0 0 0 2px #0b1220;
}

.rr.is-flash {
  animation: rr-flash 1.6s ease-out;
}

@keyframes rr-flash {
  0% {
    background: #fff6d6;
  }
  100% {
    background: #fff;
  }
}

.rr-av {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--tint);
  color: var(--ink);
}

.rr-av .dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2.5px solid #fff;
}

.rr-check {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.rr-check span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 2px solid #b9c0cb;
  border-radius: 50%;
  background: #fff;
  color: #fff;
}

.rr-check[aria-checked="true"] span {
  border-color: #0b1220;
  background: #0b1220;
}

.rr-check:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.rr-main {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rr-main:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 6px;
  border-radius: 10px;
}

.rr-name {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.rr-name b {
  min-width: 0;
  overflow: hidden;
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rr-name i {
  flex: none;
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 700;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.rr-sub {
  overflow: hidden;
  font-size: 0.84rem;
  color: #5b6676;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.rr-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #eceff3;
  color: #5b6676;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tag--amber {
  background: #fff2df;
  color: #9a4a07;
}

.tag--red {
  background: #fde8e6;
  color: #b42318;
}

.tag--blue {
  background: #eef4ff;
  color: #2459c7;
}

.tag--green {
  background: #e3f8ef;
  color: #00734f;
}

.rr-end {
  display: grid;
  justify-items: end;
  gap: 3px;
}

.rr-st {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--ink);
  font-size: 0.74rem;
  font-weight: 800;
  white-space: nowrap;
}

.rr-st i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dot);
}

.rr-seen {
  font-size: 0.72rem;
  color: #5b6676;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .rr.is-flash {
    animation: none;
  }
}
</style>
