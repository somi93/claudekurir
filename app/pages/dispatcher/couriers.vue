<template>
  <GlobalPage :max-width="1200">
    <template #header>
      <PageHeader
        :title="inPhoneDetail && selected ? selected.name : 'Kuriri'"
        back-to="/"
        :back-label="inPhoneDetail ? 'Nazad na listu kurira' : 'Nazad na početnu'"
        :intercept-back="inPhoneDetail"
        @back="view.close()"
      >
        <template #subtitle>
          <template v-if="inPhoneDetail && selected">#{{ selected.id }}</template>
          <template v-else-if="roster.state.value === 'ready'">
            {{ couriersText(view.totals.value.all) }} · {{ view.totals.value.delivering + view.totals.value.online }} uživo
          </template>
        </template>
        <template v-if="!inPhoneDetail" #actions>
          <div class="cp-acts">
            <button type="button" class="cp-btn cp-wide" data-page="group-message" @click="openGroupMessage">
              <v-icon icon="mdi-bullhorn-outline" size="18" />Grupna poruka
            </button>
            <button type="button" class="cp-btn cp-btn--primary cp-wide" data-page="add" @click="openSheet('nova')">
              <v-icon icon="mdi-plus" size="18" />Dodaj kurira
            </button>
            <button
              type="button"
              class="cp-btn cp-btn--primary cp-icon cp-narrow"
              data-page="add-icon"
              aria-label="Dodaj kurira"
              @click="openSheet('nova')"
            >
              <v-icon icon="mdi-plus" size="22" />
            </button>
            <v-menu location="bottom end">
              <template #activator="{ props: menu }">
                <button
                  v-bind="menu"
                  type="button"
                  class="cp-btn cp-icon cp-narrow"
                  data-page="more"
                  aria-label="Više radnji"
                >
                  <v-icon icon="mdi-dots-vertical" size="22" />
                </button>
              </template>
              <v-list density="comfortable" role="menu" aria-label="Više radnji">
                <v-list-item role="menuitem" title="Grupna poruka" prepend-icon="mdi-bullhorn-outline" @click="openGroupMessage" />
                <v-list-item
                  role="menuitem"
                  title="Izaberi više kurira"
                  prepend-icon="mdi-checkbox-marked-circle-outline"
                  @click="view.startSelect()"
                />
                <v-list-item role="menuitem" title="Osvježi listu" prepend-icon="mdi-refresh" @click="roster.refresh()" />
              </v-list>
            </v-menu>
          </div>
        </template>
      </PageHeader>
    </template>

    <div class="cp" :class="{ 'cp--detail': Boolean(selected) }">
      <RosterFilters
        class="cp-filters"
        :counts="view.totals.value"
        :live="view.live.value"
        :flags="view.flags.value"
        :has-filter="view.hasFilter.value"
        :balances-failed="roster.balancesFailed.value"
        :summary-failed="roster.summaryFailed.value"
        :locations-failed="roster.locationsFailed.value"
        @live="view.setLive"
        @flag="view.toggleFlag"
        @reset="view.reset"
      />

      <div class="cp-grid">
        <RosterList
          ref="listEl"
          class="cp-list"
          v-model:q="view.q.value"
          :state="roster.state.value"
          :stale="roster.stale.value"
          :error-text="errorText"
          :total="view.totals.value.all"
          :matched-count="view.matched.value.length"
          :items="view.visible.value"
          :now="roster.now.value"
          :currency="roster.currency.value"
          :cash-limit="roster.cashLimit.value"
          :updated-at="roster.updatedAt.value"
          :refreshing="roster.refreshing.value"
          :sort="view.sort.value"
          :selected-id="view.selectedId.value"
          :pin-id="view.pinId.value"
          :flash-ids="flashIds"
          :select="view.select.value"
          :picked="view.picked.value"
          @sort="view.setSort"
          @open="onOpen"
          @pick="view.togglePick"
          @more="view.more()"
          @refresh="roster.refresh()"
          @retry="roster.refresh()"
          @reset="view.reset"
          @add="openSheet('nova')"
          @start-select="view.startSelect()"
          @end-select="view.endSelect()"
          @bulk-message="openBulkMessage"
        />

        <aside class="cp-det" aria-label="Detalji kurira">
          <RosterDetail
            v-if="selected"
            ref="detailEl"
            :courier="selected"
            :now="roster.now.value"
            :currency="roster.currency.value"
            :cash-limit="roster.cashLimit.value"
            :messages="{ items: recent.items.value, loading: recent.loading.value, failed: recent.failed.value }"
            @close="view.close()"
            @sheet="(kind, focus) => openSheet(kind, focus)"
            @retry-messages="recent.reload()"
          />
          <div v-else class="cp-none">
            <template v-if="roster.state.value === 'ready'">
              <div class="cp-none-h">
                <v-icon icon="mdi-account-search-outline" size="34" />
                <b>Izaberi kurira</b>
                <p>
                  Detalji, poziv, poruka i izmjene pojavljuju se ovdje. Strelice mijenjaju izbor, Enter
                  otvara, <kbd>/</kbd> traži.
                </p>
              </div>
              <template v-if="attention.length">
                <h3 class="cp-gt">Šta traži pažnju</h3>
                <div class="cp-att">
                  <button
                    v-for="item in attention"
                    :key="item.flag"
                    type="button"
                    class="cp-att-r"
                    :data-attention="item.flag"
                    @click="view.toggleFlag(item.flag)"
                  >
                    <span class="cp-att-ic"><v-icon :icon="item.icon" size="20" /></span>
                    <span>
                      <b>{{ item.title }}</b>
                      <em>{{ item.sub }}</em>
                    </span>
                    <v-icon icon="mdi-chevron-right" size="20" />
                  </button>
                </div>
              </template>
            </template>
            <div v-else class="cp-none-h">
              <v-icon icon="mdi-account-search-outline" size="34" />
              <b>Izaberi kurira</b>
              <p>Detalji se pojavljuju kad se lista učita.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <template v-if="sheetCourier">
      <ContactSheet
        :open="active?.kind === 'kontakt'"
        :courier="sheetCourier"
        :roster="roster.roster.value"
        :save="(p) => roster.update(sheetCourier!.id, p)"
        :focus="active?.focus ?? null"
        @update:open="closeSheet('kontakt', $event)"
      />
      <VehicleSheet
        :open="active?.kind === 'vozilo'"
        :courier="sheetCourier"
        :save="(p) => roster.update(sheetCourier!.id, p)"
        @update:open="closeSheet('vozilo', $event)"
      />
      <ContractSheet
        :open="active?.kind === 'ugovor'"
        :courier="sheetCourier"
        :currency="roster.currency.value"
        :save="(p) => roster.update(sheetCourier!.id, p)"
        @update:open="closeSheet('ugovor', $event)"
      />
      <PersonalSheet
        :open="active?.kind === 'licni'"
        :courier="sheetCourier"
        :save="(p) => roster.update(sheetCourier!.id, p)"
        :focus="active?.focus ?? null"
        @update:open="closeSheet('licni', $event)"
      />
      <NoteSheet
        :open="active?.kind === 'napomena'"
        :courier="sheetCourier"
        :save="(p) => roster.update(sheetCourier!.id, p)"
        @update:open="closeSheet('napomena', $event)"
      />
      <PasswordSheet
        :open="active?.kind === 'lozinka'"
        :courier="sheetCourier"
        :save="(p) => roster.update(sheetCourier!.id, p)"
        @update:open="closeSheet('lozinka', $event)"
        @done="onPasswordDone"
      />
      <SuspendSheet
        :open="active?.kind === 'suspenduj' || active?.kind === 'aktiviraj'"
        :courier="sheetCourier"
        :activate="active?.kind === 'aktiviraj'"
        :now="roster.now.value"
        :currency="roster.currency.value"
        :save="(suspended, reason) => roster.setSuspended(sheetCourier!.id, suspended, reason)"
        @update:open="closeSheet(active?.kind ?? 'suspenduj', $event)"
      />
      <RemoveSheet
        :open="active?.kind === 'ukloni'"
        :courier="sheetCourier"
        :now="roster.now.value"
        :currency="roster.currency.value"
        :remove="() => roster.remove(sheetCourier!.id)"
        @update:open="closeSheet('ukloni', $event)"
        @removed="onRemoved"
      />
      <CashSheet
        :open="active?.kind === 'uplata' || active?.kind === 'isplata'"
        :courier="sheetCourier"
        :mode="active?.kind === 'isplata' ? 'payout' : 'receipt'"
        :currency="roster.currency.value"
        :receipt-save="(amount, note) => roster.receipt(sheetCourier!.id, amount, note)"
        :payout-save="(amount, method, key) => roster.payout(sheetCourier!.id, amount, method, key)"
        @update:open="closeSheet(active?.kind ?? 'uplata', $event)"
      />
    </template>

    <MessageSheet
      :open="active?.kind === 'poruka'"
      :recipients="msg.recipients"
      :who="msg.who"
      :everyone="msg.everyone"
      :send="(ids, draft) => roster.message(ids, draft)"
      @update:open="closeSheet('poruka', $event)"
      @sent="onMessageSent"
    />
    <CreateSheet
      :open="active?.kind === 'nova'"
      :roster="roster.roster.value"
      :currency="roster.currency.value"
      :create="(payload) => roster.create(payload)"
      @update:open="closeSheet('nova', $event)"
      @created="onCreated"
    />
    <CredentialsSheet
      v-if="creds.courier"
      :open="active?.kind === 'creds'"
      :courier="creds.courier"
      :password="creds.password"
      :created="creds.created"
      @update:open="closeSheet('creds', $event)"
      @again="openSheet('nova')"
      @open-profile="openProfile"
    />
  </GlobalPage>
</template>

<script setup lang="ts">
definePageMeta({ title: "Kuriri" });

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router";
import GlobalPage from "~/components/common/GlobalPage.vue";
import PageHeader from "~/components/common/PageHeader.vue";
import CashSheet from "~/components/dispatcher/roster/CashSheet.vue";
import ContactSheet from "~/components/dispatcher/roster/ContactSheet.vue";
import ContractSheet from "~/components/dispatcher/roster/ContractSheet.vue";
import CreateSheet from "~/components/dispatcher/roster/CreateSheet.vue";
import CredentialsSheet from "~/components/dispatcher/roster/CredentialsSheet.vue";
import MessageSheet from "~/components/dispatcher/roster/MessageSheet.vue";
import NoteSheet from "~/components/dispatcher/roster/NoteSheet.vue";
import PasswordSheet from "~/components/dispatcher/roster/PasswordSheet.vue";
import PersonalSheet from "~/components/dispatcher/roster/PersonalSheet.vue";
import RemoveSheet from "~/components/dispatcher/roster/RemoveSheet.vue";
import RosterDetail from "~/components/dispatcher/roster/RosterDetail.vue";
import RosterFilters from "~/components/dispatcher/roster/RosterFilters.vue";
import RosterList from "~/components/dispatcher/roster/RosterList.vue";
import SuspendSheet from "~/components/dispatcher/roster/SuspendSheet.vue";
import VehicleSheet from "~/components/dispatcher/roster/VehicleSheet.vue";
import { useCourierRoster } from "~/composables/useCourierRoster";
import { useRecentMessages } from "~/composables/useRecentMessages";
import { WIDE_QUERY, useRosterView } from "~/composables/useRosterView";
import { interceptLeaving } from "~/composables/useSheetGuard";
import { storeToRefs } from "pinia";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { pluralizeSr } from "~/utils/datetime";
import {
  couriersText,
  isEveryone,
  type RosterCourier,
  type RosterFlag,
  type RosterSheetKind,
} from "~/utils/courierRoster";

// Dispečerska lista kurira: lista sa pločicama stanja uživo, oznakama pažnje i pretragom, a uz nju
// detalj izabranog kurira (na telefonu detalj je zasebna stranica, ?c=ID). Svaka izmjena je donji
// list koji šalje samo izmijenjena polja. Stanje (izabrani kurir, pretraga, filteri, redoslijed)
// živi u adresi. Vidi docs/2026/10/04_10_2026_Frontend_pitanja_za_backend.textile (dio 3).
const roster = useCourierRoster();
const view = useRosterView(roster.roster, roster.now);
const { errorMessage: companiesError } = storeToRefs(useDeliveryCompaniesStore());

const errorText = computed(() => roster.rowsError.value || companiesError.value);
const selected = computed(() => view.selected.value);

// Poruke izabranog kurira se čitaju tek kad se otvori detalj.
const recent = useRecentMessages(computed(() => view.selectedId.value));

const listEl = ref<InstanceType<typeof RosterList> | null>(null);
const detailEl = ref<InstanceType<typeof RosterDetail> | null>(null);

// --- Širina: na računaru su lista i detalj uz jedno drugo, na telefonu je detalj stranica ------

const wide = ref(true);
let mq: MediaQueryList | null = null;
const syncWide = () => {
  wide.value = mq?.matches ?? true;
};
const inPhoneDetail = computed(() => !wide.value && Boolean(selected.value));

// --- Oznake pažnje u praznom detalju -----------------------------------------------------------

const attention = computed(() => {
  const t = view.totals.value;
  const items: { flag: RosterFlag; icon: string; title: string; sub: string }[] = [
    {
      flag: "debt",
      icon: "mdi-cash-multiple",
      title: `${t.debt} ${pluralizeSr(t.debt, "kurir duguje", "kurira duguju", "kurira duguje")} gotovinu`,
      sub: "Pogledaj ko je blizu limita",
    },
    {
      flag: "unread",
      icon: "mdi-message-text-outline",
      title: `${t.unread} ${pluralizeSr(t.unread, "kurir nije", "kurira nisu", "kurira nije")} pročitalo poruku`,
      sub: "Prije slanja nove provjeri da li su vidjeli staru",
    },
    {
      flag: "noVehicle",
      icon: "mdi-alert-outline",
      title: `${t.noVehicle} bez vozila`,
      sub: "Bez vozila ne mogu da dobiju narudžbu",
    },
    {
      flag: "suspended",
      icon: "mdi-account-off-outline",
      title: `${t.suspended} ${pluralizeSr(t.suspended, "suspendovan", "suspendovana", "suspendovanih")}`,
      sub: "Provjeri razloge i aktiviraj",
    },
  ];
  return items.filter((i) => t[i.flag] > 0);
});

// --- Listovi ------------------------------------------------------------------------------------

type Active = { kind: RosterSheetKind | "creds"; focus?: string | null };
const active = ref<Active | null>(null);

// Kurir nad kojim je list. Ostaje poslednji kurir i kad se list zatvori, da se list ne razmonta
// usred zatvaranja (animacija i povratak fokusa); poslije uklanjanja ostaje poslednja kopija.
const sheetId = ref<number | null>(null);
const sheetCourier = shallowRef<RosterCourier | null>(null);
watch(
  [roster.roster, sheetId],
  ([list, id]) => {
    const found = id == null ? null : list.find((c) => c.id === id);
    if (found) sheetCourier.value = found;
  },
  { immediate: true }
);

const msg = reactive<{ recipients: RosterCourier[]; who: string; everyone: boolean }>({
  recipients: [],
  who: "",
  everyone: false,
});

const creds = reactive<{ courier: RosterCourier | null; password: string; created: boolean }>({
  courier: null,
  password: "",
  created: false,
});

const openSheet = (kind: RosterSheetKind, focus?: string | null) => {
  if (kind === "poruka") {
    if (!selected.value) return;
    msg.recipients = [selected.value];
    msg.who = "";
    msg.everyone = false;
  }
  if (kind !== "nova" && kind !== "poruka") {
    if (!selected.value) return;
    sheetId.value = selected.value.id;
    sheetCourier.value = selected.value;
  }
  active.value = { kind, focus: focus ?? null };
};

// Grupna poruka: svi koje lista trenutno prikazuje (filter već kaže ko je primalac).
const openGroupMessage = () => {
  const list = view.matched.value;
  if (list.length === 0) return;
  msg.recipients = list;
  msg.everyone = isEveryone(list.map((c) => c.id), roster.roster.value);
  msg.who = msg.everyone ? "Nijedan filter nije uključen" : "Svi koje trenutno vidiš u listi";
  active.value = { kind: "poruka" };
};

const openBulkMessage = () => {
  const ids = view.picked.value;
  const list = roster.roster.value.filter((c) => ids.has(c.id));
  if (list.length === 0) return;
  msg.recipients = list;
  msg.everyone = isEveryone(list.map((c) => c.id), roster.roster.value);
  msg.who = "Izabrani u listi";
  active.value = { kind: "poruka" };
};

// Zatvaranje: samo ako je list koji javlja zatvaranje još onaj koji je otvoren (kartica sa
// podacima za prijavu se otvara dok se prethodni list zatvara, pa ga ne smije zatvoriti).
const closeSheet = (kind: RosterSheetKind | "creds", open: boolean) => {
  if (open) return;
  if (active.value && (active.value.kind === kind || sameGroup(active.value.kind, kind))) active.value = null;
};
const sameGroup = (a: string, b: string) =>
  (a === "suspenduj" || a === "aktiviraj") && (b === "suspenduj" || b === "aktiviraj")
    ? true
    : (a === "uplata" || a === "isplata") && (b === "uplata" || b === "isplata");

// --- Posljedice radnji ------------------------------------------------------------------------

const flashIds = ref<Set<number>>(new Set());
const flash = (...ids: number[]) => {
  flashIds.value = new Set([...flashIds.value, ...ids]);
  setTimeout(() => {
    flashIds.value = new Set([...flashIds.value].filter((id) => !ids.includes(id)));
  }, 2000);
};

const showCredentials = (courier: RosterCourier | null, password: string, created: boolean) => {
  if (!courier) return;
  creds.courier = courier;
  creds.password = password;
  creds.created = created;
  active.value = { kind: "creds" };
};

const onPasswordDone = (password: string) => {
  showCredentials(sheetCourier.value, password, false);
};

const onCreated = async ({ id, password }: { id: number; password: string }) => {
  sheetId.value = id;
  const courier = roster.roster.value.find((c) => c.id === id) ?? null;
  showCredentials(courier, password, true);
  flash(id);
  await view.showNew(id);
};

const openProfile = () => {
  active.value = null;
  if (creds.courier) {
    void view.open(creds.courier.id);
    void nextTick(() => detailEl.value?.focusTitle());
  }
};

const onRemoved = () => {
  // Kurir više nije u listi; adresa se čisti sama (useRosterView), a list je već zatvoren.
  active.value = null;
};

const onMessageSent = (ids: number[]) => {
  view.endSelect();
  flash(...ids);
  if (view.selectedId.value != null && ids.includes(view.selectedId.value)) recent.reload();
};

const onOpen = (id: number) => view.open(id);

// --- Fokus i prečice ----------------------------------------------------------------------------

// Na telefonu detalj je stranica: fokus ide na naslov, a pri povratku na red koji je bio otvoren.
watch(
  () => view.selectedId.value,
  async (id, old) => {
    await nextTick();
    if (wide.value) return;
    if (id != null && old == null) {
      window.scrollTo({ top: 0 });
      detailEl.value?.focusTitle();
    } else if (id == null && old != null) {
      listEl.value?.focusRow(old);
    }
  }
);

const typingIn = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.matches("input, textarea, select") || el.isContentEditable);

const onKey = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (active.value || document.querySelector(".v-overlay--active")) return;
  if (event.key === "/" && !typingIn(event.target) && wide.value) {
    event.preventDefault();
    listEl.value?.focusSearch();
  } else if (event.key === "Escape" && !typingIn(event.target) && wide.value && view.selectedId.value != null) {
    const id = view.selectedId.value;
    view.close();
    listEl.value?.focusRow(id);
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

// Dugme Nazad (i odlazak sa stranice) dok list ima neosnimljen unos: list pita, ne gubi ga. Dok je
// list otvoren, Nazad zatvara list, a ne detalj ispod njega.
onBeforeRouteUpdate((to, from) => {
  if (active.value && from.query.c && !to.query.c) {
    if (!interceptLeaving()) active.value = null;
    return false;
  }
});
onBeforeRouteLeave(() => {
  if (interceptLeaving()) return false;
});
</script>

<style scoped>
.cp {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.cp > * {
  min-width: 0;
}

.cp-grid {
  display: grid;
  grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.cp-grid > * {
  min-width: 0;
}

.cp-det {
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

.cp-acts {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1.5px solid #dfe3ea;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.cp-btn:active {
  background: #f1f4f9;
}

.cp-btn:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.cp-btn--primary {
  border-color: #0b1220;
  background: #0b1220;
  color: #fff;
  box-shadow: 0 6px 16px -8px rgba(11, 18, 32, 0.5);
}

.cp-btn--primary:active {
  background: #1b2638;
}

.cp-icon {
  width: 44px;
  padding: 0;
}

.cp-narrow {
  display: none;
}

.cp-none {
  padding-bottom: 8px;
}

.cp-none-h {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 26px 16px 10px;
  text-align: center;
}

.cp-none-h .v-icon {
  color: #c7ccd6;
}

.cp-none-h b {
  font-size: 0.98rem;
  font-weight: 800;
}

.cp-none-h p {
  max-width: 320px;
  margin: 0;
  font-size: 0.84rem;
  color: #5b6676;
}

.cp-none-h kbd {
  padding: 0 5px;
  border: 1.5px solid #dfe3ea;
  border-radius: 6px;
  font: 700 0.74rem ui-monospace, Menlo, Consolas, monospace;
}

.cp-gt {
  margin: 0;
  padding: 14px 16px 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5b6676;
}

.cp-att {
  display: grid;
  margin: 0 8px 14px;
  overflow: hidden;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.cp-att-r {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 64px;
  padding: 12px 14px;
  border: 0;
  background: #fff;
  color: #0b1220;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.cp-att-r + .cp-att-r {
  border-top: 1px solid #eceef2;
}

.cp-att-r:active {
  background: #f1f4f9;
}

.cp-att-r:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: -3px;
}

.cp-att-ic {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #fff2df;
  color: #9a4a07;
}

.cp-att-r span:nth-child(2) {
  display: grid;
  gap: 1px;
}

.cp-att-r b {
  font-size: 0.98rem;
}

.cp-att-r em {
  font-size: 0.8rem;
  font-style: normal;
  color: #5b6676;
}

/* Uža stranica: lista ili detalj, nikad oboje. */
@media (max-width: 1099px) {
  .cp-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .cp--detail .cp-filters,
  .cp--detail .cp-list {
    display: none;
  }

  .cp:not(.cp--detail) .cp-det {
    display: none;
  }

  .cp-det {
    position: static;
    max-height: none;
    overflow: visible;
    background: none;
    box-shadow: none;
    border-radius: 0;
  }
}

@media (max-width: 700px) {
  .cp-wide {
    display: none;
  }

  .cp-narrow {
    display: inline-flex;
  }
}
</style>
