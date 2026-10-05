import { onBeforeUnmount, onMounted, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from "vue";
import { storeToRefs } from "pinia";
import { useDeliveriesStore, type EarningsScope } from "~/stores/deliveries";

// Završene dostave kurira (istorija + zarada spojene po broju narudžbe) za stranicu
// koja ih prikazuje - Istoriju i Novčanik. Podaci žive u stores/deliveries.ts, pa
// prelazak između dvije stranice ne zove server ponovo dok su podaci svježi.
//
// `scope` je opseg zarade: "recent" (~31 dan, dovoljno za Novčanik) ili "all"
// (period "Sve" u Istoriji). Kad se promijeni na širi, dovlači se samo razlika.
export const useCourierDeliveries = (
  courierId: ComputedRef<number>,
  scope: MaybeRefOrGetter<EarningsScope> = "recent"
) => {
  const store = useDeliveriesStore();
  const {
    deliveries,
    byId,
    history,
    earnings,
    historyLoaded,
    earningsLoaded,
    historyLoading,
    earningsLoading,
    historyError,
    earningsError,
  } = storeToRefs(store);

  const open = () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;
    store.start(courierId.value);
    void store.open(toValue(scope));
  };

  // Povratak u aplikaciju (iz druge aplikacije, sa zaključanog ekrana): ako su
  // podaci stariji od minute, osvježi ih u pozadini. Kad su svježi, ne radi ništa.
  const onVisible = () => {
    if (!document.hidden) open();
  };

  onMounted(() => {
    open();
    document.addEventListener("visibilitychange", onVisible);
  });
  onBeforeUnmount(() => document.removeEventListener("visibilitychange", onVisible));

  watch(courierId, open);
  watch(
    () => toValue(scope),
    (next, previous) => {
      if (next !== previous) open();
    }
  );

  return {
    deliveries,
    byId,
    history,
    earnings,
    historyLoaded,
    earningsLoaded,
    historyLoading,
    earningsLoading,
    historyError,
    earningsError,
    refreshAll: store.refreshAll,
    retryHistory: store.retryHistory,
    retryEarnings: store.retryEarnings,
  };
};
