<template>
  <section class="rl" aria-label="Lista restorana" data-company="restaurant-list">
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
          placeholder="Naziv restorana ili broj"
          aria-label="Pretraži restorane po nazivu ili broju"
          data-company="search"
          @input="emit('update:q', ($event.target as HTMLInputElement).value)"
          @keydown="onSearchKey"
        />
        <button v-if="q" type="button" class="rl-x" aria-label="Obriši pretragu" @click="clearSearch">
          <v-icon icon="mdi-close" size="20" />
        </button>
      </div>
    </div>

    <div v-if="state === 'ready' && total > 0" class="rl-sub" aria-live="polite">
      <b>{{ matchedCount }}</b>
      {{ matchedCount === total ? pluralizeSr(matchedCount, "restoran", "restorana", "restorana") : `od ${total}` }}
    </div>

    <ul v-if="state === 'loading'" class="rl-ul" role="status" aria-label="Učitavam restorane">
      <li v-for="n in 6" :key="n" aria-hidden="true">
        <div class="sk-row">
          <i class="b sk-av" />
          <span class="sk-tx"><i class="b" style="width: 62%; height: 14px" /><i class="b" style="width: 44%; height: 12px" /></span>
        </div>
      </li>
    </ul>

    <div v-else-if="state === 'error'" class="rl-empty" role="alert" data-company="restaurants-error">
      <v-icon icon="mdi-cloud-off-outline" size="34" />
      <b>Ne mogu da učitam restorane</b>
      <p>{{ errorText || "Server ne odgovara." }} Ništa nije izgubljeno.</p>
      <AppButton variant="ghost" icon="mdi-refresh" class="rl-btn" data-company="retry" @click="emit('retry')">
        Pokušaj ponovo
      </AppButton>
    </div>

    <div v-else-if="total === 0" class="rl-empty" data-company="restaurants-empty">
      <v-icon icon="mdi-storefront-outline" size="34" />
      <b>Nema povezanih restorana</b>
      <p>Restorani koji rade sa ovom firmom pojaviće se ovdje. Poziv za saradnju šalje restoran iz svoje aplikacije.</p>
    </div>

    <div v-else-if="matchedCount === 0" class="rl-empty" data-company="restaurants-noresult">
      <v-icon icon="mdi-magnify-close" size="34" />
      <b>{{ q.trim() ? `Nema restorana za „${q.trim()}“` : "Nijedan restoran ne odgovara" }}</b>
      <p>
        {{
          q.trim()
            ? "Pretraga razumije naziv sa i bez dijakritika, ćirilicu i broj restorana."
            : "Probaj da skineš filter."
        }}
      </p>
      <AppButton variant="ghost" class="rl-btn" data-company="reset" @click="emit('reset')">
        Očisti filtere
      </AppButton>
    </div>

    <template v-else>
      <ul class="rl-ul" aria-label="Restorani" @keydown="onListKey">
        <RestaurantRow
          v-for="r in items"
          :key="r.id"
          :restaurant="r"
          :company-currency="companyCurrency"
          :selected="selectedId === r.id"
          :tabbable="r.id === tabId"
          @open="emit('open', r.id)"
        />
      </ul>

      <div v-if="matchedCount > items.length" class="rl-more">
        <span>Prikazano {{ items.length }} od {{ matchedCount }}</span>
        <AppButton variant="ghost" class="rl-btn" data-company="more" @click="emit('more')">
          Prikaži još {{ Math.min(PAGE_ROWS, matchedCount - items.length) }}
        </AppButton>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import AppButton from "~/components/common/AppButton.vue";
import RestaurantRow from "~/components/company/restaurants/RestaurantRow.vue";
import { PAGE_ROWS, WIDE_QUERY } from "~/composables/useRosterView";
import { pluralizeSr } from "~/utils/datetime";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// Kartica sa listom restorana: pretraga, brojač, pa jedno od stanja (učitavanje, pad, nema
// restorana, nema rezultata) ili redovi sa "Prikaži još". Pad, prazna firma i prazna pretraga nikad
// ne izgledaju isto. Strelice, Home i End kreću se po listi (jedan stop za Tab); na računaru
// strelice mijenjaju i izbor, kao u Kuriri.
const props = defineProps<{
  state: "loading" | "error" | "ready";
  errorText: string;
  total: number;
  matchedCount: number;
  items: RestaurantCooperation[];
  companyCurrency: string;
  q: string;
  selectedId: number | null;
}>();

const emit = defineEmits<{
  "update:q": [string];
  open: [number];
  more: [];
  retry: [];
  reset: [];
}>();

const searchEl = ref<HTMLInputElement | null>(null);
const focusedId = ref<number | null>(null);

// Jedini red u redoslijedu tastera Tab: red na kome je fokus, pa izabrani, pa prvi.
const tabId = computed(() => {
  const ids = props.items.map((r) => r.id);
  if (focusedId.value != null && ids.includes(focusedId.value)) return focusedId.value;
  if (props.selectedId != null && ids.includes(props.selectedId)) return props.selectedId;
  return ids[0] ?? null;
});

const clearSearch = () => {
  emit("update:q", "");
  searchEl.value?.focus();
};

const rowButtons = () =>
  [...document.querySelectorAll<HTMLElement>("[data-row^='row:']")].filter((n) => n.offsetParent !== null);

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
  // Na računaru izbor ide za strelicama (detalj uz listu), na telefonu detalj je stranica.
  if (window.matchMedia(WIDE_QUERY).matches) emit("open", id);
};

defineExpose({
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
  container: restaurants / inline-size;
}

.rl-tb {
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
  color: #5b6676;
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

.rl-x:focus-visible {
  outline: 3px solid #2f6fed;
  outline-offset: 2px;
}

.rl-sub {
  padding: 0 16px 8px;
  font-size: 0.8rem;
  color: #5b6676;
  font-variant-numeric: tabular-nums;
}

.rl-sub b {
  color: #0b1220;
}

.rl-ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rl-ul[role="status"] {
  padding-bottom: 8px;
}

.sk-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 12px 14px;
  border-top: 1px solid #eceef2;
}

li:first-child > .sk-row {
  border-top: 0;
}

.sk-av {
  width: 44px;
  height: 44px;
  border-radius: 14px;
}

.sk-tx {
  display: grid;
  gap: 8px;
}

.b {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, #eef0f4 0%, #f7f8fa 50%, #eef0f4 100%);
  background-size: 200% 100%;
  animation: rl-shimmer 1.3s linear infinite;
}

@keyframes rl-shimmer {
  to {
    background-position: -200% 0;
  }
}

.rl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 24px 28px;
  text-align: center;
  color: #5b6676;
}

.rl-empty b {
  color: #0b1220;
  font-size: 1.05rem;
}

.rl-empty p {
  max-width: 320px;
  margin: 0;
  font-size: 0.86rem;
}

.rl-btn {
  width: auto;
  margin-top: 8px;
}

.rl-more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px 14px;
  border-top: 1px solid #eceef2;
  font-size: 0.8rem;
  color: #5b6676;
}

.rl-more .rl-btn {
  margin-top: 0;
}

@media (prefers-reduced-motion: reduce) {
  .b {
    animation: none;
  }

  .rl-search {
    transition: none;
  }
}
</style>
