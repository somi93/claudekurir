<template>
  <WalletSheet
    :open="open"
    title="Predaja gotovine"
    :subtitle="handover ? `${handover.pending ? 'Na čekanju' : 'Potvrđeno'} · #${handover.id}` : undefined"
    @update:open="emit('update:open', $event)"
  >
    <template v-if="handover">
      <section class="dt-sec dt-sec--first">
        <div class="dt-big">{{ kmText(handover.pending ? handover.reported : handover.confirmed) }}<small>KM</small></div>
        <p v-if="!handover.pending" class="dt-muted">Toliko je dug prema firmi smanjen.</p>
      </section>

      <section v-if="shortfall > 0" class="dt-sec dt-sec--flush">
        <TintAlert tone="warn" :title="`Potvrđeno je ${kmText(shortfall)} KM manje nego što si prijavio`">
          Ta razlika ostaje u dugu.
        </TintAlert>
      </section>

      <section class="dt-sec">
        <WalletTimeline :events="events" />
        <p v-if="handover.note" class="dt-muted">Napomena: {{ handover.note }}</p>
      </section>

      <section v-if="!handover.pending" class="dt-sec">
        <WalletCopyRow label="Broj predaje" :value="`#${handover.id}`" />
      </section>

      <p class="dt-rule">
        <template v-if="handover.pending">
          Dispečer potvrđuje iznos koji je stvarno primio. Ako se razlikuje od prijavljenog, ovdje ćeš
          vidjeti oba iznosa.
        </template>
        <template v-else>Ako iznos nije tačan, javi se dispečeru i navedi broj predaje.</template>
      </p>
    </template>
  </WalletSheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import WalletCopyRow from "~/components/courier/wallet/WalletCopyRow.vue";
import WalletSheet from "~/components/courier/wallet/WalletSheet.vue";
import WalletTimeline from "~/components/courier/wallet/WalletTimeline.vue";
import { clockOf, dayLabelOf } from "~/utils/historyGroups";
import { handoverShortfall, kmText } from "~/utils/walletLedger";
import type { WalletHandover, WalletTimelineEvent } from "~/types/wallet-ledger";

// Detalj jedne predaje gotovine: iznos, vremenska linija (prijavljeno -> potvrdio dispečer, sa
// imenom), razlika ako je potvrđeno manje i broj predaje za kopiranje - za razgovor sa dispečerom
// kad se iznos ne slaže.
const props = defineProps<{
  open: boolean;
  handover: WalletHandover | null;
  now: number;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const shortfall = computed(() => (props.handover ? handoverShortfall(props.handover) : 0));

const when = (ts: number) => `${dayLabelOf(ts, props.now)} · ${clockOf(ts)}`;

const events = computed<WalletTimelineEvent[]>(() => {
  const h = props.handover;
  if (!h) return [];
  const reported: WalletTimelineEvent = {
    label: "Prijavljeno",
    value: `${kmText(h.reported)} KM`,
    note: when(h.reportedAt),
  };
  if (h.pending) {
    return [
      reported,
      { label: "Potvrda dispečera", value: "Čeka se", note: "Do tada se dug ne mijenja.", state: "off" },
    ];
  }
  return [
    reported,
    {
      label: "Potvrdio dispečer",
      value: [`${kmText(h.confirmed)} KM`, h.confirmedBy].filter(Boolean).join(" · "),
      note: h.confirmedAt != null ? when(h.confirmedAt) : undefined,
    },
  ];
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

.dt-sec--flush {
  padding-top: 0;
  border-top: 0;
}

.dt-big {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
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

.dt-sec .dt-muted {
  margin-top: 10px;
}

.dt-sec--first .dt-muted {
  margin-top: 2px;
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
