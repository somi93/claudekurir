import { ref, watch, type ComputedRef } from "vue";
import {
  fetchRestaurantCooperations,
  setRestaurantActive,
} from "~/services/restaurantCooperationService";
import { getErrorStatus, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { RestaurantCooperation } from "~/types/restaurant-cooperation";

// Backend (27.08) razlikuje dva slučaja kad PATCH ne prođe zbog id-a:
// - 403: veza postoji ali pripada drugoj firmi za dostavu ("Niste vezani...")
// - 404: veza sa tim id-em uopšte ne postoji (findOrFail)
const toggleErrorMessage = (error: unknown): string => {
  const status = getErrorStatus(error);
  if (status === 403) {
    return "Nemaš pristup ovoj vezi - restoran je vezan za drugu firmu za dostavu.";
  }
  if (status === 404) {
    return "Ova veza sa restoranom više ne postoji. Osveži listu i pokušaj ponovo.";
  }
  return toFriendlyErrorMessage(error, "Ne mogu da sačuvam status saradnje.");
};

// options.enabled - lazy gate za tabove (vidi useFinanceSettings).
export const useRestaurantCooperation = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const alertStore = useAlertStore();

  const restaurants = ref<RestaurantCooperation[]>([]);
  const loadingRestaurants = ref(false);
  const errorMessage = ref("");

  const fetchRestaurants = async (id: number) => {
    loadingRestaurants.value = true;
    try {
      restaurants.value = await fetchRestaurantCooperations(id);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam listu restorana.");
    } finally {
      loadingRestaurants.value = false;
    }
  };

  // Optimistički prekidač (isti obrazac kao useCompanyCouriers.setSuspended) -
  // odmah flipujemo active_restoran + suspension_reason, pa vraćamo nazad ako
  // zahtev ne uspe. reason ide samo pri suspenziji; pri reaktivaciji ga backend
  // sam čisti, pa lokalno postavljamo null.
  const toggleRestaurant = async (
    restaurant: RestaurantCooperation,
    active: boolean,
    reason?: string
  ) => {
    const previous = {
      active: restaurant.active_restoran,
      reason: restaurant.suspension_reason,
    };
    restaurant.active_restoran = active;
    restaurant.suspension_reason = active ? null : reason ?? null;
    try {
      await setRestaurantActive(restaurant.id, active, reason);
      alertStore.success(
        active ? "Saradnja sa restoranom je uključena." : "Saradnja sa restoranom je suspendovana."
      );
    } catch (error) {
      restaurant.active_restoran = previous.active;
      restaurant.suspension_reason = previous.reason;
      errorMessage.value = toggleErrorMessage(error);
    }
  };

  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled]) => {
      if (!id || !enabled) return;
      fetchRestaurants(id);
    },
    { immediate: true }
  );

  return {
    restaurants,
    loadingRestaurants,
    errorMessage,
    toggleRestaurant,
  };
};
