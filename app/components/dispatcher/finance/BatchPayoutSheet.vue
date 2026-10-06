<template>
  <AppSheet
    ref="sheet"
    :open="open"
    title="Isplati zarade"
    label="Isplati zarade svim kuririma"
    :subtitle="subtitle"
    :dirty="dirty"
    @update:open="onOpen"
  >
    <template v-if="phase === 'form'">
      <TintAlert tone="info" title="Cijela zarada svakog označenog kurira">
        Svaka isplata je zasebna i ima svoj ključ, pa ponovni pokušaj ne isplaćuje dvaput.
      </TintAlert>
      <ChoiceGroup
        v-model="method"
        :options="METHODS"
        label="Način isplate (za sve označene)"
        variant="pills"
      />
      <div>
        <button type="button" class="bp-text" data-sheet="all" @click="toggleAll">
          {{ allChecked ? "Poništi sve" : "Označi sve" }}
        </button>
      </div>
    </template>

    <TintAlert
      v-if="phase === 'done' && summary.failed"
      tone="bad"
      role="alert"
      :title="`Isplaćeno ${summary.ok}, nije uspjelo ${summary.failed}`"
    >
      Neuspjele možeš ponoviti: isti ključ sprječava dvostruku isplatu.
    </TintAlert>
    <TintAlert
      v-else-if="phase === 'done'"
      tone="ok"
      role="status"
      :title="`Isplaćeno ${summary.ok} ${pluralizeSr(summary.ok, 'zarada', 'zarade', 'zarada')}`"
    >
      Ukupno {{ money(total, currency) }}.{{ summary.warnings ? ` Server je javio upozorenje za ${summary.warnings}.` : "" }}
    </TintAlert>

    <template v-if="phase === 'run'">
      <div
        class="bp-prog"
        role="progressbar"
        aria-label="Napredak isplate"
        aria-valuemin="0"
        :aria-valuemax="checkedCount"
        :aria-valuenow="processed"
      >
        <i :style="{ width: checkedCount ? `${Math.round((processed / checkedCount) * 100)}%` : '0%' }" />
      </div>
      <p class="bp-note">Obrađeno {{ processed }} od {{ checkedCount }}</p>
    </template>

    <div class="bp-list" role="group" aria-label="Kuriri za isplatu">
      <div v-for="it in rows" :key="it.id" class="bp-item">
        <label class="bp-ck">
          <input
            v-model="it.checked"
            type="checkbox"
            :disabled="phase !== 'form'"
            :data-batch="it.id"
            :aria-label="`Isplati ${it.name}, ${money(it.amount, currency)}`"
          />
          <span class="bp-bx"><v-icon icon="mdi-check" size="16" /></span>
        </label>
        <span class="bp-nm">
          <b>{{ it.name }}</b>
          <small v-if="subOf(it)" :class="subClass(it)">{{ subOf(it) }}</small>
        </span>
        <span class="bp-am">
          {{ money(it.amount, currency) }}
          <span v-if="res[it.id]?.state === 'run'" class="bp-spin" role="status" aria-label="Šaljem" />
          <span v-else-if="res[it.id]?.state === 'ok'" class="bp-st bp-st--ok"><v-icon icon="mdi-check" size="16" /></span>
          <span v-else-if="res[it.id]?.state === 'err'" class="bp-st bp-st--err"><v-icon icon="mdi-alert-outline" size="16" /></span>
        </span>
      </div>
    </div>

    <SheetSummary
      v-if="phase === 'form'"
      :rows="[
        { label: 'Označeno', value: `${checkedCount} od ${rows.length}` },
        { label: 'Ukupno za isplatu', value: money(total, currency) },
      ]"
    />

    <template #footer>
      <template v-if="phase === 'run'">
        <AppButton disabled loading>Isplata je u toku…</AppButton>
        <p>Ne zatvaraj dok se ne završi.</p>
      </template>
      <template v-else-if="phase === 'done'">
        <div v-if="failedCount" class="bp-two">
          <AppButton variant="ghost" data-sheet="close" @click="close">Zatvori</AppButton>
          <AppButton data-sheet="retry" @click="run(true)">Pokušaj ponovo ({{ failedCount }})</AppButton>
        </div>
        <AppButton v-else data-sheet="close" @click="close">Zatvori</AppButton>
      </template>
      <template v-else>
        <AppButton :disabled="!checkedCount" data-sheet="submit" @click="run(false)">
          {{
            checkedCount
              ? `Isplati ${checkedCount} ${pluralizeSr(checkedCount, "zaradu", "zarade", "zarada")} (${money(total, currency)})`
              : "Označi bar jednog kurira"
          }}
        </AppButton>
        <p>{{ checkedCount ? "Provjeri ukupan iznos prije potvrde." : "" }}</p>
      </template>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import AppSheet from "~/components/common/AppSheet.vue";
import ChoiceGroup, { type ChoiceOption } from "~/components/common/ChoiceGroup.vue";
import TintAlert from "~/components/common/TintAlert.vue";
import SheetSummary from "~/components/dispatcher/finance/SheetSummary.vue";
import { useAlertStore } from "~/stores/alert";
import { batchSummary, money, r2, runBatch, type BatchResult, type BatchUpdate, type PlanItem } from "~/utils/cashDesk";
import { pluralizeSr } from "~/utils/datetime";

// List "Isplati zarade" za sve kurire sa zaradom: označeni kuriri, jedan način isplate za sve, ukupan iznos
// u dugmetu. Jedan poziv po kuriru sa vlastitim ključem (pravi se pri otvaranju lista), najviše tri
// istovremeno; pad jednog ne zaustavlja ostale. Rezultat je po kuriru, a "Pokušaj ponovo" šalje samo
// neuspjele sa ISTIM ključevima. Dok traje, list se ne zatvara. Isplaćuje se cijela zarada u času otvaranja.
const props = defineProps<{
  open: boolean;
  items: PlanItem[];
  currency: string;
  payOne: (courierId: number, amount: number, method: string, key: string) => Promise<BatchResult>;
}>();

const emit = defineEmits<{ "update:open": [value: boolean]; lock: [value: boolean]; done: [] }>();

const METHODS: ChoiceOption[] = [
  { value: "gotovina", label: "Gotovina" },
  { value: "bankovni transfer", label: "Bankovni transfer" },
];

const alerts = useAlertStore();
const sheet = ref<InstanceType<typeof AppSheet> | null>(null);

type Row = PlanItem & { checked: boolean };
const rows = reactive<Row[]>([]);
const res = reactive<Record<number, BatchUpdate>>({});
const keys: Record<number, string> = {};
const method = ref("gotovina");
const phase = ref<"form" | "run" | "done">("form");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    rows.splice(0, rows.length, ...props.items.map((i) => ({ ...i, checked: true })));
    for (const k of Object.keys(res)) delete res[Number(k)];
    for (const i of props.items) keys[i.id] = crypto.randomUUID();
    method.value = "gotovina";
    phase.value = "form";
  },
  { immediate: true }
);

const checkedRows = computed(() => rows.filter((r) => r.checked));
const checkedCount = computed(() => checkedRows.value.length);
const total = computed(() => r2(checkedRows.value.reduce((s, r) => s + r.amount, 0)));
const allChecked = computed(() => rows.length > 0 && rows.every((r) => r.checked));
const allTotal = computed(() => r2(rows.reduce((s, r) => s + r.amount, 0)));

const subtitle = computed(
  () => `${rows.length} ${pluralizeSr(rows.length, "kurir čeka", "kurira čekaju", "kurira čeka")} isplatu · ${money(allTotal.value, props.currency)}`
);

const dirty = computed(() => phase.value === "form" && (rows.some((r) => !r.checked) || method.value !== "gotovina"));

const summary = computed(() =>
  batchSummary(
    Object.fromEntries(
      Object.entries(res)
        .filter(([, v]) => v.state === "ok" || v.state === "err")
        .map(([k, v]) => [k, { ok: v.state === "ok", warning: v.state === "ok" ? v.warning : undefined }])
    )
  )
);
const processed = computed(() => summary.value.ok + summary.value.failed);
const failedCount = computed(() => rows.filter((r) => r.checked && res[r.id]?.state === "err").length);

const toggleAll = () => {
  const next = !allChecked.value;
  for (const r of rows) r.checked = next;
};

const subOf = (it: Row): string => {
  const r = res[it.id];
  if (r?.state === "err") return r.message || "Nije uspjelo.";
  if (r?.state === "ok") return r.warning || "Isplaćeno";
  if (r?.state === "run") return "Šaljem…";
  if (method.value === "bankovni transfer" && !it.bank && it.checked && phase.value === "form") return "Račun nije upisan";
  if (it.suspended) return "Suspendovan";
  if (!it.inFirm) return "Nije u firmi";
  return "";
};
const subClass = (it: Row) => ({
  "is-err": res[it.id]?.state === "err",
  "is-warn": !res[it.id] && method.value === "bankovni transfer" && !it.bank && it.checked && phase.value === "form",
});

const focusResult = async () => {
  await nextTick();
  document
    .querySelector<HTMLElement>('[data-sheet="retry"], [data-sheet="close"]')
    ?.focus({ preventScroll: true });
};

const run = async (retry: boolean) => {
  if (phase.value === "run") return;
  const targets = rows.filter((r) => r.checked && (!retry || res[r.id]?.state === "err"));
  if (!targets.length) return;
  phase.value = "run";
  emit("lock", true);
  if (!retry) for (const k of Object.keys(res)) delete res[Number(k)];
  for (const t of targets) delete res[t.id];
  try {
    await runBatch(targets, (it) => props.payOne(it.id, it.amount, method.value, keys[it.id] as string), {
      onUpdate: (id, update) => {
        res[id] = update;
      },
    });
  } finally {
    phase.value = "done";
    emit("lock", false);
  }
  void focusResult();
  const ok = Object.values(res).filter((r) => r.state === "ok").length;
  if (ok) alerts.success(`Isplaćeno ${ok} ${pluralizeSr(ok, "zarada", "zarade", "zarada")}.`, 3000);
  emit("done");
};

const onOpen = (value: boolean) => {
  if (!value && phase.value === "run") {
    alerts.info("Isplata je u toku. Sačekaj da se završi.");
    return;
  }
  emit("update:open", value);
};

const close = () => onOpen(false);
</script>

<style scoped>
.bp-text {
  min-height: 44px;
  padding: 0 6px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 800;
  cursor: pointer;
}

.bp-text:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
  border-radius: 8px;
}

.bp-prog {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e8ed;
}

.bp-prog i {
  display: block;
  height: 100%;
  background: #0b1220;
  transition: width 0.2s;
}

.bp-note {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 700;
  color: #5b6676;
}

.bp-list {
  display: grid;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.bp-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 56px;
  padding: 6px 12px 6px 4px;
  background: #fff;
}

.bp-item + .bp-item {
  border-top: 1px solid #eceef2;
}

.bp-ck {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  cursor: pointer;
}

.bp-ck input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.bp-bx {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 2px solid #8a94a3;
  border-radius: 7px;
  background: #fff;
  color: #fff;
}

.bp-bx :deep(.v-icon) {
  display: none;
}

.bp-ck input:checked + .bp-bx {
  border-color: #0b1220;
  background: #0b1220;
}

.bp-ck input:checked + .bp-bx :deep(.v-icon) {
  display: inline-flex;
}

.bp-ck input:focus-visible + .bp-bx {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.bp-ck input:disabled {
  cursor: not-allowed;
}

.bp-ck input:disabled + .bp-bx {
  opacity: 0.5;
}

.bp-nm {
  display: grid;
  min-width: 0;
}

.bp-nm b {
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bp-nm small {
  font-size: 0.76rem;
  font-weight: 600;
  color: #5b6676;
}

.bp-nm small.is-err {
  color: #b42318;
  font-weight: 700;
}

.bp-nm small.is-warn {
  color: #8f4406;
  font-weight: 700;
}

.bp-am {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.92rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.bp-st {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.bp-st--ok {
  background: #e3f8ef;
  color: #00734f;
}

.bp-st--err {
  background: #fde8e6;
  color: #b42318;
}

.bp-spin {
  width: 18px;
  height: 18px;
  border: 3px solid #dfe3ea;
  border-top-color: #2f6fed;
  border-radius: 50%;
  animation: bp-sp 0.8s linear infinite;
}

@keyframes bp-sp {
  to {
    transform: rotate(360deg);
  }
}

.bp-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .bp-spin {
    animation: none;
  }

  .bp-prog i {
    transition: none;
  }
}
</style>
