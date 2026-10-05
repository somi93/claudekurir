import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { storeToRefs } from "pinia";
import { useFinanceSettings } from "~/composables/useFinanceSettings";
import { useDeliveryCompaniesStore } from "~/stores/deliveryCompanies";
import {
  broadcastCourierMessage,
  fetchInboxSummary,
  sendCourierInboxMessage,
} from "~/services/courierInboxService";
import { fetchDispatcherCourierLocations } from "~/services/courierLocationService";
import {
  createCompanyCourier,
  fetchCompanyCouriers,
  removeCompanyCourier,
  setCourierSuspended,
  updateCompanyCourier,
} from "~/services/dispatcherCouriersService";
import {
  fetchCouriersBalance,
  payoutCourierWage,
  recordCashReceipt,
} from "~/services/dispatcherWalletService";
import { buildRoster, isEveryone, type RosterCourier } from "~/utils/courierRoster";
import { resolveCurrency } from "~/utils/currency";
import { getErrorStatus, getServerMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import type {
  CompanyCourier,
  CourierCreatePayload,
  CourierUpdatePayload,
} from "~/types/company-courier";
import type { DispatcherCourierLocation } from "~/types/courier";
import type { CourierBalance } from "~/types/courier-balance";
import type { InboxSummaryEntry } from "~/types/inbox";
import type { MessageDraft } from "~/utils/messageDraft";

// Povremeno osvježavanje dok je tab vidljiv: stanje uživo kao na Kuriri uživo (15 s), novac i
// poruke rjeđe (60 s). Spisak kurira se čita pri otvaranju i pri povratku u tab ako je stariji od
// minute; poslije svake izmjene odgovor servera zamjenjuje red, bez ponovnog čitanja.
const LOCATIONS_EVERY_MS = 15_000;
const SLOW_EVERY_MS = 60_000;
const TICK_MS = 5_000;

export type RosterState = "loading" | "nofirm" | "error" | "empty" | "ready";

export type ActionResult =
  | { ok: true; warning?: string; id?: number }
  | { ok: false; message: string; fields: Record<string, string> };

// Poruke servera uz polje (Laravel: errors.polje[0]). Opšta poruka je naša.
const fieldErrors = (error: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof error !== "object" || error === null) return out;
  const errors = (error as { data?: { errors?: Record<string, unknown> } }).data?.errors;
  if (!errors || typeof errors !== "object") return out;
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value) && typeof value[0] === "string") out[key] = value[0];
  }
  return out;
};

const failure = (error: unknown, fallback: string): ActionResult => ({
  ok: false,
  message: toFriendlyErrorMessage(error, fallback),
  fields: fieldErrors(error),
});

export type CourierRosterOptions = {
  // Čita li se inbox-summary (pretpregled zadnje poruke i broj nepročitanih). Ekran Poruke ga ne
  // čita: sažetak broji i ponude za dostavu, pa su oba podatka pogrešna dok backend to ne ispravi (B2).
  summary?: boolean;
};

// Dispečerska lista kurira: pet izvora spojenih po courier_id u jedan spisak, njihovo osvježavanje
// i sve radnje nad kurirom. Izvor koji ne radi ne ruši listu (vidi buildRoster).
export const useCourierRoster = (options: CourierRosterOptions = {}) => {
  const withSummary = options.summary !== false;
  const companies = useDeliveryCompaniesStore();
  const { selectedCompanyId, errorMessage: companiesError } = storeToRefs(companies);
  const companyId = computed(() => selectedCompanyId.value);

  const { settings } = useFinanceSettings(companyId);
  const currency = computed(() => resolveCurrency(settings.value?.currency));
  const cashLimit = computed(() => settings.value?.cash_limit_amount ?? null);

  // Dok firma nije poznata ništa se ne tvrdi: ni "nema kurira", ni "greška".
  const ensured = ref(false);

  const rows = shallowRef<CompanyCourier[]>([]);
  const rowsLoaded = ref(false);
  const rowsFailed = ref(false);
  const rowsError = ref("");
  const refreshing = ref(false);
  const updatedAt = ref<number | null>(null);

  const locations = shallowRef<DispatcherCourierLocation[] | null>(null);
  const balances = shallowRef<CourierBalance[] | null>(null);
  const summary = shallowRef<InboxSummaryEntry[] | null>(null);
  const locationsFailed = ref(false);
  const balancesFailed = ref(false);
  const summaryFailed = ref(false);

  const now = ref(Date.now());

  // Svaka promjena firme povećava broj; odgovor koji stigne za staru firmu se odbacuje.
  let epoch = 0;
  const stamps = { rows: 0, locations: 0, slow: 0 };

  const roster = computed<RosterCourier[]>(() =>
    buildRoster(rows.value, {
      locations: locations.value,
      balances: balances.value,
      summary: summary.value,
    })
  );

  const state = computed<RosterState>(() => {
    if (!ensured.value) return "loading";
    if (!companyId.value) return companiesError.value ? "error" : "nofirm";
    if (rowsLoaded.value) return rows.value.length ? "ready" : "empty";
    return rowsFailed.value ? "error" : "loading";
  });
  // Osvježavanje nije uspjelo, a lista već postoji: ostaje stara, uz traku.
  const stale = computed(() => rowsLoaded.value && rowsFailed.value);

  // Izvor "radi" kad je bar jednom stigao i zadnje osvježavanje nije palo. Stanje uživo ili novac
  // koji se ne zna ne smije da odlučuje ko dobija poruku (grupe koje od njih zavise se gase).
  const locationsOk = computed(() => locations.value !== null && !locationsFailed.value);
  const balancesOk = computed(() => balances.value !== null && !balancesFailed.value);

  // --- Čitanje ----------------------------------------------------------------------------

  const loadRows = async (): Promise<boolean> => {
    const id = companyId.value;
    if (!id) return false;
    const mine = epoch;
    try {
      const data = await fetchCompanyCouriers(id);
      if (mine !== epoch) return false;
      rows.value = data;
      rowsLoaded.value = true;
      rowsFailed.value = false;
      rowsError.value = "";
      updatedAt.value = Date.now();
      stamps.rows = Date.now();
      return true;
    } catch (error) {
      if (mine !== epoch) return false;
      rowsFailed.value = true;
      rowsError.value = toFriendlyErrorMessage(error, "Server ne odgovara.");
      return false;
    }
  };

  const loadLocations = async () => {
    const id = companyId.value;
    if (!id) return;
    const mine = epoch;
    stamps.locations = Date.now();
    try {
      const response = await fetchDispatcherCourierLocations(id);
      if (mine !== epoch) return;
      locations.value = response.data ?? [];
      locationsFailed.value = false;
    } catch {
      if (mine === epoch) locationsFailed.value = true;
    }
  };

  const loadBalances = async () => {
    const id = companyId.value;
    if (!id) return;
    const mine = epoch;
    try {
      const data = await fetchCouriersBalance(id);
      if (mine !== epoch) return;
      balances.value = data;
      balancesFailed.value = false;
    } catch {
      if (mine === epoch) balancesFailed.value = true;
    }
  };

  const loadSummary = async () => {
    const id = companyId.value;
    if (!id) return;
    const mine = epoch;
    try {
      const data = await fetchInboxSummary(id);
      if (mine !== epoch) return;
      summary.value = data;
      summaryFailed.value = false;
    } catch {
      if (mine === epoch) summaryFailed.value = true;
    }
  };

  const loadSlow = async () => {
    stamps.slow = Date.now();
    await Promise.all([loadBalances(), withSummary ? loadSummary() : Promise.resolve()]);
  };

  // Ručno osvježavanje i "Pokušaj ponovo": sve odjednom.
  const refresh = async () => {
    if (!companyId.value || refreshing.value) return;
    refreshing.value = true;
    try {
      await Promise.all([loadRows(), loadLocations(), loadSlow()]);
    } finally {
      refreshing.value = false;
    }
  };

  const clearAll = () => {
    epoch += 1;
    rows.value = [];
    rowsLoaded.value = false;
    rowsFailed.value = false;
    rowsError.value = "";
    updatedAt.value = null;
    locations.value = null;
    balances.value = null;
    summary.value = null;
    locationsFailed.value = false;
    balancesFailed.value = false;
    summaryFailed.value = false;
  };

  // Promjena firme: lista stare firme nestaje odmah (inače bi klik na kurira poslao zahtjev sa
  // drugom firmom), pa se sve čita iznova.
  watch(companyId, (id, old) => {
    if (!ensured.value || id === old) return;
    clearAll();
    if (id) void refresh();
  });

  // --- Tajmer i vidljivost ----------------------------------------------------------------

  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    now.value = Date.now();
    if (!ensured.value || !companyId.value || !rowsLoaded.value) return;
    if (now.value - stamps.locations >= LOCATIONS_EVERY_MS) void loadLocations();
    if (now.value - stamps.slow >= SLOW_EVERY_MS) void loadSlow();
  };

  const onVisible = () => {
    if (document.hidden) return;
    now.value = Date.now();
    if (!ensured.value || !companyId.value) return;
    // Povratak u tab: ako je spisak stariji od minute, čita se sve iznova.
    if (rowsLoaded.value && now.value - stamps.rows >= SLOW_EVERY_MS) void refresh();
    else tick();
  };

  onMounted(async () => {
    await companies.ensureLoaded();
    ensured.value = true;
    if (companyId.value) void refresh();
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
  });

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  });

  // --- Radnje -----------------------------------------------------------------------------

  const replaceRow = (updated: CompanyCourier) => {
    rows.value = rows.value.map((r) => (r.courier_id === updated.courier_id ? updated : r));
  };

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

  // Samo izmijenjena polja; odgovor je pun red pa zamjenjuje stari.
  const update = (courierId: number, payload: CourierUpdatePayload): Promise<ActionResult> =>
    run(async () => {
      const id = companyId.value;
      if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      if (Object.keys(payload).length === 0) return { ok: true };
      try {
        replaceRow(await updateCompanyCourier(id, courierId, payload));
        return { ok: true };
      } catch (error) {
        return failure(
          error,
          "Server nije prihvatio izmjene. Pokušaj ponovo; tvoje izmjene su ostale u listu."
        );
      }
    });

  const create = (payload: CourierCreatePayload): Promise<ActionResult> =>
    run(async () => {
      const id = companyId.value;
      if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      try {
        const created = await createCompanyCourier(id, payload);
        rows.value = [...rows.value, created];
        return { ok: true, id: created.courier_id };
      } catch (error) {
        return failure(error, "Server nije napravio kurira. Pokušaj ponovo; podaci su ostali u listu.");
      }
    });

  const setSuspended = (
    courierId: number,
    suspended: boolean,
    reason?: string
  ): Promise<ActionResult> =>
    run(async () => {
      const id = companyId.value;
      if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      try {
        await setCourierSuspended(id, courierId, { suspended, reason: suspended ? reason : undefined });
        rows.value = rows.value.map((r) =>
          r.courier_id === courierId
            ? {
                ...r,
                suspended,
                suspended_reason: suspended ? (reason ?? null) : null,
                suspended_at: suspended ? new Date().toISOString() : null,
              }
            : r
        );
        return { ok: true };
      } catch (error) {
        return failure(
          error,
          suspended ? "Ne mogu da suspendujem kurira." : "Ne mogu da aktiviram kurira."
        );
      }
    });

  const remove = (courierId: number): Promise<ActionResult> =>
    run(async () => {
      const id = companyId.value;
      if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      try {
        await removeCompanyCourier(id, courierId);
        rows.value = rows.value.filter((r) => r.courier_id !== courierId);
        return { ok: true };
      } catch (error) {
        return failure(error, "Ne mogu da uklonim kurira sa liste firme.");
      }
    });

  // cash-receipt i payout vraćaju 404 sa čitljivom porukom kad kurir nikad nije bio vezan za firmu.
  const cashFailure = (error: unknown, fallback: string): ActionResult =>
    getErrorStatus(error) === 404
      ? { ok: false, message: getServerMessage(error) ?? fallback, fields: {} }
      : failure(error, fallback);

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
        void loadBalances();
        return { ok: true, warning: res.warning };
      } catch (error) {
        return cashFailure(error, "Ne mogu da evidentiram uplatu. Pokušaj ponovo.");
      }
    });

  const payout = (
    courierId: number,
    amount: number,
    method: string,
    idempotencyKey: string
  ): Promise<ActionResult> =>
    run(async () => {
      const id = companyId.value;
      if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      try {
        const res = await payoutCourierWage(courierId, {
          delivery_company_id: id,
          amount,
          method,
          idempotency_key: idempotencyKey,
        });
        void loadBalances();
        return { ok: true, warning: res.warning };
      } catch (error) {
        return cashFailure(error, "Ne mogu da isplatim zaradu. Pokušaj ponovo.");
      }
    });

  // Jednom kuriru ide na njegov inbox, više njih (ili svi) kroz broadcast. Ako je izabran cijeli
  // spisak firme šalje se all_couriers: true.
  const message = (courierIds: number[], draft: MessageDraft): Promise<ActionResult> =>
    run(async () => {
      const id = companyId.value;
      if (!id) return { ok: false, message: "Firma nije izabrana.", fields: {} };
      if (courierIds.length === 0) return { ok: false, message: "Nema primalaca.", fields: {} };
      const body = {
        category: draft.category,
        title: draft.title.trim(),
        body: draft.body.trim(),
      };
      try {
        if (courierIds.length === 1) {
          await sendCourierInboxMessage(courierIds[0] as number, body);
        } else if (isEveryone(courierIds, roster.value)) {
          await broadcastCourierMessage(id, { ...body, all_couriers: true });
        } else {
          await broadcastCourierMessage(id, { ...body, all_couriers: false, courier_ids: courierIds });
        }
      } catch (error) {
        if (getErrorStatus(error) === 403) {
          return {
            ok: false,
            message: "Nemaš pravo da šalješ poruke ovom kuriru: nije vezan za tvoju firmu.",
            fields: {},
          };
        }
        return failure(error, "Ne mogu da pošaljem poruku. Pokušaj ponovo; tekst je ostao u listu.");
      }
      if (!withSummary) return { ok: true };
      // Oznaka poruke u listi odmah, a pravo stanje stiže sa sljedećim čitanjem sažetka.
      if (summary.value) {
        const at = new Date().toISOString();
        const sent = new Set(courierIds);
        const known = new Set(summary.value.map((s) => s.courierId));
        const last = { title: body.title, sentAt: at, category: body.category, sender: "dispatcher" as const };
        summary.value = [
          ...summary.value.map((s) =>
            sent.has(s.courierId)
              ? { ...s, lastMessage: last, dispatcherUnreadCount: s.dispatcherUnreadCount + 1 }
              : s
          ),
          ...courierIds
            .filter((cid) => !known.has(cid))
            .map((cid) => ({ courierId: cid, lastMessage: last, dispatcherUnreadCount: 1 })),
        ];
      }
      void loadSummary();
      return { ok: true };
    });

  return {
    ensured,
    state,
    stale,
    roster,
    now,
    updatedAt,
    refreshing,
    rowsError,
    locationsFailed,
    balancesFailed,
    summaryFailed,
    locationsOk,
    balancesOk,
    currency,
    cashLimit,
    companyId,
    saving,
    refresh,
    loadSummary,
    update,
    create,
    setSuspended,
    remove,
    receipt,
    payout,
    message,
  };
};
