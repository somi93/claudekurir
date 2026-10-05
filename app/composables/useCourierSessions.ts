import { onMounted, ref, watch, type ComputedRef } from "vue";
import {
  cancelSession,
  fetchCourierSessions,
  offerSessionSwap,
  reserveSession as reserveSessionRequest,
} from "~/services/courierSessionsService";
import { SESSION_DAILY_LIMIT_HOURS } from "~/config/session";
import { formatSessionDate } from "~/utils/session";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { WorkSession } from "~/types/session";

const sessionHours = (session: WorkSession) => {
  const [startHour, startMinute] = session.startTime.split(":").map(Number);
  const [endHour, endMinute] = session.endTime.split(":").map(Number);
  return (endHour! * 60 + endMinute! - (startHour! * 60 + startMinute!)) / 60;
};

export const useCourierSessions = (courierId: ComputedRef<number>) => {
  const alertStore = useAlertStore();

  const availableSessions = ref<WorkSession[]>([]);
  const mySessions = ref<WorkSession[]>([]);
  const loading = ref(true);
  const saving = ref(false);
  // Inline greška + retry umjesto toasta (vidi pages/courier/history.vue).
  const errorMessage = ref("");

  const refresh = async () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;

    loading.value = true;
    errorMessage.value = "";
    try {
      const sessions = await fetchCourierSessions(courierId.value);
      availableSessions.value = sessions.available;
      mySessions.value = sessions.mine;
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam sesije.");
    } finally {
      loading.value = false;
    }
  };

  const reservedHoursOn = (date: string) =>
    mySessions.value
      .filter((session) => session.date === date && session.status !== "no-show")
      .reduce((sum, session) => sum + sessionHours(session), 0);

  const reserveSession = async (session: WorkSession) => {
    const hoursSoFar = reservedHoursOn(session.date);
    if (hoursSoFar + sessionHours(session) > SESSION_DAILY_LIMIT_HOURS) {
      alertStore.warning(
        `Dostigao si dnevni limit od ${SESSION_DAILY_LIMIT_HOURS}h za ${formatSessionDate(session.date)}.`
      );
      return;
    }

    saving.value = true;
    try {
      const reserved = await reserveSessionRequest(courierId.value, session.id);
      availableSessions.value = availableSessions.value.filter((s) => s.id !== session.id);
      mySessions.value = [...mySessions.value, reserved];
      alertStore.success(
        `Sesija ${formatSessionDate(session.date)} ${session.startTime}–${session.endTime} je rezervisana.`
      );
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da rezervišem sesiju."));
    } finally {
      saving.value = false;
    }
  };

  const offerSwap = async (session: WorkSession) => {
    saving.value = true;
    try {
      const updated = await offerSessionSwap(session.id);
      mySessions.value = mySessions.value.map((s) => (s.id === session.id ? updated : s));
      alertStore.success("Sesija je ponuđena drugim kuririma za zamenu.");
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da ponudim zamenu."));
    } finally {
      saving.value = false;
    }
  };

  const cancelReservedSession = async (session: WorkSession) => {
    saving.value = true;
    try {
      await cancelSession(session.id);
      mySessions.value = mySessions.value.filter((s) => s.id !== session.id);
      alertStore.success("Rezervacija je otkazana.");
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da otkažem sesiju."));
    } finally {
      saving.value = false;
    }
  };

  onMounted(refresh);
  watch(courierId, refresh);

  return {
    availableSessions,
    mySessions,
    loading,
    errorMessage,
    saving,
    refresh,
    reserveSession,
    offerSwap,
    cancelReservedSession,
  };
};
