import { ref } from "vue";
import { fetchOrderEvents } from "~/services/orderEventsService";
import { toFriendlyErrorMessage, getErrorStatus } from "~/utils/errorMessage";
import type { OrderEvent, OrderEventsOrder } from "~/types/order-events";

export const useOrderEvents = () => {
  const order = ref<OrderEventsOrder | null>(null);
  const events = ref<OrderEvent[]>([]);
  const loading = ref(false);
  const notFound = ref(false);
  const errorMessage = ref("");

  const load = async (orderId: number) => {
    loading.value = true;
    notFound.value = false;
    errorMessage.value = "";
    try {
      const response = await fetchOrderEvents(orderId);
      order.value = response.order;
      events.value = response.data;
    } catch (error) {
      if (getErrorStatus(error) === 404) {
        notFound.value = true;
      } else {
        errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam istoriju narudžbe.");
      }
    } finally {
      loading.value = false;
    }
  };

  return { order, events, loading, notFound, errorMessage, load };
};
