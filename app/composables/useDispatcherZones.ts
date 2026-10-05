import { ref } from "vue";
import {
  createDispatcherZone,
  deleteDispatcherZone,
  fetchDispatcherZones,
  updateDispatcherZone,
} from "~/services/dispatcherZonesService";
import { getServerMessage, getValidationMessage, toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { DispatcherZone, DispatcherZonePayload } from "~/types/dispatcherZone";

export const useDispatcherZones = () => {
  const alertStore = useAlertStore();

  const zones = ref<DispatcherZone[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  const load = async (cityId?: number | null) => {
    loading.value = true;
    try {
      zones.value = await fetchDispatcherZones(cityId);
    } catch (error) {
      alertStore.error(toFriendlyErrorMessage(error, "Ne mogu da učitam zone."));
    } finally {
      loading.value = false;
    }
  };

  const create = async (payload: DispatcherZonePayload): Promise<boolean> => {
    saving.value = true;
    try {
      const zone = await createDispatcherZone(payload);
      zones.value = [...zones.value, zone];
      alertStore.success("Zona je kreirana.");
      return true;
    } catch (error) {
      const message =
        getValidationMessage(error, "name") ??
        getServerMessage(error) ??
        toFriendlyErrorMessage(error, "Ne mogu da sačuvam zonu.");
      alertStore.error(message);
      return false;
    } finally {
      saving.value = false;
    }
  };

  const update = async (zoneId: number, payload: DispatcherZonePayload): Promise<boolean> => {
    saving.value = true;
    try {
      const zone = await updateDispatcherZone(zoneId, payload);
      zones.value = zones.value.map((z) => (z.id === zoneId ? zone : z));
      alertStore.success("Izmene zone su sačuvane.");
      return true;
    } catch (error) {
      const message =
        getValidationMessage(error, "name") ??
        getServerMessage(error) ??
        toFriendlyErrorMessage(error, "Ne mogu da sačuvam zonu.");
      alertStore.error(message);
      return false;
    } finally {
      saving.value = false;
    }
  };

  const remove = async (zoneId: number): Promise<boolean> => {
    saving.value = true;
    try {
      await deleteDispatcherZone(zoneId);
      zones.value = zones.value.filter((z) => z.id !== zoneId);
      alertStore.success("Zona je obrisana.");
      return true;
    } catch (error) {
      const message =
        getServerMessage(error) ?? toFriendlyErrorMessage(error, "Ne mogu da obrišem zonu.");
      alertStore.error(message);
      return false;
    } finally {
      saving.value = false;
    }
  };

  return { zones, loading, saving, load, create, update, remove };
};
