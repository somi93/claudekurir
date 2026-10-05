<template>
  <div class="hl">
    <template v-if="groups">
      <section v-for="group in groups" :key="group.key" class="hd">
        <header class="hd-head">
          <h2 class="hd-label">{{ group.label }}</h2>
          <span class="hd-meta">
            {{ deliveriesLabel(group.rows.length)
            }}<template v-if="showMoney && group.wageRows > 0"> · +{{ money(group.wage) }} KM</template>
          </span>
        </header>
        <div class="hd-card">
          <HistoryRow
            v-for="delivery in group.rows"
            :key="delivery.id"
            :delivery="delivery"
            :now="now"
            :show-date="false"
            :pending="isPending(delivery)"
            @open="emit('open', $event)"
          />
        </div>
      </section>
    </template>

    <section v-else-if="flatRows" class="hd">
      <header class="hd-head">
        <h2 class="hd-label">Najveća zarada prvo</h2>
        <span class="hd-meta">{{ deliveriesLabel(total) }}</span>
      </header>
      <div class="hd-card">
        <HistoryRow
          v-for="delivery in flatRows"
          :key="delivery.id"
          :delivery="delivery"
          :now="now"
          show-date
          :pending="isPending(delivery)"
          @open="emit('open', $event)"
        />
      </div>
    </section>

    <div v-if="restRows > 0" class="hl-more">
      <button type="button" class="hl-btn" @click="emit('more')">
        Prikaži starije ({{ moreLabel }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import HistoryRow from "./HistoryRow.vue";
import type { CourierDelivery } from "~/types/courier-delivery";
import { daysLabel, deliveriesLabel, money, type DayGroup } from "~/utils/historyGroups";

// Dostave po danima (zaglavlje dana: broj dostava i zbir zarade) ili jedna ravna
// lista kad je sortirano po zaradi. Iscrtava se samo dio; ostatak otvara dugme.
const props = defineProps<{
  groups: DayGroup[] | null;
  flatRows: CourierDelivery[] | null;
  restGroups: number;
  restRows: number;
  // Ukupno u ravnoj listi (zaglavlje).
  total: number;
  now: number;
  showMoney: boolean;
  isPending: (delivery: CourierDelivery) => boolean;
}>();

const emit = defineEmits<{ open: [id: number]; more: [] }>();

const moreLabel = computed(() =>
  props.groups
    ? `${daysLabel(props.restGroups)} · ${deliveriesLabel(props.restRows)}`
    : deliveriesLabel(props.restRows)
);
</script>

<style scoped>
.hl {
  display: grid;
  gap: 4px;
}

.hd-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 4px 8px;
}

.hd:first-child .hd-head {
  padding-top: 4px;
}

.hd-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #0b1220;
}

.hd-meta {
  font-size: 0.76rem;
  font-weight: 600;
  color: #5b6676;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.hd-card {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.hl-more {
  display: flex;
  justify-content: center;
  padding: 10px 0 0;
}

.hl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: #eef4ff;
  color: #2459c7;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.hl-btn:active {
  background: #dfeaff;
}

.hl-btn:focus-visible {
  outline: 2px solid #2f6fed;
  outline-offset: 2px;
}
</style>
