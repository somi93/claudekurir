import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef } from "vue";
import { isOrderActive, isOrderPickedUp, ORDER_STATE } from "~/utils/orderDisplay";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import { useDeliveriesStore } from "~/stores/deliveries";
import type { Order } from "~/models/Order";
import * as courierOrdersService from "~/services/courierOrdersService";

// Nalog koji je kurir upravo prihvatio ulazi u listu odmah (iz odgovora na
// prihvatanje), a sljedeći GET može da stigne prije nego što ga server vrati -
// toliko dugo ga držimo da ekran ne trepne na "nema dostave" i nazad.
const OPTIMISTIC_TTL_MS = 20_000;

// Redoslijed rada kad kurir vozi više naloga: prvo onaj koji već nosi
// (preuzet), pa po roku isporuke, pa po broju narudžbe.
const byWorkOrder = (a: Order, b: Order) => {
  const pickedA = isOrderPickedUp(a) ? 0 : 1;
  const pickedB = isOrderPickedUp(b) ? 0 : 1;
  if (pickedA !== pickedB) return pickedA - pickedB;
  const dueA = a.deliveryTime ? Date.parse(a.deliveryTime) : Number.POSITIVE_INFINITY;
  const dueB = b.deliveryTime ? Date.parse(b.deliveryTime) : Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;
  return a.id - b.id;
};

export const useCourierOrders = (courierId: ComputedRef<number>) => {
  const alertStore = useAlertStore();
  const deliveriesStore = useDeliveriesStore();

  const myOrders = ref<Order[]>([]);
  const loadingMine = ref(true);
  const loadingAction = ref<number | null>(null);
  const lastSyncAt = ref<string | null>(null);
  // Greška samo za slučaj "prvo učitavanje palo, lista prazna" - tada prazna
  // lista ne smije da izgleda kao "nema porudžbina". Pozadinski poll koji padne
  // dok lista već ima podatke ovo NE dira (ostaje deduplikovani toast).
  const mineError = ref("");

  // Polling na 15s ne sme da spamuje isti alert - pamtimo poslednju prikazanu
  // grešku i ćutimo dok se ne promeni ili dok sledeći uspešan poziv ne resetuje.
  let lastReportedError = "";
  const reportError = (error: unknown, fallback: string) => {
    const message = toFriendlyErrorMessage(error, fallback);
    if (message !== lastReportedError) {
      lastReportedError = message;
      alertStore.error(message);
    }
  };
  const resetErrorTracking = () => {
    lastReportedError = "";
  };

  // Zadnja dostavljena narudžba (za ekran "Dostavljeno") - živi samo u memoriji.
  const lastDelivered = ref<Order | null>(null);

  const optimistic = new Map<number, { order: Order; until: number }>();
  const mergeOptimistic = (fetched: Order[]): Order[] => {
    const now = Date.now();
    const known = new Set(fetched.map((order) => order.id));
    const extra: Order[] = [];
    for (const [id, entry] of optimistic) {
      if (known.has(id) || entry.until < now) optimistic.delete(id);
      else extra.push(entry.order);
    }
    return extra.length ? [...fetched, ...extra] : fetched;
  };

  const mineCount = computed(() => myOrders.value.length);
  // Sve narudžbe u toku, u redoslijedu rada (vidi byWorkOrder). Prije se prikazivala
  // samo prva, pa druga dostava nije postojala za kurira.
  const activeOrders = computed(() => myOrders.value.filter(isOrderActive).sort(byWorkOrder));
  const activeOrder = computed(() => activeOrders.value[0] ?? null);
  const isPickedUp = computed(() =>
    Boolean(activeOrder.value && isOrderPickedUp(activeOrder.value))
  );

  // Prihvaćena ponuda: nalog iz odgovora (ili sastavljen iz ponude) odmah ulazi u listu.
  const addOrder = (order: Order) => {
    optimistic.set(order.id, { order, until: Date.now() + OPTIMISTIC_TTL_MS });
    myOrders.value = [...myOrders.value.filter((item) => item.id !== order.id), order];
    loadingMine.value = false;
  };

  const fetchMyOrders = async () => {
    // Loading spinner samo dok nema ničega da se prikaže (prvo učitavanje) -
    // pozadinski poll na 15s ne sme da sakrije postojeću listu i treperi.
    if (myOrders.value.length === 0) loadingMine.value = true;

    try {
      myOrders.value = mergeOptimistic(await courierOrdersService.fetchMyOrders(courierId.value));
      mineError.value = "";
    } catch (error) {
      reportError(error, "Ne mogu da učitam moje porudžbine.");
      if (myOrders.value.length === 0) {
        mineError.value = toFriendlyErrorMessage(error, "Ne mogu da učitam moje porudžbine.");
      }
    } finally {
      loadingMine.value = false;
    }
  };

  const refreshOrders = async () => {
    await fetchMyOrders();
    lastSyncAt.value = new Date().toLocaleTimeString("sr-RS");
  };

  const confirmPickup = async (order: Order): Promise<boolean> => {
    loadingAction.value = order.id;

    try {
      await courierOrdersService.confirmOrderPickup(order.id, courierId.value);
      alertStore.success("Paket je preuzet iz restorana.");
      resetErrorTracking();
      // Panel prelazi na "ka kupcu" odmah, ne tek poslije sljedećeg GET-a.
      myOrders.value = myOrders.value.map((item) =>
        item.id === order.id ? { ...item, state: ORDER_STATE.CHARGED_DELIVERY } : item
      );
      optimistic.delete(order.id);
      await refreshOrders();
      return true;
    } catch (error) {
      reportError(error, "Ne mogu da potvrdim preuzimanje paketa.");
      return false;
    } finally {
      loadingAction.value = null;
    }
  };

  const deliverOrder = async (order: Order): Promise<boolean> => {
    loadingAction.value = order.id;

    try {
      await courierOrdersService.deliverOrder(order.id, courierId.value);
      alertStore.success("Porudžbina je označena kao dostavljena.");
      resetErrorTracking();
      lastDelivered.value = order;
      // Istorija i Novčanik drže dostave u kešu - ova je upravo dodata.
      deliveriesStore.invalidate();
      myOrders.value = myOrders.value.filter((item) => item.id !== order.id);
      optimistic.delete(order.id);
      await refreshOrders();
      return true;
    } catch (error) {
      reportError(error, "Ne mogu da označim porudžbinu kao dostavljenu.");
      return false;
    } finally {
      loadingAction.value = null;
    }
  };

  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  // `courierId` se popuni asinhrono (session store čeka /me) - `immediate: true`
  // pokriva slučaj da je već validan pri mount-u, watch pokriva slučaj da stigne
  // kasnije. Jedan okidač umjesto odvojenih onMounted+watch - oba su ranije
  // nezavisno zvala refreshOrders() kad bi se courierId promijenio taman posle
  // mount-a, pa se /orders/driver/{id} zvalo dvostruko.
  // `import.meta.client` guard - `immediate: true` se (za razliku od starog
  // onMounted) izvršava i na SSR prolazu, gdje je courierId uvijek 0 (sesija
  // je na serveru uvijek null) - bez guarda bi se izvršio i na serveru i
  // "duh" stanje se hidrira na klijenta.
  //
  // NEMA alertStore.error() za nevalidan ID - to NIJE stvarna greška nego
  // prelazno stanje: middleware/auth.global.ts čeka /me PRIJE mount-a na SPA
  // navigaciji, ali na hard refresh (hidracija) to zavisi od trke između tog
  // mrežnog poziva i Vue hidracije, pa courierId ovde legitimno prođe kroz 0
  // na putu do prave vrijednosti - nekad stigne prije prvog tick-a watch-a,
  // nekad poslije. Pošto middleware garantuje da niko bez validne role ne
  // stigne do ove stranice, trajno nevalidan ID se praktično nikad ne desi.
  watch(
    courierId,
    async (newValue) => {
      if (!import.meta.client) return;
      if (!Number.isFinite(newValue) || newValue <= 0) {
        loadingMine.value = false;
        return;
      }

      await refreshOrders();
    },
    { immediate: true }
  );

  const handleVisibilityChange = () => {
    // Ne osvežavaj u pozadini - kad se tab vrati u fokus, odmah povuci sveže stanje.
    if (!document.hidden) {
      refreshOrders();
    }
  };

  onMounted(() => {
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      refreshOrders();
    }, 15000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  return {
    myOrders,
    loadingMine,
    mineError,
    loadingAction,
    lastSyncAt,
    mineCount,
    activeOrders,
    activeOrder,
    isPickedUp,
    lastDelivered,
    addOrder,
    refreshOrders,
    confirmPickup,
    deliverOrder,
  };
};
