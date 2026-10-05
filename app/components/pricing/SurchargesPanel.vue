<template>
  <div>
    <GlobalCard padding="20px" class="mb-4">
      <template #title>Dodatni parametri</template>
      <template #subtitle>Naknade i posebna pravila za obračun cene, po firmi.</template>
      <template #actions>
        <GlobalButtonPrimary
          prepend-icon="mdi-plus"
          @click="showAddSurcharge = !showAddSurcharge"
        >
          Novi parametar
        </GlobalButtonPrimary>
      </template>

      <div v-if="quickAddItems.length > 0" class="preset-row mt-3">
        <span class="preset-label">Brzo dodavanje:</span>
        <v-chip
          v-for="item in quickAddItems"
          :key="item.key"
          size="small"
          variant="outlined"
          :prepend-icon="item.icon"
          @click="onQuickAdd(item)"
        >
          {{ item.label }}
        </v-chip>
      </div>

      <v-expand-transition>
        <v-card v-if="showAddSurcharge" class="add-rule-card mt-4" variant="outlined">
          <v-row density="comfortable">
            <v-col cols="12" md="4">
              <GlobalTextField
                v-model="newSurcharge.name"
                label="Naziv (npr. Kiša)"
                :readonly="newSurcharge.conditionTagId !== null"
                :hint="
                  newSurcharge.conditionTagId !== null
                    ? 'Iz kataloga - naziv se ne menja.'
                    : undefined
                "
                persistent-hint
              />
              <v-btn
                v-if="newSurcharge.conditionTagId !== null"
                variant="text"
                size="small"
                density="compact"
                class="mt-1 pa-0"
                @click="emit('select-custom')"
              >
                Prilagođeni parametar
              </v-btn>
            </v-col>
            <v-col cols="12" md="3">
              <GlobalSelect
                v-model="newSurcharge.type"
                :items="[
                  { value: 'per_km', title: 'Po kilometru' },
                  { value: 'fixed', title: 'Fiksno' },
                  { value: 'note', title: 'Napomena (bez iznosa)' },
                ]"
                label="Tip"
              />
            </v-col>
            <v-col cols="6" md="2">
              <GlobalTextField
                v-model.number="newSurcharge.value"
                label="Iznos"
                type="number"
                step="0.05"
                :disabled="newSurcharge.type === 'note'"
              />
            </v-col>
            <v-col cols="6" md="3">
              <GlobalTextField
                v-model="newSurcharge.unit"
                :label="`Jedinica (npr. ${currency}/km)`"
              />
            </v-col>
            <v-col cols="12" md="5">
              <GlobalTextField v-model="newSurcharge.description" label="Opis" />
            </v-col>

            <v-col cols="12">
              <div class="auto-time-row">
                <div>
                  <span class="auto-time-label">Automatski po vremenu</span>
                  <p v-if="autoTimeHelp" class="auto-time-help">{{ autoTimeHelp }}</p>
                </div>
                <v-switch
                  v-model="newSurcharge.autoTime"
                  color="accent"
                  hide-details
                  density="compact"
                  @update:model-value="onAutoTimeToggle"
                />
              </div>
            </v-col>

            <template v-if="newSurcharge.autoTime">
              <v-col cols="6" md="3">
                <GlobalTimePicker
                  v-model="newSurcharge.timeFrom"
                  label="Vreme od"
                  clearable
                />
              </v-col>
              <v-col cols="6" md="3">
                <GlobalTimePicker
                  v-model="newSurcharge.timeTo"
                  label="Vreme do"
                  clearable
                />
              </v-col>
            </template>
          </v-row>
          <GlobalButtonPrimary
            size="small"
            :loading="savingSurcharge"
            @click="emit('add-surcharge')"
          >
            Sačuvaj parametar
          </GlobalButtonPrimary>
        </v-card>
      </v-expand-transition>
    </GlobalCard>

    <v-row v-if="loading">
      <v-col v-for="n in 3" :key="n" cols="12" sm="6" lg="4">
        <v-skeleton-loader type="article" class="surcharge-skeleton" />
      </v-col>
    </v-row>
    <v-row v-else-if="surcharges.length > 0">
      <v-col v-for="surcharge in surcharges" :key="surcharge.id" cols="12" sm="6" lg="4">
        <SurchargeCard
          :surcharge="surcharge"
          @toggle="emit('toggle', $event)"
          @remove="emit('remove', $event)"
        />
      </v-col>
    </v-row>
    <GlobalEmptyState v-else icon="mdi-currency-usd-off">
      Još nema dodatnih parametara za ovu firmu. Dodaj prvi preko dugmeta iznad.
    </GlobalEmptyState>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GlobalButtonPrimary from "~/components/common/GlobalButtonPrimary.vue";
import GlobalCard from "~/components/common/GlobalCard.vue";
import GlobalEmptyState from "~/components/common/GlobalEmptyState.vue";
import GlobalTimePicker from "~/components/common/GlobalTimePicker.vue";
import type {
  ConditionTag,
  NewSurchargeForm,
  Surcharge,
  SurchargePreset,
} from "~/types/pricing";
import { conditionTagDisplayIcon } from "~/utils/conditionTag";
import SurchargeCard from "./SurchargeCard.vue";

const props = defineProps<{
  surcharges: Surcharge[];
  conditionTags: ConditionTag[];
  localPresets: SurchargePreset[];
  savingSurcharge: boolean;
  loading: boolean;
  // Valuta firme - samo za placeholder jedinice (unit je slobodan tekst).
  currency: string;
}>();

const emit = defineEmits<{
  "select-tag": [tag: ConditionTag];
  "select-preset": [preset: SurchargePreset];
  "select-custom": [];
  "add-surcharge": [];
  toggle: [surcharge: Surcharge];
  remove: [id: number];
}>();

const newSurcharge = defineModel<NewSurchargeForm>("newSurcharge", { required: true });
const showAddSurcharge = defineModel<boolean>("showAddSurcharge", { required: true });

// Jedan red chip-ova - katalog tagovi (condition_tag_id) i lokalni predlozi
// (Centar grada, Brdovit teren) izgledaju isto, samo popunjavaju formu
// različito (vidi useSurcharges.selectConditionTag/selectPreset).
type QuickAddItem = {
  key: string;
  label: string;
  icon: string;
  source: ConditionTag | SurchargePreset;
};

const quickAddItems = computed<QuickAddItem[]>(() => [
  ...props.conditionTags.map((tag) => ({
    key: `tag-${tag.id}`,
    label: tag.name,
    icon: conditionTagDisplayIcon(tag),
    source: tag,
  })),
  ...props.localPresets.map((preset) => ({
    key: `preset-${preset.name}`,
    label: preset.name,
    icon: preset.icon,
    source: preset,
  })),
]);

const onQuickAdd = (item: QuickAddItem) => {
  if ("id" in item.source) emit("select-tag", item.source);
  else emit("select-preset", item.source);
};

const trimSeconds = (time: string) => time.slice(0, 5);

const autoTimeHelp = computed(() => {
  if (!newSurcharge.value.autoTime) return null;
  const tag = props.conditionTags.find((t) => t.id === newSurcharge.value.conditionTagId);
  if (tag?.default_time_from && tag.default_time_to) {
    return `Predlog iz kataloga - ${trimSeconds(tag.default_time_from)} do ${trimSeconds(
      tag.default_time_to
    )}, možeš izmeniti.`;
  }
  if (newSurcharge.value.conditionTagId !== null) {
    return `${newSurcharge.value.name} nema podrazumijevano vrijeme - podesi ručno.`;
  }
  return null;
});

// Isključivanje prekidača ne sme da ostavi stare vrednosti u skrivenim
// poljima - inače bi se tiho poslale uz sledeći "Sačuvaj parametar".
const onAutoTimeToggle = (value: boolean | null) => {
  if (!value) {
    newSurcharge.value.timeFrom = "";
    newSurcharge.value.timeTo = "";
  }
};
</script>

<style scoped>
.preset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-label {
  font-size: 0.8rem;
  color: #9aa4b2;
}

.add-rule-card {
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 16px;
}

.auto-time-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 0.5px solid #e7e9ee;
}

.auto-time-label {
  font-size: 0.85rem;
  font-weight: 600;
}

.auto-time-help {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: #9aa4b2;
}

.surcharge-skeleton {
  border: 1px solid #e7e9ee;
  border-radius: 16px;
}
</style>
