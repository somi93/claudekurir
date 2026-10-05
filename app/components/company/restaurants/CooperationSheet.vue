<template>
  <AppSheet
    ref="sheet"
    :open="open"
    :title="activate ? 'Uključi saradnju' : 'Suspenduj saradnju'"
    :subtitle="name"
    :dirty="!activate && Boolean(draft.reason.trim())"
    :focus="activate ? undefined : 'reason'"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <template v-if="activate">
      <p class="cs-p">
        Ponovo uključiti saradnju sa restoranom <b>{{ name }}</b>? Njegove narudžbe opet stižu kuririma.
      </p>
      <TintAlert v-if="restaurant.suspension_reason" tone="info" title="Razlog suspenzije">
        {{ toLatin(restaurant.suspension_reason) }}
      </TintAlert>
      <TintAlert v-if="mismatch" tone="warn" title="Valuta se razlikuje">
        Restoran koristi {{ mismatch }}, a firma {{ resolveCurrency(companyCurrency) }}. Cijene se ne preračunavaju.
      </TintAlert>
    </template>
    <template v-else>
      <TintAlert tone="info">
        Narudžbe restorana <b>{{ name }}</b> neće biti vidljive kuririma dok saradnju ponovo ne uključiš.
      </TintAlert>
      <div class="cs-qr" role="group" aria-label="Brz izbor razloga">
        <button
          v-for="r in REASONS"
          :key="r"
          type="button"
          class="cs-chip"
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
        placeholder="Vidi ga svako ko otvori ovog restorana."
        :message="serverMessage"
        @update:model-value="edited"
      />
    </template>

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da sačuvam">{{ error }}</TintAlert>

    <template #footer>
      <AppButton submit :variant="activate ? 'primary' : 'danger'" :loading="saving">
        {{ saving ? "Čuvam…" : activate ? "Uključi saradnju" : "Suspenduj saradnju" }}
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
import { resolveCurrency } from "~/utils/currency";
import { currencyMismatch } from "~/utils/restaurantCooperation";
import { toLatin } from "~/utils/toLatin";
import type { FieldMsg } from "~/utils/profileForm";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// List "Suspenduj saradnju" / "Uključi saradnju". Suspenzija traži (opcioni) razlog sa brzim izborom i
// kaže šta se dešava sa narudžbama; uključivanje samo potvrđuje (i upozori ako se valute razlikuju).
// Razlog se šalje samo pri suspenziji (backend ga sam briše pri uključivanju). Greška (403, 404,
// mreža) ostaje u listu uz dugme, a uneseni razlog se ne gubi.
const props = defineProps<{
  open: boolean;
  restaurant: RestaurantCooperation;
  activate: boolean;
  companyCurrency: string;
  save: (active: boolean, reason?: string) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const REASONS = ["Dug za proviziju", "Restoran zatvoren", "Na zahtjev restorana", "Kasne isplate"];

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ reason: "" })
);

const name = computed(
  () => toLatin(props.restaurant.restaurant_name) || `Restoran #${props.restaurant.restaurant_id}`
);
const mismatch = computed(() => currencyMismatch(props.restaurant, props.companyCurrency));

const serverMessage = computed<FieldMsg | null>(() =>
  serverFields.value.suspension_reason ? { tone: "bad", text: serverFields.value.suspension_reason } : null
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
  run: () => (props.activate ? props.save(true) : props.save(false, draft.reason.trim() || undefined)),
  success: () => (props.activate ? "Saradnja je uključena." : "Saradnja je suspendovana."),
});
</script>

<style scoped>
.cs-p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: #495260;
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

.cs-chip[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.cs-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
