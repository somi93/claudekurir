import { ref, type ComputedRef } from "vue";
import {
  createShiftTemplate,
  deleteShiftTemplate,
  duplicateWeekShiftTemplates,
  fetchShiftTemplates,
  updateShiftTemplateCapacity,
} from "~/services/shiftTemplatesService";
import { getServerMessage, getValidationMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import { dayLong, type PlanItem } from "~/utils/schedule";
import type {
  DuplicateWeekPayload,
  DuplicateWeekResult,
  NewShiftTemplatePayload,
  ShiftTemplate,
  ShiftTemplateCapacityPayload,
} from "~/types/shiftTemplate";

const NO_ANSWER = "Server ne odgovara.";
// Koliko poziva ide istovremeno kad se pravi više smjena (server nema poziv za više smjena odjednom).
const BATCH_PARALLEL = 4;

export type BatchFailure = { item: PlanItem; message: string };
export type BatchResult = { created: ShiftTemplate[]; failed: BatchFailure[] };

export const useShiftTemplates = (deliveryCompanyId: ComputedRef<number | null>) => {
  const alertStore = useAlertStore();

  const templates = ref<ShiftTemplate[]>([]);
  const loading = ref(true);
  const saving = ref(false);
  // Pad učitavanja: ekran piše grešku u mjestu sadržaja ("Pokušaj ponovo"), jer prazna mreža izgleda kao
  // sedmica bez smjena. Raspon koji je zadnji put uspješno učitan je `loadedRange`.
  const loadFailed = ref(false);
  const loadReason = ref("");
  const loadedRange = ref<{ from: string; to: string } | null>(null);

  let seq = 0;
  let lastRange: { from: string; to: string } | null = null;
  let lastSilent = false;

  // options.silent - greška se ne pokazuje kao zajednička obavijest (vidi loadFailed/loadReason).
  // options.quiet  - osvježavanje u pozadini: ništa se ne mijenja na ekranu dok se čeka, a pad se ignoriše
  //                  (stari podaci ostaju, bez poruke).
  const load = async (from: string, to: string, options: { silent?: boolean; quiet?: boolean } = {}) => {
    lastRange = { from, to };
    lastSilent = options.silent ?? false;
    const quiet = options.quiet ?? false;
    const mine = ++seq;
    if (!deliveryCompanyId.value) {
      templates.value = [];
      loadedRange.value = null;
      loading.value = false;
      return;
    }
    if (!quiet) {
      loading.value = true;
      loadFailed.value = false;
      loadReason.value = "";
    }
    try {
      const loaded = await fetchShiftTemplates(deliveryCompanyId.value, from, to);
      if (mine !== seq) return;
      templates.value = loaded;
      loadedRange.value = { from, to };
      loadFailed.value = false;
    } catch (error) {
      if (mine !== seq) return;
      if (quiet) return;
      loadFailed.value = true;
      loadReason.value = toFriendlyErrorMessage(error, NO_ANSWER);
      if (!lastSilent) alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam smjene."));
    } finally {
      if (mine === seq && !quiet) loading.value = false;
    }
  };

  // Ponovo učitava isti raspon (za "Pokušaj ponovo" i poslije kopiranja sedmice).
  const reload = () => (lastRange ? load(lastRange.from, lastRange.to, { silent: lastSilent }) : Promise.resolve());

  // Promjena firme: podaci prethodne ne smiju da ostanu na ekranu dok nova ne stigne.
  const reset = () => {
    seq++;
    templates.value = [];
    loadedRange.value = null;
    loadFailed.value = false;
    loadReason.value = "";
    loading.value = true;
  };

  const create = async (payload: NewShiftTemplatePayload): Promise<boolean> => {
    saving.value = true;
    try {
      const template = await createShiftTemplate(payload);
      templates.value = [...templates.value, template];
      alertStore.success("Smjena je napravljena.");
      return true;
    } catch (error) {
      const message =
        getServerMessage(error) ?? toFriendlyErrorMessage(error, "Ne mogu da napravim smjenu.");
      alertStore.error(message);
      return false;
    } finally {
      saving.value = false;
    }
  };

  // Pravi više smjena odjednom (dani × zone): N poziva, do 4 istovremeno. Svaka greška se pamti uz
  // smjenu na koju se odnosi, pa ekran može da ponudi "Pokušaj ponovo" samo za neuspjele.
  // onProgress javlja koliko je poziva gotovo.
  const createMany = async (
    items: PlanItem[],
    companyId: number,
    onProgress?: (done: number, total: number) => void
  ): Promise<BatchResult> => {
    const created: ShiftTemplate[] = [];
    const failed: BatchFailure[] = [];
    let index = 0;
    let done = 0;
    const worker = async () => {
      while (index < items.length) {
        const item = items[index++]!;
        try {
          const template = await createShiftTemplate({
            zone_id: item.zoneId,
            delivery_company_id: companyId,
            date: item.date,
            start_time: item.start,
            end_time: item.end,
            min_couriers: item.min,
            target_couriers: item.target,
            max_couriers: item.max,
            high_demand: item.hot,
          });
          created.push(template);
          templates.value = [...templates.value, template];
        } catch (error) {
          failed.push({
            item,
            message:
              getServerMessage(error) ?? toFriendlyErrorMessage(error, "Ne mogu da napravim smjenu."),
          });
        }
        done++;
        onProgress?.(done, items.length);
      }
    };
    saving.value = true;
    try {
      await Promise.all(Array.from({ length: Math.min(BATCH_PARALLEL, items.length) }, worker));
    } finally {
      saving.value = false;
    }
    return { created, failed };
  };

  const updateCapacity = async (
    shiftTemplateId: number,
    payload: ShiftTemplateCapacityPayload
  ): Promise<boolean> => {
    saving.value = true;
    try {
      const template = await updateShiftTemplateCapacity(shiftTemplateId, payload);
      templates.value = templates.value.map((t) => (t.id === shiftTemplateId ? template : t));
      alertStore.success("Kapacitet smjene je sačuvan.");
      return true;
    } catch (error) {
      const message =
        getValidationMessage(error, "min_couriers") ??
        getValidationMessage(error, "target_couriers") ??
        getValidationMessage(error, "max_couriers") ??
        getServerMessage(error) ??
        toFriendlyErrorMessage(error, "Ne mogu da sačuvam kapacitet.");
      alertStore.error(message);
      return false;
    } finally {
      saving.value = false;
    }
  };

  const remove = async (shiftTemplateId: number): Promise<boolean> => {
    saving.value = true;
    try {
      await deleteShiftTemplate(shiftTemplateId);
      templates.value = templates.value.filter((t) => t.id !== shiftTemplateId);
      alertStore.success("Smjena je obrisana.");
      return true;
    } catch (error) {
      const message =
        getServerMessage(error) ?? toFriendlyErrorMessage(error, "Ne mogu da obrišem smjenu.");
      alertStore.error(message);
      return false;
    } finally {
      saving.value = false;
    }
  };

  const duplicateWeek = async (
    payload: Omit<DuplicateWeekPayload, "delivery_company_id">
  ): Promise<DuplicateWeekResult | null> => {
    if (!deliveryCompanyId.value) return null;
    saving.value = true;
    try {
      return await duplicateWeekShiftTemplates({
        ...payload,
        delivery_company_id: deliveryCompanyId.value,
      });
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da kopiram sedmicu."));
      return null;
    } finally {
      saving.value = false;
    }
  };

  return {
    templates,
    loading,
    saving,
    loadFailed,
    loadReason,
    loadedRange,
    load,
    reload,
    reset,
    create,
    createMany,
    updateCapacity,
    remove,
    duplicateWeek,
  };
};

// "Centar, utorak 6. oktobar: poruka servera" za spisak neuspjelih smjena u listu.
export const failureLine = (f: BatchFailure, zoneName: (id: number) => string): string =>
  `${zoneName(f.item.zoneId)}, ${dayLong(f.item.date)}: ${f.message}`;
