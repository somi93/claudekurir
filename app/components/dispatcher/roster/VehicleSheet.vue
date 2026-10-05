<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Vozilo"
    subtitle="Po njemu dispečer bira ko dobija narudžbu."
    :dirty="check.dirty"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <ChoiceGroup
      :model-value="choiceOf(draft.vehicle)"
      :options="options"
      label="Tip vozila"
      @update:model-value="pick(String($event) as VehicleChoice)"
    />

    <TintAlert tone="info">
      Kurir bez vozila ne dobija predlog za narudžbu. „Pješice“ je pravo stanje i šalje se kao
      prazno vozilo.
    </TintAlert>

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
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import { checkVehicle, type RosterCourier } from "~/utils/courierRoster";
import {
  VEHICLE_CHOICES,
  VEHICLE_ORDER,
  choiceOf,
  vehicleOf,
  type VehicleChoice,
} from "~/utils/profileForm";
import type { CourierUpdatePayload } from "~/types/company-courier";

// List "Vozilo": pet izbora (strelice mijenjaju izbor). "Pješice" je izbor kao ostali, jer je
// vehicle: null pravo stanje, a ne greška; šalje se kao vehicle_type: null.
const props = defineProps<{
  open: boolean;
  courier: RosterCourier;
  save: (payload: CourierUpdatePayload) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, saving, submitted, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => ({ vehicle: props.courier.vehicle })
);

const options: ChoiceOption[] = VEHICLE_ORDER.map((key) => ({
  value: key,
  label: VEHICLE_CHOICES[key].label,
  hint: key === "foot" ? "Bez vozila" : undefined,
  icon: VEHICLE_CHOICES[key].icon,
  ink: VEHICLE_CHOICES[key].ink,
  tint: VEHICLE_CHOICES[key].tint,
  wide: key === "foot",
}));

const check = computed(() => checkVehicle(draft, props.courier));

const pick = (choice: VehicleChoice) => {
  draft.vehicle = vehicleOf(choice);
  edited();
};

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
