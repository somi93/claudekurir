<template>
  <div class="w-pend">
    <div class="w-pend-top">
      <span class="w-pend-ic"><v-icon icon="mdi-check-circle-outline" size="26" /></span>
      <div>
        <h3>Predaja potvrđena</h3>
        <div class="s">{{ details }}</div>
      </div>
    </div>

    <TintAlert v-if="shortfall > 0" tone="warn" title="Potvrđeno je manje nego što si prijavio">
      Prijavio si {{ kmText(handover.reported) }} KM, a dispečer je potvrdio
      {{ kmText(handover.confirmed) }} KM. Razlika od {{ kmText(shortfall) }} KM ostaje u dugu.
    </TintAlert>

    <WalletButton variant="ghost" icon="mdi-check" @click="emit('dismiss')">U redu</WalletButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import WalletButton from "~/components/courier/wallet/WalletButton.vue";
import { clockOf } from "~/utils/historyGroups";
import { handoverShortfall, kmText } from "~/utils/walletLedger";
import type { WalletHandover } from "~/types/wallet-ledger";

// Predaja koja je čekala, a dok je ekran bio otvoren dispečer ju je potvrdio. Ostaje dok je
// kurir ne odbaci; ako je potvrđeno manje od prijavljenog, kaže se koliko ostaje u dugu.
const props = defineProps<{ handover: WalletHandover }>();
const emit = defineEmits<{ dismiss: [] }>();

const shortfall = computed(() => handoverShortfall(props.handover));
const details = computed(() =>
  [
    `${kmText(props.handover.confirmed)} KM`,
    props.handover.confirmedBy,
    props.handover.confirmedAt != null ? clockOf(props.handover.confirmedAt) : null,
  ]
    .filter(Boolean)
    .join(" · ")
);
</script>

<style scoped>
.w-pend {
  display: grid;
  gap: 12px;
}

.w-pend-top {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.w-pend-ic {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #e3f8ef;
  color: #00734f;
  animation: w-pop 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}

h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.s {
  font-size: 0.82rem;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

@keyframes w-pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: none;
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-pend-ic {
    animation: none;
  }
}
</style>
