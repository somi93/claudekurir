import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref, type ShallowRef } from "vue";
import { storeToRefs } from "pinia";
import { useFinanceSettings } from "~/composables/useFinanceSettings";
import type { ActionResult } from "~/composables/useCourierRoster";
import { fetchCompanyCouriers } from "~/services/dispatcherCouriersService";
import {
  confirmCashHandover,
  fetchCouriersBalance,
  payoutCourierWage,
  recordCashReceipt,
} from "~/services/dispatcherWalletService";
import { useAlertStore } from "~/stores/alert";
import { useCashDeskStore } from "~/stores/cashDesk";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import { buildBook, money, type BatchResult, type CashRow } from "~/utils/cashDesk";
import { resolveCurrency } from "~/utils/currency";
import { getErrorStatus, getFieldErrors, getServerMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { CompanyCourier } from "~/types/company-courier";
import type { CourierBalance } from "~/types/courier-balance";

// Balans i spisak kurira se osvježavaju svake minute dok je kartica vidljiva (predaje svakih 30 s, vidi
// stores/cashDesk.ts). Povratak u karticu: ako je stanje starije od minute, čita se sve iznova.
const SLOW_MS = 60_000;
const TICK_MS = 5_000;

type Source<T> = {
  data: ShallowRef<T | null>;
  failed: Ref<boolean>;
  error: Ref<string>;
  loadedAt: Ref<number | null>;
  busy: Ref<boolean>;
};

const source = <T>(): Source<T> => ({
  data: shallowRef<T | null>(null),
  failed: ref(false),
  error: ref(""),
  loadedAt: ref<number | null>(null),
  busy: ref(false),
});

const failure = (error: unknown, fallback: string): ActionResult => ({
  ok: false,
  message: toFriendlyErrorMessage(error, fallback),
  fields: getFieldErrors(error),
});

// cash-receipt i payout vraćaju 404 sa čitljivom porukom kad kurir nikad nije bio vezan za firmu.
const cashFailure = (error: unknown, fallback: string): ActionResult =>
  getErrorStatus(error) === 404
    ? { ok: false, message: getServerMessage(error) ?? fallback, fields: {} }
    : failure(error, fallback);

// Stranica Finansije, tab Stanje: izvori (couriers-balance, couriers-status, finance-settings, a predaje
// na čekanju dolaze iz stores/cashDesk.ts), knjiga kurira spojena po courier_id, osvježavanje i radnje
// (potvrda, uplata, isplata). Izvor koji ne radi ne ruši ostale; dok se ne zna, ništa se ne tvrdi.
export const useCashDesk = () => {
  const companies = useDeliveryCompaniesStore();
  const { selectedCompanyId, errorMessage: companiesError } = storeToRefs(companies);
  const companyId = computed(() => selectedCompanyId.value);
  const desk = useCashDeskStore();
  const alerts = useAlertStore();

  const { settings, loadingSettings, loadFailed: settingsFailed, reload: reloadSettings } = useFinanceSettings(companyId);
  const currency = computed(() => resolveCurrency(settings.value?.currency));
  const cashLimit = computed(() => {
    const v = settings.value?.cash_limit_amount;
    return v == null ? null : Number(v);
  });
  const companyName = computed(() => companies.selectedCompany?.name ?? "");

  const ensured = ref(false);
  const balances = source<CourierBalance[]>();
  const status = source<CompanyCourier[]>();
  const now = ref(Date.now());

  // Svaka promjena firme povećava broj; odgovor koji stigne za staru firmu se odbacuje.
  let epoch = 0;

  const load = async <T>(src: Source<T>, fetcher: (id: number) => Promise<T>) => {
    const id = companyId.value;
    if (!id || src.busy.value) return;
    const mine = epoch;
    src.busy.value = true;
    try {
      const data = await fetcher(id);
      if (mine !== epoch) return;
      src.data.value = data;
      src.failed.value = false;
      src.error.value = "";
      src.loadedAt.value = Date.now();
    } catch (error) {
      if (mine !== epoch) return;
      src.failed.value = true;
      src.error.value = toFriendlyErrorMessage(error, "Server ne odgovara.");
    } finally {
      if (mine === epoch) src.busy.value = false;
    }
  };

  const loadBalances = () => load(balances, fetchCouriersBalance);
  const loadStatus = () => load(status, fetchCompanyCouriers);

  const refreshAll = async () => {
    if (!companyId.value) return;
    await Promise.all([loadBalances(), loadStatus(), desk.load(), reloadSettings()]);
  };

  const clearAll = () => {
    epoch += 1;
    for (const src of [balances, status] as Source<unknown>[]) {
      src.data.value = null;
      src.failed.value = false;
      src.error.value = "";
      src.loadedAt.value = null;
      src.busy.value = false;
    }
  };

  // Promjena firme: podaci stare firme nestaju odmah (inače bi klik na kurira poslao zahtjev sa drugom firmom).
  watch(companyId, (id, old) => {
    if (!ensured.value || id === old) return;
    clearAll();
    if (id) void Promise.all([loadBalances(), loadStatus()]);
  });

  // --- Stanje za ekran ------------------------------------------------------------------------

  const state = computed<"loading" | "nofirm" | "error" | "ready">(() => {
    if (!ensured.value) return "loading";
    if (!companyId.value) return companiesError.value ? "error" : "nofirm";
    if (balances.data.value) return "ready";
    return balances.failed.value ? "error" : "loading";
  });
  const stale = computed(() => Boolean(balances.data.value) && balances.failed.value);

  const book = computed<CashRow[]>(() =>
    buildBook({
      balances: balances.data.value ?? [],
      couriers: status.data.value ?? [],
      pending: desk.pending ?? [],
      limit: cashLimit.value,
      currency: currency.value,
      couriersKnown: status.data.value !== null,
    })
  );
  const byId = computed(() => new Map(book.value.map((r) => [r.id, r])));
  const rowOf = (id: number | null): CashRow | null => (id == null ? null : (byId.value.get(id) ?? null));
  const nameOf = (id: number): string => byId.value.get(id)?.name ?? `Kurir #${id}`;

  // "osvježeno pre 12s": zadnje uspješno čitanje novca (balans ili predaje).
  const updatedAt = computed<number | null>(() => {
    const a = balances.loadedAt.value;
    const b = desk.loadedAt;
    if (a == null) return b;
    if (b == null) return a;
    return Math.max(a, b);
  });

  const refreshing = computed(() => balances.busy.value || status.busy.value || desk.state === "loading");

  // --- Nova predaja dok je stranica otvorena ---------------------------------------------------

  const flashPending = ref<Set<number>>(new Set());
  const flashCouriers = ref<Set<number>>(new Set());
  const pulse = (target: Ref<Set<number>>, ids: number[]) => {
    target.value = new Set([...target.value, ...ids]);
    setTimeout(() => {
      target.value = new Set([...target.value].filter((id) => !ids.includes(id)));
    }, 2200);
  };

  let known: Set<number> | null = null;
  watch(
    () => desk.pending,
    (list) => {
      if (!list) {
        known = null;
        return;
      }
      if (known) {
        const seen = known;
        const fresh = list.filter((p) => !seen.has(p.id));
        if (fresh.length) {
          pulse(flashPending, fresh.map((p) => p.id));
          const first = fresh[0];
          if (first) {
            const amount = Number(first.reported_amount);
            alerts.info(
              `Nova predaja: ${nameOf(first.courier_id)} prijavio ${money(Number.isFinite(amount) ? amount : 0, currency.value)}`,
              5000
            );
          }
        }
      }
      known = new Set(list.map((p) => p.id));
    },
    { immediate: true }
  );

  // --- Tajmer i vidljivost ----------------------------------------------------------------------

  let timer: ReturnType<typeof setInterval> | null = null;
  const stamps = { slow: 0 };

  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    now.value = Date.now();
    if (!ensured.value || !companyId.value || !balances.data.value) return;
    if (now.value - stamps.slow >= SLOW_MS) {
      stamps.slow = now.value;
      void loadBalances();
      void loadStatus();
    }
  };

  const onVisible = () => {
    if (document.hidden) return;
    now.value = Date.now();
    if (!ensured.value || !companyId.value) return;
    const at = updatedAt.value;
    if (at != null && now.value - at >= SLOW_MS) void refreshAll();
    else tick();
  };

  onMounted(async () => {
    desk.start();
    desk.setFast(true);
    await companies.ensureLoaded();
    ensured.value = true;
    stamps.slow = Date.now();
    if (companyId.value) void Promise.all([loadBalances(), loadStatus()]);
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  });

  onBeforeUnmount(() => {
    desk.setFast(false);
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  });

  // --- Radnje -----------------------------------------------------------------------------------

  const saving = ref(false);
  const run = async (fn: () => Promise<ActionResult>): Promise<ActionResult> => {
    if (saving.value) return { ok: false, message: "", fields: {} };
    saving.value = true;
    try {
      return await fn();
    } finally {
      saving.value = false;
    }
  };

  // Poslije radnje server ne vraća novi saldo, pa se balans i predaje čitaju iznova; red kurira bljesne.
  const afterAction = async (courierId: number | null) => {
    await Promise.all([loadBalances(), desk.load()]);
    if (courierId != null) pulse(flashCouriers, [courierId]);
  };

  const confirm = (handoverId: number, courierId: number, amount: number, note: string): Promise<ActionResult> =>
    run(async () => {
      try {
        await confirmCashHandover(handoverId, amount, note.trim() || undefined);
      } catch (error) {
        return failure(error, "Ne mogu da potvrdim predaju. Pokušaj ponovo; unos je ostao u listu.");
      }
      desk.removePending(handoverId);
      void afterAction(courierId);
      return { ok: true };
    });

  const receipt = (courierId: number, amount: number, note: string): Promise<ActionResult> =>
    run(async () => {
      const id = companyId.value;
      if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      try {
        const res = await recordCashReceipt(courierId, {
          delivery_company_id: id,
          amount,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        void afterAction(courierId);
        return { ok: true, warning: res.warning };
      } catch (error) {
        return cashFailure(error, "Ne mogu da evidentiram uplatu. Pokušaj ponovo.");
      }
    });

  const payoutBody = (courierId: number, amount: number, method: string, key: string, note: string) => {
    const id = companyId.value as number;
    return [
      courierId,
      {
        delivery_company_id: id,
        amount,
        method,
        idempotency_key: key,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
    ] as const;
  };

  const payout = (courierId: number, amount: number, method: string, key: string, note = ""): Promise<ActionResult> =>
    run(async () => {
      if (!companyId.value) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      try {
        const res = await payoutCourierWage(...payoutBody(courierId, amount, method, key, note));
        void afterAction(courierId);
        return { ok: true, warning: res.warning };
      } catch (error) {
        return cashFailure(error, "Ne mogu da isplatim zaradu. Pokušaj ponovo.");
      }
    });

  // Isplata svima: jedan poziv po kuriru (ne dijeli zastavicu snimanja, pa ih ide do tri istovremeno).
  // Isti ključ na ponovnom pokušaju znači da server vraća istu transakciju, ne drugu isplatu.
  const payoutOne = async (courierId: number, amount: number, method: string, key: string): Promise<BatchResult> => {
    if (!companyId.value) return { ok: false, message: "Firma nije izabrana." };
    try {
      const res = await payoutCourierWage(...payoutBody(courierId, amount, method, key, ""));
      return { ok: true, warning: res.warning };
    } catch (error) {
      const r = cashFailure(error, "Ne mogu da isplatim zaradu.");
      return r.ok ? { ok: true } : { ok: false, message: Object.values(r.fields)[0] ?? r.message };
    }
  };

  const afterBatch = () => afterAction(null);

  return {
    ensured,
    companyId,
    companyName,
    currency,
    cashLimit,
    settings,
    loadingSettings,
    settingsFailed,
    state,
    stale,
    balancesError: balances.error,
    balancesFailed: balances.failed,
    statusFailed: status.failed,
    statusKnown: computed(() => status.data.value !== null),
    pending: computed(() => desk.pending),
    pendingState: computed(() => desk.state),
    pendingFailed: computed(() => desk.failed),
    pendingError: computed(() => desk.error),
    book,
    rowOf,
    nameOf,
    now,
    updatedAt,
    refreshing,
    flashPending,
    flashCouriers,
    saving,
    refreshAll,
    retry: {
      balances: loadBalances,
      status: loadStatus,
      pending: () => desk.load(),
      settings: reloadSettings,
    },
    confirm,
    receipt,
    payout,
    payoutOne,
    afterBatch,
  };
};
