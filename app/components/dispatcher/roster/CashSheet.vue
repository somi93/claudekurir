<template>
  <AppSheet
    ref="sheet"
    :open="open"
    :title="receipt ? 'Evidentiraj uplatu' : 'Isplati zaradu'"
    :subtitle="subtitle"
    :dirty="Boolean(draft.amount.trim()) && draft.amount !== initialAmount"
    focus="amount"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetField
      v-model="draft.amount"
      name="amount"
      :label="receipt ? 'Primljeni iznos' : 'Isplaćeni iznos'"
      inputmode="decimal"
      enterkeyhint="done"
      :format="maskAmount"
      :message="serverMessage ?? amountCheck.message"
      @update:model-value="edited"
    >
      <template #tail><span class="cs-suf">{{ currency }}</span></template>
    </SheetField>

    <div v-if="owed != null && owed > 0" class="cs-qr">
      <button type="button" class="cs-chip" data-sheet="fill" @click="fill">
        Cijeli iznos {{ formatAmount(owed, currency) }}
      </button>
    </div>

    <SheetField
      v-if="receipt"
      v-model="draft.note"
      name="note"
      label="Napomena"
      optional
      @update:model-value="edited"
    />
    <ChoiceGroup
      v-else
      :model-value="draft.method"
      :options="METHODS"
      label="Način isplate"
      variant="pills"
      @update:model-value="pickMethod(String($event))"
    />

    <TintAlert v-if="error" tone="bad" role="alert" :title="receipt ? 'Ne mogu da evidentiram' : 'Ne mogu da isplatim'">
      {{ error }}
    </TintAlert>

    <template #footer>
      <AppButton submit :disabled="!amountCheck.valid" :loading="saving">
        {{ saving ? "Čuvam…" : receipt ? "Evidentiraj uplatu" : "Isplati zaradu" }}
      </AppButton>
      <p>{{ !saving && !amountCheck.valid ? amountCheck.hint : "" }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import { checkAmount, maskAmount, type RosterCourier } from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";
import type { FieldMsg } from "~/utils/profileForm";

// Liste "Evidentiraj uplatu" (kurir je predao gotovinu) i "Isplati zaradu". Iznos je unaprijed
// popunjen cijelim dugom i može se vratiti jednim dodirom; iznos veći od duga upozorava, ne
// zabranjuje (kao i danas). Isplata nosi ključ koji se pravi pri otvaranju lista i ostaje isti kroz
// sve pokušaje (backend na isti ključ vraća istu transakciju, pa dupli dodir ne isplaćuje dvaput).
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  mode: "receipt" | "payout";
  currency: string;
  receiptSave: (amount: number, note: string) => Promise<ActionResult>;
  payoutSave: (amount: number, method: string, key: string) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const METHODS: ChoiceOption[] = [
  { value: "gotovina", label: "Gotovina" },
  { value: "bankovni transfer", label: "Bankovni transfer" },
];

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);
const receipt = computed(() => props.mode === "receipt");

const owed = computed(() => (receipt.value ? props.courier.cash : props.courier.wage));
const initialAmount = computed(() => (owed.value != null && owed.value > 0 ? owed.value.toFixed(2) : ""));

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ amount: initialAmount.value, note: "", method: "gotovina" })
);

// Ključ isplate: novo otvaranje lista je nova isplata.
let idempotencyKey = "";
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) idempotencyKey = crypto.randomUUID();
  },
  { immediate: true }
);

const subtitle = computed(() =>
  receipt.value
    ? `${props.courier.name} · duguje ${formatAmount(Math.max(0, props.courier.cash ?? 0), props.currency)}`
    : `${props.courier.name} · firma duguje ${formatAmount(props.courier.wage ?? 0, props.currency)}`
);

const amountCheck = computed(() => checkAmount(draft.amount, owed.value, props.currency, props.mode));

const serverMessage = computed<FieldMsg | null>(() =>
  serverFields.value.amount ? { tone: "bad", text: serverFields.value.amount } : null
);

const fill = () => {
  draft.amount = initialAmount.value;
  edited();
};

const pickMethod = (method: string) => {
  draft.method = method;
  edited();
};

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => amountCheck.value.valid,
  firstBad: () => "amount",
  run: () =>
    receipt.value
      ? props.receiptSave(amountCheck.value.amount, draft.note)
      : props.payoutSave(amountCheck.value.amount, draft.method, idempotencyKey),
  success: () => (receipt.value ? "Predaja gotovine je evidentirana." : "Zarada je isplaćena."),
});
</script>

<style scoped>
.cs-suf {
  padding-right: 10px;
  font-size: 0.9rem;
  font-weight: 800;
  color: #657083;
}

.cs-qr {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cs-chip {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.cs-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
