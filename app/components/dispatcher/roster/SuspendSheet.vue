<template>
  <AppSheet
    ref="sheet"
    :open="open"
    :title="activate ? 'Aktiviraj kurira' : 'Suspenduj kurira'"
    :subtitle="`${courier.name} · #${courier.id}`"
    :dirty="!activate && Boolean(draft.reason.trim())"
    :focus="activate ? undefined : 'reason'"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <template v-if="activate">
      <p class="sp-p">Ponovo aktivirati {{ courier.name }}? Opet će moći da prima nove narudžbe.</p>
      <TintAlert v-if="courier.reason" tone="info" title="Razlog suspenzije">{{ courier.reason }}</TintAlert>
    </template>
    <template v-else>
      <TintAlert v-if="delivering" tone="warn" icon="mdi-moped-outline" title="Trenutno je u dostavi">
        Provjeri da li treba prvo da je završi.
      </TintAlert>
      <TintAlert
        v-if="courier.cash != null && courier.cash > 0"
        tone="info"
        icon="mdi-cash-multiple"
        :title="`Duguje ${formatAmount(courier.cash, currency)}`"
      >
        Predaju gotovine evidentiraš posebno, suspenzija ne mijenja dug.
      </TintAlert>
      <p class="sp-p">{{ courier.name }} neće moći da prima nove narudžbe dok ga ponovo ne aktiviraš.</p>
      <div class="sp-qr" role="group" aria-label="Brz izbor razloga">
        <button
          v-for="r in REASONS"
          :key="r"
          type="button"
          class="sp-chip"
          :aria-pressed="draft.reason === r"
          @click="pickReason(r)"
        >
          {{ r }}
        </button>
      </div>
      <SheetTextarea
        v-model="draft.reason"
        name="reason"
        label="Razlog"
        optional
        placeholder="Vidi ga svako ko otvori ovog kurira."
        :message="serverMessage"
        @update:model-value="edited"
      />
    </template>

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da sačuvam">{{ error }}</TintAlert>

    <template #footer>
      <AppButton submit :loading="saving">
        {{ saving ? "Čuvam…" : activate ? "Aktiviraj" : "Suspenduj" }}
      </AppButton>
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
import { liveOf, type RosterCourier } from "~/utils/courierRoster";
import { formatAmount } from "~/utils/currency";
import type { FieldMsg } from "~/utils/profileForm";

// List "Suspenduj" / "Aktiviraj": suspenzija traži (opcioni) razlog sa brzim izborom i upozorava
// ako je kurir u dostavi ili duguje gotovinu; aktivacija samo potvrđuje. Razlog se šalje samo pri
// suspenziji (backend ga sam briše pri aktivaciji).
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  activate: boolean;
  now: number;
  currency: string;
  save: (suspended: boolean, reason?: string) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const REASONS = ["Dug gotovine", "Nije se javio", "Kvar vozila", "Na zahtjev kurira"];

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ reason: "" })
);

const delivering = computed(() => liveOf(props.courier, props.now) === "delivering");

const serverMessage = computed<FieldMsg | null>(() =>
  serverFields.value.reason ? { tone: "bad", text: serverFields.value.reason } : null
);

// Izabran razlog se ponovnim dodirom poništava; tekst se i dalje može ručno mijenjati.
const pickReason = (reason: string) => {
  draft.reason = draft.reason === reason ? "" : reason;
  edited();
};

const submit = useSheetSave({
  sheet,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => true,
  run: () => (props.activate ? props.save(false) : props.save(true, draft.reason.trim() || undefined)),
  success: () => (props.activate ? "Kurir je aktiviran." : "Kurir je suspendovan."),
});
</script>

<style scoped>
.sp-p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #495260;
}

.sp-qr {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sp-chip {
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

.sp-chip[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.sp-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
