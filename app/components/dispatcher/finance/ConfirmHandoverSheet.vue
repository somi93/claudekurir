<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Potvrdi predaju"
    label="Potvrdi predaju gotovine"
    :subtitle="subtitle"
    :dirty="dirty"
    focus="amount"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetField
      v-model="draft.amount"
      name="amount"
      label="Primljeni iznos"
      inputmode="decimal"
      enterkeyhint="done"
      :format="maskAmount"
      :message="serverMessage"
      @update:model-value="edited"
    >
      <template #tail
        ><span class="ch-suf">{{ currency }}</span></template
      >
    </SheetField>

    <div v-if="showSame" class="ch-qr">
      <button type="button" class="ch-chip" data-sheet="same" @click="sameAsReported">
        Isto kao prijava {{ formatAmount(reported, currency) }}
      </button>
    </div>

    <div class="ch-msgs" aria-live="polite">
      <template v-if="check.valid">
        <FinanceMsg v-for="m in check.msgs" :key="m.text" :tone="m.tone">{{
          m.text
        }}</FinanceMsg>
      </template>
      <FinanceMsg v-else-if="draft.amount.trim()" tone="bad">{{ check.hint }}</FinanceMsg>
    </div>

    <SheetSummary v-if="summary" :rows="summary" />

    <SheetField
      v-if="check.valid && check.diff !== 0"
      v-model="draft.note"
      name="note"
      label="Napomena o razlici"
      optional
      @update:model-value="edited"
    />

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da potvrdim predaju">{{
      error
    }}</TintAlert>

    <template #footer>
      <AppButton submit :disabled="!check.valid" :loading="saving">
        {{
          saving
            ? "Potvrđujem…"
            : check.valid
            ? `Potvrdi ${formatAmount(check.amount, currency)}`
            : "Potvrdi predaju"
        }}
      </AppButton>
      <p>{{ !saving && !check.valid ? check.hint : "" }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import FinanceMsg from "~/components/dispatcher/finance/FinanceMsg.vue";
import SheetSummary from "~/components/dispatcher/finance/SheetSummary.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import { ageText, confirmCheck, money, type CashRow, type PendingItem } from "~/utils/cashDesk";
import { maskAmount } from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";
import type { FieldMsg } from "~/utils/profileForm";

// List "Potvrdi predaju": iznos je unaprijed upisan prijavljenim iznosom, a prije slanja se vide razlika
// od prijave (sa predznakom), dug kurira prije i poslije potvrde i upozorenje kad je iznos veći od duga.
// Potvrda se ne može poništiti (nema rute), zato je iznos u dugmetu. Napomena o razlici se pojavi samo kad
// razlike ima i šalje se samo ako je upisana (server sam upiše napomenu o razlici).
const props = defineProps<{
  open: boolean;
  courier: CashRow;
  handover: PendingItem;
  currency: string;
  now: number;
  save: (amount: number, note: string) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);
const reported = computed(() => props.handover.amount);
const reportedText = computed(() => reported.value.toFixed(2));

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ amount: reportedText.value, note: "" })
);

const check = computed(() =>
  confirmCheck({ text: draft.amount, reported: reported.value, owed: props.courier.cash, currency: props.currency })
);

const dirty = computed(() => Boolean(draft.note.trim()) || draft.amount !== reportedText.value);

const subtitle = computed(
  () => `${props.courier.name} · prijavio ${formatAmount(reported.value, props.currency)} ${ageText(props.handover.at, props.now)}`
);

const showSame = computed(() => check.value.valid && draft.amount !== reportedText.value);

const summary = computed(() => {
  const c = check.value;
  if (!c.valid || c.after == null) return null;
  return [
    { label: "Dug kurira sada", value: money(props.courier.cash, props.currency) },
    c.after < 0
      ? { label: "Firma će dugovati kuriru (gotovina)", value: money(-c.after, props.currency) }
      : { label: "Dug poslije potvrde", value: money(c.after, props.currency) },
  ];
});

const serverMessage = computed<FieldMsg | null>(() => {
  const text = serverFields.value.confirmed_amount ?? serverFields.value.amount;
  return text ? { tone: "bad", text } : null;
});

const sameAsReported = () => {
  draft.amount = reportedText.value;
  edited();
  sheet.value?.focusField("amount");
};

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => check.value.valid,
  firstBad: () => "amount",
  run: () => props.save(check.value.amount, check.value.diff !== 0 ? draft.note : ""),
  success: () => `Predaja potvrđena: ${props.courier.name} · ${money(check.value.amount, props.currency)}`,
});
</script>

<style scoped>
.ch-suf {
  padding-right: 10px;
  font-size: 0.9rem;
  font-weight: 800;
  color: #657083;
}

.ch-qr {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ch-chip {
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

.ch-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.ch-msgs {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.ch-msgs:empty {
  display: none;
}
</style>
