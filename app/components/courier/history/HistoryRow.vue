<template>
  <button type="button" class="hr" :aria-label="ariaLabel" @click="emit('open', delivery.id)">
    <span class="hr-time">
      {{ time }}
      <small v-if="showDate && delivery.ts != null">{{ shortDateOf(delivery.ts, now) }}</small>
    </span>

    <span class="hr-main">
      <span class="hr-title">{{ title }}</span>
      <span class="hr-sub">
        <span class="hr-street">{{ place }}</span>
        <span v-if="delivery.restaurant" class="hr-id">#{{ delivery.id }}</span>
      </span>
    </span>

    <span class="hr-money">
      <template v-if="pending">
        <span class="sk" style="height: 14px; width: 60px" aria-hidden="true" />
        <span class="sk" style="height: 10px; width: 44px" aria-hidden="true" />
      </template>
      <template v-else-if="delivery.wage != null">
        <span class="hr-amt">+{{ money(delivery.wage) }} KM</span>
        <span class="hr-cap">{{ caption }}</span>
      </template>
      <template v-else-if="delivery.payMode === 'monthly'">
        <span v-if="delivery.collected == null" class="hr-amt hr-amt--none">kartica</span>
        <template v-else>
          <span class="hr-amt hr-amt--ink">{{ money(delivery.collected) }} KM</span>
          <span class="hr-cap">naplaćeno</span>
        </template>
      </template>
      <template v-else>
        <span class="hr-amt hr-amt--none">—</span>
        <span class="hr-cap">bez obračuna</span>
      </template>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CourierDelivery } from "~/types/courier-delivery";
import { clockOf, dayLabelOf, money, shortDateOf } from "~/utils/historyGroups";

// Jedna dostava u listi: sat (u listi po zaradi i datum), restoran, ulica + #broj,
// zarada. Cijeli red je dugme od 68 px koje otvara detalj.
const props = defineProps<{
  delivery: CourierDelivery;
  now: number;
  // Lista nije podijeljena po danima (sortiranje po zaradi) - datum ide uz sat.
  showDate: boolean;
  // Zarada još stiže - umjesto iznosa sjenka.
  pending: boolean;
}>();

const emit = defineEmits<{ open: [id: number] }>();

const time = computed(() => (props.delivery.ts != null ? clockOf(props.delivery.ts) : "--:--"));
const title = computed(() => props.delivery.restaurant ?? `Dostava #${props.delivery.id}`);
// Grad samo kad je dostava u drugom gradu nego što je restoran. Dostava samo iz
// zarade (istorija nije stigla) nema ni ulicu.
const place = computed(
  () =>
    [props.delivery.street, props.delivery.crossCity ? props.delivery.city : null]
      .filter(Boolean)
      .join(" · ") || (props.delivery.order ? "" : "Podaci o ruti nisu dostupni")
);

// "naplaćeno 8.16" za gotovinu, "kartica" kad kurir nije ništa naplatio.
const caption = computed(() =>
  props.delivery.collected == null ? "kartica" : `naplaćeno ${money(props.delivery.collected)}`
);

const ariaLabel = computed(() => {
  const d = props.delivery;
  const when = d.ts != null ? `${dayLabelOf(d.ts, props.now)} ${time.value}` : "bez datuma";
  const wage = d.wage != null ? `, zarada ${money(d.wage)} KM` : "";
  return `${title.value}${place.value ? `, ${place.value}` : ""}, ${when}, broj ${d.id}${wage}`;
});
</script>

<style scoped>
.hr {
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 68px;
  padding: 12px 16px;
  border: 0;
  background: #fff;
  font: inherit;
  color: #0b1220;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}

/* Razdjelnik počinje ispod naslova, ne ispod sata. */
.hr + .hr::before {
  content: "";
  position: absolute;
  top: 0;
  left: 72px;
  right: 0;
  height: 1px;
  background: #eceef2;
}

.hr:active {
  background: #f1f4f9;
}

.hr:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.hr-time {
  display: grid;
  gap: 1px;
  font-size: 0.88rem;
  font-weight: 800;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.hr-time small {
  font-size: 0.66rem;
  font-weight: 700;
  color: #657083;
}

.hr-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.hr-title {
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hr-sub {
  display: flex;
  gap: 6px;
  min-width: 0;
  font-size: 0.84rem;
  color: #5b6676;
}

/* Ulica se skraćuje, broj narudžbe ostaje. */
.hr-street {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hr-id {
  flex: none;
  color: #657083;
  font-variant-numeric: tabular-nums;
}

.hr-money {
  display: grid;
  justify-items: end;
  gap: 2px;
  text-align: right;
}

.hr-amt {
  font-size: 0.92rem;
  font-weight: 800;
  color: #00734f;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.hr-amt--ink {
  color: #0b1220;
}

.hr-amt--none {
  font-weight: 700;
  color: #657083;
}

.hr-cap {
  font-size: 0.72rem;
  color: #657083;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: hr-shimmer 1.3s linear infinite;
}

@keyframes hr-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
