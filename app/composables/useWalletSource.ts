import { computed, onBeforeUnmount, onMounted, watch, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { useWalletStore } from "~/stores/wallet";

// Dok predaja gotovine čeka potvrdu dispečera, ekran sam provjerava (saldo i predaje):
// dok backend ne šalje push za potvrdu (stavka N4) to je jedini način da kurir vidi novo
// stanje bez ručnog osvježavanja.
export const WALLET_POLL_MS = 20_000;

// Novčanik kurira za ekran koji ga prikazuje. Podaci žive u stores/wallet.ts, pa prelazak
// između ekrana ne zove server ponovo dok su podaci svježi.
//  - pri otvaranju: učitava što fali, staro osvježava u pozadini (bez skeletona)
//  - povratak u aplikaciju (sa zaključanog ekrana, iz druge aplikacije): osvježi staro
//  - dok predaja čeka: provjera svakih 20 s, ali samo dok je ekran vidljiv
export const useWalletSource = (courierId: ComputedRef<number>) => {
  const store = useWalletStore();
  const {
    balance,
    handovers,
    payouts,
    balanceLoaded,
    balanceLoading,
    balanceError,
    balanceStale,
    balanceAt,
    handoversLoaded,
    handoversLoading,
    handoversError,
    handoversStale,
    payoutsLoaded,
    payoutsLoading,
    payoutsError,
    payoutsStale,
    submitting,
    justConfirmed,
  } = storeToRefs(store);

  const hasPending = computed(() => handovers.value.some((h) => h.pending));

  const open = () => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;
    store.start(courierId.value);
    store.open();
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  const stopPolling = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const syncPolling = () => {
    stopPolling();
    if (typeof document === "undefined" || document.hidden || !hasPending.value) return;
    timer = setInterval(() => void store.refreshPending(), WALLET_POLL_MS);
  };

  const onVisible = () => {
    if (document.hidden) {
      stopPolling();
      return;
    }
    open();
    if (hasPending.value) void store.refreshPending();
    syncPolling();
  };

  onMounted(() => {
    open();
    syncPolling();
    document.addEventListener("visibilitychange", onVisible);
  });
  onBeforeUnmount(() => {
    stopPolling();
    document.removeEventListener("visibilitychange", onVisible);
  });

  watch(courierId, open);
  watch(hasPending, syncPolling);

  return {
    balance,
    handovers,
    payouts,
    balanceLoaded,
    balanceLoading,
    balanceError,
    balanceStale,
    balanceAt,
    handoversLoaded,
    handoversLoading,
    handoversError,
    handoversStale,
    payoutsLoaded,
    payoutsLoading,
    payoutsError,
    payoutsStale,
    submitting,
    justConfirmed,
    hasPending,
    refreshAll: store.refreshAll,
    refreshPending: store.refreshPending,
    retryFailed: store.retryFailed,
    report: store.report,
    dismissConfirmed: store.dismissConfirmed,
  };
};
