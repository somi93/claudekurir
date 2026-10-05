import { ref, watch, type ComputedRef } from "vue";
import { fetchDeliveryPricing, updateDeliveryPricing } from "~/services/deliveryPricingService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { Pricing } from "~/types/pricing";

export const useDeliveryPricing = (companyId: ComputedRef<number | null>) => {
  const pricing = ref<Pricing | null>(null);
  const loadingPricing = ref(false);
  const savingPricing = ref(false);
  const pricingSaved = ref(false);
  const errorMessage = ref("");

  const fetchPricing = async (id: number) => {
    loadingPricing.value = true;
    try {
      pricing.value = await fetchDeliveryPricing(id);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam cenu dostave.");
    } finally {
      loadingPricing.value = false;
    }
  };

  const savePricing = async () => {
    if (!companyId.value || !pricing.value) return;
    savingPricing.value = true;
    pricingSaved.value = false;
    try {
      pricing.value = await updateDeliveryPricing(companyId.value, {
        base_price: pricing.value.base_price,
        price_per_km: pricing.value.price_per_km,
        currency: pricing.value.currency,
      });
      pricingSaved.value = true;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam cenu dostave.");
    } finally {
      savingPricing.value = false;
    }
  };

  // immediate: true - companyId polazi od hardkodovane vrednosti (vidi
  // useDeliveryCompaniesStore), ne od null-a, pa bez ovoga watch nikad ne bi
  // okinuo prvi fetch.
  watch(
    companyId,
    (id) => {
      pricingSaved.value = false;
      if (!id) return;
      fetchPricing(id);
    },
    { immediate: true }
  );

  return {
    pricing,
    loadingPricing,
    savingPricing,
    pricingSaved,
    errorMessage,
    savePricing,
  };
};
