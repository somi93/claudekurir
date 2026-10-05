import { ref, watch, type ComputedRef } from "vue";
import {
  createCompanyCourier,
  fetchCompanyCouriers,
  removeCompanyCourier,
  setCourierSuspended,
  updateCompanyCourier,
} from "~/services/dispatcherCouriersService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type {
  CompanyCourier,
  CourierCreatePayload,
  CourierUpdatePayload,
} from "~/types/company-courier";

// options.enabled - lazy gate za tabove (vidi useFinanceSettings).
export const useCompanyCouriers = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const alertStore = useAlertStore();

  const couriers = ref<CompanyCourier[]>([]);
  const loadingCouriers = ref(false);
  // Lista je bar jednom stigla. Dok nije (učitavanje, pad) se ne tvrdi "nema kurira".
  const couriersLoaded = ref(false);
  const savingCourier = ref(false);
  const errorMessage = ref("");

  const fetchCouriers = async (id: number) => {
    loadingCouriers.value = true;
    try {
      couriers.value = await fetchCompanyCouriers(id);
      couriersLoaded.value = true;
      errorMessage.value = "";
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam listu kurira.");
    } finally {
      loadingCouriers.value = false;
    }
  };

  // suspended/aktiviraj - reason samo pri suspendovanju (backend ga sam
  // brise pri aktivaciji, vidi types/company-courier.ts). Optimisticki flip
  // sa rollback-om, isti obrazac kao useSurcharges.toggleSurcharge.
  const setSuspended = async (courier: CompanyCourier, suspended: boolean, reason?: string) => {
    const previous = { suspended: courier.suspended, reason: courier.suspended_reason };
    courier.suspended = suspended;
    courier.suspended_reason = suspended ? (reason ?? null) : null;
    if (!companyId.value) return;
    try {
      await setCourierSuspended(companyId.value, courier.courier_id, {
        suspended,
        reason: suspended ? reason : undefined,
      });
      alertStore.success(suspended ? "Kurir je suspendovan." : "Kurir je aktiviran.");
    } catch (error) {
      courier.suspended = previous.suspended;
      courier.suspended_reason = previous.reason;
      errorMessage.value = toFriendlyErrorMessage(
        error,
        suspended ? "Ne mogu da suspendujem kurira." : "Ne mogu da aktiviram kurira."
      );
    }
  };

  const addCourier = async (payload: CourierCreatePayload): Promise<boolean> => {
    if (!companyId.value) return false;
    savingCourier.value = true;
    try {
      // Create odgovor je sad pun red (fullCourierRow) - ubacujemo ga direktno,
      // bez dodatnog re-fetch-a cijele liste.
      const created = await createCompanyCourier(companyId.value, payload);
      couriers.value = [...couriers.value, created];
      alertStore.success("Kurir je dodat.");
      return true;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da kreiram kurira.");
      return false;
    } finally {
      savingCourier.value = false;
    }
  };

  const updateCourier = async (
    courier: CompanyCourier,
    payload: CourierUpdatePayload
  ): Promise<boolean> => {
    if (!companyId.value) return false;
    savingCourier.value = true;
    try {
      const updated = await updateCompanyCourier(companyId.value, courier.courier_id, payload);
      // PATCH sad vraća PUN red (fullCourierRow, uključuje suspended*), pa
      // direktno zamjenjujemo red - nema više merge gimnastike.
      couriers.value = couriers.value.map((c) =>
        c.courier_id === courier.courier_id ? updated : c
      );
      alertStore.success("Izmene su sačuvane.");
      return true;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da izmenim kurira.");
      return false;
    } finally {
      savingCourier.value = false;
    }
  };

  // Ne brise kurira iz sistema - samo ga sklanja sa liste ove firme (vidi
  // napomena u types/company-courier.ts).
  const removeCourier = async (courierId: number) => {
    if (!companyId.value) return;
    try {
      await removeCompanyCourier(companyId.value, courierId);
      couriers.value = couriers.value.filter((c) => c.courier_id !== courierId);
      alertStore.success("Kurir je uklonjen sa liste firme.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da uklonim kurira sa liste firme.");
    }
  };

  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled]) => {
      if (!id || !enabled) return;
      // Druga firma: lista prethodne ne smije da prođe kao učitana.
      couriersLoaded.value = false;
      fetchCouriers(id);
    },
    { immediate: true }
  );

  // "Pokušaj ponovo" poslije pada.
  const reloadCouriers = async () => {
    if (companyId.value && !loadingCouriers.value) await fetchCouriers(companyId.value);
  };

  return {
    couriers,
    loadingCouriers,
    couriersLoaded,
    reloadCouriers,
    savingCourier,
    errorMessage,
    setSuspended,
    addCourier,
    updateCourier,
    removeCourier,
  };
};
