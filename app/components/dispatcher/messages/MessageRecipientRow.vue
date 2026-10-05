<template>
  <li>
    <div
      class="mr"
      :class="{ 'is-pick': picked, 'is-flash': flash }"
      :data-id="courier.id"
      @click="emit('toggle')"
    >
      <button
        type="button"
        class="mr-chk"
        role="checkbox"
        :aria-checked="picked"
        :aria-label="aria"
        :tabindex="tabbable ? 0 : -1"
        :data-row="`chk:${courier.id}`"
        @click.stop="emit('toggle')"
      >
        <span><v-icon v-if="picked" icon="mdi-check" size="18" /></span>
        <i class="live" :style="{ background: dot }" />
      </button>

      <span class="mr-t">
        <span class="mr-n">
          <b>{{ courier.name }}</b>
          <i>#{{ courier.id }}</i>
        </span>
        <span class="mr-s">
          <span v-if="courier.suspended" class="sus">Suspendovan</span>
          <template v-if="courier.suspended"> · </template>{{ sub }}
        </span>
      </span>

      <span
        class="mr-lp"
        :style="
          courier.suspended
            ? { '--tint': '#fde8e6', '--ink': '#b42318', '--dot': '#e5484d' }
            : { '--tint': live.tint, '--ink': live.ink, '--dot': live.dot }
        "
      >
        <i />{{ courier.suspended ? "Suspendovan" : live.label }}
      </span>

      <button
        type="button"
        class="mr-hb"
        :aria-label="`Poruke kurira ${courier.name}`"
        :tabindex="tabbable ? 0 : -1"
        :data-row="`hist:${courier.id}`"
        @click.stop="emit('history')"
      >
        <v-icon icon="mdi-history" size="22" />
      </button>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { LIVE_META, fmtPhone, liveOf, vehicleView, type RosterCourier } from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";

// Red spiska primalaca: kvačica (izbor), ime i ID, telefon i vozilo, stanje uživo i istorija poruka
// kurira. Klik na red je izbor. Dva dugmeta aktivnog reda (kvačica, istorija) su jedino mjesto za
// Tab u listi (roving tabindex, strelice po listi).
const props = defineProps<{
  courier: RosterCourier;
  now: number;
  currency: string;
  picked: boolean;
  tabbable: boolean;
  flash: boolean;
}>();

const emit = defineEmits<{ toggle: []; history: [] }>();

const live = computed(() => LIVE_META[liveOf(props.courier, props.now)]);
const dot = computed(() => (props.courier.suspended ? "#e5484d" : live.value.dot));
const sub = computed(
  () =>
    `${props.courier.phone ? fmtPhone(props.courier.phone) : "bez telefona"} · ${vehicleView(props.courier.vehicle).label}`
);

const aria = computed(() => {
  const c = props.courier;
  const bits = [
    c.name,
    `kurir ${c.id}`,
    c.suspended ? "suspendovan" : live.value.label.toLowerCase(),
    props.picked ? "izabran" : "nije izabran",
  ];
  if (c.cash != null && c.cash > 0) bits.push(`duguje ${formatAmount(c.cash, props.currency)}`);
  return bits.join(", ");
});
</script>

<style scoped>
.mr {
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto 44px;
  gap: 10px;
  align-items: center;
  min-height: 68px;
  padding: 8px 6px 8px 8px;
  border-top: 1px solid #eceef2;
  background: #fff;
  cursor: pointer;
}

li:first-child > .mr {
  border-top: 0;
}

li:last-child > .mr {
  border-radius: 0 0 20px 20px;
}

.mr:hover {
  background: #fafbfc;
}

.mr.is-pick {
  background: #f5f9ff;
}

.mr.is-flash {
  animation: mr-flash 1.6s ease-out;
}

@keyframes mr-flash {
  0% {
    background: #fff6d6;
  }
  100% {
    background: #fff;
  }
}

.mr-chk {
  position: relative;
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

.mr-chk span {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 2px solid #b9c0cb;
  border-radius: 50%;
  background: #fff;
  color: #fff;
}

.mr-chk[aria-checked="true"] span {
  border-color: #0b1220;
  background: #0b1220;
}

.mr-chk .live {
  position: absolute;
  right: 3px;
  bottom: 3px;
  z-index: 1;
  width: 12px;
  height: 12px;
  border: 2.5px solid #fff;
  border-radius: 50%;
}

.mr-chk:focus-visible,
.mr-hb:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.mr-t {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.mr-n {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.mr-n b {
  min-width: 0;
  overflow: hidden;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mr-n i {
  flex: none;
  font-size: 0.74rem;
  font-style: normal;
  font-weight: 700;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.mr-s {
  overflow: hidden;
  font-size: 0.8rem;
  color: #5b6676;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.mr-s .sus {
  font-weight: 800;
  color: #b42318;
}

.mr-lp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--ink);
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.mr-lp i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dot);
}

.mr-hb {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.mr-hb:hover,
.mr-hb:active {
  background: #f1f3f6;
}

/* Uži ekran: stanje uživo je u grupama iznad, red ostaje čitljiv. */
@media (max-width: 699px) {
  .mr {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
  }

  .mr-lp {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mr.is-flash {
    animation: none;
  }
}
</style>
