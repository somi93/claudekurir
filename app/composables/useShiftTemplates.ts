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
import type {
  DuplicateWeekPayload,
  DuplicateWeekResult,
  NewShiftTemplatePayload,
  ShiftTemplate,
  ShiftTemplateCapacityPayload,
} from "~/types/shiftTemplate";

export const useShiftTemplates = (deliveryCompanyId: ComputedRef<number | null>) => {
  const alertStore = useAlertStore();

  const templates = ref<ShiftTemplate[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  const load = async (from: string, to: string, zoneId?: number | null) => {
    if (!deliveryCompanyId.value) {
      templates.value = [];
      return;
    }
    loading.value = true;
    try {
      templates.value = await fetchShiftTemplates(deliveryCompanyId.value, from, to, zoneId);
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam smjene."));
    } finally {
      loading.value = false;
    }
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

  return { templates, loading, saving, load, create, updateCapacity, remove, duplicateWeek };
};
