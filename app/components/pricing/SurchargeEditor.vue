<template>
  <!-- Isti sadržaj, dvije ljuske: računar je forma u listi (u redu koji se mijenja ili kartica iznad liste za novu),
       telefon je donji list. Ljuska je dinamična da se polja ne pišu dva puta; podnožje lista ide u slot,
       a u formi je običan blok na dnu. -->
  <component :is="shell" ref="shellRef" v-bind="shellProps">
    <header v-if="inline" class="se-h">
      <h3 :id="titleId" ref="titleRef" tabindex="-1">{{ title }}</h3>
    </header>

    <div class="se-fields">
      <TintAlert
        v-if="hasError"
        tone="bad"
        role="alert"
        title="Ne mogu da sačuvam"
        data-pricing="surcharge-error"
      >
        {{ error }}
        <span v-for="text in placed.loose" :key="text" class="se-loose">{{ text }}</span>
      </TintAlert>

      <SheetField
        v-model="draft.name"
        name="name"
        label="Naziv"
        enterkeyhint="next"
        :message="bad(msg('name'))"
        @update:model-value="onEdited('name')"
        @blur="touch('name')"
      />

      <div class="se-f">
        <span class="se-fl">Kako se obračunava</span>
        <ChoiceGroup
          data-field="type"
          data-choice="type"
          :model-value="draft.type"
          :options="TYPE_OPTIONS"
          label="Kako se obračunava"
          variant="pills"
          @update:model-value="pickType"
        />
      </div>

      <!-- Napomena nema iznos. Jedinica prati tip i valutu firme, pa se ne bira. -->
      <MoneyField
        v-if="draft.type !== 'note'"
        v-model="draft.val"
        name="val"
        label="Iznos"
        :unit="unit"
        :steppers="false"
        :error="msg('val')"
        hint="Jedinica prati tip i valutu firme."
        @update:model-value="onEdited('val')"
        @blur="touch('val')"
      />

      <SheetField
        v-model="draft.desc"
        name="desc"
        label="Opis"
        optional
        :message="descMessage"
        @update:model-value="onEdited('desc')"
      />

      <div class="se-f">
        <span class="se-fl">Kad važi</span>
        <ChoiceGroup
          data-field="sched"
          data-choice="sched"
          :model-value="draft.sched"
          :options="SCHED_OPTIONS"
          label="Kad važi"
          variant="pills"
          @update:model-value="pickSched"
        />
      </div>

      <template v-if="draft.sched === 'auto'">
        <div class="se-two">
          <SheetField
            v-model="draft.from"
            name="from"
            label="Od"
            type="time"
            :message="bad(timeOwner === 'from' ? msg('time') : undefined)"
            @update:model-value="onEdited('time')"
            @blur="touch('time')"
          />
          <SheetField
            v-model="draft.to"
            name="to"
            label="Do"
            type="time"
            :message="bad(timeOwner === 'to' ? msg('time') : undefined)"
            @update:model-value="onEdited('time')"
            @blur="touch('time')"
          />
        </div>
        <p v-if="!msg('time')" class="se-note">Server je uključuje i isključuje u zadanom vremenu.</p>
      </template>

      <SettingSwitch
        v-if="isNew"
        v-model="draft.on"
        name="on"
        label="Odmah uključi"
        hint="Kad je uključena, kupci odmah plaćaju ovu doplatu."
      />

      <!-- Uticaj na primjer: šta ova doplata znači za udaljenost izabranu u Primjeru narudžbe. -->
      <TintAlert v-if="impact?.kind === 'note'" tone="info" data-pricing="surcharge-impact">
        {{ SURCHARGE_NOTE_IMPACT }}
      </TintAlert>
      <div v-else-if="impact" class="se-imp" data-pricing="surcharge-impact">
        <v-icon icon="mdi-information-outline" size="18" />
        <span>{{ impact.text }}</span>
      </div>
    </div>

    <div v-if="inline" class="se-foot">
      <AppButton
        v-if="surcharge"
        variant="ghost"
        icon="mdi-delete-outline"
        data-pricing="surcharge-delete"
        :disabled="saving"
        @click="emit('delete')"
      >
        Obriši
      </AppButton>
      <p class="se-hint">{{ footHint }}</p>
      <AppButton variant="ghost" data-pricing="surcharge-cancel" :disabled="saving" @click="cancel">
        Otkaži
      </AppButton>
      <AppButton submit data-pricing="surcharge-save" :disabled="!ready" :loading="saving">
        {{ saving ? "Čuvam…" : saveLabel }}
      </AppButton>
    </div>

    <template v-if="!inline" #footer>
      <AppButton submit data-pricing="surcharge-save" :disabled="!ready" :loading="saving">
        {{ saving ? "Čuvam…" : saveLabel }}
      </AppButton>
      <div class="se-sec">
        <AppButton variant="ghost" data-pricing="surcharge-cancel" :disabled="saving" @click="cancel">
          Otkaži
        </AppButton>
        <AppButton
          v-if="surcharge"
          variant="ghost"
          icon="mdi-delete-outline"
          data-pricing="surcharge-delete"
          :disabled="saving"
          @click="emit('delete')"
        >
          Obriši
        </AppButton>
      </div>
      <p>{{ footHint }}</p>
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import MoneyField from "~/components/common/MoneyField.vue";
import SettingSwitch from "~/components/common/SettingSwitch.vue";
import SheetField from "~/components/common/SheetField.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ConditionTag, Surcharge, SurchargePreset } from "~/types/pricing";
import { surchargeUnit } from "~/utils/pricing";
import {
  SURCHARGE_NOTE_IMPACT,
  makeSurchargeDraft,
  placeServerMessages,
  surchargeDirty,
  surchargeErrors,
  surchargeImpact,
  type SurchargeErrors,
} from "~/utils/pricingDrafts";
import type { FieldMsg } from "~/utils/profileForm";

// Editor doplate (nova ili postojeća). Računar: forma u listi koja ostaje otvorena dok dispečer ne sačuva ili
// otkaže. Telefon: donji list (AppSheet pita za nesačuvano pri zatvaranju). Čuvanje ide kroz
// ws.actions.saveSurcharge; poruke servera stoje uz polje (placeServerMessages) i u bloku "Ne mogu da sačuvam", a
// unos ostaje u formi. Greška polja se pokazuje tek kad je polje dodirnuto (useSheetDraft), da ne vrišti dok se kuca.
// Obavijest o uspjehu pravi radni prostor, pa je ovdje nema (a ni dvostrukog upozorenja B2).
const props = withDefaults(
  defineProps<{
    ws: PricingWorkspace;
    // Doplata koja se mijenja; null je nova.
    surcharge: Surcharge | null;
    // Nova doplata popunjena iz kataloga (tag ili preset).
    preset?: ConditionTag | SurchargePreset | null;
    inline: boolean;
    // Donji list: otvoren je li.
    open?: boolean;
    // Donji list: sakriven dok je otvorena potvrda brisanja (nacrt ostaje, pa se Otkaži u potvrdi vraća na njega).
    suspended?: boolean;
  }>(),
  { preset: null, open: false, suspended: false }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  // Otkaži (računar i telefon).
  close: [];
  // Sačuvano: id doplate (nove ili izmijenjene), za fokus i isticanje.
  saved: [id: number | null];
  // Dugme Obriši (potvrdu pokazuje tab).
  delete: [];
  dirty: [value: boolean];
}>();

type SheetHandle = { closeNow: () => void; focusField: (name: string) => void };
type FormKey = "name" | "val" | "time";

const TYPE_OPTIONS: ChoiceOption[] = [
  { value: "per_km", label: "Po kilometru" },
  { value: "fixed", label: "Fiksno" },
  { value: "note", label: "Napomena" },
];
const SCHED_OPTIONS: ChoiceOption[] = [
  { value: "manual", label: "Ručno" },
  { value: "auto", label: "Po vremenu" },
];

const titleId = `se-${useId()}`;
const shellRef = ref<HTMLElement | InstanceType<typeof AppSheet> | null>(null);
const titleRef = ref<HTMLElement | null>(null);

const isNew = computed(() => props.surcharge === null);
const selfId = computed(() => props.surcharge?.id ?? null);
const title = computed(() => (isNew.value ? "Nova doplata" : "Uredi doplatu"));
const saveLabel = computed(() => (isNew.value ? "Dodaj doplatu" : "Sačuvaj"));
const currency = computed(() => props.ws.company.currency);

const source = (): Surcharge | ConditionTag | SurchargePreset | null => props.surcharge ?? props.preset;

const formOpen = computed(() => props.inline || props.open);
const { draft, show, touch, untouch, submitted, saving, error, serverFields, edited } = useSheetDraft(
  formOpen,
  () => makeSurchargeDraft(source())
);

// Početno stanje nacrta: "izmjena" je razlika spram njega, pa katalogom popunjen naziv sam nije izmjena. Ne prati
// red u listi: prekidač u redu dok je editor otvoren ne smije napraviti izmjenu.
const original = shallowRef(makeSurchargeDraft(source()));
watch(
  formOpen,
  (isOpen) => {
    if (isOpen) original.value = makeSurchargeDraft(source());
  },
  { immediate: true }
);

const errors = computed<SurchargeErrors>(() => surchargeErrors(draft, props.ws.surcharges.list, selfId.value));
const valid = computed(() => Object.keys(errors.value).length === 0);
const dirty = computed(() => surchargeDirty(draft, original.value));
// Nova doplata se može dodati i bez izmjene spram kataloga; postojeća tek kad nešto promijeni.
const ready = computed(() => valid.value && (isNew.value || dirty.value));

const placed = computed(() => placeServerMessages("surcharge", serverFields.value));
const hasError = computed(() => Boolean(error.value) || placed.value.loose.length > 0);

// Poruka uz polje: provjera ispred servera (nevažeći unos je očigledna greška), ali samo za dotaknuto polje.
const msg = (key: FormKey): string | undefined => {
  const own = show(key) ? errors.value[key] : undefined;
  return own ?? placed.value.inline[key];
};
const bad = (text: string | undefined): FieldMsg | null => (text ? { tone: "bad", text } : null);

const descMessage = computed<FieldMsg>(
  () => bad(placed.value.inline.desc) ?? { tone: "hint", text: "Vidi ga dispečer, kupac ne." }
);

// Greška vremena stoji uz polje koje treba popraviti (prazno, pa "Do"), da se tekst ne ponavlja uz oba.
const timeOwner = computed<"from" | "to">(() => (draft.from ? "to" : "from"));

const unit = computed(() => surchargeUnit(draft.type, currency.value));
const impact = computed(() => surchargeImpact(draft, props.ws.sim.dist, currency.value));

const FIELD_LABEL: Record<keyof SurchargeErrors, string> = { name: "naziv", val: "iznos", time: "vrijeme" };

const footHint = computed(() => {
  if (!isNew.value && !dirty.value) return "Nema izmjena.";
  const keys = Object.keys(errors.value) as (keyof SurchargeErrors)[];
  return keys.length > 0 ? `Provjeri: ${keys.map((k) => FIELD_LABEL[k]).join(", ")}.` : "";
});

// Kuca se: ono što je server rekao o prethodnom pokušaju više ne važi, a nepotpun unos ne smije odmah biti
// greška (vraća se tek kad se polje napusti).
const onEdited = (key: FormKey | "desc") => {
  if (key !== "desc") untouch(key);
  edited();
};

const pickType = (value: string | number) => {
  if (value !== "per_km" && value !== "fixed" && value !== "note") return;
  draft.type = value;
  edited();
};

const pickSched = (value: string | number) => {
  if (value !== "manual" && value !== "auto") return;
  draft.sched = value;
  edited();
};

// --- Ljuska --------------------------------------------------------------------------------------

const shell = computed(() => (props.inline ? "form" : AppSheet));

const sheetOpen = computed(() => props.open && !props.suspended);

const onSubmit = (event?: Event) => {
  event?.preventDefault();
  void submit();
};

const shellProps = computed(() =>
  props.inline
    ? {
        class: ["se", isNew.value ? "se--new" : "se--row"],
        novalidate: true,
        "aria-labelledby": titleId,
        "data-pricing": "surcharge-editor",
        onSubmit,
      }
    : {
        open: sheetOpen.value,
        title: title.value,
        subtitle: props.surcharge?.name,
        dirty: dirty.value,
        "data-pricing": "surcharge-editor",
        "onUpdate:open": (value: boolean) => emit("update:open", value),
        onSubmit,
      }
);

const sheetHandle = (): SheetHandle | null =>
  shellRef.value && !(shellRef.value instanceof HTMLElement) ? (shellRef.value as unknown as SheetHandle) : null;

const focusField = (name: string) => {
  if (props.inline) {
    const root = shellRef.value instanceof HTMLElement ? shellRef.value : null;
    root?.querySelector<HTMLElement>(`[data-field="${name}"]`)?.focus({ preventScroll: true });
  } else {
    sheetHandle()?.focusField(name);
  }
};

// Poslije uspjeha tab zatvara editor (saved); list se zatvara i sam, kao u Firmi.
const handle = shallowRef<SheetHandle | null>({
  closeNow: () => sheetHandle()?.closeNow(),
  focusField,
});

// Otkaži je svjesno odbacivanje: zatvara bez pitanja (pitanje je za X, pozadinu i Esc na telefonu).
const cancel = () => {
  const sheet = sheetHandle();
  if (sheet) sheet.closeNow();
  else emit("close");
};

const firstBad = (): string | null => {
  if (errors.value.name) return "name";
  if (errors.value.val) return "val";
  if (errors.value.time) return timeOwner.value;
  return null;
};

// Upozorenje B2 ("Server nije primio sve izmjene") već pokazuje radni prostor; useSheetSave bi ga pokazao
// drugi put, pa mu se rezultat daje bez njega.
const submit = useSheetSave({
  sheet: handle,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => ready.value,
  firstBad,
  run: async () => {
    const result = await props.ws.actions.saveSurcharge(selfId.value, { ...draft });
    return result.ok ? { ok: true as const, id: result.id } : result;
  },
  success: null,
  onDone: (result) => emit("saved", result.id ?? selfId.value),
});

// Server je odbio izmjenu: poruka stoji na vrhu editora i dovodi se u vidokrug (lista može biti skrolovana).
watch(hasError, (value) => {
  if (!value) return;
  void nextTick(() =>
    document.querySelector<HTMLElement>('[data-pricing="surcharge-error"]')?.scrollIntoView({ block: "nearest" })
  );
});

// Tab zna ima li ovdje nesačuvanog unosa (pitanje pri promjeni reda, taba, firme; tačka na tabu).
watch(dirty, (value) => emit("dirty", value), { immediate: true });
onBeforeUnmount(() => emit("dirty", false));

// Forma u listi dobija fokus čim se otvori: nova na naziv (počinje se kucanjem), postojeća na naslov. Donji list
// fokus postavlja sam (AppSheet).
onMounted(() => {
  if (!props.inline) return;
  void nextTick(() => {
    if (isNew.value) focusField("name");
    else titleRef.value?.focus({ preventScroll: true });
    if (shellRef.value instanceof HTMLElement) shellRef.value.scrollIntoView({ block: "nearest" });
  });
});

defineExpose({ isDirty: () => dirty.value, focusField });
</script>

<style scoped>
.se {
  display: grid;
  gap: 14px;
  min-width: 0;
  color: #0b1220;
}

/* Postojeća doplata: forma ispod reda, uvučena do teksta reda. */
.se--row {
  position: relative;
  padding: 4px 22px 20px 66px;
  background: #fbfcfd;
}

.se--row::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  left: 66px;
  height: 1px;
  background: #eceef2;
}

/* Nova doplata: kartica iznad liste. */
.se--new {
  padding: 20px 22px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.se-h h3 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 800;
  line-height: 1.3;
}

.se-h h3:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 3px;
  border-radius: 6px;
}

/* Kontejner određuje kad se Od/Do slažu jedno ispod drugog: zavisi od širine forme, ne prozora. */
.se-fields {
  display: grid;
  gap: 16px;
  min-width: 0;
  container: sefields / inline-size;
}

.se-f {
  display: grid;
  gap: 8px;
}

.se-fl {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0b1220;
}

.se-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@container sefields (max-width: 339px) {
  .se-two {
    grid-template-columns: minmax(0, 1fr);
  }
}

.se-note {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.4;
  color: #5b6676;
}

.se-loose {
  display: block;
  margin-top: 4px;
}

.se-imp {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f1f3f6;
  color: #2c3645;
  font-size: 0.84rem;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

.se-imp :deep(.v-icon) {
  flex: none;
  margin-top: 1px;
  color: #46505f;
}

/* Podnožje u listi: Obriši lijevo, Otkaži i Sačuvaj desno, uputa u sredini. */
.se-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.se-foot :deep(.ab) {
  width: auto;
  min-height: 48px;
  padding: 0 18px;
  font-size: 0.92rem;
}

.se-hint {
  flex: 1 1 140px;
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #5b6676;
}

/* Podnožje donjeg lista: Otkaži i Obriši jedno uz drugo ispod glavnog dugmeta. */
.se-sec {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}
</style>
