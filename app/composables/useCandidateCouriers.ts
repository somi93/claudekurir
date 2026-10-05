import { onUnmounted, ref } from "vue";
import {
  assignCourierToOrder,
  fetchCandidateCouriers as fetchCandidateCouriersRequest,
} from "~/services/candidateCouriersService";
import {
  getErrorStatus,
  getServerField,
  getServerMessage,
  toFriendlyErrorMessage,
} from "~/utils/errorMessage";
import { orderStatusMessage } from "~/utils/orderStatus";
import type { CandidateCourier } from "~/types/candidateCourier";

// dispecer-Dodela_kurira_frontend.md: "Auto-refresh je obavezan, ne opcion" -
// kurir može sam prihvatiti narudžbu (postojeći accept tok) dok dispečer
// gleda ovaj ekran, pa lista ume da zastari za par sekundi.
const AUTO_REFRESH_MS = 20000;

// Poruka o dodeli sama nestaje posle ovoga - ranije je "Order is no longer
// available" ostajao zalijepljen i posle osvježavanja liste.
const ASSIGN_MESSAGE_TTL_MS = 8000;

// Backend za /orders/{id}/accept ume da vrati neprevedeni engleski string kad
// narudžba nije u stanju za dodelu - prevedemo poznate, ostalo puštamo (npr.
// srpska poruka o BLOCK limitu gotovine je već čitljiva).
const translateAssignMessage = (message: string): string => {
  if (/no longer available/i.test(message)) {
    return "Narudžba više nije dostupna za dodjelu — vjerovatno je već preuzeta, dodijeljena ili otkazana.";
  }
  return message;
};

export const useCandidateCouriers = () => {
  const candidates = ref<CandidateCourier[]>([]);
  const loading = ref(false);
  const errorMessage = ref("");
  const currentOrderId = ref<number | null>(null);

  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  const stopAutoRefresh = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  };

  // delivery_company_id je obavezan - backend vraća SAMO kurire te firme
  // (dispečer jedne firme ne vidi kurire druge koja vozi za isti restoran).
  // Pamti se da bi osvježavanje posle dodjele (assign) moglo da ga ponovi.
  const currentCompanyId = ref<number | null>(null);

  const load = async (orderId: number, companyId: number) => {
    currentOrderId.value = orderId;
    currentCompanyId.value = companyId;
    loading.value = true;
    errorMessage.value = "";
    try {
      candidates.value = await fetchCandidateCouriersRequest(orderId, companyId);
    } catch (error) {
      // Ne ostavljati listu od PRETHODNE narudžbe vidljivu - bez ovoga dispečer
      // vidi grešku za NOVU (nevalidnu) narudžbu, ali ispod i dalje stoji stara
      // lista sa aktivnim "Pošalji ponudu" dugmadima kao da važi za nju.
      candidates.value = [];
      errorMessage.value = toFriendlyErrorMessage(
        error,
        "Ne mogu da učitam kandidate za ovu narudžbu."
      );
    } finally {
      loading.value = false;
    }
  };

  const startAutoRefresh = (orderId: number, companyId: number) => {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (currentOrderId.value === orderId && !document.hidden) load(orderId, companyId);
    }, AUTO_REFRESH_MS);
  };

  onUnmounted(stopAutoRefresh);

  const assigningCourierId = ref<number | null>(null);
  const assignMessage = ref("");
  const assignSuccess = ref(false);

  let assignMessageTimer: ReturnType<typeof setTimeout> | null = null;
  const setAssignMessage = (message: string, success: boolean) => {
    assignSuccess.value = success;
    assignMessage.value = message;
    if (assignMessageTimer) clearTimeout(assignMessageTimer);
    if (message) {
      assignMessageTimer = setTimeout(() => {
        assignMessage.value = "";
      }, ASSIGN_MESSAGE_TTL_MS);
    }
  };
  onUnmounted(() => {
    if (assignMessageTimer) clearTimeout(assignMessageTimer);
  });

  // dispecer-Dodela_kurira_frontend.md: 409 = neko je već prihvatio narudžbu
  // (realan scenario - kurir može sam prihvatiti dok dispečer gleda ekran) ILI
  // je kurir na BLOCK limitu gotovine - serverska poruka razlikuje slučajeve.
  // Osveži listu i u tom slučaju i posle uspešne dodele, da prikaz ne ostane
  // zastareo.
  const assign = async (orderId: number, courierId: number) => {
    assigningCourierId.value = courierId;
    assignMessage.value = "";
    try {
      const response = await assignCourierToOrder(orderId, courierId);
      // Ponuda JE poslata; ako backend vrati warning (kurir na/preko limita
      // gotovine, firma NOTIFY_ONLY) prikazujemo ga umesto generičke potvrde.
      setAssignMessage(response.warning || "Ponuda je poslata kuriru.", true);
      if (currentCompanyId.value !== null) await load(orderId, currentCompanyId.value);
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 409) {
        // Prvo probaj čitljivu poruku po `order_status` iz tela (odgovor 2.4),
        // pa serversku poruku, pa generičku.
        setAssignMessage(
          orderStatusMessage(getServerField(error, "order_status")) ??
            translateAssignMessage(
              getServerMessage(error) ||
                "Narudžba je u međuvremenu prihvaćena ili otkazana - lista je osvežena."
            ),
          false
        );
        if (currentCompanyId.value !== null) await load(orderId, currentCompanyId.value);
      } else if (status === 404) {
        setAssignMessage("Narudžba nije pronađena.", false);
      } else {
        setAssignMessage(
          toFriendlyErrorMessage(error, "Ne mogu da pošaljem ponudu ovom kuriru."),
          false
        );
      }
    } finally {
      assigningCourierId.value = null;
    }
  };

  return {
    candidates,
    loading,
    errorMessage,
    load,
    startAutoRefresh,
    stopAutoRefresh,
    assigningCourierId,
    assignMessage,
    assignSuccess,
    assign,
  };
};
