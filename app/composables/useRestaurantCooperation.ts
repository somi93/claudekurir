import { ref, watch, type ComputedRef } from "vue";
import {
  fetchRestaurantCooperations,
  setRestaurantActive,
} from "~/services/restaurantCooperationService";
import { getErrorStatus, getFieldErrors, toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { ActionResult } from "~/composables/useCourierRoster";
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
    return "Ova veza sa restoranom više ne postoji. Osvježi listu i pokušaj ponovo.";
  }
  return toFriendlyErrorMessage(error, "Ne mogu da sačuvam status saradnje. Pokušaj ponovo.");
};

// options.enabled - lazy gate (vidi useFinanceSettings).
export const useRestaurantCooperation = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const restaurants = ref<RestaurantCooperation[]>([]);
  const loadingRestaurants = ref(false);
  // Pad učitavanja: poruka sa "Pokušaj ponovo" u mjestu liste.
  const loadFailed = ref(false);
  const errorMessage = ref("");

  // Odgovor za firmu koja više nije izabrana se odbacuje.
  let seq = 0;

  const fetchRestaurants = async (id: number) => {
    const mine = ++seq;
    loadingRestaurants.value = true;
    loadFailed.value = false;
    errorMessage.value = "";
    try {
      const loaded = await fetchRestaurantCooperations(id);
      if (mine === seq) restaurants.value = loaded;
    } catch (error) {
      if (mine !== seq) return;
      loadFailed.value = true;
      errorMessage.value = toFriendlyErrorMessage(error, "Server ne odgovara.");
    } finally {
      if (mine === seq) loadingRestaurants.value = false;
    }
  };

  const reload = async () => {
    const id = companyId.value;
    if (id) await fetchRestaurants(id);
  };

  // Suspenzija / uključivanje iz lista: red se mijenja tek kad server prihvati, a greška stiže
  // kao rezultat (list je pokazuje uz dugme). reason ide samo pri suspenziji; pri uključivanju ga
  // backend sam briše, pa lokalno postavljamo null.
  const setCooperation = async (
    restaurant: RestaurantCooperation,
    active: boolean,
    reason?: string
  ): Promise<ActionResult> => {
    try {
      await setRestaurantActive(restaurant.id, active, reason);
      restaurant.active_restoran = active;
      restaurant.suspension_reason = active ? null : (reason ?? null);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: toggleErrorMessage(error), fields: getFieldErrors(error) };
    }
  };

  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled], previous) => {
      if (previous && previous[0] !== id) restaurants.value = [];
      if (!id || !enabled) return;
      void fetchRestaurants(id);
    },
    { immediate: true }
  );

  return {
    restaurants,
    loadingRestaurants,
    loadFailed,
    errorMessage,
    reload,
    setCooperation,
  };
};
