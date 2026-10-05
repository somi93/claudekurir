<template>
  <section class="rl" aria-label="Lista kurira">
    <div class="rl-tb">
      <div class="rl-search">
        <v-icon icon="mdi-magnify" size="22" aria-hidden="true" />
        <input
          ref="searchEl"
          :value="q"
          type="search"
          inputmode="search"
          enterkeyhint="search"
          autocomplete="off"
          spellcheck="false"
          placeholder="Ime, telefon ili #ID"
          aria-label="Pretraži kurire po imenu, telefonu ili ID-u"
          data-roster="search"
          @input="emit('update:q', ($event.target as HTMLInputElement).value)"
          @keydown="onSearchKey"
        />
        <kbd v-if="!q" aria-hidden="true">/</kbd>
        <button
          v-if="q"
          type="button"
          class="rl-x"
          aria-label="Obriši pretragu"
          @click="clearSearch"
        >
          <v-icon icon="mdi-close" size="20" />
        </button>
      </div>
      <div class="rl-tools">
        <v-menu location="bottom end">
          <template #activator="{ props: menu }">
            <button
              v-bind="menu"
              type="button"
              class="btn"
              data-roster="sort"
              aria-haspopup="menu"
              :aria-label="`Redoslijed: ${SORT_LABELS[sort]}`"
            >
              <v-icon icon="mdi-sort-variant" size="20" />
              <span class="rl-sortlabel">{{ SORT_LABELS[sort] }}</span>
            </button>
          </template>
          <v-list density="comfortable" role="menu" aria-label="Redoslijed">
            <v-list-item
              v-for="(label, key) in SORT_LABELS"
              :key="key"
              role="menuitemradio"
              :aria-checked="sort === key"
              :title="label"
              :active="sort === key"
              :data-sort="key"
              @click="emit('sort', key)"
            >
              <template v-if="sort === key" #prepend>
                <v-icon icon="mdi-check" size="18" />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
        <button
          type="button"
          class="btn btn--icon"
          data-roster="select"
          :aria-pressed="select"
          aria-label="Izaberi više kurira"
          @click="select ? emit('endSelect') : emit('startSelect')"
        >
          <v-icon icon="mdi-checkbox-marked-circle-outline" size="22" />
        </button>
      </div>
    </div>

    <div v-if="state === 'ready'" class="rl-sub" aria-live="polite">
      <span>
        <b>{{ matchedCount }}</b>
        {{ matchedCount === total ? pluralizeSr(matchedCount, "kurir", "kurira", "kurira") : `od ${total}` }}
      </span>
      <span class="rl-upd">
        {{ updatedAt ? `Ažurirano ${timeLabel}` : "" }}
        <button
          type="button"
          class="btn btn--quiet"
          data-roster="refresh"
          aria-label="Osvježi listu"
          :disabled="refreshing"
          @click="emit('refresh')"
        >
          <v-icon icon="mdi-refresh" size="20" :class="{ 'is-spin': refreshing }" />
        </button>
      </span>
    </div>

    <ul v-if="state === 'loading'" class="rl-ul" role="status" aria-label="Učitavam kurire">
      <li v-for="n in 8" :key="n" aria-hidden="true">
        <div class="sk-row">
          <i class="b sk-av" />
          <span class="sk-tx"><i class="b" style="width: 62%; height: 14px" /><i class="b" style="width: 44%; height: 12px" /></span>
          <i class="b" style="width: 78px; height: 26px; border-radius: 999px" />
        </div>
      </li>
    </ul>

    <div v-else-if="state === 'error'" class="rl-empty" role="alert">
      <v-icon icon="mdi-cloud-off-outline" size="34" />
      <b>Ne mogu da učitam kurire</b>
      <p>{{ errorText || "Server ne odgovara." }} Pokušaj ponovo.</p>
      <button type="button" class="btn btn--primary" data-roster="retry" @click="emit('retry')">
        <v-icon icon="mdi-refresh" size="18" />Pokušaj ponovo
      </button>
    </div>

    <div v-else-if="state === 'nofirm'" class="rl-empty">
      <v-icon icon="mdi-domain" size="34" />
      <b>Nema dostavne firme</b>
      <p>Tvoj nalog nije povezan ni sa jednom dostavnom firmom, pa nema kurira za prikaz.</p>
    </div>

    <div v-else-if="state === 'empty'" class="rl-empty">
      <v-icon icon="mdi-account-group-outline" size="34" />
      <b>Još nema kurira u ovoj firmi</b>
      <p>Dodaj prvog kurira. Dobićeš korisničko ime i lozinku koje mu predaješ.</p>
      <button type="button" class="btn btn--primary" data-roster="empty-add" @click="emit('add')">
        <v-icon icon="mdi-plus" size="18" />Dodaj kurira
      </button>
    </div>

    <template v-else>
      <div v-if="stale" class="rl-stale">
        <TintAlert tone="warn" icon="mdi-cloud-off-outline" title="Ne mogu da osvježim listu">
          Prikazani su podaci od {{ timeLabel }}.
          <template #action>
            <button type="button" data-roster="retry" @click="emit('retry')">Pokušaj ponovo</button>
          </template>
        </TintAlert>
      </div>

      <div v-if="items.length === 0" class="rl-empty">
        <v-icon icon="mdi-magnify-close" size="34" />
        <b>{{ q.trim() ? `Nema kurira za „${q.trim()}“` : "Nema kurira za ovaj filter" }}</b>
        <p>
          {{
            q.trim()
              ? "Pretraga razumije ime sa i bez dijakritika, ćirilicu, telefon u bilo kom zapisu i #ID."
              : "Probaj da skineš neki filter."
          }}
        </p>
        <button type="button" class="btn" data-roster="reset" @click="emit('reset')">Očisti filtere</button>
      </div>

      <ul v-else class="rl-ul" aria-label="Kuriri" @keydown="onListKey">
        <RosterRow
          v-for="c in items"
          :key="c.id"
          :courier="c"
          :now="now"
          :currency="currency"
          :cash-limit="cashLimit"
          :selected="selectedId === c.id"
          :picking="select"
          :picked="picked.has(c.id)"
          :is-new="pinId === c.id"
          :flash="flashIds.has(c.id)"
          :tabbable="c.id === tabId"
          @open="emit('open', c.id)"
          @pick="emit('pick', c.id)"
        />
      </ul>

      <div v-if="matchedCount > items.length" class="rl-more">
        <span>Prikazano {{ items.length }} od {{ matchedCount }}</span>
        <button type="button" class="btn" data-roster="more" @click="emit('more')">
          Prikaži još {{ Math.min(PAGE_ROWS, matchedCount - items.length) }}
        </button>
      </div>

      <div v-if="select" class="rl-bulk" role="region" aria-label="Izabrani kuriri">
        <b>{{ picked.size ? `${picked.size} izabrano` : "Izaberi kurire" }}</b>
        <button
          type="button"
          class="btn"
          data-roster="bulk-message"
          :disabled="picked.size === 0"
          @click="emit('bulkMessage')"
        >
          <v-icon icon="mdi-message-text-outline" size="18" />Poruka
        </button>
        <button type="button" class="btn btn--ghost" data-roster="end-select" @click="emit('endSelect')">
          Gotovo
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import RosterRow from "~/components/dispatcher/roster/RosterRow.vue";
import { PAGE_ROWS, WIDE_QUERY } from "~/composables/useRosterView";
import type { RosterState } from "~/composables/useCourierRoster";
import { SORT_LABELS, type RosterCourier, type RosterSort } from "~/utils/courierRoster";
import { pluralizeSr } from "~/utils/datetime";

// Kartica sa listom: pretraga, redoslijed, izbor više kurira, brojač i osvježavanje, pa jedno od
// stanja (učitavanje, greška, nema firme, prazna firma, nema rezultata) ili redovi. Greška,
// prazna firma i učitavanje nikad ne izgledaju isto. Strelice, Home i End kreću se po listi
// (jedan stop za Tab); na računaru strelice mijenjaju i izbor.
const props = defineProps<{
  state: RosterState;
  stale: boolean;
  errorText: string;
  total: number;
  matchedCount: number;
  items: RosterCourier[];
  now: number;
  currency: string;
  cashLimit: number | null;
  updatedAt: number | null;
  refreshing: boolean;
  q: string;
  sort: RosterSort;
  selectedId: number | null;
  pinId: number | null;
  flashIds: Set<number>;
  select: boolean;
  picked: Set<number>;
}>();

const emit = defineEmits<{
  "update:q": [string];
  sort: [RosterSort];
  open: [number];
  pick: [number];
  more: [];
  refresh: [];
  retry: [];
  reset: [];
  add: [];
  startSelect: [];
  endSelect: [];
  bulkMessage: [];
}>();

const searchEl = ref<HTMLInputElement | null>(null);
const focusedId = ref<number | null>(null);

// Jedini red u redoslijedu tastera Tab: red na kome je fokus, pa izabrani, pa prvi.
const tabId = computed(() => {
  const ids = props.items.map((c) => c.id);
  if (focusedId.value != null && ids.includes(focusedId.value)) return focusedId.value;
  if (props.selectedId != null && ids.includes(props.selectedId)) return props.selectedId;
  return ids[0] ?? null;
});

const timeLabel = computed(() =>
  props.updatedAt ? new Date(props.updatedAt).toLocaleTimeString("sr-RS") : ""
);

const clearSearch = () => {
  emit("update:q", "");
  searchEl.value?.focus();
};

const rowButtons = () =>
  [...(document.querySelectorAll<HTMLElement>("[data-row^='row:']"))].filter((n) => n.offsetParent !== null);

const onSearchKey = (event: KeyboardEvent) => {
  if (event.key === "Escape" && props.q) {
    event.preventDefault();
    clearSearch();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    rowButtons()[0]?.focus();
  } else if (event.key === "Enter" && !props.select) {
    const first = props.items[0];
    if (first) {
      event.preventDefault();
      emit("open", first.id);
    }
  }
};

const onListKey = async (event: KeyboardEvent) => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-row^='row:']");
  if (!target || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = rowButtons();
  const at = buttons.indexOf(target);
  const next =
    event.key === "ArrowDown"
      ? Math.min(buttons.length - 1, at + 1)
      : event.key === "ArrowUp"
        ? Math.max(0, at - 1)
        : event.key === "Home"
          ? 0
          : buttons.length - 1;
  const el = buttons[next];
  if (!el) return;
  const id = Number(el.dataset.row?.slice(4));
  focusedId.value = id;
  await nextTick();
  el.focus();
  // Na računaru izbor ide za strelicama (detalj uz listu), na telefonu detalj je stranica.
  if (!props.select && window.matchMedia(WIDE_QUERY).matches) emit("open", id);
};

defineExpose({
  focusSearch: () => searchEl.value?.focus(),
  focusRow: (id: number) => {
    focusedId.value = id;
    void nextTick(() =>
      document.querySelector<HTMLElement>(`[data-row="row:${id}"]`)?.focus({ preventScroll: true })
    );
  },
});
</script>

<style scoped>
.rl {
  min-width: 0;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.rl-tb {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 12px 12px 8px;
}

.rl-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 48px;
  padding: 0 4px 0 12px;
  border-radius: 14px;
  background: #f5f6f8;
  box-shadow: inset 0 0 0 2px transparent;
  transition: box-shadow 0.15s, background 0.15s;
}

.rl-search:focus-within {
  background: #fff;
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.rl-search input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0;
  border: 0;
  outline: 0;
  background: none;
  color: #0b1220;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  appearance: none;
}

.rl-search input::-webkit-search-cancel-button {
  display: none;
}

.rl-search input::placeholder {
  color: #657083;
  font-weight: 500;
  opacity: 1;
}

.rl-search kbd {
  margin-right: 6px;
  padding: 1px 6px;
  border: 1.5px solid #dfe3ea;
  border-radius: 6px;
  color: #657083;
  font: 700 0.7rem ui-monospace, Menlo, Consolas, monospace;
}

.rl-x {
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

.rl-tools {
  display: flex;
  gap: 8px;
}

.btn {
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

.rl-tools .btn {
  min-height: 48px;
}

.btn:active {
  background: #f1f4f9;
}

.btn:focus-visible,
.rl-x:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--icon {
  width: 48px;
  padding: 0;
}

.btn--icon[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.btn--quiet {
  border-color: transparent;
  background: none;
}

.btn--primary {
  border-color: #0b1220;
  background: #0b1220;
  color: #fff;
  box-shadow: 0 6px 16px -8px rgba(11, 18, 32, 0.5);
}

.btn--primary:active {
  background: #1b2638;
}

.btn--ghost {
  border-color: #4a5568;
  background: transparent;
  color: #fff;
}

.rl-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 0 8px 4px 14px;
  font-size: 0.78rem;
  color: #5b6676;
}

.rl-sub b {
  font-weight: 800;
  color: #0b1220;
}

.rl-upd {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}

.is-spin {
  animation: rl-spin 0.8s linear infinite;
}

@keyframes rl-spin {
  to {
    transform: rotate(360deg);
  }
}

.rl-ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rl-stale {
  padding: 0 12px 8px;
}

.rl-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 34px 20px;
  text-align: center;
}

.rl-empty .v-icon {
  color: #c7ccd6;
}

.rl-empty b {
  font-size: 0.98rem;
  font-weight: 800;
}

.rl-empty p {
  max-width: 300px;
  margin: 0;
  font-size: 0.84rem;
  color: #5b6676;
}

.rl-empty .btn {
  margin-top: 6px;
}

.rl-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px 14px;
  border-top: 1px solid #eceef2;
  border-radius: 0 0 20px 20px;
  font-size: 0.8rem;
  color: #5b6676;
}

/* Traka ostaje uz dno ekrana dok se lista skroluje; kartica zato nema overflow:hidden. */
.rl-bulk {
  position: sticky;
  bottom: 10px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 10px 10px;
  padding: 8px 10px 8px 16px;
  border-radius: 16px;
  background: #0b1220;
  color: #fff;
  box-shadow: 0 10px 24px -8px rgba(11, 18, 32, 0.5);
}

.rl-bulk b {
  flex: 1;
  font-size: 0.9rem;
}

.rl-bulk .btn:not(.btn--ghost) {
  border-color: #fff;
  background: #fff;
  color: #0b1220;
}

.sk-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 12px 14px;
  border-top: 1px solid #eceef2;
}

li:first-child > .sk-row {
  border-top: 0;
}

.sk-tx {
  display: grid;
  gap: 8px;
}

.sk-av {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.b {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 50%, #eef0f4 100%);
  background-size: 200% 100%;
  animation: rl-sh 1.3s linear infinite;
}

@keyframes rl-sh {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 480px) {
  .rl-sortlabel {
    display: none;
  }

  .rl-tools .btn[data-roster="sort"] {
    width: 48px;
    padding: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b,
  .is-spin {
    animation: none;
  }

  .rl-search {
    transition: none;
  }
}
</style>
