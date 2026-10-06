import { computed, ref, shallowRef, watch } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { fetchPendingCashHandovers } from "~/services/dispatcherWalletService";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { PendingCashHandover } from "~/types/cash-handover";

// Predaje gotovine koje čekaju potvrdu (cash-handovers/pending): jedan izvor za značku u meniju, karticu
// na početnoj i za red predaja na stranici Finansije. Dok je dispečerska ljuska vidljiva provjerava se
// svake minute; stranica Finansije ubrzava na 30 s dok je otvorena (setFast), pa se isti podatak ne
// čita dvaput. Dok server ne javi događaj za dispečera (B5 u dokumentu od 06.10.), ovo je cijena značke.
const SLOW_MS = 60_000;
const FAST_MS = 30_000;
const TICK_MS = 5_000;

export type PendingState = "idle" | "loading" | "ok" | "error";

export const useCashDeskStore = defineStore("cashDesk", () => {
  const companies = useDeliveryCompaniesStore();
  const { selectedCompanyId } = storeToRefs(companies);

  // null = broj se ne zna (nije stigao nijedan odgovor): značka se tada ne crta, a stranica piše "Nije učitano".
  const pending = shallowRef<PendingCashHandover[] | null>(null);
  const state = ref<PendingState>("idle");
  const failed = ref(false);
  const error = ref("");
  const loadedAt = ref<number | null>(null);
  const active = ref(false);
  const fast = ref(false);

  // Svaka promjena firme povećava broj; odgovor za firmu koja više nije izabrana se odbacuje.
  let epoch = 0;
  let inflight: Promise<void> | null = null;
  let lastTry = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const count = computed(() => (pending.value ? pending.value.length : 0));
  // Značka se pokazuje samo kad se zna da ima predaja (ili je zadnje poznato stanje takvo).
  const badge = computed(() => (pending.value && pending.value.length > 0 ? pending.value.length : 0));

  const load = (): Promise<void> => {
    const id = selectedCompanyId.value;
    if (!id) return Promise.resolve();
    if (inflight) return inflight;
    const mine = epoch;
    lastTry = Date.now();
    if (pending.value === null) state.value = "loading";
    inflight = (async () => {
      try {
        const data = await fetchPendingCashHandovers(id);
        if (mine !== epoch) return;
        pending.value = data;
        state.value = "ok";
        failed.value = false;
        error.value = "";
        loadedAt.value = Date.now();
      } catch (e) {
        if (mine !== epoch) return;
        failed.value = true;
        error.value = toFriendlyErrorMessage(e, "Server ne odgovara.");
        if (pending.value === null) state.value = "error";
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };

  // Potvrđena predaja nestaje iz reda odmah; pravo stanje stiže sa sljedećim čitanjem.
  const removePending = (id: number) => {
    if (pending.value) pending.value = pending.value.filter((p) => p.id !== id);
  };

  const clear = () => {
    epoch += 1;
    inflight = null;
    pending.value = null;
    state.value = "idle";
    failed.value = false;
    error.value = "";
    loadedAt.value = null;
  };

  const cadence = () => (fast.value ? FAST_MS : SLOW_MS);

  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (!active.value || !selectedCompanyId.value) return;
    if (Date.now() - lastTry >= cadence()) void load();
  };

  const onVisible = () => {
    if (typeof document !== "undefined" && !document.hidden) tick();
  };

  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  };

  const startTimer = () => {
    if (timer || typeof document === "undefined") return;
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  };

  // Dispečerska ljuska: uključuje i isključuje provjeru (odjava, promjena prikaza).
  const start = () => {
    active.value = true;
  };
  const stop = () => {
    active.value = false;
    fast.value = false;
    clear();
  };
  // Stranica Finansije je otvorena: provjera na 30 s.
  const setFast = (value: boolean) => {
    fast.value = value;
    if (value) tick();
  };

  watch(
    [active, selectedCompanyId],
    async ([isActive, id], old) => {
      if (!isActive) {
        stopTimer();
        return;
      }
      startTimer();
      const changed = old !== undefined && old[1] !== id;
      if (changed) clear();
      if (id) void load();
      else await companies.ensureLoaded();
    },
    { immediate: true }
  );

  return { pending, state, failed, error, loadedAt, count, badge, start, stop, setFast, load, removePending };
});
