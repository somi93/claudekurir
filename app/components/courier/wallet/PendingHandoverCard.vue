<template>
  <div class="w-pend">
    <div class="w-pend-top">
      <span class="w-pend-ic"><v-icon icon="mdi-timer-sand" size="24" /></span>
      <div>
        <h3>Predaja čeka potvrdu</h3>
        <div class="s">
          {{ kmText(handover.reported) }} KM · prijavljeno {{ clockOf(handover.reportedAt) }} ·
          {{ agoLabel(handover.reportedAt, now) }}
        </div>
      </div>
    </div>

    <div
      class="w-steps"
      role="img"
      aria-label="Koraci predaje: prijavljeno, čeka dispečera, potvrda još nije stigla"
    >
      <div class="w-step done"><i />Prijavljeno</div>
      <div class="w-bar done" />
      <div class="w-step cur"><i />Čeka dispečera</div>
      <div class="w-bar" />
      <div class="w-step"><i />Potvrđeno</div>
    </div>

    <p class="w-hint">
      Dispečer potvrđuje iznos koji je stvarno primio. Čim to uradi, ovdje ćeš vidjeti novo stanje.
    </p>

    <div class="w-poll">
      <span><v-icon icon="mdi-sync" size="14" /> Provjeravam svakih {{ pollSeconds }} s</span>
      <button type="button" :class="{ spin: checking }" :disabled="checking" @click="emit('check')">
        <v-icon icon="mdi-refresh" size="16" />Provjeri sada
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { WALLET_POLL_MS } from "~/composables/useWalletSource";
import { clockOf } from "~/utils/historyGroups";
import { agoLabel, kmText } from "~/utils/walletLedger";
import type { WalletHandover } from "~/types/wallet-ledger";

// Predaja gotovine koju je kurir prijavio, a dispečer još nije potvrdio. Dug se ne mijenja dok
// se ne potvrdi, pa kartica kaže šta se čeka, od kada i da ekran sam provjerava. Dok kartica
// stoji, dugme za novu prijavu se ne nudi (server drugu prijavu ionako odbija).
defineProps<{
  handover: WalletHandover;
  // "Provjeri sada" je u toku.
  checking: boolean;
}>();

const emit = defineEmits<{ check: [] }>();

const pollSeconds = WALLET_POLL_MS / 1000;

// "prije 12 min" se osvježava sam, bez ostatka ekrana.
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
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
  background: #fff2df;
  color: #9a4a07;
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

.w-steps {
  display: grid;
  grid-template-columns: auto 1fr auto 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #657083;
}

.w-step {
  display: grid;
  justify-items: center;
  gap: 5px;
  text-align: center;
}

.w-step i {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #c3c9d4;
}

.w-step.done i {
  background: #00b37e;
  border-color: #00b37e;
}

.w-step.cur i {
  background: #ff9f1c;
  border-color: #ff9f1c;
  box-shadow: 0 0 0 4px #fff2df;
}

.w-step.done,
.w-step.cur {
  color: #0b1220;
}

.w-bar {
  height: 3px;
  margin-bottom: 17px;
  border-radius: 999px;
  background: #dfe3ea;
}

.w-bar.done {
  background: #00b37e;
}

.w-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5b6676;
}

.w-poll {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.78rem;
  color: #5b6676;
}

.w-poll button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  color: #0b1220;
  cursor: pointer;
}

.w-poll button:active {
  background: #f1f4f9;
}

.w-poll button:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.w-poll button:disabled {
  cursor: progress;
}

.w-poll button.spin :deep(.v-icon) {
  animation: w-spin 0.8s linear infinite;
}

@keyframes w-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-poll button.spin :deep(.v-icon) {
    animation: none;
  }
}
</style>
