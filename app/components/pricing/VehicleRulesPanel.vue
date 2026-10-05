<template>
  <GlobalCard padding="20px">
    <template #title>Pravila za odabir vozila</template>
    <template #subtitle>
      Pravila se podešavaju po firmi i utiču na predlog vozila za konkretnu narudžbu.
    </template>
    <template #actions>
      <GlobalButtonPrimary prepend-icon="mdi-plus" @click="emit('new-rule')">
        Novo pravilo
      </GlobalButtonPrimary>
    </template>

    <v-expand-transition>
      <v-card v-if="showAddRule" class="add-rule-card" variant="outlined">
        <div class="add-rule-heading">
          {{ editingRuleId !== null ? "Izmeni pravilo" : "Novo pravilo" }}
        </div>
        <div class="field-label">Uslov</div>
        <div class="cond-tabs">
          <button
            v-for="cond in CONDITIONS"
            :key="cond.key"
            type="button"
            class="cond-tab"
            :class="{ active: newRule.conditionType === cond.key }"
            @click="newRule.conditionType = cond.key"
          >
            <v-icon :icon="cond.icon" size="18" />
            {{ cond.label }}
          </button>
        </div>

        <div class="cond-field mb-4">
          <GlobalSelect
            v-if="newRule.conditionType === 'zone'"
            v-model="newRule.zoneId"
            :items="zoneItems"
            item-title="title"
            item-value="value"
            label="Zona"
            hide-details="auto"
          />
          <GlobalSelect
            v-else-if="newRule.conditionType === 'surcharge'"
            v-model="newRule.surchargeId"
            :items="surchargeItems"
            item-title="title"
            item-value="value"
            label="Naknada (iz Dodatni parametri)"
            hide-details="auto"
          />
          <div v-else-if="newRule.conditionType === 'distance'">
            <div class="distance-fields">
              <GlobalTextField
                v-model.number="newRule.minDistanceKm"
                label="Udaljenost od (km)"
                type="number"
                hide-details="auto"
              />
              <GlobalTextField
                v-model.number="newRule.maxDistanceKm"
                label="Udaljenost do (km)"
                type="number"
                hide-details="auto"
              />
            </div>
            <p v-if="!isDistanceRangeValid" class="distance-error mb-0 mt-1">
              Popuni bar jedno od polja (od/do).
            </p>
          </div>
          <p v-else class="empty-copy mb-0">
            Bez dodatnog uslova - uvijek se poklapa (koristi se kao fallback).
          </p>
        </div>

        <div class="field-label">Preporučena vozila (redosled bitan)</div>
        <div class="vehicle-picker mb-2">
          <v-btn
            v-for="vehicle in VEHICLE_OPTIONS"
            :key="vehicle.key"
            size="small"
            variant="outlined"
            :disabled="newRule.preferredVehicles.includes(vehicle.key)"
            @click="newRule.preferredVehicles.push(vehicle.key)"
          >
            <v-icon start :icon="vehicle.icon" size="16" />
            {{ vehicle.label }}
          </v-btn>
        </div>
        <div class="vehicle-order mb-4">
          <span v-if="newRule.preferredVehicles.length === 0" class="empty-copy">
            Klikni vozila iznad, redosledom preferencije
          </span>
          <v-chip
            v-for="(vehicle, index) in newRule.preferredVehicles"
            :key="vehicle"
            size="small"
            closable
            color="primary"
            variant="tonal"
            @click:close="newRule.preferredVehicles.splice(index, 1)"
          >
            {{ index + 1 }}.
            <v-icon :icon="vehicleMeta(vehicle).icon" size="14" class="mx-1" />
            {{ vehicleMeta(vehicle).label }}
          </v-chip>
        </div>

        <GlobalTextField
          v-model.number="newRule.maxTerrainFactor"
          label="Maks. faktor terena (opciono)"
          type="number"
          step="0.1"
          class="mb-1"
          hint="1.0 = ravnica, veći broj = brdovitiji teren (npr. 1.5 za umjereno brdo). Prazno = bez ograničenja."
          persistent-hint
          clearable
        />

        <GlobalTextField
          v-model="newRule.note"
          label="Napomena"
          class="mb-3 mt-3"
          hide-details="auto"
        />

        <div class="d-flex align-center ga-2">
          <GlobalButtonPrimary
            size="small"
            :loading="savingRule"
            :disabled="newRule.preferredVehicles.length === 0 || !isDistanceRangeValid"
            @click="emit('save-rule')"
          >
            {{ editingRuleId !== null ? "Sačuvaj izmene" : "Sačuvaj pravilo" }}
          </GlobalButtonPrimary>
          <v-btn
            size="small"
            variant="text"
            :disabled="savingRule"
            @click="emit('cancel')"
          >
            Otkaži
          </v-btn>
        </div>
      </v-card>
    </v-expand-transition>

    <div v-if="loading" class="rules-list">
      <v-skeleton-loader
        v-for="n in 3"
        :key="n"
        type="list-item-avatar-two-line"
        class="rule-skeleton"
      />
    </div>
    <v-list v-else-if="vehicleRules.length > 0" class="rules-list">
      <v-list-item
        v-for="(rule, index) in vehicleRules"
        :key="rule.id"
        rounded="lg"
        class="rule-item"
        :class="{
          matched: rule.id === matchedRuleId,
          editing: rule.id === editingRuleId,
        }"
        title="Klikni za izmenu pravila"
        @click="emit('edit-rule', rule)"
      >
        <template #prepend>
          <div class="d-flex align-center ga-2">
            <span class="rule-index">{{ index + 1 }}</span>
            <v-avatar :style="{ background: vehicleMeta(rule.vehicle).color + '1a' }">
              <v-icon
                :icon="vehicleMeta(rule.vehicle).icon"
                :color="vehicleMeta(rule.vehicle).color"
              />
            </v-avatar>
          </div>
        </template>

        <v-list-item-title class="d-flex align-center flex-wrap ga-2">
          {{ rule.condition_text }}
          <v-chip
            v-if="rule.condition_type"
            size="x-small"
            :color="conditionBadge(rule.condition_type).color"
            variant="flat"
          >
            {{ conditionBadge(rule.condition_type).label }}
          </v-chip>
          <v-chip
            v-if="rule.id === matchedRuleId"
            size="x-small"
            color="info"
            variant="flat"
          >
            Poklapa se
          </v-chip>
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ rule.note }}
          <span v-if="rule.zone_id !== null"> · Zona: {{ zoneName(rule.zone_id) }}</span>
          <span v-if="rule.max_terrain_factor !== null">
            · Maks. faktor terena: {{ rule.max_terrain_factor }}</span
          >
          <span v-if="distanceLabel(rule)"> · {{ distanceLabel(rule) }}</span>
        </v-list-item-subtitle>
        <div v-if="rulePreferredVehicles(rule).length > 1" class="ranked-row">
          <span
            v-for="(vehicle, vIndex) in rulePreferredVehicles(rule)"
            :key="vehicle + vIndex"
          >
            {{ vIndex + 1 }}.
            <v-icon :icon="vehicleMeta(vehicle).icon" size="14" />
            {{ vehicleMeta(vehicle).label }}
          </span>
        </div>

        <template #append>
          <div class="d-flex align-center ga-1" @click.stop>
            <div class="d-flex flex-column">
              <v-btn
                icon="mdi-chevron-up"
                variant="text"
                size="x-small"
                :disabled="index === 0"
                @click="emit('move-rule', rule.id, 'up')"
              />
              <v-btn
                icon="mdi-chevron-down"
                variant="text"
                size="x-small"
                :disabled="index === vehicleRules.length - 1"
                @click="emit('move-rule', rule.id, 'down')"
              />
            </div>
            <GlobalButtonDelete
              ariaLabel="Obriši pravilo"
              @click="emit('remove-rule', rule.id)"
            />
          </div>
        </template>
      </v-list-item>
    </v-list>
    <GlobalEmptyState v-else icon="mdi-car-cog">
      Još nema pravila za ovu firmu. Dodaj prvo preko dugmeta iznad.
    </GlobalEmptyState>
  </GlobalCard>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalButtonDelete from "~/components/common/GlobalButtonDelete.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import type {
  Surcharge,
  VehicleRule,
  VehicleRuleConditionType,
  VehicleRuleVehicle,
} from "~/types/pricing";
import type { DispatcherZone } from "~/types/dispatcherZone";
import type { NewVehicleRule } from "~/composables/useVehicleRules";
import { RULE_VEHICLE_META, ruleVehicleMeta as vehicleMeta } from "~/utils/vehicle";

const CONDITIONS: { key: VehicleRuleConditionType; label: string; icon: string }[] = [
  { key: "zone", label: "Zona", icon: "mdi-map-marker" },
  { key: "surcharge", label: "Naknada", icon: "mdi-weather-rainy" },
  { key: "distance", label: "Udaljenost", icon: "mdi-ruler" },
  { key: "default", label: "Uvijek", icon: "mdi-infinity" },
];

const CONDITION_BADGES: Record<
  VehicleRuleConditionType,
  { label: string; color: string }
> = {
  zone: { label: "Zona", color: "info" },
  surcharge: { label: "Naknada", color: "warning" },
  distance: { label: "Udaljenost", color: "secondary" },
  default: { label: "Uvijek", color: "grey" },
};
const conditionBadge = (type: string) =>
  CONDITION_BADGES[type as VehicleRuleConditionType] ?? { label: type, color: "grey" };

// vehicle-rules vokabular (backend DIO 4, 4.1): car, motorbike, bicycle, walk.
const VEHICLE_OPTIONS = (Object.keys(RULE_VEHICLE_META) as VehicleRuleVehicle[]).map(
  (key) => ({
    key,
    label: RULE_VEHICLE_META[key].label,
    icon: RULE_VEHICLE_META[key].icon,
  })
);

const props = defineProps<{
  vehicleRules: VehicleRule[];
  savingRule: boolean;
  loading: boolean;
  zones: DispatcherZone[];
  surcharges: Surcharge[];
  matchedRuleId: number | null;
  // Id pravila koje se trenutno menja (klik na red), null = forma dodaje novo.
  editingRuleId: number | null;
  isDistanceRangeValid: boolean;
}>();

const emit = defineEmits<{
  "save-rule": [];
  "new-rule": [];
  "edit-rule": [rule: VehicleRule];
  cancel: [];
  "remove-rule": [id: number];
  "move-rule": [id: number, direction: "up" | "down"];
}>();

const newRule = defineModel<NewVehicleRule>("newRule", { required: true });
const showAddRule = defineModel<boolean>("showAddRule", { required: true });

const zoneItems = computed(() => [
  { title: "Cela firma", value: null },
  ...props.zones.map((zone) => ({ title: toLatin(zone.name), value: zone.id })),
]);

const surchargeItems = computed(() =>
  props.surcharges.map((s) => ({ title: s.name, value: s.id }))
);

const zoneName = (zoneId: number) =>
  toLatin(props.zones.find((zone) => zone.id === zoneId)?.name) || `#${zoneId}`;

const rulePreferredVehicles = (rule: VehicleRule) =>
  rule.preferred_vehicles && rule.preferred_vehicles.length > 0
    ? rule.preferred_vehicles
    : [rule.vehicle];

// "ispod X km" (15.08 dopuna) - min/max zajedno prave opseg, samo jedno je i
// dalje validno ("preko"/"ispod").
const distanceLabel = (rule: VehicleRule) => {
  const min = rule.min_distance_km ?? null;
  const max = rule.max_distance_km ?? null;
  if (min !== null && max !== null) return `Udaljenost: ${min}–${max} km`;
  if (min !== null) return `Udaljenost preko ${min} km`;
  if (max !== null) return `Udaljenost ispod ${max} km`;
  return null;
};

// Mockup forma nema poseban unos za condition_text (samo Napomena), ali API
// payload i lista pravila ga i dalje koriste kao glavni naslov reda - pa ga
// generišemo iz izabranog taba/vrednosti umesto da tražimo dupli unos.
watch(
  () =>
    [
      newRule.value.conditionType,
      newRule.value.zoneId,
      newRule.value.surchargeId,
      newRule.value.minDistanceKm,
      newRule.value.maxDistanceKm,
    ] as const,
  ([conditionType, zoneId, surchargeId, minDistanceKm, maxDistanceKm]) => {
    if (conditionType === "zone") {
      newRule.value.conditionText =
        zoneId !== null ? `Zona: ${zoneName(zoneId)}` : "Zona";
    } else if (conditionType === "surcharge") {
      const name = props.surcharges.find((s) => s.id === surchargeId)?.name;
      newRule.value.conditionText = name ? `Naknada: ${name}` : "Naknada";
    } else if (conditionType === "distance") {
      if (minDistanceKm && maxDistanceKm) {
        newRule.value.conditionText = `Udaljenost ${minDistanceKm}–${maxDistanceKm} km`;
      } else if (minDistanceKm) {
        newRule.value.conditionText = `Udaljenost preko ${minDistanceKm} km`;
      } else if (maxDistanceKm) {
        newRule.value.conditionText = `Udaljenost ispod ${maxDistanceKm} km`;
      } else {
        newRule.value.conditionText = "Udaljenost";
      }
    } else {
      newRule.value.conditionText = "Uvijek";
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.add-rule-card {
  padding: 16px;
  margin-top: 8px;
  margin-bottom: 16px;
  border-radius: 16px;
}

.add-rule-heading {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 12px;
}

.field-label {
  font-size: 12px;
  color: #6b7685;
  margin-bottom: 6px;
}

.cond-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.distance-fields {
  display: flex;
  gap: 12px;
}

.distance-fields > * {
  flex: 1;
  min-width: 0;
}

.distance-error {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-error));
}

.cond-tab {
  font-size: 12px;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 1px solid #e7e9ee;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  color: inherit;
}

.cond-tab.active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgb(var(--v-theme-primary));
}

.vehicle-picker {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.vehicle-order {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 32px;
  padding: 8px;
  background: #f5f6f8;
  border-radius: 10px;
}

.rules-list {
  margin-top: 8px;
  background: transparent;
  display: grid;
  gap: 6px;
}

.rule-skeleton {
  border: 1px solid #e7e9ee;
  border-radius: 12px;
}

.rule-item {
  border: 1px solid #e7e9ee;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.rule-item:hover {
  border-color: #c9ced8;
  background: #fafbfc;
}

.rule-item.matched {
  border-color: rgb(var(--v-theme-info));
  background: rgba(var(--v-theme-info), 0.06);
}

.rule-item.editing {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

.rule-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #eef1f5;
  color: #6b7685;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.ranked-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 0.78rem;
  color: #6b7685;
}

.empty-copy {
  color: #9aa4b2;
  padding: 20px 0;
}
</style>
