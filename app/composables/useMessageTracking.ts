import { onBeforeUnmount, ref } from "vue";
import { deleteInboxMessage, fetchCourierInboxPage } from "~/services/courierInboxService";
import {
  AUTO_CHECKS_MS,
  CONCURRENCY,
  canTrack,
  checkQuery,
  claimedByOthers,
  matchSent,
  retractTargets,
  runPool,
  tooManyFailures,
  type RecipientResult,
  type SentBatch,
} from "~/utils/messageTracking";

// Šta se događa sa karticom u toku: provjera (broj obrađenih sandučića) ili poruka servera.
export type CheckState = { running: boolean; done: number; total: number; busy: boolean };

export type RetractPhase = "ask" | "lookup" | "run" | "done" | "partial" | "fail" | "none";

export type RetractState = {
  batchId: string;
  phase: RetractPhase;
  done: number;
  total: number;
  ok: number;
  fail: number;
};

type Sent = {
  batches: { value: SentBatch[] };
  find: (id: string) => SentBatch | undefined;
  update: (id: string, patch: Partial<SentBatch>) => void;
};

// Praćenje čitanja i povlačenje poruke dok backend ne da pakete poruka (B1): sanduče svakog primaoca
// se čita sa ?category= (ponude se ne miješaju) i poruka se traži po tekstu; povlačenje je
// DELETE /inbox/{id} po sandučiću. Najviše 6 zahtjeva istovremeno; praćenje samo do 40 primalaca, a
// staje kad padne više od trećine zahtjeva. Povlačenje je izričita radnja, pa radi i za veće primaoce.
export const useMessageTracking = (sent: Sent) => {
  const checks = ref<Record<string, CheckState>>({});
  const retract = ref<RetractState | null>(null);
  const timers: ReturnType<typeof setTimeout>[] = [];

  const setCheck = (id: string, patch: Partial<CheckState>) => {
    const cur = checks.value[id] ?? { running: false, done: 0, total: 0, busy: false };
    checks.value = { ...checks.value, [id]: { ...cur, ...patch } };
  };

  // Čita sanduče svakog primaoca. `force` zaobilazi granicu od 40 (samo za povlačenje).
  const lookup = async (batchId: string, force: boolean): Promise<boolean> => {
    const batch = sent.find(batchId);
    if (!batch || batch.status === "retracted") return false;
    if (!force && !canTrack(batch)) return false;
    if (checks.value[batchId]?.running) return false;

    const total = batch.recipients.length;
    setCheck(batchId, { running: true, done: 0, total, busy: false });
    const taken = claimedByOthers(batch, sent.batches.value);
    const query = checkQuery(batch);
    const results: Record<number, RecipientResult> = { ...batch.results };
    let done = 0;
    let failed = 0;
    let aborted = false;

    await runPool(batch.recipients, CONCURRENCY, async (courierId) => {
      if (aborted) return;
      try {
        const { messages } = await fetchCourierInboxPage(courierId, query);
        const row = matchSent(batch, messages, taken);
        results[courierId] = row
          ? { state: row.read ? "read" : "unread", inboxId: row.id }
          : { state: "missing", inboxId: null };
      } catch {
        results[courierId] = { state: "error", inboxId: results[courierId]?.inboxId ?? null };
        failed += 1;
        if (tooManyFailures(failed, total)) aborted = true;
      }
      done += 1;
      setCheck(batchId, { done });
    });

    sent.update(batchId, { results, checkedAt: Date.now() });
    setCheck(batchId, { running: false, busy: aborted });
    return !aborted;
  };

  const check = (batchId: string) => lookup(batchId, false);

  // Poslije slanja: provjera sama poslije ~20 s i ~2 min (kurir tek treba da otvori aplikaciju).
  const scheduleAuto = (batch: SentBatch) => {
    if (!canTrack(batch)) return;
    for (const ms of AUTO_CHECKS_MS) timers.push(setTimeout(() => void check(batch.id), ms));
  };

  // --- Povlačenje ------------------------------------------------------------------------------

  const openRetract = (batch: SentBatch) => {
    retract.value = {
      batchId: batch.id,
      phase: "ask",
      done: 0,
      total: batch.recipients.length,
      ok: 0,
      fail: 0,
    };
  };

  const closeRetract = () => {
    if (retract.value && (retract.value.phase === "lookup" || retract.value.phase === "run")) return;
    retract.value = null;
  };

  const patchRetract = (patch: Partial<RetractState>) => {
    if (retract.value) retract.value = { ...retract.value, ...patch };
  };

  const runRetract = async () => {
    const state = retract.value;
    if (!state || state.phase === "lookup" || state.phase === "run") return;
    const batchId = state.batchId;
    let batch = sent.find(batchId);
    if (!batch) return;

    // Poruka u sandučićima se prvo mora naći (id poruke po primaocu).
    if (!batch.checkedAt) {
      patchRetract({ phase: "lookup", done: 0, ok: 0, fail: 0 });
      await lookup(batchId, true);
      batch = sent.find(batchId);
      if (!batch) return;
    }
    const targets = retractTargets(batch);
    if (targets.length === 0) {
      patchRetract({ phase: "none", total: 0 });
      return;
    }

    patchRetract({ phase: "run", done: 0, total: targets.length, ok: 0, fail: 0 });
    const results: Record<number, RecipientResult> = { ...batch.results };
    let ok = 0;
    let fail = 0;
    await runPool(targets, CONCURRENCY, async (t) => {
      try {
        await deleteInboxMessage(t.inboxId);
        ok += 1;
        results[t.courierId] = { state: "missing", inboxId: null };
      } catch {
        fail += 1;
      }
      patchRetract({ done: ok + fail, ok, fail });
    });

    const before = batch.retracted ?? { ok: 0, fail: 0, total: batch.recipients.length };
    sent.update(batchId, {
      results,
      status: fail ? "partial" : "retracted",
      retracted: { ok: before.ok + ok, fail, total: batch.recipients.length },
    });
    patchRetract({ phase: fail ? (ok ? "partial" : "fail") : "done", ok, fail });
  };

  onBeforeUnmount(() => {
    for (const t of timers) clearTimeout(t);
  });

  return { checks, retract, check, scheduleAuto, openRetract, closeRetract, runRetract };
};
