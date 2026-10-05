import { ref, type ComputedRef } from "vue";
import {
  addAvailabilitySlot,
  deleteAvailabilitySlot,
  fetchCourierAvailability,
  toggleDayAvailability,
} from "~/services/courierAvailabilityService";
import { sumSlotMinutes } from "~/models/CourierAvailability";
import { getValidationMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { DayAvailability } from "~/types/availability";

export type AddSlotOutcome = { ok: true } | { ok: false; fieldError?: string };

export const useCourierAvailability = (
  courierId: ComputedRef<number>,
  deliveryCompanyId: ComputedRef<number | null>
) => {
  const alertStore = useAlertStore();

  const days = ref<DayAvailability[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  const dayFor = (date: string): DayAvailability =>
    days.value.find((day) => day.date === date) ?? { date, available: false, totalMinutes: 0, slots: [] };

  const setDay = (day: DayAvailability) => {
    days.value = [...days.value.filter((d) => d.date !== day.date), day];
  };

  const refresh = async (from: string, to: string) => {
    if (!Number.isFinite(courierId.value) || courierId.value <= 0 || !deliveryCompanyId.value) {
      days.value = [];
      return;
    }

    loading.value = true;
    try {
      days.value = await fetchCourierAvailability(courierId.value, deliveryCompanyId.value, from, to);
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam radno vrijeme."));
    } finally {
      loading.value = false;
    }
  };

  const toggleDayAvailable = async (date: string, available: boolean) => {
    if (!deliveryCompanyId.value) return;
    const previous = dayFor(date);
    if (!available) {
      setDay({ date, available: false, totalMinutes: 0, slots: [] });
    }

    saving.value = true;
    try {
      const result = await toggleDayAvailability(
        courierId.value,
        deliveryCompanyId.value,
        date,
        available
      );
      setDay({
        date,
        available: result.available,
        totalMinutes: sumSlotMinutes(result.slots),
        slots: result.slots,
      });
      alertStore.success(
        result.available ? "Dan je označen kao dostupan." : "Dan je označen kao nedostupan."
      );
    } catch (error) {
      setDay(previous);
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da sačuvam dostupnost."));
    } finally {
      saving.value = false;
    }
  };

  const addSlot = async (
    date: string,
    zoneId: number | null,
    startTime: string,
    endTime: string
  ): Promise<AddSlotOutcome> => {
    if (!deliveryCompanyId.value) return { ok: false };

    saving.value = true;
    try {
      const { slot, matchedShift } = await addAvailabilitySlot(
        courierId.value,
        deliveryCompanyId.value,
        zoneId,
        date,
        startTime,
        endTime
      );
      const existing = dayFor(date);
      const slots = [...existing.slots, slot];
      setDay({ date, available: true, totalMinutes: sumSlotMinutes(slots), slots });
      if (matchedShift) {
        alertStore.success("Termin je dodat.");
      } else {
        alertStore.info("Termin je dodat, ali dispečer još nije definisao plan za njega.");
      }
      return { ok: true };
    } catch (error) {
      const overlapMessage = getValidationMessage(error, "start_time");
      if (overlapMessage) {
        return { ok: false, fieldError: overlapMessage };
      }
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da dodam termin."));
      return { ok: false };
    } finally {
      saving.value = false;
    }
  };

  const removeSlot = async (date: string, slotId: number) => {
    saving.value = true;
    try {
      await deleteAvailabilitySlot(slotId);
      const existing = dayFor(date);
      const slots = existing.slots.filter((slot) => slot.id !== slotId);
      setDay({
        date,
        available: slots.length > 0 ? existing.available : false,
        totalMinutes: sumSlotMinutes(slots),
        slots,
      });
      alertStore.success("Termin je obrisan.");
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da obrišem termin."));
    } finally {
      saving.value = false;
    }
  };

  return {
    days,
    loading,
    saving,
    refresh,
    dayFor,
    toggleDayAvailable,
    addSlot,
    removeSlot,
  };
};
