import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from "vue";
import { fetchCashHandoverHistory, fetchCompanyPayouts } from "~/services/dispatcherWalletService";
import { buildJournal, type JournalRow } from "~/utils/cashDesk";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import type { CashHandoverHistoryItem } from "~/types/cash-handover";
import type { CompanyPayout } from "~/types/payout";

export type JournalState = "idle" | "loading" | "ok" | "error";

// Promet: predaje (cash-handovers) i isplate (payouts) za izabrani period i kurira, spojeni u jedan tok.
// Dva čitanja po promjeni perioda ili kurira; vrsta i "Samo razlike" se filtriraju u pregledniku.
// Odgovor koji stigne za raniji izbor se odbacuje (brojač), a stari podaci ostaju dok se novi čitaju.
export const useCashJournal = (opts: {
  companyId: ComputedRef<number | null>;
  enabled: ComputedRef<boolean>;
  from: ComputedRef<string>;
  to: ComputedRef<string>;
  courier: Ref<number | null>;
  nameOf: (courierId: number) => string;
}) => {
  const handovers = shallowRef<CashHandoverHistoryItem[]>([]);
  const payouts = shallowRef<CompanyPayout[]>([]);
  const state = ref<JournalState>("idle");
  const failed = ref(false);
  const error = ref("");
  const loadedAt = ref<number | null>(null);
  // Za koji izbor su podaci u listi: promjena izbora čita iznova, isti izbor ne.
  const loadedKey = ref("");

  let seq = 0;

  const keyOf = () => `${opts.companyId.value}|${opts.from.value}|${opts.to.value}|${opts.courier.value ?? ""}`;

  const load = async () => {
    const id = opts.companyId.value;
    if (!id || !opts.from.value || !opts.to.value) return;
    const mine = ++seq;
    const key = keyOf();
    if (loadedKey.value !== key) {
      // Drugi izbor: stari zbirovi ne smiju stajati uz novi period.
      handovers.value = [];
      payouts.value = [];
      loadedAt.value = null;
    }
    if (loadedAt.value == null) state.value = "loading";
    const filters = { courierId: opts.courier.value, from: opts.from.value, to: opts.to.value };
    try {
      const [h, p] = await Promise.all([
        fetchCashHandoverHistory(id, { ...filters, status: null }),
        fetchCompanyPayouts(id, filters),
      ]);
      if (mine !== seq) return;
      handovers.value = h;
      payouts.value = p;
      state.value = "ok";
      failed.value = false;
      error.value = "";
      loadedAt.value = Date.now();
      loadedKey.value = key;
    } catch (e) {
      if (mine !== seq) return;
      failed.value = true;
      error.value = toFriendlyErrorMessage(e, "Server ne odgovara.");
      if (loadedAt.value == null) state.value = "error";
    }
  };

  const rows = computed<JournalRow[]>(() =>
    buildJournal({ handovers: handovers.value, payouts: payouts.value, nameOf: opts.nameOf })
  );

  // Tab je otvoren (ili se izbor promijenio dok je otvoren) i podaci nisu za taj izbor: čita se.
  watch(
    [opts.enabled, opts.companyId, opts.from, opts.to, opts.courier],
    ([enabled]) => {
      if (!enabled) return;
      if (loadedKey.value !== keyOf() || state.value === "idle" || state.value === "error") void load();
    },
    { immediate: true }
  );

  return { rows, state, failed, error, loadedAt, load, reload: load };
};
