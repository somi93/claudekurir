<template>
  <GlobalCard padding="20px">
    <template #title>Finansijske postavke</template>
    <template #subtitle>
      Provizija, limit gotovine i period isplate za izabranu firmu.
    </template>

    <template v-if="settings">
      <v-form ref="formRef">
        <div class="limit-toggle-row mt-4">
          <div>
            <p class="switch-label">Ograniči gotovinu</p>
            <p class="switch-hint">
              Uključi da postaviš maksimalan iznos gotovine koji kurir sme da drži prije
              nego što mora da preda pazar.
            </p>
          </div>
          <v-switch
            v-model="limitEnabled"
            color="accent"
            hide-details
            density="compact"
          />
        </div>

        <v-row class="mt-4">
          <v-col cols="12" sm="6">
            <GlobalTextField
              :model-value="settings.commission_percentage"
              label="Provizija (%)"
              readonly
              append-inner-icon="mdi-lock-outline"
              hint="Postavlja Ordera admin"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" sm="6">
            <GlobalSelect
              v-model="currencyValue"
              :items="currencyOptions"
              label="Valuta firme"
              hint="Prikazuje se uz sve iznose u Cenovniku i finansijama."
              persistent-hint
            />
          </v-col>
          <v-col cols="12" sm="6">
            <GlobalTextField
              v-model.number="settings.cash_limit_amount"
              :label="`Limit gotovine (${currencyLabel})`"
              type="number"
              step="1"
              min="0"
              :disabled="!limitEnabled"
              :rules="[cashLimitRule]"
              :hint="
                limitEnabled
                  ? 'Kurir ne sme da drži više od ovog iznosa. Upiši 0 ako ne sme da drži nikakvu gotovinu.'
                  : 'Uključi prekidač iznad da podesiš limit.'
              "
              persistent-hint
            />
          </v-col>
          <v-col cols="12" sm="6">
            <GlobalSelect
              v-model="settings.cash_limit_enforcement"
              :items="enforcementOptions"
              label="Ponašanje pri prekoračenju limita"
              :messages="[
                'Blokiraj - kurir ne može prihvatiti novu narudžbu dok ne preda pazar.',
                'Samo upozori - kurir prihvata narudžbu, dobija samo upozorenje.',
              ]"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <GlobalTextField
              v-model.number="settings.payout_period_days"
              label="Period isplate (dana)"
              type="number"
              step="1"
              hint="1 = dnevno, 7 = nedeljno, 15 = svake 2 nedelje, ili dogovoren broj"
              persistent-hint
            />
          </v-col>
          <v-col cols="12" sm="6">
            <GlobalTimePicker
              v-model="handoverTime"
              label="Vreme dnevne predaje"
              clearable
              hint="Opciono - može ostati prazno"
              persistent-hint
            />
          </v-col>
        </v-row>

        <div class="assignment-section mt-4">
          <p class="section-label">Dodela narudžbi kuririma</p>
          <p class="section-hint">
            Ova podešavanja utiču na automatsku dodelu narudžbi kuririma.
          </p>

          <v-row class="mt-1">
            <v-col cols="12">
              <GlobalSelect
                v-model="assignmentMode"
                :items="assignmentModeOptions"
                label="Način dodele narudžbi kuririma"
                :messages="[assignmentModeHint]"
              />
            </v-col>

            <v-col v-if="assignmentMode === 'TOP_N'" cols="12" sm="6">
              <GlobalTextField
                v-model.number="settings.assignment_courier_count"
                label="Broj kurira koji dobijaju ponudu"
                type="number"
                step="1"
                min="1"
                max="50"
                :rules="[courierCountRule]"
                hint="Prvih N najbližih kurira dobija ponudu istovremeno (1-50)."
                persistent-hint
              />
            </v-col>

            <template v-if="assignmentNeedsTimeout">
              <v-col cols="12" sm="6">
                <GlobalTextField
                  v-model.number="offerTimeoutSeconds"
                  label="Vrijeme čekanja odgovora (sek)"
                  type="number"
                  step="1"
                  min="5"
                  max="120"
                  :rules="[offerTimeoutRule]"
                  hint="Koliko se čeka odgovor kurira prije sljedećeg koraka (5-120 s)."
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" sm="6">
                <GlobalSelect
                  v-model="assignmentTimeoutAction"
                  :items="assignmentTimeoutActionOptions"
                  label="Ako niko ne odgovori na vrijeme"
                  :messages="[
                    'Šalje sljedećem najbližem kuriru.',
                    'Otvara narudžbu svim kuririma.',
                  ]"
                />
              </v-col>
            </template>

            <v-col cols="12" sm="6">
              <GlobalSelect
                v-model="assignmentCourierPool"
                :items="assignmentCourierPoolOptions"
                label="Koje kurire uzeti u obzir pri dodeli"
                :messages="[assignmentCourierPoolHint]"
              />
            </v-col>
          </v-row>
        </div>

        <div class="limit-toggle-row mt-4">
          <div>
            <p class="switch-label">Prikaži kupcu detaljan raspis cene dostave</p>
            <p class="switch-hint">
              Ako je uključeno, kupac će pre potvrde narudžbe videti iz čega se sastoji
              cena dostave (osnovna cena, cena po kilometru, naplate za gužvu/noć/kišu).
              Ako je isključeno, kupac vidi samo ukupan iznos.
            </p>
          </div>
          <v-switch
            v-model="showPriceBreakdown"
            color="accent"
            hide-details
            density="compact"
          />
        </div>

        <div class="d-flex align-center ga-3 mt-6">
          <GlobalButtonPrimary :loading="saving" @click="onSave">
            Sačuvaj postavke
          </GlobalButtonPrimary>
        </div>
      </v-form>
    </template>
    <GlobalEmptyState v-else-if="loading" icon="mdi-timer-sand"
      >Učitavanje...</GlobalEmptyState
    >
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import GlobalTimePicker from "~/components/common/GlobalTimePicker.vue";
import { DEFAULT_CURRENCY, resolveCurrency } from "~/utils/currency";
import type {
  AssignmentCourierPool,
  AssignmentMode,
  AssignmentTimeoutAction,
  FinanceSettings,
} from "~/types/finance-settings";
import type { VForm } from "vuetify/components";

defineProps<{
  loading: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  save: [];
}>();

const settings = defineModel<FinanceSettings | null>("settings", { required: true });

const enforcementOptions = [
  { title: "Blokiraj (BLOCK)", value: "BLOCK" },
  { title: "Samo upozori (NOTIFY_ONLY)", value: "NOTIFY_ONLY" },
];

// "BEST_MATCH" je stara vrijednost - nudi se kao izbor SAMO ako je firma već ima
// (da je PATCH ne izgubi), inače su tu samo tri nova načina. Vidi
// types/finance-settings.ts i Uputstvo 02.09.2026.
const assignmentModeOptions = computed(() => {
  const base = [
    { title: "Svi kuriri vide narudžbu istovremeno", value: "ALL" },
    { title: "Samo najbliži kurir dobija prvu ponudu", value: "NEAREST" },
    {
      title: "Prvih N najbližih kurira dobija ponudu istovremeno",
      value: "TOP_N",
    },
  ];
  if (settings.value?.assignment_mode === "BEST_MATCH") {
    base.push({ title: "Najbolji kurir (stara postavka)", value: "BEST_MATCH" });
  }
  return base;
});

const assignmentModeHints: Record<AssignmentMode, string> = {
  ALL: "Svi kuriri vide narudžbu istovremeno - prvi koji prihvati je dobija.",
  NEAREST: "Ponuda ide najbližem kuriru; ako ne odgovori, primjenjuje se pravilo ispod.",
  TOP_N: "Ponudu istovremeno dobija N najbližih kurira - prvi koji prihvati je dobija.",
  BEST_MATCH: "Stara postavka - zadržana dok je ne promijenite na neki od novih načina.",
};

// Backend default je "ALL"; polje može izostati na starijim odgovorima.
const assignmentMode = computed<AssignmentMode>({
  get: () => settings.value?.assignment_mode ?? "ALL",
  set: (value) => {
    if (settings.value) settings.value.assignment_mode = value;
  },
});
const assignmentModeHint = computed(() => assignmentModeHints[assignmentMode.value]);

// offer_timeout_seconds + assignment_timeout_action imaju smisla samo kad postoji
// "čekanje odgovora" - tj. za NEAREST i TOP_N (za ALL se skrivaju).
const assignmentNeedsTimeout = computed(
  () => assignmentMode.value === "NEAREST" || assignmentMode.value === "TOP_N"
);

const assignmentTimeoutActionOptions = [
  { title: "Šalje sljedećem najbližem kuriru", value: "NEXT_NEAREST" },
  { title: "Otvara svim kuririma", value: "OPEN_TO_ALL" },
];
const assignmentTimeoutAction = computed<AssignmentTimeoutAction>({
  get: () => settings.value?.assignment_timeout_action ?? "NEXT_NEAREST",
  set: (value) => {
    if (settings.value) settings.value.assignment_timeout_action = value;
  },
});

const assignmentCourierPoolOptions = [
  { title: "Sve aktivne kurire firme (bez provjere dostupnosti)", value: "ALL_ACTIVE" },
  { title: 'Samo kurire koji su označili "dostupan za rad"', value: "AVAILABLE_NOW" },
  {
    title: "Samo kurire sa prijavljenom smjenom za ovo vrijeme",
    value: "SCHEDULED_SHIFT",
  },
];
const assignmentCourierPoolHints: Record<AssignmentCourierPool, string> = {
  ALL_ACTIVE: "Uzimaju se sve aktivne kurire firme, bez provjere dostupnosti.",
  AVAILABLE_NOW: 'Samo kurire koji su se trenutno označili kao "dostupan za rad".',
  SCHEDULED_SHIFT:
    "Samo kurire sa prijavljenom smjenom za ovo vrijeme (plan angažovanja).",
};
const assignmentCourierPool = computed<AssignmentCourierPool>({
  get: () => settings.value?.assignment_courier_pool ?? "ALL_ACTIVE",
  set: (value) => {
    if (settings.value) settings.value.assignment_courier_pool = value;
  },
});
const assignmentCourierPoolHint = computed(
  () => assignmentCourierPoolHints[assignmentCourierPool.value]
);

// v-model.number vraća NaN za prazno polje - mapiramo na null (i za 0, koje je
// ionako van dozvoljenog 5-120 opsega).
const offerTimeoutSeconds = computed<number | null>({
  get: () => settings.value?.offer_timeout_seconds ?? null,
  set: (value) => {
    if (settings.value) {
      settings.value.offer_timeout_seconds = Number.isFinite(value as number)
        ? (value as number)
        : null;
    }
  },
});

// Kad korisnik pređe na TOP_N/NEAREST popuni razumne početne vrijednosti (kao na
// mockup-u: 3 kurira, 20 s); kad izađe iz TOP_N očisti broj kurira da PATCH
// pošalje null (validaciono pravilo iz Uputstva).
watch(assignmentMode, (mode) => {
  if (!settings.value) return;
  if (mode === "TOP_N") {
    settings.value.assignment_courier_count ??= 3;
  } else {
    settings.value.assignment_courier_count = null;
  }
  if (
    (mode === "NEAREST" || mode === "TOP_N") &&
    settings.value.offer_timeout_seconds == null
  ) {
    settings.value.offer_timeout_seconds = 20;
  }
});

const courierCountRule = (value: unknown) => {
  if (assignmentMode.value !== "TOP_N") return true;
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 50) {
    return "Unesi cijeli broj od 1 do 50.";
  }
  return true;
};

const offerTimeoutRule = (value: unknown) => {
  if (!assignmentNeedsTimeout.value) return true;
  if (value === null || value === undefined || value === "") {
    return "Unesi vrijeme od 5 do 120 sekundi.";
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 5 || num > 120) {
    return "Unesi vrijeme od 5 do 120 sekundi.";
  }
  return true;
};

// Backend default je true; polje može izostati na starijim odgovorima, pa
// getter pada na true (isto ponašanje kao backend).
const showPriceBreakdown = computed<boolean>({
  get: () => settings.value?.show_price_breakdown ?? true,
  set: (value) => {
    if (settings.value) settings.value.show_price_breakdown = value;
  },
});

// Valuta firme (odgovor 01.09, 1.1) - backend je čuva kao slobodan string, ali
// dispečer bira iz liste (ne slobodan unos). Kanonski set je settings.available_currencies
// sa API-ja (odgovor 2.1, deployano 09.09) - front NE hardkoduje listu. `?? []`
// je samo crash-guard za .map na parcijalan odgovor; prazna lista = prazan
// select (vidljiv znak da nešto ne valja), ne maskira se lažnim setom.
// Snimljenu vrijednost van seta zadržavamo da dispečer vidi šta je snimljeno.
const currencyOptions = computed(() => {
  const allowed = settings.value?.available_currencies ?? [];
  const current = settings.value?.currency?.trim();
  const codes =
    current && !allowed.includes(current) ? [current, ...allowed] : allowed;
  return codes.map((code) => ({ title: code, value: code }));
});
const currencyValue = computed<string>({
  get: () => settings.value?.currency?.trim() || DEFAULT_CURRENCY,
  set: (value) => {
    if (settings.value) settings.value.currency = value;
  },
});
const currencyLabel = computed(() => resolveCurrency(settings.value?.currency));

// v-time-picker radi sa "" (ne null) - mapiramo na null tek pri slanju u
// useFinanceSettings.saveSettings, ovde samo prevodimo za prikaz/unos. Backend
// sad vraća "HH:MM" (odgovor §3.11); .slice(0, 5) ostaje kao defanziva za stare
// "HH:MM:SS" zapise (no-op na "HH:MM").
const handoverTime = computed<string>({
  get: () => settings.value?.daily_handover_time?.slice(0, 5) ?? "",
  set: (value) => {
    if (settings.value) settings.value.daily_handover_time = value || null;
  },
});

// null = bez limita, broj (uključujući 0) = strogi limit - backend eksplicitno
// ne tretira 0 kao null (vidi 26_08_2026_odgovori-cash-limit.textile, tačka
// 5). Switch drži tu granicu vidljivom umesto da dispečer slučajno upiše 0
// misleći "bez limita" i odjednom blokira sve kurire firme.
const limitEnabled = computed<boolean>({
  get: () => (settings.value ? settings.value.cash_limit_amount !== null : false),
  set: (value) => {
    if (!settings.value) return;
    settings.value.cash_limit_amount = value
      ? settings.value.cash_limit_amount ?? 0
      : null;
  },
});

const cashLimitRule = (value: unknown) => {
  if (!limitEnabled.value) return true;
  if (value === null || value === undefined || value === "") {
    return "Unesi iznos (0 je dozvoljeno).";
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return "Unesi iznos veći ili jednak 0.";
  return true;
};

const formRef = ref<InstanceType<typeof VForm> | null>(null);

const onSave = async () => {
  const { valid } = (await formRef.value?.validate()) ?? { valid: true };
  if (valid) emit("save");
};
</script>

<style scoped>
.limit-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: #f5f6f8;
  border-radius: 16px;
}

.switch-label {
  margin: 0;
  font-weight: 700;
}

.switch-hint {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
  max-width: 420px;
}

.assignment-section {
  padding: 16px;
  background: #f5f6f8;
  border-radius: 16px;
}

/* Polja unutar sive "Dodela narudžbi" kartice - bijela, da se izdvoje od
   podloge (inače siva na sivo). Nadjačava globalni .global-field .v-field. */
.assignment-section :deep(.v-field) {
  background: #fff;
}

.section-label {
  margin: 0;
  font-weight: 700;
}

.section-hint {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
  max-width: 520px;
}
</style>
