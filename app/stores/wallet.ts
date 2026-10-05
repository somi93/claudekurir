import { computed, ref, shallowRef, type Ref, type ShallowRef } from "vue";
import { defineStore } from "pinia";
import {
  fetchCourierCashHandovers,
  fetchCourierWalletBalance,
  reportCashHandover,
} from "~/services/courierWalletService";
import { fetchCourierPayouts } from "~/services/courierPayoutsService";
import { getServerMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { toWalletHandover, toWalletHandovers, toWalletPayout } from "~/utils/walletLedger";
import type { CourierWalletBalance } from "~/types/wallet";
import type { WalletHandover, WalletPayout } from "~/types/wallet-ledger";

// Novčanik kurira - JEDAN izvor za ekran Novčanik, "Danas" na Dostavama i tačku u
// navigaciji. Tri izvora se učitavaju NEZAVISNO (saldo, predaje gotovine, isplate):
//
//  - svaki ima svoje stanje: "učitano", "greška" (samo dok nema ičega za prikaz) i
//    "zastarjelo" (osvježavanje nije uspjelo, a prikazuje se ranije stanje). Pad jednog
//    izvora ne ruši ostale - saldo ostaje na ekranu i kad isplate ne stignu.
//  - osvježavanje ne vraća ekran na skeleton: "učitava se" znači samo dok nema ničega.
//  - podaci mlađi od FRESH_MS se ne traže ponovo pri otvaranju ekrana, stariji se
//    osvježavaju u pozadini.

const FRESH_MS = 60_000;

type Source<T> = {
  data: ShallowRef<T>;
  loaded: Ref<boolean>;
  // Zahtjev je u letu (i kad je već nešto učitano - za znak "osvježavam").
  loading: Ref<boolean>;
  // Poruka greške, samo dok nema ničega za prikaz (prvo učitavanje nije uspjelo).
  error: Ref<string>;
  // Osvježavanje nije uspjelo, a na ekranu je ranije stanje.
  stale: Ref<boolean>;
  // Kad je zadnji put uspjelo (ms); 0 = nikad.
  at: Ref<number>;
  load: (fresh?: boolean) => Promise<boolean>;
  reset: () => void;
};

export const useWalletStore = defineStore("wallet", () => {
  const courierId = ref<number | null>(null);

  // `onData` vidi staro i novo stanje (npr. da primijeti da je predaja potvrđena).
  const makeSource = <T>(
    initial: T,
    fetcher: (id: number) => Promise<T>,
    failText: string,
    onData?: (next: T, previous: T) => void
  ): Source<T> => {
    const data = shallowRef(initial) as ShallowRef<T>;
    const loaded = ref(false);
    const inFlight = ref(0);
    const loading = computed(() => inFlight.value > 0);
    const error = ref("");
    const stale = ref(false);
    const at = ref(0);
    let run: { id: number; promise: Promise<boolean> } | null = null;

    const start = (id: number): Promise<boolean> => {
      if (!loaded.value) error.value = "";
      inFlight.value += 1;
      const promise: Promise<boolean> = fetcher(id)
        .then(
          (value) => {
            if (courierId.value !== id) return false;
            const previous = data.value;
            data.value = value;
            loaded.value = true;
            error.value = "";
            stale.value = false;
            at.value = Date.now();
            onData?.(value, previous);
            return true;
          },
          (cause) => {
            if (courierId.value !== id) return false;
            if (loaded.value) stale.value = true;
            else error.value = toFriendlyErrorMessage(cause, failText);
            return false;
          }
        )
        .finally(() => {
          inFlight.value = Math.max(0, inFlight.value - 1);
          if (run?.promise === promise) run = null;
        });
      run = { id, promise };
      return promise;
    };

    // `fresh`: zahtjev u letu je poslat PRIJE neke promjene (npr. prijave predaje), pa njegov
    // odgovor ne smije biti zadnja riječ - sačekaj ga i pošalji novi.
    const load = (fresh = false): Promise<boolean> => {
      const id = courierId.value;
      if (!id) return Promise.resolve(false);
      if (run?.id === id) {
        if (!fresh) return run.promise;
        return run.promise.then(() => start(id));
      }
      return start(id);
    };

    const reset = () => {
      data.value = initial;
      loaded.value = false;
      inFlight.value = 0;
      error.value = "";
      stale.value = false;
      at.value = 0;
      run = null;
    };

    return { data, loaded, loading, error, stale, at, load, reset };
  };

  // Predaja koja je čekala, a sad je potvrđena: kartica "Predaja potvrđena" dok je kurir
  // ne odbaci. Samo ako je potvrda primijećena dok je ekran otvoren.
  const justConfirmed = ref<WalletHandover | null>(null);
  const noticeConfirmation = (next: WalletHandover[], previous: WalletHandover[]) => {
    const waiting = previous.filter((h) => h.pending);
    if (waiting.length === 0) return;
    for (const was of waiting) {
      const now = next.find((h) => h.id === was.id);
      if (now && !now.pending) justConfirmed.value = now;
    }
  };

  const balanceSource = makeSource<CourierWalletBalance | null>(
    null,
    (id) => fetchCourierWalletBalance(id),
    "Ne mogu da učitam stanje novčanika."
  );
  const handoversSource = makeSource<WalletHandover[]>(
    [],
    async (id) => toWalletHandovers(await fetchCourierCashHandovers(id)),
    "Ne mogu da učitam predaje gotovine.",
    noticeConfirmation
  );
  const payoutsSource = makeSource<WalletPayout[]>(
    [],
    async (id) => (await fetchCourierPayouts(id)).map(toWalletPayout),
    "Ne mogu da učitam isplate."
  );

  const balance = balanceSource.data;
  const handovers = handoversSource.data;
  const payouts = payoutsSource.data;

  const submitting = ref(false);

  const sources = [balanceSource, handoversSource, payoutsSource];

  const reset = () => {
    for (const source of sources) source.reset();
    justConfirmed.value = null;
    submitting.value = false;
  };

  const fresh = (source: Source<unknown>) => Date.now() - source.at.value < FRESH_MS;

  // --- Ulaz za ekrane ----------------------------------------------------------

  const start = (id: number) => {
    if (!Number.isFinite(id) || id <= 0) {
      stop();
      return;
    }
    if (courierId.value !== id) {
      reset();
      courierId.value = id;
    }
  };

  function stop() {
    courierId.value = null;
    reset();
  }

  // Pri otvaranju ekrana: što je svježe ostaje, staro se osvježava u pozadini, a ono čega
  // nema se učitava.
  const open = () => {
    for (const source of sources) {
      if (!source.loaded.value || !fresh(source)) void source.load();
    }
  };

  // Samo saldo (tačka u navigaciji, "Danas" na Dostavama): bez predaja i isplata. Vraća da li je
  // saldo svjež ili je uspjelo učitavanje.
  const touchBalance = async (): Promise<boolean> => {
    if (balanceSource.loaded.value && fresh(balanceSource)) return true;
    return balanceSource.load();
  };

  // Saldo ponovo, bez obzira na svježinu (poslije završene dostave gotovina se promijenila).
  const refreshBalance = (): Promise<boolean> => balanceSource.load(true);

  // Dugme "Osvježi" i povratak u aplikaciju: sve ponovo, bez obzira na svježinu.
  const refreshAll = async (): Promise<void> => {
    await Promise.all(sources.map((source) => source.load()));
  };

  // Dok predaja čeka potvrdu: saldo i predaje (isplate se ne mijenjaju zbog predaje).
  const refreshPending = async (): Promise<void> => {
    await Promise.all([balanceSource.load(), handoversSource.load()]);
  };

  // "Pokušaj ponovo": samo ono što nije uspjelo.
  const retryFailed = async (): Promise<void> => {
    const jobs = sources
      .filter((source) => Boolean(source.error.value) || source.stale.value)
      .map((source) => source.load());
    if (jobs.length === 0) jobs.push(...sources.map((source) => source.load()));
    await Promise.all(jobs);
  };

  // Čekanje je tačno ono što backend zna: nova prijava je odmah "na čekanju", a pravi red
  // zamjenjuje privremeni čim lista stigne.
  const addPending = (raw: Parameters<typeof toWalletHandover>[0]) => {
    const row = toWalletHandover(raw);
    if (!row?.pending) return;
    handoversSource.data.value = [row, ...handoversSource.data.value.filter((h) => h.id !== row.id)];
    handoversSource.loaded.value = true;
  };

  // Prijava predaje. Poruka servera (npr. "Već imate zahtjev na čekanju od 52.00 KM.")
  // ostaje u listu za prijavu umjesto generičkog teksta.
  const report = async (amount: number): Promise<{ ok: boolean; message: string }> => {
    if (!courierId.value || submitting.value) return { ok: false, message: "" };
    submitting.value = true;
    try {
      const created = await reportCashHandover(amount);
      if (created) addPending(created);
      justConfirmed.value = null;
      // Saldo ne mijenja predaja na čekanju, ali lista mora da stigne sa pravim redom.
      void Promise.all([balanceSource.load(true), handoversSource.load(true)]);
      return { ok: true, message: "" };
    } catch (cause) {
      return {
        ok: false,
        message:
          getServerMessage(cause) ??
          toFriendlyErrorMessage(cause, "Ne mogu da prijavim predaju gotovine."),
      };
    } finally {
      submitting.value = false;
    }
  };

  const dismissConfirmed = () => {
    justConfirmed.value = null;
  };

  return {
    courierId,
    balance,
    handovers,
    payouts,
    balanceLoaded: balanceSource.loaded,
    balanceLoading: balanceSource.loading,
    balanceError: balanceSource.error,
    balanceStale: balanceSource.stale,
    balanceAt: balanceSource.at,
    handoversLoaded: handoversSource.loaded,
    handoversLoading: handoversSource.loading,
    handoversError: handoversSource.error,
    handoversStale: handoversSource.stale,
    payoutsLoaded: payoutsSource.loaded,
    payoutsLoading: payoutsSource.loading,
    payoutsError: payoutsSource.error,
    payoutsStale: payoutsSource.stale,
    submitting,
    justConfirmed,
    start,
    stop,
    open,
    touchBalance,
    refreshBalance,
    refreshAll,
    refreshPending,
    retryFailed,
    report,
    dismissConfirmed,
  };
});
