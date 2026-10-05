import { ref } from "vue";
import { broadcastCourierMessage, sendCourierInboxMessage } from "~/services/courierInboxService";
import { getErrorStatus, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { BroadcastMessagePayload, SendInboxMessagePayload } from "~/types/inbox";

// Dispečerska strana inbox sistema (spec 27_08_2026 + #223681) - slanje poruke
// jednom kuriru ili grupno. Istorija poruka kurira je u useCourierMessages. Nema companyId za
// slanje jednom kuriru: autorizaciju radi backend (403 ako veza ne postoji).
export const useCourierMessaging = () => {
  const alertStore = useAlertStore();

  const sending = ref(false);
  const broadcasting = ref(false);

  const sendMessage = async (
    courierId: number,
    payload: SendInboxMessagePayload
  ): Promise<boolean> => {
    sending.value = true;
    try {
      await sendCourierInboxMessage(courierId, payload);
      alertStore.success("Poruka je poslata kuriru.");
      return true;
    } catch (error) {
      if (getErrorStatus(error) === 403) {
        alertStore.error(
          "Nemaš pravo da šalješ poruke ovom kuriru - nije vezan za tvoju firmu."
        );
      } else {
        alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da pošaljem poruku."));
      }
      return false;
    } finally {
      sending.value = false;
    }
  };

  const broadcast = async (
    companyId: number,
    payload: BroadcastMessagePayload
  ): Promise<boolean> => {
    broadcasting.value = true;
    try {
      const count = await broadcastCourierMessage(companyId, payload);
      alertStore.success(`Poruka poslata ${count} ${count === 1 ? "kuriru" : "kurira"}.`);
      return true;
    } catch (error) {
      alertStore.error(
        toFriendlyErrorMessage(error, "Ne mogu da pošaljem grupnu poruku.")
      );
      return false;
    } finally {
      broadcasting.value = false;
    }
  };

  return {
    sending,
    broadcasting,
    sendMessage,
    broadcast,
  };
};
