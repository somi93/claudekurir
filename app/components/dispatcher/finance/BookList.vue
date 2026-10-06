<template>
  <section class="bl" aria-label="Kuriri" :aria-busy="state === 'loading' ? 'true' : undefined">
    <div class="bl-head">
      <h2>
        Kuriri
        <small v-if="state === 'ready'" aria-live="polite">{{ countText }}</small>
      </h2>
      <button
        v-if="filter === 'wage' && counts.wage > 0 && state === 'ready'"
        type="button"
        class="bl-btn"
        data-list="batch"
        @click="emit('batch')"
      >
        <v-icon icon="mdi-cash-minus" size="18" />Isplati sve ({{ counts.wage }})
      </button>
      <v-menu location="bottom end">
        <template #activator="{ props: menu }">
          <button
            v-bind="menu"
            type="button"
            class="bl-btn"
            data-list="sort"
            aria-haspopup="menu"
            :aria-label="`Redoslijed: ${SORTS[sort]}`"
          >
            <v-icon icon="mdi-sort-variant" size="20" />
            <span class="bl-sortlabel">{{ SORTS[sort] }}</span>
          </button>
        </template>
        <v-list density="comfortable" role="menu" aria-label="Redoslijed">
          <v-list-item
            v-for="(label, key) in SORTS"
            :key="key"
            role="menuitemradio"
            :aria-checked="sort === key"
            :title="label"
            :active="sort === key"
            :data-sort="key"
            @click="emit('sort', key)"
          >
            <template v-if="sort === key" #prepend><v-icon icon="mdi-check" size="18" /></template>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <div class="bl-tb">
      <div class="bl-fbar" role="group" aria-label="Filteri">
        <button
          v-for="f in FILTER_ORDER"
          :key="f"
          type="button"
          class="bl-fp"
          :class="{ 'bl-fp--bad': f === 'limit' && counts.over > 0 }"
          :aria-pressed="filter === f"
          :disabled="state !== 'ready'"
          :data-filter="f"
          @click="emit('filter', f)"
        >
          {{ FILTER_LABELS[f] }}
          <span v-if="state === 'ready'" class="n">{{ counts[f] }}</span>
        </button>
      </div>
      <div class="bl-search">
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
          data-list="search"
          @input="emit('update:q', ($event.target as HTMLInputElement).value)"
          @keydown="onSearchKey"
        />
        <kbd v-if="!q" aria-hidden="true">/</kbd>
        <button v-if="q" type="button" class="bl-x" aria-label="Obriši pretragu" @click="clearSearch">
          <v-icon icon="mdi-close" size="20" />
        </button>
      </div>
    </div>

    <ul v-if="state === 'loading'" class="bl-ul" role="status" aria-label="Učitavam kurire">
      <li v-for="n in 5" :key="n" aria-hidden="true">
        <div class="bl-sk"><i class="b a" /><i class="b m" /><i class="b c" /></div>
      </li>
    </ul>

    <div v-else-if="state === 'error'" class="bl-pad">
      <TintAlert tone="bad" role="alert" icon="mdi-cloud-off-outline" title="Ne mogu da učitam stanje kurira">
        {{ errorText || "Server ne odgovara." }} Brojevi iznad nisu pouzdani dok se ovo ne učita.
        <template #action>
          <button type="button" data-list="retry" @click="emit('retry', 'balances')">Pokušaj ponovo</button>
        </template>
      </TintAlert>
    </div>

    <div v-else-if="state === 'nofirm'" class="bl-empty">
      <v-icon icon="mdi-domain" size="34" />
      <b>Nema dostavne firme</b>
      <p>Tvoj nalog nije povezan ni sa jednom dostavnom firmom, pa nema kurira za prikaz.</p>
    </div>

    <template v-else>
      <div v-if="stale" class="bl-pad">
        <TintAlert tone="warn" role="status" icon="mdi-cloud-off-outline" :title="`Stanje je staro ${staleAge}`">
          Osvježavanje nije uspjelo.
          <template #action>
            <button type="button" data-list="retry" @click="emit('retry', 'balances')">Pokušaj ponovo</button>
          </template>
        </TintAlert>
      </div>
      <div v-if="limitFailed" class="bl-pad">
        <TintAlert tone="info" role="status" title="Limit gotovine nije učitan">
          Oznake limita se ne prikazuju.
          <template #action>
            <button type="button" data-list="retry-settings" @click="emit('retry', 'settings')">Pokušaj ponovo</button>
          </template>
        </TintAlert>
      </div>
      <div v-if="statusFailed" class="bl-pad">
        <TintAlert tone="warn" role="status" title="Spisak kurira nije učitan">
          Imena su iz stanja novca, a žiro račun, ugovor i oznake „Nije u firmi“ se ne vide.
          <template #action>
            <button type="button" data-list="retry-status" @click="emit('retry', 'status')">Pokušaj ponovo</button>
          </template>
        </TintAlert>
      </div>

      <div v-if="items.length === 0" class="bl-empty">
        <v-icon icon="mdi-magnify-close" size="32" />
        <b>{{ emptyTitle }}</b>
        <p>{{ emptyText }}</p>
        <button v-if="q.trim() || filter !== 'all'" type="button" class="bl-btn" data-list="reset" @click="emit('reset')">
          Prikaži sve
        </button>
      </div>

      <ul v-else class="bl-ul" aria-label="Kuriri sa novcem" @keydown="onListKey">
        <BookRow
          v-for="r in items"
          :key="r.id"
          :row="r"
          :currency="currency"
          :cash-limit="cashLimit"
          :selected="selectedId === r.id"
          :flash="flash.has(r.id)"
          :tabbable="r.id === tabId"
          @open="emit('open', r.id)"
        />
      </ul>

      <div v-if="matchedCount > items.length" class="bl-more">
        <span>Prikazano {{ items.length }} od {{ matchedCount }}</span>
        <button type="button" class="bl-btn" data-list="more" @click="emit('more')">
          Prikaži još {{ Math.min(BOOK_MORE, matchedCount - items.length) }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import BookRow from "~/components/dispatcher/finance/BookRow.vue";
import { BOOK_MORE } from "~/composables/useFinanceView";
import { WIDE_QUERY } from "~/composables/useRosterView";
import {
  FILTER_LABELS,
  FILTER_ORDER,
  SORTS,
  ageText,
  couriersText,
  type CashCounts,
  type CashFilter,
  type CashRow,
  type CashSort,
} from "~/utils/cashDesk";
import { pluralizeSr } from "~/utils/datetime";

// Spisak kurira sa novcem: filteri (sa brojevima iz cijele knjige), pretraga, redoslijed, pa jedno od stanja
// (učitavanje, greška, nema firme, nema rezultata) ili redovi. Greška se piše u mjestu spiska sa "Pokušaj
// ponovo" i nikad kao "Nema ...". Strelice, Home i End kreću se po spisku (jedan stop za Tab); na računaru
// strelice mijenjaju i izbor.
const props = defineProps<{
  state: "loading" | "error" | "nofirm" | "ready";
  stale: boolean;
  errorText: string;
  counts: CashCounts;
  items: CashRow[];
  matchedCount: number;
  q: string;
  filter: CashFilter;
  sort: CashSort;
  selectedId: number | null;
  flash: Set<number>;
  currency: string;
  cashLimit: number | null;
  limitFailed: boolean;
  statusFailed: boolean;
  updatedAt: number | null;
  now: number;
}>();

const emit = defineEmits<{
  "update:q": [string];
  filter: [CashFilter];
  sort: [CashSort];
  open: [number];
  more: [];
  reset: [];
  batch: [];
  retry: [kind: "balances" | "settings" | "status"];
}>();

const searchEl = ref<HTMLInputElement | null>(null);
const focusedId = ref<number | null>(null);

const tabId = computed(() => {
  const ids = props.items.map((r) => r.id);
  if (focusedId.value != null && ids.includes(focusedId.value)) return focusedId.value;
  if (props.selectedId != null && ids.includes(props.selectedId)) return props.selectedId;
  return ids[0] ?? null;
});

const countText = computed(() =>
  props.q.trim() || props.filter !== "all"
    ? `${props.matchedCount} ${pluralizeSr(props.matchedCount, "rezultat", "rezultata", "rezultata")}`
    : couriersText(props.matchedCount)
);

const staleAge = computed(() => (props.updatedAt ? ageText(props.updatedAt, props.now).replace(/^pre /, "") : "nepoznato"));

const emptyTitle = computed(() =>
  props.q.trim() ? "Nema kurira za pretragu" : props.filter === "all" ? "Svi kuriri su na nuli" : "Nema kurira u ovom filteru"
);
const emptyText = computed(() =>
  props.q.trim()
    ? "Pretraga razumije ime sa i bez dijakritika, ćirilicu, telefon u bilo kom zapisu i #ID. Provjeri unos ili skini filter."
    : props.filter === "all"
      ? "Filter „Nulti“ pokazuje kurire bez duga i zarade."
      : "Izaberi drugi filter."
);

const clearSearch = () => {
  emit("update:q", "");
  searchEl.value?.focus();
};

const rowButtons = () => [...document.querySelectorAll<HTMLElement>("[data-row^='row:']")].filter((n) => n.offsetParent !== null);

const onSearchKey = (event: KeyboardEvent) => {
  if (event.key === "Escape" && props.q) {
    event.preventDefault();
    clearSearch();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    rowButtons()[0]?.focus();
  } else if (event.key === "Enter") {
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
  // Na računaru izbor ide za strelicama (detalj uz spisak), na telefonu detalj je stranica.
  if (window.matchMedia(WIDE_QUERY).matches) emit("open", id);
};

defineExpose({
  focusSearch: () => {
    searchEl.value?.focus();
    searchEl.value?.select();
  },
  focusRow: (id: number) => {
    focusedId.value = id;
    void nextTick(() => document.querySelector<HTMLElement>(`[data-row="row:${id}"]`)?.focus({ preventScroll: true }));
  },
});
</script>

<style scoped>
.bl {
  min-width: 0;
  overflow: hidden;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

.bl-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px 16px;
}

.bl-head h2 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 0.98rem;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.bl-head small {
  margin-left: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #5b6676;
}

.bl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #dfe3ea;
  border-radius: 12px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.bl-btn:active {
  background: #f1f4f9;
}

.bl-btn:focus-visible,
.bl-fp:focus-visible,
.bl-x:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.bl-tb {
  display: grid;
  gap: 10px;
  padding: 0 14px 10px;
  min-width: 0;
}

.bl-fbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.bl-fp {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #e2e5ea;
  border-radius: 999px;
  background: #fff;
  color: #0b1220;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.bl-fp:hover {
  border-color: #c7ccd4;
}

.bl-fp[aria-pressed="true"] {
  border-color: #2f6fed;
  background: #eef4ff;
  color: #2459c7;
}

.bl-fp:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bl-fp .n {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.bl-fp--bad[aria-pressed="false"] .n {
  color: #b42318;
}

.bl-search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 48px;
  padding: 0 4px 0 14px;
  border-radius: 14px;
  background: #f5f6f8;
  box-shadow: inset 0 0 0 2px transparent;
  transition: box-shadow 0.15s, background 0.15s;
}

.bl-search:focus-within {
  background: #fff;
  box-shadow: inset 0 0 0 2px #2f6fed;
}

.bl-search input {
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

.bl-search input::-webkit-search-cancel-button {
  display: none;
}

.bl-search input::placeholder {
  color: #657083;
  font-weight: 500;
  opacity: 1;
}

.bl-search kbd {
  margin-right: 6px;
  padding: 1px 6px;
  border: 1.5px solid #dfe3ea;
  border-radius: 6px;
  color: #657083;
  font: 700 0.7rem ui-monospace, Menlo, Consolas, monospace;
}

.bl-x {
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

.bl-ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.bl-pad {
  padding: 0 14px 10px;
}

.bl-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 30px 18px;
  text-align: center;
}

.bl-empty :deep(.v-icon) {
  color: #c7ccd6;
}

.bl-empty b {
  font-size: 1rem;
  font-weight: 800;
}

.bl-empty p {
  max-width: 320px;
  margin: 0;
  font-size: 0.86rem;
  color: #5b6676;
}

.bl-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px 14px;
  border-top: 1px solid #eceef2;
  font-size: 0.8rem;
  color: #5b6676;
}

.bl-sk {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 90px;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 12px 14px;
  border-top: 1px solid #eceef2;
}

.b {
  display: block;
  border-radius: 12px;
  background: linear-gradient(90deg, #eceef2 25%, #f6f7f9 37%, #eceef2 63%);
  background-size: 400% 100%;
  animation: bl-sh 1.4s ease infinite;
}

.b.a {
  height: 40px;
  border-radius: 50%;
}

.b.m {
  height: 14px;
}

.b.c {
  height: 30px;
}

@keyframes bl-sh {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

/* Telefon: filteri se klize vodoravno, pretraga je puna širina. */
@media (max-width: 700px) {
  .bl-fbar {
    flex-wrap: nowrap;
    margin: 0 -14px;
    padding: 2px 14px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .bl-fbar::-webkit-scrollbar {
    display: none;
  }

  .bl-sortlabel {
    display: none;
  }

  .bl-head .bl-btn[data-list="sort"] {
    width: 48px;
    padding: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .b {
    animation: none;
  }

  .bl-search {
    transition: none;
  }
}
</style>
