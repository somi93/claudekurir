<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Kontakt"
    :subtitle="`${courier.name} · #${courier.id}`"
    :dirty="check.dirty"
    :focus="focus"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetField
      v-model="draft.first"
      name="first"
      label="Ime"
      autocomplete="off"
      autocapitalize="words"
      :message="message('first', 'name')"
      @update:model-value="edited"
      @blur="touch('first')"
    />
    <SheetField
      v-model="draft.last"
      name="last"
      label="Prezime"
      autocomplete="off"
      autocapitalize="words"
      :message="message('last', 'lastname')"
      @update:model-value="edited"
      @blur="touch('last')"
    />
    <SheetField
      v-model="draft.phone"
      name="phone"
      label="Telefon"
      type="tel"
      inputmode="tel"
      placeholder="065 123 456"
      :message="message('phone', 'phone')"
      @update:model-value="edited"
      @blur="touch('phone')"
    />

    <h3 class="cs-h">Hitni kontakt</h3>
    <TintAlert tone="info">
      Osoba koju dispečer može pozvati ako se kuriru nešto desi na dostavi.
    </TintAlert>
    <SheetField
      v-model="draft.ecName"
      name="ecName"
      label="Ime"
      optional
      autocapitalize="words"
      :message="message('ecName', 'emergency_contact_name')"
      @update:model-value="edited"
    />
    <SheetField
      v-model="draft.ecPhone"
      name="ecPhone"
      label="Telefon"
      optional
      type="tel"
      inputmode="tel"
      enterkeyhint="done"
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
import { computed, ref, toRef } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import { checkContact, contactValues, type RosterCourier } from "~/utils/courierRoster";
import type { FieldMsg } from "~/utils/profileForm";
import type { CourierUpdatePayload } from "~/types/company-courier";

// List "Kontakt": ime, prezime, telefon i hitni kontakt. Ime i prezime idu serveru zajedno (backend
// inače nadopisuje sačuvano prezime); šalje se samo ono što je izmijenjeno.
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  roster: RosterCourier[];
  save: (payload: CourierUpdatePayload) => Promise<ActionResult>;
  focus?: string | null;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, show, touch, submitted, saving, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => contactValues(props.courier)
);

const check = computed(() => checkContact(draft, props.courier, props.roster, show));

// Poruka servera (ako je stigla) ima prednost nad našom provjerom.
const message = (key: keyof typeof draft, apiKey: string): FieldMsg | null => {
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
  firstBad: () => (["first", "last", "phone", "ecPhone"] as const).find((k) => check.value.fields[k]?.tone === "bad") ?? null,
  run: () => props.save(check.value.payload),
});
</script>

<style scoped>
.cs-h {
  margin: 6px 0 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}
</style>
