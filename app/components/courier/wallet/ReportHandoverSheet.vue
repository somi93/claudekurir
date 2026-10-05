<template>
  <WalletSheet
    :open="open"
    :title="done ? 'Prijava predaje' : 'Prijavi predaju gotovine'"
    :subtitle="done ? undefined : 'Prvo predaj gotovinu dispečeru, pa prijavi iznos.'"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="done" class="rp-done">
      <span class="okc"><v-icon icon="mdi-check" size="34" /></span>
      <h3>Prijavljeno</h3>
      <p>
        {{ kmText(sent) }} KM čeka potvrdu dispečera. Ekran sam provjerava svakih {{ pollSeconds }} s,
        pa ćeš vidjeti kad dispečer potvrdi.
      </p>
      <WalletButton class="rp-done-btn" @click="emit('update:open', false)">Gotovo</WalletButton>
    </div>

    <form v-else id="wallet-report-form" class="rp" novalidate @submit.prevent="submit">
      <div class="rp-ctx">
        <span>Duguješ firmi</span>
        <b>{{ kmText(cash) }} KM</b>
      </div>

      <div class="rp-field" :class="{ bad: fieldBad }">
        <input
          v-model="text"
          class="rp-input"
          inputmode="decimal"
          autocomplete="off"
          aria-label="Iznos koji predaješ u KM"
          aria-describedby="wallet-report-preview"
          :aria-invalid="fieldBad"
          @input="error = ''"
        />
        <span class="rp-unit">KM</span>
      </div>

      <div class="rp-quick">
        <button
          type="button"
          class="rp-chip"
          :aria-pressed="check.amount != null && Math.abs(check.amount - full) < 0.005"
          @click="fillFull"
        >
          Cijeli iznos · {{ kmText(full) }}
        </button>
      </div>

      <div id="wallet-report-preview">
        <div v-if="check.amount == null" class="rp-prev">
          <span>{{ invalidHint }}</span>
        </div>
        <div v-else-if="check.over" class="rp-prev bad">
          <span>
            <v-icon icon="mdi-alert-outline" size="18" />
            Prijavljuješ {{ kmText(check.amount - cash) }} KM više nego što duguješ. Firma ti tada
            duguje razliku.
          </span>
        </div>
        <div v-else class="rp-prev">
          <span>Poslije potvrde ostaje</span>
          <b :class="{ zero: check.rest === 0 }">{{ kmText(check.rest) }} KM</b>
        </div>
      </div>

      <TintAlert v-if="error" tone="bad" role="alert">{{ error }}</TintAlert>

      <p class="rp-hint">
        Dispečer potvrđuje koliko je stvarno primio. Do tada predaja stoji „na čekanju“.
      </p>

      <WalletButton submit :disabled="check.amount == null || saving">
        {{ saving ? "Prijavljujem…" : check.amount != null ? `Prijavi ${kmText(check.amount)} KM` : "Prijavi predaju" }}
      </WalletButton>
    </form>
  </WalletSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import WalletButton from "~/components/courier/wallet/WalletButton.vue";
import WalletSheet from "~/components/courier/wallet/WalletSheet.vue";
import { WALLET_POLL_MS } from "~/composables/useWalletSource";
import { checkReport, kmText, parseAmount, reportableCash } from "~/utils/walletLedger";

// Prijava predaje gotovine u donjem listu: veliki iznos (prefill = cijeli dug), "Cijeli iznos",
// pregled šta ostaje i meko upozorenje kad je iznos veći od duga (da li backend to dopušta pita
// stavka N7, pa se ne zabranjuje). Zarez i tačka su isto, najviše dvije decimale. Poruka servera
// (npr. "Već imate zahtjev na čekanju od 52.00 KM.") ostaje u listu, iznad dugmeta.
const props = defineProps<{
  open: boolean;
  // cash_owed_to_company (uživo, pa pregled prati osvježeno stanje).
  cash: number;
  // Šalje prijavu; vraća da li je uspjelo i poruku servera ako nije.
  submitReport: (amount: number) => Promise<{ ok: boolean; message: string }>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const text = ref("");
const error = ref("");
const saving = ref(false);
const done = ref(false);
const sent = ref(0);

const pollSeconds = WALLET_POLL_MS / 1000;

const full = computed(() => reportableCash(props.cash));
const check = computed(() => checkReport(text.value, props.cash));
const fieldBad = computed(() => text.value.trim() !== "" && check.value.amount == null);

const invalidHint = computed(() =>
  text.value.trim() === "" || parseAmount(text.value) === 0
    ? "Upiši iznos veći od 0."
    : "Upiši iznos u KM, najviše dvije decimale, bez slova."
);

const fillFull = () => {
  text.value = kmText(full.value);
  error.value = "";
};

// Svako otvaranje počinje iznova, sa cijelim dugom.
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    text.value = kmText(full.value);
    error.value = "";
    saving.value = false;
    done.value = false;
  },
  { immediate: true }
);

const submit = async () => {
  const amount = check.value.amount;
  if (amount == null || saving.value) return;
  saving.value = true;
  error.value = "";
  const result = await props.submitReport(amount);
  saving.value = false;
  if (result.ok) {
    sent.value = amount;
    done.value = true;
  } else {
    error.value = result.message || "Ne mogu da prijavim predaju gotovine.";
  }
};
</script>

<style scoped>
.rp {
  display: grid;
  gap: 14px;
  padding: 4px 0 0;
}

.rp-ctx {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.86rem;
  color: #5b6676;
}

.rp-ctx b {
  color: #0b1220;
  font-variant-numeric: tabular-nums;
}

.rp-field {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  background: #f5f6f8;
  box-shadow: inset 0 0 0 2px transparent;
  transition: box-shadow 0.15s;
}

.rp-field:focus-within {
  background: #fff;
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.rp-field.bad {
  box-shadow: inset 0 0 0 2px #e5484d;
}

.rp-input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 2.15rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  text-align: right;
  color: #0b1220;
  font-variant-numeric: tabular-nums;
}

.rp-unit {
  flex: none;
  font-size: 1.1rem;
  font-weight: 800;
  color: #5b6676;
}

.rp-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 15px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  color: #0b1220;
  cursor: pointer;
}

.rp-chip[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.rp-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.rp-prev {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f5f6f8;
  font-size: 0.88rem;
  color: #5b6676;
}

.rp-prev b {
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.rp-prev b.zero {
  color: #00734f;
}

.rp-prev.bad {
  background: #fff2df;
  color: #5c3305;
}

.rp-prev.bad > span {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  line-height: 1.4;
}

.rp-prev.bad :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
  color: #9a4a07;
}

.rp-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #5b6676;
}

.rp-done {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 10px 0 6px;
  text-align: center;
}

.okc {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: #00b37e;
  color: #04271b;
  animation: w-pop 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.rp-done h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.rp-done p {
  max-width: 290px;
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #5b6676;
}

.rp-done-btn {
  margin-top: 6px;
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
  .rp-field,
  .okc {
    transition: none;
    animation: none;
  }
}
</style>
