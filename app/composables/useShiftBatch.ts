import { computed, ref } from "vue";
import { failureLine, type BatchFailure, type BatchResult } from "~/composables/useShiftTemplates";
import { plural, type PlanItem } from "~/utils/schedule";
import type { ShiftTemplate } from "~/types/shiftTemplate";

export type BatchRunner = (items: PlanItem[], onProgress: (done: number, total: number) => void) => Promise<BatchResult>;

export const smjena = (n: number) => `${n} ${plural(n, "smjena", "smjene", "smjena")}`;

// Izvršilac za listove koji prave više smjena (nova smjena, kopiranje dana, kopiranje smjene): jedna smjena
// = jedan poziv, do 4 istovremeno. Pamti šta je napravljeno i šta nije, pa "Pokušaj ponovo" ponavlja samo
// neuspjele, a ishod (napravljeno / neuspjelo / preskočeno) ostaje u listu dok se ne zatvori.
export const useShiftBatch = (run: BatchRunner) => {
  const running = ref(false);
  const done = ref(0);
  const total = ref(0);
  const failed = ref<BatchFailure[]>([]);
  const createdTotal = ref(0);
  const skipped = ref(0);
  // true kad je ishod stigao i list ostaje otvoren (bar jedna greška).
  const finished = ref(false);

  const reset = () => {
    running.value = false;
    done.value = 0;
    total.value = 0;
    failed.value = [];
    createdTotal.value = 0;
    skipped.value = 0;
    finished.value = false;
  };

  // Vraća napravljene smjene ovog pokretanja; `dup` je koliko ih je preskočeno jer već postoje.
  const start = async (items: PlanItem[], dup: number): Promise<ShiftTemplate[]> => {
    running.value = true;
    done.value = 0;
    total.value = items.length;
    finished.value = false;
    skipped.value = dup;
    const result = await run(items, (d, t) => {
      done.value = d;
      total.value = t;
    });
    running.value = false;
    failed.value = result.failed;
    createdTotal.value += result.created.length;
    finished.value = result.failed.length > 0;
    return result.created;
  };

  // Ponovo samo neuspjele.
  const retry = async (): Promise<ShiftTemplate[]> => {
    const items = failed.value.map((f) => f.item);
    return start(items, 0);
  };

  const failLines = (zoneName: (id: number) => string): string[] => failed.value.map((f) => failureLine(f, zoneName));

  const progress = computed(() => (running.value ? `${done.value} od ${total.value}` : ""));

  return { running, done, total, failed, createdTotal, skipped, finished, progress, reset, start, retry, failLines };
};
