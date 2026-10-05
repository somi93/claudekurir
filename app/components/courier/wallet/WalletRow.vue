<template>
  <button type="button" class="wr" :class="rowClass" @click="emit('open', item)">
    <!-- Dostava: neutralna (naplaćeno, ili "ušlo u dug" kad backend pošalje) -->
    <template v-if="item.kind === 'delivery'">
      <span class="wr-ic"><v-icon icon="mdi-moped-outline" size="20" /></span>
      <span class="wr-main">
        <span class="wr-title"><span>{{ title }}</span></span>
        <span class="wr-sub">
          <span class="st">{{ sub }}</span>
          <span v-if="item.delivery.restaurant" class="id">#{{ item.delivery.id }}</span>
        </span>
      </span>
      <span class="wr-money">
        <template v-if="deliveryMoney.pending">
          <span class="sk" style="height: 14px; width: 60px" aria-hidden="true" />
          <span class="sk" style="height: 10px; width: 44px" aria-hidden="true" />
        </template>
        <template v-else>
          <span class="wr-amt" :class="deliveryMoney.tone">
            <template v-if="deliveryMoney.chevron"
              ><v-icon icon="mdi-chevron-right" size="20"
            /></template>
            <template v-else>{{ deliveryMoney.amount }}</template>
          </span>
          <span v-if="deliveryMoney.caption" class="wr-cap">{{ deliveryMoney.caption }}</span>
        </template>
      </span>
    </template>

    <!-- Predaja gotovine: smanjuje dug prema firmi -->
    <template v-else-if="item.kind === 'handover'">
      <span class="wr-ic">
        <v-icon :icon="item.handover.pending ? 'mdi-timer-sand' : 'mdi-cash-refund'" size="20" />
      </span>
      <span class="wr-main">
        <span class="wr-title"><span>Predaja gotovine</span></span>
        <span class="wr-sub">
          <span class="w-chip" :class="item.handover.pending ? 'wait' : 'ok'">
            {{ item.handover.pending ? "Na čekanju" : "Potvrđeno" }}
          </span>
          <span class="st">{{ clockOf(item.ts) }}</span>
        </span>
      </span>
      <span class="wr-money">
        <template v-if="item.handover.pending">
          <span class="wr-amt">{{ kmText(item.handover.reported) }} KM</span>
          <span class="wr-cap">čeka potvrdu</span>
        </template>
        <template v-else>
          <span class="wr-amt pos">{{ MINUS }}{{ kmText(item.handover.confirmed) }} KM</span>
          <span class="wr-cap" :class="{ warn: shortfall > 0 }">{{ handoverCaption }}</span>
        </template>
      </span>
    </template>

    <!-- Isplata zarade -->
    <template v-else>
      <span class="wr-ic"><v-icon icon="mdi-cash-multiple" size="20" /></span>
      <span class="wr-main">
        <span class="wr-title"><span>Isplata zarade</span></span>
        <span class="wr-sub">
          <span class="st">{{ payoutSub }}</span>
        </span>
      </span>
      <span class="wr-money">
        <span class="wr-amt pos">{{ MINUS }}{{ kmText(item.payout.amount) }} KM</span>
        <span class="wr-cap">isplaćeno</span>
      </span>
    </template>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { clockOf } from "~/utils/historyGroups";
import { MINUS, handoverShortfall, kmText, payoutMethodOf } from "~/utils/walletLedger";
import type { WalletAccount, WalletItem } from "~/types/wallet-ledger";

// Jedan red liste, cijeli je dugme od 68 px koje otvara detalj. Dostava je neutralna (zarada u
// zaradi, naplaćeno u gotovini); predaja i isplata imaju zelenu traku i ton - zeleno je ono što je
// tvoje ili što smanjuje dug. Razlika prijavljeno / potvrđeno vidi se odmah u redu.
const props = defineProps<{
  item: WalletItem;
  account: WalletAccount;
  // Zarada za ovu dostavu još stiže - umjesto iznosa sjenka.
  moneyPending: boolean;
}>();

const emit = defineEmits<{ open: [item: WalletItem] }>();

const rowClass = computed(() => {
  if (props.item.kind === "delivery") return "";
  if (props.item.kind === "handover" && props.item.handover.pending) return "wr--settle wr--wait";
  return "wr--settle";
});

const title = computed(() =>
  props.item.kind === "delivery"
    ? (props.item.delivery.restaurant ?? `Dostava #${props.item.delivery.id}`)
    : ""
);

// "15:14 · Vuka Karadžića" - grad samo kad je dostava u drugom gradu nego što je restoran.
const sub = computed(() => {
  if (props.item.kind !== "delivery") return "";
  const d = props.item.delivery;
  const place = [d.street, d.crossCity ? d.city : null].filter(Boolean).join(" · ");
  return [clockOf(props.item.ts), place].filter(Boolean).join(" · ");
});

const deliveryMoney = computed<{
  pending: boolean;
  amount: string;
  caption: string;
  tone: string;
  chevron: boolean;
}>(() => {
  const empty = { pending: false, amount: "", caption: "", tone: "", chevron: false };
  if (props.item.kind !== "delivery") return empty;
  const d = props.item.delivery;

  if (props.account === "cash") {
    const effect = d.earnings?.cashEffect;
    if (effect != null) {
      return { ...empty, amount: `+${kmText(effect)} KM`, caption: `naplaćeno ${kmText(d.collected)}` };
    }
    return { ...empty, amount: `${kmText(d.collected)} KM`, caption: "naplaćeno" };
  }

  if (d.wage != null) return { ...empty, amount: `+${kmText(d.wage)} KM`, tone: "pos" };
  if (props.moneyPending) return { ...empty, pending: true };
  // Mjesečna plata: nema iznosa po dostavi, red samo vodi u detalj.
  if (d.payMode === "monthly") return { ...empty, tone: "mute", chevron: true };
  return { ...empty, amount: "—", caption: "bez obračuna", tone: "mute" };
});

const shortfall = computed(() =>
  props.item.kind === "handover" ? handoverShortfall(props.item.handover) : 0
);

// "predato", a kad se potvrđeni iznos razlikuje od prijavljenog - "prijavljeno 97.79".
const handoverCaption = computed(() => {
  if (props.item.kind !== "handover") return "";
  const h = props.item.handover;
  return h.confirmed != null && Math.abs(h.confirmed - h.reported) >= 0.005
    ? `prijavljeno ${kmText(h.reported)}`
    : "predato";
});

const payoutSub = computed(() => {
  if (props.item.kind !== "payout") return "";
  return [clockOf(props.item.ts), payoutMethodOf(props.item.payout.note)].filter(Boolean).join(" · ");
});
</script>

<style scoped>
.wr {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
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

/* Razdjelnik počinje ispod naslova, ne ispod ikone. */
.wr + .wr::before {
  content: "";
  position: absolute;
  top: 0;
  left: 68px;
  right: 0;
  height: 1px;
  background: #eceef2;
}

.wr:active {
  background: #f1f4f9;
}

.wr:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.wr-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f1f3f6;
  color: #5b6676;
}

.wr-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.wr-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.25;
}

.wr-title > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wr-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 0.84rem;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.wr-sub .st {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wr-sub .id {
  flex: none;
  color: #657083;
}

.wr-money {
  display: grid;
  justify-items: end;
  gap: 2px;
  text-align: right;
}

.wr-amt {
  font-size: 0.95rem;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: #0b1220;
}

.wr-amt.pos {
  color: #00734f;
}

.wr-amt.mute {
  font-weight: 700;
  color: #657083;
}

.wr-cap {
  font-size: 0.72rem;
  color: #657083;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.wr-cap.warn {
  font-weight: 700;
  color: #9a4a07;
}

/* Predaja i isplata: zelena traka i ton (zeleno = tvoje ili smanjuje dug). */
.wr--settle {
  background: #f3fbf7;
}

.wr--settle:active {
  background: #e6f6ee;
}

.wr--settle::after {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #00b37e;
}

.wr--settle .wr-ic {
  background: #e3f8ef;
  color: #00734f;
}

/* Predaja koja čeka: jantarno. */
.wr--wait {
  background: #fffaf0;
}

.wr--wait:active {
  background: #fff2dc;
}

.wr--wait::after {
  background: #ff9f1c;
}

.wr--wait .wr-ic {
  background: #fff2df;
  color: #9a4a07;
}

.w-chip {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}

.w-chip.ok {
  background: #e3f8ef;
  color: #00734f;
}

.w-chip.wait {
  background: #fff2df;
  color: #9a4a07;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: w-shimmer 1.3s linear infinite;
}

@keyframes w-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wr {
    transition: none;
  }

  .sk {
    animation: none;
  }
}
</style>
