<template>
  <FormDialog
    :open="open"
    :title="isReceipt ? 'Primio sam gotovinu' : 'Isplati zaradu'"
    :saving="submitting"
    :save-text="isReceipt ? 'Evidentiraj' : 'Isplati'"
    max-width="420"
    @update:open="emit('update:open', $event)"
    @save="submit"
  >
    <p class="action-copy">
      <strong>{{ toLatin(courierName) || `Kurir #${courierId}` }}</strong>
      · Kurir #{{ courierId }}
      <br />
      <template v-if="isReceipt">
        <template v-if="cashOwed < 0">
          Firma duguje kuriru (gotovina) <strong>{{ money(-cashOwed) }}</strong>
        </template>
        <template v-else>
          Drži firmine gotovine <strong>{{ money(cashOwed) }}</strong>
        </template>
      </template>
      <template v-else>
        Firma duguje <strong>{{ money(wageOwed) }}</strong>
      </template>
    </p>

    <GlobalTextField
      v-model.number="amount"
      :label="
        isReceipt
          ? `Iznos koji ste primili (${currency})`
          : `Iznos koji isplaćujete (${currency})`
      "
      type="number"
      inputmode="decimal"
      step="0.01"
      prepend-inner-icon="mdi-cash"
      :rules="[rules.required(), rules.positiveNumber()]"
      hide-details="auto"
    />

    <GlobalSelect
      v-if="!isReceipt"
      v-model="method"
      :items="methodOptions"
      item-title="label"
      item-value="value"
      label="Način isplate"
      hide-details="auto"
    />

    <GlobalTextarea
      v-model="note"
      label="Napomena (opciono)"
      :placeholder="
        isReceipt ? 'npr. Predao lično na kraju smjene' : 'npr. Isplata za avgust'
      "
      rows="2"
      auto-grow
      hide-details="auto"
    />
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import { formatAmount } from "~/utils/currency";

const props = defineProps<{
  open: boolean;
  // "receipt" = dispečer je primio gotovinu od kurira (§4c),
  // "payout"  = dispečer isplaćuje zaradu kuriru (§5).
  mode: "receipt" | "payout";
  courierId: number | null;
  courierName: string;
  // Saldo gotovine kurira (može biti negativan = firma duguje kuriru).
  cashOwed: number;
  // Zarada koju firma duguje kuriru.
  wageOwed: number;
  submitting: boolean;
  submitCashReceipt: (courierId: number, amount: number, note?: string) => Promise<boolean>;
  submitPayout: (
    courierId: number,
    amount: number,
    method: string,
    idempotencyKey: string,
    note?: string
  ) => Promise<boolean>;
  // Valuta firme (finance-settings) - fallback "KM".
  currency: string;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const rules = useValidationRules();
const isReceipt = computed(() => props.mode === "receipt");
const money = (value: number) => formatAmount(value, props.currency);

const methodOptions = [
  { label: "Gotovina", value: "gotovina" },
  { label: "Bankovni transfer", value: "bankovni transfer" },
];

const amount = ref<number | null>(null);
const note = ref("");
const method = ref("gotovina");
// Generisan pri otvaranju forme (ne pri kliku "Isplati") - isti kroz sve
// pokušaje istog otvaranja (dupli klik/mrežni retry), novo otvaranje = novi
// ključ. Backend odgovor 16.09.2026 §2.
const idempotencyKey = ref("");

// Svako otvaranje kreće od čistih polja - dijalog ne pamti prethodni unos.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    amount.value = null;
    note.value = "";
    method.value = "gotovina";
    idempotencyKey.value = crypto.randomUUID();
  }
);

const submit = async () => {
  if (props.courierId == null || amount.value == null) return;
  const trimmedNote = note.value.trim() || undefined;
  const ok = isReceipt.value
    ? await props.submitCashReceipt(props.courierId, Number(amount.value), trimmedNote)
    : await props.submitPayout(
        props.courierId,
        Number(amount.value),
        method.value,
        idempotencyKey.value,
        trimmedNote
      );
  if (ok) emit("update:open", false);
};
</script>

<style scoped>
.action-copy {
  margin: 0 0 4px;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #495260;
}
</style>
