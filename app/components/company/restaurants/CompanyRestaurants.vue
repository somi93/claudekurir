<template>
  <div class="cr" data-company="restaurants">
    <!-- Telefon: detalj restorana je zasebna stranica; strelica nazad u zaglavlju vraća na listu. -->
    <div v-if="phoneDetail && selected" class="cr-card">
      <RestaurantDetail
        ref="detail"
        :restaurant="selected"
        :company-currency="currency"
        :closable="false"
        @suspend="openSheet(false)"
        @activate="openSheet(true)"
      />
    </div>

    <template v-else>
      <RestaurantFilters
        v-if="listState === 'ready' && restaurants.length > 0"
        :counts="view.counts.value"
        :filter="view.filter.value"
        :has-filter="view.hasFilter.value"
        @filter="view.setFilter"
        @reset="view.reset"
      />

      <div class="cr-grid">
        <RestaurantList
          ref="list"
          v-model:q="view.q.value"
          :state="listState"
          :error-text="errorText"
          :total="restaurants.length"
          :matched-count="view.matched.value.length"
          :items="view.visible.value"
          :company-currency="currency"
          :selected-id="view.selectedId.value"
          @open="view.open"
          @more="view.more()"
          @retry="emit('retry')"
          @reset="view.reset"
        />

        <aside v-if="wide" class="cr-det" aria-label="Detalji restorana">
          <RestaurantDetail
            v-if="selected"
            :key="selected.id"
            ref="detail"
            :restaurant="selected"
            :company-currency="currency"
            closable
            @close="onCloseDetail"
            @suspend="openSheet(false)"
            @activate="openSheet(true)"
          />
          <div v-else class="cr-none">
            <v-icon icon="mdi-storefront-outline" size="34" />
            <b>Izaberi restoran</b>
            <p>
              Kontakt, stanje saradnje i radnje pojavljuju se ovdje. Strelice mijenjaju izbor, Enter
              otvara.
            </p>
          </div>
        </aside>
      </div>
    </template>

    <CooperationSheet
      v-if="sheetRestaurant"
      :open="sheetOpen"
      :restaurant="sheetRestaurant"
      :activate="sheetActivate"
      :company-currency="currency"
      :save="(active, reason) => setCooperation(sheetRestaurant!, active, reason)"
      @update:open="sheetOpen = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import CooperationSheet from "~/components/company/restaurants/CooperationSheet.vue";
import RestaurantDetail from "~/components/company/restaurants/RestaurantDetail.vue";
import RestaurantFilters from "~/components/company/restaurants/RestaurantFilters.vue";
import RestaurantList from "~/components/company/restaurants/RestaurantList.vue";
import type { useCompanyView } from "~/composables/useCompanyView";
import type { ActionResult } from "~/composables/useCourierRoster";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// Saradnja sa restoranima: pločice stanja, lista sa pretragom i detalj. Računar: lista lijevo, detalj
// desno. Telefon: lista, a restoran otvara detalj preko cijele stranice. Suspenzija i uključivanje su
// radnje u detalju (list sa razlogom), ne prekidač u redu.
const props = defineProps<{
  restaurants: RestaurantCooperation[];
  loading: boolean;
  failed: boolean;
  errorText: string;
  // Sačuvana valuta firme.
  currency: string;
  view: ReturnType<typeof useCompanyView>;
  wide: boolean;
  setCooperation: (
    restaurant: RestaurantCooperation,
    active: boolean,
    reason?: string
  ) => Promise<ActionResult>;
}>();

const emit = defineEmits<{ retry: [] }>();

const list = ref<InstanceType<typeof RestaurantList> | null>(null);
const detail = ref<InstanceType<typeof RestaurantDetail> | null>(null);

const selected = computed(() => props.view.selected.value);
const phoneDetail = computed(() => !props.wide && Boolean(selected.value));

const listState = computed<"loading" | "error" | "ready">(() => {
  if (props.restaurants.length === 0 && props.loading) return "loading";
  if (props.restaurants.length === 0 && props.failed) return "error";
  return "ready";
});

// Računar: X zatvara detalj i vraća fokus na red koji je bio otvoren.
const onCloseDetail = () => {
  const id = props.view.selectedId.value;
  props.view.close();
  if (id != null) list.value?.focusRow(id);
};

// Telefon: detalj je stranica. Otvara se od vrha sa fokusom na naslovu (čitač ekrana kaže gdje je
// korisnik), a pri povratku fokus ide na red koji je bio otvoren.
watch(
  () => props.view.selectedId.value,
  async (id, old) => {
    await nextTick();
    if (props.wide) return;
    if (id != null && old == null) {
      window.scrollTo({ top: 0 });
      detail.value?.focusTitle();
    } else if (id == null && old != null) {
      list.value?.focusRow(old);
    }
  }
);

const sheetOpen = ref(false);
const sheetActivate = ref(false);
const sheetId = ref<number | null>(null);
const sheetRestaurant = computed(
  () => props.restaurants.find((r) => r.id === sheetId.value) ?? null
);

const openSheet = (activate: boolean) => {
  if (!selected.value) return;
  sheetId.value = selected.value.id;
  sheetActivate.value = activate;
  sheetOpen.value = true;
};
</script>

<style scoped>
.cr {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.cr > * {
  min-width: 0;
}

.cr-grid {
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.cr-grid > * {
  min-width: 0;
}

.cr-det,
.cr-card {
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(11, 18, 32, 0.04), 0 12px 28px rgba(11, 18, 32, 0.06);
}

/* Detalj pored liste: lijepi se uz vrh dok se lista skroluje, kao detalj u Kuriri. */
.cr-det {
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 100px);
  max-height: calc(100dvh - 100px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.cr-none {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 56px 24px;
  text-align: center;
  color: #5b6676;
}

.cr-none b {
  color: #0b1220;
  font-size: 1.02rem;
}

.cr-none p {
  max-width: 300px;
  margin: 0;
  font-size: 0.86rem;
}

@media (max-width: 1099px) {
  .cr-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
