<template>
  <AppSheet
    ref="sheet"
    :open="open"
    :title="receipt ? 'Evidentiraj uplatu' : 'Isplati zaradu'"
    :subtitle="subtitle"
    :dirty="(Boolean(draft.amount.trim()) && draft.amount !== initialAmount) || Boolean(draft.note.trim())"
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

    <ChoiceGroup
      v-if="!receipt"
      :model-value="draft.method"
      :options="METHODS"
      label="Način isplate"
      variant="pills"
      @update:model-value="pickMethod(String($event))"
    />

    <template v-if="!receipt && draft.method === 'bankovni transfer'">
      <div v-if="bankRows.length" class="cs-kv">
        <div v-for="row in bankRows" :key="row.key">
          <span>
            <small>{{ row.label }}</small>
            <b>{{ row.value }}</b>
          </span>
          <button
            type="button"
            class="cs-cp"
            :data-sheet="`copy-${row.key}`"
            :aria-label="`Kopiraj ${row.label.toLowerCase()}`"
            @click="copy(row)"
          >
            <v-icon :icon="copied === row.key ? 'mdi-check' : 'mdi-content-copy'" size="20" />
          </button>
        </div>
      </div>
      <TintAlert v-else tone="warn" role="status" title="Račun kurira nije upisan">
        Upiši ga u Kuriri (Ugovor i isplata) ili izaberi gotovinu. Isplata se može evidentirati i bez računa.
      </TintAlert>
    </template>

    <SheetField
      v-model="draft.note"
      name="note"
      label="Napomena"
      optional
      @update:model-value="edited"
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
import type { CashParty } from "~/utils/cashDesk";
import { copyText } from "~/utils/clipboard";
import { checkAmount, maskAmount } from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";
import type { FieldMsg } from "~/utils/profileForm";

// Liste "Evidentiraj uplatu" (kurir je predao gotovinu) i "Isplati zaradu". Iznos je unaprijed
// popunjen cijelim dugom i može se vratiti jednim dodirom; iznos veći od duga upozorava, ne
// zabranjuje (kao i danas). Isplata nosi ključ koji se pravi pri otvaranju lista i ostaje isti kroz
// sve pokušaje (backend na isti ključ vraća istu transakciju, pa dupli dodir ne isplaćuje dvaput).
const props = defineProps<{
  open: boolean;
  courier: CashParty;
  mode: "receipt" | "payout";
  currency: string;
  receiptSave: (amount: number, note: string) => Promise<ActionResult>;
  payoutSave: (amount: number, method: string, key: string, note: string) => Promise<ActionResult>;
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

// Žiro račun i IBAN kurira uz bankovni transfer: dispečer ih kopira u banku.
const bankRows = computed(() =>
  [
    props.courier.bank ? { key: "bank", label: "Žiro račun", value: props.courier.bank } : null,
    props.courier.iban ? { key: "iban", label: "IBAN", value: props.courier.iban } : null,
  ].filter((r): r is { key: string; label: string; value: string } => r !== null)
);
const copied = ref<string | null>(null);
const copy = async (row: { key: string; value: string }) => {
  if (!(await copyText(row.value))) return;
  copied.value = row.key;
  setTimeout(() => {
    if (copied.value === row.key) copied.value = null;
  }, 1600);
};

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
      : props.payoutSave(amountCheck.value.amount, draft.method, idempotencyKey, draft.note),
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

.cs-kv {
  display: grid;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.cs-kv > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 56px;
  padding: 6px 4px 6px 14px;
}

.cs-kv > div + div {
  border-top: 1px solid #eceef2;
}

.cs-kv span {
  display: grid;
  min-width: 0;
}

.cs-kv small {
  font-size: 0.76rem;
  font-weight: 700;
  color: #5b6676;
}

.cs-kv b {
  font-size: 0.9rem;
  font-weight: 700;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.cs-cp {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.cs-cp:active {
  background: #f1f4f9;
}

.cs-cp:focus-visible,
.cs-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
