<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Napomena"
    subtitle="Vidi je samo dispečer."
    :dirty="check.dirty"
    focus="note"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <SheetTextarea
      v-model="draft.note"
      name="note"
      label="Napomena"
      optional
      placeholder="npr. radi vikendom, ima dječija sjedišta…"
      :message="serverMessage"
      @update:model-value="edited"
    />

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da sačuvam">{{ error }}</TintAlert>

    <template #footer>
      <AppButton submit :disabled="!check.dirty" :loading="saving">
        {{ saving ? "Čuvam…" : "Sačuvaj" }}
      </AppButton>
      <p>{{ saving || check.dirty ? "" : "Nema izmjena." }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import SheetTextarea from "~/components/common/SheetTextarea.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import { checkNote, type RosterCourier } from "~/utils/courierRoster";
import type { FieldMsg } from "~/utils/profileForm";
import type { CourierUpdatePayload } from "~/types/company-courier";

// List "Napomena": slobodan tekst koji vidi samo dispečer. Prazno briše napomenu (šalje null).
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  save: (payload: CourierUpdatePayload) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ note: props.courier.note })
);

const check = computed(() => checkNote(draft, props.courier));

const serverMessage = computed<FieldMsg | null>(() =>
  serverFields.value.note ? { tone: "bad", text: serverFields.value.note } : null
);

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => check.value.dirty,
  run: () => props.save(check.value.payload),
});
</script>
