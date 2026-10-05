import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "nuxt/app";
import type { useCourierDeliveries } from "~/composables/useCourierDeliveries";
import type { useWalletSource } from "~/composables/useWalletSource";
import { useAlertStore } from "~/stores/alert";
import { summarizeCashLimit } from "~/utils/cashLimit";
import { clockOf } from "~/utils/historyGroups";
import {
  WALLET_PERIODS,
  accountFromQuery,
  accountQuery,
  applyFilter,
  filterFromQuery,
  filterQuery,
  groupWalletByDay,
  isMonthlyCourier,
  walletPeriodFromQuery,
  periodQuery,
  reportableCash,
  sheetFromQuery,
  sheetQuery,
  summarizeCash,
  summarizeWage,
  takeItems,
  walletItems,
  widerWalletPeriod,
} from "~/utils/walletLedger";
import type {
  WalletAccount,
  WalletFilter,
  WalletPeriod,
  WalletSheetRef,
} from "~/types/wallet-ledger";

// Prvi ekran: dovoljno redova za najmanje dva dana, ostalo otvara "Prikaži starije"
// (30 dana može imati stotine redova, svaki je nekoliko desetina DOM čvorova).
const FIRST_ITEMS = 24;
const MORE_ITEMS = 30;
// "Sada" se osvježava povremeno (i pri povratku u aplikaciju) da "Danas" ne ostane
// zalijepljen za jučerašnji dan ako ekran ostane otvoren preko ponoći.
const NOW_TICK_MS = 5 * 60_000;

const queryString = (raw: unknown): string | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value ? value : null;
};

// Pogled ekrana Novčanik nad zajedničkim podacima (store za novčanik + zajednički sloj
// dostava): račun, period, filter i otvoren list žive u adresi (?tab ?p ?f ?o) - osvježavanje
// i veza ih čuvaju, a dugme Nazad zatvara list. Filteri se upisuju sa replace (istorija
// pregledača ostaje čista), otvaranje lista sa push (kao u Istoriji i Porukama).
export const useWalletView = (
  wallet: ReturnType<typeof useWalletSource>,
  source: ReturnType<typeof useCourierDeliveries>
) => {
  const route = useRoute();
  const router = useRouter();
  const alerts = useAlertStore();

  const now = ref(Date.now());

  // --- Adresa -----------------------------------------------------------------

  const account = computed<WalletAccount>(() => accountFromQuery(queryString(route.query.tab)));
  const period = computed<WalletPeriod>(() => walletPeriodFromQuery(queryString(route.query.p)));
  const filter = computed<WalletFilter | null>(() =>
    filterFromQuery(queryString(route.query.f), account.value)
  );
  const sheet = computed<WalletSheetRef | null>(() => sheetFromQuery(queryString(route.query.o)));

  const setQuery = (patch: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
    const next: Record<string, unknown> = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") delete next[key];
      else next[key] = value;
    }
    void router[mode]({ query: next as Record<string, string | string[]> });
  };

  // --- Stanje ekrana ----------------------------------------------------------

  // Saldo je glavno: bez njega nema ekrana. Sve ostalo (predaje, isplate, dostave) stiže
  // nezavisno i pada nezavisno.
  const state = computed<"loading" | "error" | "ready">(() => {
    if (wallet.balanceLoaded.value) return "ready";
    return wallet.balanceError.value ? "error" : "loading";
  });

  const earningsSettled = computed(
    () => source.earningsLoaded.value || Boolean(source.earningsError.value)
  );
  const handoversSettled = computed(
    () => wallet.handoversLoaded.value || Boolean(wallet.handoversError.value)
  );
  const payoutsSettled = computed(
    () => wallet.payoutsLoaded.value || Boolean(wallet.payoutsError.value)
  );
  const historySettled = computed(
    () => source.historyLoaded.value || Boolean(source.historyError.value)
  );

  // --- Račun gotovine ---------------------------------------------------------

  const cash = computed(() => wallet.balance.value?.cash_owed_to_company ?? 0);
  const wageBalance = computed(() => wallet.balance.value?.wage_owed_to_courier ?? 0);
  const limit = computed(() => wallet.balance.value?.cash_limit_amount ?? null);
  const enforcement = computed(() => wallet.balance.value?.cash_limit_enforcement ?? "NOTIFY_ONLY");
  const meter = computed(() => (limit.value == null ? null : summarizeCashLimit(cash.value, limit.value)));
  // Stanje limita za oznaku na pločici: negativan saldo i nula ne pune limit.
  const limitState = computed<"ok" | "near" | "over">(() =>
    cash.value > 0 && meter.value ? meter.value.state : "ok"
  );

  const pending = computed(() => wallet.handovers.value.find((h) => h.pending) ?? null);
  // Dok se ne zna da li predaja čeka, dugme se ne nudi (ne smije da trepne pa nestane).
  const pendingKnown = computed(() => handoversSettled.value);
  const cashToReport = computed(() => reportableCash(cash.value));
  const canReport = computed(
    () => state.value === "ready" && cashToReport.value > 0 && pending.value == null
  );

  const monthly = computed(() => isMonthlyCourier(source.deliveries.value));

  // --- Lista --------------------------------------------------------------------

  const all = computed(() =>
    walletItems(
      account.value,
      {
        deliveries: source.deliveries.value,
        handovers: wallet.handovers.value,
        payouts: wallet.payouts.value,
      },
      period.value,
      now.value
    )
  );
  const items = computed(() => applyFilter(all.value, filter.value));
  const cashSummary = computed(() => summarizeCash(all.value));
  const wageSummary = computed(() => summarizeWage(all.value));

  const shownLimit = ref(FIRST_ITEMS);
  watch([account, period, filter], () => {
    shownLimit.value = FIRST_ITEMS;
  });
  const showMore = () => {
    shownLimit.value += MORE_ITEMS;
  };
  const taken = computed(() => takeItems(items.value, shownLimit.value));
  const groups = computed(() => groupWalletByDay(taken.value.shown, account.value, now.value));
  const restItems = computed(() => taken.value.rest);

  // Dostave i ono što knjiži izabrani račun: dva izvora, svaki može posebno da stigne ili padne.
  const settleSettled = computed(() =>
    account.value === "cash" ? handoversSettled.value : payoutsSettled.value
  );
  const settleError = computed(() =>
    account.value === "cash" ? wallet.handoversError.value : wallet.payoutsError.value
  );
  const deliveriesFailed = computed(() => !source.earningsLoaded.value && Boolean(source.earningsError.value));
  const settleFailed = computed(() => !settleSettled.value ? false : Boolean(settleError.value));
  const listLoading = computed(() => !earningsSettled.value || !settleSettled.value);

  // Šta je u području liste: skeleton, prvi dolazak (ničega nema), prazan period / filter, ili redovi.
  // Dok bilo koji od dva izvora liste još stiže, lista je skeleton: djelimična lista (npr. samo
  // predaje) bi se pomjerala kad stigne drugi dio i umetne dane iznad.
  const listState = computed<"loading" | "new" | "empty" | "rows">(() => {
    if (listLoading.value) return "loading";
    if (items.value.length > 0) return "rows";
    if (
      !deliveriesFailed.value &&
      !settleFailed.value &&
      source.deliveries.value.length === 0 &&
      wallet.handovers.value.length === 0 &&
      wallet.payouts.value.length === 0 &&
      cash.value === 0 &&
      wageBalance.value === 0
    ) {
      return "new";
    }
    return "empty";
  });

  // Prvi širi period u kome zaista ima stavki (za "Prikaži sedmicu" kad je izabrani prazan).
  const widerTarget = computed<WalletPeriod | null>(() => {
    let next = widerWalletPeriod(period.value);
    while (next) {
      const wider = walletItems(
        account.value,
        {
          deliveries: source.deliveries.value,
          handovers: wallet.handovers.value,
          payouts: wallet.payouts.value,
        },
        next,
        now.value
      );
      if (wider.length > 0) return next;
      next = widerWalletPeriod(next);
    }
    return null;
  });

  // Dostava bez ikakvog obračuna dok zarada još stiže: iznos je "učitava se", a ne "nema".
  const moneyPending = (delivery: { earnings: unknown; wage: number | null }) =>
    source.earningsLoading.value && delivery.earnings == null && delivery.wage == null;

  // --- Zaglavlje --------------------------------------------------------------------

  const stale = computed(
    () => wallet.balanceStale.value || wallet.handoversStale.value || wallet.payoutsStale.value
  );
  const manualRefresh = ref(false);

  const subtitle = computed(() => {
    if (manualRefresh.value) return "Osvježavam…";
    if (state.value === "loading") return "Učitavam…";
    if (state.value === "error") return "Nema veze";
    const at = wallet.balanceAt.value ? clockOf(wallet.balanceAt.value) : "";
    if (stale.value) return at ? `Nema veze · zadnje ${at}` : "Nema veze";
    return at ? `Ažurirano ${at}` : "";
  });

  // --- Akcije ------------------------------------------------------------------------

  const setAccount = (next: WalletAccount) => {
    if (next === account.value) return;
    setQuery({ tab: accountQuery(next), f: null });
  };
  const setPeriod = (next: WalletPeriod) => setQuery({ p: periodQuery(next) });
  const toggleFilter = (next: WalletFilter) =>
    setQuery({ f: filter.value === next ? null : filterQuery(next, account.value) });
  const clearFilter = () => setQuery({ f: null });
  const widen = () => {
    if (widerTarget.value) setPeriod(widerTarget.value);
  };

  // --- Listovi (?o=) -----------------------------------------------------------------

  const deliverySheet = computed(() => {
    const current = sheet.value;
    return current?.kind === "delivery" ? (source.byId.value.get(current.id) ?? null) : null;
  });
  const handoverSheet = computed(() => {
    const current = sheet.value;
    return current?.kind === "handover"
      ? (wallet.handovers.value.find((h) => h.id === current.id) ?? null)
      : null;
  });
  const payoutSheet = computed(() => {
    const current = sheet.value;
    return current?.kind === "payout"
      ? (wallet.payouts.value.find((p) => p.id === current.id) ?? null)
      : null;
  });

  const openSheet = (next: WalletSheetRef) => setQuery({ o: sheetQuery(next) }, "push");

  // Ako je prethodni zapis u istoriji ova ista stranica (list je otvoren iz nje), vraćamo se
  // unazad - tako Nazad na telefonu i X rade isto, a istorija ostaje čista. Kad je list otvoren
  // direktno (veza), samo se skida ?o= iz adrese.
  const closeSheet = () => {
    const back = (window.history.state as { back?: string | null } | null)?.back;
    if (back) {
      const [path = "", search = ""] = back.split("?");
      if (path === route.path && !new URLSearchParams(search).has("o")) {
        router.back();
        return;
      }
    }
    setQuery({ o: null });
  };

  // Prijava predaje: list se otvara samo dok ima šta da se preda i dok druga prijava ne čeka
  // (server je ionako odbija). Jednom otvoren ostaje otvoren i kad prijava uspije, da kurir
  // vidi "Prijavljeno" - a tada već postoji predaja na čekanju.
  const reportOpen = ref(false);
  const openReport = () => {
    if (!canReport.value) return;
    reportOpen.value = true;
    openSheet({ kind: "report" });
  };
  watch(
    [() => sheet.value?.kind, state, pendingKnown, canReport],
    ([kind, current]) => {
      if (kind !== "report") {
        reportOpen.value = false;
        return;
      }
      // Dok se ne zna ni stanje ni da li neka predaja čeka, ne odlučuje se (saldo stigne prvi, a
      // predaja na čekanju bi onda otvorila list koji odmah treba zatvoriti).
      if (reportOpen.value || current === "loading" || (current === "ready" && !pendingKnown.value)) return;
      if (canReport.value) reportOpen.value = true;
      else setQuery({ o: null });
    },
    { immediate: true, flush: "post" }
  );

  // Adresa upućuje na stavku kojih nema među učitanim podacima: skida se tiho, ali tek kad su
  // izvori stigli (stavka može da bude samo u jednom od njih).
  watch(
    [
      sheet,
      state,
      earningsSettled,
      historySettled,
      handoversSettled,
      payoutsSettled,
      () => source.earningsLoading.value,
      () => source.historyLoading.value,
      () => source.deliveries.value,
      () => wallet.handovers.value,
      () => wallet.payouts.value,
    ],
    () => {
      const current = sheet.value;
      if (!current || state.value === "loading") return;
      let missing = false;
      if (current.kind === "delivery") {
        missing =
          earningsSettled.value &&
          historySettled.value &&
          !source.earningsLoading.value &&
          !source.historyLoading.value &&
          !deliverySheet.value;
      } else if (current.kind === "handover") {
        missing = handoversSettled.value && !handoverSheet.value;
      } else if (current.kind === "payout") {
        missing = payoutsSettled.value && !payoutSheet.value;
      }
      if (missing) setQuery({ o: null });
    },
    { flush: "post" }
  );

  // --- Osvježavanje --------------------------------------------------------------------

  const refresh = async () => {
    if (manualRefresh.value) return;
    manualRefresh.value = true;
    now.value = Date.now();
    try {
      await Promise.all([wallet.refreshAll(), source.refreshAll()]);
      if (stale.value) {
        alerts.warning("Još nema veze sa serverom. Prikazano je zadnje poznato stanje.", 4000);
      }
    } finally {
      manualRefresh.value = false;
    }
  };

  // "Pokušaj ponovo": ponovi ono što je palo; ako ništa nije palo, osvježi sve.
  const retry = async () => {
    now.value = Date.now();
    const jobs: Promise<unknown>[] = [wallet.retryFailed()];
    if (source.earningsError.value) jobs.push(source.retryEarnings());
    if (source.historyError.value) jobs.push(source.retryHistory());
    await Promise.all(jobs);
  };

  // "Provjeri sada" na kartici predaje na čekanju.
  const checking = ref(false);
  const checkNow = async () => {
    if (checking.value) return;
    checking.value = true;
    try {
      await wallet.refreshPending();
      if (wallet.hasPending.value) alerts.info("Još nije potvrđeno.", 3000);
    } finally {
      checking.value = false;
    }
  };

  let tick: ReturnType<typeof setInterval> | null = null;
  const onVisible = () => {
    if (!document.hidden) now.value = Date.now();
  };
  onMounted(() => {
    now.value = Date.now();
    tick = setInterval(() => {
      now.value = Date.now();
    }, NOW_TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  });
  onBeforeUnmount(() => {
    if (tick) clearInterval(tick);
    document.removeEventListener("visibilitychange", onVisible);
  });

  return {
    now,
    account,
    period,
    filter,
    sheet,
    state,
    subtitle,
    stale,
    refreshing: manualRefresh,
    // gotovina
    cash,
    wageBalance,
    limit,
    enforcement,
    meter,
    limitState,
    pending,
    pendingKnown,
    cashToReport,
    canReport,
    monthly,
    // lista
    periods: WALLET_PERIODS,
    items,
    groups,
    restItems,
    cashSummary,
    wageSummary,
    listState,
    listLoading,
    earningsSettled,
    settleSettled,
    deliveriesFailed,
    settleFailed,
    widerTarget,
    moneyPending,
    showMore,
    // akcije
    setAccount,
    setPeriod,
    toggleFilter,
    clearFilter,
    widen,
    // listovi
    deliverySheet,
    handoverSheet,
    payoutSheet,
    reportOpen,
    openSheet,
    openReport,
    closeSheet,
    // osvježavanje
    refresh,
    retry,
    checking,
    checkNow,
  };
};
