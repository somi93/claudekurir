import { computed, onMounted, ref, watch, type ComputedRef } from "vue";
import { fetchCourierScoring } from "~/services/courierScoringService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { BatchSlot, ScoreFactor } from "~/types/scoring";

const BATCH_COUNT = 12;
const BASE_HOUR = 8;

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "response" in error &&
  (error as { response?: { status?: number } }).response?.status === 404;

export const useCourierScoring = (courierId: ComputedRef<number>) => {
  const currentBatch = ref(0);
  const lastWeekScore = ref(0);
  const scoreFactors = ref<ScoreFactor[]>([]);
  const loading = ref(true);
  // Scoring se pravi nedeljnim batch job-om na backendu - dok se ne pojavi
  // prvi zapis za kurira, GET vraća 404. To nije greška, samo prazno stanje.
  const notAvailable = ref(false);
  // Prava greška (nije 404) - inline + retry, ne toast.
  const errorMessage = ref("");

  const batchSchedule = computed<BatchSlot[]>(() =>
    Array.from({ length: BATCH_COUNT }, (_, i) => {
      const totalMinutes = BASE_HOUR * 60 + i * 30;
      const hours = Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, "0");
      const minutes = (totalMinutes % 60).toString().padStart(2, "0");
      return { batch: i + 1, opensAt: `${hours}:${minutes}` };
    })
  );

  const refresh = async () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;

    loading.value = true;
    notAvailable.value = false;
    errorMessage.value = "";

    try {
      const scoring = await fetchCourierScoring(courierId.value);
      currentBatch.value = scoring.currentBatch;
      lastWeekScore.value = scoring.lastWeekScore;
      scoreFactors.value = scoring.scoreFactors;
    } catch (error) {
      if (isNotFound(error)) {
        notAvailable.value = true;
      } else {
        errorMessage.value = toFriendlyErrorMessage(
          error,
          "Ne mogu da učitam scoring podatke."
        );
      }
    } finally {
      loading.value = false;
    }
  };

  onMounted(refresh);
  watch(courierId, refresh);

  return {
    currentBatch,
    lastWeekScore,
    scoreFactors,
    loading,
    notAvailable,
    errorMessage,
    batchSchedule,
    refresh,
  };
};
