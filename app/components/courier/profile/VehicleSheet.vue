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
    <div class="vs-group" role="radiogroup" aria-label="Tip vozila" @keydown="onKey">
      <button
        v-for="choice in VEHICLE_ORDER"
        :key="choice"
        type="button"
        role="radio"
        class="vs-opt"
        :class="{ 'vs-opt--wide': choice === 'foot' }"
        :aria-checked="selected === choice"
        :tabindex="selected === choice ? 0 : -1"
        :data-choice="choice"
        :style="{ '--ink': VEHICLE_CHOICES[choice].ink, '--tint': VEHICLE_CHOICES[choice].tint }"
        @click="pick(choice)"
      >
        <span class="vi"><v-icon :icon="VEHICLE_CHOICES[choice].icon" size="22" /></span>
        <span>
          <b>{{ VEHICLE_CHOICES[choice].label }}</b>
          <small v-if="choice === 'foot'">Bez vozila</small>
        </span>
        <span class="ck"><v-icon icon="mdi-check" size="15" /></span>
      </button>
    </div>

    <SheetField
      v-if="draft.vehicle"
      v-model="draft.vehicleNote"
      name="vehicleNote"
      label="Model i registracija"
      optional
      enterkeyhint="done"
      placeholder="npr. Honda PCX · BL 123-A-456"
      :message="serverMessage"
      @update:model-value="edited"
    />

    <TintAlert tone="info">
      Dispečer vidi tvoje vozilo kad bira ko dobija narudžbu, a ruta i procjena vremena računaju
      se prema njemu.
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
  VEHICLE_CHOICES,
  VEHICLE_ORDER,
  checkVehicle,
  choiceOf,
  vehicleOf,
  type FieldMsg,
  type ProfileValues,
  type VehicleChoice,
} from "~/utils/profileForm";

// List "Vozilo": pet izbora kao grupa dugmadi sa izborom (role=radiogroup, strelice mijenjaju
// izbor). "Pješice" je izbor kao ostali, jer je vehicle: null pravo stanje, a ne greška; šalje
// se kao vehicle_type: null. Vozilo ide serveru samo kad je izmijenjeno (tip ili napomena).
const props = defineProps<{
  open: boolean;
  saved: ProfileValues;
  save: (payload: CourierProfileUpdate) => Promise<SaveResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const alerts = useAlertStore();
const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, saving, error, serverFields, edited } = useSheetDraft(toRef(props, "open"), () => ({
  vehicle: props.saved.vehicle,
  vehicleNote: props.saved.vehicleNote,
}));

const selected = computed<VehicleChoice>(() => choiceOf(draft.vehicle));
const check = computed(() => checkVehicle(draft, props.saved));

const serverMessage = computed<FieldMsg | null>(() => {
  const text = serverFields.value.vehicle_note ?? serverFields.value.vehicle_type;
  return text ? { tone: "bad", text } : null;
});

const pick = (choice: VehicleChoice) => {
  draft.vehicle = vehicleOf(choice);
  edited();
};

// Strelice, Home i End kao kod pravog radiogroup-a: fokus ide za izborom.
const onKey = async (event: KeyboardEvent) => {
  const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const index = VEHICLE_ORDER.indexOf(selected.value);
  const last = VEHICLE_ORDER.length - 1;
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : (index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + last + 1) %
          (last + 1);
  const choice = VEHICLE_ORDER[next];
  if (!choice) return;
  pick(choice);
  await nextTick();
  (event.currentTarget as HTMLElement | null)
    ?.querySelector<HTMLElement>(`[data-choice="${choice}"]`)
    ?.focus();
};

const submit = async () => {
  if (saving.value || !check.value.dirty) return;
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
.vs-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.vs-opt {
  position: relative;
  display: grid;
  justify-items: start;
  align-content: space-between;
  gap: 8px;
  min-height: 84px;
  padding: 12px;
  border: 1.5px solid #dfe3ea;
  border-radius: 16px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

.vs-opt:active {
  background: #f1f4f9;
}

.vs-opt:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.vs-opt .vi {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--tint);
  color: var(--ink);
}

.vs-opt b {
  font-size: 0.94rem;
  font-weight: 800;
}

.vs-opt small {
  display: block;
  margin-top: 1px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #5b6676;
}

.vs-opt .ck {
  position: absolute;
  top: 10px;
  right: 10px;
  display: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #2f6fed;
  color: #fff;
}

.vs-opt[aria-checked="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  box-shadow: inset 0 0 0 1px #2f6fed;
}

.vs-opt[aria-checked="true"] .ck {
  display: grid;
}

.vs-opt--wide {
  grid-column: 1 / -1;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  min-height: 64px;
}

@media (prefers-reduced-motion: reduce) {
  .vs-opt {
    transition: none;
  }
}
</style>
