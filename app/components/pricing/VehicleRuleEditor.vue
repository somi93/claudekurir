<template>
  <component :is="Shell" ref="sheet" v-bind="shellAttrs">
    <template #default>
      <header v-if="inline" class="re-h">
        <h3 :id="titleId" ref="title" tabindex="-1">{{ meta.title }}</h3>
        <p v-if="isNew">{{ meta.sub }}</p>
      </header>

      <div class="re-body" :data-pricing="inline ? undefined : 'rule-editor'">
        <!-- Server je odbio izmjenu: poruka je i uz polje, a ovdje je opšta i ona bez polja. -->
        <div v-if="hasError" ref="errBox">
          <TintAlert tone="bad" role="alert" title="Ne mogu da sačuvam" data-pricing="rule-error">
            {{ error }}
            <span v-for="text in placed.loose" :key="text" class="re-loose">{{ text }}</span>
          </TintAlert>
        </div>

        <!-- Kad se primjenjuje. Zadano pravilo koje se uređuje nema izbor: uvijek je "Sve ostalo". -->
        <div v-if="!isFallback" class="re-f">
          <span class="re-fl">Kad se primjenjuje</span>
          <ChoiceGroup
            data-field="type"
            :model-value="draft.type"
            :options="typeOptions"
            label="Kad se primjenjuje"
            :columns="3"
            stack-narrow
            @update:model-value="onType"
          />
        </div>
        <TintAlert v-if="draft.type === 'default'" tone="info" title="Zadano pravilo" data-pricing="rule-default-info">
          {{ defaultText }}
        </TintAlert>

        <!-- Zona -->
        <div v-if="draft.type === 'zone'" class="re-f">
          <label class="re-fl" :for="zoneId">Zona</label>
          <div class="re-in re-sel" :class="{ 'is-bad': Boolean(shown.zone) }">
            <select
              :id="zoneId"
              v-model="draft.zone"
              data-field="zone"
              :aria-invalid="shown.zone ? 'true' : 'false'"
              :aria-describedby="`${zoneId}-msg`"
              @change="touch('zone')"
              @blur="touch('zone')"
            >
              <option :value="null">Izaberi zonu</option>
              <option v-if="zoneMissing" :value="draft.zone">Zona više ne postoji</option>
              <option v-for="z in zoneOptions" :key="z.id" :value="z.id">{{ z.text }}</option>
            </select>
            <v-icon icon="mdi-chevron-down" size="20" class="re-sel-ic" />
          </div>
          <div :id="`${zoneId}-msg`" class="re-msg" :class="{ 'is-bad': Boolean(shown.zone) }" aria-live="polite">
            <template v-if="shown.zone">
              <v-icon icon="mdi-alert-circle-outline" size="16" /><span>{{ shown.zone }}</span>
            </template>
            <span v-else-if="ws.zones.list.length === 0 && !ws.zones.loading && !ws.zones.loadFailed">
              Nema zona za grad firme.
            </span>
          </div>
          <TintAlert v-if="ws.zones.loadFailed" tone="warn" title="Ne mogu da učitam zone" data-pricing="rule-zones-error">
            {{ ws.zones.loadReason }} Zone su potrebne za ovo pravilo.
            <template #action>
              <button type="button" class="re-retry" @click="ws.zones.reload()">Pokušaj ponovo</button>
            </template>
          </TintAlert>
        </div>

        <!-- Doplata -->
        <div v-if="draft.type === 'surcharge'" class="re-f">
          <label class="re-fl" :for="surId">Doplata</label>
          <div class="re-in re-sel" :class="{ 'is-bad': Boolean(shown.sur) }">
            <select
              :id="surId"
              v-model="draft.sur"
              data-field="sur"
              :aria-invalid="shown.sur ? 'true' : 'false'"
              :aria-describedby="`${surId}-msg`"
              @change="touch('sur')"
              @blur="touch('sur')"
            >
              <option :value="null">Izaberi doplatu</option>
              <option v-if="surMissing" :value="draft.sur">(obrisana doplata)</option>
              <option v-for="s in ws.surcharges.list" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <v-icon icon="mdi-chevron-down" size="20" class="re-sel-ic" />
          </div>
          <div :id="`${surId}-msg`" class="re-msg" :class="{ 'is-bad': Boolean(shown.sur) }" aria-live="polite">
            <template v-if="shown.sur">
              <v-icon icon="mdi-alert-circle-outline" size="16" /><span>{{ shown.sur }}</span>
            </template>
            <span v-else-if="ws.surcharges.list.length === 0 && !ws.surcharges.loading && !ws.surcharges.loadFailed">
              Još nema doplata. Dodaj ih u tabu Doplate.
            </span>
          </div>
          <TintAlert
            v-if="ws.surcharges.loadFailed"
            tone="warn"
            title="Ne mogu da učitam doplate"
            data-pricing="rule-surcharges-error"
          >
            {{ ws.surcharges.loadReason }} Doplate su potrebne za ovo pravilo.
            <template #action>
              <button type="button" class="re-retry" @click="ws.surcharges.reload()">Pokušaj ponovo</button>
            </template>
          </TintAlert>
        </div>

        <!-- Udaljenost: dva polja, jedna zajednička poruka. -->
        <div v-if="draft.type === 'distance'" class="re-f">
          <div class="re-two">
            <div class="re-f">
              <label class="re-fl" :for="minId">Od (km)<i> opciono</i></label>
              <div class="re-in" :class="{ 'is-bad': Boolean(shown.dist) }">
                <input
                  :id="minId"
                  v-model="draft.min"
                  data-field="min"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  spellcheck="false"
                  :aria-invalid="shown.dist ? 'true' : 'false'"
                  :aria-describedby="distMsgId"
                  @input="untouch('dist')"
                  @blur="touch('dist')"
                />
              </div>
            </div>
            <div class="re-f">
              <label class="re-fl" :for="maxId">Do (km)<i> opciono</i></label>
              <div class="re-in" :class="{ 'is-bad': Boolean(shown.dist) }">
                <input
                  :id="maxId"
                  v-model="draft.max"
                  data-field="max"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  spellcheck="false"
                  :aria-invalid="shown.dist ? 'true' : 'false'"
                  :aria-describedby="distMsgId"
                  @input="untouch('dist')"
                  @blur="touch('dist')"
                />
              </div>
            </div>
          </div>
          <div :id="distMsgId" class="re-msg" :class="{ 'is-bad': Boolean(shown.dist) }" aria-live="polite">
            <template v-if="shown.dist">
              <v-icon icon="mdi-alert-circle-outline" size="16" /><span>{{ shown.dist }}</span>
            </template>
            <span v-else>Prazno „od“ je od nule, prazno „do“ je bez gornje granice.</span>
          </div>
        </div>

        <!-- Isti uslov kao ranije pravilo: ovo se nikad ne bi primijenilo. -->
        <TintAlert
          v-if="dupAt > 0"
          tone="warn"
          role="status"
          title="Ovo pravilo se nikad ne primjenjuje"
          data-pricing="rule-dup"
        >
          Pravilo {{ dupAt }} ima isti uslov i na redu je prije njega.
        </TintAlert>

        <!-- Vozila redom preferencije: čipovi za dodavanje, ispod izabrana sa rednim brojem. -->
        <div class="re-f" role="group" :aria-labelledby="vehLabelId">
          <span :id="vehLabelId" class="re-fl">Preporučena vozila, redom preferencije</span>
          <div ref="vehBox" class="re-vp">
            <button
              v-for="(key, i) in RULE_VEHICLE_KEYS"
              :key="key"
              type="button"
              class="re-chip"
              :class="{ 'is-on': hasVeh(key) }"
              :data-veh-add="key"
              :data-field="i === 0 ? 'veh' : undefined"
              :disabled="hasVeh(key)"
              @click="addVeh(key)"
            >
              <v-icon :icon="vehView(key).icon" size="18" />
              {{ vehView(key).label }}
              <v-icon v-if="hasVeh(key)" icon="mdi-check" size="16" />
            </button>
          </div>
          <ol ref="vehList" class="re-vo" aria-label="Izabrana vozila, redom preferencije" aria-live="polite">
            <li v-for="(v, i) in draft.veh" :key="v" class="re-vt">
              <span>{{ i + 1 }}. {{ vehView(v).label }}</span>
              <button
                type="button"
                class="re-vx"
                :data-veh-remove="i"
                :aria-label="`Ukloni vozilo ${vehView(v).label}`"
                @click="removeVeh(i)"
              >
                <v-icon icon="mdi-close" size="14" />
              </button>
            </li>
            <li v-if="draft.veh.length === 0" class="re-vph">Dodirni vozila iznad, redom kojim ih želiš.</li>
          </ol>
          <div class="re-msg is-bad" aria-live="polite">
            <template v-if="shown.veh">
              <v-icon icon="mdi-alert-circle-outline" size="16" /><span>{{ shown.veh }}</span>
            </template>
          </div>
        </div>

        <SheetField
          v-model="draft.maxT"
          name="maxT"
          label="Najveći faktor terena"
          optional
          inputmode="decimal"
          :message="
            shown.maxT
              ? { tone: 'bad', text: shown.maxT }
              : { tone: 'hint', text: '1,0 je ravnica, veći broj je brdovitije. Prazno znači bez ograničenja.' }
          "
          @update:model-value="untouch('maxT')"
          @blur="touch('maxT')"
        />

        <SheetField
          v-model="draft.note"
          name="note"
          label="Napomena"
          optional
          enterkeyhint="done"
          :message="{ tone: 'hint', text: 'Vidi je dispečer pri dodjeli.' }"
        />
      </div>
    </template>

    <template #footer>
      <!-- Računar: Obriši lijevo, Otkaži i Sačuvaj desno. -->
      <div v-if="inline" class="re-foot is-inline">
        <p v-if="hint" class="re-hint">{{ hint }}</p>
        <div class="re-row">
          <AppButton
            v-if="canDelete"
            variant="ghost"
            class="re-del"
            icon="mdi-delete-outline"
            data-pricing="rule-delete"
            :disabled="saving"
            @click="emit('delete')"
          >
            Obriši
          </AppButton>
          <span class="re-sp" />
          <AppButton variant="ghost" data-pricing="rule-cancel" :disabled="saving" @click="cancel">Otkaži</AppButton>
          <AppButton submit data-pricing="rule-save" :disabled="!canSave" :loading="saving">{{ saveLabel }}</AppButton>
        </div>
      </div>

      <!-- Telefon: Sačuvaj je u dosegu palca, Obriši ispod, odvojeno od njega. -->
      <template v-else>
        <div class="re-row is-sheet">
          <AppButton variant="ghost" data-pricing="rule-cancel" :disabled="saving" @click="cancel">Otkaži</AppButton>
          <AppButton submit data-pricing="rule-save" :disabled="!canSave" :loading="saving">{{ saveLabel }}</AppButton>
        </div>
        <AppButton
          v-if="canDelete"
          variant="ghost"
          class="re-del"
          icon="mdi-delete-outline"
          data-pricing="rule-delete"
          :disabled="saving"
          @click="emit('delete')"
        >
          Obriši pravilo
        </AppButton>
        <p>{{ hint }}</p>
      </template>
    </template>
  </component>
</template>

<script setup lang="ts">
import {
  computed,
  h,
  nextTick,
  ref,
  shallowRef,
  useId,
  watch,
  type Component,
  type FunctionalComponent,
} from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import type { VehicleRuleConditionType, VehicleRuleVehicle } from "~/types/pricing";
import { RULE_VEHICLE_KEYS, formatTerrain, ruleVehicleView } from "~/utils/pricing";
import { placeServerMessages, ruleDirty, ruleErrors, type RuleErrors } from "~/utils/pricingDrafts";

// Editor jednog pravila za vozila (novo ili postojeće). Isti sadržaj, dvije ljuske kao SettingEditor:
// panel u redu koji se mijenja (`inline`, računar; poslije snimanja i otkazivanja se zatvara) i donji
// list (AppSheet, telefon; pita za nesačuvano). Sve što se čuva ide kroz ws.actions.saveRule; greška
// servera stoji uz polje (placeServerMessages("rule")), a unos ostaje u formi. Brisanje pita stranica
// (PricingDeleteDialog): editor samo javlja "delete".
const props = defineProps<{
  ws: PricingWorkspace;
  // null je novo pravilo.
  ruleId: number | null;
  inline: boolean;
  // Donji list: otvoren je li.
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  // Panel: Otkaži, ili zatvaranje poslije snimanja.
  close: [];
  // Pravilo je sačuvano (id novog pravila kad ga server vrati).
  saved: [id: number | null];
  dirty: [value: boolean];
  delete: [];
}>();

type SheetHandle = { closeNow: () => void; focusField: (name: string) => void };
type RuleKey = keyof RuleErrors;

// Ljuska panela: sekcija sa formom, a sadržaj i podnožje su isti slotovi koje prima AppSheet. Mala je, pa
// stoji ovdje umjesto u posebnoj datoteci; `onSubmit` je Enter u polju ili "Sačuvaj".
const InlineShell: FunctionalComponent<{ onSubmit?: (event: Event) => void }> = (shellProps, { slots, attrs }) =>
  h("section", attrs, [
    h("form", { novalidate: true, onSubmit: shellProps.onSubmit }, [slots.default?.(), slots.footer?.()]),
  ]);
InlineShell.props = ["onSubmit"];

const uid = useId();
const titleId = `re-${uid}`;
const vehLabelId = `re-v-${uid}`;
const zoneId = `re-z-${uid}`;
const surId = `re-s-${uid}`;
const minId = `re-a-${uid}`;
const maxId = `re-b-${uid}`;
const distMsgId = `re-d-${uid}`;

const sheet = ref<InstanceType<typeof AppSheet> | null>(null);
const title = ref<HTMLElement | null>(null);
const errBox = ref<HTMLElement | null>(null);
const vehBox = ref<HTMLElement | null>(null);
const vehList = ref<HTMLElement | null>(null);

const isNew = computed(() => props.ruleId === null);
const rule = computed(() => (props.ruleId === null ? null : props.ws.rules.ruleById(props.ruleId)));
const isFallback = computed(
  () => rule.value !== null && props.ws.rules.ordered.fallback?.id === rule.value.id
);
const canDelete = computed(() => !isNew.value && !isFallback.value);

// Naslov postojećeg pravila ostaje i kad pravilo nestane iz liste (list se još zatvara).
const ruleTitle = ref("");
watch(
  rule,
  (r) => {
    if (r) ruleTitle.value = props.ws.rules.titleOf(r);
  },
  { immediate: true }
);

const meta = computed(() =>
  isNew.value
    ? {
        title: "Novo pravilo",
        sub: props.ws.rules.hasFallback ? "Dodaje se iznad „Sve ostalo“." : "Dodaje se na kraj liste.",
      }
    : { title: "Uredi pravilo", sub: ruleTitle.value }
);

const open = computed(() => props.inline || Boolean(props.open));
const { draft, show, touch, untouch, submitted, saving, error, serverFields, edited } = useSheetDraft(open, () =>
  props.ws.rules.makeDraft(rule.value)
);

// Sve što kuca ili bira dispečer briše ono što je server rekao o prethodnom pokušaju.
watch(draft, () => edited(), { deep: true });

// --- Provjera --------------------------------------------------------------------------------------

const original = computed(() => props.ws.rules.makeDraft(rule.value));
const errors = computed(() => ruleErrors(draft));
const valid = computed(() => Object.keys(errors.value).length === 0);
const dirty = computed(() => ruleDirty(draft, original.value));
const canSave = computed(() => valid.value && (dirty.value || isNew.value));

// Redoslijed polja u formi, za "prva greška" i za fokus.
const FIELD_ORDER: readonly RuleKey[] = ["zone", "sur", "dist", "veh", "maxT"];
const FIELD_NAME: Record<RuleKey, string> = { zone: "zone", sur: "sur", dist: "min", veh: "veh", maxT: "maxT" };

// Greška se pokazuje tek kad je polje dodirnuto ili je pokušano snimanje.
const fieldErrors = computed<RuleErrors>(() => {
  const out: RuleErrors = {};
  for (const key of FIELD_ORDER) {
    const text = errors.value[key];
    if (text && show(key)) out[key] = text;
  }
  return out;
});
const placed = computed(() => placeServerMessages("rule", serverFields.value));
// Provjera ispred servera: nevažeći unos je očigledna greška.
const shown = computed<RuleErrors>(() => ({ ...placed.value.inline, ...fieldErrors.value }));
const hasError = computed(() => Boolean(error.value) || placed.value.loose.length > 0);

const firstError = computed(() => {
  for (const key of FIELD_ORDER) {
    const text = errors.value[key];
    if (text) return text;
  }
  return "";
});

// Pojašnjenje ispod dugmadi: zašto Sačuvaj nije dostupan.
const hint = computed(() => {
  if (saving.value) return "";
  if (!dirty.value && !isNew.value) return "Nema izmjena.";
  if (valid.value) return "";
  return Object.keys(shown.value).length > 0 ? "Provjeri polja iznad." : firstError.value;
});

const saveLabel = computed(() => (saving.value ? "Čuvam…" : isNew.value ? "Dodaj pravilo" : "Sačuvaj"));

// --- Uslov ------------------------------------------------------------------------------------------

const TYPE_OPTIONS: ChoiceOption[] = [
  { value: "zone", label: "Zona", hint: "Po dijelu grada." },
  { value: "surcharge", label: "Doplata", hint: "Dok je doplata na snazi." },
  { value: "distance", label: "Udaljenost", hint: "Od ili do kilometara." },
];
const DEFAULT_OPTION: ChoiceOption = { value: "default", label: "Sve ostalo", hint: "Kad se ništa ne poklopi." };
const TYPES: readonly VehicleRuleConditionType[] = ["zone", "surcharge", "distance", "default"];

// "Sve ostalo" se nudi samo dok zadanog pravila nema (jedno je dovoljno); pravilo koje je već zadano, a nije
// "to" zadano pravilo, ga zadržava da stanje ostane vidljivo.
const startedDefault = original.value.type === "default";
const typeOptions = computed(() =>
  !props.ws.rules.hasFallback || startedDefault ? [...TYPE_OPTIONS, DEFAULT_OPTION] : TYPE_OPTIONS
);

const defaultText = computed(() =>
  isNew.value
    ? "Važi kad se nijedno drugo pravilo ne poklopi. Počni od njega."
    : isFallback.value
      ? "Važi kad se nijedno pravilo iznad ne poklopi. Uvijek je posljednje i ne briše se."
      : "Važi kad se nijedno pravilo iznad ne poklopi."
);

const onType = (value: string | number) => {
  const next = TYPES.find((t) => t === value);
  if (!next) return;
  draft.type = next;
  untouch("zone");
  untouch("sur");
  untouch("dist");
};

const zoneOptions = computed(() =>
  props.ws.zones.list.map((z) => ({ id: z.id, text: `${z.name} (teren ${formatTerrain(z.terrainFactor)})` }))
);
// Izabrana zona ili doplata koje više nisu u listi ostaju vidljive, da dispečer zna šta je snimljeno.
const zoneMissing = computed(
  () => draft.zone !== null && !props.ws.zones.list.some((z) => z.id === draft.zone)
);
const surMissing = computed(
  () => draft.sur !== null && !props.ws.surcharges.list.some((s) => s.id === draft.sur)
);

const dupAt = computed(() => props.ws.rules.duplicateOf(draft, props.ruleId));

// --- Vozila -----------------------------------------------------------------------------------------

const vehView = (v: string) => ruleVehicleView(v);
const hasVeh = (v: VehicleRuleVehicle) => draft.veh.includes(v);

const addVeh = async (key: VehicleRuleVehicle) => {
  if (hasVeh(key)) return;
  draft.veh.push(key);
  touch("veh");
  await nextTick();
  // Dugme koje je upravo onemogućeno gubi fokus: ide na sljedeći slobodan čip, a kad ih nema na uklanjanje.
  const chips = Array.from(vehBox.value?.querySelectorAll<HTMLButtonElement>("button[data-veh-add]") ?? []);
  const from = chips.findIndex((c) => c.dataset.vehAdd === key);
  const order = [...chips.slice(from + 1), ...chips.slice(0, Math.max(from, 0))];
  const next = order.find((c) => !c.disabled);
  (next ?? vehList.value?.querySelector<HTMLElement>("[data-veh-remove]"))?.focus({ preventScroll: true });
};

const removeVeh = async (index: number) => {
  const removed = draft.veh[index];
  if (removed === undefined) return;
  draft.veh.splice(index, 1);
  touch("veh");
  await nextTick();
  const buttons = vehList.value?.querySelectorAll<HTMLElement>("[data-veh-remove]");
  const near = buttons ? buttons[Math.min(index, buttons.length - 1)] : undefined;
  (near ?? vehBox.value?.querySelector<HTMLElement>(`[data-veh-add="${removed}"]`))?.focus({ preventScroll: true });
};

// --- Snimanje i zatvaranje --------------------------------------------------------------------------

const focusField = (name: string) => {
  const box = props.inline ? title.value?.closest("section") : null;
  const scope: ParentNode = box ?? document;
  scope.querySelector<HTMLElement>(`[data-field="${name}"]`)?.focus({ preventScroll: false });
};

const handle = shallowRef<SheetHandle | null>({
  // Panel: javlja stranici da ga zatvori; list: AppSheet se zatvara bez pitanja i javlja `update:open`.
  closeNow: () => {
    if (props.inline) emit("close");
    else sheet.value?.closeNow();
  },
  focusField: (name) => (props.inline ? focusField(name) : sheet.value?.focusField(name)),
});

const firstBad = (): string | null => {
  const key = FIELD_ORDER.find((k) => errors.value[k]);
  return key ? FIELD_NAME[key] : null;
};

let savedId: number | null = null;

const submit = useSheetSave({
  sheet: handle,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => canSave.value,
  firstBad,
  // Obavijest (i upozorenje) pravi radni prostor; ovdje se vraća samo ishod, da se ne duplira.
  run: async (): Promise<ActionResult> => {
    const result = await props.ws.actions.saveRule(props.ruleId, draft);
    if (!result.ok) return result;
    savedId = result.id ?? props.ruleId;
    return result.id === undefined ? { ok: true } : { ok: true, id: result.id };
  },
  success: null,
  onDone: () => emit("saved", savedId),
});

const onFormSubmit = (event?: Event) => {
  event?.preventDefault();
  void submit();
};

// "Otkaži" je svjesno odbacivanje: zatvara bez pitanja.
const cancel = () => {
  if (saving.value) return;
  if (props.inline) emit("close");
  else sheet.value?.closeNow();
};

// Server je odbio izmjenu: fokus ide na prvo polje sa porukom, a bez polja poruka se dovodi u vidokrug.
watch(
  () => [error.value, placed.value] as const,
  async () => {
    if (!hasError.value && Object.keys(placed.value.inline).length === 0) return;
    await nextTick();
    const key = FIELD_ORDER.find((k) => placed.value.inline[k]);
    if (key) handle.value?.focusField(FIELD_NAME[key]);
    else errBox.value?.scrollIntoView({ block: "nearest" });
  }
);

watch(
  dirty,
  (value) => emit("dirty", value),
  { immediate: true }
);

// --- Ljuska -----------------------------------------------------------------------------------------

const Shell = computed<Component>(() => (props.inline ? (InlineShell as Component) : AppSheet));

const shellAttrs = computed<Record<string, unknown>>(() =>
  props.inline
    ? {
        class: ["re", "re--inline", isNew.value ? "is-new" : "is-row"],
        "aria-labelledby": titleId,
        "data-pricing": "rule-editor",
        onSubmit: onFormSubmit,
      }
    : {
        open: open.value,
        title: meta.value.title,
        subtitle: meta.value.sub,
        dirty: dirty.value,
        "onUpdate:open": (value: boolean) => emit("update:open", value),
        onSubmit: onFormSubmit,
      }
);

defineExpose({
  focusTitle: () => title.value?.focus(),
  isDirty: () => dirty.value,
});
</script>

<style scoped>
.re--inline {
  min-width: 0;
  color: #0b1220;
}

/* Novo pravilo je samostalna kartica iznad liste; postojeće je uvučeno ispod svog reda. */
.re--inline.is-new {
  padding: 20px 22px 0;
}

.re--inline.is-row {
  padding: 16px 22px 0 80px;
  border-top: 1px solid #eceef2;
  background: #fbfcfd;
}

.re-h h3 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 800;
  line-height: 1.25;
}

.re-h h3:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 3px;
  border-radius: 6px;
}

.re-h p {
  margin: 2px 0 0;
  font-size: 0.84rem;
  color: #5b6676;
}

.re-body {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.re--inline .re-body {
  margin-top: 14px;
}

.re-f {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.re-fl {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.re-fl i {
  font-style: normal;
  font-weight: 600;
  color: #657083;
}

.re-loose {
  display: block;
  margin-top: 4px;
}

/* Polja: isti izgled kao SheetField (labela iznad, 52 px, plavi okvir fokusa, crveni uz grešku). */
.re-in {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0 14px;
  border-radius: 14px;
  background: #f5f6f8;
  box-shadow: inset 0 0 0 2px transparent;
  transition: box-shadow 0.15s, background 0.15s;
}

.re-in:focus-within {
  background: #fff;
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.re-in.is-bad {
  background: #fff;
  box-shadow: inset 0 0 0 2px #e5484d;
}

.re-in input,
.re-in select {
  flex: 1;
  min-width: 0;
  width: 100%;
  height: 50px;
  padding: 0;
  border: 0;
  outline: 0;
  background: none;
  color: #0b1220;
  font: inherit;
  font-size: 1.02rem;
  font-weight: 600;
}

.re-sel {
  position: relative;
  padding-right: 8px;
}

.re-in select {
  appearance: none;
  padding-right: 32px;
  cursor: pointer;
  text-overflow: ellipsis;
}

.re-sel-ic {
  position: absolute;
  right: 12px;
  color: #5b6676;
  pointer-events: none;
}

.re-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.re-msg {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #5b6676;
}

.re-msg:empty {
  display: none;
}

.re-msg .v-icon {
  flex: none;
  margin-top: 1px;
}

.re-msg.is-bad {
  color: #b42318;
}

.re-retry {
  min-height: 44px;
}

/* Izbor vozila */
.re-vp {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.re-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.re-chip:hover:not(:disabled) {
  background: #f7f8fa;
}

.re-chip:focus-visible,
.re-vx:focus-visible,
.re-retry:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

/* Već izabrano vozilo: sivo sa kvačicom, ne prozirno (stanje nije samo u jačini boje). */
.re-chip.is-on {
  border-color: #eef1f5;
  background: #eef1f5;
  color: #46505f;
  cursor: default;
}

.re-vo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  background: #f5f6f8;
  list-style: none;
}

.re-vt {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 36px;
  padding: 4px 6px 4px 12px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2459c7;
  font-size: 0.84rem;
  font-weight: 800;
}

/* Dugme za uklanjanje je 32 px, a meta 44 px preko ::after. */
.re-vx {
  position: relative;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-left: 2px;
  border: 0;
  border-radius: 50%;
  background: rgba(11, 18, 32, 0.08);
  color: #2459c7;
  cursor: pointer;
}

.re-vx::after {
  content: "";
  position: absolute;
  inset: -6px;
}

.re-vph {
  font-size: 0.84rem;
  color: #5b6676;
}

/* Podnožje */
.re-foot.is-inline {
  display: grid;
  gap: 8px;
  margin: 18px -22px 0 -80px;
  padding: 12px 22px 16px 80px;
  border-top: 1px solid #eceef2;
}

.re--inline.is-new .re-foot.is-inline {
  margin-left: -22px;
  padding-left: 22px;
}

.re-hint {
  margin: 0;
  font-size: 0.8rem;
  color: #5b6676;
}

.re-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.re-row :deep(.ab) {
  width: auto;
  min-width: 120px;
}

.re-sp {
  flex: 1;
}

.re-row.is-sheet {
  flex-wrap: nowrap;
}

.re-row.is-sheet :deep(.ab) {
  min-width: 0;
}

.re-row.is-sheet :deep(.ab:last-child) {
  flex: 1;
}

/* Brisanje je opasna radnja: crveni tekst na bijelom (6.5 : 1), nikad primarno dugme. */
.re-del.ab {
  color: #b42318;
}

.re-del.ab:disabled {
  color: #5b6676;
}

@media (max-width: 479px) {
  .re-two {
    gap: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .re-in {
    transition: none;
  }
}
</style>
