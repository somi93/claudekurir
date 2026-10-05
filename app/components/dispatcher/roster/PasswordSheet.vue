<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Nova lozinka"
    :subtitle="`${courier.name} · ${courier.email || 'bez korisničkog imena'}`"
    :dirty="false"
    focus="password"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="pw">
      <SheetField
        v-model="draft.password"
        name="password"
        label="Nova lozinka"
        autocapitalize="off"
        enterkeyhint="done"
        :message="message"
        @update:model-value="edited"
      />
      <button type="button" class="pw-gen" data-sheet="generate" aria-label="Generiši novu lozinku" @click="generate">
        <v-icon icon="mdi-refresh" size="18" />Nova
      </button>
    </div>

    <TintAlert tone="warn" title="Sistem ne šalje poruku">
      Poslije snimanja dobiješ podatke za prijavu koje kopiraš i šalješ kuriru. Kurir mora da promijeni
      lozinku pri prvoj prijavi.
    </TintAlert>

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da postavim lozinku">{{ error }}</TintAlert>

    <template #footer>
      <AppButton submit :disabled="!check.valid" :loading="saving">
        {{ saving ? "Čuvam…" : "Postavi lozinku" }}
      </AppButton>
      <p>{{ !saving && !check.valid ? "Lozinka mora imati bar 8 znakova." : "" }}</p>
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
import { checkPassword, type RosterCourier } from "~/utils/courierRoster";
import type { FieldMsg } from "~/utils/profileForm";
import { generateTemporaryPassword } from "~/utils/randomPassword";
import type { CourierUpdatePayload } from "~/types/company-courier";

// List "Nova lozinka": predlog se generiše (bez 0/O/1/l/I da se lakše izdiktira), a poslije
// snimanja se otvara kartica sa podacima za prijavu, jer sistem ne šalje ni email ni SMS. Šalje se
// samo { password }; backend postavlja must_change_password.
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  save: (payload: CourierUpdatePayload) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean]; done: [password: string] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ password: generateTemporaryPassword() })
);

const check = computed(() => checkPassword(draft.password));

const message = computed<FieldMsg | null>(() => {
  const fromServer = serverFields.value.password;
  return fromServer ? { tone: "bad", text: fromServer } : (check.value.fields.password ?? null);
});

const generate = () => {
  draft.password = generateTemporaryPassword();
  edited();
};

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => check.value.valid,
  firstBad: () => "password",
  run: () => props.save({ password: draft.password }),
  success: null,
  onDone: () => emit("done", draft.password),
});
</script>

<style scoped>
.pw {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
}

/* Dugme stoji u visini polja (labela iznad polja je oko 20 px). */
.pw-gen {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  margin-top: 26px;
  padding: 0 16px;
  border: 1.5px solid #dfe3ea;
  border-radius: 14px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
}

.pw-gen:active {
  background: #f1f4f9;
}

.pw-gen:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
