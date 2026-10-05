<template>
  <AppSheet
    v-if="!inline"
    ref="sheet"
    :open="open"
    :title="meta.title"
    :subtitle="meta.sub"
    :dirty="check.dirty"
    @update:open="emit('update:open', $event)"
    @submit="submit"
  >
    <TintAlert v-if="hasError" tone="bad" role="alert" title="Ne mogu da sačuvam" data-company="error">
      {{ error }}
      <span v-for="text in placed.loose" :key="text" class="se-loose">{{ text }}</span>
    </TintAlert>
    <SettingFields v-bind="fieldProps" @edited="onEdited" @touch="touch" />

    <template #footer>
      <AppButton submit :disabled="!check.dirty || !check.valid" :loading="saving">
        {{ saving ? "Čuvam…" : "Sačuvaj" }}
      </AppButton>
      <p>{{ footHint }}</p>
    </template>
  </AppSheet>

  <section v-else ref="root" class="se" :aria-labelledby="titleId" data-company="editor">
    <header class="se-h">
      <div class="se-ht">
        <h2 :id="titleId" ref="title" tabindex="-1">{{ meta.title }}</h2>
        <p>{{ meta.sub }}</p>
      </div>
      <button type="button" class="se-x" data-company="editor-close" aria-label="Zatvori" @click="emit('close')">
        <v-icon icon="mdi-close" size="20" />
      </button>
    </header>

    <form class="se-form" novalidate @submit.prevent="submit">
      <div class="se-body">
        <div v-if="asking" class="se-guard" data-company="guard">
          <TintAlert tone="warn" role="alert" title="Imaš nesačuvane izmjene">
            Ako zatvoriš, izmjene se gube.
          </TintAlert>
          <div class="se-guard-r">
            <AppButton variant="ghost" data-discard="keep" @click="emit('keep')">Nastavi uređivanje</AppButton>
            <AppButton variant="ghost" data-discard="drop" @click="emit('discard')">Odbaci izmjene</AppButton>
          </div>
        </div>
        <TintAlert v-if="hasError" tone="bad" role="alert" title="Ne mogu da sačuvam" data-company="error">
          {{ error }}
          <span v-for="text in placed.loose" :key="text" class="se-loose">{{ text }}</span>
        </TintAlert>
        <SettingFields v-bind="fieldProps" @edited="onEdited" @touch="touch" />
      </div>
      <div class="se-foot">
        <p>{{ footHint }}</p>
        <AppButton submit :disabled="!check.dirty || !check.valid" :loading="saving">
          {{ saving ? "Čuvam…" : "Sačuvaj" }}
        </AppButton>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import SettingFields from "~/components/company/settings/SettingFields.vue";
import { registerSheetGuard } from "~/composables/useSheetGuard";
import { useSheetDraft } from "~/composables/useSheetDraft";
import { useSheetSave } from "~/composables/useSheetSave";
import type { ActionResult } from "~/composables/useCourierRoster";
import {
  DRAFT_KEYS,
  SETTING_META,
  checkSetting,
  makeDraft,
  placeServerMessages,
  toPatch,
  type DraftKey,
  type SettingKind,
} from "~/utils/companySettings";
import type { FieldMsg } from "~/utils/profileForm";
import type { CourierBalance } from "~/types/courier-balance";
import type { FinanceSettings, FinanceSettingsUpdate } from "~/types/finance-settings";

// Editor jedne postavke firme. Isti sadržaj, dvije ljuske: panel pored liste na računaru
// (`inline`, ostaje otvoren i poslije snimanja) i donji list na telefonu (AppSheet: pita za
// nesačuvano, zatvara se poslije snimanja). Čuvanje je po postavci: Sačuvaj je uz polje, onemogućen
// dok nema izmjene ili dok je neko polje nevažeće. Greška servera stoji uz polje (errors.polje) i
// u toniranom bloku na vrhu; uneseno ostaje u formi.
const props = defineProps<{
  kind: SettingKind;
  saved: FinanceSettings;
  inline: boolean;
  // Donji list: otvoren je li.
  open?: boolean;
  // Panel: stoji li pitanje "Imaš nesačuvane izmjene" (pokreće ga stranica pri promjeni reda/taba).
  asking?: boolean;
  currency: string;
  balances: CourierBalance[] | null;
  balancesState: "loading" | "ready" | "failed";
  restaurantsOther: number | null;
  restaurantsTotal: number | null;
  save: (patch: Partial<FinanceSettingsUpdate>) => Promise<ActionResult>;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  // Panel: X.
  close: [];
  // Panel: pitanje o nesačuvanom (odgovori) i odlazak sa stranice dok ima unosa.
  keep: [];
  discard: [];
  ask: [];
  dirty: [value: boolean];
  // Izmjena je sačuvana (stranica označi red).
  saved: [kind: SettingKind];
}>();

type SheetHandle = { closeNow: () => void; focusField: (name: string) => void };

const titleId = `se-${useId()}`;
const root = ref<HTMLElement | null>(null);
const title = ref<HTMLElement | null>(null);
const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

const meta = computed(() => SETTING_META[props.kind]);

const open = computed(() => props.inline || Boolean(props.open));
const { draft, show, touch, untouch, submitted, saving, error, serverFields, reset, edited } =
  useSheetDraft(open, () => makeDraft(props.saved));

const check = computed(() => checkSetting(props.kind, draft, props.saved, show));
const placed = computed(() => placeServerMessages(serverFields.value, draft));

// Poruka uz polje: provjera ispred servera, jer je nevažeći unos očigledna greška.
const messages = computed(() => {
  const out: Partial<Record<DraftKey, FieldMsg>> = {};
  for (const [key, text] of Object.entries(placed.value.inline)) {
    out[key as DraftKey] = { tone: "bad", text };
  }
  return { ...out, ...check.value.fields };
});

const hasError = computed(() => Boolean(error.value) || placed.value.loose.length > 0);

const footHint = computed(() =>
  !check.value.dirty ? "Nema izmjena." : !check.value.valid ? "Provjeri polja iznad." : ""
);

const fieldProps = computed(() => ({
  kind: props.kind,
  draft,
  saved: props.saved,
  messages: messages.value,
  currency: props.currency,
  balances: props.balances,
  balancesState: props.balancesState,
  restaurantsOther: props.restaurantsOther,
  restaurantsTotal: props.restaurantsTotal,
}));

// Kuca se: ono što je server rekao o prethodnom pokušaju više ne važi, a nepotpun unos ne smije
// odmah biti greška (vraća se tek kad se polje napusti).
const onEdited = (key: DraftKey) => {
  untouch(key);
  edited();
};

const focusField = (name: string) =>
  root.value?.querySelector<HTMLElement>(`[data-field="${name}"]`)?.focus({ preventScroll: true });

const handle = shallowRef<SheetHandle | null>({
  // Panel: ostaje otvoren i vraća se na sačuvano stanje (nacrt je tada jednak sačuvanom).
  closeNow: () => {
    if (props.inline) {
      void nextTick().then(() => {
        reset();
        emit("saved", props.kind);
      });
    } else {
      sheet.value?.closeNow();
      emit("saved", props.kind);
    }
  },
  focusField: (name) => (props.inline ? focusField(name) : sheet.value?.focusField(name)),
});

const firstBad = (): string | null =>
  DRAFT_KEYS[props.kind].find((key) => check.value.fields[key]?.tone === "bad") ?? null;

const submit = useSheetSave({
  sheet: handle,
  saving,
  submitted,
  error,
  serverFields,
  ready: () => check.value.valid && check.value.dirty,
  firstBad,
  run: () => props.save(toPatch(props.kind, draft)),
  success: "Postavka je sačuvana.",
});

// Server je odbio izmjenu: poruka stoji na vrhu editora i dovodi se u vidokrug (lista može biti skrolovana do dna).
watch(hasError, (value) => {
  if (!value) return;
  void nextTick(() =>
    document.querySelector<HTMLElement>('[data-company="error"]')?.scrollIntoView({ block: "nearest" })
  );
});

// Stranica zna je li ovdje nesačuvanog unosa (pitanje pri promjeni reda, taba, firme).
watch(
  () => check.value.dirty,
  (value) => emit("dirty", value),
  { immediate: true }
);

// Pitanje se pokazalo: fokus na "Nastavi uređivanje" (sigurniji izbor).
watch(
  () => props.asking,
  (value) => {
    if (!value || !props.inline) return;
    void nextTick(() =>
      root.value?.querySelector<HTMLElement>('[data-discard="keep"]')?.focus({ preventScroll: true })
    );
  }
);

// Panel: odlazak sa stranice (dugme Nazad) dok ima unosa pita isto kao donji list.
let unregister: (() => void) | null = null;
onMounted(() => {
  if (props.inline) {
    unregister = registerSheetGuard({ dirty: () => check.value.dirty, ask: () => emit("ask") });
  }
});
onBeforeUnmount(() => unregister?.());

defineExpose({
  focusTitle: () => title.value?.focus({ preventScroll: true }),
  isDirty: () => check.value.dirty,
});
</script>

<style scoped>
.se {
  min-width: 0;
  padding: 20px 22px 0;
  color: #0b1220;
}

.se-h {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.se-ht {
  min-width: 0;
}

.se-ht h2 {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.se-ht h2:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 3px;
  border-radius: 6px;
}

.se-ht p {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: #5b6676;
}

.se-x {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px -8px 0 0;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.se-x:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.se-form {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.se-body {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.se-guard {
  display: grid;
  gap: 10px;
}

.se-guard-r {
  display: flex;
  gap: 8px;
}

.se-guard-r :deep(.ab) {
  flex: 1;
}

.se-loose {
  display: block;
  margin-top: 4px;
}

/* Podnožje ostaje na dnu panela dok se forma skroluje; bijelo, da tekst ispod ne prosijava. */
.se-foot {
  position: sticky;
  bottom: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 18px -22px 0;
  padding: 12px 22px 16px;
  border-top: 1px solid #e7e9ee;
  background: #fff;
}

.se-foot p {
  margin: 0;
  font-size: 0.8rem;
  color: #5b6676;
}

.se-foot :deep(.ab) {
  width: auto;
  min-width: 200px;
}
</style>
