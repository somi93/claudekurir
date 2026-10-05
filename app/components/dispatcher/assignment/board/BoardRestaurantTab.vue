<template>
  <div v-if="activeOrders.length > 0 || staleOrders.length > 0">
    <div v-if="activeOrders.length > 0" class="orders-list">
      <BoardRestaurantRow
        v-for="order in activeOrders"
        :key="order.id"
        :order="order"
        :expanded="expandedId === order.id"
        :resolving="resolvingId === order.id"
        :resolve-disabled="resolvingId != null"
        @toggle="toggleExpand(order.id)"
        @resolve="(action) => openResolve(order, action)"
      />
    </div>
    <p v-else class="all-stale-note">
      Nema svježih narudžbi — svih {{ staleOrders.length }} čeka potvrdu restorana
      duže od 3h (vidi „Zaostale“ ispod).
    </p>

    <div v-if="staleOrders.length > 0" class="stale-section">
      <button type="button" class="stale-toggle" @click="showStale = !showStale">
        <v-icon :icon="showStale ? 'mdi-chevron-down' : 'mdi-chevron-right'" size="18" />
        Zaostale — restoran ne reaguje ({{ staleOrders.length }})
      </button>
      <v-expand-transition>
        <div v-if="showStale" class="orders-list mt-2">
          <BoardRestaurantRow
            v-for="order in staleOrders"
            :key="order.id"
            :order="order"
            :expanded="expandedId === order.id"
            :resolving="resolvingId === order.id"
            :resolve-disabled="resolvingId != null"
            @toggle="toggleExpand(order.id)"
            @resolve="(action) => openResolve(order, action)"
          />
        </div>
      </v-expand-transition>
    </div>
  </div>
  <GlobalEmptyState v-else-if="orders.length > 0" icon="mdi-magnify-close">
    Nema narudžbi za zadatu pretragu.
  </GlobalEmptyState>
  <GlobalEmptyState v-else-if="!hasError" icon="mdi-storefront-check-outline">
    Nema narudžbi koje čekaju potvrdu restorana.
  </GlobalEmptyState>

  <FormDialog
    v-model:open="showResolve"
    :title="resolveTitle"
    :saving="resolvingId != null"
    save-text="Potvrdi"
    max-width="440"
    @save="submitResolve"
  >
    <p class="resolve-copy">
      {{ resolveCopy }}
    </p>
    <GlobalTextarea
      v-model="resolveNote"
      label="Napomena (opciono)"
      placeholder="npr. Vlasnik potvrdio telefonom u 12:40"
      rows="2"
      auto-grow
      hide-details="auto"
    />
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import FormDialog from "~/components/common/FormDialog.vue";
import BoardRestaurantRow from "./BoardRestaurantRow.vue";
import { orderMatchesSearch } from "~/utils/dispatchBoardFormat";
import { restaurantWaitTier } from "~/utils/dispatchBoard";
import type { RestaurantWaitTier } from "~/utils/dispatchBoard";
import type { PendingRestaurantOrder } from "~/models/PendingRestaurantOrder";

const props = defineProps<{
  orders: PendingRestaurantOrder[];
  search: string;
  // id narudžbe koja se trenutno rješava (spinner + zaključavanje ostalih dugmadi)
  resolvingId: number | null;
  hasError: boolean;
}>();

const emit = defineEmits<{
  resolve: [payload: { orderId: number; action: "accept" | "reject"; note?: string }];
}>();

const matched = computed(() =>
  props.orders.filter((o) => orderMatchesSearch(props.search, o.restaurantName, o.id))
);

// Sort: prvo po nivou hitnosti (critical -> warning -> calm), pa unutar nivoa
// najduže čekanje na vrh. Stale se odvaja u zasebnu, skupljenu sekciju - inače
// višednevni redovi (7-dnevni prozor) preplave listu i sve izgleda jednako
// hitno (task stavka 2 + UX analiza 31.08).
const TIER_RANK: Record<RestaurantWaitTier, number> = {
  critical: 0,
  warning: 1,
  calm: 2,
  stale: 3,
};

const sortByUrgency = (list: PendingRestaurantOrder[]) =>
  [...list].sort((a, b) => {
    const rank =
      TIER_RANK[restaurantWaitTier(a.waitingMinutes)] -
      TIER_RANK[restaurantWaitTier(b.waitingMinutes)];
    return rank !== 0 ? rank : b.waitingMinutes - a.waitingMinutes;
  });

const activeOrders = computed(() =>
  sortByUrgency(
    matched.value.filter((o) => restaurantWaitTier(o.waitingMinutes) !== "stale")
  )
);
const staleOrders = computed(() =>
  sortByUrgency(
    matched.value.filter((o) => restaurantWaitTier(o.waitingMinutes) === "stale")
  )
);

const showStale = ref(false);

const expandedId = ref<number | null>(null);
const toggleExpand = (id: number) => {
  expandedId.value = expandedId.value === id ? null : id;
};

// Ručno rješavanje "Čeka restoran" narudžbe (odgovor §4) - dispečer je
// telefonski dobio potvrdu/odbijanje jer restoran ne reaguje kroz aplikaciju.
const showResolve = ref(false);
const resolveOrderId = ref<number | null>(null);
const resolveAction = ref<"accept" | "reject">("accept");
const resolveRestaurantName = ref("");
const resolveNote = ref("");

const resolveTitle = computed(() =>
  resolveAction.value === "accept"
    ? "Restoran je prihvatio narudžbu"
    : "Restoran je odbio narudžbu"
);
const resolveCopy = computed(() => {
  const name = toLatin(resolveRestaurantName.value);
  return resolveAction.value === "accept"
    ? `Potvrdi da je restoran ${name} telefonom prihvatio narudžbu #${resolveOrderId.value}. Prelazi u tok "Čeka kurira".`
    : `Potvrdi da je restoran ${name} telefonom odbio narudžbu #${resolveOrderId.value}.`;
});

const openResolve = (order: PendingRestaurantOrder, action: "accept" | "reject") => {
  resolveOrderId.value = order.id;
  resolveAction.value = action;
  resolveRestaurantName.value = order.restaurantName;
  resolveNote.value = "";
  showResolve.value = true;
};

const submitResolve = () => {
  if (resolveOrderId.value == null) return;
  emit("resolve", {
    orderId: resolveOrderId.value,
    action: resolveAction.value,
    note: resolveNote.value.trim() || undefined,
  });
  showResolve.value = false;
};
</script>

<style scoped>
.orders-list {
  background: transparent;
  display: grid;
  gap: 6px;
}

.all-stale-note {
  margin: 8px 0;
  color: #9aa4b2;
  font-size: 0.85rem;
}

.stale-section {
  margin-top: 14px;
}

.stale-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  border: none;
  background: transparent;
  color: #6b7685;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.stale-toggle:hover {
  color: #495260;
}

.resolve-copy {
  margin: 0 0 4px;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #495260;
}
</style>
