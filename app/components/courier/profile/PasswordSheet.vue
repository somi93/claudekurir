<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Promjena lozinke"
    :subtitle="`Najmanje ${MIN_PASSWORD} znakova.`"
    :dirty="check.dirty"
    :focus="focus"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetField
      v-model="draft.cur"
      name="cur"
      label="Trenutna lozinka"
      :type="reveal.cur ? 'text' : 'password'"
      autocomplete="current-password"
      autocapitalize="off"
      :message="check.fields.cur ?? null"
      @update:model-value="edited"
      @blur="touch('cur')"
    >
      <template #tail>
        <button
          type="button"
          class="pw-tog"
          :aria-label="`${reveal.cur ? 'Sakrij' : 'Prikaži'} lozinku (trenutna lozinka)`"
          :aria-pressed="reveal.cur"
          @click="reveal.cur = !reveal.cur"
        >
          <v-icon :icon="reveal.cur ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="22" />
        </button>
      </template>
    </SheetField>
    <SheetField
      v-model="draft.nw"
      name="nw"
      label="Nova lozinka"
      :type="reveal.nw ? 'text' : 'password'"
      autocomplete="new-password"
      autocapitalize="off"
      :message="nwMessage"
      @update:model-value="edited"
      @blur="touch('nw')"
    >
      <template #tail>
        <button
          type="button"
          class="pw-tog"
          :aria-label="`${reveal.nw ? 'Sakrij' : 'Prikaži'} lozinku (nova lozinka)`"
          :aria-pressed="reveal.nw"
          @click="reveal.nw = !reveal.nw"
        >
          <v-icon :icon="reveal.nw ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="22" />
        </button>
      </template>
    </SheetField>
    <SheetField
      v-model="draft.conf"
      name="conf"
      label="Ponovi novu lozinku"
      :type="reveal.conf ? 'text' : 'password'"
      autocomplete="new-password"
      autocapitalize="off"
      enterkeyhint="done"
      :message="check.fields.conf ?? null"
      @update:model-value="edited"
      @blur="touch('conf')"
    >
      <template #tail>
        <button
          type="button"
          class="pw-tog"
          :aria-label="`${reveal.conf ? 'Sakrij' : 'Prikaži'} lozinku (ponovljena nova lozinka)`"
          :aria-pressed="reveal.conf"
          @click="reveal.conf = !reveal.conf"
        >
          <v-icon :icon="reveal.conf ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" size="22" />
        </button>
      </template>
    </SheetField>

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da promijenim lozinku">
      {{ error }}
    </TintAlert>

    <template #footer>
      <AppButton submit :disabled="!check.valid" :loading="saving">
        {{ saving ? "Čuvam…" : "Sačuvaj novu lozinku" }}
      </AppButton>
      <p>{{ !saving && check.dirty && !check.valid ? "Popuni sva tri polja." : "" }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, toRef, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import * as authService from "~/services/authService";
import { useAlertStore } from "~/stores/alert";
import { useSessionStore } from "~/stores/session";
import { getValidationMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { MIN_PASSWORD, checkPassword, type FieldMsg } from "~/utils/profileForm";

// List "Promjena lozinke": trenutna, nova i ponovljena nova, svaka sa prikazom/skrivanjem.
// Kurir je do sad mogao da dođe do ove forme samo kroz /change-password, koju mu je
// middleware zatvarao (traka "Promeni sada" ga je vraćala na Dostave). Pogrešna trenutna
// lozinka (422) se prikazuje uz to polje. Uspjeh gasi traku "privremena lozinka".
const props = defineProps<{ open: boolean; focus?: string | null }>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const alerts = useAlertStore();
const session = useSessionStore();
const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, show, touch, submitted, saving, error, serverFields, reset, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ cur: "", nw: "", conf: "" })
);

const reveal = reactive({ cur: false, nw: false, conf: false });
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) Object.assign(reveal, { cur: false, nw: false, conf: false });
  }
);

const check = computed(() =>
  checkPassword(draft, serverFields.value.current_password ?? "", show)
);

// Provjera nove lozinke na serveru (npr. pravila za jačinu) ima prednost nad našim savjetom.
const nwMessage = computed<FieldMsg | null>(() => {
  const fromServer = serverFields.value.new_password;
  return fromServer ? { tone: "bad", text: fromServer } : (check.value.fields.nw ?? null);
});

const submit = async () => {
  if (saving.value) return;
  if (!check.value.valid) {
    submitted.value = true;
    await nextTick();
    const bad = (["cur", "nw", "conf"] as const).find(
      (key) => check.value.fields[key]?.tone === "bad"
    );
    if (bad) sheet.value?.focusField(bad);
    return;
  }
  saving.value = true;
  error.value = "";
  try {
    await authService.changePassword({
      current_password: draft.cur,
      new_password: draft.nw,
      new_password_confirmation: draft.conf,
    });
  } catch (cause) {
    saving.value = false;
    if (getValidationMessage(cause, "current_password")) {
      serverFields.value = { current_password: "Trenutna lozinka nije ispravna." };
      await nextTick();
      sheet.value?.focusField("cur");
      return;
    }
    const newPassword = getValidationMessage(cause, "new_password");
    if (newPassword) {
      serverFields.value = { new_password: newPassword };
      await nextTick();
      sheet.value?.focusField("nw");
      return;
    }
    error.value = toFriendlyErrorMessage(
      cause,
      "Server nije prihvatio novu lozinku. Pokušaj ponovo; ono što si upisao je ostalo u listu."
    );
    return;
  }
  // Uspjeh sam gasi must_change_password na backendu (16.08); ovdje se prati ista promjena da
  // traka nestane odmah, bez čekanja na sljedeći /me.
  if (session.user) session.user.must_change_password = false;
  alerts.success("Lozinka je promijenjena.", 4000);
  reset();
  sheet.value?.closeNow();
};
</script>

<style scoped>
.pw-tog {
  flex: none;
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

.pw-tog:active {
  background: #eceff3;
}

.pw-tog:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}
</style>
