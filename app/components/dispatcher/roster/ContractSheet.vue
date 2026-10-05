<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Ugovor i isplata"
    subtitle="Važi samo za ovu firmu."
    :dirty="check.dirty"
    :focus="focus"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <ChoiceGroup
      :model-value="draft.payType"
      :options="options"
      label="Način isplate"
      :columns="3"
      @update:model-value="pickType(Number($event) as CourierPayingType)"
    />
    <SheetField
      v-model="draft.paying"
      name="paying"
      label="Iznos"
      inputmode="decimal"
      placeholder="0.00"
      :format="maskAmount"
      :message="message('paying', 'paying')"
      @update:model-value="edited"
    >
      <template #tail><span class="cts-suf">{{ paySuffix(draft.payType, currency) }}</span></template>
    </SheetField>
    <SheetField
      v-model="draft.bank"
      name="bank"
      label="Žiro račun"
      optional
      inputmode="numeric"
      placeholder="161-0000000000-00"
      :message="message('bank', 'bank_account')"
      @update:model-value="edited"
    />
    <SheetField
      v-model="draft.signed"
      name="signed"
      label="Potpisan ugovor"
      optional
      inputmode="numeric"
      placeholder="dd.mm.gggg"
      :format="formatDobDigits"
      :significant="isDigit"
      :message="message('signed', 'contract_signed_at')"
      @update:model-value="edited"
      @blur="touch('signed')"
    />
    <SheetField
      v-model="draft.from"
      name="from"
      label="Početak rada"
      optional
      inputmode="numeric"
      placeholder="dd.mm.gggg"
      enterkeyhint="done"
      :format="formatDobDigits"
      :significant="isDigit"
      :message="message('from', 'contract_active_from')"
      @update:model-value="edited"
      @blur="touch('from')"
    />

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da sačuvam">{{ error }}</TintAlert>

    <template #footer>
      <AppButton submit :disabled="!check.dirty || !check.valid" :loading="saving">
        {{ saving ? "Čuvam…" : "Sačuvaj" }}
      </AppButton>
      <p>{{ hint }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import {
  PAY_TYPES,
  checkContract,
  maskAmount,
  paySuffix,
  type RosterCourier,
} from "~/utils/courierRoster";
import { formatDobDigits, isoToText, type FieldMsg } from "~/utils/profileForm";
import type { CourierPayingType, CourierUpdatePayload } from "~/types/company-courier";

// List "Ugovor i isplata" (samo za ovu firmu): način isplate, iznos (sufiks je % za procenat,
// inače valuta firme), žiro račun i dva datuma. Datumi se kucaju kao dd.mm.gggg.
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  currency: string;
  save: (payload: CourierUpdatePayload) => Promise<ActionResult>;
  focus?: string | null;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, show, touch, submitted, saving, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({
    payType: props.courier.payType as CourierPayingType | null,
    paying: props.courier.paying,
    bank: props.courier.bank,
    signed: isoToText(props.courier.signed),
    from: isoToText(props.courier.from),
  })
);

const options: ChoiceOption[] = (Object.keys(PAY_TYPES) as unknown as CourierPayingType[]).map((k) => ({
  value: k,
  label: PAY_TYPES[k].label,
  hint: PAY_TYPES[k].hint,
  icon: PAY_TYPES[k].icon,
  ink: "#2459c7",
  tint: "#eef4ff",
}));

const isDigit = (ch: string) => ch >= "0" && ch <= "9";

const now = new Date();
const check = computed(() => checkContract(draft, props.courier, now, show));

const message = (key: "paying" | "bank" | "signed" | "from", apiKey: string): FieldMsg | null => {
  const fromServer = serverFields.value[apiKey];
  return fromServer ? { tone: "bad", text: fromServer } : (check.value.fields[key] ?? null);
};

const pickType = (type: CourierPayingType) => {
  draft.payType = type;
  edited();
};

const hint = computed(() => {
  if (saving.value) return "";
  if (!check.value.dirty) return "Nema izmjena.";
  return check.value.valid ? "" : "Provjeri polja iznad.";
});

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => check.value.valid && check.value.dirty,
  firstBad: () => (["paying", "signed", "from"] as const).find((k) => check.value.fields[k]?.tone === "bad") ?? null,
  run: () => props.save(check.value.payload),
});
</script>

<style scoped>
.cts-suf {
  padding-right: 10px;
  font-size: 0.9rem;
  font-weight: 800;
  color: #657083;
}
</style>
