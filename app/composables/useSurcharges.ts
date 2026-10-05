import { computed, ref, watch, type ComputedRef } from "vue";
import {
  createSurcharge,
  deleteSurcharge,
  fetchSurcharges as fetchSurchargesRequest,
  updateSurchargeActive,
} from "~/services/surchargesService";
import { fetchConditionTags as fetchConditionTagsRequest } from "~/services/conditionTagsService";
import type { ConditionTag, NewSurchargeForm, Surcharge, SurchargePreset } from "~/types/pricing";
import { SURCHARGE_PRESETS } from "~/data/surchargePresets";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";

// Backend šalje "HH:mm:ss" za default_time_from/to (vidi
// Dopuna_katalog_tagovi_frontend_cirilica.md), forma/v-time-picker rade sa
// "HH:mm" (isti format kao postojeći time_from/time_to na naknadama).
const trimSeconds = (time: string) => time.slice(0, 5);

const emptyNewSurcharge = (): NewSurchargeForm => ({
  name: "",
  description: "",
  type: "per_km",
  value: 0,
  unit: "",
  timeFrom: "",
  timeTo: "",
  autoTime: false,
  conditionTagId: null,
  icon: "mdi-tune-variant",
});

export const useSurcharges = (companyId: ComputedRef<number | null>) => {
  const alertStore = useAlertStore();

  const surcharges = ref<Surcharge[]>([]);
  const loadingSurcharges = ref(false);
  const errorMessage = ref("");

  const activeSurcharges = computed(() => surcharges.value.filter((s) => s.active));

  const fetchSurcharges = async (id: number) => {
    loadingSurcharges.value = true;
    try {
      surcharges.value = await fetchSurchargesRequest(id);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam dodatne parametre.");
    } finally {
      loadingSurcharges.value = false;
    }
  };

  const toggleSurcharge = async (surcharge: Surcharge) => {
    try {
      await updateSurchargeActive(surcharge.id, surcharge.active);
      alertStore.success(surcharge.active ? "Parametar je uključen." : "Parametar je isključen.");
    } catch (error) {
      surcharge.active = !surcharge.active;
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam izmenu naknade.");
    }
  };

  const newSurcharge = ref<NewSurchargeForm>(emptyNewSurcharge());
  const showAddSurcharge = ref(false);
  const savingSurcharge = ref(false);

  const addSurcharge = async () => {
    if (!newSurcharge.value.name.trim() || !companyId.value) return;
    savingSurcharge.value = true;
    try {
      const created = await createSurcharge(companyId.value, newSurcharge.value);
      surcharges.value.push(created);
      newSurcharge.value = emptyNewSurcharge();
      showAddSurcharge.value = false;
      alertStore.success("Parametar je dodat.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam parametar.");
    } finally {
      savingSurcharge.value = false;
    }
  };

  const removeSurcharge = async (id: number) => {
    try {
      await deleteSurcharge(id);
      surcharges.value = surcharges.value.filter((s) => s.id !== id);
      alertStore.success("Parametar je obrisan.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da obrišem parametar.");
    }
  };

  // Zajednički katalog (condition-tags) - isti za sve firme, učitava se
  // jednom, nezavisno od companyId (vidi
  // Dopuna_katalog_tagovi_frontend_cirilica.md).
  const conditionTags = ref<ConditionTag[]>([]);
  const loadingConditionTags = ref(false);
  const fetchConditionTags = async () => {
    loadingConditionTags.value = true;
    try {
      conditionTags.value = await fetchConditionTagsRequest();
    } catch (error) {
      // Katalog nije kritičan za rad ekrana - forma i dalje radi bez
      // "brzo dodavanje" chip-ova iz kataloga, ne blokiramo UI. Backend je
      // 16.08 potvrdio da GET /condition-tags radi ispravno, pa ako se
      // chip-ovi ne pojave, log ovde pomaže da se odmah vidi da li poziv
      // uopšte propada (umesto da izgleda kao prazan katalog).
      console.warn("Ne mogu da učitam condition-tags katalog:", error);
    } finally {
      loadingConditionTags.value = false;
    }
  };
  fetchConditionTags();

  // Lokalni predlozi (Centar grada, Brdovit teren) - nisu deo kataloga.
  const localPresets = computed(() =>
    SURCHARGE_PRESETS.filter((preset) => !surcharges.value.some((s) => s.name === preset.name))
  );

  // "Brzo dodavanje" iz kataloga - popuni Naziv (zaključan) + predloženo
  // vreme ako postoji, condition_tag_id ide u telo pri čuvanju. Korisnik i
  // dalje mora da klikne "Sačuvaj parametar" (vidi
  // UIUX_napomene_katalog_frontend.md).
  const selectConditionTag = (tag: ConditionTag) => {
    const hasDefaultTime = Boolean(tag.default_time_from && tag.default_time_to);
    newSurcharge.value = {
      ...emptyNewSurcharge(),
      name: tag.name,
      conditionTagId: tag.id,
      icon: tag.icon,
      autoTime: hasDefaultTime,
      timeFrom: hasDefaultTime ? trimSeconds(tag.default_time_from as string) : "",
      timeTo: hasDefaultTime ? trimSeconds(tag.default_time_to as string) : "",
    };
    showAddSurcharge.value = true;
  };

  // Lokalni presetovi - nisu deo kataloga (bez condition_tag_id), popune
  // ceo formu kao ranije, ali se i dalje mora eksplicitno sačuvati (isti
  // tok kao katalog chip-ovi, odluka 14.08).
  const selectPreset = (preset: SurchargePreset) => {
    newSurcharge.value = {
      ...emptyNewSurcharge(),
      name: preset.name,
      description: preset.description,
      type: preset.type,
      value: preset.value,
      unit: preset.unit,
      icon: preset.icon,
      autoTime: Boolean(preset.time_from),
      timeFrom: preset.time_from ?? "",
      timeTo: preset.time_to ?? "",
    };
    showAddSurcharge.value = true;
  };

  // "Prilagođeni parametar" - otključava Naziv (samo katalog tagovi ga
  // zaključavaju), condition_tag_id se ne šalje.
  const selectCustomParameter = () => {
    newSurcharge.value.conditionTagId = null;
  };

  // immediate: true - companyId polazi od hardkodovane vrednosti (vidi
  // useDeliveryCompaniesStore), ne od null-a, pa bez ovoga watch nikad ne bi
  // okinuo prvi fetch.
  watch(
    companyId,
    (id) => {
      if (!id) return;
      fetchSurcharges(id);
    },
    { immediate: true }
  );

  return {
    surcharges,
    loadingSurcharges,
    errorMessage,
    activeSurcharges,
    toggleSurcharge,
    newSurcharge,
    showAddSurcharge,
    savingSurcharge,
    addSurcharge,
    removeSurcharge,
    conditionTags,
    localPresets,
    selectConditionTag,
    selectPreset,
    selectCustomParameter,
  };
};
