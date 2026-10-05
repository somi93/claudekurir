<template>
  <div ref="root" class="sfd">
    <!-- Limit gotovine -->
    <template v-if="kind === 'limit'">
      <SettingSwitch
        :model-value="draft.limitOn"
        name="limitOn"
        label="Ograniči gotovinu"
        hint="Kurir mora da preda gotovinu kad pređe iznos."
        @update:model-value="onLimitOn"
      />
      <template v-if="draft.limitOn">
        <SheetField
          v-model="draft.limit"
          name="limit"
          :label="`Limit (${currency})`"
          inputmode="decimal"
          enterkeyhint="done"
          placeholder="0.00"
          :message="messages.limit ?? { tone: 'hint', text: LIMIT_HINT }"
          @update:model-value="emit('edited', 'limit')"
          @blur="emit('touch', 'limit')"
        />
        <div class="sfd-f">
          <span class="sfd-fl">Kad kurir pređe limit</span>
          <ChoiceGroup
            :model-value="draft.enforcement"
            :options="enforcementOptions"
            label="Kad kurir pređe limit"
            @update:model-value="pick('enforcement', $event)"
          />
        </div>
      </template>
      <CashLimitImpact :impact="impact" :state="balancesState" :currency="currency" />
    </template>

    <!-- Predaja gotovine -->
    <template v-else-if="kind === 'handover'">
      <SheetField
        v-model="draft.handover"
        name="handover"
        label="Vrijeme dnevne predaje"
        optional
        type="time"
        enterkeyhint="done"
        :message="messages.handover ?? { tone: 'hint', text: 'Prazno znači da vrijeme nije određeno.' }"
        @update:model-value="emit('edited', 'handover')"
        @blur="emit('touch', 'handover')"
      >
        <template v-if="draft.handover" #tail>
          <button type="button" class="sfd-clr" aria-label="Obriši vrijeme" @click="clearTime">
            <v-icon icon="mdi-close" size="18" />
          </button>
        </template>
      </SheetField>
    </template>

    <!-- Isplata zarade -->
    <template v-else-if="kind === 'payout'">
      <div class="sfd-f">
        <span class="sfd-fl">Koliko često se isplaćuje</span>
        <ChoiceGroup
          :model-value="draft.payout"
          :options="payoutOptions"
          label="Period isplate"
          variant="pills"
          @update:model-value="onPayout"
        />
      </div>
      <SheetField
        v-if="draft.payout === 'other'"
        v-model="draft.payoutOther"
        name="payoutOther"
        label="Broj dana"
        inputmode="numeric"
        enterkeyhint="done"
        :message="messages.payoutOther ?? { tone: 'hint', text: 'Cijeli broj, najmanje 1.' }"
        @update:model-value="emit('edited', 'payoutOther')"
        @blur="emit('touch', 'payoutOther')"
      />
    </template>

    <!-- Način dodjele -->
    <template v-else-if="kind === 'mode'">
      <ChoiceGroup
        :model-value="draft.mode"
        :options="modeChoices"
        label="Način dodjele"
        :columns="1"
        @update:model-value="pick('mode', $event)"
      />
      <SheetField
        v-if="draft.mode === 'TOP_N'"
        v-model="draft.count"
        name="count"
        label="Broj kurira koji dobijaju ponudu"
        inputmode="numeric"
        :message="messages.count ?? { tone: 'hint', text: 'Od 1 do 50.' }"
        @update:model-value="emit('edited', 'count')"
        @blur="emit('touch', 'count')"
      />
      <template v-if="needsTimeout(draft.mode)">
        <SheetField
          v-model="draft.timeout"
          name="timeout"
          label="Vrijeme čekanja odgovora (sekunde)"
          inputmode="numeric"
          enterkeyhint="done"
          :message="messages.timeout ?? { tone: 'hint', text: 'Od 5 do 120 sekundi.' }"
          @update:model-value="emit('edited', 'timeout')"
          @blur="emit('touch', 'timeout')"
        />
        <div class="sfd-f">
          <span class="sfd-fl">Ako niko ne odgovori na vrijeme</span>
          <ChoiceGroup
            :model-value="draft.action"
            :options="actionOptions"
            label="Ako niko ne odgovori na vrijeme"
            variant="pills"
            @update:model-value="pick('action', $event)"
          />
        </div>
      </template>
      <TintAlert tone="info" title="Šta će se desiti" data-company="explain">
        {{ explanation }}
      </TintAlert>
    </template>

    <!-- Skup kurira -->
    <template v-else-if="kind === 'pool'">
      <ChoiceGroup
        :model-value="draft.pool"
        :options="poolChoices"
        label="Koje kurire uzeti u obzir"
        :columns="1"
        @update:model-value="pick('pool', $event)"
      />
    </template>

    <!-- Cijena dostave za kupca -->
    <template v-else-if="kind === 'price'">
      <SettingSwitch
        :model-value="draft.breakdown"
        name="breakdown"
        label="Prikaži kupcu detaljan raspis"
        hint="Kupac prije potvrde narudžbe vidi iz čega se sastoji cijena dostave."
        @update:model-value="pick('breakdown', $event)"
      />
      <div class="sfd-prev" aria-label="Primjer onoga što kupac vidi">
        <div class="sfd-rc" :class="{ on: draft.breakdown }">
          <span class="sfd-cap">Sa raspisom</span>
          <div><span>Osnovna cijena</span><span>2.00</span></div>
          <div><span>Po kilometru</span><span>1.60</span></div>
          <div><span>Gužva</span><span>0.50</span></div>
          <div class="tot"><span>Dostava</span><span>4.10 {{ currency }}</span></div>
        </div>
        <div class="sfd-rc" :class="{ on: !draft.breakdown }">
          <span class="sfd-cap">Samo ukupan iznos</span>
          <div class="tot nb"><span>Dostava</span><span>4.10 {{ currency }}</span></div>
        </div>
      </div>
      <p class="sfd-note">
        Brojevi su samo primjer izgleda. Izmjena odmah važi za svaku narudžbu koju kupac sljedeću pregleda.
      </p>
    </template>

    <!-- Valuta -->
    <template v-else-if="kind === 'currency'">
      <div class="sfd-f">
        <span class="sfd-fl">Valuta</span>
        <ChoiceGroup
          :model-value="draft.currency"
          :options="currencyChoices"
          label="Valuta firme"
          variant="pills"
          @update:model-value="pick('currency', $event)"
        />
      </div>
      <TintAlert v-if="currencyWarning" tone="warn" :title="currencyWarning.title" data-company="currency-warning">
        {{ currencyWarning.body }}
      </TintAlert>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import SettingSwitch from "~/components/common/SettingSwitch.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import CashLimitImpact from "~/components/company/settings/CashLimitImpact.vue";
import {
  ENFORCEMENT_OPTIONS,
  PAYOUT_OPTIONS,
  POOL_OPTIONS,
  TIMEOUT_ACTION_OPTIONS,
  checkSetting,
  describeCashImpact,
  describeCurrencyChange,
  explainMode,
  modeOptions,
  needsTimeout,
  type DraftKey,
  type Option,
  type SettingDraft,
  type SettingKind,
} from "~/utils/companySettings";
import type { FieldMsg } from "~/utils/profileForm";
import type { CourierBalance } from "~/types/courier-balance";
import type { FinanceSettings } from "~/types/finance-settings";

// Polja jednog editora (sedam vrsta postavki). Nacrt je reaktivan objekat editora i polja ga mijenjaju
// direktno; poruke uz polja (greška ili savjet) stižu već izračunate. Isti sadržaj je u panelu
// pored liste (računar) i u donjem listu (telefon).
const props = defineProps<{
  kind: SettingKind;
  draft: SettingDraft;
  saved: FinanceSettings;
  messages: Partial<Record<DraftKey, FieldMsg>>;
  // Sačuvana valuta firme (sufiks uz iznose).
  currency: string;
  balances: CourierBalance[] | null;
  balancesState: "loading" | "ready" | "failed";
  restaurantsOther: number | null;
  restaurantsTotal: number | null;
}>();

const emit = defineEmits<{ edited: [key: DraftKey]; touch: [key: DraftKey] }>();

const root = ref<HTMLElement | null>(null);

const LIMIT_HINT = "0 znači da kurir ne smije držati nikakvu gotovinu.";

const toChoices = <V extends string>(options: Option<V>[]): ChoiceOption[] =>
  options.map((o) => ({ value: o.value, label: o.label, hint: o.hint }));

const enforcementOptions = toChoices(ENFORCEMENT_OPTIONS);
const payoutOptions = toChoices(PAYOUT_OPTIONS);
const actionOptions = toChoices(TIMEOUT_ACTION_OPTIONS);
const poolChoices = toChoices(POOL_OPTIONS);
const modeChoices = computed(() => toChoices(modeOptions(props.saved)));

// Snimljena vrijednost van seta ostaje izabrana (da dispečer vidi šta je snimljeno).
const currencyChoices = computed<ChoiceOption[]>(() => {
  const allowed = props.saved.available_currencies ?? [];
  const current = props.saved.currency?.trim();
  const codes = current && !allowed.includes(current) ? [current, ...allowed] : allowed;
  return codes.map((code) => ({ value: code, label: code }));
});

const pick = (key: DraftKey, value: unknown) => {
  (props.draft as Record<string, unknown>)[key] = value;
  emit("edited", key);
};

const focusField = (name: string) =>
  void nextTick(() =>
    root.value?.querySelector<HTMLElement>(`[data-field="${name}"]`)?.focus({ preventScroll: true })
  );

// Uključivanje limita: polje je prazno (ne 0), pa dispečer mora svjesno upisati iznos.
const onLimitOn = (on: boolean) => {
  pick("limitOn", on);
  if (on) focusField("limit");
};

const onPayout = (value: string | number) => {
  pick("payout", value);
  if (value === "other") focusField("payoutOther");
};

const clearTime = () => {
  pick("handover", "");
  focusField("handover");
};

const impact = computed(() =>
  props.balancesState === "ready" && props.balances
    ? describeCashImpact(props.balances, props.draft, props.currency)
    : null
);

const explanation = computed(() => {
  const full = checkSetting("mode", props.draft, props.saved, () => true).fields;
  return explainMode(props.draft, !full.count, !full.timeout);
});

const currencyWarning = computed(() =>
  describeCurrencyChange(props.draft.currency, props.saved, props.restaurantsOther, props.restaurantsTotal)
);
</script>

<style scoped>
.sfd {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.sfd-f {
  display: grid;
  gap: 8px;
}

.sfd-fl {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0b1220;
}

.sfd-clr {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: #5b6676;
  cursor: pointer;
}

.sfd-clr:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.sfd-note {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
  color: #5b6676;
}

.sfd-prev {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.sfd-rc {
  display: grid;
  gap: 5px;
  align-content: start;
  padding: 12px 14px;
  border: 1.5px dashed #dfe3ea;
  border-radius: 14px;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.sfd-rc > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.sfd-rc .tot {
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px solid #dfe3ea;
  font-weight: 800;
}

.sfd-rc .tot.nb {
  margin: 0;
  padding: 0;
  border: 0;
}

.sfd-cap {
  margin-bottom: 2px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6676;
}

/* Izabrani izgled: pun plavi okvir i blaga podloga (stanje se ne prikazuje bljeđim tekstom). */
.sfd-rc.on {
  border: 1.5px solid #2f6fed;
  background: #eef4ff;
}

@media (max-width: 460px) {
  .sfd-prev {
    grid-template-columns: minmax(0, 1fr);
  }
}

</style>
