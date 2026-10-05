import { computed, ref, watch, type ComputedRef } from "vue";
import {
  createVehicleRule,
  deleteVehicleRule,
  updateVehicleRule,
  fetchVehicleRules as fetchVehicleRulesRequest,
  type VehicleRulePayload,
} from "~/services/vehicleRulesService";
import { toFriendlyErrorMessage } from "~/utils/errorMessage";
import { useAlertStore } from "~/stores/alert";
import type { VehicleRule, VehicleRuleConditionType, VehicleRuleVehicle } from "~/types/pricing";

export type NewVehicleRule = {
  conditionType: VehicleRuleConditionType;
  conditionText: string;
  zoneId: number | null;
  surchargeId: number | null;
  minDistanceKm: number | null;
  maxDistanceKm: number | null;
  preferredVehicles: string[];
  note: string;
  maxTerrainFactor: number | null;
};

const emptyNewRule = (): NewVehicleRule => ({
  conditionType: "surcharge",
  conditionText: "",
  zoneId: null,
  surchargeId: null,
  minDistanceKm: null,
  maxDistanceKm: null,
  preferredVehicles: [],
  note: "",
  maxTerrainFactor: null,
});

// Postojeće pravilo -> forma (za izmenu klikom na red). condition_type na starim
// pravilima može izostati - izvedemo ga iz popunjenih polja.
const inferConditionType = (rule: VehicleRule): VehicleRuleConditionType => {
  if (rule.condition_type) return rule.condition_type;
  if (rule.zone_id !== null) return "zone";
  if (rule.min_distance_km != null || rule.max_distance_km != null) return "distance";
  if (rule.surcharge_id != null) return "surcharge";
  return "default";
};

const ruleToForm = (rule: VehicleRule): NewVehicleRule => ({
  conditionType: inferConditionType(rule),
  conditionText: rule.condition_text,
  zoneId: rule.zone_id,
  surchargeId: rule.surcharge_id ?? null,
  minDistanceKm: rule.min_distance_km ?? null,
  maxDistanceKm: rule.max_distance_km ?? null,
  preferredVehicles:
    rule.preferred_vehicles && rule.preferred_vehicles.length > 0
      ? [...rule.preferred_vehicles]
      : [rule.vehicle],
  note: rule.note ?? "",
  maxTerrainFactor: rule.max_terrain_factor,
});

// Broj iz v-model.number polja ume da ostane prazan string kad se očisti
// (clearable/backspace) umesto null - normalizuj pre slanja na backend.
const normalizeNumber = (value: unknown): number | null => (Number.isFinite(value) ? (value as number) : null);

// options.enabled - lazy gate za tabove (vidi useFinanceSettings).
export const useVehicleRules = (
  companyId: ComputedRef<number | null>,
  options: { enabled?: ComputedRef<boolean> } = {}
) => {
  const alertStore = useAlertStore();

  const vehicleRules = ref<VehicleRule[]>([]);
  const loadingVehicleRules = ref(false);
  const errorMessage = ref("");

  const fetchVehicleRules = async (id: number) => {
    loadingVehicleRules.value = true;
    try {
      vehicleRules.value = await fetchVehicleRulesRequest(id);
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da učitam pravila za vozila.");
    } finally {
      loadingVehicleRules.value = false;
    }
  };

  const newRule = ref<NewVehicleRule>(emptyNewRule());
  const showAddRule = ref(false);
  const savingRule = ref(false);
  // null = forma je u režimu dodavanja; broj = menjamo postojeće pravilo.
  const editingRuleId = ref<number | null>(null);

  const closeRuleForm = () => {
    newRule.value = emptyNewRule();
    editingRuleId.value = null;
    showAddRule.value = false;
  };

  const startNewRule = () => {
    newRule.value = emptyNewRule();
    editingRuleId.value = null;
    showAddRule.value = true;
  };

  const startEditRule = (rule: VehicleRule) => {
    newRule.value = ruleToForm(rule);
    editingRuleId.value = rule.id;
    showAddRule.value = true;
  };

  // "distance" uslov zahteva bar jedno od min/max (backend vraća 422 ako su
  // oba prazna, 15.08 dopuna) - front proverava unapred da ne šalje uzalud.
  const isDistanceRangeValid = computed(
    () =>
      newRule.value.conditionType !== "distance" ||
      normalizeNumber(newRule.value.minDistanceKm) !== null ||
      normalizeNumber(newRule.value.maxDistanceKm) !== null
  );

  // Zajednički payload za create i update (redosled polja prati backend primer).
  const buildRulePayload = (priority: number): VehicleRulePayload => ({
    condition_text: newRule.value.conditionText.trim() || "Pravilo",
    // Postojeće (staro) polje - nema posebnog birača u novoj formi, pa šaljemo
    // najpoželjnije vozilo iz rangirane liste da polje ostane popunjeno (backend
    // primer u dokumentaciji šalje oba polja zajedno).
    vehicle: newRule.value.preferredVehicles[0] as VehicleRuleVehicle,
    zone_id: newRule.value.conditionType === "zone" ? newRule.value.zoneId : null,
    max_terrain_factor: normalizeNumber(newRule.value.maxTerrainFactor),
    note: newRule.value.note.trim() || null,
    condition_type: newRule.value.conditionType,
    surcharge_id: newRule.value.conditionType === "surcharge" ? newRule.value.surchargeId : null,
    min_distance_km:
      newRule.value.conditionType === "distance"
        ? normalizeNumber(newRule.value.minDistanceKm)
        : null,
    max_distance_km:
      newRule.value.conditionType === "distance"
        ? normalizeNumber(newRule.value.maxDistanceKm)
        : null,
    preferred_vehicles: newRule.value.preferredVehicles,
    priority,
  });

  // Jedno dugme "Sačuvaj" - kreira novo pravilo ili menja ono na koje je
  // dispečer kliknuo (editingRuleId). Redosled/priority se ne dira pri izmeni.
  const saveVehicleRule = async () => {
    if (
      newRule.value.preferredVehicles.length === 0 ||
      !companyId.value ||
      !isDistanceRangeValid.value
    )
      return;
    savingRule.value = true;
    try {
      if (editingRuleId.value !== null) {
        const existing = vehicleRules.value.find((r) => r.id === editingRuleId.value);
        const updated = await updateVehicleRule(
          editingRuleId.value,
          buildRulePayload(existing?.priority ?? vehicleRules.value.length)
        );
        vehicleRules.value = vehicleRules.value.map((r) =>
          r.id === updated.id ? updated : r
        );
        alertStore.success("Pravilo je izmenjeno.");
      } else {
        const created = await createVehicleRule(
          companyId.value,
          buildRulePayload(vehicleRules.value.length + 1)
        );
        vehicleRules.value.push(created);
        alertStore.success("Pravilo je dodato.");
      }
      closeRuleForm();
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam pravilo.");
    } finally {
      savingRule.value = false;
    }
  };

  const removeVehicleRule = async (id: number) => {
    try {
      await deleteVehicleRule(id);
      vehicleRules.value = vehicleRules.value.filter((r) => r.id !== id);
      alertStore.success("Pravilo je obrisano.");
    } catch (error) {
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da obrišem pravilo.");
    }
  };

  // Susedna zamena mesta (strelice gore/dole), ne proizvoljni drag&drop -
  // dira samo dva reda bez obzira na dužinu liste. Menja priority oba
  // pravila da redosled na backendu prati novu poziciju u listi.
  const moveRule = async (id: number, direction: "up" | "down") => {
    const index = vehicleRules.value.findIndex((r) => r.id === id);
    if (index === -1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= vehicleRules.value.length) return;

    const current = vehicleRules.value[index];
    const neighbor = vehicleRules.value[swapIndex];
    // index / swapIndex su već provjereni gore - guard je samo da TS suzi tip
    // (noUncheckedIndexedAccess), ne može se desiti u runtime-u.
    if (!current || !neighbor) return;
    const currentPriority = current.priority ?? index + 1;
    const neighborPriority = neighbor.priority ?? swapIndex + 1;

    const reordered = [...vehicleRules.value];
    reordered[index] = { ...neighbor, priority: currentPriority };
    reordered[swapIndex] = { ...current, priority: neighborPriority };
    vehicleRules.value = reordered;

    try {
      await Promise.all([
        updateVehicleRule(current.id, { priority: neighborPriority }),
        updateVehicleRule(neighbor.id, { priority: currentPriority }),
      ]);
    } catch (error) {
      vehicleRules.value = vehicleRules.value.map((r) => {
        if (r.id === current.id) return current;
        if (r.id === neighbor.id) return neighbor;
        return r;
      });
      errorMessage.value = toFriendlyErrorMessage(error, "Ne mogu da sačuvam novi redosled.");
    }
  };

  // immediate: true - prvi fetch firmi je asinhron (useDeliveryCompaniesStore),
  // pa companyId prelazi iz null u pravu vrednost posle mount-a; watch (ne
  // samo prvi poziv) je ono što stvarno okine fetchVehicleRules kad stigne.
  watch(
    [companyId, () => options.enabled?.value ?? true],
    ([id, enabled]) => {
      if (!id || !enabled) return;
      fetchVehicleRules(id);
    },
    { immediate: true }
  );

  return {
    vehicleRules,
    loadingVehicleRules,
    errorMessage,
    newRule,
    showAddRule,
    editingRuleId,
    isDistanceRangeValid,
    savingRule,
    saveVehicleRule,
    startNewRule,
    startEditRule,
    closeRuleForm,
    removeVehicleRule,
    moveRule,
  };
};
