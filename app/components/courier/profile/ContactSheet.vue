<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Kontakt podaci"
    subtitle="Dispečer vidi tvoje ime i zove te na ovaj broj."
    :dirty="check.dirty"
    :focus="focus"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetField
      v-model="draft.name"
      name="name"
      label="Ime"
      autocomplete="given-name"
      :message="message('name', 'name')"
      @update:model-value="edited"
      @blur="touch('name')"
    />
    <SheetField
      v-model="draft.lastname"
      name="lastname"
      label="Prezime"
      autocomplete="family-name"
      :message="message('lastname', 'lastname')"
      @update:model-value="edited"
      @blur="touch('lastname')"
    />
    <SheetField
      v-model="draft.phone"
      name="phone"
      label="Telefon"
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      enterkeyhint="done"
      placeholder="npr. 065 123 456"
      :message="message('phone', 'phone')"
      @update:model-value="edited"
      @blur="touch('phone')"
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
import type { SaveResult } from "~/stores/profile";
import { useAlertStore } from "~/stores/alert";
import { checkContact, type FieldMsg, type ProfileValues } from "~/utils/profileForm";
import type { CourierProfileUpdate } from "~/types/courier";

// List "Kontakt podaci": ime, prezime i telefon. Šalje se samo ono što je izmijenjeno; dugme je
// neaktivno dok nema izmjena ili dok je neko polje neispravno, a ispod njega piše zašto.
const props = defineProps<{
  open: boolean;
  saved: ProfileValues;
  save: (payload: CourierProfileUpdate) => Promise<SaveResult>;
  focus?: string | null;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const alerts = useAlertStore();
const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, show, touch, submitted, saving, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ name: props.saved.name, lastname: props.saved.lastname, phone: props.saved.phone })
);

const check = computed(() => checkContact(draft, props.saved, show));

// Poruka servera (ako je stigla) ima prednost nad našom provjerom.
const message = (key: "name" | "lastname" | "phone", apiKey: string): FieldMsg | null => {
  const fromServer = serverFields.value[apiKey];
  return fromServer ? { tone: "bad", text: fromServer } : (check.value.fields[key] ?? null);
};

const hint = computed(() => {
  if (saving.value) return "";
  if (!check.value.dirty) return "Nema izmjena.";
  return check.value.valid ? "" : "Provjeri polja iznad.";
});

const submit = async () => {
  if (saving.value) return;
  if (!check.value.valid || !check.value.dirty) {
    submitted.value = true;
    await nextTick();
    const bad = (["name", "lastname", "phone"] as const).find(
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
