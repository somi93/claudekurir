<template>
  <ol class="dt-tl">
    <li v-for="event in events" :key="event.label" class="dt-ev">
      <div class="dt-rail">
        <span class="dt-dot" :class="event.state === 'off' ? 'off' : ''" />
        <span class="dt-line" />
      </div>
      <div class="dt-txt">
        <span class="k">{{ event.label }}</span>
        <strong>{{ event.value }}</strong>
        <span v-if="event.note" class="a">{{ event.note }}</span>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { WalletTimelineEvent } from "~/types/wallet-ledger";

// Vremenska linija u listu predaje / isplate: šta se desilo, kada i ko. "off" je korak koji se
// još čeka (prazan krug).
defineProps<{ events: WalletTimelineEvent[] }>();
</script>

<style scoped>
.dt-tl {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dt-ev {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 12px;
}

.dt-rail {
  display: grid;
  grid-template-rows: auto 1fr;
  justify-items: center;
}

.dt-dot {
  width: 12px;
  height: 12px;
  margin-top: 5px;
  border-radius: 50%;
  background: #00b37e;
  box-shadow: 0 0 0 3px #e3f8ef;
}

.dt-dot.off {
  background: #fff;
  border: 2px solid #c3c9d4;
  box-shadow: none;
}

.dt-line {
  width: 2px;
  margin: 4px 0;
  background: #eceef2;
}

.dt-ev:last-child .dt-line {
  display: none;
}

.dt-txt {
  min-width: 0;
  padding-bottom: 14px;
}

.dt-ev:last-child .dt-txt {
  padding-bottom: 0;
}

.k {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #5b6676;
}

strong {
  display: block;
  font-size: 0.98rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.a {
  display: block;
  font-size: 0.84rem;
  color: #5b6676;
}
</style>
