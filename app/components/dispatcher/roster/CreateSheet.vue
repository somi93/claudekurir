<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Novi kurir"
    subtitle="Podatke za prijavu kuriru prosljeđuješ ti."
    :dirty="dirty"
    focus="first"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <div class="ns-two">
      <SheetField
        v-model="draft.first"
        name="first"
        label="Ime"
        autocapitalize="words"
        :message="message('first', 'name')"
        @update:model-value="edited"
        @blur="touch('first')"
      />
      <SheetField
        v-model="draft.last"
        name="last"
        label="Prezime"
        autocapitalize="words"
        :message="message('last', 'lastname')"
        @update:model-value="edited"
        @blur="touch('last')"
      />
    </div>
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
    <SheetField
      v-model="draft.email"
      name="email"
      label="Korisničko ime (email)"
      type="email"
      inputmode="email"
      autocapitalize="off"
      placeholder="ime.prezime@ordera.app"
      :message="message('email', 'email')"
      @update:model-value="edited"
      @blur="touch('email')"
    />

    <h3 class="ns-h">Vozilo</h3>
    <ChoiceGroup
      :model-value="choiceOf(draft.vehicle)"
      :options="vehicleOptions"
      label="Tip vozila"
      @update:model-value="pickVehicle(String($event) as VehicleChoice)"
    />

    <div class="ns-pw">
      <SheetField
        v-model="draft.password"
        name="password"
        label="Lozinka za prvu prijavu"
        autocapitalize="off"
        :message="message('password', 'temporary_password')"
        @update:model-value="edited"
        @blur="touch('password')"
      />
      <button type="button" class="ns-gen" data-sheet="generate" aria-label="Generiši novu lozinku" @click="generate">
        <v-icon icon="mdi-refresh" size="18" />Nova
      </button>
    </div>

    <div class="ns-acc">
      <button
        type="button"
        class="ns-acc-h"
        data-sheet="more"
        :aria-expanded="more"
        aria-controls="ns-more"
        @click="more = !more"
      >
        <span>Dodatno<small>Ugovor i isplata, lični podaci, napomena</small></span>
        <v-icon :icon="more ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="22" />
      </button>
      <div v-show="more" id="ns-more" class="ns-acc-b">
        <ChoiceGroup
          :model-value="draft.payType"
          :options="payOptions"
          label="Način isplate"
          :columns="3"
          @update:model-value="pickType(Number($event) as CourierPayingType)"
        />
        <SheetField
          v-model="draft.paying"
          name="paying"
          label="Iznos"
          optional
          inputmode="decimal"
          :format="maskAmount"
          :message="message('paying', 'paying')"
          @update:model-value="edited"
        >
          <template #tail><span class="ns-suf">{{ paySuffix(draft.payType, currency) }}</span></template>
        </SheetField>
        <SheetField
          v-model="draft.dob"
          name="dob"
          label="Datum rođenja"
          optional
          inputmode="numeric"
          placeholder="dd.mm.gggg"
          :format="formatDobDigits"
          :significant="isDigit"
          :message="message('dob', 'date_of_birth')"
          @update:model-value="edited"
          @blur="touch('dob')"
        />
        <SheetField
          v-model="draft.ecName"
          name="ecName"
          label="Hitni kontakt, ime"
          optional
          autocapitalize="words"
          @update:model-value="edited"
        />
        <SheetField
          v-model="draft.ecPhone"
          name="ecPhone"
          label="Hitni kontakt, telefon"
          optional
          type="tel"
          inputmode="tel"
          :message="message('ecPhone', 'emergency_contact_phone')"
          @update:model-value="edited"
          @blur="touch('ecPhone')"
        />
        <SheetTextarea v-model="draft.note" name="note" label="Napomena" optional @update:model-value="edited" />
      </div>
    </div>

    <TintAlert v-if="error" tone="bad" role="alert" title="Ne mogu da napravim kurira">{{ error }}</TintAlert>

    <template #footer>
      <AppButton submit :disabled="!check.valid" :loading="saving">
        {{ saving ? "Čuvam…" : "Kreiraj kurira" }}
      </AppButton>
      <p>{{ saving ? "" : check.hint }}</p>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import SheetField from "~/components/common/SheetField.vue";
import SheetTextarea from "~/components/common/SheetTextarea.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import {
  PAY_TYPES,
  checkCreate,
  emptyCreate,
  maskAmount,
  paySuffix,
  type CreateDraft,
  type RosterCourier,
} from "~/utils/courierRoster";
import {
  VEHICLE_CHOICES,
  VEHICLE_ORDER,
  choiceOf,
  formatDobDigits,
  vehicleOf,
  type FieldMsg,
  type VehicleChoice,
} from "~/utils/profileForm";
import { generateTemporaryPassword } from "~/utils/randomPassword";
import type { CourierCreatePayload, CourierPayingType } from "~/types/company-courier";

// List "Novi kurir": kratka forma (ime, prezime, telefon, email, vozilo, lozinka), a ugovor, lični
// podaci i napomena su sklopljeni pod "Dodatno". Šalju se samo popunjena polja. Poslije snimanja
// otvara se kartica sa podacima za prijavu, jer sistem ne šalje ni email ni SMS.
const props = defineProps<{
  open: boolean;
  roster: RosterCourier[];
  currency: string;
  create: (payload: CourierCreatePayload) => Promise<ActionResult>;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [result: { id: number; password: string }];
}>();

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const { draft, show, touch, submitted, saving, error, serverFields, edited } = useSheetDraft(
  toRef(props, "open"),
  () => emptyCreate()
);

const more = ref(false);
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) more.value = false;
  }
);

const vehicleOptions: ChoiceOption[] = VEHICLE_ORDER.map((key) => ({
  value: key,
  label: VEHICLE_CHOICES[key].label,
  hint: key === "foot" ? "Bez vozila" : undefined,
  icon: VEHICLE_CHOICES[key].icon,
  ink: VEHICLE_CHOICES[key].ink,
  tint: VEHICLE_CHOICES[key].tint,
  wide: key === "foot",
}));

const payOptions: ChoiceOption[] = (Object.keys(PAY_TYPES) as unknown as CourierPayingType[]).map((k) => ({
  value: k,
  label: PAY_TYPES[k].label,
  hint: PAY_TYPES[k].hint,
  icon: PAY_TYPES[k].icon,
  ink: "#2459c7",
  tint: "#eef4ff",
}));

const isDigit = (ch: string) => ch >= "0" && ch <= "9";

const now = new Date();
const check = computed(() => checkCreate(draft as CreateDraft, props.roster, now, show));

// Sve što je dispečer unio osim predložene lozinke: tek tada list pita prije odbacivanja.
const dirty = computed(() => {
  const d = draft as CreateDraft;
  return Boolean(
    d.first.trim() || d.last.trim() || d.phone.trim() || d.email.trim() || d.vehicle || d.payType ||
      d.paying.trim() || d.dob.trim() || d.ecName.trim() || d.ecPhone.trim() || d.note.trim()
  );
});

const message = (key: string, apiKey: string): FieldMsg | null => {
  const fromServer = serverFields.value[apiKey];
  if (fromServer) return { tone: "bad", text: fromServer };
  return (check.value.fields as Record<string, FieldMsg | undefined>)[key] ?? null;
};

const pickVehicle = (choice: VehicleChoice) => {
  draft.vehicle = vehicleOf(choice);
  edited();
};

const pickType = (type: CourierPayingType) => {
  draft.payType = type;
  edited();
};

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
  firstBad: () => {
    const order = ["first", "last", "phone", "email", "password", "dob", "paying", "ecPhone"] as const;
    const f = check.value.fields as Record<string, FieldMsg | undefined>;
    const bad = order.find((k) => f[k]?.tone === "bad");
    if (bad && ["dob", "paying", "ecPhone"].includes(bad)) more.value = true;
    return bad ?? null;
  },
  run: () => props.create(check.value.payload),
  success: null,
  onDone: (result) => {
    if (result.id != null) emit("created", { id: result.id, password: draft.password });
  },
});
</script>

<style scoped>
.ns-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 480px) {
  .ns-two {
    grid-template-columns: 1fr;
  }
}

.ns-h {
  margin: 4px 0 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.ns-pw {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
}

.ns-gen {
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

.ns-gen:active {
  background: #f1f4f9;
}

.ns-acc {
  overflow: hidden;
  border: 1.5px solid #dfe3ea;
  border-radius: 16px;
}

.ns-acc-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px 14px;
  border: 0;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}

.ns-acc-h small {
  display: block;
  font-size: 0.76rem;
  font-weight: 600;
  color: #5b6676;
}

.ns-acc-b {
  display: grid;
  gap: 14px;
  padding: 6px 14px 14px;
  border-top: 1px solid #eceef2;
}

.ns-suf {
  padding-right: 10px;
  font-size: 0.9rem;
  font-weight: 800;
  color: #657083;
}

.ns-gen:focus-visible,
.ns-acc-h:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}
</style>
