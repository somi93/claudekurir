<template>
  <section class="rl" aria-label="Kuriri">
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
          data-messages="search"
          @input="emit('update:q', ($event.target as HTMLInputElement).value)"
          @keydown="onSearchKey"
        />
        <kbd v-if="!q && showKbd" aria-hidden="true">/</kbd>
        <button v-if="q" type="button" class="rl-x" aria-label="Obriši pretragu" @click="clearSearch">
          <v-icon icon="mdi-close" size="20" />
        </button>
      </div>
    </div>

    <ul v-if="state === 'loading'" class="rl-ul" role="status" aria-label="Učitavam kurire">
      <li v-for="n in 7" :key="n" aria-hidden="true">
        <div class="sk-row">
          <i class="b sk-av" />
          <span class="sk-tx">
            <i class="b" style="width: 62%; height: 14px" />
            <i class="b" style="width: 44%; height: 12px" />
          </span>
          <i class="b" style="width: 70px; height: 24px; border-radius: 999px" />
        </div>
      </li>
    </ul>

    <div v-else-if="state === 'error'" class="rl-empty" role="alert">
      <v-icon icon="mdi-cloud-off-outline" size="34" />
      <b>Ne mogu da učitam kurire</b>
      <p>
        {{ errorText || "Server ne odgovara." }} Tvoj tekst poruke je sačuvan, samo ne mogu da izaberem
        primaoce.
      </p>
      <button type="button" class="btn btn--primary" data-messages="retry" @click="emit('retry')">
        <v-icon icon="mdi-refresh" size="18" />Pokušaj ponovo
      </button>
    </div>

    <div v-else-if="state === 'nofirm'" class="rl-empty">
      <v-icon icon="mdi-domain" size="34" />
      <b>Nema dostavne firme</b>
      <p>Tvoj nalog nije povezan ni sa jednom dostavnom firmom, pa nema kome da se pošalje poruka.</p>
    </div>

    <div v-else-if="state === 'empty'" class="rl-empty">
      <v-icon icon="mdi-account-group-outline" size="34" />
      <b>Još nema kurira u ovoj firmi</b>
      <p>Poruku nema kome da se pošalje. Kurire dodaješ na ekranu Kuriri.</p>
    </div>

    <template v-else>
      <div v-if="stale" class="rl-stale">
        <TintAlert tone="warn" icon="mdi-cloud-off-outline" title="Ne mogu da osvježim listu">
          Prikazani su podaci od {{ timeLabel }}.
          <template #action>
            <button type="button" data-messages="retry" @click="emit('retry')">Pokušaj ponovo</button>
          </template>
        </TintAlert>
      </div>

      <div class="rl-sub" aria-live="polite">
        <span>
          <b>{{ pickedCount }}</b> od {{ total }} izabrano
        </span>
        <span class="rl-links">
          <button
            type="button"
            class="lnk"
            data-messages="select-shown"
            :disabled="items.length === 0"
            @click="emit('selectShown')"
          >
            Izaberi prikazane{{ items.length !== total ? ` (${items.length})` : "" }}
          </button>
          <button
            type="button"
            class="lnk"
            data-messages="select-none"
            :disabled="pickedCount === 0"
            @click="emit('selectNone')"
          >
            Poništi
          </button>
        </span>
      </div>

      <div v-if="items.length === 0" class="rl-empty">
        <v-icon icon="mdi-magnify-close" size="34" />
        <b>Nema kurira za „{{ q.trim() }}“</b>
        <p>Pretraga razumije ime sa i bez dijakritika, ćirilicu, telefon u bilo kom zapisu i #ID.</p>
        <button type="button" class="btn" data-messages="clear-search" @click="clearSearch">Očisti pretragu</button>
      </div>

      <ul v-else class="rl-ul" aria-label="Kuriri" @keydown="onListKey">
        <MessageRecipientRow
          v-for="c in visible"
          :key="c.id"
          :courier="c"
          :now="now"
          :currency="currency"
          :picked="picked.has(c.id)"
          :tabbable="c.id === tabId"
          :flash="flashIds.has(c.id)"
          @toggle="emit('toggle', c.id)"
          @history="emit('history', c.id)"
          @focusin="focusedId = c.id"
        />
      </ul>

      <div class="rl-more">
        <span>
          {{
            items.length > visible.length
              ? `Prikazano ${visible.length} od ${items.length}`
              : updatedAt
                ? `Ažurirano ${timeLabel}`
                : ""
          }}
        </span>
        <button
          v-if="items.length > visible.length"
          type="button"
          class="btn"
          data-messages="more"
          @click="emit('more')"
        >
          Prikaži još {{ Math.min(PAGE_ROWS, items.length - visible.length) }}
        </button>
        <button
          v-else
          type="button"
          class="btn btn--icon"
          data-messages="refresh"
          aria-label="Osvježi listu"
          :disabled="refreshing"
          @click="emit('refresh')"
        >
          <v-icon icon="mdi-refresh" size="20" :class="{ 'is-spin': refreshing }" />
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import TintAlert from "~/components/common/TintAlert.vue";
import MessageRecipientRow from "~/components/dispatcher/messages/MessageRecipientRow.vue";
import { PAGE_ROWS } from "~/composables/useRosterView";
import type { RosterState } from "~/composables/useCourierRoster";
import type { RosterCourier } from "~/utils/courierRoster";

// Spisak primalaca: pretraga (ista kao na Kuriri), zbir izabranih sa "Izaberi prikazane" i "Poništi",
// pa jedno od stanja (učitavanje, greška, nema firme, prazna firma, nema rezultata) ili redovi.
// Iscrtava se po 12 redova ("Prikaži još"), pa 500 kurira ostaje lagano. Strelice, Home i End
// kreću se po spisku (jedno mjesto za Tab), Space bira.
const props = defineProps<{
  state: RosterState;
  stale: boolean;
  errorText: string;
  // Svi kuriri firme / oni koji se poklapaju sa pretragom (redoslijed za prikaz).
  total: number;
  items: RosterCourier[];
  visibleCount: number;
  picked: ReadonlySet<number>;
  pickedCount: number;
  now: number;
  currency: string;
  updatedAt: number | null;
  refreshing: boolean;
  q: string;
  flashIds: ReadonlySet<number>;
  showKbd?: boolean;
}>();

const emit = defineEmits<{
  "update:q": [string];
  toggle: [number];
  history: [number];
  selectShown: [];
  selectNone: [];
  more: [];
  refresh: [];
  retry: [];
}>();

const searchEl = ref<HTMLInputElement | null>(null);
const focusedId = ref<number | null>(null);

const visible = computed(() => props.items.slice(0, props.visibleCount));

// Jedini red u redoslijedu tastera Tab: red na kome je fokus, pa prvi.
const tabId = computed(() => {
  const ids = visible.value.map((c) => c.id);
  if (focusedId.value != null && ids.includes(focusedId.value)) return focusedId.value;
  return ids[0] ?? null;
});

const timeLabel = computed(() =>
  props.updatedAt ? new Date(props.updatedAt).toLocaleTimeString("sr-RS") : ""
);

const clearSearch = () => {
  emit("update:q", "");
  searchEl.value?.focus();
};

const rowButtons = (root: ParentNode = document) =>
  [...root.querySelectorAll<HTMLElement>("[data-row^='chk:']")].filter((n) => n.offsetParent !== null);

const onSearchKey = (event: KeyboardEvent) => {
  if (event.key === "Escape" && props.q) {
    event.preventDefault();
    clearSearch();
  } else if (event.key === "ArrowDown") {
    const first = rowButtons((event.currentTarget as HTMLElement).closest("section") ?? document)[0];
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
};

const onListKey = async (event: KeyboardEvent) => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-row^='chk:']");
  if (!target || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = rowButtons((event.currentTarget as HTMLElement).closest("section") ?? document);
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
  focusedId.value = Number(el.dataset.row?.slice(4));
  await nextTick();
  el.focus();
};

defineExpose({
  focusSearch: () => searchEl.value?.focus(),
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
  padding: 12px 12px 4px;
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

.btn:active {
  background: #f1f4f9;
}

.btn:focus-visible,
.rl-x:focus-visible,
.lnk:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--icon {
  width: 44px;
  padding: 0;
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

.rl-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 44px;
  padding: 0 8px 4px 14px;
  font-size: 0.8rem;
  color: #5b6676;
}

.rl-sub b {
  font-weight: 800;
  color: #0b1220;
}

.rl-links {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
}

.lnk {
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: #2459c7;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.lnk:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
  padding: 4px 12px 8px;
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
  min-height: 52px;
  padding: 4px 8px 4px 14px;
  border-top: 1px solid #eceef2;
  border-radius: 0 0 20px 20px;
  font-size: 0.78rem;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

/* Okviri učitavanja. */
.sk-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 68px;
  padding: 8px 14px;
  border-top: 1px solid #eceef2;
}

.sk-av {
  width: 30px;
  height: 30px;
  margin: 7px;
  border-radius: 50%;
}

.sk-tx {
  display: grid;
  gap: 6px;
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

@media (prefers-reduced-motion: reduce) {
  .b,
  .is-spin {
    animation: none;
  }
}
</style>
