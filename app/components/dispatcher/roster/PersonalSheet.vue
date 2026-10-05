<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Lični podaci"
    subtitle="Vezani su za osobu, ne za firmu."
    :dirty="check.dirty"
    :focus="focus"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetField
      v-model="draft.dob"
      name="dob"
      label="Datum rođenja"
      optional
      inputmode="numeric"
      placeholder="dd.mm.gggg"
      ok-ring
      :format="formatDobDigits"
      :significant="isDigit"
      :message="message('dob', 'date_of_birth')"
      @update:model-value="edited"
      @blur="touch('dob')"
    />
    <SheetField
      v-model="draft.iban"
      name="iban"
      label="IBAN"
      optional
      autocapitalize="characters"
      placeholder="BA39 0000 0000 0000 0000"
      enterkeyhint="done"
      :format="formatIban"
      :significant="isAlnum"
      :message="message('iban', 'iban')"
      @update:model-value="edited"
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
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import { checkPersonal, type RosterCourier } from "~/utils/courierRoster";
import { formatDobDigits, formatIban, isoToText, type FieldMsg } from "~/utils/profileForm";
import type { CourierUpdatePayload } from "~/types/company-courier";

// List "Lični podaci": datum rođenja (maska dd.mm.gggg, godine uz potvrdu) i IBAN (grupe po 4).
// Neispravan datum blokira snimanje, a IBAN samo upozorava: backend je prihvatio i brojeve koji
// nisu pravi IBAN.
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  save: (payload: CourierUpdatePayload) => Promise<ActionResult>;
  focus?: string | null;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, show, touch, submitted, saving, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ dob: isoToText(props.courier.dob), iban: formatIban(props.courier.iban) })
);

const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const isAlnum = (ch: string) => /[A-Za-z0-9]/.test(ch);

const now = new Date();
const check = computed(() => checkPersonal(draft, props.courier, now, show));

const message = (key: "dob" | "iban", apiKey: string): FieldMsg | null => {
  const fromServer = serverFields.value[apiKey];
  return fromServer ? { tone: "bad", text: fromServer } : (check.value.fields[key] ?? null);
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
  firstBad: () => (check.value.fields.dob?.tone === "bad" ? "dob" : null),
  run: () => props.save(check.value.payload),
});
</script>
