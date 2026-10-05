import { computed, onMounted, ref, watch, type ComputedRef } from "vue";
import { storeToRefs } from "pinia";
import { fetchCourierEarnings } from "~/services/courierEarningsService";
import { useWalletStore } from "~/stores/wallet";
import { toLocalDayKey } from "~/utils/datetime";
import type { OrderEarnings } from "~/types/earnings";

// "Danas" na ekranu Dostave (čekanje i "Dostavljeno"): koliko je dostava, koliko
// je zarađeno i koliko gotovine kurir nosi naspram limita. Dva jeftina poziva
// (earnings od danas, wallet-balance) pri otvaranju ekrana i poslije svake
// dostave - NIKAD u petlji. Greška ne smije da sruši ekran: prikaz tad pokazuje
// crticu umjesto broja.
//
// Saldo gotovine je u zajedničkom sloju (stores/wallet.ts), isti koji koristi Novčanik i
// tačka na stavci "Novčanik" u navigaciji: pri otvaranju ekrana se ne traži ponovo ako je
// svjež (minut), a poslije završene dostave uvijek, jer se gotovina promijenila.
export const useCourierToday = (courierId: ComputedRef<number>) => {
  const wallet = useWalletStore();
  const { balance } = storeToRefs(wallet);

  const loading = ref(false);
  const failed = ref(false);
  const deliveries = ref<number | null>(null);
  const wage = ref<number | null>(null);
  const orders = ref<OrderEarnings[]>([]);

  const cashOwed = computed(() => balance.value?.cash_owed_to_company ?? null);
  const cashLimit = computed(() => balance.value?.cash_limit_amount ?? null);

  // `force`: poslije dostave. Pri otvaranju ekrana (force = false) svjež saldo ostaje.
  const refresh = async (force = true) => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0) return;
    loading.value = true;
    const today = toLocalDayKey(new Date());

    wallet.start(courierId.value);
    const [earningsResult, balanceResult] = await Promise.allSettled([
      fetchCourierEarnings(courierId.value, today),
      force ? wallet.refreshBalance() : wallet.touchBalance(),
    ]);

    if (earningsResult.status === "fulfilled") {
      const day = earningsResult.value.daily.find((entry) => entry.date.slice(0, 10) === today);
      deliveries.value = day?.deliveries ?? 0;
      wage.value = day?.earnings ?? 0;
      orders.value = earningsResult.value.orders;
    }

    const balanceOk = balanceResult.status === "fulfilled" && balanceResult.value;
    failed.value = earningsResult.status === "rejected" && !balanceOk;
    loading.value = false;
  };

  onMounted(() => void refresh(false));
  watch(courierId, () => void refresh(false));

  return {
    loading,
    failed,
    deliveries,
    wage,
    orders,
    balance,
    cashOwed,
    cashLimit,
    refresh: () => refresh(true),
  };
};
