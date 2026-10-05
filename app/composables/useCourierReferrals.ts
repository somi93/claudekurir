import { onMounted, ref, watch, type ComputedRef } from "vue";
import {
  createReferral,
  deleteReferral,
  fetchCourierReferrals,
} from "~/services/courierReferralsService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { toLatin } from "~/utils/toLatin";
import { useAlertStore } from "~/stores/alert";
import { REFERRAL_REWARD_DELIVERIES } from "~/config/referral";
import type { ReferredFriend } from "~/types/referral";

export const useCourierReferrals = (courierId: ComputedRef<number>) => {
  const alertStore = useAlertStore();

  const friends = ref<ReferredFriend[]>([]);
  const loading = ref(true);
  const saving = ref(false);
  // Inline greška + retry umjesto toasta (vidi pages/courier/history.vue).
  const errorMessage = ref("");

  const refresh = async () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;

    loading.value = true;
    errorMessage.value = "";
    try {
      friends.value = await fetchCourierReferrals(courierId.value);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam preporuke.");
    } finally {
      loading.value = false;
    }
  };

  const addFriend = async (name: string) => {
    if (!courierId.value) return false;

    saving.value = true;
    try {
      const created = await createReferral(courierId.value, {
        name,
        deliveries_required: REFERRAL_REWARD_DELIVERIES,
      });
      friends.value = [created, ...friends.value];
      alertStore.success(`${toLatin(name)} je dodat na listu pozvanih.`);
      return true;
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da dodam prijatelja."));
      return false;
    } finally {
      saving.value = false;
    }
  };

  const removeFriend = async (id: number) => {
    saving.value = true;
    try {
      await deleteReferral(id);
      friends.value = friends.value.filter((f) => f.id !== id);
      alertStore.success("Unos je obrisan.");
      return true;
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da obrišem unos."));
      return false;
    } finally {
      saving.value = false;
    }
  };

  onMounted(refresh);
  watch(courierId, refresh);

  return { friends, loading, errorMessage, saving, refresh, addFriend, removeFriend };
};
