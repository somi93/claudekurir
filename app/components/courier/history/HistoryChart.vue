<template>
  <div class="hc" :class="{ 'hc--has-sel': selected }">
    <div class="hc-plot" role="group" :aria-label="groupLabel">
      <div class="hc-cols">
        <button
          v-for="bucket in buckets"
          :key="bucket.key"
          type="button"
          class="hc-col"
          :aria-pressed="bucket.key === selectedKey"
          :aria-label="ariaLabel(bucket)"
          :disabled="bucket.future"
          :data-zero="valueOf(bucket) <= 0 ? '1' : '0'"
          :style="{ '--p': percent(bucket) }"
          @click="emit('select', bucket.key)"
          @mouseenter="hoverKey = bucket.key"
          @mouseleave="hoverKey = null"
          @focus="hoverKey = bucket.key"
          @blur="hoverKey = null"
        >
          <span class="hc-val">{{ metric === "wage" ? money(bucket.wage) : bucket.count }}</span>
          <span class="hc-bar" />
        </button>
      </div>
    </div>

    <div class="hc-x" aria-hidden="true">
      <span
        v-for="(bucket, index) in buckets"
        :key="bucket.key"
        :class="{ cur: bucket.current, sel: bucket.key === selectedKey }"
        >{{ showLabel(index) ? bucket.label : "" }}</span
      >
    </div>

    <div class="hc-foot">
      <!-- Opis stubića umjesto tooltipa: isti tekst kao u čitaču ekrana, a lista ispod
           je tabela istih brojeva. -->
      <p class="hc-cap">
        <template v-if="captionBucket">
          <b>{{ captionBucket.long }}</b> · {{ deliveriesLabel(captionBucket.count)
          }}<template v-if="metric === 'wage'"> · +{{ money(captionBucket.wage) }} KM</template>
        </template>
        <template v-else>{{ hint }}</template>
      </p>
      <button v-if="selected" type="button" class="hc-clear" @click="emit('select', null)">
        Poništi
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  deliveriesLabel,
  money,
  type HistoryBucket,
  type HistoryPeriod,
} from "~/utils/historyGroups";

// Zarada (ili broj dostava) po danima / sedmicama / mjesecima. Jedna serija, jedna
// boja; izabran stubić filtrira listu ispod, ostali blijede. Vrijednost nije samo u
// boji: izabrani stubić ima broj iznad, svaki ima opis, a lista ispod ima iste brojeve.
const props = defineProps<{
  buckets: HistoryBucket[];
  period: HistoryPeriod;
  metric: "wage" | "count";
  selectedKey: string | null;
}>();

// Klik na stubić šalje njegov ključ (stranica sama prebacuje izbor), null poništava.
const emit = defineEmits<{ select: [key: string | null] }>();

const hoverKey = ref<string | null>(null);

const selected = computed(() => props.buckets.find((b) => b.key === props.selectedKey) ?? null);
const captionBucket = computed(
  () => props.buckets.find((b) => b.key === hoverKey.value) ?? selected.value
);

const valueOf = (bucket: HistoryBucket) => (props.metric === "wage" ? bucket.wage : bucket.count);
const max = computed(() => Math.max(0, ...props.buckets.map(valueOf)));
const percent = (bucket: HistoryBucket) =>
  max.value > 0 ? Math.round((valueOf(bucket) / max.value) * 100) : 0;

const groupLabel = computed(() => {
  const per = { today: "danima", week: "danima", month: "sedmicama", all: "mjesecima" }[props.period];
  return `${props.metric === "wage" ? "Zarada" : "Broj dostava"} po ${per}`;
});

const hint = computed(
  () =>
    ({
      today: "",
      week: "Dodirni dan da vidiš samo njegove dostave.",
      month: "Dodirni sedmicu da vidiš samo njene dostave.",
      all: "Dodirni mjesec da vidiš samo njegove dostave.",
    })[props.period]
);

const ariaLabel = (bucket: HistoryBucket) =>
  `${bucket.long}, ${deliveriesLabel(bucket.count)}${
    props.metric === "wage" ? `, ${money(bucket.wage)} KM` : ""
  }`;

// Kod mnogo stubića (dug period "Sve") oznake se prorijede da se ne preklapaju;
// brojanje kreće od zadnjeg (tekućeg) stubića, pa je on uvijek označen.
const labelStep = computed(() => Math.max(1, Math.ceil(props.buckets.length / 9)));
const showLabel = (index: number) => (props.buckets.length - 1 - index) % labelStep.value === 0;
</script>

<style scoped>
.hc {
  display: grid;
  gap: 6px;
}

.hc-plot {
  position: relative;
  height: 92px;
  border-bottom: 1px solid #dfe3ea;
}

.hc-cols {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
}

.hc-col {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  padding: 16px 0 0;
  border: 0;
  border-radius: 8px 8px 0 0;
  background: none;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.hc-col:hover:not(:disabled) {
  background: rgba(11, 18, 32, 0.035);
}

.hc-col:disabled {
  cursor: default;
}

.hc-col:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 1px;
}

/* Stubić je jedan nivo ispod zelene aplikacije (#00b37e) da dostigne 3:1 na bijeloj;
   debljina najviše 24 px, zaobljen samo vrh, dno ravno na liniji. */
.hc-bar {
  display: block;
  width: min(24px, calc(100% - 6px));
  height: calc(var(--p, 0) * 1%);
  background: #00a073;
  border-radius: 4px 4px 0 0;
  transition: height 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.15s;
}

.hc-col[data-zero="1"] .hc-bar {
  display: none;
}

.hc-col:hover:not(:disabled) .hc-bar {
  filter: brightness(1.1);
}

.hc--has-sel .hc-col[aria-pressed="false"] .hc-bar {
  background: #b3e3d5;
}

.hc-val {
  position: absolute;
  left: 50%;
  bottom: calc(var(--p, 0) * (100% - 16px) / 100 + 4px);
  transform: translateX(-50%);
  font-size: 0.7rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #0b1220;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

.hc-col[aria-pressed="true"] .hc-val {
  opacity: 1;
}

.hc-x {
  display: flex;
}

.hc-x span {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
  font-size: 0.66rem;
  font-weight: 700;
  color: #657083;
  white-space: nowrap;
}

.hc-x span.cur {
  color: #0b1220;
  font-weight: 800;
}

.hc-x span.sel {
  color: #2459c7;
  font-weight: 800;
}

.hc-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.hc-cap {
  flex: 1;
  min-width: 0;
  min-height: 1.25rem;
  margin: 0;
  font-size: 0.78rem;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.hc-cap b {
  color: #0b1220;
}

.hc-clear {
  flex: none;
  padding: 4px 0 4px 8px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  color: #2459c7;
  cursor: pointer;
}

.hc-clear:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .hc-bar {
    transition: none;
  }
}
</style>
