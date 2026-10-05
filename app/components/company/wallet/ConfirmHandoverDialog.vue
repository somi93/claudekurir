<template>
  <FormDialog
    :open="open"
    title="Potvrdi predaju gotovine"
    :saving="saving"
    save-text="Potvrdi"
    max-width="420"
    @update:open="emit('update:open', $event)"
    @save="submit"
  >
    <p class="confirm-copy">
      {{ courierName }} je prijavio predaju od
      <strong>{{ money(reportedAmount) }}</strong
      >. Upiši iznos koji si stvarno primio.
    </p>
    <GlobalTextField
      v-model.number="amount"
      :label="`Potvrđeni iznos (${currency})`"
      type="number"
      inputmode="decimal"
      step="0.01"
      prepend-inner-icon="mdi-cash"
      :rules="[rules.required(), rules.positiveNumber()]"
      hide-details="auto"
    />
    <template v-if="amountsDiffer">
      <GlobalTextarea
        v-model="note"
        label="Napomena o razlici (opciono)"
        rows="2"
        auto-grow
        hide-details="auto"
      />
      <p class="confirm-diff">
        Razlika: {{ money(amount - reportedAmount) }}. Ako ne upišeš napomenu, sistem
        je generiše automatski.
      </p>
    </template>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import FormDialog from "~/components/common/FormDialog.vue";
import { useValidationRules } from "~/composables/useValidationRules";
import { formatAmount } from "~/utils/currency";
import type { PendingCashHandover } from "~/types/cash-handover";

const props = defineProps<{
  open: boolean;
  handover: PendingCashHandover | null;
  courierName: string;
  saving: boolean;
  confirm: (handoverId: number, confirmedAmount: number, note?: string) => Promise<boolean>;
  // Valuta firme (finance-settings) - fallback "KM".
  currency: string;
}>();

const money = (value: number) => formatAmount(value, props.currency);
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const rules = useValidationRules();

const amount = ref(0);
const note = ref("");

const reportedAmount = computed(() => Number(props.handover?.reported_amount ?? 0));
const amountsDiffer = computed(
  () => Math.abs(Number(amount.value) - reportedAmount.value) > 0.001
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen || !props.handover) return;
    amount.value = Number(props.handover.reported_amount);
    note.value = "";
  }
);

const submit = async () => {
  if (!props.handover) return;
  const ok = await props.confirm(
    props.handover.id,
    Number(amount.value),
    note.value.trim() || undefined
  );
  if (ok) emit("update:open", false);
};
</script>

<style scoped>
.confirm-copy {
  margin: 0 0 4px;
  font-size: 0.88rem;
  color: #495260;
}

.confirm-diff {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: #b26a00;
}
</style>
