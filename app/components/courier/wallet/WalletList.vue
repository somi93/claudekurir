<template>
  <div class="wl">
    <section v-for="group in groups" :key="group.key" class="hd">
      <header class="hd-head">
        <h3 class="hd-label">{{ group.label }}</h3>
        <span class="hd-meta">{{ group.meta }}</span>
      </header>
      <div class="hd-card">
        <WalletRow
          v-for="item in group.items"
          :key="item.key"
          :item="item"
          :account="account"
          :money-pending="item.kind === 'delivery' && isPending(item.delivery)"
          @open="emit('open', $event)"
        />
      </div>
    </section>

    <div v-if="rest > 0" class="wl-more">
      <button type="button" class="wl-btn" @click="emit('more')">
        Prikaži starije ({{ rest }} {{ restWord }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WalletRow from "~/components/courier/wallet/WalletRow.vue";
import { pluralizeSr } from "~/utils/datetime";
import type { CourierDelivery } from "~/types/courier-delivery";
import type { WalletAccount, WalletDayGroup, WalletItem } from "~/types/wallet-ledger";

// Lista po danima (zaglavlje dana: broj dostava i zbir). Iscrtava se samo dio; ostatak otvara dugme.
const props = defineProps<{
  groups: WalletDayGroup[];
  account: WalletAccount;
  // Koliko stavki još nije iscrtano.
  rest: number;
  isPending: (delivery: CourierDelivery) => boolean;
}>();

const emit = defineEmits<{ open: [item: WalletItem]; more: [] }>();

const restWord = computed(() => pluralizeSr(props.rest, "stavka", "stavke", "stavki"));
</script>

<style scoped>
.wl {
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

.wl-more {
  display: flex;
  justify-content: center;
  padding: 10px 0 0;
}

.wl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
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

.wl-btn:active {
  background: #dfeaff;
}

.wl-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
