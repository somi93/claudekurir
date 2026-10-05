<template>
  <WalletSheet
    :open="open"
    title="Isplata zarade"
    :subtitle="payout ? when(payout.ts) : undefined"
    @update:open="emit('update:open', $event)"
  >
    <template v-if="payout">
      <section class="dt-sec dt-sec--first">
        <div class="dt-big">{{ kmText(payout.amount) }}<small>KM</small></div>
        <p class="dt-muted">Isplaćeno ti je. Toliko je smanjeno ono što ti firma duguje.</p>
      </section>

      <section v-if="method" class="dt-sec">
        <WalletTimeline :events="[{ label: 'Način', value: method, note: customNote }]" />
      </section>

      <section v-if="payout.reference" class="dt-sec">
        <WalletCopyRow label="Referenca" :value="payout.reference" />
      </section>

      <p class="dt-rule">Ako iznos nije tačan, javi se dispečeru i navedi referencu.</p>
    </template>
  </WalletSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WalletCopyRow from "~/components/courier/wallet/WalletCopyRow.vue";
import WalletSheet from "~/components/courier/wallet/WalletSheet.vue";
import WalletTimeline from "~/components/courier/wallet/WalletTimeline.vue";
import { clockOf, dayLabelOf } from "~/utils/historyGroups";
import { kmText, payoutMethodOf } from "~/utils/walletLedger";
import type { WalletPayout } from "~/types/wallet-ledger";

// Detalj jedne isplate zarade: iznos, način isplate i referenca (transaction_id) za kopiranje.
const props = defineProps<{
  open: boolean;
  payout: WalletPayout | null;
  now: number;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const when = (ts: number) => `${dayLabelOf(ts, props.now)} · ${clockOf(ts)}`;
const method = computed(() => payoutMethodOf(props.payout?.note ?? null));

// Tekst koji backend sam upiše ("Isplata kuriru (gotovina)") već je iskazan kao način isplate;
// napomena se ponavlja samo kad ju je dispečer upisao sam.
const customNote = computed(() => {
  const note = props.payout?.note;
  return note && !/^Isplata kuriru \(.+\)$/.test(note.trim()) ? note : undefined;
});
</script>

<style scoped>
.dt-sec {
  padding: 14px 0;
  border-top: 1px solid #eceef2;
}

.dt-sec--first {
  border-top: 0;
}

.dt-big {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: #00734f;
}

.dt-big small {
  margin-left: 5px;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0;
  color: #5b6676;
}

.dt-muted {
  margin: 2px 0 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #5b6676;
}

.dt-rule {
  margin: 4px 0 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #5b6676;
}
</style>
