import { computed, onBeforeUnmount, ref, watch, type ComputedRef } from "vue";
import { fetchWaitingOrders } from "~/services/waitingOrdersService";
import { fetchActiveDeliveries } from "~/services/activeDeliveriesService";
import { fetchRefusedOrders } from "~/services/refusedOrdersService";
import {
  fetchPendingRestaurantOrders,
  resolveRestaurantStatus,
} from "~/services/pendingRestaurantOrdersService";
import {
  assignCourierToOrder,
  fetchCandidateCouriers,
} from "~/services/candidateCouriersService";
import {
  getErrorStatus,
  getServerField,
  getServerMessage,
  toFriendlyErrorMessage,
} from "~/utils/errorMessage";
import { orderStatusMessage } from "~/utils/orderStatus";
import { toLatin } from "~/utils/toLatin";
import type { WaitingOrder } from "~/models/WaitingOrder";
import type { ActiveDelivery } from "~/models/ActiveDelivery";
import type { RefusedOrder } from "~/models/RefusedOrder";
import type { PendingRestaurantOrder } from "~/models/PendingRestaurantOrder";

// Preporuka iz Dopuna_dodela_narudzbi_frontend.md (16.08) - ekran postaje
// fallback mehanizam za izuzetke, ne primarni tok (većina narudžbi će se
// vremenom dodeljivati automatski preko push sistema, zasebna tema). Ručno
// "Osveži" dugme ostaje dostupno nezavisno od ovog intervala.
const REFRESH_MS = 5 * 60 * 1000;

// directAssign() ide kroz rangiranu listu kandidata dok neko ne primi
// narudžbu - ograničeno na prvih N da dispečer ne čeka predugo kroz veliku
// listu (npr. 20+ kandidata) prije nego što vidi konačnu grešku.
const MAX_DIRECT_ASSIGN_ATTEMPTS = 5;

export const useDispatchBoard = (companyId: ComputedRef<number | null>) => {
  const waitingOrders = ref<WaitingOrder[]>([]);
  const activeDeliveries = ref<ActiveDelivery[]>([]);
  const refusedOrders = ref<RefusedOrder[]>([]);
  const pendingRestaurantOrders = ref<PendingRestaurantOrder[]>([]);

  const bookedDeliveries = computed(() =>
    activeDeliveries.value.filter((d) => d.status === "booked")
  );
  const pickedUpDeliveries = computed(() =>
    activeDeliveries.value.filter((d) => d.status === "picked_up")
  );

  const loading = ref(false);
  const errorMessage = ref("");
  // ISO string (ne timestamp broj) - direktno se prosleđuje u
  // formatRelativeTime za "Ažurirano pre X min" indikator.
  const lastUpdatedAt = ref<string | null>(null);
  const paused = ref(false);

  const loadAll = async (id: number) => {
    const isFirstLoad =
      waitingOrders.value.length === 0 &&
      activeDeliveries.value.length === 0 &&
      refusedOrders.value.length === 0 &&
      pendingRestaurantOrders.value.length === 0;
    if (isFirstLoad) loading.value = true;
    try {
      const [waiting, active, refused, pendingRestaurant] = await Promise.all([
        fetchWaitingOrders(id),
        fetchActiveDeliveries(id),
        fetchRefusedOrders(id),
        fetchPendingRestaurantOrders(id),
      ]);
      waitingOrders.value = waiting;
      activeDeliveries.value = active;
      refusedOrders.value = refused;
      pendingRestaurantOrders.value = pendingRestaurant;
      lastUpdatedAt.value = new Date().toISOString();
      errorMessage.value = "";
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam listu narudžbi.");
    } finally {
      loading.value = false;
    }
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  const stopPolling = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const startPolling = (id: number) => {
    stopPolling();
    timer = setInterval(() => {
      if (!paused.value && !document.hidden) loadAll(id);
    }, REFRESH_MS);
  };

  watch(
    companyId,
    (id) => {
      stopPolling();
      if (id) {
        loadAll(id);
        startPolling(id);
      } else {
        waitingOrders.value = [];
        activeDeliveries.value = [];
        refusedOrders.value = [];
        pendingRestaurantOrders.value = [];
        lastUpdatedAt.value = null;
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(stopPolling);

  const refresh = () => {
    if (companyId.value) loadAll(companyId.value);
  };

  const togglePause = () => {
    paused.value = !paused.value;
  };

  // Eskalaciono "Dodeli odmah" dugme (WaitingOrderRow) - ista postojeća
  // POST /orders/{id}/accept akcija koju koristi "Pošalji ponudu" na
  // CandidateCouriersPanel, samo automatski ide kroz rangiranu listu kandidata
  // umesto da dispečer ručno bira - nije nova akcija, samo istaknutija u UI-ju
  // (Dopuna_dodela_narudzbi_frontend.md, stavka 4).
  const directAssigningOrderId = ref<number | null>(null);
  // Jedna traka poruka za sve akcije sa borda (direktna dodela + ručno rješavanje
  // "Čeka restoran") - prikazuje je DispatchBoardPanel kao zatvorljiv info alert.
  // directAssign je piše progresivno (ko se trenutno pokušava, ko je odbio, ko
  // je na kraju dobio) da dispečer prati status uživo, ne samo konačan ishod.
  const boardActionMessage = ref("");

  // Razlikuje DVA razloga zašto POST /orders/{id}/accept padne (potvrđeno
  // uživo 15.09, N3a): (1) problem je sa OVIM kandidatom (npr. preko cash
  // limita - 409 BEZ `order_status` polja u tijelu) - ima smisla probati
  // sledećeg iz liste; (2) problem je sa SAMOM NARUDŽBOM (već dodijeljena/
  // otkazana/itd. - 409 SA `order_status`, isto polje na koje se oslanja
  // useCandidateCouriers) - dalji pokušaji su besmisleni, svaki sledeći
  // kandidat bi pao na istu grešku, treba odmah stati i osvježiti listu.
  const directAssign = async (orderId: number) => {
    if (!companyId.value) return;
    directAssigningOrderId.value = orderId;
    boardActionMessage.value = "";
    try {
      const candidates = await fetchCandidateCouriers(orderId, companyId.value);
      // Lista je rangirana po (vehicle_suitable, currently_available, distance_km),
      // ALI ne isključuje kurire koji već voze drugu dostavu (`on_delivery`) -
      // potvrđeno uživo 14.09, najbliži kandidat je bio on_delivery:true pa je
      // POST /orders/{id}/accept vratio 409 ("već vozite drugu narudžbu" - poruka
      // pisana za kurira, zbunjujuća za dispečera). Takav kandidat ionako ne može
      // prihvatiti - preskačemo ga umjesto da mu slijepo pošaljemo dodjelu.
      const queue = candidates.filter((c) => !c.onDelivery);
      if (queue.length === 0) {
        boardActionMessage.value = candidates.length
          ? "Svi kandidati su trenutno na dostavi - nema koga da se odmah dodijeli."
          : "Nema dostupnih kandidata za ovu narudžbu.";
        return;
      }

      const declinedBy: string[] = [];
      for (const candidate of queue.slice(0, MAX_DIRECT_ASSIGN_ATTEMPTS)) {
        const name = toLatin(candidate.name);
        boardActionMessage.value = `Narudžba #${orderId}: pokušavam da dodijelim kuriru ${name}...`;
        try {
          const response = await assignCourierToOrder(orderId, candidate.courierId);
          // warning = kurir je na/preko limita gotovine, firma NOTIFY_ONLY - dodela
          // je prošla, ali dispečer treba da vidi upozorenje (backend DIO 2, 2.1).
          const prefix = declinedBy.length
            ? `Narudžba #${orderId} dodijeljena kuriru ${name} (prethodno odbijeno: ${declinedBy.join(", ")}).`
            : `Narudžba #${orderId} dodijeljena kuriru ${name}.`;
          boardActionMessage.value = response.warning ? `${prefix} ${response.warning}` : prefix;
          await loadAll(companyId.value);
          return;
        } catch (error) {
          const status = getErrorStatus(error);
          const orderStatus = status === 409 ? getServerField(error, "order_status") : null;
          if (status === 409 && orderStatus) {
            boardActionMessage.value = `Narudžba #${orderId}: ${
              orderStatusMessage(orderStatus) ??
              getServerMessage(error) ??
              "narudžba više nije dostupna za dodjelu."
            }`;
            await loadAll(companyId.value);
            return;
          }
          // Problem je sa OVIM kandidatom (npr. cash limit) - probaj sledećeg.
          const reason = (status === 409 && getServerMessage(error)) || "nepoznat razlog";
          declinedBy.push(name);
          boardActionMessage.value = `${name} ne može da primi narudžbu #${orderId} (${reason}) - pokušavam sledećeg kandidata...`;
        }
      }
      boardActionMessage.value = `Narudžba #${orderId}: nijedan od ${declinedBy.length} pokušanih kandidata nije mogao da primi narudžbu (${declinedBy.join(", ")}).`;
    } catch (error) {
      boardActionMessage.value = toFriendlyErrorMessage(
        error,
        "Ne mogu direktno da dodelim narudžbu."
      );
    } finally {
      directAssigningOrderId.value = null;
    }
  };

  // Ručno rješavanje "Čeka restoran" narudžbe (odgovor §4) - dispečer je
  // telefonski dobio potvrdu/odbijanje od restorana. Backend prihvata samo
  // on-hold kao polaznu tačku; svaku drugu grešku prikazujemo čitljivo.
  const resolvingOrderId = ref<number | null>(null);

  const resolveRestaurant = async (
    orderId: number,
    action: "accept" | "reject",
    note?: string
  ) => {
    resolvingOrderId.value = orderId;
    boardActionMessage.value = "";
    try {
      await resolveRestaurantStatus(orderId, action, note);
      boardActionMessage.value =
        action === "accept"
          ? `Narudžba #${orderId} označena kao prihvaćena od restorana.`
          : `Narudžba #${orderId} označena kao odbijena od restorana.`;
      pendingRestaurantOrders.value = pendingRestaurantOrders.value.filter(
        (o) => o.id !== orderId
      );
      if (companyId.value) await loadAll(companyId.value);
    } catch (error) {
      boardActionMessage.value =
        getServerMessage(error) ||
        toFriendlyErrorMessage(error, "Ne mogu da riješim ovu narudžbu.");
    } finally {
      resolvingOrderId.value = null;
    }
  };

  return {
    waitingOrders,
    bookedDeliveries,
    pickedUpDeliveries,
    refusedOrders,
    pendingRestaurantOrders,
    loading,
    errorMessage,
    lastUpdatedAt,
    paused,
    refresh,
    togglePause,
    directAssigningOrderId,
    boardActionMessage,
    directAssign,
    resolvingOrderId,
    resolveRestaurant,
  };
};
