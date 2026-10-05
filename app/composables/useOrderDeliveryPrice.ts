import { ref, watch, type ComputedRef } from "vue";
import { calculateDeliveryPricing } from "~/services/deliveryPricingService";
import type { Order } from "~/models/Order";
import type { PricingCalculation } from "~/types/pricing";

// Isti par koordinata (restoran + naručilac) se ne menja za datu porudžbinu -
// keš po order.id da lista ponuda ne šalje ponovni zahtev na svaki re-render.
const cache = new Map<number, PricingCalculation>();

export const useOrderDeliveryPrice = (order: ComputedRef<Order | null>) => {
  const calculation = ref<PricingCalculation | null>(null);
  const loading = ref(false);

  const fetchCalculation = async (value: Order) => {
    const cached = cache.get(value.id);
    if (cached) {
      calculation.value = cached;
      return;
    }

    const restaurant = value.restaurant?.location?.coordination;
    const customer = value.location?.coordination;
    if (!restaurant || !customer || !value.deliveryCompanyId) {
      calculation.value = null;
      return;
    }

    loading.value = true;
    try {
      const result = await calculateDeliveryPricing(value.deliveryCompanyId, {
        restaurant_lat: restaurant.lat,
        restaurant_lng: restaurant.lng,
        customer_lat: customer.lat,
        customer_lng: customer.lng,
      });
      cache.set(value.id, result);
      calculation.value = result;
    } catch {
      calculation.value = null;
    } finally {
      loading.value = false;
    }
  };

  watch(
    order,
    (value) => {
      if (value) fetchCalculation(value);
      else calculation.value = null;
    },
    { immediate: true }
  );

  return { calculation, loading };
};
