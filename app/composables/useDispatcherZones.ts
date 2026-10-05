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

const NO_ANSWER = "Server ne odgovara.";

export const useDispatcherZones = () => {
  const alertStore = useAlertStore();

  const zones = ref<DispatcherZone[]>([]);
  const loading = ref(true);
  const saving = ref(false);
  // Pad učitavanja i kratak razlog uz naslov ("Server ne odgovara." / nema veze), za ekrane koji
  // pokazuju grešku u svom redu ("Pokušaj ponovo") umjesto zajedničke obavijesti.
  const loadFailed = ref(false);
  const loadReason = ref("");

  // Odgovor za raniji poziv (npr. drugi grad) se odbacuje.
  let seq = 0;
  let lastCity: number | null | undefined;
  let lastSilent = false;

  // options.silent - greška se ne pokazuje kao zajednička obavijest (vidi loadFailed/loadReason).
  const load = async (cityId?: number | null, options: { silent?: boolean } = {}) => {
    const mine = ++seq;
    lastCity = cityId;
    lastSilent = options.silent ?? false;
    loading.value = true;
    loadFailed.value = false;
    loadReason.value = "";
    try {
      const loaded = await fetchDispatcherZones(cityId);
      if (mine === seq) zones.value = loaded;
    } catch (error) {
      if (mine !== seq) return;
      loadFailed.value = true;
      const reason = toFriendlyErrorMessage(error, NO_ANSWER);
      loadReason.value = reason;
      if (!lastSilent) alertStore.error(reason === NO_ANSWER ? "Ne mogu da učitam zone." : reason);
    } finally {
      if (mine === seq) loading.value = false;
    }
  };

  // Ponovo učitava zone za isti grad kao zadnji put (za "Pokušaj ponovo").
  const reload = () => load(lastCity, { silent: lastSilent });

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

  return { zones, loading, saving, loadFailed, loadReason, load, reload, create, update, remove };
};
