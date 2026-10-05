<template>
  <div ref="root" class="vr" tabindex="-1" data-pricing="rules-tab">
    <!-- Učitavanje: skeleton oblika liste (zaglavlje i redovi), ne tekst. -->
    <div
      v-if="state === 'loading'"
      class="vr-skel"
      role="status"
      aria-busy="true"
      aria-label="Učitavam pravila za vozila"
      data-pricing="rules-loading"
    >
      <div class="vr-sk-h" aria-hidden="true">
        <i class="sk" style="width: 38%; height: 18px" />
        <i class="sk" style="width: 74%; height: 12px" />
      </div>
      <div class="vr-card" aria-hidden="true">
        <div v-for="n in 4" :key="n" class="vr-sk-row">
          <i class="sk vr-sk-n" />
          <i class="sk vr-sk-v" />
          <span class="vr-sk-l">
            <i class="sk" style="width: 56%; height: 14px" />
            <i class="sk" style="width: 34%; height: 11px" />
          </span>
          <i class="sk vr-sk-a" />
        </div>
      </div>
    </div>

    <!-- Pad učitavanja: poruka u mjestu liste, ništa nije izgubljeno. -->
    <section
      v-else-if="state === 'error'"
      class="vr-card vr-empty"
      role="alert"
      data-pricing="rules-error"
    >
      <span class="vr-empty-ic is-bad"><v-icon icon="mdi-cloud-off-outline" size="30" /></span>
      <h3>Ne mogu da učitam pravila za vozila</h3>
      <p>{{ ws.rules.loadReason || "Server ne odgovara." }} Ništa nije izgubljeno.</p>
      <AppButton variant="ghost" icon="mdi-refresh" class="vr-retry" data-pricing="retry" @click="onRetry">
        Pokušaj ponovo
      </AppButton>
    </section>

    <template v-else>
      <div class="vr-head">
        <div class="vr-head-t">
          <h2 :id="titleId">Pravila za vozila</h2>
          <p>{{ RULES_HINT }}</p>
        </div>
        <button type="button" class="vr-new" data-pricing="rule-new" @click="onNew">
          <v-icon icon="mdi-plus" size="18" />
          {{ ws.rules.hasFallback ? "Novo pravilo" : "Dodaj zadano pravilo" }}
        </button>
      </div>

      <!-- Novo pravilo na računaru: kartica iznad liste. Na telefonu je donji list (ispod). -->
      <div v-if="inlineFor(null)" class="vr-card">
        <VehicleRuleEditor
          :ref="setInlineEditor"
          :ws="ws"
          :rule-id="null"
          inline
          @close="closeEditor"
          @saved="onSaved"
          @dirty="editorDirty = $event"
        />
      </div>

      <!-- Prazno: kaže šta je to i nudi prvi korak (dugme u zaglavlju). -->
      <section v-if="state === 'empty'" class="vr-card vr-empty" data-pricing="rules-empty">
        <span class="vr-empty-ic"><v-icon icon="mdi-motorbike" size="30" /></span>
        <h3>Još nema pravila za vozila</h3>
        <p>
          Bez pravila dispečer ne dobija predlog vozila za narudžbu. Počni od zadanog pravila, pa dodaj izuzetke po
          zoni, doplati ili udaljenosti.
        </p>
      </section>

      <template v-else>
        <div v-if="rows.length > 0" class="vr-card">
          <ol class="vr-list" aria-label="Pravila za vozila, redom primjene">
            <li v-for="row in rows" :key="row.rule.id">
              <VehicleRuleRow
                :rule="row.rule"
                :index="row.index"
                :total="row.total"
                :title="row.title"
                :vehicles="row.vehicles"
                :hit="hitId === row.rule.id"
                :flash="ws.view.flashKey === `r${row.rule.id}`"
                :open="inlineFor(row.rule.id)"
                :can-up="row.canUp"
                :can-down="row.canDown"
                :error="moveError?.id === row.rule.id ? moveError.text : ''"
                @open="onOpen"
                @move="onMove"
                @dismiss-error="moveError = null"
              />
              <VehicleRuleEditor
                v-if="inlineFor(row.rule.id)"
                :ref="setInlineEditor"
                :ws="ws"
                :rule-id="row.rule.id"
                inline
                @close="closeEditor"
                @saved="onSaved"
                @dirty="editorDirty = $event"
                @delete="askDelete"
              />
            </li>
          </ol>
        </div>

        <!-- Zadano pravilo je zasebno, uvijek posljednje, bez strelica i brisanja. -->
        <template v-if="fallbackRow">
          <h3 class="vr-def">Ako se nijedno ne poklopi</h3>
          <div class="vr-card" data-pricing="rule-fallback-card">
            <VehicleRuleRow
              :rule="fallbackRow.rule"
              :index="-1"
              :total="0"
              :title="fallbackRow.title"
              :vehicles="fallbackRow.vehicles"
              :hit="hitId === fallbackRow.rule.id"
              :flash="ws.view.flashKey === `r${fallbackRow.rule.id}`"
              :open="inlineFor(fallbackRow.rule.id)"
              fallback
              @open="onOpen"
            />
            <VehicleRuleEditor
              v-if="inlineFor(fallbackRow.rule.id)"
              :ref="setInlineEditor"
              :ws="ws"
              :rule-id="fallbackRow.rule.id"
              inline
              @close="closeEditor"
              @saved="onSaved"
              @dirty="editorDirty = $event"
            />
          </div>
        </template>
        <TintAlert v-else tone="warn" title="Nema zadanog pravila" data-pricing="rule-no-fallback">
          Narudžba koju nijedno pravilo ne pokrije ostaje bez predloga vozila.
        </TintAlert>
      </template>
    </template>

    <!-- Telefon: editor je donji list. Ostaje montiran i poslije zatvaranja da se list ne prekine usred prelaza. -->
    <VehicleRuleEditor
      v-if="!ws.view.wide && target"
      :key="target.key"
      :ws="ws"
      :rule-id="target.id"
      :inline="false"
      :open="open"
      @update:open="onSheetOpen"
      @saved="onSaved"
      @dirty="editorDirty = $event"
      @delete="askDelete"
    />

    <PricingDeleteDialog
      :open="delOpen"
      kind="rule"
      :name="del?.name ?? ''"
      :wide="ws.view.wide"
      :busy="delBusy"
      :error="delError"
      @update:open="onDelOpen"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import PricingDeleteDialog from "~/components/pricing/PricingDeleteDialog.vue";
import VehicleRuleEditor from "~/components/pricing/VehicleRuleEditor.vue";
import VehicleRuleRow from "~/components/pricing/VehicleRuleRow.vue";
import type { PricingWorkspace } from "~/composables/usePricingWorkspace";
import { useAlertStore } from "~/stores/alert";
import type { VehicleRule } from "~/types/pricing";
import { ruleVehicles } from "~/utils/pricing";

// Tab Vozila i pravila: lista pravila odozgo prema dolje (prvo pravilo koje se poklopi bira vozila), zasebno
// zadano pravilo "Sve ostalo" i editor. Računar: editor je u redu koji se mijenja (novo pravilo je kartica
// iznad liste); telefon: donji list. Komponenta ne dotiče mrežu: čuvanje, brisanje i pomjeranje idu kroz
// ws.actions, obavijesti (uključujući "Poništi" poslije pomjeranja) pravi radni prostor, a greška se
// pokazuje uz ono što se mijenja (uz red, u editoru, u dijalogu za brisanje).
const props = defineProps<{ ws: PricingWorkspace }>();

// PRETPOSTAVKA B1: server bira prvo pravilo koje se poklopi po rastućem priority; rečenica zavisi od toga.
const RULES_HINT =
  "Odozgo prema dolje: prvo pravilo koje se poklopi bira vozila. „Sve ostalo“ važi kad se nijedno ne poklopi.";
const PENDING_EDIT = "Prvo sačuvaj ili otkaži izmjenu koja je otvorena.";

const alerts = useAlertStore();
const root = ref<HTMLElement | null>(null);
const titleId = `vr-${useId()}`;

// --- Stanje liste ----------------------------------------------------------------------------------

// Podaci koji već postoje ostaju na ekranu i dok se osvježavaju. Prije nego što se firma učita lista je
// prazna, ali to nije "nema pravila", pa se tada čeka.
const state = computed<"loading" | "error" | "empty" | "ready">(() => {
  const rules = props.ws.rules;
  if (rules.list.length > 0) return "ready";
  if (rules.loadFailed) return "error";
  if (rules.loading || props.ws.company.id === null) return "loading";
  return "empty";
});

type RowData = { rule: VehicleRule; title: string; vehicles: readonly string[] };

const rows = computed(() => {
  const list = props.ws.rules.ordered.list;
  return list.map((rule, index) => ({
    rule,
    index,
    total: list.length,
    title: props.ws.rules.titleOf(rule),
    vehicles: ruleVehicles(rule),
    canUp: props.ws.rules.canMove(rule.id, -1),
    canDown: props.ws.rules.canMove(rule.id, 1),
  }));
});

const fallbackRow = computed<RowData | null>(() => {
  const rule = props.ws.rules.ordered.fallback;
  return rule ? { rule, title: props.ws.rules.titleOf(rule), vehicles: ruleVehicles(rule) } : null;
});

// Pravilo koje se poklapa sa primjerom narudžbe.
const hitId = computed(() => props.ws.recommended?.ruleId ?? null);

// "Pokušaj ponovo": fokus ide na tab jer dugme nestaje čim krene učitavanje (skeleton).
const onRetry = () => {
  root.value?.focus({ preventScroll: true });
  void props.ws.actions.reloadAll();
};

// --- Editor ----------------------------------------------------------------------------------------

// Šta se uređuje: id pravila ili null za novo. `key` pravi svježu formu pri svakom otvaranju. Na telefonu
// `target` ostaje i poslije zatvaranja lista, da se naslov ne mijenja usred prelaza.
type Target = { id: number | null; key: number };
const target = shallowRef<Target | null>(null);
const open = ref(false);
const editorDirty = ref(false);
let keySeq = 0;
// Id pravila koje je upravo sačuvano: poslije zatvaranja fokus ide na njegov red.
let savedId: number | null = null;

type EditorHandle = { focusTitle: () => void };
let inlineEditor: EditorHandle | null = null;
const setInlineEditor = (el: unknown) => {
  inlineEditor = (el as EditorHandle | null) ?? null;
};

// Je li editor tog pravila (null: novog) sada otvoren u redu. Samo na računaru.
const inlineFor = (id: number | null): boolean =>
  props.ws.view.wide && open.value && target.value !== null && target.value.id === id;

// Nesačuvano u editoru vide tabovi, promjena firme i dugme Nazad (radni prostor). Dok je editor zatvoren
// ne računa se, pa list koji se zatvara ne zadržava tačku na tabu.
const unregisterDirty = props.ws.dirty.registerEditorDirty("rule", () => open.value && editorDirty.value);
onBeforeUnmount(unregisterDirty);

const openEditor = (id: number | null) => {
  moveError.value = null;
  target.value = { id, key: ++keySeq };
  editorDirty.value = false;
  savedId = null;
  open.value = true;
  if (props.ws.view.wide) void nextTick(() => inlineEditor?.focusTitle());
};

// Zatvara editor i vraća fokus: na red koji je otvorio ili sačuvan, a ako ga nema (novo, obrisano) na "Novo pravilo".
const closeEditor = () => {
  const was = target.value;
  open.value = false;
  editorDirty.value = false;
  const id = savedId ?? was?.id ?? null;
  savedId = null;
  void nextTick(() => {
    const row = id === null ? null : root.value?.querySelector<HTMLElement>(`[data-rule-open="${id}"]`);
    (row ?? root.value?.querySelector<HTMLElement>('[data-pricing="rule-new"]'))?.focus({ preventScroll: true });
  });
};

const onSaved = (id: number | null) => {
  savedId = id;
};

const onSheetOpen = (value: boolean) => {
  if (!value) closeEditor();
};

// Otvoren editor sa izmjenama se ne napušta klikom na drugi red: izmjena se prvo sačuva ili otkaže.
const guardPending = (): boolean => {
  if (open.value && editorDirty.value) {
    alerts.info(PENDING_EDIT);
    return true;
  }
  return false;
};

const onOpen = (id: number) => {
  if (open.value && target.value?.id === id) {
    if (guardPending()) return;
    if (props.ws.view.wide) closeEditor();
    return;
  }
  if (guardPending()) return;
  openEditor(id);
};

const onNew = () => {
  if (open.value && target.value?.id === null) {
    if (props.ws.view.wide) inlineEditor?.focusTitle();
    return;
  }
  if (guardPending()) return;
  openEditor(null);
};

// Pravilo koje se uređuje je nestalo (drugi dispečer ga je obrisao, lista je osvježena): editor se gasi.
watch(
  () => {
    const t = target.value;
    if (!open.value || t === null || t.id === null) return false;
    return !props.ws.rules.loading && !props.ws.rules.loadFailed && props.ws.rules.ruleById(t.id) === null;
  },
  (gone) => {
    if (!gone || delBusy.value) return;
    closeEditor();
    alerts.info("Pravilo više ne postoji.");
  }
);

// Druga firma: sve otvoreno se gasi, pravila su druga.
watch(
  () => props.ws.company.id,
  () => {
    open.value = false;
    editorDirty.value = false;
    delOpen.value = false;
    moveError.value = null;
  }
);

// --- Pomjeranje ------------------------------------------------------------------------------------

const moveError = ref<{ id: number; text: string } | null>(null);

const onMove = async (id: number, dir: -1 | 1) => {
  if (props.ws.rules.reordering) return;
  moveError.value = null;
  const result = await props.ws.actions.moveRule(id, dir);
  if (!result.ok && result.message) moveError.value = { id, text: result.message };
  // Red je premješten u DOM-u, pa je pretraživač mogao spustiti fokus: vraća se na istu strelicu, a na
  // rubu (onemogućena) na suprotnu.
  await nextTick();
  const same = root.value?.querySelector<HTMLButtonElement>(
    `[data-rule-move="${id}:${dir === -1 ? "up" : "down"}"]`
  );
  const other = root.value?.querySelector<HTMLButtonElement>(
    `[data-rule-move="${id}:${dir === -1 ? "down" : "up"}"]`
  );
  (same && !same.disabled ? same : other && !other.disabled ? other : same)?.focus({ preventScroll: true });
};

// --- Brisanje --------------------------------------------------------------------------------------

const del = ref<{ id: number; name: string } | null>(null);
const delOpen = ref(false);
const delBusy = ref(false);
const delError = ref("");

const askDelete = () => {
  const id = target.value?.id ?? null;
  const rule = id === null ? null : props.ws.rules.ruleById(id);
  if (!rule) return;
  del.value = { id: rule.id, name: props.ws.rules.titleOf(rule) };
  delError.value = "";
  delOpen.value = true;
};

const onDelOpen = (value: boolean) => {
  if (!value && delBusy.value) return;
  delOpen.value = value;
};

const confirmDelete = async () => {
  const current = del.value;
  if (!current || delBusy.value) return;
  delBusy.value = true;
  delError.value = "";
  const result = await props.ws.actions.removeRule(current.id);
  delBusy.value = false;
  if (result.ok) {
    delOpen.value = false;
    closeEditor();
  } else if (result.message) {
    // Dijalog ostaje otvoren: dispečer vidi zašto brisanje nije prošlo.
    delError.value = result.message;
  }
};

// --- Isticanje i skrol ------------------------------------------------------------------------------

// Poslije snimanja, pomjeranja i "Otvori pravilo" iz primjera red kratko pozeleni (red čita flashKey), a
// ovdje se dovodi u vidokrug. Uz smanjeno kretanje skrol je trenutan.
const ruleIdOf = (key: string | null): number | null => {
  const match = key === null ? null : /^r(\d+)$/.exec(key);
  return match?.[1] ? Number(match[1]) : null;
};

const scrollToRule = async (id: number) => {
  await nextTick();
  const el = root.value?.querySelector<HTMLElement>(`[data-rule="${id}"]`);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
};

watch(
  () => props.ws.view.flashKey,
  (key) => {
    const id = ruleIdOf(key);
    if (id !== null) void scrollToRule(id);
  }
);

// "Otvori pravilo" prebacuje na ovaj tab: isticanje je već postavljeno prije nego što se tab montirao.
onMounted(() => {
  const id = ruleIdOf(props.ws.view.flashKey);
  if (id !== null) void scrollToRule(id);
});
</script>

<style scoped>
.vr {
  display: grid;
  gap: 14px;
  align-content: start;
  min-width: 0;
  color: #0b1220;
}

.vr > * {
  min-width: 0;
}

/* Fokus na tab postavlja kod, ne korisnik; prsten bi tu samo smetao. */
.vr:focus {
  outline: none;
}

.vr-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vr-head-t {
  display: grid;
  gap: 2px;
  min-width: 0;
  max-width: 62ch;
}

.vr-head h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.vr-head p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.4;
  color: #5b6676;
}

.vr-new {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  background: #eef4ff;
  color: #2459c7;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;
}

.vr-new:hover {
  background: #e3edff;
}

.vr-new:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.vr-card {
  min-width: 0;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.vr-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Crta između redova, uvučena do teksta (iza broja i ikone). */
.vr-list > li {
  position: relative;
}

.vr-list > li + li::before {
  content: "";
  position: absolute;
  top: 0;
  left: 80px;
  right: 0;
  height: 1px;
  background: #eceef2;
}

.vr-def {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0 4px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #5b6676;
}

.vr-def::before,
.vr-def::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #dfe3ea;
}

/* Prazno i pad učitavanja */
.vr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 24px 24px;
  text-align: center;
}

.vr-empty h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.vr-empty p {
  max-width: 340px;
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.45;
  color: #5b6676;
}

.vr-empty-ic {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  border-radius: 20px;
  background: #eef4ff;
  color: #2f6fed;
}

.vr-empty-ic.is-bad {
  background: #fde8e6;
  color: #c4281c;
}

.vr-retry {
  width: auto;
  margin-top: 8px;
}

/* Skeleton */
.vr-skel {
  display: grid;
  gap: 14px;
}

.vr-sk-h {
  display: grid;
  gap: 8px;
}

.vr-sk-row {
  display: grid;
  grid-template-columns: 26px 44px minmax(0, 1fr) 44px;
  gap: 10px;
  align-items: center;
  min-height: 76px;
  padding: 10px 8px 10px 14px;
  border-top: 1px solid #eceef2;
}

.vr-sk-row:first-child {
  border-top: 0;
}

.vr-sk-n {
  width: 26px;
  height: 26px;
  border-radius: 50%;
}

.vr-sk-v {
  width: 44px;
  height: 44px;
  border-radius: 14px;
}

.vr-sk-a {
  width: 44px;
  height: 28px;
}

.vr-sk-l {
  display: grid;
  gap: 8px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eceff3 0%, #f6f7f9 50%, #eceff3 100%);
  background-size: 200% 100%;
  animation: vr-shimmer 1.3s linear infinite;
}

@keyframes vr-shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 479px) {
  .vr-list > li + li::before {
    left: 64px;
  }

  .vr-sk-row {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
  }

  .vr-sk-n {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
