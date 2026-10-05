import { computed, onMounted, ref, watch, type ComputedRef } from "vue";
import {
  createQuest,
  deleteQuest,
  fetchCourierQuests,
  updateQuest,
} from "~/services/courierQuestsService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { Quest, QuestCreate, QuestUpdate } from "~/types/quest";

export const useCourierQuests = (courierId: ComputedRef<number>) => {
  const alertStore = useAlertStore();

  const quests = ref<Quest[]>([]);
  const loading = ref(true);
  const saving = ref(false);
  // Greška učitavanja stoji inline (uz retry), ne kao toast - prazne liste
  // kvestova ne smiju da izgledaju kao "nema kvestova" kad je poziv pao.
  const errorMessage = ref("");
  const activeTab = ref<"available" | "current">("current");

  const availableQuests = computed(() => quests.value.filter((q) => q.status === "not-joined"));
  const currentQuests = computed(() => quests.value.filter((q) => q.status !== "not-joined"));

  const refresh = async () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;

    loading.value = true;
    errorMessage.value = "";
    try {
      quests.value = await fetchCourierQuests(courierId.value);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam kvestove.");
    } finally {
      loading.value = false;
    }
  };

  const addQuest = async (payload: QuestCreate) => {
    if (!courierId.value) return false;

    saving.value = true;
    try {
      const created = await createQuest(courierId.value, payload);
      quests.value = [created, ...quests.value];
      alertStore.success("Kvest je kreiran.");
      return true;
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da kreiram kvest."));
      return false;
    } finally {
      saving.value = false;
    }
  };

  const editQuest = async (
    id: number,
    payload: QuestUpdate,
    successMessage = "Kvest je sačuvan."
  ) => {
    saving.value = true;
    try {
      const updated = await updateQuest(id, payload);
      quests.value = quests.value.map((q) => (q.id === id ? updated : q));
      alertStore.success(successMessage);
      return true;
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da sačuvam kvest."));
      return false;
    } finally {
      saving.value = false;
    }
  };

  const removeQuest = async (id: number) => {
    saving.value = true;
    try {
      await deleteQuest(id);
      quests.value = quests.value.filter((q) => q.id !== id);
      alertStore.success("Kvest je obrisan.");
      return true;
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da obrišem kvest."));
      return false;
    } finally {
      saving.value = false;
    }
  };

  const joinQuest = async (id: number) => {
    const quest = quests.value.find((q) => q.id === id);
    if (!quest) return false;

    const ok = await editQuest(
      id,
      { status: "in-progress" },
      `Pridružio si se kvestu "${quest.title}".`
    );
    if (ok) activeTab.value = "current";
    return ok;
  };

  onMounted(refresh);
  watch(courierId, refresh);

  return {
    quests,
    loading,
    errorMessage,
    saving,
    activeTab,
    availableQuests,
    currentQuests,
    refresh,
    addQuest,
    editQuest,
    removeQuest,
    joinQuest,
  };
};
