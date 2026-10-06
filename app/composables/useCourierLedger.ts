import { computed, reactive, watch, type ComputedRef } from "vue";
import { fetchCashHandoverHistory, fetchCompanyPayouts } from "~/services/dispatcherWalletService";
import { addDaysKey, buildJournal, dayKey, type JournalRow } from "~/utils/cashDesk";
import type { Ref } from "vue";

// Tok jednog kurira (zadnjih 30 dana, predaje i isplate zajedno) u detalju: dva čitanja, keširano 60 s.
// Poslije radnje nad tim kurirom kes se poništava, pa se tok čita iznova.
const FRESH_MS = 60_000;
const DAYS = 30;

type Entry = { state: "loading" | "ok" | "error"; rows: JournalRow[]; at: number };

export const useCourierLedger = (opts: {
  companyId: ComputedRef<number | null>;
  courierId: Ref<number | null>;
  nameOf: (courierId: number) => string;
  now: Ref<number>;
}) => {
  const cache = reactive(new Map<number, Entry>());

  // Odgovor koji stigne poslije promjene firme se odbacuje.
  let epoch = 0;

  const load = async (courierId: number, force = false) => {
    const id = opts.companyId.value;
    if (!id) return;
    const cur = cache.get(courierId);
    if (!force && cur && (cur.state === "loading" || (cur.state === "ok" && Date.now() - cur.at < FRESH_MS))) return;
    const mine = epoch;
    cache.set(courierId, { state: "loading", rows: cur?.rows ?? [], at: cur?.at ?? 0 });
    const from = addDaysKey(dayKey(opts.now.value), -DAYS);
    try {
      const [h, p] = await Promise.all([
        fetchCashHandoverHistory(id, { courierId, status: null, from, to: null }),
        fetchCompanyPayouts(id, { courierId, from, to: null }),
      ]);
      if (mine !== epoch) return;
      cache.set(courierId, {
        state: "ok",
        rows: buildJournal({ handovers: h, payouts: p, nameOf: opts.nameOf }),
        at: Date.now(),
      });
    } catch {
      if (mine !== epoch) return;
      cache.set(courierId, { state: "error", rows: [], at: 0 });
    }
  };

  const invalidate = (courierId: number) => {
    cache.delete(courierId);
    if (opts.courierId.value === courierId) void load(courierId, true);
  };

  watch(
    () => [opts.courierId.value, opts.companyId.value] as const,
    ([courierId], old) => {
      if (old && old[1] !== opts.companyId.value) {
        epoch += 1;
        cache.clear();
      }
      if (courierId != null) void load(courierId);
    },
    { immediate: true }
  );

  // Poslije skupne radnje (isplata svima): tok svakog kurira je zastario.
  const reset = () => {
    cache.clear();
    if (opts.courierId.value != null) void load(opts.courierId.value, true);
  };

  const current = computed(() => (opts.courierId.value == null ? null : (cache.get(opts.courierId.value) ?? null)));
  const reload = () => {
    if (opts.courierId.value != null) void load(opts.courierId.value, true);
  };

  return { current, reload, invalidate, reset };
};
