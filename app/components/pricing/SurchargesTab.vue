<template>
  <div ref="root" class="st" tabindex="-1" data-pricing="surcharges-tab">
    <!-- Učitavanje: skeleton oblika liste, ne tekst. -->
    <div
      v-if="loading"
      class="st-card"
      role="status"
      aria-busy="true"
      aria-label="Učitavam doplate"
      data-pricing="surcharges-loading"
    >
      <div v-for="n in 4" :key="n" class="st-sk-row" aria-hidden="true">
        <i class="sk" style="width: 44px; height: 44px; border-radius: 14px" />
        <span class="st-sk-l">
          <i class="sk" style="width: 58%; height: 14px" />
          <i class="sk" style="width: 36%; height: 11px" />
        </span>
        <i class="sk" style="width: 52px; height: 28px" />
      </div>
    </div>

    <!-- Pad učitavanja: poruka u mjestu liste, ništa nije izgubljeno. -->
    <section v-else-if="failed" class="st-card st-empty" role="alert" data-pricing="surcharges-error">
      <span class="st-tile is-bad"><v-icon icon="mdi-cloud-off-outline" size="30" /></span>
      <h2>Ne mogu da učitam doplate</h2>
      <p>{{ ws.surcharges.loadReason || "Server ne odgovara." }} Ništa nije izgubljeno.</p>
      <AppButton variant="ghost" icon="mdi-refresh" class="st-retry" data-pricing="retry" @click="onRetry">
        Pokušaj ponovo
      </AppButton>
    </section>

    <template v-else>
      <div class="st-head">
        <div class="st-head-t">
          <h2 :id="titleId">Doplate</h2>
          <p>{{ subtitle }}</p>
        </div>
        <button type="button" class="st-new" data-pricing="surcharge-new" @click="openEditor(null)">
          <v-icon icon="mdi-plus" size="18" />
          Nova doplata
        </button>
      </div>

      <!-- Katalog nudi samo ono što još nije dodano. -->
      <div v-if="ws.surcharges.catalog.length > 0" class="st-qa" role="group" aria-label="Brzo dodavanje iz kataloga">
        <span class="st-qa-l">Iz kataloga:</span>
        <button
          v-for="item in ws.surcharges.catalog"
          :key="item.key"
          type="button"
          class="st-chip"
          :data-catalog="item.key"
          :aria-label="`Nova doplata iz kataloga: ${item.name}`"
          @click="openEditor(null, item.original)"
        >
          <i aria-hidden="true" />{{ item.name }}
        </button>
      </div>

      <!-- Računar: nova doplata je kartica iznad liste. -->
      <SurchargeEditor
        v-if="wide && open && target && target.surcharge === null"
        :key="target.key"
        v-bind="editorBind"
        inline
        @close="onCancel"
        @saved="onSaved"
        @dirty="dirty = $event"
      />

      <section v-if="list.length === 0" class="st-card st-empty" data-pricing="surcharges-empty">
        <span class="st-tile"><v-icon icon="mdi-tune-variant" size="30" /></span>
        <h3>Još nema doplata</h3>
        <p>
          Doplata je dodatak cijeni kad su uslovi teški.
          {{
            ws.surcharges.catalog.length > 0
              ? "Počni od jedne iz kataloga iznad, pa je uključi kad zatreba."
              : "Dodaj prvu dugmetom iznad, pa je uključi kad zatreba."
          }}
        </p>
      </section>

      <ul v-else class="st-card st-list" :aria-labelledby="titleId" data-pricing="surcharge-list">
        <li v-for="s in sorted" :key="s.id" class="st-li">
          <SurchargeRow
            :surcharge="s"
            :currency="currency"
            :now="now"
            :wide="wide"
            :open="isOpen(s.id)"
            :flash="ws.view.flashKey === `s${s.id}`"
            :error="rowErrors[s.id]"
            :busy="ws.surcharges.togglingIds.has(s.id)"
            @open="onOpenRow(s)"
            @toggle="onToggle(s.id)"
          />
          <!-- Računar: izmjena je u redu koji se mijenja. -->
          <SurchargeEditor
            v-if="isOpen(s.id) && target"
            :key="target.key"
            v-bind="editorBind"
            inline
            @close="onCancel"
            @saved="onSaved"
            @delete="askDelete"
            @dirty="dirty = $event"
          />
        </li>
      </ul>
    </template>

    <!-- Telefon: izmjena je donji list. Ostaje montiran poslije zatvaranja da se list ne prekine usred prelaza. -->
    <SurchargeEditor
      v-if="!wide && target"
      :key="target.key"
      v-bind="editorBind"
      :inline="false"
      :open="open"
      :suspended="del.open"
      @update:open="onSheetOpen"
      @close="onCancel"
      @saved="onSaved"
      @delete="askDelete"
      @dirty="dirty = $event"
    />

    <PricingDeleteDialog
      :open="del.open"
      kind="surcharge"
      :name="del.name"
      :active="del.active"
      :dependents="del.dependents"
      :wide="wide"
      :busy="del.busy"
      :error="del.error"
      @update:open="onDeleteOpen"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import PricingDeleteDialog from "~/components/pricing/PricingDeleteDialog.vue";
import SurchargeEditor from "~/components/pricing/SurchargeEditor.vue";
import SurchargeRow from "~/components/pricing/SurchargeRow.vue";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import { useAlertStore } from "~/stores/alert";
import type { ConditionTag, Surcharge, SurchargePreset } from "~/types/pricing";

// Tab Doplate: zaglavlje sa brojem doplata na snazi, katalog ("Iz kataloga:"), lista (uključene prvo) i editor.
// Računar: editor je u redu koji se mijenja (nova doplata: kartica iznad liste). Telefon: donji list. Komponenta ne
// zove mrežu: sve ide kroz ws.actions.*; obavijesti uspjeha pravi radni prostor, a grešku ova komponenta piše uz ono što
// se mijenja (uz red za prekidač, uz polje i u editoru za snimanje, u dijalogu za brisanje).
// Stanja: učitavanje (skeleton), pad učitavanja ("Pokušaj ponovo"), prazno (kaže šta je doplata), nesačuvano (prijavljuje
// se radnom prostoru za tačku na tabu i pitanje pri napuštanju), greška servera uz polje.
const props = defineProps<{ ws: PricingWorkspace }>();

const alertStore = useAlertStore();

const titleId = `st-${useId()}`;
const root = ref<HTMLElement | null>(null);

const wide = computed(() => props.ws.view.wide);
const currency = computed(() => props.ws.company.currency);
const list = computed(() => props.ws.surcharges.list);

// Tek kad lista nije stigla se pokazuje skeleton ili pad; osvježavanje sa učitanom listom ne treperi.
const loading = computed(() => props.ws.surcharges.loading && list.value.length === 0);
const failed = computed(
  () => !loading.value && props.ws.surcharges.loadFailed && list.value.length === 0
);

// Uključene prvo, pa isključene; unutar grupe redoslijed sa servera.
const sorted = computed<Surcharge[]>(() => [
  ...list.value.filter((s) => s.active),
  ...list.value.filter((s) => !s.active),
]);

const subtitle = computed(() =>
  list.value.length > 0
    ? `${props.ws.counts.activeSurcharges} od ${props.ws.counts.surcharges} je na snazi. Uključena doplata odmah ulazi u cijenu za kupca.`
    : "Dodatak cijeni kad su uslovi teški: kiša, gužva, noć."
);

// Sat za "Na snazi 1 h 12 min": minutu je dovoljno osvježavati.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 30000);
});

// --- Editor --------------------------------------------------------------------------------------

// Šta je otvoreno: postojeća doplata (snimak u trenutku otvaranja) ili nova (prazna ili iz kataloga). `key` je novi
// pri svakom otvaranju, pa editor uvijek kreće iz sačuvanog stanja.
type Target = { key: number; surcharge: Surcharge | null; preset: ConditionTag | SurchargePreset | null };

const target = ref<Target | null>(null);
const open = ref(false);
const dirty = ref(false);
let seq = 0;

const editorBind = computed(() => ({
  ws: props.ws,
  surcharge: target.value?.surcharge ?? null,
  preset: target.value?.preset ?? null,
}));

const isOpen = (id: number): boolean =>
  wide.value && open.value && target.value?.surcharge?.id === id;

// Nesačuvano za radni prostor: tačka na tabu, pitanje pri promjeni taba i firme. Prijavljuje se pri svakom
// otvaranju editora, jer "Odbaci izmjene" pri promjeni firme briše sve prijave a tab ostaje; zatvoren editor se odjavljuje.
let unregister: (() => void) | null = null;
const reportDirty = () => {
  unregister?.();
  unregister = props.ws.dirty.registerEditorDirty("surcharge", () => open.value && dirty.value);
};

// Drugi red, nova doplata ili katalog dok je otvorena izmjena sa unosom: unos se ne gubi bez pitanja.
const blocked = (): boolean => {
  if (props.ws.surcharges.saving) return true;
  if (open.value && dirty.value) {
    alertStore.info("Prvo sačuvaj ili otkaži izmjenu koja je otvorena.");
    return true;
  }
  return false;
};

const openEditor = (surcharge: Surcharge | null, preset: ConditionTag | SurchargePreset | null = null) => {
  if (blocked()) return;
  seq += 1;
  dirty.value = false;
  target.value = { key: seq, surcharge: surcharge ? { ...surcharge } : null, preset };
  open.value = true;
  reportDirty();
};

// Red koji je već otvoren se zatvara istim klikom (računar).
const onOpenRow = (s: Surcharge) => {
  if (isOpen(s.id)) {
    if (blocked()) return;
    closeEditor();
    return;
  }
  openEditor(s);
};

// Fokus ide na red koji je mijenjan (ili na "Nova doplata"): element sa kojeg je editor otvoren je nestao ili sakriven.
const focusAfter = (id: number | null | undefined) => {
  void nextTick(() => {
    const row = id == null ? null : root.value?.querySelector<HTMLElement>(`[data-surcharge-open="${id}"]`);
    const fallback = root.value?.querySelector<HTMLElement>('[data-pricing="surcharge-new"]');
    (row ?? fallback)?.focus({ preventScroll: true });
  });
};

// Telefon: list ostaje montiran dok se zatvara (da se animacija ne prekine), pa se tek tada uklanja iz stranice;
// `drop` ga uklanja odmah (doplate više nema ili je druga firma).
const SHEET_CLOSE_MS = 400;
let dropTimer: ReturnType<typeof setTimeout> | null = null;

const closeEditor = (drop = false) => {
  open.value = false;
  dirty.value = false;
  unregister?.();
  unregister = null;
  if (dropTimer) clearTimeout(dropTimer);
  dropTimer = null;
  if (drop) {
    target.value = null;
    return;
  }
  const key = target.value?.key;
  dropTimer = setTimeout(() => {
    if (!open.value && target.value?.key === key) target.value = null;
  }, SHEET_CLOSE_MS);
};

const onCancel = () => {
  const id = target.value?.surcharge?.id;
  closeEditor();
  focusAfter(id);
};

const onSaved = (id: number | null) => {
  closeEditor();
  focusAfter(id);
};

// X, pozadina ili Esc na listu (pitanje o nesačuvanom je već prošlo u AppSheet-u).
const onSheetOpen = (value: boolean) => {
  if (value) return;
  closeEditor();
};

// Druga firma ili doplate nema više (osvježena lista): editor se gasi, ne ostaje nad nečim što ne postoji.
watch(
  () => props.ws.company.id,
  () => closeEditor(true)
);
watch(list, (items) => {
  const current = target.value?.surcharge;
  if (!current || props.ws.surcharges.loading || props.ws.surcharges.saving) return;
  if (!items.some((s) => s.id === current.id)) closeEditor(true);
});

// --- Prekidač ------------------------------------------------------------------------------------

// Poruka uz red kad prekidač nije prošao (već je vraćen na staro stanje). Prazna poruka znači "zauzeto": ništa.
const rowErrors = reactive<Record<number, string>>({});
const rowTimers = new Map<number, ReturnType<typeof setTimeout>>();
const ROW_ERROR_MS = 10000;

onBeforeUnmount(() => {
  unregister?.();
  if (ticker) clearInterval(ticker);
  if (dropTimer) clearTimeout(dropTimer);
  for (const timer of rowTimers.values()) clearTimeout(timer);
});

const clearRowError = (id: number) => {
  delete rowErrors[id];
  const timer = rowTimers.get(id);
  if (timer) clearTimeout(timer);
  rowTimers.delete(id);
};

const onToggle = async (id: number) => {
  clearRowError(id);
  const result = await props.ws.actions.toggleSurcharge(id);
  if (result.ok || !result.message) return;
  rowErrors[id] = result.message;
  rowTimers.set(
    id,
    setTimeout(() => clearRowError(id), ROW_ERROR_MS)
  );
};

// --- Brisanje ------------------------------------------------------------------------------------

// Podaci dijaloga se uzimaju pri otvaranju: doplata nestaje iz liste čim se obriše, a dijalog se tada još zatvara.
const del = reactive({
  open: false,
  busy: false,
  error: "",
  id: 0,
  name: "",
  active: false,
  dependents: [] as string[],
});

const askDelete = () => {
  const s = target.value?.surcharge;
  if (!s) return;
  const live = list.value.find((x) => x.id === s.id) ?? s;
  del.id = s.id;
  del.name = live.name;
  del.active = live.active;
  del.dependents = props.ws.rules.usingSurcharge(s.id).map((rule) => props.ws.rules.titleOf(rule));
  del.error = "";
  del.busy = false;
  del.open = true;
};

const onDeleteOpen = (value: boolean) => {
  if (value || del.busy) return;
  del.open = false;
  // Računar: editor je ostao u listi, fokus se vraća na dugme koje je pitalo. Telefon: list se sam vraća.
  if (wide.value) {
    void nextTick(() =>
      root.value?.querySelector<HTMLElement>('[data-pricing="surcharge-delete"]')?.focus({ preventScroll: true })
    );
  }
};

// Greška (npr. pravila nisu učitana ili je pad usred posla) ostaje u dijalogu, uz poruku šta je već obrisano.
const confirmDelete = async () => {
  if (del.busy) return;
  del.busy = true;
  del.error = "";
  const result = await props.ws.actions.removeSurchargeCascade(del.id);
  del.busy = false;
  if (result.ok) {
    del.open = false;
    closeEditor(true);
    focusAfter(null);
  } else if (result.message) {
    del.error = result.message;
  }
};

// --- Ostalo --------------------------------------------------------------------------------------

// Dugme nestaje čim učitavanje krene (skeleton), pa fokus prelazi na tab da ne ostane na onome čega više nema.
const onRetry = () => {
  root.value?.focus({ preventScroll: true });
  void props.ws.surcharges.reload();
};
</script>

<style scoped>
.st {
  display: grid;
  gap: 14px;
  align-content: start;
  min-width: 0;
  color: #0b1220;
}

/* Fokus na tab postavlja kod, ne korisnik; prsten bi tu samo smetao. */
.st:focus {
  outline: none;
}

.st-card {
  min-width: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
  list-style: none;
}

.st-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.st-head-t {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.st-head h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.st-head p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.4;
  color: #5b6676;
}

.st-new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 14px;
  background: #eef4ff;
  color: #2459c7;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
}

.st-new:active {
  background: #dfeaff;
}

.st-new:focus-visible,
.st-chip:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.st-qa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.st-qa-l {
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.st-chip {
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

.st-chip:hover {
  border-color: #c7ccd4;
}

.st-chip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2f6fed;
}

/* Crta između redova, uvučena do teksta; forma u listi ima svoju. */
.st-li {
  position: relative;
}

.st-li + .st-li::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  left: 66px;
  height: 1px;
  background: #eceef2;
}

/* Prazno i pad učitavanja. */
.st-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 24px 24px;
  text-align: center;
}

.st-empty h2,
.st-empty h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.st-empty p {
  max-width: 320px;
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.45;
  color: #5b6676;
}

.st-tile {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  border-radius: 20px;
  background: #eef4ff;
  color: #2459c7;
}

.st-tile.is-bad {
  background: #fde8e6;
  color: #c4281c;
}

.st-retry {
  width: auto;
  margin-top: 8px;
}

/* Skeleton. */
.st-sk-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 14px 16px;
  border-top: 1px solid #eceef2;
}

.st-sk-row:first-child {
  border-top: 0;
}

.st-sk-l {
  display: grid;
  gap: 8px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: st-shimmer 1.3s linear infinite;
}

@keyframes st-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
