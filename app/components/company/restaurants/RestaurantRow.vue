<template>
  <li>
    <div class="rr" :class="{ 'is-sel': selected }" :data-id="restaurant.id" @click="emit('open')">
      <span class="rr-av" :style="{ '--tint': meta.tint, '--ink': meta.ink }" aria-hidden="true">
        <v-icon icon="mdi-storefront-outline" size="22" />
        <span class="dot" :style="{ background: meta.dot }" />
      </span>

      <button
        type="button"
        class="rr-main"
        :data-row="`row:${restaurant.id}`"
        :tabindex="tabbable ? 0 : -1"
        :aria-current="selected ? 'true' : undefined"
        :aria-label="`${name}, ${meta.label.toLowerCase()}. Otvori detalje`"
        @click.stop="emit('open')"
      >
        <b class="rr-name">{{ name }}</b>
        <span class="rr-sub">{{ sub }}</span>
      </button>

      <span class="rr-meta">
        <span class="rr-st" :style="{ '--tint': meta.tint, '--ink': meta.ink, '--dot': meta.dot }">
          <i />{{ meta.label }}
        </span>
        <span v-for="tag in tags" :key="tag.text" class="tag tag--amber">
          <v-icon v-if="tag.icon" :icon="tag.icon" size="14" />{{ tag.text }}
        </span>
      </span>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { resolveCurrency } from "~/utils/currency";
import {
  COOP_META,
  coopState,
  inOtherCurrency,
  startDateText,
} from "~/utils/restaurantCooperation";
import { toLatin } from "~/utils/toLatin";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// Red liste restorana: avatar sa tačkom stanja, naziv, jedna rečenica (razlog suspenzije ili od kada
// sarađujemo), stanje saradnje kao pilula sa tekstom i uz nju oznake (druga valuta, isključio i
// restoran). Stanje se ne čita samo iz boje. Jedino dugme u redu u redoslijedu tastera Tab je glavno (roving
// tabindex: strelice po listi).
const props = defineProps<{
  restaurant: RestaurantCooperation;
  companyCurrency: string;
  selected: boolean;
  tabbable: boolean;
}>();

const emit = defineEmits<{ open: [] }>();

const state = computed(() => coopState(props.restaurant));
const meta = computed(() => COOP_META[state.value]);
const name = computed(() => toLatin(props.restaurant.restaurant_name) || `Restoran #${props.restaurant.restaurant_id}`);

const sub = computed(() => {
  const r = props.restaurant;
  if (state.value === "ours" && r.suspension_reason) return `Razlog: ${toLatin(r.suspension_reason)}`;
  const since = startDateText(r.cooperation_started_at);
  return since ? `Saradnja od ${since}` : "Datum početka nije upisan";
});

const tags = computed(() => {
  const out: { text: string; icon?: string }[] = [];
  if (inOtherCurrency(props.restaurant, props.companyCurrency)) {
    out.push({
      icon: "mdi-alert-outline",
      text: `Valuta ${resolveCurrency(props.restaurant.restaurant_currency)}`,
    });
  }
  if (state.value === "ours" && !props.restaurant.active_company) {
    out.push({ text: "Isključio i restoran" });
  }
  return out;
});
</script>

<style scoped>
.rr {
  position: relative;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 6px 12px;
  align-items: start;
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

.rr-av {
  position: relative;
  display: grid;
  grid-row: 1 / span 2;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--tint);
  color: var(--ink);
}

.rr-av .dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2.5px solid #fff;
}

.rr-main {
  display: grid;
  gap: 2px;
  align-content: start;
  min-width: 0;
  min-height: 44px;
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
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.rr-sub {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.84rem;
  line-height: 1.35;
  color: #5b6676;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.rr-meta {
  display: flex;
  grid-column: 2;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
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
}

.tag--amber {
  background: #fff2df;
  color: #9a4a07;
}

/* Stanje i oznake su red ispod teksta (kolona od 400 px je uska); u širokoj listi stoje desno. */
.rr-st {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 2px 10px;
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

@container restaurants (min-width: 560px) {
  .rr {
    grid-template-columns: 44px minmax(0, 1fr) auto;
    align-items: center;
  }

  .rr-av {
    grid-row: auto;
  }

  .rr-meta {
    grid-column: 3;
    justify-content: flex-end;
    max-width: 320px;
  }
}
</style>
