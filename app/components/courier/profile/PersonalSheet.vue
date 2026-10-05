<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Lični podaci"
    subtitle="Sve je opciono, ali hitni kontakt je dobro imati."
    :dirty="check.dirty || !check.valid"
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
      placeholder="DD.MM.GGGG"
      :maxlength="10"
      ok-ring
      :format="formatDobDigits"
      :significant="isDigit"
      :message="message('dob', 'date_of_birth')"
      @update:model-value="onDob"
      @blur="touch('dob')"
    />
    <SheetField
      v-model="draft.iban"
      name="iban"
      label="IBAN"
      optional
      placeholder="npr. BA39 1290 0794 0102 8494"
      autocapitalize="characters"
      ok-ring
      :format="formatIban"
      :significant="isAlnum"
      :message="message('iban', 'iban')"
      @update:model-value="edited"
      @blur="touch('iban')"
    />

    <p class="ps-group">Hitni kontakt <i>opciono</i></p>
    <SheetField
      v-model="draft.ecName"
      name="ecName"
      label="Ime osobe"
      autocomplete="off"
      :message="message('ecName', 'emergency_contact_name')"
      @update:model-value="edited"
      @blur="touch('ecName')"
    />
    <SheetField
      v-model="draft.ecPhone"
      name="ecPhone"
      label="Telefon osobe"
      type="tel"
      inputmode="tel"
      enterkeyhint="done"
      placeholder="npr. 066 987 654"
      :message="message('ecPhone', 'emergency_contact_phone')"
      @update:model-value="edited"
      @blur="touch('ecPhone')"
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
import { computed, nextTick, ref, toRef } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useAlertStore } from "~/stores/alert";
import type { SaveResult } from "~/stores/profile";
import type { CourierProfileUpdate } from "~/types/courier";
import {
  checkPersonal,
  formatDobDigits,
  formatIban,
  isoToText,
  type FieldMsg,
  type ProfileValues,
} from "~/utils/profileForm";

// List "Lični podaci": datum rođenja, IBAN i hitni kontakt. Datum je polje sa maskom
// DD.MM.GGGG (numerička tastatura, godine se računaju dok se kuca) umjesto kalendara sa 153
// godine; šalje se i dalje kao YYYY-MM-DD. IBAN se grupiše po 4, a pogrešan format je samo
// UPOZORENJE (ne znamo da li backend prima i lokalne brojeve računa), snimanje ostaje moguće.
// Neispravan datum blokira snimanje i nikad ne briše sačuvani.
const props = defineProps<{
  open: boolean;
  saved: ProfileValues;
  save: (payload: CourierProfileUpdate) => Promise<SaveResult>;
  focus?: string | null;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const alerts = useAlertStore();
const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const isDigit = (ch: string) => /\d/.test(ch);
const isAlnum = (ch: string) => /[A-Za-z0-9]/.test(ch);

const { draft, show, touch, untouch, submitted, saving, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({
    dob: isoToText(props.saved.dob),
    iban: formatIban(props.saved.iban),
    ecName: props.saved.ecName,
    ecPhone: props.saved.ecPhone,
  })
);

const check = computed(() => checkPersonal(draft, props.saved, new Date(), show));

const message = (
  key: "dob" | "iban" | "ecName" | "ecPhone",
  apiKey: string
): FieldMsg | null => {
  const fromServer = serverFields.value[apiKey];
  return fromServer ? { tone: "bad", text: fromServer } : (check.value.fields[key] ?? null);
};

const onDob = () => {
  untouch("dob");
  edited();
};

// Neispravan unos ne mijenja ono što je sačuvano, pa "Nema izmjena." ne smije stajati uz grešku.
const hint = computed(() => {
  if (saving.value) return "";
  const fields = Object.values(check.value.fields);
  if (fields.some((field) => field?.tone === "bad")) return "Provjeri polja iznad.";
  if (!check.value.valid) return "Dovrši datum.";
  return check.value.dirty ? "" : "Nema izmjena.";
});

const submit = async () => {
  if (saving.value) return;
  if (!check.value.valid || !check.value.dirty) {
    submitted.value = true;
    await nextTick();
    const bad = (["dob", "iban", "ecName", "ecPhone"] as const).find(
      (key) => check.value.fields[key]?.tone === "bad"
    );
    if (bad) sheet.value?.focusField(bad);
    return;
  }
  saving.value = true;
  error.value = "";
  const result = await props.save(check.value.payload);
  saving.value = false;
  if (result.ok) {
    alerts.success("Sačuvano.", 3000);
    sheet.value?.closeNow();
  } else {
    error.value = result.message;
    serverFields.value = result.fields;
  }
};
</script>

<style scoped>
.ps-group {
  margin: 6px 0 -4px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6676;
}

.ps-group i {
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  color: #657083;
}
</style>
