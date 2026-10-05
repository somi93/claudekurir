<template>
  <div class="cs" data-company="settings">
    <div
      v-if="loading && !settings"
      class="cs-grid"
      role="status"
      aria-busy="true"
      aria-label="Učitavam postavke"
    >
      <div class="cs-secs" aria-hidden="true">
        <div v-for="n in 3" :key="n" class="cs-sk-sec">
          <i class="b cs-sk-eb" />
          <div class="cs-sk-card">
            <div v-for="m in n === 1 ? 3 : n === 2 ? 2 : 1" :key="m" class="cs-sk-row">
              <i class="b cs-sk-ic" />
              <span class="cs-sk-tx"><i class="b" style="width: 40%; height: 11px" /><i class="b" style="width: 64%; height: 14px" /></span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="wide" class="cs-sk-det" aria-hidden="true">
        <i class="b" style="width: 42%; height: 18px" />
        <i class="b" style="width: 64%; height: 12px" />
        <i class="b" style="height: 52px; margin-top: 12px" />
        <i class="b" style="height: 84px" />
      </div>
    </div>

    <div v-else-if="failed && !settings" class="cs-empty" role="alert" data-company="settings-error">
      <span class="cs-empty-ic bad"><v-icon icon="mdi-cloud-off-outline" size="30" /></span>
      <h3>Ne mogu da učitam postavke</h3>
      <p>{{ errorText || "Server ne odgovara." }} Ništa nije izgubljeno.</p>
      <AppButton variant="ghost" icon="mdi-refresh" class="cs-retry" data-company="retry" @click="emit('retry')">
        Pokušaj ponovo
      </AppButton>
    </div>

    <div v-else-if="settings" class="cs-grid">
      <div class="cs-secs">
        <SettingSection v-for="group in SETTING_GROUPS" :key="group.key" :title="group.title">
          <SettingRow
            v-for="k in group.kinds"
            :key="k"
            interactive
            :icon="SETTING_META[k].icon"
            :label="rows[k].label"
            :value="rows[k].value"
            :empty="rows[k].empty"
            :chip="rows[k].tag"
            :selected="wide && kind === k"
            :aria-label="`${rows[k].label}: ${rows[k].value}. Izmijeni`"
            :data-setting="k"
            :class="{ 'is-flash': flash === k }"
            @click="onRow(k)"
          />
          <SettingRow
            v-if="group.key === 'firm'"
            icon="mdi-percent-outline"
            label="Provizija"
            :value="commissionText(settings)"
            hint="Postavlja Ordera administrator"
            locked
            data-setting="commission"
          />
        </SettingSection>
      </div>

      <aside v-if="wide" class="cs-det" aria-label="Uređivanje postavke">
        <SettingEditor
          v-if="kind"
          :key="kind"
          ref="editor"
          :kind="kind"
          :saved="settings"
          inline
          :asking="asking"
          v-bind="ctx"
          :save="save"
          @close="onClose"
          @keep="onKeep"
          @discard="onDiscard"
          @ask="onAsk"
          @dirty="dirty = $event"
          @saved="onSaved"
        />
        <div v-else class="cs-none">
          <v-icon icon="mdi-tune-variant" size="34" />
          <b>Izaberi postavku</b>
          <p>Izmjene se pojavljuju ovdje. Svaka se čuva posebno, odmah pored polja.</p>
        </div>
      </aside>
    </div>

    <SettingEditor
      v-if="!wide && settings"
      :key="sheetKind"
      :kind="sheetKind"
      :saved="settings"
      :inline="false"
      :open="sheetOpen"
      v-bind="ctx"
      :save="save"
      @update:open="sheetOpen = $event"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import SettingRow from "~/components/common/SettingRow.vue";
import SettingSection from "~/components/common/SettingSection.vue";
import SettingEditor from "~/components/company/settings/SettingEditor.vue";
import {
  SETTING_GROUPS,
  SETTING_META,
  commissionText,
  overLimitCount,
  rowView,
  type RowView,
  type SettingKind,
} from "~/utils/companySettings";
import type { ActionResult } from "~/composables/useCourierRoster";
import type { CourierBalance } from "~/types/courier-balance";
import type { FinanceSettings, FinanceSettingsUpdate } from "~/types/finance-settings";

// Postavke firme kao redovi. Računar: spisak lijevo, editor izabrane postavke desno (panel ostaje
// otvoren, kao detalj u Kuriri). Telefon: red otvara donji list. Jedan red = jedna postavka, svaka
// se čuva posebno. Nesačuvan unos se ne gubi bez pitanja ni pri promjeni reda, taba ili firme.
const props = defineProps<{
  settings: FinanceSettings | null;
  loading: boolean;
  failed: boolean;
  errorText: string;
  // Sačuvana valuta firme.
  currency: string;
  balances: CourierBalance[] | null;
  balancesLoading: boolean;
  balancesFailed: boolean;
  restaurantsOther: number | null;
  restaurantsTotal: number | null;
  wide: boolean;
  save: (patch: Partial<FinanceSettingsUpdate>) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ retry: [] }>();

// Računar: izabrana postavka. Telefon: otvoren list (kind ostaje i poslije zatvaranja da se list ne
// razmonta usred animacije).
const kind = ref<SettingKind | null>(null);
const sheetKind = ref<SettingKind>("limit");
const sheetOpen = ref(false);
const editor = ref<InstanceType<typeof SettingEditor> | null>(null);
const dirty = ref(false);
const asking = ref(false);
const flash = ref<SettingKind | null>(null);
let pending: (() => void) | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const ctx = computed(() => ({
  currency: props.currency,
  balances: props.balances,
  balancesState: (props.balancesFailed
    ? "failed"
    : props.balances === null || props.balancesLoading
      ? "loading"
      : "ready") as "loading" | "ready" | "failed",
  restaurantsOther: props.restaurantsOther,
  restaurantsTotal: props.restaurantsTotal,
}));

const rows = computed(() => {
  const saved = props.settings;
  const out = {} as Record<SettingKind, RowView>;
  if (!saved) return out;
  const limit = saved.cash_limit_amount;
  const context = {
    overLimit: overLimitCount(props.balances, limit === null || limit === undefined ? null : Number(limit)),
    otherCurrency: props.restaurantsOther,
  };
  for (const group of SETTING_GROUPS) {
    for (const k of group.kinds) out[k] = rowView(k, saved, context);
  }
  return out;
});

// Na računaru editor nikad nije prazan na početku: otvara se prva postavka (bez pomjeranja fokusa).
watch(
  () => [props.wide, props.settings !== null] as const,
  ([wide, ready]) => {
    if (wide && ready && kind.value === null) kind.value = "limit";
  },
  { immediate: true }
);

// Radnja koja napušta editor (drugi red, tab, zatvaranje): sa nesačuvanim unosom prvo pita.
const guard = (action: () => void) => {
  if (props.wide && kind.value && dirty.value) {
    pending = action;
    asking.value = true;
    return;
  }
  action();
};

const onRow = (k: SettingKind) => {
  if (!props.wide) {
    sheetKind.value = k;
    sheetOpen.value = true;
    return;
  }
  if (kind.value === k) {
    void nextTick(() => editor.value?.focusTitle());
    return;
  }
  guard(() => {
    kind.value = k;
    void nextTick(() => editor.value?.focusTitle());
  });
};

const onClose = () => guard(() => (kind.value = null));
const onAsk = () => {
  pending = null;
  asking.value = true;
};
const onKeep = () => {
  asking.value = false;
  pending = null;
};
const onDiscard = () => {
  asking.value = false;
  dirty.value = false;
  const action = pending;
  pending = null;
  if (action) action();
  else kind.value = null;
};

const onSaved = (k: SettingKind) => {
  flash.value = k;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flash.value = null), 1600);
};

onBeforeUnmount(() => {
  if (flashTimer) clearTimeout(flashTimer);
});

defineExpose({
  guard,
  isDirty: () => props.wide && dirty.value,
  // Za promjenu firme: pitanje se pokazuje, a radnja se izvrši tek poslije "Odbaci izmjene".
  askBefore: (action: () => void) => guard(action),
});
</script>

<style scoped>
.cs {
  min-width: 0;
}

.cs-grid {
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.cs-grid > * {
  min-width: 0;
}

.cs-secs {
  display: grid;
  gap: 18px;
  align-content: start;
}

/* Editor pored liste: lijepi se uz vrh dok se lista skroluje, kao detalj u Kuriri. */
.cs-det {
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 100px);
  max-height: calc(100dvh - 100px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.cs-none {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 56px 24px;
  text-align: center;
  color: #5b6676;
}

.cs-none b {
  color: #0b1220;
  font-size: 1.02rem;
}

.cs-none p {
  max-width: 300px;
  margin: 0;
  font-size: 0.86rem;
}

/* Poslije snimanja red kratko zelen. */
:deep(.pr.is-flash) {
  animation: cs-flash 1.6s ease-out;
}

@keyframes cs-flash {
  0%,
  40% {
    background: #e3f8ef;
  }
  100% {
    background: #fff;
  }
}

.cs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: 520px;
  margin: 0 auto;
  padding: 34px 24px 24px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  text-align: center;
}

.cs-empty h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.cs-empty p {
  max-width: 320px;
  margin: 0;
  font-size: 0.86rem;
  color: #5b6676;
}

.cs-empty-ic {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  border-radius: 20px;
  background: #eef4ff;
  color: #2f6fed;
}

.cs-empty-ic.bad {
  background: #fde8e6;
  color: #c4281c;
}

.cs-retry {
  width: auto;
  margin-top: 8px;
}

.cs-sk-sec {
  display: grid;
  gap: 8px;
}

.cs-sk-eb {
  width: 90px;
  height: 11px;
  margin-left: 4px;
}

.cs-sk-card {
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.cs-sk-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 64px;
  padding: 12px 14px;
  border-top: 1px solid #eceef2;
}

.cs-sk-row:first-child {
  border-top: 0;
}

.cs-sk-ic {
  width: 40px;
  height: 40px;
  border-radius: 12px;
}

.cs-sk-tx {
  display: grid;
  gap: 8px;
}

.cs-sk-det {
  display: grid;
  gap: 10px;
  padding: 24px 22px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.b {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 50%, #eef0f4 100%);
  background-size: 200% 100%;
  animation: cs-shimmer 1.3s linear infinite;
}

@keyframes cs-shimmer {
  to {
    background-position: -200% 0;
  }
}

/* Ispod granice za dva stupca: samo lista, editor je donji list. */
@media (max-width: 1099px) {
  .cs-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .b,
  :deep(.pr.is-flash) {
    animation: none;
  }
}
</style>
