import { ref, watch, type ComputedRef } from "vue";
import { fetchCouriersBalance } from "~/services/dispatcherWalletService";
import type { CourierBalance } from "~/types/courier-balance";

// Stanje gotovine kurira firme (couriers-balance): služi samo za posljedicu limita na ekranu Firma
// (koliko ih je preko limita). Pad učitavanja nije greška stranice: red i editor jednostavno ne
// pokažu brojku, a ostalo radi. `balances` je null dok se stanje ne zna.
export const useCashBalances = (companyId: ComputedRef<number | null>) => {
  const balances = ref<CourierBalance[] | null>(null);
  const loading = ref(false);
  const failed = ref(false);

  let seq = 0;

  const load = async (id: number) => {
    const mine = ++seq;
    loading.value = true;
    failed.value = false;
    try {
      const loaded = await fetchCouriersBalance(id);
      if (mine === seq) balances.value = loaded;
    } catch {
      if (mine !== seq) return;
      failed.value = true;
    } finally {
      if (mine === seq) loading.value = false;
    }
  };

  const reload = async () => {
    const id = companyId.value;
    if (id) await load(id);
  };

  watch(
    companyId,
    (id, previous) => {
      if (previous !== undefined && previous !== id) balances.value = null;
      if (id) void load(id);
    },
    { immediate: true }
  );

  return { balances, loading, failed, reload };
};
