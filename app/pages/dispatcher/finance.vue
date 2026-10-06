<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader
        :title="inPhoneDetail && selected ? selected.name : 'Finansije'"
        back-to="/"
        :back-label="inPhoneDetail ? 'Nazad na listu kurira' : 'Nazad na početnu'"
        :intercept-back="inPhoneDetail"
        @back="view.close()"
      >
        <template #subtitle>
          <template v-if="inPhoneDetail && selected">#{{ selected.id }}</template>
          <template v-else-if="subtitle">{{ subtitle }}</template>
        </template>
        <template v-if="!inPhoneDetail" #actions>
          <button type="button" class="fp-ib" data-page="refresh" aria-label="Osvježi podatke" title="Osvježi" :disabled="cash.refreshing.value" @click="refresh">
            <v-icon icon="mdi-refresh" size="22" :class="{ 'fp-spin': cash.refreshing.value }" />
          </button>
        </template>
      </PageHeader>
    </template>

    <div class="fp">
      <!-- Telefon: detalj kurira je zasebna stranica. -->
      <template v-if="inPhoneDetail">
        <div class="fp-page">
          <FinanceDetail
            v-if="selected"
            ref="detailEl"
            :row="selected"
            :now="cash.now.value"
            :currency="cash.currency.value"
            :cash-limit="cash.cashLimit.value"
            :wide="false"
            :ledger="ledger.current.value"
            @close="view.close()"
            @receipt="openSheet('receipt')"
            @payout="openSheet('payout')"
            @confirm="openConfirm"
            @journal="openJournal"
            @retry-ledger="ledger.reload()"
          />
          <div v-else class="fp-lost" role="status">
            <b>{{ cash.state.value === "ready" ? "Kurir nije u spisku" : "Učitavam kurira…" }}</b>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="fp-tabs">
          <GlobalTabBar
            :model-value="view.tab.value"
            :tabs="tabs"
            variant="pills"
            label="Sekcije finansija"
            id-base="fin"
            panel-id="fin-panel"
            @update:model-value="view.setTab"
          />
          <span class="fp-upd" aria-hidden="true">{{ updatedText }}</span>
        </div>

        <div id="fin-panel" ref="panelEl" class="fp-panel" role="tabpanel" tabindex="-1" :aria-labelledby="`fin-tab-${view.tab.value}`">
          <template v-if="view.tab.value === 'stanje'">
            <FinanceKpis
              :counts="view.totals.value"
              :currency="cash.currency.value"
              :cash-limit="cash.cashLimit.value"
              :filter="view.filter.value"
              :pending-known="cash.pendingState.value === 'ok'"
              :balances-known="cash.state.value === 'ready'"
              :now="cash.now.value"
              @kpi="view.toggleKpi"
              @batch="openBatch"
            />

            <div class="fp-grid">
              <div class="fp-left">
                <PendingQueue
                  v-if="!wide"
                  :state="cash.pendingState.value"
                  :rows="cash.book.value"
                  :now="cash.now.value"
                  :currency="cash.currency.value"
                  :failed="cash.pendingFailed.value"
                  :flash="cash.flashPending.value"
                  @open="view.open"
                  @confirm="openConfirm"
                  @retry="cash.retry.pending()"
                />
                <BookList
                  ref="listEl"
                  v-model:q="view.q.value"
                  :state="cash.state.value"
                  :stale="cash.stale.value"
                  :error-text="errorText"
                  :counts="view.totals.value"
                  :items="view.visible.value"
                  :matched-count="view.matched.value.length"
                  :filter="view.filter.value"
                  :sort="view.sort.value"
                  :selected-id="view.selectedId.value"
                  :flash="cash.flashCouriers.value"
                  :currency="cash.currency.value"
                  :cash-limit="cash.cashLimit.value"
                  :limit-failed="cash.settingsFailed.value"
                  :status-failed="cash.statusFailed.value"
                  :updated-at="cash.updatedAt.value"
                  :now="cash.now.value"
                  @filter="onFilter"
                  @sort="view.setSort"
                  @open="view.open"
                  @more="view.more()"
                  @reset="view.reset"
                  @batch="openBatch"
                  @retry="onRetry"
                />
              </div>

              <aside v-if="wide" class="fp-det" aria-label="Detalji kurira">
                <FinanceDetail
                  v-if="selected"
                  ref="detailEl"
                  :row="selected"
                  :now="cash.now.value"
                  :currency="cash.currency.value"
                  :cash-limit="cash.cashLimit.value"
                  :wide="true"
                  :ledger="ledger.current.value"
                  @close="closeDetail"
                  @receipt="openSheet('receipt')"
                  @payout="openSheet('payout')"
                  @confirm="openConfirm"
                  @journal="openJournal"
                  @retry-ledger="ledger.reload()"
                />
                <div v-else class="fp-none">
                  <PendingQueue
                    flat
                    :state="cash.pendingState.value"
                    :rows="cash.book.value"
                    :now="cash.now.value"
                    :currency="cash.currency.value"
                    :failed="cash.pendingFailed.value"
                    :flash="cash.flashPending.value"
                    @open="view.open"
                    @confirm="openConfirm"
                    @retry="cash.retry.pending()"
                  />
                  <template v-if="cash.state.value === 'ready' && attention.length">
                    <h3 class="fp-gt">Šta još traži pažnju</h3>
                    <div class="fp-att">
                      <button v-for="a in attention" :key="a.filter" type="button" :data-attention="a.filter" @click="view.setFilter(a.filter)">
                        <span class="ai"><v-icon :icon="a.icon" size="20" /></span>
                        <span>
                          <b>{{ a.title }}</b>
                          <em>{{ a.sub }}</em>
                        </span>
                        <v-icon icon="mdi-chevron-right" size="20" />
                      </button>
                    </div>
                  </template>
                  <div class="fp-hint">
                    <v-icon icon="mdi-account-search-outline" size="30" />
                    <b>Izaberi kurira</b>
                    <p>
                      Gotovina, zarada, uplata, isplata i zadnji promet jednog kurira. Strelice mijenjaju izbor, Enter otvara,
                      <kbd>/</kbd> traži.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </template>

          <JournalTab
            v-else
            :state="journal.state.value"
            :failed="journal.failed.value"
            :error="journal.error.value"
            :rows="journalVisible"
            :diff-count="journalDiffCount"
            :period="view.period.value"
            :range="view.range.value"
            :type="view.jType.value"
            :diff-only="view.diffOnly.value"
            :courier-name="view.jCourier.value != null ? cash.nameOf(view.jCourier.value) : null"
            :shown="view.jShown.value"
            :now="cash.now.value"
            :currency="cash.currency.value"
            @period="view.setPeriod"
            @type="view.setJType"
            @diff="view.toggleDiff"
            @courier="openSheet('pick')"
            @courier-clear="view.setJCourier(null)"
            @custom-day="view.setCustomDay"
            @csv="exportCsv"
            @retry="journal.reload()"
            @reset="view.jReset"
            @more="view.jMore"
            @open="openEntry"
          />
        </div>
      </template>
    </div>

    <template v-if="sheetRow">
      <ConfirmHandoverSheet
        v-if="sheetHandover"
        :open="active?.kind === 'confirm'"
        :courier="sheetRow"
        :handover="sheetHandover"
        :currency="cash.currency.value"
        :now="cash.now.value"
        :save="saveConfirm"
        @update:open="closeSheet('confirm', $event)"
      />
      <CashSheet
        :open="active?.kind === 'receipt' || active?.kind === 'payout'"
        :courier="sheetRow"
        :mode="active?.kind === 'payout' ? 'payout' : 'receipt'"
        :currency="cash.currency.value"
        :receipt-save="saveReceipt"
        :payout-save="savePayout"
        @update:open="closeSheet(active?.kind ?? 'receipt', $event)"
      />
    </template>
    <BatchPayoutSheet
      :open="active?.kind === 'batch'"
      :items="batchItems"
      :currency="cash.currency.value"
      :pay-one="cash.payoutOne"
      @update:open="closeSheet('batch', $event)"
      @lock="batchLocked = $event"
      @done="onBatchDone"
    />
    <JournalEntrySheet
      :open="active?.kind === 'entry'"
      :row="entryRow"
      :currency="cash.currency.value"
      @update:open="closeSheet('entry', $event)"
      @courier="showCourierFromEntry"
    />
    <CourierPickSheet
      :open="active?.kind === 'pick'"
      :rows="cash.book.value"
      :current="view.jCourier.value"
      @update:open="closeSheet('pick', $event)"
      @pick="pickCourier"
    />
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Finansije" });

import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import { storeToRefs } from "pinia";
import GlobalPage from "~/components/common/GlobalPage.vue";
import GlobalTabBar, { type GlobalTabBarItem } from "~/components/common/GlobalTabBar.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import BatchPayoutSheet from "~/components/dispatcher/finance/BatchPayoutSheet.vue";
import BookList from "~/components/dispatcher/finance/BookList.vue";
import ConfirmHandoverSheet from "~/components/dispatcher/finance/ConfirmHandoverSheet.vue";
import CourierPickSheet from "~/components/dispatcher/finance/CourierPickSheet.vue";
import FinanceDetail from "~/components/dispatcher/finance/FinanceDetail.vue";
import FinanceKpis from "~/components/dispatcher/finance/FinanceKpis.vue";
import JournalEntrySheet from "~/components/dispatcher/finance/JournalEntrySheet.vue";
import JournalTab from "~/components/dispatcher/finance/JournalTab.vue";
import PendingQueue from "~/components/dispatcher/finance/PendingQueue.vue";
import CashSheet from "~/components/dispatcher/roster/CashSheet.vue";
import { useCashDesk } from "~/composables/useCashDesk";
import { useCashJournal } from "~/composables/useCashJournal";
import { useCourierLedger } from "~/composables/useCourierLedger";
import { useFinanceView } from "~/composables/useFinanceView";
import { WIDE_QUERY } from "~/composables/useRosterView";
import { interceptLeaving } from "~/composables/useSheetGuard";
import { useAlertStore } from "~/stores/alert";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import type { ActionResult } from "~/composables/useCourierRoster";
import {
  ageText,
  csvName,
  filterJournal,
  isDiffRow,
  payoutPlan,
  plural,
  couriersText,
  money,
  toCsv,
  type CashFilter,
  type CashRow,
  type PendingItem,
  type PlanItem,
} from "~/utils/cashDesk";
import { downloadText } from "~/utils/download";
import { toLatin } from "~/utils/toLatin";

// Finansije dispečera: Stanje (pločice, red predaja koje čekaju potvrdu, spisak kurira sa dva računa i
// detalj izabranog kurira) i Promet (predaje i isplate u jednom toku). Sve radi nad postojećim rutama
// (couriers-balance, couriers-status, cash-handovers, payouts, finance-settings i tri upisa). Pogled živi u
// adresi (?t ?c ?f ?q ?o i za Promet ?p ?k ?kc ?d), a svaka radnja je donji list koji prije slanja piše
// posljedicu. Vidi docs/2026/10/06_10_2026_Frontend_pitanja_za_backend.textile.
const alerts = useAlertStore();
const { errorMessage: companiesError } = storeToRefs(useDeliveryCompaniesStore());

const cash = useCashDesk();
const ready = computed(() => cash.state.value === "ready");
const view = useFinanceView(cash.book, ready, cash.now);

const selected = computed<CashRow | null>(() => view.selected.value);

// --- Širina: na računaru su spisak i detalj uz jedno drugo, na telefonu je detalj stranica --------------

const wide = ref(true);
let mq: MediaQueryList | null = null;
const syncWide = () => {
  wide.value = mq?.matches ?? true;
};
const inPhoneDetail = computed(() => !wide.value && view.tab.value === "stanje" && view.selectedId.value != null);

// --- Zaglavlje i tabovi ---------------------------------------------------------------------------------

const subtitle = computed(() => (cash.companyName.value ? `${toLatin(cash.companyName.value)} · ${cash.currency.value}` : ""));
const errorText = computed(() => cash.balancesError.value || companiesError.value);
const updatedText = computed(() => (cash.updatedAt.value ? `osvježeno ${ageText(cash.updatedAt.value, cash.now.value)}` : ""));

// Značka na tabu: broj predaja koje čekaju; nestaje samo kad se zna da je broj nula (ne dok se ne zna).
const pendingBadge = computed(() => cash.pending.value?.length ?? 0);
const tabs = computed<GlobalTabBarItem<"stanje" | "promet">[]>(() => [
  {
    value: "stanje",
    label: "Stanje",
    badge: pendingBadge.value || undefined,
    badgeColor: "#b42318",
    badgeSr: pendingBadge.value
      ? `${pendingBadge.value} ${plural(pendingBadge.value, "predaja čeka", "predaje čekaju", "predaja čeka")} potvrdu`
      : undefined,
  },
  { value: "promet", label: "Promet" },
]);

const attention = computed(() => {
  const t = view.totals.value;
  const items: { filter: CashFilter; icon: string; title: string; sub: string }[] = [];
  if (cash.cashLimit.value != null && t.over) {
    items.push({
      filter: "limit",
      icon: "mdi-alert-outline",
      title: `${t.over} ${plural(t.over, "kurir je", "kurira su", "kurira je")} preko limita`,
      sub: "Gotovina koju nose je iznad dozvoljene",
    });
  }
  if (t.wage) {
    items.push({
      filter: "wage",
      icon: "mdi-wallet-outline",
      title: `${couriersText(t.wage)} čeka isplatu`,
      sub: `Ukupno ${money(t.sumWage, cash.currency.value)}`,
    });
  }
  return items;
});

// --- Promet ---------------------------------------------------------------------------------------------

const jCourier = computed(() => view.jCourier.value);
const journal = useCashJournal({
  companyId: cash.companyId,
  enabled: computed(() => view.tab.value === "promet"),
  from: computed(() => view.range.value.from),
  to: computed(() => view.range.value.to),
  courier: jCourier,
  nameOf: cash.nameOf,
});

const journalVisible = computed(() =>
  filterJournal(journal.rows.value, { type: view.jType.value, courier: view.jCourier.value, diffOnly: view.diffOnly.value })
);
const journalDiffCount = computed(
  () => journal.rows.value.filter((r) => (view.jCourier.value == null || r.courierId === view.jCourier.value) && isDiffRow(r)).length
);

const exportCsv = () => {
  const rows = journalVisible.value;
  if (!rows.length) return;
  const name = csvName(cash.now.value);
  if (downloadText(name, toCsv(rows))) {
    alerts.success(`Izvezeno ${rows.length} ${plural(rows.length, "red", "reda", "redova")}: ${name}`, 4000);
  } else {
    alerts.error("Preglednik nije dozvolio preuzimanje. Pokušaj ponovo.");
  }
};

// Tok jednog kurira u detalju.
const selectedId = computed(() => (view.tab.value === "stanje" ? view.selectedId.value : null));
const ledger = useCourierLedger({ companyId: cash.companyId, courierId: selectedId, nameOf: cash.nameOf, now: cash.now });

// --- Osvježavanje i filteri -------------------------------------------------------------------------------

const refresh = async () => {
  await cash.refreshAll();
  if (view.tab.value === "promet") void journal.reload();
  ledger.reload();
  alerts.success("Podaci su osvježeni.", 1600);
};

const onFilter = (f: CashFilter) => view.setFilter(f);

const openJournal = () => {
  if (selected.value) view.openJournalFor(selected.value.id);
};

const onRetry = (kind: "balances" | "settings" | "status") => {
  void cash.retry[kind]();
};

const closeDetail = () => {
  const id = view.selectedId.value;
  view.close();
  if (id != null) void nextTick(() => listEl.value?.focusRow(id));
};

// --- Listovi ----------------------------------------------------------------------------------------------

type SheetKind = "confirm" | "receipt" | "payout" | "batch" | "entry" | "pick";
const active = ref<{ kind: SheetKind } | null>(null);

// Kurir i predaja nad kojima je list. Ostaju poslednji i kad se list zatvori, da se list ne razmonta usred
// zatvaranja (animacija i povratak fokusa); poslije potvrde predaja nestaje iz knjige, a kopija ostaje.
const sheetCourierId = ref<number | null>(null);
const sheetPendingId = ref<number | null>(null);
const sheetRow = shallowRef<CashRow | null>(null);
const sheetHandover = shallowRef<PendingItem | null>(null);
watch(
  [cash.book, sheetCourierId, sheetPendingId],
  ([list, id, pid]) => {
    const row = id == null ? null : list.find((r) => r.id === id);
    if (row) {
      sheetRow.value = row;
      const p = pid == null ? null : row.pending.find((x) => x.id === pid);
      if (p) sheetHandover.value = p;
    }
  },
  { immediate: true }
);

const batchItems = shallowRef<PlanItem[]>([]);
const batchLocked = ref(false);
const entryKey = ref<string | null>(null);
const entryRow = computed(() => (entryKey.value ? (journal.rows.value.find((r) => r.key === entryKey.value) ?? null) : null));

const openSheet = (kind: "receipt" | "payout" | "pick") => {
  if (kind !== "pick") {
    if (!selected.value) return;
    sheetCourierId.value = selected.value.id;
    sheetPendingId.value = null;
    sheetRow.value = selected.value;
  }
  active.value = { kind };
};

const openConfirm = (pendingId: number) => {
  for (const r of cash.book.value) {
    const p = r.pending.find((x) => x.id === pendingId);
    if (p) {
      sheetCourierId.value = r.id;
      sheetPendingId.value = p.id;
      sheetRow.value = r;
      sheetHandover.value = p;
      active.value = { kind: "confirm" };
      return;
    }
  }
};

const openBatch = () => {
  const plan = payoutPlan(cash.book.value);
  if (!plan.items.length) {
    alerts.info("Nema kurira sa zaradom za isplatu.");
    return;
  }
  batchItems.value = plan.items;
  active.value = { kind: "batch" };
};

const openEntry = (key: string) => {
  entryKey.value = key;
  active.value = { kind: "entry" };
};

const closeSheet = (kind: SheetKind, open: boolean) => {
  if (open) return;
  const cur = active.value?.kind;
  if (cur && (cur === kind || ((cur === "receipt" || cur === "payout") && (kind === "receipt" || kind === "payout")))) active.value = null;
};

const showCourierFromEntry = (id: number) => {
  active.value = null;
  view.showCourier(id);
};

const pickCourier = (id: number | null) => {
  active.value = null;
  view.setJCourier(id);
};

// Poslije uspješne radnje nad kurirom njegov tok se čita iznova.
const afterOk = (result: ActionResult, courierId: number) => {
  if (result.ok) ledger.invalidate(courierId);
  return result;
};

const saveConfirm = async (amount: number, note: string) => {
  const row = sheetRow.value;
  const p = sheetHandover.value;
  if (!row || !p) return { ok: false, message: "Predaja više nije u listi. Osvježi stranicu.", fields: {} } as ActionResult;
  return afterOk(await cash.confirm(p.id, row.id, amount, note), row.id);
};
const saveReceipt = async (amount: number, note: string) => {
  const row = sheetRow.value;
  if (!row) return { ok: false, message: "Kurir nije izabran.", fields: {} } as ActionResult;
  return afterOk(await cash.receipt(row.id, amount, note), row.id);
};
const savePayout = async (amount: number, method: string, key: string, note: string) => {
  const row = sheetRow.value;
  if (!row) return { ok: false, message: "Kurir nije izabran.", fields: {} } as ActionResult;
  return afterOk(await cash.payout(row.id, amount, method, key, note), row.id);
};

const onBatchDone = () => {
  void cash.afterBatch();
  ledger.reset();
};

// --- Fokus i prečice --------------------------------------------------------------------------------------

const listEl = ref<InstanceType<typeof BookList> | null>(null);
const detailEl = ref<InstanceType<typeof FinanceDetail> | null>(null);
const panelEl = ref<HTMLElement | null>(null);

// Poslije zatvaranja lista fokus se vraća na dugme koje ga je otvorilo (AppSheet); ako je nestalo (npr. red
// predaje poslije potvrde), ide na sljedeće "Potvrdi" ili na panel stranice.
watch(active, (now, old) => {
  if (now || !old) return;
  setTimeout(() => {
    const el = document.activeElement;
    if (el && el !== document.body && !el.closest(".v-overlay")) return;
    const next = document.querySelector<HTMLElement>('[data-queue^="confirm:"], [data-detail^="confirm:"]');
    (next ?? panelEl.value)?.focus({ preventScroll: true });
  }, 450);
});

// Na telefonu detalj je stranica: fokus ide na naslov, a pri povratku na red koji je bio otvoren.
watch(
  () => view.selectedId.value,
  async (id, old) => {
    await nextTick();
    if (wide.value || view.tab.value !== "stanje") return;
    if (id != null && old == null) {
      window.scrollTo({ top: 0 });
      detailEl.value?.focusTitle();
    } else if (id == null && old != null) {
      listEl.value?.focusRow(old);
    }
  }
);

const typingIn = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches("input, textarea, select") || el.isContentEditable);

const onKey = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (active.value || document.querySelector(".v-overlay--active")) return;
  if (view.tab.value !== "stanje") return;
  if (event.key === "/" && !typingIn(event.target) && wide.value) {
    event.preventDefault();
    listEl.value?.focusSearch();
  } else if (event.key === "Escape" && !typingIn(event.target) && wide.value && view.selectedId.value != null) {
    closeDetail();
  }
};

onMounted(() => {
  mq = window.matchMedia(WIDE_QUERY);
  syncWide();
  mq.addEventListener("change", syncWide);
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  mq?.removeEventListener("change", syncWide);
  window.removeEventListener("keydown", onKey);
});

// Promjena firme: listovi stare firme se zatvaraju.
watch(cash.companyId, () => {
  active.value = null;
});

// Dugme Nazad (i odlazak sa stranice) dok list ima neosnimljen unos: list pita, ne gubi ga. Dok je list
// otvoren, Nazad zatvara list, a ne detalj ispod njega. Isplata svima u toku se ne prekida.
onBeforeRouteUpdate((to, from) => {
  if (batchLocked.value) {
    alerts.info("Isplata je u toku. Sačekaj da se završi.");
    return false;
  }
  if (active.value && from.query.c && !to.query.c) {
    if (!interceptLeaving()) active.value = null;
    return false;
  }
});
onBeforeRouteLeave(() => {
  if (batchLocked.value) {
    alerts.info("Isplata je u toku. Sačekaj da se završi.");
    return false;
  }
  if (interceptLeaving()) return false;
});
</script>

<style scoped>
.fp {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.fp > * {
  min-width: 0;
}

.fp-ib {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: #f1f3f6;
  color: #0b1220;
  cursor: pointer;
}

.fp-ib:hover {
  background: #e8ebf0;
}

.fp-ib:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.fp-ib:disabled {
  cursor: progress;
}

.fp-spin {
  animation: fp-sp 0.8s linear infinite;
}

@keyframes fp-sp {
  to {
    transform: rotate(360deg);
  }
}

.fp-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
}

.fp-upd {
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.fp-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
  outline: none;
}

.fp-grid {
  display: grid;
  grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.fp-grid > * {
  min-width: 0;
}

.fp-left {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.fp-det {
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

.fp-page {
  min-width: 0;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.fp-lost {
  padding: 30px 18px;
  text-align: center;
  color: #5b6676;
}

.fp-none {
  display: grid;
  padding-bottom: 8px;
}

.fp-gt {
  margin: 0;
  padding: 14px 16px 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.fp-att {
  display: grid;
  margin: 6px 8px 14px;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.fp-att button {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 64px;
  padding: 10px 14px;
  border: 0;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.fp-att button + button {
  border-top: 1px solid #eceef2;
}

.fp-att button:hover {
  background: #fafbfc;
}

.fp-att button:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.fp-att .ai {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #fff2df;
  color: #8f4406;
}

.fp-att button > span:nth-child(2) {
  display: grid;
  gap: 1px;
}

.fp-att b {
  font-size: 0.92rem;
  font-weight: 800;
}

.fp-att em {
  font-size: 0.8rem;
  font-style: normal;
  color: #5b6676;
}

.fp-hint {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 26px 16px 10px;
  text-align: center;
}

.fp-hint :deep(.v-icon) {
  color: #c7ccd6;
}

.fp-hint b {
  font-size: 0.98rem;
  font-weight: 800;
}

.fp-hint p {
  max-width: 320px;
  margin: 0;
  font-size: 0.84rem;
  color: #5b6676;
}

.fp-hint kbd {
  padding: 0 5px;
  border: 1.5px solid #dfe3ea;
  border-radius: 6px;
  font: 700 0.74rem ui-monospace, Menlo, Consolas, monospace;
}

/* Uža stranica: spisak ili detalj, nikad oboje (detalj je zasebna stranica). */
@media (max-width: 1099px) {
  .fp-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fp-spin {
    animation: none;
  }
}
</style>
